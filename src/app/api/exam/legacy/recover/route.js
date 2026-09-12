import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

async function handleRecovery(testId, legacyKey, req) {
  if (!testId && !legacyKey) {
    return {
      success: false,
      message: "Missing testId or legacyKey.",
      status: 400,
    };
  }

  // 🛡️ P0.2 SECURITY FIX: Authenticate the Caller
  let callerUid = null;
  let callerEmail = null;
  let isAdmin = false;
  const authHeader = req.headers.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split("Bearer ")[1]?.trim();
      if (token) {
        const decodedToken = await adminAuth.verifyIdToken(token);
        callerUid = decodedToken.uid;
        callerEmail = decodedToken.email || null;
        const userSnap = await adminDb.ref(`users/${callerUid}`).once("value");
        if (userSnap.exists() && userSnap.val().role === "admin") {
          isAdmin = true;
        }
      }
    } catch (e) {
      console.warn("Invalid token in recovery API:", e);
    }
  }

  if (!callerUid) {
    return {
      success: false,
      message: "Unauthorized: Valid authentication token required.",
      submissions: [],
      questions: [],
      status: 401,
    };
  }

  let testData = null;
  let resolvedKey = legacyKey || testId;

  // 1. Direct path lookup using legacyKey
  if (legacyKey) {
    const snap = await adminDb.ref(`tests/${legacyKey}`).once("value");
    if (snap.exists()) {
      testData = snap.val();
      resolvedKey = legacyKey;
    }
  }

  // 2. Direct path lookup using testId
  if (!testData && testId) {
    const snap = await adminDb.ref(`tests/${testId}`).once("value");
    if (snap.exists()) {
      testData = snap.val();
      resolvedKey = testId;
    }
  }

  // 3. Query lookup fallback (by id string or number)
  if (!testData && testId) {
    let snapById = await adminDb
      .ref("tests")
      .orderByChild("id")
      .equalTo(String(testId))
      .once("value");
    if (!snapById.exists() && !isNaN(Number(testId))) {
      snapById = await adminDb
        .ref("tests")
        .orderByChild("id")
        .equalTo(Number(testId))
        .once("value");
    }
    if (snapById.exists()) {
      const val = snapById.val();
      resolvedKey = Object.keys(val)[0];
      testData = val[resolvedKey];
    }
  }

  // 4. Fallback by code if still not found
  if (!testData && testId) {
    const snapByCode = await adminDb
      .ref("tests")
      .orderByChild("code")
      .equalTo(String(testId))
      .once("value");
    if (snapByCode.exists()) {
      const val = snapByCode.val();
      resolvedKey = Object.keys(val)[0];
      testData = val[resolvedKey];
    }
  }

  if (!testData) {
    return {
      success: true,
      message: "No legacy test found.",
      submissions: [],
      questions: [],
      status: 200,
    };
  }

  // 🔥 EXAMINER / OWNER CHECK
  const isOwner =
    testData.creatorUid === callerUid || testData.uid === callerUid;
  const hasFullAccess = isAdmin || isOwner;

  // 5. Safely extract and format submissions
  let parsedSubs = [];
  let rawSubs = testData.submissions || null;
  if (!rawSubs) {
    const subSnap = await adminDb
      .ref(`tests/${resolvedKey}/submissions`)
      .once("value");
    if (subSnap.exists()) rawSubs = subSnap.val();
  }

  if (rawSubs) {
    let allSubs = [];
    if (Array.isArray(rawSubs)) {
      allSubs = rawSubs
        .map((sub, idx) =>
          sub
            ? { ...sub, fbKey: sub.fbKey || sub.studentKey || idx.toString() }
            : null,
        )
        .filter(Boolean);
    } else if (typeof rawSubs === "object") {
      allSubs = Object.entries(rawSubs)
        .map(([k, v]) => (v ? { ...v, fbKey: k } : null))
        .filter(Boolean);
    }

    if (hasFullAccess) {
      parsedSubs = allSubs;
    } else if (callerUid) {
      // 🛡️ Student Privacy Guard: Return ONLY the student's own submission(s)
      parsedSubs = allSubs.filter(
        (s) =>
          s &&
          (s.uid === callerUid || (callerEmail && s.email === callerEmail)),
      );
    }
  }

  // 6. Safely extract questions
  let parsedQuestions = [];
  if (testData.questions) {
    const rawQs = Array.isArray(testData.questions)
      ? testData.questions.filter(Boolean)
      : Object.values(testData.questions).filter(Boolean);

    // If examiner OR results are published/instant, provide questions with answers and explanations
    const isResultsPublished =
      testData.publishResults === "instant" ||
      testData.publishResults === "published" ||
      testData.publishMode === "instant" ||
      testData.resultsPublished === true ||
      testData.status === "published";

    parsedQuestions = rawQs.map((q) => {
      if (!hasFullAccess && !isResultsPublished) {
        // Strip sensitive data for students while test is active / results unreleased
        const { correct, correctInt, explanation, ...safeQ } = q;
        return safeQ;
      }
      return q;
    });
  }

  return {
    success: true,
    legacyKey: resolvedKey,
    submissions: parsedSubs,
    questions: parsedQuestions,
    count: parsedSubs.length,
    status: 200,
  };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await handleRecovery(body.testId, body.legacyKey, req);
    return NextResponse.json(result, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server Error recovering data." },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await handleRecovery(
      searchParams.get("testId"),
      searchParams.get("legacyKey"),
      req,
    );
    return NextResponse.json(result, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server Error recovering data." },
      { status: 500 },
    );
  }
}
