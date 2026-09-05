// auth.js - Focusora Complete Firebase Auth & Cloud Sync

const googleProvider = new firebase.auth.GoogleAuthProvider();
let isLoggingIn = false;

// 1. Google Sign-In with Double-Click & Cancelled Popup Fix
function loginWithGoogle() {
    if (isLoggingIn) return;
    isLoggingIn = true;

    auth.signInWithPopup(googleProvider)
        .then((result) => {
            isLoggingIn = false;
            const user = result.user;
            console.log("Logged in successfully:", user.displayName);
            syncUserData(user);
        })
        .catch((error) => {
            isLoggingIn = false;
            // Ignore user popup close / cancelled popup errors
            if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
                console.log("Popup closed or cancelled by user.");
                return;
            }
            console.error("Login Error:", error);
            alert("Login Failed: " + error.message);
        });
}

// 2. Sync User Data & Study Hours with Firestore Database
function syncUserData(user) {
    if (!user || typeof db === 'undefined' || !db) return;

    const userRef = db.collection('users').doc(user.uid);
    const localSavedSeconds = parseInt(localStorage.getItem('focusora_saved_time')) || 0;

    userRef.get().then((doc) => {
        let cloudSavedSeconds = 0;
        if (doc.exists && doc.data().totalSavedSeconds !== undefined) {
            cloudSavedSeconds = doc.data().totalSavedSeconds;
        }

        // Local aur Cloud me se jo jyada time ho wo retain hoga
        const maxSeconds = Math.max(localSavedSeconds, cloudSavedSeconds);
        localStorage.setItem('focusora_saved_time', maxSeconds);

        // Firestore Update
        userRef.set({
            uid: user.uid,
            name: user.displayName || "Anonymous User",
            email: user.email || "",
            photoURL: user.photoURL || "",
            totalSavedSeconds: maxSeconds,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(() => {
            console.log("User data successfully synced to Firestore!");
        }).catch(err => {
            console.error("Firestore Sync Error:", err);
        });
    }).catch(err => {
        console.error("Error fetching user document:", err);
    });
}

// 3. User Logout Function
function logoutUser() {
    auth.signOut().then(() => {
        // Logout hone par page reload hoga taaki UI wapas normal ho jaye
        alert("Logged out successfully!");
        window.location.reload();
    }).catch(err => {
        console.error("Logout Error:", err);
    });
}

// 4. Update Sidebar Dynamic Profile UI & Add Sidebar Logout
function updateSidebarProfile(user) {
    const profileLink = document.getElementById('profileLink');
    if (!profileLink) return;

    // Sidebar ke logout button ka unique ID
    let sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');

    if (user) {
        // --- JAB USER LOGGED IN HAI ---
        const firstName = user.displayName ? user.displayName.split(' ')[0] : 'User';
        const photo = user.photoURL || 'https://via.placeholder.com/25';
        
        profileLink.innerHTML = `<img src="${photo}" style="width:25px; height:25px; border-radius:50%; vertical-align:middle; margin-right:8px; object-fit:cover;"> <span style="font-weight:600;">${firstName}</span>`;
        profileLink.href = "profile.html";
        profileLink.onclick = null;

        // Sidebar me Logout Button add karna
        if (!sidebarLogoutBtn) {
            sidebarLogoutBtn = document.createElement('a');
            sidebarLogoutBtn.id = 'sidebarLogoutBtn';
            sidebarLogoutBtn.href = "#";
            sidebarLogoutBtn.className = profileLink.className; 
            sidebarLogoutBtn.innerHTML = `🚪 <span style="color: #ff4d4d; font-weight:600; margin-left: 5px;">Logout</span>`;
            sidebarLogoutBtn.onclick = (e) => {
                e.preventDefault();
                logoutUser(); 
            };
            
            // Profile link ke theek niche laga do
            profileLink.parentNode.insertBefore(sidebarLogoutBtn, profileLink.nextSibling);
        }

    } else {
        // --- JAB USER LOGGED OUT HAI ---
        profileLink.innerHTML = `🔑 Login with Google`;
        profileLink.href = "#";
        profileLink.onclick = (e) => {
            e.preventDefault();
            loginWithGoogle();
        };

        // Agar logout button pehle se hai toh usko hata do
        if (sidebarLogoutBtn) {
            sidebarLogoutBtn.remove();
        }
    }
}

// 5. Global Auth State Change Listener
auth.onAuthStateChanged((user) => {
    if (user) {
        updateSidebarProfile(user);
        syncUserData(user);
    } else {
        updateSidebarProfile(null);
    }
});