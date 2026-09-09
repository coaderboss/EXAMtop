// src/lib/firebaseAdmin.js
import admin from "firebase-admin";

if (!admin.apps?.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // 🔥 THE FIX: Forcefully convert string '\n' to actual line breaks
  let privateKey = process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined;

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    });
  } else {
    console.warn("Skipping Firebase Admin Init: Missing environment variables.");
  }
}

export const adminDb = admin.apps?.length ? admin.database() : null;
export const adminAuth = admin.apps?.length ? admin.auth() : null;