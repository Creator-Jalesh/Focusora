// ==========================================
// Focusora - Home Workspace Logic (Study Sphere)
// Zero-lag, Instant Stop & Fast Peer Sync
// ==========================================

let timerInterval = null;
let seconds = 0;
let isJoined = false;
let totalSavedSeconds = 0;
let currentUser = null;
let myDisplayName = "Focus Member";
let myActiveDocId = null;
let roomUnsubscribe = null;
let peerDesks = [];
let currentFilter = 'all';

function formatTime(totalSeconds) {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

function resolveDisplayName(user, docData) {
    if (docData && (docData.name || docData.username || docData.displayName)) {
        return docData.name || docData.username || docData.displayName;
    }
    if (user && user.displayName) return user.displayName;
    if (user && user.email) return user.email.split('@')[0];
    return localStorage.getItem('focusora_username') || "Focus Member";
}

function toggleMenuLock(lock) {
    const menuItems = document.querySelectorAll('.menu-item, #sidebarMenu a');
    menuItems.forEach(item => {
        const href = item.getAttribute('href');
        if (href && href !== 'home.html' && !item.classList.contains('theme-toggle')) {
            if (lock) {
                item.classList.add('locked');
                item.onclick = function(e) {
                    if (isJoined) {
                        e.preventDefault();
                        alert("⚠️ Focus Session chalu hai! Pehle 'End Session & Save' dabayein taaki timer reset na ho.");
                        return false;
                    }
                };
            } else {
                item.classList.remove('locked');
                item.onclick = null;
            }
        }
    });

    const profileLink = document.getElementById('profileLink');
    if (profileLink) {
        if (lock) {
            profileLink.classList.add('locked');
            profileLink.onclick = (e) => {
                if (isJoined) {
                    e.preventDefault();
                    alert("⚠️ Focus Session chalu hai! Pehle 'End Session & Save' karein.");
                    return false;
                }
            };
        } else {
            profileLink.classList.remove('locked');
            profileLink.onclick = null;
        }
    }
}

window.addEventListener("DOMContentLoaded", async function() {
    const joinBtn = document.getElementById('joinBtn');
    const stopBtn = document.getElementById('stopBtn');
    const joinOverlay = document.getElementById('joinOverlay');
    const stopwatch = document.getElementById('stopwatch');
    const savedTimeEl = document.getElementById('savedTimeDisplay');
    const topBarUserName = document.getElementById('topBarUserName');
    const sidebarUserName = document.getElementById('sidebarUserName');

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
                    myDisplayName = resolveDisplayName(user, null);
                }
            } else {
                currentUser = null;
                totalSavedSeconds = parseInt(localStorage.getItem('focusora_saved_time') || '0', 10);
                myDisplayName = localStorage.getItem('focusora_username') || "Focus Member";
            }

            if (savedTimeEl) savedTimeEl.textContent = "Today's Total: " + formatTime(totalSavedSeconds);
            if (topBarUserName) topBarUserName.textContent = myDisplayName;
            if (sidebarUserName) sidebarUserName.textContent = myDisplayName;
        });
    }

    initPublicSphereListener();

    // ==========================================
    // START FOCUS BUTTON
    // ==========================================
    if (joinBtn) {
        joinBtn.onclick = function() {
            if (isJoined) return;

            isJoined = true;
            seconds = 0;

            if (joinOverlay) joinOverlay.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'flex';
            if (stopwatch) stopwatch.textContent = "00:00:00";

            const statusBadge = document.getElementById("focusStatusBadge");
            if (statusBadge) {
                statusBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
                statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Focusing 🔥';
            }
            const liveBadge = document.getElementById("liveBadge");
            if (liveBadge) {
                liveBadge.className = "text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold";
                liveBadge.textContent = "LIVE";
            }

            toggleMenuLock(true);

            const subject = document.getElementById("activeSubjectSelect")?.value || "Mathematics";
            const myId = currentUser ? currentUser.uid : `guest_${Date.now()}`;
            myActiveDocId = myId;

            // Instant Local Injection
            peerDesks = peerDesks.filter(p => p.id !== myId && p.userId !== myId);
            peerDesks.unshift({
                id: myId,
                userId: myId,
                name: myDisplayName,
                subject: subject,
                seconds: 0,
                isFocusing: true
            });
            renderDeskGrid();

            registerUserInSphere(myId, myDisplayName, subject);

            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                seconds++;
                if (stopwatch) stopwatch.textContent = formatTime(seconds);

                const myTimeEl = document.getElementById(`time-val-${myId}`);
                if (myTimeEl) myTimeEl.textContent = formatTime(seconds);

                peerDesks.forEach(peer => {
                    if (peer.isFocusing && peer.id !== myId) {
                        peer.seconds = (peer.seconds || 0) + 1;
                        const pEl = document.getElementById(`time-val-${peer.id}`);
                        if (pEl) pEl.textContent = formatTime(peer.seconds);
                    }
                });
            }, 1000);
        };
    }

    // ==========================================
    // STOP FOCUS BUTTON (INSTANT RESPONSE FIX)
    // ==========================================
    if (stopBtn) {
        stopBtn.onclick = async function() {
            if (!isJoined) return;

            // 1. Instantly Stop Timer & Unlock Menu
            clearInterval(timerInterval);
            timerInterval = null;
            isJoined = false;

            const sessionDuration = seconds;
            seconds = 0;
            totalSavedSeconds += sessionDuration;

            // 2. Instant UI Reset (Bina network delay ke UI turant change hoga)
            if (stopwatch) stopwatch.textContent = "00:00:00";
            if (joinOverlay) joinOverlay.style.display = 'flex';
            if (stopBtn) stopBtn.style.display = 'none';
            if (savedTimeEl) savedTimeEl.textContent = "Today's Total: " + formatTime(totalSavedSeconds);

            const statusBadge = document.getElementById("focusStatusBadge");
            if (statusBadge) {
                statusBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700";
                statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-500"></span> Idle';
            }
            const liveBadge = document.getElementById("liveBadge");
            if (liveBadge) {
                liveBadge.className = "text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-semibold";
                liveBadge.textContent = "OFFLINE";
            }

            toggleMenuLock(false);

            // 3. Remove from Local Desk Grid Immediately (Bug Fix: docId backup pehle liya)
            const docToRemove = myActiveDocId;
            if (docToRemove) {
                peerDesks = peerDesks.filter(p => p.id !== docToRemove && p.userId !== docToRemove);
                renderDeskGrid();
            }

            // 4. Background Sync (UI ko freeze hone nahi dega)
            try {
                if (currentUser && typeof firebase !== 'undefined' && firebase.firestore) {
                    firebase.firestore().collection('users').doc(currentUser.uid).set({
                        savedTime: totalSavedSeconds,
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true }).catch(err => console.warn("Firestore time sync error:", err));
                } else {
                    localStorage.setItem('focusora_saved_time', totalSavedSeconds);
                }

                if (docToRemove && typeof firebase !== 'undefined' && firebase.firestore) {
                    firebase.firestore().collection('public_study_sphere').doc(docToRemove).delete()
                        .catch(err => console.warn("Sphere doc delete error:", err));
                }
            } catch (e) {
                console.error("Stop button sync error:", e);
            } finally {
                myActiveDocId = null;
            }
        };
    }
});

