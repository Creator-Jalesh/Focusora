window.addEventListener("DOMContentLoaded", function() {
    const goalsList = document.getElementById('goalsList');
    const newGoalInput = document.getElementById('newGoalInput');
    const addGoalBtn = document.getElementById('addGoalBtn');
    const progressText = document.getElementById('progressText');
    const progressBarFill = document.getElementById('progressBarFill');
    const currentDateDisplay = document.getElementById('currentDateDisplay');

    const totalGoalsNum = document.getElementById('totalGoalsNum');
    const completedGoalsNum = document.getElementById('completedGoalsNum');
    const pendingGoalsNum = document.getElementById('pendingGoalsNum');
    const efficiencyNum = document.getElementById('efficiencyNum');

    const today = new Date();
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    if(currentDateDisplay) {
        currentDateDisplay.textContent = "Date: " + today.toLocaleDateString('en-US', options);
    }

    let goals = JSON.parse(localStorage.getItem('focusora_goals')) || [
        { id: 1, text: "Revise Physics Formulas", completed: false },
        { id: 2, text: "Complete 2 Hours Focus Session", completed: true },
        { id: 3, text: "Solve 20 Chemistry MCQs", completed: false }
    ];

    function saveAndRender() {
        localStorage.setItem('focusora_goals', JSON.stringify(goals));
        renderGoals();
    }

    function renderGoals() {
        if(!goalsList) return;
        goalsList.innerHTML = '';

        let total = goals.length;
        let completed = goals.filter(function(g) { return g.completed; }).length;
        let pending = total - completed;
        let percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        if(progressText) progressText.textContent = completed + "/" + total + " Completed";
        if(progressBarFill) progressBarFill.style.width = percentage + "%";

        if(totalGoalsNum) totalGoalsNum.textContent = total;
        if(completedGoalsNum) completedGoalsNum.textContent = completed;
        if(pendingGoalsNum) pendingGoalsNum.textContent = pending;
        if(efficiencyNum) efficiencyNum.textContent = percentage + "%";

        if(total === 0) {
            goalsList.innerHTML = '<p style="text-align:center; color:#94a3b8; padding: 20px;">No goals added yet. Add one below! 🚀</p>';
            return;
        }

        goals.forEach(function(goal) {
            const item = document.createElement('div');
            item.className = 'goal-item' + (goal.completed ? ' completed' : '');
            
            const leftDiv = document.createElement('div');
            leftDiv.className = 'goal-left';
            leftDiv.onclick = function() { toggleGoal(goal.id); };

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = goal.completed;
            checkbox.onclick = function(e) {
                e.stopPropagation();
                toggleGoal(goal.id);
            };

            const span = document.createElement('span');
            span.className = 'goal-text';
            span.textContent = goal.text;

            leftDiv.appendChild(checkbox);
            leftDiv.appendChild(span);

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-goal-btn';
            delBtn.textContent = '🗑️';
            delBtn.onclick = function() { deleteGoal(goal.id); };

            item.appendChild(leftDiv);
            item.appendChild(delBtn);
            goalsList.appendChild(item);
        });
    }

    function addNewGoal() {
        const text = newGoalInput ? newGoalInput.value.trim() : "";
        if(!text) {
            alert("Please enter a goal description!");
            return;
        }

        const newGoal = {
            id: Date.now(),
            text: text,
            completed: false
        };

        goals.push(newGoal);
        if(newGoalInput) newGoalInput.value = '';
        saveAndRender();
    }
    if(addGoalBtn) {
        addGoalBtn.onclick = addNewGoal;
    }

    if(newGoalInput) {
        newGoalInput.onkeypress = function(e) {
            if(e.key === 'Enter') {
                addNewGoal();
            }
        };
    }

    window.toggleGoal = function(id) {
        goals = goals.map(function(g) {
            if(g.id === id) {
                return { id: g.id, text: g.text, completed: !g.completed };
            }
            return g;
        });
        saveAndRender();
    };

    window.deleteGoal = function(id) {
        goals = goals.filter(function(g) { return g.id !== id; });
        saveAndRender();
    };

    renderGoals();
});