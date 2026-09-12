import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";
import { verifyTestOwnerOrAdmin } from "../../../../../lib/authGuard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { testId, recalculatedSubmissionsArray, isLegacy, legacyKey } =
      await req.json();

    if (
      !testId ||
      !Array.isArray(recalculatedSubmissionsArray) ||
      recalculatedSubmissionsArray.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing testId or valid submissions array",
        },
        { status: 400 },
      );
    }

    // 🛡️ AUTH & AUTHORIZATION CHECK (P0.1 Lockdown)
    const authResult = await verifyTestOwnerOrAdmin(req, testId, legacyKey);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, message: authResult.message },
        { status: authResult.status },
      );
    }

    const updates = {};
    const activeLegacyKey = legacyKey || testId;

    let targetIsLegacy = isLegacy;
    if (targetIsLegacy === undefined || targetIsLegacy === null) {
      const metaSnap = await adminDb
        .ref(`tests_metadata/${testId}`)
        .once("value");
      targetIsLegacy = !metaSnap.exists();
    }

    recalculatedSubmissionsArray.forEach((rawSub, idx) => {
      if (!rawSub) return;

      const sub = JSON.parse(JSON.stringify(rawSub));
      const targetKey =
        sub.fbKey || sub.studentKey || sub.uid || idx.toString();

      // 1. Update in Examiner Store
      if (targetIsLegacy) {
        updates[`tests/${activeLegacyKey}/submissions/${targetKey}`] = sub;
      } else {
        updates[`test_submissions/${testId}/submissions/${targetKey}`] = sub;
      }

      // 2. Update in Student Receipt (user_submissions)
      const candidateKeys = [sub.uid, sub.studentKey].filter(Boolean);
      if (candidateKeys.length === 0 && targetKey) {
        candidateKeys.push(targetKey);
      }
      const targetStudentKeys = Array.from(new Set(candidateKeys));

      for (const studentKey of targetStudentKeys) {
        updates[`user_submissions/${studentKey}/${testId}/score`] = Number(
          sub.score ?? 0,
        );
        updates[`user_submissions/${studentKey}/${testId}/correct`] = Number(
          sub.correct ?? 0,
        );
        updates[`user_submissions/${studentKey}/${testId}/wrong`] = Number(
          sub.wrong ?? 0,
        );
        updates[`user_submissions/${studentKey}/${testId}/skipped`] = Number(
          sub.skipped ?? 0,
        );
        if (sub.details) {
          updates[`user_submissions/${studentKey}/${testId}/details`] =
            sub.details;
        }

        if (targetIsLegacy && legacyKey) {
          updates[`user_submissions/${studentKey}/${legacyKey}/score`] = Number(
            sub.score ?? 0,
          );
          updates[`user_submissions/${studentKey}/${legacyKey}/correct`] =
            Number(sub.correct ?? 0);
          updates[`user_submissions/${studentKey}/${legacyKey}/wrong`] = Number(
            sub.wrong ?? 0,
          );
          updates[`user_submissions/${studentKey}/${legacyKey}/skipped`] =
            Number(sub.skipped ?? 0);
          if (sub.details) {
            updates[`user_submissions/${studentKey}/${legacyKey}/details`] =
              sub.details;
          }
        }
      }
    });

    await adminDb.ref().update(updates);

    return NextResponse.json({
      success: true,
      message: `Successfully regraded and synchronized ${recalculatedSubmissionsArray.length} student submission(s)`,
      count: recalculatedSubmissionsArray.length,
    });
  } catch (error) {
    console.error("Regrade All API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