// ==========================================
// Firestore Sync & Peer Management
// ==========================================
function initPublicSphereListener() {
    if (typeof firebase === 'undefined' || !firebase.firestore) {
        loadMockPeers();
        return;
    }

    const sphereRef = firebase.firestore().collection('public_study_sphere');
    
    roomUnsubscribe = sphereRef.onSnapshot((snapshot) => {
        const liveList = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            liveList.push({ id: doc.id, ...data });
        });

        if (isJoined && myActiveDocId) {
            const exists = liveList.some(p => p.id === myActiveDocId);
            if (!exists) {
                liveList.unshift({
                    id: myActiveDocId,
                    userId: myActiveDocId,
                    name: myDisplayName,
                    subject: document.getElementById("activeSubjectSelect")?.value || "Mathematics",
                    seconds: seconds,
                    isFocusing: true
                });
            }
        }

        if (liveList.length === 0) {
            loadMockPeers();
        } else {
            peerDesks = liveList;
            renderDeskGrid();
        }
    }, () => {
        loadMockPeers();
    });
}

function loadMockPeers() {
    if (peerDesks.length > 0 && isJoined) return;
    peerDesks = [
        { id: 'mock_1', name: "StudyMate", subject: "DSA in C++", seconds: 14211, isFocusing: true },
        { id: 'mock_2', name: "Coco", subject: "Organic Chem", seconds: 8930, isFocusing: true },
        { id: 'mock_3', name: "Billy", subject: "Physics (Optics)", seconds: 5410, isFocusing: true },
        { id: 'mock_4', name: "Carl", subject: "Linear Algebra", seconds: 3450, isFocusing: true }
    ];
    renderDeskGrid();
}

