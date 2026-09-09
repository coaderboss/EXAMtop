// src/lib/firebaseAdmin.js
import admin from "firebase-admin";

// 🔥 Vercel Module Wrapper Bypass
const firebaseAdmin = admin.default || admin;

// 🛡️ THE ULTIMATE FIX: Notice the question mark (?.) before length.
// Ye system ko batata hai ki "Agar apps undefined hai, toh CRASH mat karo, seedha aage badho!"
if (!firebaseAdmin.apps?.length) {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").replace(/"/g, "")
    : undefined;

  const dbUrl =
    process.env.FIREBASE_DATABASE_URL ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  const adminConfig = {
    databaseURL: dbUrl,
  };

  if (projectId && clientEmail && privateKey) {
    // Optional chaining (?.) yaha bhi lagaya hai safety ke liye
    adminConfig.credential = firebaseAdmin.credential?.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  firebaseAdmin.initializeApp(adminConfig);
}

export const adminDb = firebaseAdmin.database();
export const adminAuth = firebaseAdmin.auth();