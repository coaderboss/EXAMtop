// src/app/api/exam/fetch/route.js
import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/firebaseAdmin"; // Ensure this path matches your project structure
export const dynamic = 'force-dynamic';

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

    // 1. Find Metadata
    // Try New Architecture First
    const metaQuery = adminDb
      .ref("tests_metadata")
      .orderByChild("code")
      .equalTo(code);
    const metaSnap = await metaQuery.once("value");

    if (metaSnap.exists()) {
      const metaVal = metaSnap.val();
      const entry =
        Object.entries(metaVal).find(([k, v]) => v?.code === code) ||
        Object.entries(metaVal)[0];
      testMeta = {
        ...entry[1],
        id: entry[1]?.id || entry[0],
        dbKey: entry[0],
      };
    } else {
      // Fallback to Legacy Architecture
      const oldQuery = adminDb.ref("tests").orderByChild("code").equalTo(code);
      const oldSnap = await oldQuery.once("value");

      if (oldSnap.exists()) {
        const oldData = oldSnap.val();
        if (Array.isArray(oldData)) {
          testMeta = oldData.find((t) => t?.code === code);
        } else {
          const entry =
            Object.entries(oldData).find(([k, v]) => v?.code === code) ||
            Object.entries(oldData)[0];
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

    // 2. Fetch Questions Safely
    let rawQuestions = [];
    if (!isLegacy) {
      const qSnap = await adminDb
        .ref(`test_questions/${testMeta.id}`)
        .once("value");
      rawQuestions = qSnap.exists() ? qSnap.val().questions || [] : [];
    } else {
      rawQuestions = testMeta.questions || [];
    }

    // 3. 🛡️ THE P0 FIX: Server-Side Stripping (Answer Key Removed before hitting the network)
    const secureQuestions = rawQuestions.map((q) => {
      // EXPLICITLY REMOVE ANSWERS AND EXPLANATIONS
      const { correct, correctInt, explanation, ...safeQ } = q;
      return safeQ;
    });

    const safeTestObj = {
      ...testMeta,
      questions: secureQuestions,
    };

    // Remove raw questions if it was attached in legacy
    if (isLegacy) {
      delete safeTestObj.submissions; // Do not send thousands of submissions to a joining student!
    }

    return NextResponse.json({ success: true, testObj: safeTestObj });
  } catch (error) {
    console.error("Secure Exam Fetch Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
