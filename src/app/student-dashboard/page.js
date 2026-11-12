// src/app/student-dashboard/page.js
"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { database } from "../../lib/firebase";
import { ref, get } from "firebase/database";

export default function StudentDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [myHistory, setMyHistory] = useState([]);
  const [fetchingResults, setFetchingResults] = useState(true);
  const [animateGraph, setAnimateGraph] = useState(false);

  // Analysis Mode & Graph Pagination
  const [analysisMode, setAnalysisMode] = useState("insights");
  const [trendPage, setTrendPage] = useState(0);

  useEffect(() => {
    if (!fetchingResults && myHistory.length > 0) {
      const timer = setTimeout(() => setAnimateGraph(true), 150);
      return () => clearTimeout(timer);
    }
  }, [fetchingResults, myHistory]);

  // 🛡️ RESULT VISIBILITY CHECKER (Mirrored identically from student-results)
  const isResultVisible = (t, s) => {
    if (!t) return false;
    if (
      t.resultVis === "instant" ||
      t.released === true ||
      (s && s.isPublished === true)
    )
      return true;
    if (t.resultVis === "scheduled" && t.resultPublishTime) {
      const pubTime = new Date(t.resultPublishTime).getTime();
      return !isNaN(pubTime) && Date.now() >= pubTime;
    }
    return false;
  };

  // 🚀 CLEAN DASHBOARD FETCH WITH RUTHLESS GHOST FILTER & VISIBILITY SYNC
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) {
        setFetchingResults(false);
        return;
      }
      try {
        setFetchingResults(true);
        let historyTemp = [];
        const safeUserKey = currentUser.uid;

        // 1. O(1) DASHBOARD FETCH WITH METADATA VISIBILITY CHECK
        try {
          const userSubSnap = await get(
            ref(database, `user_submissions/${safeUserKey}`),
          );
          if (userSubSnap.exists()) {
            const userSubs = userSubSnap.val();

            const subPromises = Object.keys(userSubs).map(async (key) => {
              const sub = userSubs[key];
              if (!sub) return null;
              const testId = sub.testId || key;

              if (!testId || testId === "undefined" || sub.score === undefined)
                return null;

              let title = sub.testTitle || "";
              let code = sub.testCode || "N/A";
              let totalMarks = sub.totalMarks;
              let subject = sub.subject || "General";
              let tVis = sub.resultVis || "manual";
              let tReleased = false;
              let tPubTime = sub.resultPublishTime || null;

              try {
                let metaSnap = await get(
                  ref(database, `tests_metadata/${testId}`),
                );

                if (metaSnap.exists()) {
                  const m = metaSnap.val();
                  title = m.title || title;
                  code = m.code || code;
                  totalMarks = m.totalMarks || totalMarks || 100;
                  subject = m.subject || subject || "General";
                  tVis = m.resultVis || sub.resultVis || "manual";
                  tReleased = m.released === true;
                  tPubTime =
                    m.resultPublishTime || sub.resultPublishTime || null;

                  if (
                    !title ||
                    title.trim() === "" ||
                    title.toLowerCase().includes("unnamed")
                  )
                    return null;
                } else {
                  if (
                    !title ||
                    title.trim() === "" ||
                    title.toLowerCase().includes("unnamed")
                  )
                    return null;
                }
              } catch (e) {
                if (
                  !title ||
                  title.trim() === "" ||
                  title.toLowerCase().includes("unnamed")
                )
                  return null;
              }

              const isVisible = isResultVisible(
                {
                  resultVis: tVis,
                  released: tReleased,
                  resultPublishTime: tPubTime,
                },
                { isPublished: sub.isPublished === true },
              );

              return {
                testId: testId,
                testTitle: title,
                testCode: code,
                subject: subject,
                score: Number(sub.score || 0),
                totalMarks: Number(totalMarks || 100),
                correct: sub.correct || 0,
                wrong: sub.wrong || 0,
                skipped: sub.skipped || 0,
                time:
                  sub.time ||
                  (sub.timestamp
                    ? new Date(sub.timestamp).toLocaleString("en-IN")
                    : "Recent"),
                sIdx: 0,
                timestamp: sub.timestamp || 0,
                isVisible: isVisible,
                resultVis: tVis,
                isPublished: sub.isPublished === true,
              };
            });

            const resolvedSubs = await Promise.all(subPromises);
            historyTemp.push(...resolvedSubs.filter(Boolean));
          }
        } catch (error) {
          console.warn("Primary fetch error:", error);
        }

        // DEDUPLICATION & SORTING
        const uniqueHistory = Array.from(
          new Map(
            historyTemp.map((item) => [
              `${item.testId}_${item.timestamp || 0}_${item.score ?? 0}`,
              item,
            ]),
          ).values(),
        );
        uniqueHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        setMyHistory(uniqueHistory);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setFetchingResults(false);
      }
    };
    fetchDashboardData();
  }, [currentUser]);

  // Loading Skeleton (Clean White & Slate)
  if (authLoading || fetchingResults) {
    return (
      <div className="w-full max-w-[1500px] mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 animate-pulse">
        <div className="w-full h-24 bg-slate-100 rounded-2xl mb-5"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-20 bg-slate-100 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 mb-5">
          <div className="h-32 bg-slate-100 rounded-2xl"></div>
          <div className="h-32 bg-slate-100 rounded-2xl"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 h-80 bg-slate-100 rounded-2xl"></div>
          <div className="lg:col-span-4 h-80 bg-slate-100 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Unauthorized State (Clean & Friendly)
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4 w-full max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mb-4 border border-blue-100 shadow-sm">
          <i className="ti ti-lock"></i>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1.5 tracking-tight">
          Student Portal Access
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mb-6">
          Please sign in to view your test history, performance trajectory, teacher radar, and step-by-step solutions.
        </p>
        <button
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          onClick={() => router.push("/")}
        >
          Return to Home
        </button>
      </div>
    );
  }

  // --- 🧠 DATA CALCULATIONS ---
  const totalTests = myHistory.length;
  let totalCorrect = 0,
    totalWrong = 0,
    totalEarned = 0,
    totalMax = 0;
  let highestScorePct = 0;
  let weaknessData = {};

  myHistory.forEach((h) => {
    if (h.isVisible === false) return; // 🛡️ Prevent leaking hidden exam stats into global aggregations
    totalCorrect += h.correct;
    totalWrong += h.wrong;
    totalEarned += h.score;
    totalMax += h.totalMarks;

    const currentPct = h.totalMarks > 0 ? (h.score / h.totalMarks) * 100 : 0;
    if (currentPct > highestScorePct) highestScorePct = currentPct;

    const subName = h.subject || "General";
    if (!weaknessData[subName])
      weaknessData[subName] = { mistakes: 0, attempts: 0, correct: 0 };
    weaknessData[subName].mistakes += h.wrong;
    weaknessData[subName].correct += h.correct;
    weaknessData[subName].attempts += h.correct + h.wrong + h.skipped;
  });

  const overallAccuracy =
    totalCorrect + totalWrong > 0
      ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100)
      : 0;
  const overallPercentage =
    totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

  // Rank Math (Clean subtle pastel badges)
  let rankTitle = "Starter";
  let rankColor = "text-slate-700";
  let rankBg = "bg-slate-100";
  let rankBorder = "border-slate-200";
  let rankIcon = "ti-star";

  if (totalTests > 0) {
    if (overallPercentage >= 85) {
      rankTitle = "Elite Scholar";
      rankColor = "text-amber-800";
      rankBg = "bg-amber-50";
      rankBorder = "border-amber-200";
      rankIcon = "ti-crown";
    } else if (overallPercentage >= 70) {
      rankTitle = "Consistent Pro";
      rankColor = "text-indigo-800";
      rankBg = "bg-indigo-50";
      rankBorder = "border-indigo-200";
      rankIcon = "ti-trending-up";
    } else if (overallPercentage >= 50) {
      rankTitle = "Developing Learner";
      rankColor = "text-emerald-800";
      rankBg = "bg-emerald-50";
      rankBorder = "border-emerald-200";
      rankIcon = "ti-barbell";
    } else {
      rankTitle = "Needs Focus";
      rankColor = "text-rose-800";
      rankBg = "bg-rose-50";
      rankBorder = "border-rose-200";
      rankIcon = "ti-alert-circle";
    }
  }

  const testsPerLevel = 5;
  const currentLevel = Math.floor(totalTests / testsPerLevel) + 1;
  const testsInCurrentLevel = totalTests % testsPerLevel;
  const progressPct = (testsInCurrentLevel / testsPerLevel) * 100;
  const testsToNextLevel = testsPerLevel - testsInCurrentLevel;

  // Smart Graph Pagination Logic (8 per page)
  const ITEMS_PER_PAGE = 8;
  const totalTrendPages = Math.ceil(totalTests / ITEMS_PER_PAGE) || 1;
  const reversedHistory = [...myHistory].reverse();
  const startIndex = trendPage * ITEMS_PER_PAGE;
  const recentTrend = reversedHistory
    .slice(startIndex, startIndex + ITEMS_PER_PAGE)
    .reverse();

  const hasOlder = startIndex + ITEMS_PER_PAGE < totalTests;
  const hasNewer = trendPage > 0;

  // Smart Insights Generation
  let smartInsights = [];
  if (totalTests > 0) {
    if (overallAccuracy >= 80) {
      smartInsights.push({
        icon: "ti-target",
        title: "High Accuracy Rate",
        desc: "Your accuracy rate is above 80%. Your question selection and answer elimination are reliable.",
        color: "emerald",
      });
    } else if (overallAccuracy < 50) {
      smartInsights.push({
        icon: "ti-alert-triangle",
        title: "Watch Negative Marks",
        desc: "Over 50% of attempts resulted in mistakes. Skip questions if you cannot eliminate choices.",
        color: "rose",
      });
    }

    if (totalTests >= 3 && overallPercentage >= 75) {
      smartInsights.push({
        icon: "ti-flame",
        title: "Steady Performance",
        desc: "Consistently scoring above benchmark. Keep testing regularly to maintain this pace.",
        color: "amber",
      });
    } else if (totalTests >= 2) {
      smartInsights.push({
        icon: "ti-book-2",
        title: "Mistake Revision",
        desc: "Review past tests in the Solutions Hub to clarify concepts where marks were missed.",
        color: "indigo",
      });
    }
  }

  // Subject Badge Helper (Clean styling)
  const getSubjectBadge = (subject) => {
    const s = (subject || "").toLowerCase();
    if (s.includes("phys")) {
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        icon: "ti ti-atom-2",
        label: subject || "Physics",
      };
    }
    if (s.includes("chem")) {
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: "ti ti-flask",
        label: subject || "Chemistry",
      };
    }
    if (s.includes("math")) {
      return {
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        icon: "ti ti-math-symbols",
        label: subject || "Mathematics",
      };
    }
    if (s.includes("bio")) {
      return {
        bg: "bg-teal-50 text-teal-700 border-teal-200",
        icon: "ti ti-dna",
        label: subject || "Biology",
      };
    }
    return {
      bg: "bg-slate-50 text-slate-700 border-slate-200",
      icon: "ti ti-book",
      label: subject || "General",
    };
  };

  // Find Personal Best Test
  const reversedHistoryForList = [...myHistory].reverse();
  let bestTest = null;
  let maxBestPct = -1;
  reversedHistoryForList.forEach((h) => {
    if (h.isVisible === false) return;
    const validScore = h.score || 0;
    const validTotal = h.totalMarks || 0;
    const pct = validTotal > 0 ? Math.round((validScore / validTotal) * 100) : 0;
    if (pct > maxBestPct) {
      maxBestPct = pct;
      bestTest = h;
    }
  });

  const recentExams = reversedHistoryForList.slice(0, 3);

  return (
    <div className="w-full max-w-[1500px] mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7">
      {/* 🧭 1. TOP HEADER & STUDENT GREETING (Clean White Card) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Avatar & Info */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg sm:text-xl font-black shadow-sm shrink-0">
              {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : "S"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  Welcome, {currentUser.displayName?.split(" ")[0] || "Student"}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  Level {currentLevel}
                </span>
                {totalTests > 0 && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${rankBg} ${rankColor} border ${rankBorder}`}>
                    <i className={`ti ${rankIcon} text-xs`}></i> {rankTitle}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {totalTests > 0
                  ? `${totalTests} exams completed • ${overallAccuracy}% accuracy • ${totalEarned} marks earned`
                  : "Your personal test dashboard is ready. Follow live teacher exams or practice tests."}
              </p>

              {/* Level Progress */}
              <div className="flex items-center gap-2 mt-1.5 max-w-xs">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 shrink-0">
                  {testsToNextLevel} test{testsToNextLevel > 1 ? "s" : ""} to Lvl {currentLevel + 1}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Logical Single CTA Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => router.push("/student/radar")}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Open Educator Radar"
            >
              <i className="ti ti-radar text-sm"></i>
              <span>Educator Radar</span>
            </button>

            <button
              onClick={() => router.push("/student-results")}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 cursor-pointer shadow-sm shadow-blue-600/15"
              title="Open Full Results & Solutions Hub"
            >
              <i className="ti ti-file-analytics text-sm"></i>
              <span>Results & Solutions</span>
              <i className="ti ti-arrow-right text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 📊 2. OVERVIEW METRICS (Compact 2x2 on Mobile, Clean 4-Col on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
        {/* Exams Taken */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Exams Taken
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 leading-none">
              {totalTests}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-1 hidden sm:block">
              Recorded Submissions
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-base sm:text-xl shrink-0">
            <i className="ti ti-file-certificate"></i>
          </div>
        </div>

        {/* Hit Accuracy */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Hit Accuracy
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 leading-none">
              {overallAccuracy}%
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-1 hidden sm:block">
              {totalCorrect} correct answers
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base sm:text-xl shrink-0">
            <i className="ti ti-target"></i>
          </div>
        </div>

        {/* Total Marks */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Marks Scored
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 leading-none">
              {totalEarned}{" "}
              <span className="text-[10px] sm:text-xs font-normal text-slate-400">
                / {totalMax}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-1 hidden sm:block">
              {overallPercentage}% aggregate
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base sm:text-xl shrink-0">
            <i className="ti ti-bolt"></i>
          </div>
        </div>

        {/* Mistakes */}
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
              Mistakes Flagged
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 mt-0.5 leading-none">
              {totalWrong}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-1 hidden sm:block">
              Review to reduce negatives
            </div>
          </div>
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-base sm:text-xl shrink-0">
            <i className="ti ti-circle-x"></i>
          </div>
        </div>
      </div>

      {/* 🧭 3. THREE FEATURE HUBS: JOIN TEST, RADAR & RESULTS (Clean White Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 mb-4 sm:mb-6">
        {/* Card A: Join Exam with Code */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-blue-300 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                <i className="ti ti-key text-xs"></i>
                Take Exam
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-base">
                <i className="ti ti-file-pencil"></i>
              </div>
            </div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 mb-1 tracking-tight">
              Enter Test Code
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Have an exam code provided by your teacher or coaching institute? Enter your code to start your scheduled test or assessment.
            </p>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400">
              Enter code & begin test
            </span>
            <button
              onClick={() => router.push("/student")}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              <span>Start Exam</span>
              <i className="ti ti-arrow-right text-xs"></i>
            </button>
          </div>
        </div>

        {/* Card B: Educator Radar Guide */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-indigo-300 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Broadcast Sync
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-base">
                <i className="ti ti-radar"></i>
              </div>
            </div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 mb-1 tracking-tight">
              Educator Radar
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Radar connects you to your coaching teachers. When an educator schedules a live mock test, it appears directly on your feed—join with 1 click without test codes.
            </p>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400">
              Follow educators & live tests
            </span>
            <button
              onClick={() => router.push("/student/radar")}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              <span>Open Radar Feed</span>
              <i className="ti ti-arrow-right text-xs"></i>
            </button>
          </div>
        </div>

        {/* Card C: Results & Solutions Guide */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                <i className="ti ti-check text-xs"></i>
                In-Depth Answers
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-base">
                <i className="ti ti-file-analytics"></i>
              </div>
            </div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 mb-1 tracking-tight">
              Detailed Results & Solutions
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Understand your mistakes with complete question papers, official answer keys, step-by-step LaTeX formulas, chemistry structure diagrams, and time per question.
            </p>
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400">
              Full answer keys & solutions
            </span>
            <button
              onClick={() => router.push("/student-results")}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
            >
              <span>View Solutions</span>
              <i className="ti ti-arrow-right text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 🚀 4. MAIN TWO-COLUMN DASHBOARD GRID (Clean 8 / 4 Responsive Proportions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start w-full">
        {/* LEFT COLUMN: PERFORMANCE TRAJECTORY & RECENT ACTIVITY (8 Cols on Desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-6 w-full min-w-0">
          {/* Performance Trajectory Card */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 m-0 tracking-tight">
                  <i className="ti ti-chart-bar text-indigo-600 text-base"></i>
                  Performance Trajectory
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                  Score percentage over time for completed exams
                </p>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center gap-2.5 text-[10px] font-bold text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ≥75%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> 40-74%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> &lt;40%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-300"></span> Review
                </span>
              </div>
            </div>

            {/* Chart Area (Responsive Height) */}
            <div className="w-full overflow-x-auto custom-scrollbar pb-2">
              <div className="flex items-end gap-2.5 sm:gap-4 h-[150px] sm:h-[180px] min-w-[420px] sm:min-w-[540px] border-b border-slate-200 px-2 sm:px-3 relative">
                {/* Horizontal Guide Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30 px-1">
                  <div className="border-t border-dashed border-slate-300 w-full h-0 relative">
                    <span className="absolute -top-2 -left-1 text-[8px] font-bold text-slate-400">100%</span>
                  </div>
                  <div className="border-t border-dashed border-slate-300 w-full h-0 relative">
                    <span className="absolute -top-2 -left-1 text-[8px] font-bold text-slate-400">50%</span>
                  </div>
                  <div className="border-t border-slate-200 w-full h-0"></div>
                </div>

                {recentTrend.length === 0 ? (
                  <div className="flex items-center justify-center w-full h-full text-slate-400 text-xs font-semibold">
                    No completed tests to display yet.
                  </div>
                ) : (
                  recentTrend.map((h, i) => {
                    const isVisible = h.isVisible !== false;

                    if (!isVisible) {
                      return (
                        <div
                          key={i}
                          className="flex flex-col items-center justify-end flex-1 h-full relative group z-10"
                        >
                          <div className="text-[9px] font-bold text-amber-700 mb-1 flex items-center gap-0.5">
                            <i className="ti ti-lock text-[10px]"></i>
                          </div>
                          <div
                            className="w-full max-w-[36px] rounded-t-lg border-t border-x border-amber-300 bg-amber-50 cursor-pointer relative overflow-hidden group-hover:-translate-y-0.5 transition-transform flex items-center justify-center"
                            style={{ height: "20%" }}
                            title="Result Under Review by Examiner"
                          >
                            <span className="text-[7px] font-black text-amber-700 uppercase">
                              Hold
                            </span>
                          </div>
                          <div className="text-[9px] font-medium text-slate-400 mt-1.5 truncate w-full text-center">
                            {h.testTitle?.slice(0, 8) || "Test"}
                          </div>
                        </div>
                      );
                    }

                    const validScore = h.score || 0;
                    const validTotal = h.totalMarks || 0;
                    const pct = validTotal > 0 ? Math.round((validScore / validTotal) * 100) : 0;
                    const isExcellent = pct >= 75;
                    const isAverage = pct >= 40 && pct < 75;

                    const barColor = isExcellent
                      ? "border-emerald-500 bg-emerald-100"
                      : isAverage
                        ? "border-amber-400 bg-amber-100"
                        : "border-rose-400 bg-rose-100";

                    const textColor = isExcellent
                      ? "text-emerald-700"
                      : isAverage
                        ? "text-amber-700"
                        : "text-rose-700";

                    return (
                      <div
                        key={i}
                        className="flex flex-col items-center justify-end flex-1 h-full relative group z-10"
                      >
                        <div
                          className={`text-[10px] font-bold ${textColor} mb-1 transition-all duration-700 ${
                            animateGraph ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                          }`}
                        >
                          {pct}%
                        </div>
                        <div
                          className={`w-full max-w-[36px] rounded-t-lg border-t-2 border-x ${barColor} cursor-pointer relative overflow-hidden group-hover:-translate-y-0.5 transition-transform`}
                          style={{
                            height: animateGraph ? `${Math.max(pct, 6)}%` : "0%",
                            transition: `height 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.04}s`,
                          }}
                        ></div>
                        <div className="text-[9px] font-medium text-slate-500 mt-1.5 truncate w-full text-center">
                          {h.testTitle?.slice(0, 10) || `Test ${i + 1}`}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Pagination Controls */}
            {totalTests > ITEMS_PER_PAGE && (
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider mt-3 px-1 select-none">
                <button
                  onClick={() => {
                    if (hasOlder) {
                      setTrendPage((p) => p + 1);
                      setAnimateGraph(false);
                      setTimeout(() => setAnimateGraph(true), 50);
                    }
                  }}
                  disabled={!hasOlder}
                  className={`flex items-center gap-1 transition-colors px-2 py-1 rounded-lg ${
                    hasOlder
                      ? "text-blue-600 hover:bg-blue-50 cursor-pointer active:scale-95"
                      : "text-slate-300 cursor-not-allowed"
                  }`}
                >
                  <i className="ti ti-arrow-left"></i> Older
                </button>

                <span className="text-[10px] text-slate-400">
                  Page {trendPage + 1} of {totalTrendPages}
                </span>

                <button
                  onClick={() => {
                    if (hasNewer) {
                      setTrendPage((p) => p - 1);
                      setAnimateGraph(false);
                      setTimeout(() => setAnimateGraph(true), 50);
                    }
                  }}
                  disabled={!hasNewer}
                  className={`flex items-center gap-1 transition-colors px-2 py-1 rounded-lg ${
                    hasNewer
                      ? "text-blue-600 hover:bg-blue-50 cursor-pointer active:scale-95"
                      : "text-slate-300 cursor-not-allowed"
                  }`}
                >
                  Newer <i className="ti ti-arrow-right"></i>
                </button>
              </div>
            )}
          </div>

          {/* Exam Activity Ledger */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4 pb-2.5 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 m-0 tracking-tight">
                  <i className="ti ti-folders text-blue-600 text-base"></i>
                  Recent Exam Ledger
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                  Past test submissions with direct solution links
                </p>
              </div>

              <button
                onClick={() => router.push("/student-results")}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>View Full Ledger</span>
                <i className="ti ti-arrow-right text-xs"></i>
              </button>
            </div>

            {/* PERSONAL BEST ROW (Clean light styling) */}
            {bestTest && (
              <div className="mb-3 p-3 sm:p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center text-base shrink-0">
                    <i className="ti ti-trophy"></i>
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-800">
                      Personal Best Score
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      {bestTest.testTitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-black text-amber-900">
                      {bestTest.score} / {bestTest.totalMarks}
                    </span>
                    <span className="text-[10px] text-amber-700 ml-1.5 font-bold">
                      ({bestTest.totalMarks > 0 ? Math.round((bestTest.score / bestTest.totalMarks) * 100) : 0}%)
                    </span>
                  </div>
                  <button
                    onClick={() => router.push("/student-results")}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Solutions
                  </button>
                </div>
              </div>
            )}

            {/* RECENT TEST ROWS (Compact on mobile) */}
            {recentExams.length > 0 ? (
              <div className="flex flex-col gap-2">
                {recentExams.map((h, idx) => {
                  const isVisible = h.isVisible !== false;
                  const validScore = h.score || 0;
                  const validTotal = h.totalMarks || 0;
                  const pct = validTotal > 0 ? Math.round((validScore / validTotal) * 100) : 0;
                  const badge = getSubjectBadge(h.subject);

                  return (
                    <div
                      key={idx}
                      className="bg-slate-50/60 p-2.5 sm:p-3.5 rounded-xl border border-slate-200/70 hover:border-blue-300 transition-colors flex items-center justify-between gap-3"
                    >
                      {/* Left: Subject Icon + Title */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm border shrink-0 ${badge.bg}`}>
                          <i className={badge.icon}></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-slate-800 truncate leading-tight">
                            {h.testTitle || "Standard Assessment"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                            <span>{h.time?.split(",")[0] || h.time}</span>
                            <span>•</span>
                            <span className="font-mono text-[9px]">#{h.testCode || "TEST"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Score + Solution Action */}
                      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                        {isVisible ? (
                          <>
                            <div className="text-right">
                              <div className="text-xs sm:text-sm font-black text-slate-800 leading-none">
                                {validScore}{" "}
                                <span className="text-[10px] font-normal text-slate-400">
                                  / {validTotal}
                                </span>
                              </div>
                              <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                                {pct}%
                              </div>
                            </div>
                            <button
                              onClick={() => router.push("/student-results")}
                              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-bold text-[10px] sm:text-xs transition-colors cursor-pointer border border-blue-200"
                              title="Review questions and solutions"
                            >
                              Solutions
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                            <i className="ti ti-lock text-[9px] mr-1"></i> In Review
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 px-4 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500 font-medium">No tests taken yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI DIAGNOSTICS & SUBJECT MASTERY (4 Cols on Desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-6 w-full min-w-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3.5 pb-2 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 m-0">
                <i className="ti ti-brain text-amber-500 text-base"></i> Diagnostics
              </h3>
              <select
                value={analysisMode}
                onChange={(e) => setAnalysisMode(e.target.value)}
                className="text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 outline-none cursor-pointer focus:border-amber-400"
              >
                <option value="insights">Smart Insights</option>
                <option value="weakness">Subject Mastery</option>
              </select>
            </div>

            <div className="flex flex-col gap-2.5">
              {analysisMode === "insights" && (
                <>
                  {smartInsights.length > 0 ? (
                    smartInsights.map((insight, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 bg-${insight.color}-50/40 border-${insight.color}-200`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg bg-${insight.color}-100 text-${insight.color}-700 flex items-center justify-center text-sm shrink-0`}
                        >
                          <i className={`ti ${insight.icon}`}></i>
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold text-${insight.color}-900 mb-0.5 leading-tight`}>
                            {insight.title}
                          </h4>
                          <p className="text-[11px] text-slate-600 leading-snug">
                            {insight.desc}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-5 text-slate-400 text-xs font-medium">
                      Complete more exams to unlock tailored learning insights.
                    </div>
                  )}

                  {/* Study strategy tip */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 mt-1">
                    <div className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <i className="ti ti-bulb text-amber-500"></i> Pro Learning Tip
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Analyze every incorrect question in the Detailed Solutions Hub to identify patterns and avoid repeated mistakes.
                    </p>
                  </div>
                </>
              )}

              {analysisMode === "weakness" && (
                <div className="flex flex-col gap-2.5">
                  {Object.keys(weaknessData).length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-5">
                      No subject data available yet.
                    </div>
                  ) : (
                    Object.keys(weaknessData).map((sub, idx) => {
                      const d = weaknessData[sub];
                      const mistakePct =
                        d.attempts > 0
                          ? Math.round((d.mistakes / d.attempts) * 100)
                          : 0;
                      const accuracyPct = 100 - mistakePct;
                      const badge = getSubjectBadge(sub);

                      const barColor =
                        accuracyPct >= 75
                          ? "bg-emerald-500"
                          : accuracyPct >= 50
                            ? "bg-amber-400"
                            : "bg-rose-500";

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200/70"
                        >
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1 truncate">
                              <i className={`${badge.icon} text-slate-400`}></i> {sub}
                            </div>
                            <div className="text-[11px] font-bold text-slate-600">
                              {accuracyPct}% Acc
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${barColor} rounded-full`}
                              style={{ width: `${accuracyPct}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1">
                            <span>{d.attempts} attempts</span>
                            <span className="text-rose-500">{d.mistakes} errors</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
