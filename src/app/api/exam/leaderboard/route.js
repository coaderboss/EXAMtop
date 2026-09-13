import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    // 🛡️ SCALE-02 & SEC FIX: Authenticate caller to prevent Leaderboard DDoS attacks
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "Unauthorized: Missing Token" }, { status: 401 });
    }
    try {
      const token = authHeader.split("Bearer ")[1].trim();
      await adminAuth.verifyIdToken(token);
    } catch (err) {
      return NextResponse.json({ success: false, message: "Forbidden: Invalid Token" }, { status: 403 });
    }

    const body = await req.json();
    const { testId, studentScore, score } = body;
    const targetScore = Number(
      studentScore !== undefined ? studentScore : score,
    );

    if (!testId || isNaN(targetScore)) {
      return NextResponse.json(
        { success: false, message: "Missing testId or valid score" },
        { status: 400 },
      );
    }

    let subsData = null;

    // 1. Try Split Architecture: test_submissions/${testId}/submissions
    const submissionsSnap = await adminDb
      .ref(`test_submissions/${testId}/submissions`)
      .once("value");
    if (submissionsSnap.exists()) {
      subsData = submissionsSnap.val();
    } else {
      // 2. Try root test_submissions/${testId}
      const directSnap = await adminDb
        .ref(`test_submissions/${testId}`)
        .once("value");
      if (directSnap.exists() && directSnap.val().submissions) {
        subsData = directSnap.val().submissions;
      }
    }

    // 3. Fallback to legacy tests/${testId}/submissions if new is missing
    if (!subsData) {
      const legacySnap = await adminDb
        .ref(`tests/${testId}/submissions`)
        .once("value");
      if (legacySnap.exists()) {
        subsData = legacySnap.val();
      } else {
        const oldSnapById = await adminDb
          .ref("tests")
          .orderByChild("id")
          .equalTo(testId)
          .once("value");
        if (oldSnapById.exists()) {
          const legacyKey = Object.keys(oldSnapById.val())[0];
          subsData = oldSnapById.val()[legacyKey]?.submissions;
        }
      }
    }

    const rawSubs = Array.isArray(subsData)
      ? subsData.filter(Boolean)
      : Object.values(subsData || {}).filter(Boolean);

    if (rawSubs.length === 0) {
      // Check metadata for participant count
      const metaSnap = await adminDb
        .ref(`tests_metadata/${testId}/submissionCount`)
        .once("value");
      const subCount = metaSnap.val() || 1;
      return NextResponse.json({
        success: true,
        rank: 1,
        totalParticipants: subCount,
      });
    }

    // Extract valid numeric scores only
    const allScores = rawSubs
      .map((s) => Number(s?.score ?? 0))
      .filter((sc) => !isNaN(sc));

    // Rank is (number of students with higher score) + 1
    const rank = allScores.filter((sc) => sc > targetScore).length + 1;
    const totalParticipants = allScores.length;

    return NextResponse.json({
      success: true,
      rank,
      totalParticipants,
    });
  } catch (error) {
    console.error("Leaderboard API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
