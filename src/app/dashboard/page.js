// src/app/dashboard/page.js
"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useRouter } from "next/navigation";
import { database } from "../../lib/firebase";
import { ref, get } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

export default function ExaminerDashboard() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const { fetchMyTests, tests } = useData();
  const router = useRouter();

  const [tokens, setTokens] = useState({
    free: 0,
    premium: 0,
    unlimited: false,
  });
  const [followersCount, setFollowersCount] = useState(0);
  const [examinerCode, setExaminerCode] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJoinLink, setCopiedJoinLink] = useState(null);
  const [copiedRescueLink, setCopiedRescueLink] = useState(null);
  const [filterTab, setFilterTab] = useState("all"); // 'all', 'live', 'scheduled'

  // Calendar States
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarScrollRef = useRef(null);

  // Security Bouncer
  useEffect(() => {
    if (
      !authLoading &&
      (!currentUser || (userRole !== "examiner" && userRole !== "admin"))
    ) {
      router.replace("/");
    }
  }, [currentUser, userRole, authLoading, router]);

  // Fetch Data (Tokens, Followers & Tests)
  useEffect(() => {
    if (currentUser) {
      get(ref(database, `users/${currentUser.uid}`)).then((snap) => {
        if (snap.exists()) {
          const data = snap.val();
          setTokens({
            free:
              data.free_tokens !== undefined
                ? data.free_tokens
                : Math.min(3, data.available_quota || 0),
            premium: data.premium_tokens || 0,
            unlimited: data.is_unlimited || data.plan === "unlimited",
          });

          setFollowersCount(data.followerCount || 0);
          setExaminerCode(
            data.examinerId || data.rollNo || data.examinerCode || ""
          );
        }
      });

      fetchMyTests(currentUser.uid).finally(() => setIsFetching(false));
    }
  }, [currentUser]);

  // Auto-scroll calendar on month change
  useEffect(() => {
    if (calendarScrollRef.current) {
      const activeEl = calendarScrollRef.current.querySelector(".is-active-day");
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }
  }, [currentMonthDate]);

  const jumpToTestVault = (testId) => {
    sessionStorage.setItem("examitop_activeTestId", testId);
    router.push("/tests");
  };

  const handleCopyCode = () => {
    if (!examinerCode) return;
    navigator.clipboard.writeText(examinerCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyJoinLink = (e, testCode, testId) => {
    if (e) e.stopPropagation();
    if (!testCode) return;
    const link =
      typeof window !== "undefined"
        ? `${window.location.origin}/student?code=${testCode}`
        : `https://examitop.com/student?code=${testCode}`;
    navigator.clipboard.writeText(link);
    setCopiedJoinLink(testId || testCode);
    setTimeout(() => setCopiedJoinLink(null), 2000);
  };

  const handleCopyRescueLink = (e, testCode, testId) => {
    if (e) e.stopPropagation();
    const link =
      typeof window !== "undefined"
        ? testCode
          ? `${window.location.origin}/student?code=${testCode}&rescue=true`
          : `${window.location.origin}/student?rescue=true`
        : `https://examitop.com/student?rescue=true`;
    navigator.clipboard.writeText(link);
    setCopiedRescueLink(testId || testCode || "universal");
    setTimeout(() => setCopiedRescueLink(null), 2500);
  };

  // Dynamic Greeting based on time of day
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // --- DATA CALCULATIONS ---
  const now = Date.now();
  const validTests = tests.filter((t) => !t.isDeletedByExaminer);

  const getExamStatus = (t) => {
    const openTime = t.openDate ? new Date(t.openDate).getTime() : null;
    const closeTime = t.closeDate
      ? new Date(t.closeDate).getTime()
      : t.expiryDate
      ? new Date(t.expiryDate).getTime()
      : null;

    if (openTime && now < openTime) return "upcoming";
    if (t.isActive === false || (closeTime && now > closeTime)) return "closed";
    return "live";
  };

  const scheduledExams = validTests
    .filter((t) => t.openDate && new Date(t.openDate).getTime() > now)
    .sort((a, b) => new Date(a.openDate) - new Date(b.openDate));

  const activeExams = validTests.filter((t) => getExamStatus(t) === "live");
  const activeExamsCount = activeExams.length;

  const totalSubmissions = validTests.reduce((acc, t) => {
    const count =
      t.submissionCount ||
      (t.submissions
        ? Array.isArray(t.submissions)
          ? t.submissions.filter(Boolean).length
          : Object.keys(t.submissions).length
        : 0);
    return acc + count;
  }, 0);

  const totalQuestions = validTests.reduce(
    (acc, t) => acc + (t.questionCount || t.questions?.length || 0),
    0
  );

  const pendingEvaluations = validTests.filter(
    (t) =>
      t.resultVis === "manual" &&
      !t.released &&
      (t.submissionCount > 0 || (t.submissions && t.submissions.length > 0))
  );

  // Filtered assessments list
  const filteredAssessments = validTests.filter((t) => {
    const st = getExamStatus(t);
    if (filterTab === "live") return st === "live";
    if (filterTab === "scheduled") return st === "upcoming";
    return true;
  });

  // EXACTLY TOP 3 RECENT TESTS (User explicit requirement)
  const recentAssessments = useMemo(() => {
    return [...filteredAssessments]
      .sort((a, b) => b.id - a.id)
      .slice(0, 3);
  }, [filteredAssessments]);

  // Exams currently broadcasting live on student radar
  const radarExams = useMemo(() => {
    return validTests.filter((t) => {
      if (t.radarVisible !== true && t.radarVisible !== "true") return false;
      const testExpiry = t.closeDate || t.expiryDate;
      if (testExpiry) {
        const expiryTime = new Date(testExpiry).getTime();
        if (!isNaN(expiryTime) && now - expiryTime > 18 * 60 * 60 * 1000) {
          return false;
        }
      }
      return true;
    });
  }, [validTests, now]);

  // Subject Stats
  const subCounts = {};
  validTests.forEach((t) => {
    const s = t.subject || "General";
    subCounts[s] = (subCounts[s] || 0) + 1;
  });
  const topSubjects = Object.entries(subCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Subject Badge Helper
  const getSubjectBadge = (subject) => {
    const s = (subject || "").toLowerCase();
    if (s.includes("phys")) {
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200/80",
        badgeBg: "bg-blue-500",
        gradient: "from-blue-500 to-cyan-500",
        icon: "ti ti-atom-2",
        label: subject || "Physics",
      };
    }
    if (s.includes("chem")) {
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        badgeBg: "bg-emerald-500",
        gradient: "from-emerald-500 to-teal-500",
        icon: "ti ti-flask",
        label: subject || "Chemistry",
      };
    }
    if (s.includes("math")) {
      return {
        bg: "bg-purple-50 text-purple-700 border-purple-200/80",
        badgeBg: "bg-purple-500",
        gradient: "from-purple-500 to-indigo-500",
        icon: "ti ti-math-symbols",
        label: subject || "Mathematics",
      };
    }
    if (s.includes("bio")) {
      return {
        bg: "bg-teal-50 text-teal-700 border-teal-200/80",
        badgeBg: "bg-teal-500",
        gradient: "from-teal-500 to-emerald-500",
        icon: "ti ti-dna",
        label: subject || "Biology",
      };
    }
    if (
      s.includes("java") ||
      s.includes("network") ||
      s.includes("code") ||
      s.includes("comp") ||
      s.includes("tech")
    ) {
      return {
        bg: "bg-sky-50 text-sky-700 border-sky-200/80",
        badgeBg: "bg-sky-500",
        gradient: "from-sky-500 to-blue-600",
        icon: "ti ti-terminal-2",
        label: subject || "Technology",
      };
    }
    return {
      bg: "bg-slate-50 text-slate-700 border-slate-200/80",
      badgeBg: "bg-slate-500",
      gradient: "from-slate-500 to-slate-700",
      icon: "ti ti-book",
      label: subject || "General",
    };
  };

  // --- CALENDAR LOGIC ---
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  };
  const monthDays = getDaysInMonth(currentMonthDate);
  const examDatesStrings = scheduledExams.map((t) =>
    new Date(t.openDate).toDateString()
  );

  const prevMonth = () =>
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
    );
  const nextMonth = () =>
    setCurrentMonthDate(
      new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
    );

  const examsOnSelectedDate = scheduledExams.filter(
    (t) => new Date(t.openDate).toDateString() === selectedDate.toDateString()
  );

  // SKELETON LOADER
  if (authLoading || isFetching) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-8 animate-pulse space-y-4 sm:space-y-6">
        <div className="w-full h-32 sm:h-36 bg-slate-100 rounded-2xl sm:rounded-3xl"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 sm:h-36 bg-slate-100 rounded-2xl sm:rounded-3xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-8 h-80 sm:h-96 bg-slate-100 rounded-2xl sm:rounded-3xl"></div>
          <div className="lg:col-span-4 h-80 sm:h-96 bg-slate-100 rounded-2xl sm:rounded-3xl"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 py-3 sm:py-6 space-y-4 sm:space-y-6"
    >
      {/* 🧭 1. EXECUTIVE COMMAND DECK (Hero Header with Ambient Glow & Badges) */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]"
      >
        {/* Subtle Decorative Background Mesh */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 sm:w-96 h-64 sm:h-96 bg-gradient-to-br from-blue-400/10 via-indigo-400/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sm:gap-6">
          {/* Left: Greeting & Educator Identity */}
          <div className="flex items-start sm:items-center gap-3 sm:gap-5 min-w-0">
            <div className="relative group shrink-0">
              <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center text-lg sm:text-2xl font-black shadow-md sm:shadow-lg shadow-blue-500/25 ring-2 sm:ring-4 ring-white shrink-0">
                {currentUser?.displayName
                  ? currentUser.displayName[0].toUpperCase()
                  : "E"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-0.5 sm:mb-1">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  {greetingText},{" "}
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {currentUser?.displayName?.split(" ")[0] || "Educator"}
                  </span>
                  ! 👋
                </h1>
                <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/80 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                  HQ
                </span>
              </div>
              <p className="text-[11px] sm:text-xs lg:text-sm text-slate-500 font-medium max-w-2xl line-clamp-2 sm:line-clamp-none">
                Real-time assessment command center. Broadcast live exams to student radars, monitor test telemetry, and review grading insights.
              </p>

              {/* Status & Code Chips */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 mt-2 sm:mt-3 flex-wrap">
                {examinerCode && (
                  <button
                    onClick={handleCopyCode}
                    className="group relative inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-mono font-bold bg-slate-900 text-white hover:bg-blue-600 transition-all shadow-xs active:scale-95 cursor-pointer"
                    title="Click to copy your unique Educator Code for students"
                  >
                    <span className="text-blue-400 group-hover:text-blue-200">#</span>
                    <span>{examinerCode}</span>
                    <i
                      className={`ti ${
                        copiedCode ? "ti-check text-emerald-400" : "ti-copy text-slate-400 group-hover:text-white"
                      } text-xs transition-colors`}
                    ></i>
                    {copiedCode && (
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-sans font-bold rounded shadow-md pointer-events-none animate-bounce">
                        Copied!
                      </span>
                    )}
                  </button>
                )}

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                  </span>
                  <span>{followersCount} Students on Radar</span>
                </span>

                {radarExams.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{radarExams.length} Live on Radar</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                  <i className="ti ti-bolt text-amber-500 text-xs sm:text-sm"></i>
                  <span>
                    {tokens.unlimited
                      ? "Unlimited Plan ∞"
                      : `${tokens.free + tokens.premium} Tokens Left`}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Direct High-Priority Actions (Responsive Grid on Mobile) */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 w-full xl:w-auto xl:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
            <button
              onClick={() => router.push("/create")}
              className="col-span-2 sm:col-span-1 relative inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-500/25 group"
            >
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
                <i className="ti ti-plus text-xs"></i>
              </div>
              <span>Create New Exam</span>
            </button>

            <button
              onClick={() => router.push("/tests")}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <i className="ti ti-folders text-sm sm:text-base text-slate-500"></i>
              <span>Vault</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-slate-200 text-slate-700">
                {validTests.length}
              </span>
            </button>

            <button
              onClick={(e) => handleCopyRescueLink(e, null, "universal")}
              className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Copy Emergency Auto-Rescue link for any student with stuck or unsubmitted exam"
            >
              <i
                className={`ti ${
                  copiedRescueLink === "universal"
                    ? "ti-check text-emerald-600 font-black"
                    : "ti-lifebuoy text-amber-600"
                } text-sm sm:text-base`}
              ></i>
              <span>
                {copiedRescueLink === "universal"
                  ? "Rescue Link Copied!"
                  : "Auto-Rescue Link"}
              </span>
            </button>

            <button
              onClick={() => router.push("/results")}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/90 transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <i className="ti ti-trophy text-sm sm:text-base text-amber-500"></i>
              <span>Ranks</span>
            </button>

            <button
              onClick={() => router.push("/pricing")}
              className="hidden sm:inline-flex items-center justify-center p-3 rounded-2xl text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200/80 transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Manage Subscription & Tokens"
            >
              <i className="ti ti-credit-card text-base sm:text-lg"></i>
            </button>
          </div>
        </div>
      </motion.div>

      {/* ⚠️ 2. CONDITIONAL SMART ALERT DECK (Manual grading queue or low tokens) */}
      <AnimatePresence>
        {(pendingEvaluations.length > 0 ||
          (!tokens.unlimited && tokens.free + tokens.premium <= 3)) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] sm:text-[11px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  Action Recommended
                </span>
                <span className="text-[10px] sm:text-[11px] text-amber-700 font-semibold truncate">
                  Items requiring attention
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                {pendingEvaluations.length > 0 && (
                  <div className="flex items-center justify-between bg-white/90 backdrop-blur-xs p-2.5 sm:p-3 rounded-xl border border-amber-200/80 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <i className="ti ti-edit text-sm sm:text-base"></i>
                      </div>
                      <span className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">
                        {pendingEvaluations.length} Manual Assessment(s) awaiting score
                      </span>
                    </div>
                    <button
                      onClick={() => router.push("/tests")}
                      className="text-[11px] sm:text-xs font-black text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer"
                    >
                      Grade →
                    </button>
                  </div>
                )}
                {!tokens.unlimited && tokens.free + tokens.premium <= 3 && (
                  <div className="flex items-center justify-between bg-white/90 backdrop-blur-xs p-2.5 sm:p-3 rounded-xl border border-rose-200/80 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <i className="ti ti-wallet text-sm sm:text-base"></i>
                      </div>
                      <span className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">
                        Only {tokens.free + tokens.premium} Token(s) left
                      </span>
                    </div>
                    <button
                      onClick={() => router.push("/pricing")}
                      className="text-[11px] sm:text-xs font-black text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer"
                    >
                      Top Up →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 📊 3. GRAPHICAL BENTO METRICS (2x2 Grid on Mobile, 4 Columns on Large Screens) */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5"
      >
        {/* Metric 1: Assessments Vault & Live Velocity */}
        <div className="relative overflow-hidden bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
            <div>
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                Assessments
              </span>
              <div className="text-xl sm:text-3xl font-black text-slate-900 mt-0.5 tracking-tight">
                {validTests.length}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm sm:text-xl shrink-0">
              <i className="ti ti-folders"></i>
            </div>
          </div>

          {/* Inline SVG Activity Wave Graphic */}
          <div className="my-1 sm:my-2 py-0.5">
            <svg
              className="w-full h-6 sm:h-9 stroke-blue-500 fill-blue-500/10"
              viewBox="0 0 100 25"
              preserveAspectRatio="none"
            >
              <path
                d="M0,20 Q15,5 30,15 T60,8 T85,18 T100,5 L100,25 L0,25 Z"
                strokeWidth="0"
              />
              <path
                d="M0,20 Q15,5 30,15 T60,8 T85,18 T100,5"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-xs">
            <div className="flex items-center gap-1 font-bold text-emerald-600 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate">{activeExamsCount} Live</span>
            </div>
            <button
              onClick={() => router.push("/tests")}
              className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer shrink-0"
            >
              Vault →
            </button>
          </div>
        </div>

        {/* Metric 2: Verified Student Submissions */}
        <div className="relative overflow-hidden bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
            <div>
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                Responses
              </span>
              <div className="text-xl sm:text-3xl font-black text-slate-900 mt-0.5 tracking-tight">
                {totalSubmissions}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm sm:text-xl shrink-0">
              <i className="ti ti-users-group"></i>
            </div>
          </div>

          {/* Visual Progress / Sync Strip */}
          <div className="my-1 sm:my-2 py-0.5 space-y-1">
            <div className="flex items-center justify-between text-[9px] sm:text-[11px] font-semibold text-slate-500">
              <span>Auto-Graded</span>
              <span className="font-mono text-emerald-600 font-bold">100%</span>
            </div>
            <div className="w-full h-1.5 sm:h-2 bg-emerald-100/70 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full w-full"></div>
            </div>
          </div>

          <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-slate-500 font-medium truncate flex items-center gap-1">
              <i className="ti ti-circle-check text-emerald-500 text-xs"></i>
              <span className="truncate">Live Sync</span>
            </span>
            <button
              onClick={() => router.push("/tests")}
              className="font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer shrink-0"
            >
              Analyze →
            </button>
          </div>
        </div>

        {/* Metric 3: Token Quota & AI Balance */}
        <div className="relative overflow-hidden bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:border-amber-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
            <div>
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                Exam Quota
              </span>
              <div className="text-xl sm:text-3xl font-black text-slate-900 mt-0.5 tracking-tight truncate">
                {tokens.unlimited ? "Unlimited ∞" : tokens.free + tokens.premium}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm sm:text-xl shrink-0">
              <i className="ti ti-bolt"></i>
            </div>
          </div>

          {/* Visual Battery Meter */}
          <div className="my-1 sm:my-2 py-0.5">
            <div className="flex items-center gap-0.5 sm:gap-1">
              {[1, 2, 3, 4, 5, 6].map((bar) => {
                const isUnlimited = tokens.unlimited;
                const total = tokens.free + tokens.premium;
                const isFilled = isUnlimited || total >= bar * 2;
                return (
                  <div
                    key={bar}
                    className={`h-1.5 sm:h-2 flex-1 rounded-xs sm:rounded-sm transition-all ${
                      isFilled
                        ? "bg-gradient-to-r from-amber-400 to-amber-500"
                        : "bg-slate-100"
                    }`}
                  ></div>
                );
              })}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1 flex justify-between">
              <span>{tokens.unlimited ? "Pro Plan" : `Bal: ${tokens.free + tokens.premium}`}</span>
              <span className="font-bold text-amber-700">Tier 1</span>
            </div>
          </div>

          <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-xs">
            <span className="text-slate-400 font-medium truncate">AI Quota</span>
            <button
              onClick={() => router.push("/pricing")}
              className="font-bold text-amber-700 hover:text-amber-900 cursor-pointer shrink-0"
            >
              Plan →
            </button>
          </div>
        </div>

        {/* Metric 4: Classroom Radar Broadcast Audience */}
        <div className="relative overflow-hidden bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] hover:border-indigo-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
            <div>
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                Radar Reach
              </span>
              <div className="text-xl sm:text-3xl font-black text-slate-900 mt-0.5 tracking-tight">
                {followersCount}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm sm:text-xl shrink-0">
              <i className="ti ti-radar"></i>
            </div>
          </div>

          {/* Inline SVG Concentric Radar Wave Graphic */}
          <div className="my-1 sm:my-2 py-0.5 flex items-center justify-center">
            <div className="relative w-full h-6 sm:h-8 flex items-center justify-center overflow-hidden">
              <span className="absolute w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-indigo-300/60 animate-ping"></span>
              <span className="absolute w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-indigo-200/80"></span>
              <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-indigo-600 shadow-xs"></span>
            </div>
          </div>

          <div className="pt-2 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] sm:text-xs">
            {radarExams.length > 0 ? (
              <span className="font-bold text-emerald-600 flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{radarExams.length} On Air</span>
              </span>
            ) : (
              <span className="text-slate-400 font-medium truncate">Idle</span>
            )}
            <button
              onClick={handleCopyCode}
              className="font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer shrink-0"
            >
              {copiedCode ? "Copied! ✓" : "Copy EXT"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* 🚀 4. MAIN TWO-COLUMN DECK (8 Cols Left / 4 Cols Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* LEFT COLUMN: ACTIVE RADAR BROADCAST (IF ANY) + TOP 3 RECENT ASSESSMENTS */}
        <motion.div variants={itemVariants} className="lg:col-span-8 space-y-4 sm:space-y-6">
          {/* 📡 DEDICATED LIVE RADAR BROADCAST DECK (Theme-Aligned Pristine White UI with Animated Radar Scope) */}
          <AnimatePresence>
            {radarExams.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="relative overflow-hidden bg-white border border-indigo-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-[0_4px_25px_-4px_rgba(79,70,229,0.08)]"
              >
                {/* Luminous Ambient Background Gradient & Animated Radar Scope SVG Graphic */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-100/40 via-blue-50/20 to-transparent rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-36 h-36 sm:w-44 sm:h-44 pointer-events-none opacity-25">
                  <svg viewBox="0 0 160 160" className="w-full h-full text-indigo-600">
                    <circle cx="80" cy="80" r="30" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
                    <circle cx="80" cy="80" r="55" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 4" />
                    <circle cx="80" cy="80" r="75" fill="none" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="5" y1="80" x2="155" y2="80" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                    <line x1="80" y1="5" x2="80" y2="155" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                    <circle cx="80" cy="80" r="4" fill="currentColor" />
                    <circle cx="110" cy="50" r="3" fill="#10b981" className="animate-ping" />
                    <circle cx="110" cy="50" r="2.5" fill="#10b981" />
                  </svg>
                </div>

                {/* Broadcast Channel Header */}
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-3.5 sm:mb-4 pb-3 sm:pb-3.5 border-b border-indigo-100">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center text-base sm:text-lg shadow-sm shadow-indigo-500/25 shrink-0">
                      <i className="ti ti-broadcast"></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-base font-black text-slate-900 tracking-tight m-0">
                          Classroom Radar Broadcast
                        </h4>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          On Air
                        </span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0 mt-0.5">
                        Streaming in real-time to student radar feeds
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold bg-indigo-50/80 text-indigo-700 border border-indigo-200/80 self-start sm:self-auto">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <span>{followersCount} Student Radars</span>
                  </div>
                </div>

                {/* Radar Broadcast List (Theme-Aligned Pristine Cards) */}
                <div className="relative z-10 space-y-2.5 sm:space-y-3">
                  {radarExams.map((t) => {
                    const badge = getSubjectBadge(t.subject);
                    const subCnt =
                      t.submissionCount ||
                      (t.submissions
                        ? Array.isArray(t.submissions)
                          ? t.submissions.filter(Boolean).length
                          : Object.keys(t.submissions).length
                        : 0);

                    return (
                      <div
                        key={`radar-${t.id}`}
                        className="bg-slate-50/70 hover:bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4.5 border border-slate-200/90 hover:border-indigo-400/80 transition-all shadow-2xs hover:shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 group"
                      >
                        <div className="flex items-start gap-3 sm:gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-xl border shrink-0 ${badge.bg} shadow-2xs`}
                          >
                            <i className={badge.icon}></i>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
                              <span className="text-xs sm:text-base font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                {t.title}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                {t.subject || "General"}
                              </span>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live
                              </span>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-semibold text-slate-500 flex-wrap">
                              <span className="font-mono text-[10px] sm:text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">
                                #{t.code}
                              </span>
                              <span>•</span>
                              <span>{t.duration || 60} mins</span>
                              <span>•</span>
                              <span>{t.totalMarks || 100} marks</span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-200/60">
                                <i className="ti ti-user-check text-xs"></i>
                                {subCnt} Submissions
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => handleCopyJoinLink(e, t.code, t.id)}
                            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            title="Copy direct join link for students"
                          >
                            <i
                              className={`ti ${
                                copiedJoinLink === (t.id || t.code)
                                  ? "ti-check text-emerald-600 font-black"
                                  : "ti-link text-blue-600"
                              } text-xs`}
                            ></i>
                            <span>
                              {copiedJoinLink === (t.id || t.code)
                                ? "Copied!"
                                : "Copy Link"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleCopyRescueLink(e, t.code, t.id)}
                            className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200/80 shadow-2xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            title="Copy Emergency Auto-Submit / Rescue link for stuck submissions"
                          >
                            <i
                              className={`ti ${
                                copiedRescueLink === (t.id || t.code)
                                  ? "ti-check text-emerald-600 font-black"
                                  : "ti-lifebuoy text-amber-600"
                              } text-xs`}
                            ></i>
                            <span>
                              {copiedRescueLink === (t.id || t.code)
                                ? "Rescue Copied!"
                                : "Rescue Link"}
                            </span>
                          </button>

                          <button
                            onClick={() => jumpToTestVault(t.id)}
                            className="w-full sm:w-auto px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-500/25 group/btn"
                          >
                            <i className="ti ti-activity text-xs sm:text-sm"></i>
                            <span>Monitor Live Intake</span>
                            <i className="ti ti-arrow-right text-xs group-hover/btn:translate-x-0.5 transition-transform"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Assessments Showcase */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
            {/* Header & Responsive Filter Pills */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm sm:text-base">
                    <i className="ti ti-sparkles"></i>
                  </div>
                  <h3 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight m-0">
                    Recent Assessments
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 sm:mt-1">
                  Top 3 most recent exams with live telemetry and quick controls.
                </p>
              </div>

              {/* Status Filter Tabs (Scrollable on small mobile) */}
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-bold w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setFilterTab("all")}
                  className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl transition-all cursor-pointer whitespace-nowrap text-center ${
                    filterTab === "all"
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  All ({validTests.length})
                </button>
                <button
                  onClick={() => setFilterTab("live")}
                  className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                    filterTab === "live"
                      ? "bg-white text-emerald-700 shadow-2xs font-extrabold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live ({activeExamsCount})
                </button>
                <button
                  onClick={() => setFilterTab("scheduled")}
                  className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
                    filterTab === "scheduled"
                      ? "bg-white text-amber-700 shadow-2xs font-extrabold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <i className="ti ti-clock text-xs text-amber-500"></i>
                  Scheduled ({scheduledExams.length})
                </button>
              </div>
            </div>

            {/* Assessment Cards (EXACTLY 3 Recent Tests) */}
            {recentAssessments.length === 0 ? (
              <div className="text-center py-8 sm:py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl sm:rounded-2xl bg-slate-50/50">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white shadow-xs text-slate-400 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2.5 sm:mb-3 text-xl sm:text-2xl border border-slate-200">
                  <i className="ti ti-notes"></i>
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-800 mb-1">
                  No Assessments in this view
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  {filterTab !== "all"
                    ? `No exams matching the "${filterTab}" criteria.`
                    : "You haven't created any exams yet. Start by generating your first test."}
                </p>
                <button
                  onClick={() => router.push("/create")}
                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20"
                >
                  + Create First Exam
                </button>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {recentAssessments.map((t, idx) => {
                  const status = getExamStatus(t);
                  const badge = getSubjectBadge(t.subject);
                  const isLive = status === "live";
                  const isOnRadar = Boolean(t.radarVisible);
                  const subCnt =
                    t.submissionCount ||
                    (t.submissions
                      ? Array.isArray(t.submissions)
                        ? t.submissions.filter(Boolean).length
                        : Object.keys(t.submissions).length
                      : 0);

                  // Strict Rule: ONLY Live & Radar get sleek accents. Normal cards stay pure clean white!
                  let cardBorder = "border-slate-200/90 hover:border-slate-300";
                  let leftAccent = "";

                  if (isLive && isOnRadar) {
                    cardBorder = "border-indigo-300 hover:border-indigo-400";
                    leftAccent = "bg-gradient-to-b from-emerald-500 to-indigo-500";
                  } else if (isLive) {
                    cardBorder = "border-emerald-300 hover:border-emerald-400";
                    leftAccent = "bg-emerald-500";
                  } else if (isOnRadar) {
                    cardBorder = "border-indigo-300 hover:border-indigo-400";
                    leftAccent = "bg-indigo-500";
                  }

                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => jumpToTestVault(t.id)}
                      className={`group relative bg-white rounded-2xl border ${cardBorder} p-3.5 sm:p-5 transition-all shadow-2xs hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 cursor-pointer overflow-hidden`}
                    >
                      {/* Sleek 3.5px Left State Accent (ONLY for Live or Radar) */}
                      {leftAccent && (
                        <div
                          className={`absolute left-0 top-3 bottom-3 w-[3.5px] rounded-r-full ${leftAccent}`}
                        ></div>
                      )}

                      {/* Left Side: Subject Graphic & Metadata */}
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1 pl-0.5">
                        <div
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-xl border shrink-0 ${badge.bg} shadow-2xs group-hover:scale-105 transition-transform`}
                        >
                          <i className={badge.icon}></i>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-sm sm:text-base font-black text-slate-800 truncate group-hover:text-blue-600 transition-colors leading-tight">
                              {t.title}
                            </span>

                            {isLive && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live
                              </span>
                            )}
                            {isOnRadar && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <i className="ti ti-radar text-xs"></i>
                                Radar
                              </span>
                            )}
                            {status === "upcoming" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                <i className="ti ti-clock text-xs"></i>
                                Scheduled
                              </span>
                            )}
                            {status === "closed" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                <i className="ti ti-lock text-xs"></i> Closed
                              </span>
                            )}
                          </div>

                          {/* Metadata Ribbon */}
                          <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold text-slate-500 flex-wrap">
                            <span className="font-mono text-[10px] sm:text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-bold">
                              #{t.code}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-medium truncate max-w-[130px]">
                              {t.subject || "General"}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="flex items-center gap-1 text-slate-500 font-medium">
                              <i className="ti ti-clock text-slate-400"></i>
                              {t.duration || 60}m
                            </span>
                            <span className="text-slate-300 hidden sm:inline">
                              •
                            </span>
                            <span className="hidden sm:inline-flex items-center gap-1 text-slate-500 font-medium">
                              <i className="ti ti-list-numbers text-slate-400"></i>
                              {t.questionCount || t.questions?.length || 0} Qs
                            </span>
                            <span className="text-slate-300 hidden sm:inline">
                              •
                            </span>
                            <span className="hidden sm:inline-flex items-center gap-1 text-slate-500 font-medium">
                              <i className="ti ti-target text-slate-400"></i>
                              {t.totalMarks || 100} Marks
                            </span>
                            <span className="text-slate-300">•</span>
                            <span
                              className={`inline-flex items-center gap-1 font-bold ${
                                subCnt > 0
                                  ? "text-emerald-600 font-extrabold"
                                  : "text-slate-400"
                              }`}
                            >
                              <i className="ti ti-users"></i>
                              {subCnt} Subs
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Quick Action Buttons */}
                      <div className="flex items-center gap-2 justify-end border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-100 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => handleCopyJoinLink(e, t.code, t.id)}
                          className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-xs border border-slate-200 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Copy direct join link for students"
                        >
                          <i
                            className={`ti ${
                              copiedJoinLink === (t.id || t.code)
                                ? "ti-check text-emerald-600 font-black"
                                : "ti-link text-slate-400 group-hover:text-blue-600"
                            } text-xs`}
                          ></i>
                          <span>
                            {copiedJoinLink === (t.id || t.code)
                              ? "Copied!"
                              : "Copy Link"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleCopyRescueLink(e, t.code, t.id)}
                          className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200/80 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Copy Emergency Auto-Submit / Rescue Link for stuck exams"
                        >
                          <i
                            className={`ti ${
                              copiedRescueLink === (t.id || t.code)
                                ? "ti-check text-emerald-600 font-black"
                                : "ti-lifebuoy text-amber-600"
                            } text-xs`}
                          ></i>
                          <span>
                            {copiedRescueLink === (t.id || t.code)
                              ? "Rescue Copied!"
                              : "Rescue Link"}
                          </span>
                        </button>

                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            jumpToTestVault(t.id);
                          }}
                          className="w-full sm:w-auto px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-2xs group/btn"
                        >
                          <span>Manage</span>
                          <i className="ti ti-arrow-right text-xs group-hover/btn:translate-x-1 transition-transform"></i>
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Card Footer: Summary & Vault Link */}
            <div className="pt-3 sm:pt-4 mt-4 sm:mt-5 border-t border-slate-100 flex items-center justify-between text-[11px] sm:text-xs">
              <span className="text-slate-400 font-medium truncate mr-2">
                Top {recentAssessments.length} of {validTests.length} tests in vault
              </span>
              <button
                onClick={() => router.push("/tests")}
                className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <span>Full Vault</span>
                <i className="ti ti-arrow-right text-xs"></i>
              </button>
            </div>
          </div>

          {/* Quick Creator Utility Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
            <div
              onClick={() => router.push("/create")}
              className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-200/80 hover:border-blue-400 transition-all cursor-pointer shadow-2xs group"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-blue-600 text-white flex items-center justify-center text-base sm:text-lg mb-1.5 sm:mb-2 group-hover:scale-105 transition-transform shadow-2xs">
                <i className="ti ti-sparkles"></i>
              </div>
              <h5 className="text-xs font-black text-slate-800 mb-0.5">
                AI Test Generator
              </h5>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0">
                Craft questions from syllabus in seconds
              </p>
            </div>

            <div
              onClick={() => router.push("/tests")}
              className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/80 hover:border-emerald-400 transition-all cursor-pointer shadow-2xs group"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-600 text-white flex items-center justify-center text-base sm:text-lg mb-1.5 sm:mb-2 group-hover:scale-105 transition-transform shadow-2xs">
                <i className="ti ti-radar"></i>
              </div>
              <h5 className="text-xs font-black text-slate-800 mb-0.5">
                Classroom Broadcast
              </h5>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0">
                Send active tests live onto student radars
              </p>
            </div>

            <div
              onClick={() => router.push("/results")}
              className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 hover:border-amber-400 transition-all cursor-pointer shadow-2xs group"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-600 text-white flex items-center justify-center text-base sm:text-lg mb-1.5 sm:mb-2 group-hover:scale-105 transition-transform shadow-2xs">
                <i className="ti ti-report-analytics"></i>
              </div>
              <h5 className="text-xs font-black text-slate-800 mb-0.5">
                Cohort Leaderboard
              </h5>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0">
                Analyze rankings, percentiles & toppers
              </p>
            </div>
          </div>
        </motion.div>

        {/* RIGHT COLUMN: CALENDAR & SUBJECT ANALYTICS MATRIX (4 Cols) */}
        <motion.div variants={itemVariants} className="lg:col-span-4 space-y-4 sm:space-y-6">
          {/* Calendar & Schedule Hub */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
            <div className="flex justify-between items-center mb-2.5 sm:mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs sm:text-sm">
                  <i className="ti ti-calendar-event"></i>
                </div>
                <span className="text-[11px] sm:text-xs font-black text-slate-800 uppercase tracking-wider">
                  {currentMonthDate.toLocaleString("default", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={prevMonth}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                  title="Previous month"
                >
                  <i className="ti ti-chevron-left text-xs"></i>
                </button>
                <button
                  onClick={nextMonth}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
                  title="Next month"
                >
                  <i className="ti ti-chevron-right text-xs"></i>
                </button>
              </div>
            </div>

            {/* Horizontal Day Strips with Exam Indicators */}
            <div
              ref={calendarScrollRef}
              className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-2 snap-x mb-2.5 sm:mb-3"
            >
              {monthDays
                .slice(
                  Math.max(0, currentMonthDate.getDate() - 4),
                  currentMonthDate.getDate() + 10
                )
                .map((date, idx) => {
                  const isSelected =
                    date.toDateString() === selectedDate.toDateString();
                  const hasExam = examDatesStrings.includes(date.toDateString());
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(date)}
                      className={`shrink-0 w-10 sm:w-11 h-13 sm:h-14 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all snap-center ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                      }`}
                    >
                      <span
                        className={`text-[8px] sm:text-[9px] font-bold uppercase ${
                          isSelected ? "text-blue-100" : "text-slate-400"
                        }`}
                      >
                        {date
                          .toLocaleDateString("en-IN", { weekday: "short" })
                          .charAt(0)}
                      </span>
                      <span className="text-xs sm:text-sm font-black leading-tight mt-0.5">
                        {date.getDate()}
                      </span>
                      {hasExam && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full mt-1 ${
                            isSelected ? "bg-white" : "bg-emerald-500"
                          }`}
                        ></div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Schedule on Selected Day */}
            <div>
              <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>
                  Schedule on{" "}
                  {selectedDate.toDateString() === new Date().toDateString()
                    ? "Today"
                    : selectedDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                </span>
                <span className="text-blue-600 font-bold">
                  {examsOnSelectedDate.length} Test(s)
                </span>
              </div>

              {examsOnSelectedDate.length === 0 ? (
                <div className="py-3 sm:py-4 px-3 text-center bg-slate-50/70 rounded-xl sm:rounded-2xl border border-dashed border-slate-200">
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium m-0">
                    No assessments scheduled on this date.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {examsOnSelectedDate.map((t) => {
                    const dateObj = new Date(t.openDate);
                    return (
                      <div
                        key={t.id}
                        onClick={() => jumpToTestVault(t.id)}
                        className="p-2.5 sm:p-3 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/80 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between gap-2 group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-700">
                            {t.title}
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 mt-0.5">
                            <span className="text-blue-600 font-bold">
                              {dateObj.toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span>•</span>
                            <span className="font-mono">#{t.code}</span>
                          </div>
                        </div>
                        <i className="ti ti-arrow-right text-xs text-slate-400 group-hover:text-blue-600 transition-colors shrink-0"></i>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Subject Distribution Matrix */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
            <h4 className="text-[11px] sm:text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <i className="ti ti-chart-pie text-blue-600 text-sm"></i>
              Subject Distribution Matrix
            </h4>

            {topSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                No subjects recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5 sm:space-y-3">
                {topSubjects.map(([subj, count]) => {
                  const pct =
                    validTests.length > 0
                      ? Math.round((count / validTests.length) * 100)
                      : 0;
                  const badge = getSubjectBadge(subj);

                  return (
                    <div key={subj} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <i className={`${badge.icon} text-slate-400 text-xs`}></i>
                          {subj}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${badge.gradient} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* 5. MOBILE FLOATING ACTION HUB (FAB) */}
      {isFabOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-xs transition-opacity"
          onClick={() => setIsFabOpen(false)}
        ></div>
      )}

      <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2.5">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 10 }}
              className="bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 flex flex-col min-w-[210px]"
            >
              <div className="px-3 pt-2 pb-1 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                Quick Actions
              </div>
              <button
                onClick={() => {
                  setIsFabOpen(false);
                  router.push("/create");
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-xl text-xs font-bold transition-colors text-left"
              >
                <i className="ti ti-plus text-blue-600"></i>
                <span>Create Assessment</span>
              </button>
              <button
                onClick={() => {
                  setIsFabOpen(false);
                  router.push("/tests");
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors text-left"
              >
                <i className="ti ti-folders text-slate-500"></i>
                <span>Tests Vault</span>
              </button>
              <button
                onClick={() => {
                  setIsFabOpen(false);
                  router.push("/results");
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-xl text-xs font-bold transition-colors text-left"
              >
                <i className="ti ti-trophy text-amber-500"></i>
                <span>Leaderboards</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl shadow-xl shadow-blue-500/35 flex items-center justify-center text-lg sm:text-xl active:scale-95 transition-all cursor-pointer ring-4 ring-white"
        >
          <i
            className={`ti ti-plus transition-transform duration-200 ${
              isFabOpen ? "rotate-45" : ""
            }`}
          ></i>
        </button>
      </div>
    </motion.div>
  );
}
