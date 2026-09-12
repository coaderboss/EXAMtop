import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";
import { verifyTestOwnerOrAdmin } from "../../../../../lib/authGuard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { testId, studentKey, subKey, isPublished, isLegacy, legacyKey } =
      await req.json();

    if (!testId || (!subKey && !studentKey)) {
      return NextResponse.json(
        { success: false, message: "Missing parameters" },
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

    const newPublishStatus = Boolean(isPublished);
    const updates = {};

    // 1. Update in Examiner's Submission Ledger
    const targetSubKey = subKey || studentKey;
    if (isLegacy) {
      const activeLegacyKey = legacyKey || testId;
      updates[
        `tests/${activeLegacyKey}/submissions/${targetSubKey}/isPublished`
      ] = newPublishStatus;
    } else {
      updates[
        `test_submissions/${testId}/submissions/${targetSubKey}/isPublished`
      ] = newPublishStatus;
    }

    // 2. Update in Student's Personal Ledger (user_submissions)
    const targetStudentKeys = [studentKey, subKey].filter(Boolean);
    for (const key of targetStudentKeys) {
      updates[`user_submissions/${key}/${testId}/isPublished`] =
        newPublishStatus;
      if (isLegacy && legacyKey) {
        updates[`user_submissions/${key}/${legacyKey}/isPublished`] =
          newPublishStatus;
      }
    }

    await adminDb.ref().update(updates);

    return NextResponse.json({
      success: true,
      message: `Status successfully set to ${newPublishStatus ? "Published" : "Hidden"}`,
      isPublished: newPublishStatus,
    });
  } catch (error) {
    console.error("Publish API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
