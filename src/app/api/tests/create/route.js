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
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // 🛡️ FIX: Allowed code length is 6 to 8 to avoid overwriting clean frontend 6-character codes
    if (
      !testMetadata.code ||
      testMetadata.code.length < 6 ||
      testMetadata.code.length > 8 ||
      testMetadata.code.includes("-")
    ) {
      testMetadata.code = generateCleanCode();
    }

    // 2. ATOMIC QUOTA TRANSACTION (PREVENTS TOCTOU RACE CONDITIONS)
    const userRef = adminDb.ref(`users/${uid}`);
    let testTokenType = "free";

    const txResult = await userRef.transaction((userData) => {
      if (!userData) {
        userData = { free_tokens: 3, available_quota: 3, premium_tokens: 0 };
      }

      if (userData.is_unlimited || userData.plan === "unlimited") {
        return userData;
      }

      const hasNewBuckets = userData.free_tokens !== undefined;
      const legacyQuota =
        userData.available_quota !== undefined ? userData.available_quota : 3;
      const premiumTokens = hasNewBuckets
        ? userData.premium_tokens || 0
        : Math.max(0, legacyQuota - 3);
      const freeTokens = hasNewBuckets
        ? userData.free_tokens || 0
        : Math.min(3, legacyQuota);

      if (premiumTokens > 0) {
        userData.premium_tokens = premiumTokens - 1;
        userData.available_quota = Math.max(0, legacyQuota - 1);
        userData.last_deducted_type = "premium";
        return userData;
      } else if (freeTokens > 0) {
        userData.free_tokens = freeTokens - 1;
        userData.available_quota = Math.max(0, legacyQuota - 1);
        userData.last_deducted_type = "free";
        return userData;
      } else {
        return; // Abort transaction (Zero tokens available)
      }
    });

    if (!txResult.committed) {
      return NextResponse.json(
        { error: "Limit Exceeded. Zero tokens available." },
        { status: 402 },
      );
    }

    const finalUser = txResult.snapshot.val() || {};
    const isUnlimited =
      finalUser.is_unlimited || finalUser.plan === "unlimited";
    if (isUnlimited) {
      testTokenType = "unlimited";
    } else {
      testTokenType = finalUser.last_deducted_type || "free";
    }

    // Attach true token type to metadata (Server overriding client payload just in case)
    testMetadata.tokenType = testTokenType;
    testMetadata.creatorUid = uid;

    // 3. ATOMIC EXAM PERSISTENCE (WITH ROLLBACK REVERSAL ON DATABASE FAILURE)
    try {
      const dbUpdates = {};
      dbUpdates[`tests_metadata/${testId}`] = testMetadata;
      dbUpdates[`test_questions/${testId}`] = { questions: testQuestions };
      await adminDb.ref().update(dbUpdates);
    } catch (dbErr) {
      // Rollback quota deduction if exam data write fails
      if (!isUnlimited) {
        await userRef.transaction((data) => {
          if (!data) return data;
          data.available_quota = (data.available_quota || 0) + 1;
          if (testTokenType === "premium") {
            data.premium_tokens = (data.premium_tokens || 0) + 1;
          } else {
            data.free_tokens = (data.free_tokens || 0) + 1;
          }
          return data;
        });
      }
      throw dbErr;
    }

    return NextResponse.json({
      success: true,
      message: "Exam Published Successfully.",
    });
  } catch (error) {
    console.error("Test Publishing Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
