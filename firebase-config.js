// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyAxzAAVydAkUHSZ7KFF9lP9uGOhBp0gpvg",
    authDomain: "focusora-59edc.firebaseapp.com",
    projectId: "focusora-59edc",
    storageBucket: "focusora-59edc.firebasestorage.app",
    messagingSenderId: "899238078858",
    appId: "1:899238078858:web:2efea9a0108b885f84c073",
    measurementId: "G-WVEKCTTM7K"
};

// Initialize Firebase (Compat mode - easiest for vanilla JS)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();