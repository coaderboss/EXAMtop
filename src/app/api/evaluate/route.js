// src/app/api/evaluate/route.js
import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebaseAdmin"; 

export async function POST(req) {
  try {
    const body = await req.json();
    const { testId, student, answers, timeTaken, timeSpentPerQuestion, cheatLogs } = body;

    let activeTestMeta = null;
    let testQuestions = [];
    let isLegacy = false;
    let legacyTestKey = null;

    //Check New Architecture First (O(1) Fast Lookup)
    const metaSnap = await adminDb.ref(`tests_metadata/${testId}`).once("value");
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
         // 2. Query lookup fallback (High Speed Indexed)
         const oldSnapById = await adminDb.ref('tests').orderByChild('id').equalTo(testId).once("value");
         if (oldSnapById.exists()) {
             const oldData = oldSnapById.val();
             legacyTestKey = Object.keys(oldData)[0];
             activeTestMeta = oldData[legacyTestKey];
             testQuestions = activeTestMeta.questions || [];
             isLegacy = true;
         } else {
             // 3. Fallback for code mismatch
             const oldSnapByCode = await adminDb.ref('tests').orderByChild('code').equalTo(testId).once("value");
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
      return NextResponse.json({ success: false, message: "Test not found in Cloud Database." }, { status: 404 });
    }

    // 1.5. SECURITY BLOCK: Backend Duplicate Check
    let existingSubs = [];
    if (isLegacy) {
       existingSubs = activeTestMeta.submissions ? (Array.isArray(activeTestMeta.submissions) ? activeTestMeta.submissions : Object.values(activeTestMeta.submissions)) : [];
    } else {
       const subsSnap = await adminDb.ref(`test_submissions/${testId}/submissions`).once("value");
       existingSubs = subsSnap.exists() ? Object.values(subsSnap.val()) : [];
    }
    
    const alreadySubmitted = existingSubs.some(
      (s) => s && (s.roll || "").toLowerCase() === (student.roll || "").toLowerCase()
    );
    if (alreadySubmitted) {
      return NextResponse.json({ success: false, message: "Duplicate Submission Blocked: You have already submitted." }, { status: 403 });
    }

    // 2. THE MASTER EVALUATION ENGINE
    let score = 0, correct = 0, wrong = 0, skipped = 0;
    const neg = Math.abs(Number(activeTestMeta.negMarking || 0));
    
    const details = testQuestions.map((q, i) => {
      // 🔥 FIX: Strict String Mapping to prevent shuffle index mismatches
      let studentAns = answers.find(a => String(a.qIndex) === String(i));
      let val = studentAns ? studentAns.val : null;
      let status = "skipped";
      let earned = 0;

      let isSkipped = val === null || val === undefined || val === "" || val === -1 || (Array.isArray(val) && val.length === 0);

      if (isSkipped) {
        skipped++; status = "skipped";
      } else if (q.type === "mcq") {
        if (!q.correct || q.correct.length === 0) {
          status = "submitted"; skipped++;
        } else if (String(val) === String(q.correct[0])) {
          correct++; earned = q.marks; score += q.marks; status = "correct";
        } else {
          wrong++; earned = -neg; score -= neg; status = "wrong";
        }
      } else if (q.type === "msq") {
        let userSel = Array.isArray(val) ? val : [];
        let corrSel = q.correct || [];
        if (corrSel.length === 0) {
          status = "submitted"; skipped++;
        } else {
          let hasWrongOption = userSel.some(x => !corrSel.includes(x));
          let correctlySelected = userSel.filter(x => corrSel.includes(x)).length;
          if (hasWrongOption) {
            wrong++; earned = -neg; score -= neg; status = "wrong";
          } else if (correctlySelected === corrSel.length) {
            correct++; earned = q.marks; score += q.marks; status = "correct";
          } else if (correctlySelected > 0) {
            let partialMarks = (q.marks / corrSel.length) * correctlySelected;
            earned = Math.round(partialMarks * 100) / 100;
            score += earned; correct++; status = "partial";
          } else {
            wrong++; earned = -neg; score -= neg; status = "wrong";
          }
        }
      } else if (q.type === "integer") {
        if (q.correctInt === null || q.correctInt === undefined || q.correctInt === "") {
          status = "submitted"; skipped++;
        } else if (String(val) === String(q.correctInt)) {
          correct++; earned = q.marks; score += q.marks; status = "correct";
        } else {
          wrong++; earned = -neg; score -= neg; status = "wrong";
        }
      } else if (q.type === "subjective") {
        status = "submitted"; 
      } else {
        skipped++; status = "submitted";
      }

      let safeVal = val;
      if (val === null || val === undefined || (Array.isArray(val) && val.length === 0)) safeVal = "";

      return { q, ans: { val: safeVal }, status, earned };
    });

    // 3. SECURE PAYLOAD PUSH
    const finalSub = {
      uid: student.uid || "anonymous",
      name: student.name,
      roll: student.roll,
      score: Number(score.toFixed(2)),
      correct, wrong, skipped, details,
      time: new Date().toLocaleString("en-IN"),
      timestamp: Date.now(),
      totalMarks: activeTestMeta.totalMarks,
      cheatLogs: cheatLogs || [],
      timeTaken: timeTaken,
      timeSpentPerQuestion: timeSpentPerQuestion || {},
      isPublished: false 
    };

    if (isLegacy) {
       await adminDb.ref(`tests/${legacyTestKey}/submissions`).push(finalSub);
    } else {
       await adminDb.ref(`test_submissions/${testId}/submissions`).push(finalSub);
       //Transaction is safe because it only locks the submissionCount value, not the whole test
       await adminDb.ref(`tests_metadata/${testId}/submissionCount`).transaction(count => (count || 0) + 1);
    }

    return NextResponse.json({ success: true, message: "Securely evaluated and saved!" });

  } catch (error) {
    console.error("Evaluation API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}