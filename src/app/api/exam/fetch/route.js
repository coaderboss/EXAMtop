import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Test Code missing." },
        { status: 400 },
      );
    }

    let testMeta = null;
    let isLegacy = false;

    // 1. Find Metadata (NEW ARCHITECTURE)
    const metaQuery = adminDb
      .ref("tests_metadata")
      .orderByChild("code")
      .equalTo(code.toUpperCase());
    const metaSnap = await metaQuery.once("value");

    if (metaSnap.exists()) {
      const metaVal = metaSnap.val();
      const entry =
        Object.entries(metaVal).find(
          ([k, v]) => v?.code === code.toUpperCase(),
        ) || Object.entries(metaVal)[0];
      testMeta = { ...entry[1], id: entry[1]?.id || entry[0], dbKey: entry[0] };
    } else {
      // 2. THE GOD MODE FALLBACK: Check Legacy with Case-Insensitive Logic
      let oldSnap = await adminDb
        .ref("tests")
        .orderByChild("code")
        .equalTo(code)
        .once("value");

      // 🔥 FIX: Agar Uppercase se nahi mila, toh Lowercase me check karo!
      if (!oldSnap.exists()) {
        oldSnap = await adminDb
          .ref("tests")
          .orderByChild("code")
          .equalTo(code.toLowerCase())
          .once("value");
      }

      if (oldSnap.exists()) {
        const oldData = oldSnap.val();
        if (Array.isArray(oldData)) {
          testMeta = oldData.find(
            (t) => t?.code?.toUpperCase() === code.toUpperCase(),
          );
        } else {
          const entry =
            Object.entries(oldData).find(
              ([k, v]) => v?.code?.toUpperCase() === code.toUpperCase(),
            ) || Object.entries(oldData)[0];
          if (entry) {
            testMeta = {
              ...entry[1],
              id: entry[1]?.id || entry[0],
              dbKey: entry[0],
            };
          }
        }
        isLegacy = true;
      }
    }

    if (!testMeta) {
      return NextResponse.json(
        { success: false, message: "Invalid Test Code." },
        { status: 404 },
      );
    }

    // 3. Fetch Questions Safely
    let rawQuestions = [];
    if (!isLegacy) {
      const qSnap = await adminDb
        .ref(`test_questions/${testMeta.id}`)
        .once("value");
      rawQuestions = qSnap.exists() ? qSnap.val().questions || [] : [];
    } else {
      rawQuestions = testMeta.questions || [];
    }

    // 4. Server-Side Stripping
    const secureQuestions = rawQuestions.map((q) => {
      const { correct, correctInt, explanation, ...safeQ } = q;
      return safeQ;
    });

    const safeTestObj = { ...testMeta, questions: secureQuestions };

    // Prevent massive payloads for legacy tests
    if (isLegacy) delete safeTestObj.submissions;

    return NextResponse.json({ success: true, testObj: safeTestObj });
  } catch (error) {
    console.error("Secure Exam Fetch Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
