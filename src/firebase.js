// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDouBSm_s1bnWOQAtlcMjf1fhwR5fCBuKU",
    authDomain: "dental-management-system-3f0d1.firebaseapp.com",
    projectId: "dental-management-system-3f0d1",
    storageBucket: "dental-management-system-3f0d1.firebasestorage.app",
    messagingSenderId: "304116185000",
    appId: "1:304116185000:web:236ca1053f251705394f9d",
    measurementId: "G-M06W9PPDHC"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);