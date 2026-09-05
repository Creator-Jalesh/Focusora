const quotes = [
    "Studying is an investment in your future.",
    "Consistency is what transforms averages into excellence.",
    "Discipline is choosing between what you want now and what you want most.",
    "The harder you work for something, the greater you'll feel when you achieve it.",
    "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.",
    "Stay focused, go after your dreams and keep moving toward your goals.",
    "Energy flows where attention goes.",
    "Action is the foundational key to all success.",
    "Fall seven times, stand up eight.",
    "Deep work is the superpower of the 21st century."
];

// Page load hone par left aur right mein random quotes set karega
function setRandomQuotes() {
    const leftEl = document.querySelector("#leftQuote .quote-text");
    const rightEl = document.querySelector("#rightQuote .quote-text");
    
    // YAHAN SAFETY ADD KI HAI: Agar elements nahi hain page par, toh code aage nahi badhega
    if (!leftEl || !rightEl) return;

    let idx1 = Math.floor(Math.random() * quotes.length);
    let idx2 = Math.floor(Math.random() * quotes.length);

    // Dono alag quotes ho yeh ensure karne ke liye
    while (idx2 === idx1) {
        idx2 = Math.floor(Math.random() * quotes.length);
    }

    leftEl.textContent = quotes[idx1];
    rightEl.textContent = quotes[idx2];
}

// ==========================================
// 🌙 DARK/LIGHT THEME TOGGLE LOGIC
// ==========================================
window.addEventListener("DOMContentLoaded", function() {
    // 1. Quotes load karo (agar page par exist karte hain)
    setRandomQuotes();

    // 2. Theme Toggle logic
    const themeToggleBtns = document.querySelectorAll('.theme-toggle');
    const currentTheme = localStorage.getItem('focusora_theme');

    // Page load hote hi check karo ki purana theme kya tha
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // Button click hone par theme switch karo aur save karo
    themeToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            
            // Check karo ki abhi konsa theme hai aur use localStorage mein daal do
            if (document.body.classList.contains('dark-theme')) {
                localStorage.setItem('focusora_theme', 'dark');
            } else {
                localStorage.setItem('focusora_theme', 'light');
            }
        });
    });
});