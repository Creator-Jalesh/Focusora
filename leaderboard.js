document.addEventListener("DOMContentLoaded", function() {

    // 1. REAL FIREBASE LEADERBOARD LOGIC
    function loadRealLeaderboard(elementId) {
        const tbody = document.getElementById(elementId);
        if (!tbody) return;

        // Firebase Firestore check
        if (typeof db !== "undefined" && db) {
            db.collection('users')
              .orderBy('totalSavedSeconds', 'desc')
              .limit(10)
              .get()
              .then((snapshot) => {
                  tbody.innerHTML = "";
                  
                  if (snapshot.empty) {
                      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No study data yet!</td></tr>';
                      return;
                  }

                  let rank = 1;
                  snapshot.forEach((doc) => {
                      const user = doc.data();
                      const name = user.name || "Anonymous User";
                      const totalSecs = user.totalSavedSeconds || 0;
                      const hrs = (totalSecs / 3600).toFixed(1);

                      let row = document.createElement('tr');
                      row.innerHTML = '<td><b>#' + rank + '</b></td>' +
                                      '<td>' + name + '</td>' +
                                      '<td><span style="color: #0052D4; font-weight: 600;">' + hrs + ' hrs</span></td>';
                      tbody.appendChild(row);
                      rank++;
                  });
              })
              .catch((err) => {
                  console.error("Leaderboard fetch error:", err);
              });
        }
    }

    // Load Daily & Weekly Leaderboard from Firebase
    loadRealLeaderboard('dailyLeaderboardBody');
    loadRealLeaderboard('weeklyLeaderboardBody');

    // 2. CALENDAR RENDERING LOGIC
    const calendarGrid = document.getElementById('calendarGrid');
    if (calendarGrid) {
        calendarGrid.innerHTML = "";
        let todayDate = new Date().getDate(); 
        let myTotalSeconds = parseInt(localStorage.getItem('focusora_saved_time')) || 0;

        function formatHours(totalSec) {
            if(totalSec === 0) return "0h";
            let hrs = (totalSec / 3600).toFixed(1);
            return hrs + "h";
        }

        for(let day = 1; day <= 31; day++) {
            const dayBox = document.createElement('div');
            dayBox.className = 'cal-day';

            let displayTime = "0h";

            if(day === todayDate) {
                dayBox.classList.add('today');
                displayTime = formatHours(myTotalSeconds);
            } else if(day < todayDate) {
                displayTime = "0h";
            }

            dayBox.innerHTML = '<span class="date-num">' + day + '</span><span class="date-time">' + displayTime + '</span>';
            calendarGrid.appendChild(dayBox);
        }
    }
});