import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";
import { verifyTestOwnerOrAdmin } from "../../../../../lib/authGuard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { testId, legacyKey, isActive, closeDate, openDate } =
      await req.json();

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
    const payload = {
      isActive: Boolean(isActive),
    };

    if (closeDate !== undefined) payload.closeDate = closeDate;
    if (openDate !== undefined) payload.openDate = openDate;

    // 1. Update Legacy Node
    const targetLegacyKey = legacyKey || testId;
    if (targetLegacyKey) {
      updates[`tests/${targetLegacyKey}/isActive`] = payload.isActive;
      if (closeDate !== undefined)
        updates[`tests/${targetLegacyKey}/closeDate`] = payload.closeDate;
      if (openDate !== undefined)
        updates[`tests/${targetLegacyKey}/openDate`] = payload.openDate;
    }

    // 2. Update Split Metadata Node if it exists
    const targetTestId = testId || legacyKey;
    if (targetTestId) {
      const metaSnap = await adminDb
        .ref(`tests_metadata/${targetTestId}`)
        .once("value");
      if (metaSnap.exists()) {
        updates[`tests_metadata/${targetTestId}/isActive`] = payload.isActive;
        if (closeDate !== undefined)
          updates[`tests_metadata/${targetTestId}/closeDate`] =
            payload.closeDate;
        if (openDate !== undefined)
          updates[`tests_metadata/${targetTestId}/openDate`] = payload.openDate;
      }
    }

    await adminDb.ref().update(updates);

    return NextResponse.json({
      success: true,
      message: `Test status successfully set to ${payload.isActive ? "Active" : "Closed"}.`,
      isActive: payload.isActive,
    });
  } catch (error) {
    console.error("Legacy Toggle API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error toggling legacy test status." },
      { status: 500 },
    );
  }
}
