// src/app/arena/page.js
"use client";
import { useState, useEffect, memo } from "react";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";

// 🛡️ MathJax Re-renderer with Strict Mobile Overflow-X Protection
const StaticMath = memo(({ html, className }) => {
  return (
    <div
      className={`math-container w-full max-w-full overflow-x-auto hide-scroll ${className || ""}`}
      style={{ WebkitOverflowScrolling: "touch" }}
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
});

StaticMath.displayName = "StaticMath";

export default function PracticeArena() {
  const { currentUser, loading } = useAuth();

  const [activeTab, setActiveTab] = useState("general"); // 'general' | 'gemini'

  // --- GAMIFICATION REWARD STATES ---
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(100);
  const [totalSolved, setTotalSolved] = useState(0);
  const [showXpGain, setShowXpGain] = useState(false);
  const [isGamificationLoaded, setIsGamificationLoaded] = useState(false);

  // 1. Hydration-Safe Mount Initializer (Load from localStorage)
  useEffect(() => {
    try {
      const savedStreak = parseInt(
        localStorage.getItem("examitop_arena_streak") || "0",
        10,
      );
      const savedXp = parseInt(
        localStorage.getItem("examitop_arena_xp") || "100",
        10,
      );
      const savedSolved = parseInt(
        localStorage.getItem("examitop_arena_solved") || "0",
        10,
      );

      if (!isNaN(savedStreak)) setStreak(savedStreak);
      if (!isNaN(savedXp)) setXp(savedXp);
      if (!isNaN(savedSolved)) setTotalSolved(savedSolved);
    } catch (err) {
      console.warn("Could not read arena gamification from localStorage:", err);
    } finally {
      setIsGamificationLoaded(true);
    }
  }, []);

  // 2. Auto-Sync Gamification State back to localStorage on change
  useEffect(() => {
    if (!isGamificationLoaded) return;
    try {
      localStorage.setItem("examitop_arena_streak", streak.toString());
      localStorage.setItem("examitop_arena_xp", xp.toString());
      localStorage.setItem("examitop_arena_solved", totalSolved.toString());
    } catch (err) {
      console.warn("Could not sync arena gamification to localStorage:", err);
    }
  }, [streak, xp, totalSolved, isGamificationLoaded]);

  // --- GENERAL TRIVIA (OpenTDB) STATES ---
  const [genQ, setGenQ] = useState(null);
  const [genOptions, setGenOptions] = useState([]);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");
  const [genSelected, setGenSelected] = useState(null);
  const [genStatus, setGenStatus] = useState(null); // 'correct' | 'wrong'

  // --- GEMINI AI STATES ---
  const [gemExam, setGemExam] = useState("JEE Mains");
  const [gemSubject, setGemSubject] = useState("Physics");
  const [gemChapter, setGemChapter] = useState("");
  const [gemQ, setGemQ] = useState(null);
  const [gemLoading, setGemLoading] = useState(false);
  const [gemError, setGemError] = useState("");
  const [gemSelected, setGemSelected] = useState(null);
  const [gemStatus, setGemStatus] = useState(null); // 'correct' | 'wrong'
  const [craftStep, setCraftStep] = useState(0);

  // MathJax Auto-Renderer Concurrency Queue (Zero-Collision Chaining)
  useEffect(() => {
    let isCancelled = false;
    const renderMath = () => {
      if (isCancelled || typeof window === "undefined" || !window.MathJax)
        return;

      const executeTypeset = () => {
        if (isCancelled) return Promise.resolve();
        try {
          if (typeof window.MathJax.typesetClear === "function") {
            window.MathJax.typesetClear();
          }
          if (typeof window.MathJax.typesetPromise === "function") {
            return window.MathJax.typesetPromise().catch((err) => {
              console.warn("MathJax typeset execution error:", err);
            });
          }
        } catch (e) {
          console.warn("MathJax typeset error:", e);
        }
        return Promise.resolve();
      };

      // Wrap in window.MathJax.startup.promise queue to prevent "already typesetting" collision
      if (window.MathJax.startup && window.MathJax.startup.promise) {
        window.MathJax.startup.promise = window.MathJax.startup.promise
          .then(executeTypeset)
          .catch((err) => {
            console.warn("MathJax queue error, recovering:", err);
            return executeTypeset();
          });
      } else if (typeof window.MathJax.typesetPromise === "function") {
        window.MathJax.typesetPromise().catch((err) => {
          console.warn("MathJax direct error:", err);
        });
      }
    };

    const timer = setTimeout(renderMath, 120);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [genQ, gemQ, genStatus, gemStatus, activeTab]);

  // AI Crafting Stepper Animation
  useEffect(() => {
    if (!gemLoading) {
      setCraftStep(0);
      return;
    }
    const interval = setInterval(() => {
      setCraftStep((prev) => (prev + 1) % 3);
    }, 1400);
    return () => clearInterval(interval);
  }, [gemLoading]);

 // Hydration-Safe HTML Entities Decoder
  const decodeHTML = (html) => {
    if (!html) return "";
    
    // Server Side Render (SSR) Fallback - Simple regex string replace
    if (typeof window === "undefined" || typeof document === "undefined") {
      return html
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&eacute;/g, "é")
        .replace(/&deg;/g, "°");
    }

    // Client Side Render (CSR) - Browser's DOMParser
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return doc.body.textContent || "";
    } catch (e) {
      const txt = document.createElement("textarea");
      txt.innerHTML = html;
      return txt.value || "";
    }
  };

  // --- 1. GENERAL API LOGIC ---
  const fetchGeneralQ = async () => {
    setGenLoading(true);
    setGenError("");
    setGenQ(null);
    setGenSelected(null);
    setGenStatus(null);
    try {
      const res = await fetch(
        "https://opentdb.com/api.php?amount=1&type=multiple",
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const q = data.results[0];
        const decodedQ = {
          ...q,
          question: decodeHTML(q.question),
          correct_answer: decodeHTML(q.correct_answer),
        };
        const opts = q.incorrect_answers.map(decodeHTML);
        opts.push(decodedQ.correct_answer);
        opts.sort(() => Math.random() - 0.5);

        setGenOptions(opts);
        setGenQ(decodedQ);
      } else {
        throw new Error("No trivia challenge available.");
      }
    } catch (e) {
      setGenError("Global Vault Connection Failed. Please try again.");
    }
    setGenLoading(false);
  };

  const handleGenAns = (opt) => {
    if (genSelected !== null) return;
    setGenSelected(opt);
    const isCorrect = opt === genQ.correct_answer;
    if (isCorrect) {
      setGenStatus("correct");
      setStreak((s) => s + 1);
      setXp((x) => x + 15);
      setTotalSolved((t) => t + 1);
      setShowXpGain(true);
      setTimeout(() => setShowXpGain(false), 1500);
    } else {
      setGenStatus("wrong");
      setStreak(0);
    }
  };

  // --- 2. GEMINI API LOGIC ---
  const handleExamChange = (e) => {
    const ex = e.target.value;
    setGemExam(ex);
    if (ex === "JEE Mains") setGemSubject("Physics");
    else if (ex === "NEET") setGemSubject("Physics");
    else if (ex === "College (CSE)") setGemSubject("Computer Science");
  };

  const fetchAIQuestion = async () => {
    if (!gemChapter.trim()) {
      setGemError(
        "Please enter a specific topic or chapter name to forge a challenge!",
      );
      return;
    }

    setGemLoading(true);
    setGemError("");
    setGemQ(null);
    setGemSelected(null);
    setGemStatus(null);

    try {
      // 🛡️ SECURE AI FETCH: Inject Firebase Auth Token
      const token = await currentUser.getIdToken();
      
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          examTarget: gemExam,
          subject: gemSubject,
          chapter: gemChapter.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error || "AI Crucible failed to generate challenge",
        );

      setGemQ(data);
    } catch (err) {
      setGemError(
        err.message || "Error generating AI question. Check network and retry.",
      );
    }
    setGemLoading(false);
  };

  const handleGemAns = (idx) => {
    if (gemSelected !== null) return;
    setGemSelected(idx);
    const isCorrect = idx === gemQ.correct_index;
    if (isCorrect) {
      setGemStatus("correct");
      setStreak((s) => s + 1);
      setXp((x) => x + 25);
      setTotalSolved((t) => t + 1);
      setShowXpGain(true);
      setTimeout(() => setShowXpGain(false), 1500);
    } else {
      setGemStatus("wrong");
      setStreak(0);
    }
  };

  // Curated Quick-Picks for rapid user selection
  const quickTopics = {
    Physics: ["Kinematics", "Thermodynamics", "Optics", "Electromagnetism"],
    Chemistry: ["Chemical Bonding", "Organic Reactions", "Electrochemistry"],
    Mathematics: ["Calculus", "Probability", "Coordinate Geometry"],
    Biology: ["Genetics", "Cell Biology", "Human Physiology"],
    "Computer Science": [
      "Data Structures",
      "Dynamic Programming",
      "DBMS & SQL",
      "Operating Systems",
    ],
  };

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-2xl border-4 border-indigo-200 animate-ping opacity-25"></div>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg animate-[spin_3s_linear_infinite]">
            <i className="ti ti-swords text-2xl"></i>
          </div>
        </div>
        <p className="text-slate-700 font-black text-sm tracking-wide uppercase">
          Summoning Practice Arena...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="w-full max-w-full overflow-x-hidden min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-12">
        <div className="w-20 h-20 bg-rose-50 border-2 border-rose-200 text-rose-500 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-rose-500/10 animate-[bounce_2s_infinite]">
          <i className="ti ti-shield-lock text-4xl"></i>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
          Arena Gates Locked
        </h2>
        <p className="text-slate-500 font-medium max-w-md mb-8 text-sm sm:text-base leading-relaxed">
          Sign in with your student or educator credentials to unlock unlimited
          AI mocks, global speed trivia, and streak multipliers.
        </p>
        <Link
          href="/"
          className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center gap-2"
        >
          <i className="ti ti-login text-lg"></i>
          Return to Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden min-h-screen bg-slate-50/50 pb-20">
      {/* 🔮 INLINE ANIMATION DEFINITIONS FOR ZERO RUNTIME DEPENDENCIES */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.94) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.2); }
          50% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.45); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 🚀 GAMIFIED HUD / STATS BANNER */}
      <div className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
              <i className="ti ti-trophy"></i>
            </span>
            <span className="font-black text-xs sm:text-sm text-slate-800 tracking-tight truncate hidden xs:inline-block">
              Arena League
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Streak Counter */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full shadow-xs">
              <span className="text-amber-500 text-sm animate-[bounce_1.5s_infinite]">
                🔥
              </span>
              <span className="text-xs font-black text-amber-900">
                {streak}
              </span>
              <span className="text-[10px] font-bold text-amber-600 uppercase hidden sm:inline">
                Streak
              </span>
            </div>

            {/* XP Badge */}
            <div className="relative flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200/80 rounded-full shadow-xs">
              <span className="text-indigo-600 text-xs font-black">⚡</span>
              <span className="text-xs font-black text-indigo-950">{xp}</span>
              <span className="text-[10px] font-bold text-indigo-600 uppercase hidden sm:inline">
                XP
              </span>

              {/* Floating +XP Notification */}
              {showXpGain && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-full shadow-md animate-[popIn_0.3s_ease] whitespace-nowrap">
                  +{activeTab === "gemini" ? "25" : "15"} XP!
                </div>
              )}
            </div>

            {/* Solved Count */}
            <div className="flex items-center gap-1 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-slate-700 shadow-xs">
              <i className="ti ti-circle-check text-emerald-600 text-xs font-black"></i>
              <span className="text-xs font-black">{totalSolved}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        {/* 🌟 HERO BANNER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-6 sm:p-10 mb-8 sm:mb-10 shadow-xl border border-slate-800">
          <div className="absolute -right-16 -bottom-16 w-56 h-56 bg-blue-500/15 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -left-16 -top-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-blue-500/20 to-indigo-500/30 border border-blue-400/30 flex items-center justify-center text-3xl sm:text-4xl text-blue-400 shadow-inner shrink-0 animate-[floatSlow_3s_ease-in-out_infinite]">
              <i className="ti ti-swords"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-black uppercase tracking-widest mb-2.5">
                <i className="ti ti-flame text-amber-400"></i> Practice &
                Conquer
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-2 leading-tight">
                The Battleground Arena
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl leading-relaxed">
                Sharpen conceptual reflexes with rapid global trivia or deploy
                Google Gemini 2.5 Flash to forge targeted competitive mock
                problems with step-by-step mathematical reasoning.
              </p>
            </div>
          </div>
        </div>

        {/* 🎮 PREMIUM SEGMENTED TAB SWITCHER */}
        <div className="flex justify-center mb-8 sm:mb-10">
          <div className="inline-flex p-1.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-sm max-w-full overflow-x-auto hide-scroll">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2 px-5 sm:px-7 py-3 rounded-xl font-black text-xs sm:text-sm tracking-wide transition-all duration-200 whitespace-nowrap cursor-pointer ${
                activeTab === "general"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20 scale-[1.01]"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
              }`}
            >
              <i className="ti ti-world text-base sm:text-lg"></i>
              <span>Global Trivia</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md uppercase font-black ${
                  activeTab === "general"
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                Rapid
              </span>
            </button>

            <button
              onClick={() => setActiveTab("gemini")}
              className={`flex items-center gap-2 px-5 sm:px-7 py-3 rounded-xl font-black text-xs sm:text-sm tracking-wide transition-all duration-200 whitespace-nowrap cursor-pointer ${
                activeTab === "gemini"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20 scale-[1.01]"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
              }`}
            >
              <i className="ti ti-sparkles text-base sm:text-lg"></i>
              <span>AI Mock Crucible</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md uppercase font-black ${
                  activeTab === "gemini"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                Gemini
              </span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 1: GLOBAL TRIVIA MODE                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "general" && (
          <div className="w-full max-w-full overflow-hidden bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-8 animate-[popIn_0.3s_ease]">
            {/* IDLE HERO STATE */}
            {!genQ && !genLoading && !genError && (
              <div className="text-center py-8 sm:py-14 max-w-md mx-auto">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 border border-blue-100 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5 shadow-inner animate-[floatSlow_3s_ease-in-out_infinite]">
                  <i className="ti ti-dice-5"></i>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 tracking-tight">
                  Global Rapid Trivia
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mb-8">
                  Draw an unpredictable question across general sciences,
                  computing, history, and analytical problem-solving.
                </p>
                <button
                  onClick={fetchGeneralQ}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                >
                  <i className="ti ti-player-play text-lg"></i> Draw Question
                  (+15 XP)
                </button>
              </div>
            )}

            {/* SKELETON LOADING STATE */}
            {genLoading && (
              <div className="py-8 sm:py-12 max-w-2xl mx-auto">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse"></div>
                  <div className="h-6 w-20 bg-slate-200 rounded-lg animate-pulse"></div>
                </div>
                <div className="h-5 w-3/4 bg-slate-200 rounded-md mb-3 animate-pulse"></div>
                <div className="h-5 w-full bg-slate-200 rounded-md mb-8 animate-pulse"></div>

                <div className="flex flex-col gap-3">
                  {[0, 1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-14 bg-slate-100 border border-slate-200/60 rounded-2xl animate-pulse flex items-center px-4 gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-2 mt-8 text-xs font-bold text-slate-400">
                  <i className="ti ti-loader animate-spin text-sm text-blue-600"></i>
                  <span>Connecting to global question repository...</span>
                </div>
              </div>
            )}

            {/* ERROR STATE */}
            {genError && (
              <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 sm:p-8 text-center max-w-md mx-auto my-4 animate-[popIn_0.3s_ease]">
                <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
                  <i className="ti ti-wifi-off"></i>
                </div>
                <h4 className="text-base font-black text-rose-900 mb-1">
                  Transmission Disrupted
                </h4>
                <p className="text-xs sm:text-sm text-rose-700 font-medium mb-6">
                  {genError}
                </p>
                <button
                  onClick={fetchGeneralQ}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Retry Challenge
                </button>
              </div>
            )}

            {/* ACTIVE QUESTION PANEL */}
            {genQ && !genLoading && (
              <div className="w-full max-w-2xl mx-auto animate-[popIn_0.3s_ease]">
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-5 pb-4 border-b border-slate-100">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-black uppercase tracking-wider rounded-xl">
                    <i className="ti ti-category"></i>
                    {genQ.category}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-black uppercase tracking-wider rounded-xl border ${
                      genQ.difficulty === "hard"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : genQ.difficulty === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    <i className="ti ti-activity"></i>
                    {genQ.difficulty}
                  </span>
                </div>

                {/* Question Statement */}
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 leading-relaxed mb-6 break-words">
                  {genQ.question}
                </h3>

                {/* Options List */}
                <div className="flex flex-col gap-3">
                  {genOptions.map((opt, i) => {
                    const isSelected = genSelected === opt;
                    const isCorrect = opt === genQ.correct_answer;

                    let containerStyles =
                      "bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50";
                    let badgeStyles =
                      "bg-slate-100 border-slate-300 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 group-hover:border-blue-300";
                    let animationStyle = "";

                    if (genSelected !== null) {
                      if (isCorrect) {
                        containerStyles =
                          "bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-4 ring-emerald-400/20 shadow-sm";
                        badgeStyles =
                          "bg-emerald-500 border-emerald-500 text-white";
                      } else if (isSelected && !isCorrect) {
                        containerStyles =
                          "bg-rose-50/90 border-rose-500 text-rose-950 ring-4 ring-rose-400/20 shadow-sm animate-[shake_0.4s_ease-in-out]";
                        badgeStyles = "bg-rose-500 border-rose-500 text-white";
                      } else {
                        containerStyles =
                          "bg-white border-slate-200 text-slate-400 opacity-40";
                        badgeStyles =
                          "bg-slate-100 border-slate-200 text-slate-400";
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleGenAns(opt)}
                        disabled={genSelected !== null}
                        className={`group w-full max-w-full flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all duration-200 overflow-hidden cursor-pointer ${containerStyles} ${animationStyle} ${
                          genSelected !== null
                            ? "cursor-default"
                            : "active:scale-[0.99]"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black text-xs shrink-0 transition-colors mt-0.5 ${badgeStyles}`}
                        >
                          {String.fromCharCode(65 + i)}
                        </div>

                        <div className="flex-1 min-w-0 text-sm sm:text-base font-semibold pt-0.5 break-words whitespace-normal">
                          {opt}
                        </div>

                        {genSelected !== null && isCorrect && (
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-black shrink-0 animate-[popIn_0.2s_ease]">
                            <i className="ti ti-check"></i>
                          </div>
                        )}

                        {genSelected !== null && isSelected && !isCorrect && (
                          <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-sm font-black shrink-0 animate-[popIn_0.2s_ease]">
                            <i className="ti ti-x"></i>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Action Button after response */}
                {genSelected !== null && (
                  <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 animate-[popIn_0.3s_ease]">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      {genStatus === "correct" ? (
                        <span className="text-emerald-600 flex items-center gap-1.5 font-black">
                          <i className="ti ti-circle-check text-base"></i>{" "}
                          Correct Answer! +15 XP Awarded
                        </span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-1.5 font-black">
                          <i className="ti ti-alert-triangle text-base"></i>{" "}
                          Streak Broken! Correct answer highlighted above.
                        </span>
                      )}
                    </div>

                    <button
                      onClick={fetchGeneralQ}
                      className="w-full sm:w-auto px-7 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Next Trivia Round <i className="ti ti-arrow-right"></i>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 2: GEMINI AI MOCK CRUCIBLE                             */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === "gemini" && (
          <div className="w-full max-w-full overflow-hidden bg-gradient-to-b from-emerald-50/40 via-white to-white rounded-3xl border border-emerald-200 shadow-sm p-5 sm:p-8 animate-[popIn_0.3s_ease]">
            {/* AI CONFIGURATION FORGE */}
            {!gemQ && !gemLoading && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-black uppercase tracking-wider mb-3">
                    <i className="ti ti-cpu text-emerald-600"></i> Powered by
                    Google Gemini
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
                    AI Custom Problem Forge
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
                    Select target tier and topic. Gemini generates a fresh,
                    exam-accurate problem with full LaTeX formatting and
                    step-by-step resolution.
                  </p>
                </div>

                {/* Target Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <i className="ti ti-target text-emerald-600"></i> Target
                      Exam
                    </label>
                    <select
                      value={gemExam}
                      onChange={handleExamChange}
                      className="w-full bg-white border-2 border-emerald-200/90 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl px-4 py-3.5 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-xs transition-all cursor-pointer"
                    >
                      <option value="JEE Mains">
                        JEE Mains (Advanced/Engineering)
                      </option>
                      <option value="NEET">NEET (Medical Pre-Med)</option>
                      <option value="College (CSE)">
                        College (Computer Science & IT)
                      </option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <i className="ti ti-book text-emerald-600"></i> Subject
                      Stream
                    </label>
                    <select
                      value={gemSubject}
                      onChange={(e) => setGemSubject(e.target.value)}
                      className="w-full bg-white border-2 border-emerald-200/90 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl px-4 py-3.5 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-xs transition-all cursor-pointer"
                    >
                      {gemExam === "College (CSE)" ? (
                        <option value="Computer Science">
                          Computer Science & Algorithms
                        </option>
                      ) : (
                        <>
                          <option value="Physics">Physics</option>
                          <option value="Chemistry">Chemistry</option>
                          {gemExam === "JEE Mains" ? (
                            <option value="Mathematics">Mathematics</option>
                          ) : (
                            <option value="Biology">Biology</option>
                          )}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Chapter / Topic Search Input */}
                <div className="flex flex-col gap-1.5 mb-4">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                    <i className="ti ti-sparkles text-emerald-600"></i> Topic /
                    Syllabus Chapter
                  </label>
                  <div className="relative">
                    <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                    <input
                      type="text"
                      value={gemChapter}
                      onChange={(e) => {
                        setGemChapter(e.target.value);
                        if (gemError) setGemError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && fetchAIQuestion()}
                      placeholder={
                        gemExam === "College (CSE)"
                          ? "e.g. Binary Search Trees, Virtual Memory, SQL Joins..."
                          : "e.g. Rotational Dynamics, Chemical Equilibrium, Integration..."
                      }
                      className="w-full bg-white border-2 border-emerald-300 text-slate-800 font-bold text-xs sm:text-sm rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-xs transition-all placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </div>
                </div>

                {/* Quick-Pick Tags */}
                {quickTopics[gemSubject] && (
                  <div className="mb-6">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Recommended Topics:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {quickTopics[gemSubject].map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => {
                            setGemChapter(topic);
                            if (gemError) setGemError("");
                          }}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            gemChapter === topic
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {gemError && (
                  <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-[shake_0.4s_ease-in-out]">
                    <i className="ti ti-alert-circle text-base shrink-0"></i>
                    <span>{gemError}</span>
                  </div>
                )}

                {/* Forge Button */}
                <button
                  onClick={fetchAIQuestion}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="ti ti-bolt text-lg"></i>
                  <span>Forge AI Challenge (+25 XP)</span>
                </button>
              </div>
            )}

            {/* AI CRAFTING BATTLE ANIMATION */}
            {gemLoading && (
              <div className="py-10 sm:py-16 text-center max-w-md mx-auto">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-3xl bg-emerald-400/20 animate-ping"></div>
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white text-3xl shadow-xl shadow-emerald-500/30 animate-[pulseGlow_1.5s_infinite]">
                    <i className="ti ti-cpu"></i>
                  </div>
                </div>

                <h4 className="text-lg font-black text-slate-900 mb-1 tracking-tight">
                  {craftStep === 0 && "Analyzing Syllabus Specifications..."}
                  {craftStep === 1 &&
                    "Formulating Complex Distractor Options..."}
                  {craftStep === 2 &&
                    "Synthesizing LaTeX & Step-by-Step Proof..."}
                </h4>

                <p className="text-xs text-slate-500 font-medium mb-6">
                  Google Gemini 2.5 is calibrating difficulty for {gemExam}.
                </p>

                {/* Step indicator pills */}
                <div className="flex justify-center gap-2">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${craftStep === 0 ? "w-8 bg-emerald-600" : "w-2 bg-emerald-200"}`}
                  ></div>
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${craftStep === 1 ? "w-8 bg-emerald-600" : "w-2 bg-emerald-200"}`}
                  ></div>
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${craftStep === 2 ? "w-8 bg-emerald-600" : "w-2 bg-emerald-200"}`}
                  ></div>
                </div>
              </div>
            )}

            {/* AI QUESTION PROBLEM CARD */}
            {gemQ && !gemLoading && (
              <div className="w-full max-w-2xl mx-auto animate-[popIn_0.3s_ease]">
                {/* Problem Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-5 pb-4 border-b border-emerald-100">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-wider rounded-xl">
                    <i className="ti ti-sparkles"></i> AI Generated Mock
                  </span>

                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl truncate max-w-[240px] sm:max-w-none">
                    {gemExam} &bull; {gemSubject} &bull; {gemChapter}
                  </span>
                </div>

                {/* Problem Statement with Protected Responsive MathJax */}
                <div className="w-full max-w-full overflow-hidden mb-6">
                  <StaticMath
                    html={gemQ.question}
                    className="text-base sm:text-lg md:text-xl font-bold text-slate-900 leading-relaxed break-words"
                  />
                </div>

                {/* Problem Options */}
                <div className="flex flex-col gap-3">
                  {gemQ.options.map((opt, i) => {
                    const isSelected = gemSelected === i;
                    const isCorrect = i === gemQ.correct_index;

                    let containerStyles =
                      "bg-white border-slate-200 text-slate-700 hover:border-emerald-400 hover:bg-emerald-50/50";
                    let badgeStyles =
                      "bg-slate-100 border-slate-300 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 group-hover:border-emerald-300";
                    let animationStyle = "";

                    if (gemSelected !== null) {
                      if (isCorrect) {
                        containerStyles =
                          "bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-4 ring-emerald-400/20 shadow-sm";
                        badgeStyles =
                          "bg-emerald-500 border-emerald-500 text-white";
                      } else if (isSelected && !isCorrect) {
                        containerStyles =
                          "bg-rose-50/90 border-rose-500 text-rose-950 ring-4 ring-rose-400/20 shadow-sm animate-[shake_0.4s_ease-in-out]";
                        badgeStyles = "bg-rose-500 border-rose-500 text-white";
                      } else {
                        containerStyles =
                          "bg-white border-slate-200 text-slate-400 opacity-40";
                        badgeStyles =
                          "bg-slate-100 border-slate-200 text-slate-400";
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleGemAns(i)}
                        disabled={gemSelected !== null}
                        className={`group w-full max-w-full flex items-start gap-3.5 p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all duration-200 overflow-hidden cursor-pointer ${containerStyles} ${animationStyle} ${
                          gemSelected !== null
                            ? "cursor-default"
                            : "active:scale-[0.99]"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black text-xs shrink-0 transition-colors mt-0.5 ${badgeStyles}`}
                        >
                          {String.fromCharCode(65 + i)}
                        </div>

                        {/* Internal overflow container guarantees no page wobble */}
                        <div className="flex-1 min-w-0 pt-0.5 overflow-x-auto hide-scroll">
                          <StaticMath
                            html={opt}
                            className="text-sm sm:text-base font-semibold block break-words whitespace-normal"
                          />
                        </div>

                        {gemSelected !== null && isCorrect && (
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-black shrink-0 mt-0.5 animate-[popIn_0.2s_ease]">
                            <i className="ti ti-check"></i>
                          </div>
                        )}

                        {gemSelected !== null && isSelected && !isCorrect && (
                          <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center text-sm font-black shrink-0 mt-0.5 animate-[popIn_0.2s_ease]">
                            <i className="ti ti-x"></i>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Step-by-Step AI Solution Drawer */}
                {gemSelected !== null && (
                  <div className="mt-8 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-5 sm:p-6 animate-[popIn_0.35s_ease]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm">
                        <i className="ti ti-bulb"></i>
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-indigo-950 uppercase tracking-wider">
                        Master Solution & Concept Proof
                      </h4>
                    </div>

                    <div className="text-indigo-950 text-xs sm:text-sm font-medium leading-relaxed overflow-x-auto hide-scroll">
                      <StaticMath
                        html={gemQ.solution}
                        className="block break-words"
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Action Footer */}
                {gemSelected !== null && (
                  <div className="mt-8 pt-6 border-t border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4 animate-[popIn_0.3s_ease]">
                    <div className="text-xs font-bold">
                      {gemStatus === "correct" ? (
                        <span className="text-emerald-600 flex items-center gap-1.5 font-black">
                          <i className="ti ti-circle-check text-base"></i>{" "}
                          Problem Solved! +25 XP Added
                        </span>
                      ) : (
                        <span className="text-rose-600 flex items-center gap-1.5 font-black">
                          <i className="ti ti-alert-circle text-base"></i>{" "}
                          Review solution above to master the topic.
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setGemQ(null);
                        setGemSelected(null);
                        setGemStatus(null);
                      }}
                      className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Forge Next Problem</span>
                      <i className="ti ti-refresh text-base"></i>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
