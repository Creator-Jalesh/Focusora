window.addEventListener("DOMContentLoaded", function() {
    const loginState = document.getElementById('loginState');
    const loggedInState = document.getElementById('loggedInState');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const profileFocusTime = document.getElementById('profileFocusTime');

    const tcModal = document.getElementById('tcModal');
    const privacyModal = document.getElementById('privacyModal');
    const openTcBtn = document.getElementById('openTcBtn');
    const openPrivacyBtn = document.getElementById('openPrivacyBtn');
    const closeTcBtn = document.getElementById('closeTcBtn');
    const closePrivacyBtn = document.getElementById('closePrivacyBtn');

    function formatTime(totalSeconds) {
        const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        return hrs + ":" + mins + ":" + secs;
    }

    function checkLoginStatus() {
        const user = JSON.parse(localStorage.getItem('focusora_user'));
        const savedTime = parseInt(localStorage.getItem('focusora_saved_time')) || 0;

        if (user) {
            if(loginState) loginState.style.display = 'none';
            if(loggedInState) loggedInState.style.display = 'block';
            if(userNameDisplay) userNameDisplay.textContent = user.name;
            if(userEmailDisplay) userEmailDisplay.textContent = user.email;
            if(profileFocusTime) profileFocusTime.textContent = formatTime(savedTime);
        } else {
            if(loginState) loginState.style.display = 'block';
            if(loggedInState) loggedInState.style.display = 'none';
        }
    }

    if(googleLoginBtn) {
        googleLoginBtn.onclick = function() {
            const dummyUser = {
                name: "Focusora Developer", 
                email: "developer@gmail.com",
                isLoggedIn: true
            };
            
            googleLoginBtn.innerText = "Authenticating...";
            setTimeout(function() {
                localStorage.setItem('focusora_user', JSON.stringify(dummyUser));
                checkLoginStatus();
            }, 1000);
        };
    }

    if(logoutBtn) {
        logoutBtn.onclick = function() {
            localStorage.removeItem('focusora_user');
            checkLoginStatus();
        };
    }

    if(openTcBtn) {
        openTcBtn.onclick = function() {
            if(tcModal) tcModal.style.display = "flex";
        };
    }

    if(openPrivacyBtn) {
        openPrivacyBtn.onclick = function() {
            if(privacyModal) privacyModal.style.display = "flex";
        };
    }

    if(closeTcBtn) {
        closeTcBtn.onclick = function() {
            if(tcModal) tcModal.style.display = "none";
        };
    }

    if(closePrivacyBtn) {
        closePrivacyBtn.onclick = function() {
            if(privacyModal) privacyModal.style.display = "none";
        };
    }

    checkLoginStatus();
});