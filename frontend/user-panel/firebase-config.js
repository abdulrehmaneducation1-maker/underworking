// =========================================================
// LEARNIFY - FIREBASE CONFIGURATION
// NextWave Commerce
// =========================================================

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { getStorage } from
    "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";


const firebaseConfig = {
    apiKey: "AIzaSyCgpGk9aHFdVeGoE2rwiUPPWSkfQmTvuIo",
authDomain: "nextwavecommerce.site",
    projectId: "nextwave-commerce-project",
    storageBucket: "nextwave-commerce-project.firebasestorage.app",
    messagingSenderId: "599878226058",
    appId: "1:599878226058:web:3c906815ed1096db8add73",
    measurementId: "G-8QSDBN13HT"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


// Export services
export {
    app,
    auth,
    db,
    storage
};
