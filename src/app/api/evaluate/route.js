// src/app/api/evaluate/route.js
import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebaseAdmin";
import { verifyCaller } from "../../../lib/authGuard";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    // 🛡️ SEC-01 FIX: Authenticate caller & prevent identity spoofing
    const authResult = await verifyCaller(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        {
          success: false,
          message:
            authResult.message ||
            "Forbidden: Missing or invalid authorization token.",
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const {
      testId,
      student,
      answers,
      timeTaken,
      timeSpentPerQuestion,
      cheatLogs,
    } = body;

    // Enforce that callerUid matches student.uid exactly
    if (!student || !student.uid || student.uid !== authResult.callerUid) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Forbidden: Identity spoofing detected. Caller UID does not match student UID.",
        },
        { status: 403 },
      );
    }

    let activeTestMeta = null;
    let testQuestions = [];
    let isLegacy = false;
    let legacyTestKey = null;

    //Check New Architecture First (O(1) Fast Lookup)
    const metaSnap = await adminDb
      .ref(`tests_metadata/${testId}`)
      .once("value");
    if (metaSnap.exists()) {
      activeTestMeta = metaSnap.val();
      const qSnap = await adminDb.ref(`test_questions/${testId}`).once("value");
      testQuestions = qSnap.exists() ? qSnap.val().questions || [] : [];
    } else {
      // Never download the whole 'tests' node!
      // 1. Direct path lookup (Ultra Fast)
      let oldDirectSnap = await adminDb.ref(`tests/${testId}`).once("value");

      if (oldDirectSnap.exists()) {
        activeTestMeta = oldDirectSnap.val();
        legacyTestKey = testId;
        testQuestions = activeTestMeta.questions || [];
        isLegacy = true;
      } else {
        // 2. Query lookup fallback (High Speed Indexed with String & Number Type Resolution)
        let oldSnapById = await adminDb
          .ref("tests")
          .orderByChild("id")
          .equalTo(String(testId))
          .once("value");

        if (!oldSnapById.exists() && !isNaN(Number(testId))) {
          oldSnapById = await adminDb
            .ref("tests")
            .orderByChild("id")
            .equalTo(Number(testId))
            .once("value");
        }

        if (oldSnapById.exists()) {
          const oldData = oldSnapById.val();
          legacyTestKey = Object.keys(oldData)[0];
          activeTestMeta = oldData[legacyTestKey];
          testQuestions = activeTestMeta.questions || [];
          isLegacy = true;
        } else {
          // 3. Fallback for code mismatch
          const oldSnapByCode = await adminDb
            .ref("tests")
            .orderByChild("code")
            .equalTo(testId)
            .once("value");
          if (oldSnapByCode.exists()) {
            const oldData = oldSnapByCode.val();
            legacyTestKey = Object.keys(oldData)[0];
            activeTestMeta = oldData[legacyTestKey];
            testQuestions = activeTestMeta.questions || [];
            isLegacy = true;
          }
        }
      }
    }

    if (!activeTestMeta) {
      return NextResponse.json(
        { success: false, message: "Test not found in Cloud Database." },
        { status: 404 },
      );
    }

    // 🔥 P0.2 SECURITY FIX: Server-Side Deadline Enforcement (Handling both Schemas)
    const rawDeadline = activeTestMeta.closeDate || activeTestMeta.expiryDate;

    if (rawDeadline) {
      const closeTime = new Date(rawDeadline).getTime();
      // 5-minute grace period allowed for slow internet or network delays
      if (!isNaN(closeTime) && Date.now() > closeTime + 5 * 60 * 1000) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Submission Rejected: Exam deadline has strictly passed. No further submissions accepted.",
          },
          { status: 403 },
        );
      }
    }

    // 1.5. SECURITY BLOCK: Scalable O(1) Backend Duplicate Check
    let alreadySubmitted = false;

    const safeUserKey =
      student.uid && student.uid !== "anonymous"
        ? student.uid
        : encodeURIComponent(
            (student.roll || student.name || "guest").trim().toLowerCase(),
          ).replace(/\./g, "_");

    if (isLegacy) {
      const legacySubs = activeTestMeta.submissions
        ? Array.isArray(activeTestMeta.submissions)
          ? activeTestMeta.submissions
          : Object.values(activeTestMeta.submissions)
        : [];

      // FIX: Strict UID, Email & Roll Check for Legacy Tests
      alreadySubmitted = legacySubs.some((s) => {
        if (!s) return false;
        const studentUid = student.uid || "anonymous";
        if (s.uid && s.uid === studentUid && studentUid !== "anonymous")
          return true;
        if (
          s.email &&
          student.email &&
          s.email.toLowerCase() === student.email.toLowerCase()
        )
          return true;
        if (
          s.roll &&
          student.roll &&
          s.roll.toLowerCase() === student.roll.toLowerCase()
        )
          return true;
        return false;
      });
    } else {
      // 🛡️ THE 100K SCALING OOM FIX: Targeted single node read instead of monolithic download
      const primarySnap = await adminDb
        .ref(`test_submissions/${testId}/submissions/${safeUserKey}`)
        .once("value");

      if (primarySnap.exists()) {
        alreadySubmitted = true;
      } else if (student.roll) {
        // Fast Check Secondary Key (Roll Number)
        const rollKey = encodeURIComponent(
          student.roll.trim().toLowerCase(),
        ).replace(/\./g, "_");
        const rollSnap = await adminDb
          .ref(`test_submissions/${testId}/submissions/${rollKey}`)
          .once("value");
        if (rollSnap.exists()) {
          alreadySubmitted = true;
        }
      }
    }

    if (alreadySubmitted) {
      console.warn(`Duplicate submission blocked for ${safeUserKey}`);
      return NextResponse.json(
        {
          success: false,
          message: "Duplicate Submission Blocked: You have already submitted.",
        },
        { status: 403 },
      );
    }

    // 2. THE MASTER EVALUATION ENGINE
    let score = 0,
      correct = 0,
      wrong = 0,
      skipped = 0;
    const neg = Math.abs(Number(activeTestMeta.negMarking || 0));

    const details = testQuestions.map((q, i) => {
      // 🔥 FIX: Strict String Mapping to prevent shuffle index mismatches
      let studentAns = answers.find((a) => String(a.qIndex) === String(i));
      let val = studentAns ? studentAns.val : null;
      let status = "skipped";
      let earned = 0;

      let isSkipped =
        val === null ||
        val === undefined ||
        val === "" ||
        val === -1 ||
        (Array.isArray(val) && val.length === 0);

      if (isSkipped) {
        skipped++;
        status = "skipped";
      } else if (q.type === "mcq") {
        if (!q.correct || q.correct.length === 0) {
          status = "submitted";
          skipped++;
        } else if (String(val) === String(q.correct[0])) {
          correct++;
          earned = q.marks;
          score += q.marks;
          status = "correct";
        } else {
          wrong++;
          earned = -neg;
          score -= neg;
          status = "wrong";
        }
      } else if (q.type === "msq") {
        let userSel = Array.isArray(val) ? val : [];
        let corrSel = q.correct || [];
        if (corrSel.length === 0) {
          status = "submitted";
          skipped++;
        } else {
          let hasWrongOption = userSel.some((x) => !corrSel.includes(x));
          let correctlySelected = userSel.filter((x) =>
            corrSel.includes(x),
          ).length;
          if (hasWrongOption) {
            wrong++;
            earned = -neg;
            score -= neg;
            status = "wrong";
          } else if (correctlySelected === corrSel.length) {
            correct++;
            earned = q.marks;
            score += q.marks;
            status = "correct";
          } else if (correctlySelected > 0) {
            let partialMarks = (q.marks / corrSel.length) * correctlySelected;
            earned = Math.round(partialMarks * 100) / 100;
            score += earned;
            correct++;
            status = "partial";
          } else {
            wrong++;
            earned = -neg;
            score -= neg;
            status = "wrong";
          }
        }
      } else if (q.type === "integer") {
        if (
          q.correctInt === null ||
          q.correctInt === undefined ||
          q.correctInt === ""
        ) {
          status = "submitted";
          skipped++;
        } else if (String(val) === String(q.correctInt)) {
          correct++;
          earned = q.marks;
          score += q.marks;
          status = "correct";
        } else {
          wrong++;
          earned = -neg;
          score -= neg;
          status = "wrong";
        }
      } else if (q.type === "subjective") {
        status = "submitted";
      } else {
        skipped++;
        status = "submitted";
      }

      let safeVal = val;
      if (
        val === null ||
        val === undefined ||
        (Array.isArray(val) && val.length === 0)
      )
        safeVal = "";

      // 🛡️ SCALE-01 FIX: Store lightweight question reference instead of complete duplicate question payload
      return {
        q: { index: i, type: q.type, marks: q.marks },
        ans: { val: safeVal },
        status,
        earned,
      };
    });

    // 🛡️ SANITIZER ENGINE: Strips all undefined properties so Firebase Admin never crashes
    const sanitizePayload = (obj) =>
      JSON.parse(JSON.stringify(obj, (k, v) => (v === undefined ? null : v)));

    // 3. SECURE PAYLOAD PUSH (Atomic Transaction to prevent Race Conditions)
    const finalSub = {
      uid: student.uid || "anonymous",
      name: student.name || "Student",
      roll: student.roll || "",
      score: Number(score.toFixed(2)),
      correct,
      wrong,
      skipped,
      details,
      time: new Date().toLocaleString("en-IN"),
      timestamp: Date.now(),
      totalMarks: Number(activeTestMeta.totalMarks || 0),
      cheatLogs: cheatLogs || [],
      timeTaken: timeTaken || "00:00",
      timeSpentPerQuestion: timeSpentPerQuestion || {},
      isPublished: false,
    };

    const cleanFinalSub = sanitizePayload(finalSub);

    if (isLegacy) {
      await adminDb
        .ref(`tests/${legacyTestKey}/submissions`)
        .push(cleanFinalSub);

      const dashboardRef = adminDb.ref(
        `user_submissions/${safeUserKey}/${testId || legacyTestKey}`,
      );
      await dashboardRef.set(
        sanitizePayload({
          testId: testId || legacyTestKey,
          legacyTestKey: legacyTestKey,
          testTitle: activeTestMeta.title || "Untitled Assessment",
          testCode: activeTestMeta.code || "N/A",
          subject: activeTestMeta.subject || "General",
          score: Number(score.toFixed(2)),
          totalMarks: Number(activeTestMeta.totalMarks || 0),
          correct: correct,
          wrong: wrong,
          skipped: skipped,
          time: new Date().toLocaleString("en-IN"),
          timestamp: Date.now(),
          studentRoll: student.roll || "",
          studentName: student.name || "",
          studentKey: safeUserKey,
          isPublished: false,
          resultVis: activeTestMeta.resultVis || "instant",
          resultPublishTime:
            activeTestMeta.resultVis === "scheduled"
              ? activeTestMeta.resultPublishTime || null
              : null,
          details: cleanFinalSub.details || [],
        }),
      );
    } else {
      const lockRef = adminDb.ref(
        `test_submissions/${testId}/submissions/${safeUserKey}`,
      );

      const { committed } = await lockRef.transaction((currentData) => {
        if (currentData === null) {
          return cleanFinalSub; // Only write if it does not exist
        } else {
          return; // Abort transaction, duplicate detected at database level
        }
      });

      if (!committed) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Duplicate Submission Blocked: You have already submitted.",
          },
          { status: 403 },
        );
      }

      // 🛡️ FIXED: Save complete metadata in the index so student-results never shows N/A
      const dashboardRef = adminDb.ref(
        `user_submissions/${safeUserKey}/${testId}`,
      );
      await dashboardRef.set(
        sanitizePayload({
          testId: testId,
          testTitle: activeTestMeta.title || "Untitled Assessment",
          testCode: activeTestMeta.code || "N/A",
          subject: activeTestMeta.subject || "General",
          score: Number(score.toFixed(2)),
          totalMarks: Number(activeTestMeta.totalMarks || 0),
          correct: correct,
          wrong: wrong,
          skipped: skipped,
          time: new Date().toLocaleString("en-IN"),
          timestamp: Date.now(),
          studentRoll: student.roll || "",
          studentName: student.name || "",
          studentKey: safeUserKey,
          isPublished: false,
          resultVis: activeTestMeta.resultVis || "instant",
          resultPublishTime:
            activeTestMeta.resultVis === "scheduled"
              ? activeTestMeta.resultPublishTime || null
              : null,
          details: cleanFinalSub.details || [],
        }),
      );

      // 🛡️ SCALE.1 FIX: Isolated Non-blocking Counter Increment (prevents 500 on concurrency contention)
      try {
        await adminDb
          .ref(`tests_metadata/${testId}/submissionCount`)
          .transaction((count) => (count || 0) + 1);
      } catch (countErr) {
        console.warn(
          "Non-blocking submissionCount transaction contention bypassed:",
          countErr?.message || countErr,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Securely evaluated and saved!",
    });
  } catch (error) {
    console.error("Evaluation API Error:", error);
    return NextResponse.json(
      { success: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
