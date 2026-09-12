import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";
import { verifyTestOwnerOrAdmin } from "../../../../../lib/authGuard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { testId, legacyKey, creatorUid, uid } = await req.json();

    if (!testId && !legacyKey) {
      return NextResponse.json(
        { success: false, message: "Missing testId or legacyKey." },
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

    // 1. Soft-delete in legacy tests node
    const targetLegacyKey = legacyKey || testId;
    if (targetLegacyKey) {
      updates[`tests/${targetLegacyKey}/isDeletedByExaminer`] = true;
      if (creatorUid)
        updates[`tests/${targetLegacyKey}/creatorUid`] = creatorUid;
      if (uid) updates[`tests/${targetLegacyKey}/uid`] = uid;
    }

    // 2. Soft-delete in split tests_metadata node if present
    const targetTestId = testId || legacyKey;
    if (targetTestId) {
      const metaSnap = await adminDb
        .ref(`tests_metadata/${targetTestId}`)
        .once("value");
      if (metaSnap.exists()) {
        updates[`tests_metadata/${targetTestId}/isDeletedByExaminer`] = true;
      }
    }

    await adminDb.ref().update(updates);

    return NextResponse.json({
      success: true,
      message: "Test moved to trash successfully via God Mode.",
    });
  } catch (error) {
    console.error("Legacy Delete API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error soft-deleting legacy test." },
      { status: 500 },
    );
  }
}
