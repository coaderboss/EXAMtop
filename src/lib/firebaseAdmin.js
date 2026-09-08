// src/lib/firebaseAdmin.js
import admin from "firebase-admin";

// THE VERCEL TURBOPACK FIX: Automatically unwrap the module if Next.js nested it
const coreAdmin = admin.credential ? admin : admin.default;

if (!coreAdmin.apps || coreAdmin.apps.length === 0) {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  // Clean up private key formatting perfectly
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
    adminConfig.credential = coreAdmin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  coreAdmin.initializeApp(adminConfig);
}

export const adminDb = coreAdmin.database();
export const adminAuth = coreAdmin.auth();