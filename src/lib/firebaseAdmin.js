// src/lib/firebaseAdmin.js
import admin from "firebase-admin";

if (!admin.apps?.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  // 🔥 VERCEL FORMATTING FIX: Handles both raw strings and stringified JSON formats
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
     privateKey = privateKey.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
  }

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      });
      console.log("🔥 Firebase Admin Initialized Successfully");
    } catch (error) {
      console.error("Firebase Admin Init Error:", error);
    }
  } else {
    console.warn("Skipping Firebase Admin Init: Missing environment variables.");
  }
}

export const adminDb = admin.apps?.length ? admin.database() : null;
export const adminAuth = admin.apps?.length ? admin.auth() : null;