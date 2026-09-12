// src/lib/authGuard.js
import { adminDb, adminAuth } from "./firebaseAdmin";

/**
 * Validates the caller's identity via Firebase Admin verifyIdToken.
 *
 * @param {Request} req - The incoming Next.js Request
 * @returns {Promise<{ authorized: boolean, status?: number, message?: string, callerUid?: string, email?: string }>}
 */
export async function verifyCaller(req) {
  if (!adminAuth) {
    return {
      authorized: false,
      status: 500,
      message: "Server authentication service unavailable.",
    };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized: Missing or invalid authorization token.",
    };
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized: Token empty.",
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      authorized: true,
      callerUid: decodedToken.uid,
      email: decodedToken.email || null,
    };
  } catch (err) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized: Invalid or expired token.",
    };
  }
}

/**
 * Validates that the request has a valid Bearer token and that the caller
 * is either an Admin or the creator/owner of the specified test.
 *
 * @param {Request} req - The incoming Next.js Request
 * @param {string} testId - The test ID (UUID or numeric ID)
 * @param {string} [legacyKey] - Optional legacy RTDB push key
 * @returns {Promise<{ authorized: boolean, status?: number, message?: string, callerUid?: string, isAdmin?: boolean }>}
 */
export async function verifyTestOwnerOrAdmin(req, testId, legacyKey) {
  if (!adminAuth || !adminDb) {
    return {
      authorized: false,
      status: 500,
      message: "Server authentication service unavailable.",
    };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized: Missing or invalid authorization token.",
    };
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized: Token empty.",
    };
  }

  let callerUid;
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    callerUid = decodedToken.uid;
  } catch (err) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized: Invalid or expired token.",
    };
  }

  // 1. Check if caller is an Admin
  let isAdmin = false;
  try {
    const userSnap = await adminDb.ref(`users/${callerUid}`).once("value");
    if (userSnap.exists() && userSnap.val()?.role === "admin") {
      isAdmin = true;
    }
  } catch (e) {
    console.warn("User role lookup warning in authGuard:", e);
  }

  if (isAdmin) {
    return { authorized: true, callerUid, isAdmin: true };
  }

  // 2. Check if caller is the creator/owner of the test
  let isOwner = false;
  const targetTestId = testId || legacyKey;

  // A. Check in tests_metadata
  if (targetTestId) {
    try {
      const metaSnap = await adminDb
        .ref(`tests_metadata/${targetTestId}`)
        .once("value");
      if (metaSnap.exists()) {
        const meta = metaSnap.val();
        if (meta && (meta.creatorUid === callerUid || meta.uid === callerUid)) {
          isOwner = true;
        }
      }
    } catch (e) {
      console.warn("tests_metadata owner lookup warning in authGuard:", e);
    }
  }

  // B. Check in legacy tests node
  if (!isOwner) {
    const targetLegacy = legacyKey || testId;
    if (targetLegacy) {
      try {
        const legSnap = await adminDb
          .ref(`tests/${targetLegacy}`)
          .once("value");
        if (legSnap.exists()) {
          const leg = legSnap.val();
          if (leg && (leg.creatorUid === callerUid || leg.uid === callerUid)) {
            isOwner = true;
          }
        }
      } catch (e) {
        console.warn("legacy tests owner lookup warning in authGuard:", e);
      }
    }
  }

  // C. Query fallback in legacy tests node by id equal to string or number
  if (!isOwner && targetTestId) {
    try {
      let snapById = await adminDb
        .ref("tests")
        .orderByChild("id")
        .equalTo(String(targetTestId))
        .once("value");
      if (!snapById.exists() && !isNaN(Number(targetTestId))) {
        snapById = await adminDb
          .ref("tests")
          .orderByChild("id")
          .equalTo(Number(targetTestId))
          .once("value");
      }
      if (snapById.exists()) {
        const val = snapById.val();
        const leg = Object.values(val)[0];
        if (leg && (leg.creatorUid === callerUid || leg.uid === callerUid)) {
          isOwner = true;
        }
      }
    } catch (e) {
      console.warn("tests fallback query lookup warning in authGuard:", e);
    }
  }

  if (!isOwner) {
    return {
      authorized: false,
      status: 403,
      message: "Forbidden: You do not have permission to modify this test.",
    };
  }

  return { authorized: true, callerUid, isAdmin: false };
}
