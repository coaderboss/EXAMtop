// src/lib/firebaseAdmin.js
// 🔥 THE NUCLEAR FIX: Bypass Vercel's broken compiler using native Node require()
const admin = require("firebase-admin");

if (!admin.apps.length) {
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
    adminConfig.credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  admin.initializeApp(adminConfig);
}

export const adminDb = admin.database();
export const adminAuth = admin.auth();