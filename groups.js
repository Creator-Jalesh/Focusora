window.addEventListener("DOMContentLoaded", function() {
    const createGroupBtn = document.getElementById('createGroupBtn');
    const joinGroupBtn = document.getElementById('joinGroupBtn');
    const groupNameInput = document.getElementById('groupNameInput');
    const joinCodeInput = document.getElementById('joinCodeInput');
    
    const choiceOverlay = document.getElementById('choiceOverlay');
    const activeWorkspace = document.getElementById('activeWorkspace');
    const camGrid = document.getElementById('camGrid');
    const stopwatch = document.getElementById('stopwatch');
    const stopBtn = document.getElementById('stopBtn');
    
    const groupBadge = document.getElementById('groupBadge');
    const displayGroupName = document.getElementById('displayGroupName');
    const displayGroupCode = document.getElementById('displayGroupCode');
    const savedTimeEl = document.getElementById('savedTimeDisplay');
    
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');

    let timerInterval;
    let seconds = 0;
    let isJoined = false;
    let currentStream = null;
    let totalSavedSeconds = 0;
    let currentUser = null;

    let myPeer = null;
    let currentPeerId = null;
    let currentRoomCode = null;
    let peerConnections = {};
    let roomUnsubscribe = null;

    if(choiceOverlay) choiceOverlay.style.display = 'flex';
    if(activeWorkspace) activeWorkspace.style.display = 'none';
    if(stopBtn) stopBtn.style.display = 'none';
    if(groupBadge) groupBadge.style.display = 'none';

    function formatTime(totalSeconds) {
        const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        return hrs + ":" + mins + ":" + secs;
    }

    // Firebase Auth state observer to fetch correct user data from Firestore
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                try {
                    const docRef = firebase.firestore().collection('users').doc(user.uid);
                    const doc = await docRef.get();
                    if (doc.exists) {
                        totalSavedSeconds = doc.data().savedTime || 0;
                    } else {
                        totalSavedSeconds = 0;
                    }
                } catch (err) {
                    console.error("Error fetching user data from Firestore:", err);
                    totalSavedSeconds = 0;
                }
            } else {
                currentUser = null;
                totalSavedSeconds = 0;
            }

            if (savedTimeEl) {
                savedTimeEl.textContent = "Today's Total: " + formatTime(totalSavedSeconds);
            }
        });
    }

    function toggleMenuLock(lock) {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            if (!item.classList.contains('theme-toggle')) {
                if (lock) item.classList.add('disabled');
                else item.classList.remove('disabled');
            }
        });
        const profileLink = document.getElementById('profileLink');
        if (profileLink) {
            if (lock) profileLink.classList.add('disabled');
            else profileLink.classList.remove('disabled');
        }
    }

    // Video Stream Element Generator
    function addVideoStream(stream, label, id, isLocal = false) {
        let userBox = document.getElementById(id);
        if(userBox) {
            const videoEl = userBox.querySelector('video');
            if (videoEl && videoEl.srcObject !== stream) {
                videoEl.srcObject = stream;
            }
            return;
        }

        userBox = document.createElement('div');
        userBox.className = 'cam-box';
        userBox.id = id;
        
        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = isLocal;
        videoEl.srcObject = stream;

        const tagEl = document.createElement('div');
        tagEl.className = 'user-tag';
        tagEl.innerText = label;

        userBox.appendChild(videoEl);
        userBox.appendChild(tagEl);

        if(camGrid) {
            camGrid.appendChild(userBox);
        }
    }

    function removeVideoStream(peerId) {
        const userBox = document.getElementById(peerId);
        if(userBox) userBox.remove();
        if (peerConnections[peerId]) {
            delete peerConnections[peerId];
        }
    }

    // Connect to specific peer in room
    function connectToPeer(peerId, stream) {
        if (peerConnections[peerId] || peerId === currentPeerId) return;

        const call = myPeer.call(peerId, stream);
        if(!call) return;

        call.on('stream', (remoteStream) => {
            addVideoStream(remoteStream, 'Member 👤', call.peer, false);
        });

        call.on('close', () => {
            removeVideoStream(call.peer);
        });

        call.on('error', () => {
            removeVideoStream(call.peer);
        });

        peerConnections[call.peer] = call;
    }

    if(createGroupBtn) {
        createGroupBtn.onclick = async function() {
            const groupName = groupNameInput ? groupNameInput.value.trim() : "";
            if(!groupName) { alert("Please enter a group name first!"); return; }
            const randomCode = "FOCUS-" + Math.floor(1000 + Math.random() * 9000);
            startSession(groupName, randomCode);
        };
    }

    if(joinGroupBtn) {
        joinGroupBtn.onclick = async function() {
            const code = joinCodeInput ? joinCodeInput.value.trim() : "";
            if(!code) { alert("Please enter a valid group share code!"); return; }
            startSession("Joined Room", code.toUpperCase());
        };
    }

    async function startSession(name, code) {
        isJoined = true;
        seconds = 0;
        currentRoomCode = code;
        peerConnections = {};

        if(choiceOverlay) choiceOverlay.style.display = 'none';
        if(activeWorkspace) activeWorkspace.style.display = 'flex';
        if(stopBtn) stopBtn.style.display = 'flex';
        if(groupBadge) groupBadge.style.display = 'block';

        if(displayGroupName) displayGroupName.textContent = name;
        if(displayGroupCode) displayGroupCode.textContent = code;
        
        toggleMenuLock(true);
        if(camGrid) camGrid.innerHTML = ''; 

        if(stopwatch) stopwatch.textContent = "00:00:00";
        timerInterval = setInterval(() => {
            seconds++;
            if(stopwatch) stopwatch.textContent = formatTime(seconds);
        }, 1000);

        try {
            // Low latency lightweight stream constraints
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 320, max: 480 },
                    height: { ideal: 240, max: 360 },
                    frameRate: { ideal: 15, max: 20 }
                },
                audio: false
            });
            addVideoStream(currentStream, 'You 🔴', 'myLiveCamBox', true);

            // PeerJS init with public STUN configuration
            myPeer = new Peer(undefined, {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                }
            });

            myPeer.on('open', async (id) => {
                currentPeerId = id;

                // 1. Register peer to group room sub-collection
                if (typeof firebase !== 'undefined' && firebase.firestore) {
                    await firebase.firestore().collection('group_rooms').doc(code).collection('members').doc(id).set({
                        peerId: id,
                        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // 2. Listen to real-time group peers
                    roomUnsubscribe = firebase.firestore().collection('group_rooms').doc(code).collection('members').onSnapshot((snapshot) => {
                        snapshot.docChanges().forEach((change) => {
                            const peerId = change.doc.id;

                            if (change.type === 'added' && peerId !== currentPeerId) {
                                connectToPeer(peerId, currentStream);
                            }
                            if (change.type === 'removed') {
                                if (peerConnections[peerId]) {
                                    peerConnections[peerId].close();
                                    delete peerConnections[peerId];
                                }
                                removeVideoStream(peerId);
                            }
                        });
                    });
                }
            });

            myPeer.on('call', (call) => {
                call.answer(currentStream);

                call.on('stream', (remoteStream) => {
                    addVideoStream(remoteStream, 'Member 👤', call.peer, false);
                });

                call.on('close', () => {
                    removeVideoStream(call.peer);
                });

                call.on('error', () => {
                    removeVideoStream(call.peer);
                });

                peerConnections[call.peer] = call;
            });

        } catch(err) {
            console.error("Camera Access Failed:", err);
            alert("Camera permission is required!");
            if(stopBtn) stopBtn.click();
        }
    }

    function sendChatMessage() {
        if(!chatInput || !chatMessages) return;
        const text = chatInput.value.trim();
        if(!text) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg outgoing';
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if(sendChatBtn) sendChatBtn.onclick = sendChatMessage;
    if(chatInput) chatInput.onkeypress = (e) => { if(e.key === 'Enter') sendChatMessage(); };

    // Stop/Leave Button
    if(stopBtn) {
        stopBtn.onclick = async function() {
            if(!isJoined) return;
            clearInterval(timerInterval);
            totalSavedSeconds += seconds;

            // Save to Firestore for the specific logged-in user
            if (currentUser && typeof firebase !== 'undefined' && firebase.firestore) {
                try {
                    await firebase.firestore().collection('users').doc(currentUser.uid).set({
                        savedTime: totalSavedSeconds,
                        email: currentUser.email,
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                } catch (err) {
                    console.error("Error saving time to Firestore:", err);
                }
            } else {
                localStorage.setItem('focusora_saved_time', totalSavedSeconds);
            }

            if(savedTimeEl) savedTimeEl.textContent = "Today's Total: " + formatTime(totalSavedSeconds);

            // Clean room listener
            if (roomUnsubscribe) {
                roomUnsubscribe();
                roomUnsubscribe = null;
            }

            // Remove member from group in Firestore
            if (currentRoomCode && currentPeerId && typeof firebase !== 'undefined' && firebase.firestore) {
                firebase.firestore().collection('group_rooms').doc(currentRoomCode).collection('members').doc(currentPeerId).delete().catch(() => {});
            }

            if(currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
            }

            Object.keys(peerConnections).forEach(peerId => {
                if(peerConnections[peerId]) peerConnections[peerId].close();
            });
            peerConnections = {};

            if(myPeer) { 
                myPeer.destroy(); 
                myPeer = null; 
            }
            
            if(camGrid) camGrid.innerHTML = '';
            toggleMenuLock(false);
            isJoined = false;
            if(choiceOverlay) choiceOverlay.style.display = 'flex';
            if(activeWorkspace) activeWorkspace.style.display = 'none';
            if(stopBtn) stopBtn.style.display = 'none';
            if(groupBadge) groupBadge.style.display = 'none';
            if(stopwatch) stopwatch.textContent = "00:00:00";
            seconds = 0;
            if(groupNameInput) groupNameInput.value = '';
            if(joinCodeInput) joinCodeInput.value = '';
        };
    }

    // Tab close cleanup
    window.addEventListener("beforeunload", () => {
        if (currentRoomCode && currentPeerId && typeof firebase !== 'undefined' && firebase.firestore) {
            firebase.firestore().collection('group_rooms').doc(currentRoomCode).collection('members').doc(currentPeerId).delete();
        }
    });
});