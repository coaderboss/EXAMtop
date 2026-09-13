// src/app/api/tests/create/route.js
import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebaseAdmin"; // Ensure correct path

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    // 1. Verify User Token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized access blocked" },
        { status: 401 },
      );
    }

    const idToken = authHeader.split("Bearer ")[1];

    // THE FIX: Catch uninitialized Admin SDK before it crashes
    if (!adminAuth) {
      console.error(
        "Firebase Admin Auth is uninitialized. Check Vercel environment variables.",
      );
      return NextResponse.json(
        { error: "Server authentication service unavailable" },
        { status: 500 },
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (authError) {
      console.error("Token verification failed:", authError.message);
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const uid = decodedToken.uid;
    const body = await req.json();
    const { testId, testMetadata, testQuestions } = body;

    if (!testId || !testMetadata || !testQuestions) {
      return NextResponse.json(
        { error: "Missing required test creation parameters." },
        { status: 400 },
      );
    }

    // 🛡️ SEC-02 FIX: Prevent Exam Overwriting / Hijacking
    const existingMetaSnap = await adminDb
      .ref(`tests_metadata/${testId}`)
      .once("value");
    if (existingMetaSnap.exists()) {
      return NextResponse.json(
        { error: "Conflict: Test ID already exists. Overwriting blocked." },
        { status: 409 },
      );
    }

    const existingLegacySnap = await adminDb
      .ref(`tests/${testId}`)
      .once("value");
    if (existingLegacySnap.exists()) {
      return NextResponse.json(
        { error: "Conflict: Test ID already exists in legacy records." },
        { status: 409 },
      );
    }

    // 🛡️ LOGIC-01 & SEC-02 FIX: Ensure 8-character alphanumeric test code without hyphens
    const generateCleanCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    if (
      !testMetadata.code ||
      testMetadata.code.length !== 8 ||
      testMetadata.code.includes("-")
    ) {
      testMetadata.code = generateCleanCode();
    }

    // 2. Fetch User Quota Details
    const userRef = adminDb.ref(`users/${uid}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val() || {};

    const isUnlimited = userData.is_unlimited || userData.plan === "unlimited";
    const hasNewBuckets = userData.free_tokens !== undefined;
    let legacyQuota =
      userData.available_quota !== undefined ? userData.available_quota : 3;

    let premiumTokens = hasNewBuckets
      ? userData.premium_tokens || 0
      : Math.max(0, legacyQuota - 3);
    let freeTokens = hasNewBuckets
      ? userData.free_tokens
      : Math.min(3, legacyQuota);

    let testTokenType = "free";
    let updates = {};

    // 3. SECURE TOKEN DEDUCTION LOGIC
    if (isUnlimited) {
      testTokenType = "unlimited";
    } else if (premiumTokens > 0) {
      testTokenType = "premium";
      updates["premium_tokens"] = premiumTokens - 1;
      updates["available_quota"] = Math.max(0, legacyQuota - 1);
    } else if (freeTokens > 0) {
      testTokenType = "free";
      updates["free_tokens"] = freeTokens - 1;
      updates["available_quota"] = Math.max(0, legacyQuota - 1);
    } else {
      return NextResponse.json(
        { error: "Limit Exceeded. Zero tokens available." },
        { status: 402 },
      );
    }

    // Attach true token type to metadata (Server overriding client payload just in case)
    testMetadata.tokenType = testTokenType;
    testMetadata.creatorUid = uid;

    // 4. ATOMIC DATABASE WRITE (Deduct Token + Save Test Together)
    const dbUpdates = {};

    // User token updates
    if (Object.keys(updates).length > 0) {
      for (const [key, val] of Object.entries(updates)) {
        dbUpdates[`users/${uid}/${key}`] = val;
      }
    }

    // Exam Data
    dbUpdates[`tests_metadata/${testId}`] = testMetadata;
    dbUpdates[`test_questions/${testId}`] = { questions: testQuestions };

    await adminDb.ref().update(dbUpdates);

    return NextResponse.json({
      success: true,
      message: "Exam Published Successfully.",
    });
  } catch (error) {
    console.error("Test Publishing Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
