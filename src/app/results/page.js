// src/app/results/page.js
"use client";
import { useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { database } from "../../lib/firebase";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";

export default function GlobalLeaderboard() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  const [searchCode, setSearchCode] = useState("");
  const [searchedTest, setSearchedTest] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // P1 FIX: Client-side pagination state to prevent DOM explosion at scale
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="spinner w-10 h-10 border-4 mb-4"></div>
        <div className="text-slate-500 font-bold">Authenticating Vault...</div>
      </div>
    );
  }

  if (!currentUser || (userRole !== "examiner" && userRole !== "admin")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <i className="ti ti-shield-x text-5xl"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">
          Access Denied
        </h2>
        <p className="text-slate-500 font-medium mb-8">
          Only authorized examiners can access the Global Leaderboard.
        </p>
        <button
          className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
          onClick={() => router.push("/")}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const handleSearch = async () => {
    setErrorMsg("");
    setSearchedTest(null);
    setLeaderboardData([]);
    setCurrentPage(1);

    // P3 FIX: Strip all whitespace on input
    const cleanCode = searchCode.replace(/\s+/g, "").toUpperCase();

    if (!cleanCode) {
      setErrorMsg("Please enter a valid 6-digit test code.");
      return;
    }

    setIsSearching(true);
    try {
      let testMeta = null;
      let isSplit = false;

      // 1. Fetch metadata first
      const metaQ = query(
        ref(database, "tests_metadata"),
        orderByChild("code"),
        equalTo(cleanCode),
      );
      const metaSnap = await get(metaQ);

      if (metaSnap.exists()) {
        testMeta = Object.values(metaSnap.val())[0];
        isSplit = true;
      } else {
        // Fallback to legacy structure
        const oldQ = query(
          ref(database, "tests"),
          orderByChild("code"),
          equalTo(cleanCode),
        );
        const oldSnap = await get(oldQ);
        if (oldSnap.exists()) {
          testMeta = Object.values(oldSnap.val())[0];
          isSplit = false;
        }
      }

      if (!testMeta) {
        setErrorMsg("No active test found with this code.");
        setIsSearching(false);
        return;
      }

      // 🔒 P0 SECURITY FIX: Check authorization BEFORE querying or transmitting submissions over the network!
      if (testMeta.creatorUid !== currentUser.uid && userRole !== "admin") {
        setErrorMsg(
          "Access Denied: You are not authorized to view results for this test code.",
        );
        setIsSearching(false);
        return;
      }

      // 2. Fetch Submissions (Only executed AFTER ownership check passes)
      let submissions = [];
      if (isSplit) {
        const subsSnap = await get(
          ref(database, `test_submissions/${testMeta.id}/submissions`),
        );
        if (subsSnap.exists()) {
          const subsVal = subsSnap.val();
          submissions = (
            Array.isArray(subsVal)
              ? subsVal.map((val, i) =>
                  val ? { ...val, id: val.id || `sub-${i}` } : null,
                )
              : Object.entries(subsVal || {}).map(([key, val]) =>
                  val ? { ...val, id: key } : null,
                )
          ).filter(Boolean);
        }
      } else {
        // P2 FIX: Append filter(Boolean) to prevent null pointers in sparse legacy arrays
        const rawSubs = testMeta.submissions || {};
        submissions = (
          Array.isArray(rawSubs)
            ? rawSubs.map((val, i) =>
                val ? { ...val, id: val.id || `legacy-${i}` } : null,
              )
            : Object.entries(rawSubs).map(([key, val]) =>
                val ? { ...val, id: key } : null,
              )
        ).filter(Boolean);
      }

      if (submissions.length === 0) {
        setErrorMsg(
          "Test found, but no students have submitted their exams yet.",
        );
        setSearchedTest(testMeta);
        setIsSearching(false);
        return;
      }

      // 3. Process and Sort Gamified Leaderboard with Deterministic Multi-Factor Tie-Breaking
      const sortedSubs = [...submissions].sort((a, b) => {
        // Criterion 1: Highest Total Score
        const scoreA = Number(a.score) || 0;
        const scoreB = Number(b.score) || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        // Criterion 2: Highest Accuracy (Fewest incorrect answers)
        const corrA = Number(a.correct) || 0;
        const wrngA = Number(a.wrong) || 0;
        const accA = corrA + wrngA > 0 ? corrA / (corrA + wrngA) : 0;

        const corrB = Number(b.correct) || 0;
        const wrngB = Number(b.wrong) || 0;
        const accB = corrB + wrngB > 0 ? corrB / (corrB + wrngB) : 0;

        if (accB !== accA) return accB - accA;

        // Criterion 3: Earliest Completion Timestamp (Fastest student wins tie)
        const timeA = Number(a.timestamp) || 0;
        const timeB = Number(b.timestamp) || 0;
        if (timeA && timeB && timeA !== timeB) return timeA - timeB;

        // Criterion 4: Deterministic Alphabetical Tie-break on Name
        return (a.name || "").localeCompare(b.name || "");
      });

      const gamifiedData = sortedSubs.map((s, idx) => {
        const corr = Number(s.correct) || 0;
        const wrng = Number(s.wrong) || 0;
        const accuracy =
          corr + wrng > 0 ? Math.round((corr / (corr + wrng)) * 100) : 0;

        let badges = [];
        if (accuracy >= 90 && corr > 0)
          badges.push({
            icon: "ti-target",
            label: "Sniper",
            color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          });
        if (s.score === testMeta.totalMarks && testMeta.totalMarks > 0)
          badges.push({
            icon: "ti-diamond",
            label: "Flawless",
            color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
          });
        if (idx < 5 && idx > 2)
          badges.push({
            icon: "ti-flame",
            label: "Top 5",
            color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
          });

        const safeName = (s.name || "").trim() || "Anonymous";
        const rank = idx + 1;
        const uniqueKey = s.id
          ? `${s.id}-${rank}`
          : `${s.roll || safeName}-${s.timestamp || "time"}-${rank}`;

        return { ...s, name: safeName, rank, accuracy, badges, uniqueKey };
      });

      setSearchedTest(testMeta);
      setLeaderboardData(gamifiedData);
    } catch (error) {
      console.error("Leaderboard Search Error:", error);
      setErrorMsg("Failed to fetch global results. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const exportLeaderboard = () => {
    if (!leaderboardData.length || !searchedTest) return;

    // P1 FIX: Sanitize cells against CSV / Spreadsheet Formula Injection (CWE-1236)
    const sanitizeCSV = (val) => {
      let str = String(val ?? "").replace(/"/g, '""');
      // If cell starts with formula characters (=, +, -, @, tab, CR), prepend a single quote
      if (/^[=+@\-\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str}"`;
    };

    let csv =
      "Rank,Student Name,Roll Number,Total Score,Max Marks,Accuracy (%),Submission Time\n";
    leaderboardData.forEach((s) => {
      const safeName = sanitizeCSV(s.name || "Unknown");
      const safeRoll = sanitizeCSV(s.roll || "N/A");
      const safeScore = Number(s.score) || 0;
      const maxMarks = Number(searchedTest.totalMarks) || 0;
      const safeAccuracy = Number(s.accuracy) || 0;
      const safeTime = sanitizeCSV(s.time || "N/A");

      csv += `${s.rank},${safeName},${safeRoll},${safeScore},${maxMarks},${safeAccuracy},${safeTime}\n`;
    });

    const rawTitle = searchedTest.title || "Exam";
    const safeTitle =
      rawTitle.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 50) || "Test";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}_Leaderboard.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // P1 FIX: Slice paginated rows for scalable rendering
  const totalPages = Math.ceil(leaderboardData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return leaderboardData.slice(start, start + pageSize);
  }, [leaderboardData, currentPage, pageSize]);

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-8 animate-[fadeIn_0.4s_ease]">
      {/* 🚀 SLEEK COMPETITIVE CONSOLE HEADER */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-4 text-center md:text-left z-10">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center text-2xl border border-amber-500/20 shrink-0 shadow-inner">
            <i className="ti ti-trophy"></i>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center md:justify-start gap-2">
              Hall of Fame{" "}
              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-widest font-bold">
                Live
              </span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm font-medium mt-0.5">
              Input secure test code to evaluate rankings & performance metrics.
            </p>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto z-10">
          <input
            type="text"
            placeholder="CODE"
            value={searchCode}
            onChange={(e) =>
              setSearchCode(e.target.value.replace(/\s+/g, "").toUpperCase())
            }
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            maxLength="6"
            className="w-32 bg-slate-800/90 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-center text-sm font-black tracking-[0.25em] outline-none focus:border-amber-500 transition-all shadow-inner"
          />
          <button
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl px-5 py-2.5 text-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-70 shadow-lg shadow-amber-500/20"
            onClick={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <i className="ti ti-loader animate-spin text-base"></i>
            ) : (
              <i className="ti ti-search text-base"></i>
            )}
            Inspect
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 text-rose-400 text-sm font-bold bg-rose-500/10 px-5 py-3 rounded-2xl border border-rose-500/20 text-center animate-[shake_0.3s_ease]">
          <i className="ti ti-alert-circle mr-1.5"></i> {errorMsg}
        </div>
      )}

      {searchedTest && leaderboardData.length > 0 && (
        <div className="animate-[slideUp_0.4s_ease]">
          {/* COMPACT META BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm mb-6">
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight mb-1">
                {searchedTest.title}
              </h2>
              <div className="text-xs font-bold text-slate-500 flex items-center gap-3">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200 font-mono">
                  <i className="ti ti-hash"></i>
                  {searchedTest.code}
                </span>
                <span>
                  Max Marks: <strong>{searchedTest.totalMarks}</strong>
                </span>
                <span>
                  Total Submissions:{" "}
                  <strong className="text-blue-600">
                    {leaderboardData.length}
                  </strong>
                </span>
              </div>
            </div>
            <button
              className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 text-xs shadow-md"
              onClick={exportLeaderboard}
            >
              <i className="ti ti-download text-sm"></i> Download CSV Ledger
            </button>
          </div>

          {/* 🏆 MINI GAMIFIED PODIUM */}
          {leaderboardData.length === 1 ? (
            // P3 FIX: Clean Centered Layout for Single Submission
            <div className="flex justify-center mb-8">
              <div className="w-full max-w-sm bg-gradient-to-b from-amber-50/50 to-white p-5 rounded-2xl border-2 border-amber-300 shadow-md flex flex-col justify-between relative overflow-hidden ring-2 ring-amber-400/20">
                <div className="absolute top-3 right-3 text-amber-500 font-black text-2xl flex items-center gap-1">
                  <i className="ti ti-crown text-base"></i>#1
                </div>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-400 text-white font-black flex items-center justify-center mb-3 shadow-md text-lg">
                    {leaderboardData[0].name
                      ? leaderboardData[0].name.charAt(0).toUpperCase()
                      : "S"}
                  </div>
                  <div className="font-black text-amber-900 text-base truncate">
                    {leaderboardData[0].name}
                  </div>
                  <div className="text-[11px] font-bold text-amber-600/70 font-mono mt-0.5">
                    {leaderboardData[0].roll || "N/A"}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-amber-100 flex items-baseline justify-between">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
                    Champion
                  </span>
                  <span className="text-2xl font-black text-amber-600">
                    {leaderboardData[0].score}{" "}
                    <span className="text-xs text-amber-400 font-bold">
                      pts
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {/* Rank 2 - Silver */}
              {leaderboardData[1] && (
                <div className="bg-gradient-to-b from-slate-50 to-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden order-2 sm:order-1">
                  <div className="absolute top-3 right-3 text-slate-300 font-black text-2xl">
                    #2
                  </div>
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 font-black flex items-center justify-center mb-3 shadow-inner">
                      {leaderboardData[1].name
                        ? leaderboardData[1].name.charAt(0).toUpperCase()
                        : "S"}
                    </div>
                    <div className="font-bold text-slate-800 text-sm truncate">
                      {leaderboardData[1].name || "Anonymous"}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">
                      {leaderboardData[1].roll || "N/A"}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Silver Rank
                    </span>
                    <span className="text-xl font-black text-slate-700">
                      {leaderboardData[1].score}{" "}
                      <span className="text-xs text-slate-400 font-bold">
                        pts
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Rank 1 - Gold */}
              {leaderboardData[0] && (
                <div className="bg-gradient-to-b from-amber-50/50 to-white p-5 rounded-2xl border-2 border-amber-300 shadow-md flex flex-col justify-between relative overflow-hidden order-1 sm:order-2 ring-2 ring-amber-400/20">
                  <div className="absolute top-3 right-3 text-amber-500 font-black text-2xl flex items-center gap-1">
                    <i className="ti ti-crown text-base"></i>#1
                  </div>
                  <div>
                    <div className="w-12 h-12 rounded-xl bg-amber-400 text-white font-black flex items-center justify-center mb-3 shadow-md text-lg">
                      {leaderboardData[0].name
                        ? leaderboardData[0].name.charAt(0).toUpperCase()
                        : "S"}
                    </div>
                    <div className="font-black text-amber-900 text-base truncate">
                      {leaderboardData[0].name || "Anonymous"}
                    </div>
                    <div className="text-[11px] font-bold text-amber-600/70 font-mono mt-0.5">
                      {leaderboardData[0].roll || "N/A"}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-amber-100 flex items-baseline justify-between">
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">
                      Champion
                    </span>
                    <span className="text-2xl font-black text-amber-600">
                      {leaderboardData[0].score}{" "}
                      <span className="text-xs text-amber-400 font-bold">
                        pts
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {/* Rank 3 - Bronze */}
              {leaderboardData[2] && (
                <div className="bg-gradient-to-b from-orange-50/40 to-white p-5 rounded-2xl border border-orange-200 shadow-sm flex flex-col justify-between relative overflow-hidden order-3 sm:order-3">
                  <div className="absolute top-3 right-3 text-orange-400 font-black text-2xl">
                    #3
                  </div>
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-orange-200 text-orange-900 font-black flex items-center justify-center mb-3 shadow-inner">
                      {leaderboardData[2].name
                        ? leaderboardData[2].name.charAt(0).toUpperCase()
                        : "S"}
                    </div>
                    <div className="font-bold text-slate-800 text-sm truncate">
                      {leaderboardData[2].name || "Anonymous"}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">
                      {leaderboardData[2].roll || "N/A"}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-orange-100 flex items-baseline justify-between">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-wider">
                      Bronze Rank
                    </span>
                    <span className="text-xl font-black text-orange-700">
                      {leaderboardData[2].score}{" "}
                      <span className="text-xs text-orange-400 font-bold">
                        pts
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 📋 LEADERBOARD TABLE (Paginated & Scale-Proof) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="ti ti-list-details text-base"></i> Full Rankings
                Ledger
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400">
                  {leaderboardData.length} Total Competitors
                </span>
                {totalPages > 1 && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                    Page {currentPage} of {totalPages}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col">
              {paginatedData.map((s, idx) => (
                <div
                  key={s.uniqueKey || `sub-row-${s.rank || idx}`}
                  className="group flex items-center justify-between p-4 sm:p-4.5 border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 pr-2">
                    <div className="text-sm font-black w-7 text-center shrink-0">
                      {s.rank === 1 ? (
                        <span className="text-amber-500 font-black">#1</span>
                      ) : s.rank === 2 ? (
                        <span className="text-slate-400 font-black">#2</span>
                      ) : s.rank === 3 ? (
                        <span className="text-orange-400 font-black">#3</span>
                      ) : (
                        <span className="text-slate-400 font-bold">
                          #{s.rank}
                        </span>
                      )}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 border border-slate-200/60 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                      {s.name ? s.name.charAt(0).toUpperCase() : "S"}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                        {s.name}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 font-mono">
                        {s.roll || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className="hidden md:flex gap-1.5">
                      {s.badges.map((b, i) => (
                        <span
                          key={`${b.label}-${i}`}
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${b.color}`}
                        >
                          <i className={`ti ${b.icon}`}></i> {b.label}
                        </span>
                      ))}
                    </div>

                    <div className="hidden sm:flex flex-col items-end w-20">
                      <div className="text-[10px] font-bold text-slate-500 mb-1">
                        {s.accuracy}% Acc
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.accuracy >= 70 ? "bg-emerald-500" : s.accuracy >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${s.accuracy}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="text-right min-w-[50px]">
                      <div className="text-base sm:text-lg font-black text-slate-800 leading-none">
                        {s.score}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                        Pts
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* P1 FIX: Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
                >
                  <i className="ti ti-chevron-left text-xs"></i> Previous
                </button>
                <div className="text-xs font-semibold text-slate-500">
                  Showing {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, leaderboardData.length)} of{" "}
                  {leaderboardData.length}
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
                >
                  Next <i className="ti ti-chevron-right text-xs"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
