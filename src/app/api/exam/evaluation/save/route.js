import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";
import { verifyTestOwnerOrAdmin } from "../../../../../lib/authGuard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { testId, studentKey, subKey, newSubPayload, isLegacy, legacyKey } =
      await req.json();

    if (!testId || !newSubPayload) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters" },
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

    const cleanSub = JSON.parse(JSON.stringify(newSubPayload));
    cleanSub.evaluated = true;

    const updates = {};
    const targetSubKey = subKey || studentKey || cleanSub.uid;

    let targetIsLegacy = isLegacy;
    if (targetIsLegacy === undefined || targetIsLegacy === null) {
      const metaSnap = await adminDb
        .ref(`tests_metadata/${testId}`)
        .once("value");
      targetIsLegacy = !metaSnap.exists();
    }

    // 1. Update in Examiner Store
    if (targetIsLegacy) {
      const activeLegacyKey = legacyKey || testId;
      updates[`tests/${activeLegacyKey}/submissions/${targetSubKey}`] =
        cleanSub;
    } else {
      updates[`test_submissions/${testId}/submissions/${targetSubKey}`] =
        cleanSub;
    }

    // 2. Update in Student's Personal Ledger (user_submissions)
    const candidateKeys = [
      studentKey,
      cleanSub.uid,
      cleanSub.studentKey,
    ].filter(Boolean);
    if (candidateKeys.length === 0 && targetSubKey) {
      candidateKeys.push(targetSubKey);
    }
    const targetStudentKeys = Array.from(new Set(candidateKeys));

    for (const key of targetStudentKeys) {
      updates[`user_submissions/${key}/${testId}/score`] = Number(
        cleanSub.score ?? 0,
      );
      updates[`user_submissions/${key}/${testId}/correct`] = Number(
        cleanSub.correct ?? 0,
      );
      updates[`user_submissions/${key}/${testId}/wrong`] = Number(
        cleanSub.wrong ?? 0,
      );
      updates[`user_submissions/${key}/${testId}/skipped`] = Number(
        cleanSub.skipped ?? 0,
      );
      updates[`user_submissions/${key}/${testId}/evaluated`] = true;
      if (cleanSub.details) {
        updates[`user_submissions/${key}/${testId}/details`] = cleanSub.details;
      }
      if (targetIsLegacy && legacyKey) {
        updates[`user_submissions/${key}/${legacyKey}/score`] = Number(
          cleanSub.score ?? 0,
        );
        updates[`user_submissions/${key}/${legacyKey}/correct`] = Number(
          cleanSub.correct ?? 0,
        );
        updates[`user_submissions/${key}/${legacyKey}/wrong`] = Number(
          cleanSub.wrong ?? 0,
        );
        updates[`user_submissions/${key}/${legacyKey}/skipped`] = Number(
          cleanSub.skipped ?? 0,
        );
        updates[`user_submissions/${key}/${legacyKey}/evaluated`] = true;
        if (cleanSub.details) {
          updates[`user_submissions/${key}/${legacyKey}/details`] =
            cleanSub.details;
        }
      }
    }

    await adminDb.ref().update(updates);

    return NextResponse.json({
      success: true,
      message: "Evaluation atomically saved across all ledgers",
    });
  } catch (error) {
    console.error("Save Evaluation API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
