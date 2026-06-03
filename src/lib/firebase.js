// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCHW5XDpS16BRH2XgsNJ5YbkIPnyl4i7MI", 
  authDomain: "examtop-e3263.firebaseapp.com",
  databaseURL: "https://examtop-e3263-default-rtdb.firebaseio.com",
  projectId: "examtop-e3263",
  storageBucket: "examtop-e3263.firebasestorage.app",
  messagingSenderId: "758815189008",
  appId: "1:758815189008:web:6acc172966158abdd64295",
  measurementId: "G-G3NRG0VXTV"
};

// 🔥 SMART INITIALIZATION: Next.js server-side aur client-side dono jagah chalta hai.
// Ye check karta hai ki agar Firebase pehle se chalu hai, toh dobara start na kare (Memory Leak bachata hai).
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, database, auth, googleProvider };