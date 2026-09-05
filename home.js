window.addEventListener("DOMContentLoaded", async function() {
    const joinBtn = document.getElementById('joinBtn');
    const stopBtn = document.getElementById('stopBtn');
    const joinOverlay = document.getElementById('joinOverlay');
    const stopwatch = document.getElementById('stopwatch');
    const camGrid = document.getElementById('camGrid');
    const savedTimeEl = document.getElementById('savedTimeDisplay');
    
    // Sidebar links
    const leaderboardLink = document.getElementById('leaderboardLink');
    const groupsLink = document.getElementById('groupsLink');
    const goalsLink = document.getElementById('goalsLink');

    let timerInterval;
    let seconds = 0;
    let isJoined = false;
    let currentStream = null;
    let totalSavedSeconds = 0;
    let currentUser = null;
    let myDisplayName = "Focus Member";

    let myPeer = null;
    let currentPeerId = null;
    let peerConnections = {};
    let peerNames = {}; // peerId -> userName mapping
    let roomUnsubscribe = null;

    // Time Format Helper
    function formatTime(totalSeconds) {
        const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        return hrs + ":" + mins + ":" + secs;
    }

    // Helper to resolve current username cleanly
    function resolveDisplayName(user, docData) {
        if (docData && (docData.name || docData.username || docData.displayName)) {
            return docData.name || docData.username || docData.displayName;
        }
        if (user && user.displayName) {
            return user.displayName;
        }
        if (user && user.email) {
            return user.email.split('@')[0];
        }
        return localStorage.getItem('focusora_username') || "Focus Member";
    }

    // Firebase Auth State Observer
    if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                try {
                    const docRef = firebase.firestore().collection('users').doc(user.uid);
                    const doc = await docRef.get();
                    if (doc.exists) {
                        const userData = doc.data();
                        totalSavedSeconds = userData.savedTime || 0;
                        myDisplayName = resolveDisplayName(user, userData);
                    } else {
                        totalSavedSeconds = 0;
                        myDisplayName = resolveDisplayName(user, null);
                    }
                } catch (err) {
                    console.error("Error fetching user data from Firestore:", err);
                    totalSavedSeconds = 0;
                    myDisplayName = resolveDisplayName(user, null);
                }
            } else {
                currentUser = null;
                totalSavedSeconds = 0;
                myDisplayName = "Focus Member";
            }

            if (savedTimeEl) {
                savedTimeEl.textContent = "Today's Total: " + formatTime(totalSavedSeconds);
            }
        });
    }

    // Initial placeholder state
    if (camGrid) {
        camGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #888;">Click "Start Focus Session" to join the Public Global Study Room.</div>';
    }

    // High performance video element renderer with dynamic name badge
    function addVideoStream(stream, label, id, isLocal = false) {
        let userBox = document.getElementById(id);
        if (userBox) {
            const videoEl = userBox.querySelector('video');
            if (videoEl && videoEl.srcObject !== stream) {
                videoEl.srcObject = stream;
            }
            const tagEl = userBox.querySelector('.user-cam-badge span:last-child');
            if (tagEl && label) {
                tagEl.textContent = label;
            }
            return;
        }

        userBox = document.createElement('div');
        userBox.className = 'cam-card';
        userBox.id = id;

        const videoEl = document.createElement('video');
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.muted = isLocal;
        videoEl.srcObject = stream;

        // Overlay Badge with Live Indicator Dot
        const badgeEl = document.createElement('div');
        badgeEl.className = 'user-cam-badge';

        const dotEl = document.createElement('span');
        dotEl.className = 'status-dot';
        if (isLocal) {
            dotEl.style.backgroundColor = '#ef4444'; // Red dot for local user
        }

        const nameEl = document.createElement('span');
        nameEl.textContent = label;

        badgeEl.appendChild(dotEl);
        badgeEl.appendChild(nameEl);

        userBox.appendChild(videoEl);
        userBox.appendChild(badgeEl);

        if (camGrid) {
            camGrid.appendChild(userBox);
        }
    }

    function removeVideoStream(peerId) {
        const userBox = document.getElementById(peerId);
        if (userBox) userBox.remove();
        delete peerNames[peerId];
    }

    // Fast call dispatcher with dynamic name attachment
    function connectToNewUser(peerId, stream, peerUserName) {
        if (peerConnections[peerId] || peerId === currentPeerId) return;

        if (peerUserName) {
            peerNames[peerId] = peerUserName;
        }

        const call = myPeer.call(peerId, stream, {
            metadata: { userName: myDisplayName }
        });
        if (!call) return;

        call.on('stream', (remoteStream) => {
            const displayName = peerNames[peerId] || 'Member 👤';
            addVideoStream(remoteStream, displayName, call.peer, false);
        });

        call.on('close', () => {
            removeVideoStream(call.peer);
            delete peerConnections[call.peer];
        });

        call.on('error', () => {
            removeVideoStream(call.peer);
            delete peerConnections[call.peer];
        });

        peerConnections[call.peer] = call;
    }

    // Menu lock
    function toggleMenuLock(lock) {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            if (!item.classList.contains('theme-toggle')) {
                if (lock) {
                    item.classList.add('disabled');
                } else {
                    item.classList.remove('disabled');
                }
            }
        });

        const profileLink = document.getElementById('profileLink');
        if (profileLink) {
            if (lock) {
                profileLink.classList.add('disabled');
            } else {
                profileLink.classList.remove('disabled');
            }
        }
    }

    // Start Focus Session
    if (joinBtn) {
        joinBtn.onclick = async function() {
            if (isJoined) return;

            try {
                joinBtn.disabled = true;
                joinBtn.innerText = "Connecting...";

                // Optimized constraints for multi-peer stability & fast frame transmission
                currentStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 320, max: 480 },
                        height: { ideal: 240, max: 360 },
                        frameRate: { ideal: 15, max: 20 }
                    },
                    audio: false
                });

                isJoined = true;
                seconds = 0;

                if (joinOverlay) joinOverlay.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'flex';
                if (stopwatch) stopwatch.textContent = "00:00:00";

                toggleMenuLock(true);
                if (camGrid) camGrid.innerHTML = '';

                // Show local camera with exact User Name
                const localLabel = myDisplayName ? `${myDisplayName} (You)` : 'You (Live)';
                addVideoStream(currentStream, localLabel, 'myLiveCamBox', true);

                // Timer start
                timerInterval = setInterval(() => {
                    seconds++;
                    if (stopwatch) stopwatch.textContent = formatTime(seconds);
                }, 1000);

                // Initialize Peer with public STUN servers for direct P2P mesh
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

                    // 1. Register to public room pool in Firestore with username
                    if (typeof firebase !== 'undefined' && firebase.firestore) {
                        await firebase.firestore().collection('public_focus_room').doc(id).set({
                            peerId: id,
                            userName: myDisplayName,
                            userId: currentUser ? currentUser.uid : null,
                            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        // 2. Real-time mesh sync listener
                        roomUnsubscribe = firebase.firestore().collection('public_focus_room').onSnapshot((snapshot) => {
                            snapshot.docChanges().forEach((change) => {
                                const peerId = change.doc.id;
                                const data = change.doc.data();

                                if (change.type === 'added' && peerId !== currentPeerId) {
                                    const remoteUserName = data.userName || 'Member 👤';
                                    peerNames[peerId] = remoteUserName;
                                    connectToNewUser(peerId, currentStream, remoteUserName);
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

                // Answer incoming calls
                myPeer.on('call', (call) => {
                    // Extract caller name from metadata if passed, otherwise fall back to pool cache
                    const callerName = (call.metadata && call.metadata.userName) 
                        ? call.metadata.userName 
                        : (peerNames[call.peer] || 'Member 👤');

                    peerNames[call.peer] = callerName;
                    call.answer(currentStream);

                    call.on('stream', (remoteStream) => {
                        const labelToRender = peerNames[call.peer] || 'Member 👤';
                        addVideoStream(remoteStream, labelToRender, call.peer, false);
                    });

                    call.on('close', () => {
                        removeVideoStream(call.peer);
                        delete peerConnections[call.peer];
                    });

                    call.on('error', () => {
                        removeVideoStream(call.peer);
                        delete peerConnections[call.peer];
                    });

                    peerConnections[call.peer] = call;
                });

            } catch (err) {
                console.error("Camera Access Error:", err);
                if (camGrid) {
                    camGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #ff5555;">Camera permission is required. Please allow access and try again.</div>';
                }
                isJoined = false;
                joinBtn.disabled = false;
                joinBtn.innerText = "▶ Start Focus Session";
                if (joinOverlay) joinOverlay.style.display = 'flex';
                if (stopBtn) stopBtn.style.display = 'none';
                toggleMenuLock(false);
                if (timerInterval) clearInterval(timerInterval);
            }
        };
    }

    // Stop Session
    if (stopBtn) {
        stopBtn.onclick = async function() {
            if (!isJoined) return;

            clearInterval(timerInterval);
            totalSavedSeconds += seconds;

            // Save time to Firestore
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
            
            if (savedTimeEl) {
                savedTimeEl.textContent = "Today's Total: " + formatTime(totalSavedSeconds);
            }

            // Unsubscribe room listener
            if (roomUnsubscribe) {
                roomUnsubscribe();
                roomUnsubscribe = null;
            }

            // Remove from public room pool
            if (currentPeerId && typeof firebase !== 'undefined' && firebase.firestore) {
                firebase.firestore().collection('public_focus_room').doc(currentPeerId).delete().catch(() => {});
            }

            // Stop local tracks
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                currentStream = null;
            }

            // Close all peers
            Object.keys(peerConnections).forEach(peerId => {
                if (peerConnections[peerId]) peerConnections[peerId].close();
            });
            peerConnections = {};
            peerNames = {};

            if (myPeer) { 
                myPeer.destroy(); 
                myPeer = null; 
            }

            toggleMenuLock(false);
            isJoined = false;
            joinBtn.disabled = false;
            joinBtn.innerText = "▶ Start Focus Session";

            if (joinOverlay) joinOverlay.style.display = 'flex';
            if (stopBtn) stopBtn.style.display = 'none';
            if (stopwatch) stopwatch.textContent = "00:00:00";
            seconds = 0;

            if (camGrid) {
                camGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #888;">Click "Start Focus Session" to join the Public Global Study Room.</div>';
            }
        };
    }

    // Tab close cleanup
    window.addEventListener("beforeunload", () => {
        if (currentPeerId && typeof firebase !== 'undefined' && firebase.firestore) {
            firebase.firestore().collection('public_focus_room').doc(currentPeerId).delete();
        }
    });
});