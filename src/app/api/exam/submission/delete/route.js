import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";
import { verifyTestOwnerOrAdmin } from "../../../../../lib/authGuard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { testId, studentUid, subKey, isLegacy, legacyKey } =
      await req.json();

    if (!testId || (!subKey && !studentUid)) {
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

    const targetSubKey = subKey || studentUid;

    // 1. DELETE FROM EXAMINER STORE
    if (isLegacy) {
      const activeLegacyKey = legacyKey || testId;
      await adminDb
        .ref(`tests/${activeLegacyKey}/submissions/${targetSubKey}`)
        .remove();
    } else {
      await adminDb
        .ref(`test_submissions/${testId}/submissions/${targetSubKey}`)
        .remove();

      // Submit count safely reduce karo
      const countRef = adminDb.ref(`tests_metadata/${testId}/submissionCount`);
      await countRef.transaction((count) => Math.max((count || 0) - 1, 0));
    }

    // 2. GHOST BOUNCER CURE: Wipe the student's personal receipt!
    const safeRollKey = studentUid && studentUid !== "anonymous" 
      ? studentUid 
      : (subKey ? subKey.trim().toLowerCase().replace(/\./g, "_") : null);

    const targetStudentKeys = [studentUid, subKey, safeRollKey].filter(Boolean);
    for (const key of targetStudentKeys) {
      await adminDb.ref(`user_submissions/${key}/${testId}`).remove();
      await adminDb.ref(`user_submissions/${encodeURIComponent(key)}/${testId}`).remove();
      
      if (isLegacy && legacyKey) {
        await adminDb.ref(`user_submissions/${key}/${legacyKey}`).remove();
        await adminDb.ref(`user_submissions/${encodeURIComponent(key)}/${legacyKey}`).remove();
      }
    }

    return NextResponse.json({
      success: true,
      message: "Deleted permanently via God Mode",
    });
  } catch (error) {
    console.error("Delete API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