async function registerUserInSphere(docId, name, subject) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    try {
        await firebase.firestore().collection('public_study_sphere').doc(docId).set({
            name: name || "Focus Member",
            subject: subject || "Mathematics",
            isFocusing: true,
            seconds: 0,
            userId: currentUser ? currentUser.uid : docId,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error("Error writing to public_study_sphere:", err);
    }
}

// ==========================================
// Smooth Zero-Flicker Grid Renderer
// ==========================================
function renderDeskGrid() {
    const container = document.getElementById("deskGrid");
    if (!container) return;

    const filtered = peerDesks.filter(p => {
        if (currentFilter === 'focusing') return p.isFocusing;
        return true;
    });

    container.innerHTML = "";

    filtered.forEach(peer => {
        const isMe = (myActiveDocId && peer.id === myActiveDocId) || (currentUser && peer.userId === currentUser.uid);
        const card = document.createElement("div");
        card.id = `desk-card-${peer.id}`;
        card.className = `p-3.5 rounded-xl border flex flex-col items-center justify-between text-center transition cursor-pointer relative ${
            isMe 
                ? 'border-violet-500 bg-[#1e1a33] shadow-[0_0_15px_rgba(139,92,246,0.25)]' 
                : 'bg-[#181928] border-slate-800 hover:border-violet-500/40'
        }`;
        card.onclick = () => openBuddyModal(peer);

        card.innerHTML = `
            <div class="relative mb-2">
                <div class="w-14 h-14 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-center text-2xl" 
                     style="${peer.isFocusing ? 'box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);' : ''}">
                    💻
                </div>
                <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#12131f] ${peer.isFocusing ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-amber-400'}"></span>
            </div>

            <div class="w-full">
                <h5 class="text-xs font-semibold text-white truncate">${peer.name || 'Member'} ${isMe ? '(You)' : ''}</h5>
                <p class="text-[10px] text-slate-400 truncate mb-1">${peer.subject || 'Study'}</p>
                <div id="time-val-${peer.id}" class="font-mono text-[11px] font-bold ${peer.isFocusing ? 'text-emerald-400' : 'text-slate-400'} bg-black/40 py-0.5 rounded border border-slate-800">
                    ${formatTime(peer.seconds || 0)}
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    const userCountEl = document.getElementById("liveUserCount");
    if (userCountEl) userCountEl.innerText = filtered.length;
}

function filterDeskGrid(type) {
    currentFilter = type;
    renderDeskGrid();
}

function openBuddyModal(peer) {
    document.getElementById("buddyNameModal").innerText = peer.name || 'Member';
    document.getElementById("buddySubjectModal").innerText = peer.subject || 'Study';
    document.getElementById("buddyTimeModal").innerText = formatTime(peer.seconds || 0);
    document.getElementById("buddyStatusModal").innerText = peer.isFocusing ? "Focusing 🔥" : "Resting ☕";
    document.getElementById("buddyModal").classList.remove("hidden");
}

function closeBuddyModal() {
    document.getElementById("buddyModal").classList.add("hidden");
}

function cheerCurrentBuddy(e) {
    for (let i = 0; i < 5; i++) {
        const p = document.createElement("div");
        p.className = "reaction-particle";
        p.innerText = "🔥";
        p.style.left = (e.clientX - 20 + (Math.random() * 40)) + "px";
        p.style.top = (e.clientY - 20 + (Math.random() * 40)) + "px";
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1000);
    }
    setTimeout(() => {
        closeBuddyModal();
    }, 400);
}

window.addEventListener("beforeunload", () => {
    if (myActiveDocId && typeof firebase !== 'undefined' && firebase.firestore) {
        firebase.firestore().collection('public_study_sphere').doc(myActiveDocId).delete();
    }
});