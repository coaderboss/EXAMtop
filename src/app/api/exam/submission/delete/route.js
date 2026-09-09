import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { testId, studentUid, subKey, isLegacy } = await req.json();

    if (!testId || !subKey) {
      return NextResponse.json({ success: false, message: "Missing parameters" }, { status: 400 });
    }

    // 1. DELETE FROM MAIN DB (GOD MODE)
    if (isLegacy) {
      // Purane tests me array ya object ho sakta hai, seedha specific key delete maro
      await adminDb.ref(`tests/${testId}/submissions/${subKey}`).remove();
    } else {
      // Naye architecture me delete maro
      await adminDb.ref(`test_submissions/${testId}/submissions/${subKey}`).remove();
      
      // Submit count safely reduce karo
      const countRef = adminDb.ref(`tests_metadata/${testId}/submissionCount`);
      await countRef.transaction((count) => Math.max((count || 0) - 1, 0));
    }

    // 2. GHOST BOUNCER CURE: Wipe the student's personal receipt!
    const safeStudentUid = studentUid || subKey;
    await adminDb.ref(`user_submissions/${safeStudentUid}/${testId}`).remove();

    return NextResponse.json({ success: true, message: "Deleted permanently via God Mode" });
  } catch (error) {
    console.error("Delete API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}