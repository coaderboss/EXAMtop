// src/app/student-results/page.js
"use client";
import { useState, useEffect, memo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { database, auth } from "../../lib/firebase";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import FigureRenderer from "../../components/FigureRenderer";
import SmilesViewer from "../../components/SmilesViewer";
import { sanitizeSvg } from "../../lib/sanitizeSvg";

//   THE MASTER FIX: MathJax React Re-render Protector
const StaticMath = memo(({ html, isBlock, style, className }) => {
  if (isBlock)
    return (
      <div
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: html || "" }}
      />
    );
  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
});

export default function StudentResults() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- NEW: Local State for Smart Fetching ---
  const [myHistory, setMyHistory] = useState([]);
  const [fetchingResults, setFetchingResults] = useState(true);

  // State to toggle between List View and Detailed View
  const [selectedResult, setSelectedResult] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all', 'correct', 'wrong', 'skipped'
  const [sectionFilter, setSectionFilter] = useState("all_sections"); //  NAYA: Section Filter
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMathReady, setIsMathReady] = useState(true);

  const [openCardId, setOpenCardId] = useState(null);
  const [openingResultId, setOpeningResultId] = useState(null); // Spinner for specific test click

  // Outer Vault Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'evaluated', 'pending'
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // 'newest', 'score'

  const [nowTick, setNowTick] = useState(Date.now());
  const [leaderboardData, setLeaderboardData] = useState({
    rank: null,
    totalParticipants: null,
    loading: false,
  });

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedResult || !selectedResult.test?.ranksPublished) {
      setLeaderboardData({
        rank: null,
        totalParticipants: null,
        loading: false,
      });
      return;
    }

    let isSubscribed = true;
    const fetchLeaderboardRank = async () => {
      try {
        setLeaderboardData((prev) => ({ ...prev, loading: true }));
        const token = auth.currentUser ? await auth.currentUser.getIdToken(true) : "";
        const res = await fetch("/api/exam/leaderboard", {
          method: "POST",
          headers: { 
             "Content-Type": "application/json",
             ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            testId: selectedResult.test.id,
            studentScore: selectedResult.sub?.score,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && isSubscribed) {
            setLeaderboardData({
              rank: data.rank,
              totalParticipants: data.totalParticipants,
              loading: false,
            });
          }
        }
      } catch (err) {
        console.warn("Leaderboard fetch error:", err);
      } finally {
        if (isSubscribed) {
          setLeaderboardData((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    fetchLeaderboardRank();

    return () => {
      isSubscribed = false;
    };
  }, [selectedResult]);

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
      return !isNaN(pubTime) && nowTick >= pubTime;
    }
    return false;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => {
      // 400px se zyada scroll hone par arrow popup hoga
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 🚀 BULLETPROOF FETCH WITH RUTHLESS GHOST FILTER (RESULTS PAGE)
  useEffect(() => {
    const fetchStudentHistory = async () => {
      if (!currentUser) return;
      try {
        setFetchingResults(true);
        let historyTemp = [];
        const safeUserKey = currentUser.uid;

        // 1. NEW ARCHITECTURE FETCH
        try {
          const userSubSnap = await get(
            ref(database, `user_submissions/${safeUserKey}`),
          );
          if (userSubSnap.exists()) {
            const userSubs = userSubSnap.val();

            // 🔥 FIX LOGIC.4: Parallelized Promise.all() Map (Eliminates N+1 Sequential Network Waterfall)
            const historyPromises = Object.keys(userSubs).map(async (key) => {
              const sub = userSubs[key];
              if (!sub) return null;
              const testId = sub.testId || key;

              if (!testId || testId === "undefined" || sub.score === undefined)
                return null;

              let title = sub.testTitle || "";
              let code = sub.testCode || "N/A";
              let totalMarks = sub.totalMarks;
              let subject = sub.subject || "General";

              // Stop hardcoding 'instant'. Read real settings from Metadata!
              let tVis = sub.resultVis || "manual";
              let tReleased = false;
              let tPubTime = sub.resultPublishTime || null;

              try {
                let metaSnap = await get(
                  ref(database, `tests_metadata/${testId}`),
                );
                if (metaSnap.exists()) {
                  const m = metaSnap.val();
                  title = m.title || title || `Assessment (${code})`;
                  code = m.code || code;
                  totalMarks = m.totalMarks || totalMarks || 100;
                  subject = m.subject || subject || "General";
                  tVis = m.resultVis || sub.resultVis || "manual";
                  tReleased = m.released === true;
                  tPubTime =
                    m.resultPublishTime || sub.resultPublishTime || null;
                } else {
                  title = title || `Assessment (${code})`;
                  totalMarks = totalMarks || 100;
                  tVis = sub.resultVis || "manual";
                }
              } catch (e) {
                title = title || `Assessment (${code})`;
                totalMarks = totalMarks || 100;
                tVis = sub.resultVis || "manual";
              }

              // Read isPublished boolean directly from user_submissions node! Zero client permission dependencies!
              const individualPublishStatus = sub.isPublished === true;

              return {
                test: {
                  id: testId,
                  dbKey: key,
                  title: title,
                  code: code,
                  subject: subject,
                  totalMarks: Number(totalMarks || 100),
                  resultVis: tVis,
                  released: tReleased,
                  resultPublishTime: tPubTime,
                },
                sub: {
                  score: Number(sub.score || 0),
                  time:
                    sub.time ||
                    (sub.timestamp
                      ? new Date(sub.timestamp).toLocaleString("en-IN")
                      : "Recent"),
                  timestamp: sub.timestamp || 0,
                  correct: sub.correct || 0,
                  wrong: sub.wrong || 0,
                  skipped: sub.skipped || 0,
                  isPublished: individualPublishStatus, // 🔥 Use the fetched live status here
                  roll: sub.studentRoll || sub.roll || null,
                  studentKey: sub.studentKey || key,
                },
                canView: true,
              };
            });

            const resolvedHistory = await Promise.all(historyPromises);
            const validHistory = resolvedHistory.filter(Boolean);
            historyTemp.push(...validHistory);
          }
        } catch (err) {
          console.warn("Fast fetch error:", err);
        }

        // DEDUPLICATION & SORTING
        const uniqueHistory = Array.from(
          new Map(
            historyTemp.map((item) => [
              `${item.test.id}_${item.sub.timestamp || 0}_${item.sub.score ?? 0}`,
              item,
            ]),
          ).values(),
        );
        uniqueHistory.sort(
          (a, b) => (b.sub.timestamp || 0) - (a.sub.timestamp || 0),
        );

        setMyHistory(uniqueHistory);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setFetchingResults(false);
      }
    };
    fetchStudentHistory();
  }, [currentUser]);

  // ⚡ ON-DEMAND HEAVY FETCH (UNBREAKABLE & 100% ACCURATE POINTER)
  const handleOpenReport = async (historyItem, idx, e) => {
    e.stopPropagation();
    setOpeningResultId(idx);

    try {
      const safeUserKey = currentUser?.uid || "nouid";
      const testId = historyItem.test?.id || historyItem.test?.dbKey;
      const targetScore = Number(historyItem.sub?.score || 0);

      // 🛡️ UNBREAKABLE FALLBACKS: These guarantee the UI will ALWAYS open, no matter what!
      let fullTest = { ...historyItem.test, questions: [] };
      let fullSub = {
        ...historyItem.sub,
        name: currentUser?.displayName || "Student",
        roll: currentUser?.rollNo || historyItem.sub?.roll || "N/A",
        score: targetScore,
        totalMarks: Number(historyItem.test?.totalMarks || 100),
        details: historyItem.sub?.details || [], // Empty array ensures the "Synchronizing" UI shows safely
      };

      if (testId) {
        // 1. Safely fetch Metadata
        try {
          const metaSnap = await get(ref(database, `tests_metadata/${testId}`));
          if (metaSnap.exists()) {
            fullTest = { ...fullTest, ...metaSnap.val() };
          }
        } catch (err) {
          console.warn("Meta fetch skipped");
        }

        // 2. STRICTLY find the EXACT submission (No fuzzy guessing!)
        let foundDbSub = null;
        const exactStudentKey = historyItem.sub?.studentKey || safeUserKey;
        const rollKey = currentUser?.rollNo
          ? encodeURIComponent(currentUser.rollNo.trim().toLowerCase()).replace(
              /\./g,
              "_",
            )
          : null;

        // Try exact key first, then UID, then Roll Number
        const searchKeys = [exactStudentKey, safeUserKey, rollKey].filter(
          Boolean,
        );

        for (const key of searchKeys) {
          if (foundDbSub) break;
          try {
            const subSnap = await get(
              ref(database, `test_submissions/${testId}/submissions/${key}`),
            );
            if (subSnap.exists()) {
              const cand = subSnap.val();
              // THE STRICT LOCK: Only pick if the score EXACTLY matches the card clicked
              if (Math.abs(Number(cand.score || 0) - targetScore) < 0.1) {
                foundDbSub = cand;
              }
            }
          } catch (err) {
            /* ignore permission/network errors */
          }
        }

        // 3. Fallback to Legacy Tests (If old demo tests exist)
        if (!foundDbSub) {
          try {
            const token = auth.currentUser
              ? await auth.currentUser.getIdToken(true)
              : "";
            const recRes = await fetch("/api/exam/legacy/recover", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                testId,
                legacyKey: historyItem.test?.dbKey || testId,
              }),
            });

            if (recRes.ok) {
              const recData = await recRes.json();
              if (recData?.questions && Array.isArray(recData.questions)) {
                fullTest.questions = recData.questions;
              }
              if (recData?.submissions && Array.isArray(recData.submissions)) {
                foundDbSub = recData.submissions.find(
                  (s) =>
                    s &&
                    (s.uid === safeUserKey || s.email === currentUser?.email) &&
                    Math.abs(Number(s.score || 0) - targetScore) < 0.1, // THE STRICT LOCK FOR LEGACY
                );
              }
            }
          } catch (err) {
            console.warn("Legacy recovery fetch skipped:", err);
          }
        }

        // If found in DB, merge it perfectly into our fallback
        if (foundDbSub) {
          fullSub = { ...fullSub, ...foundDbSub };
          // Defensive check: If details are empty but questions & answers exist, construct details
          if (
            (!fullSub.details || fullSub.details.length === 0) &&
            Array.isArray(fullTest.questions) &&
            fullTest.questions.length > 0 &&
            Array.isArray(fullSub.answers)
          ) {
            fullSub.details = fullTest.questions.map((q, qIdx) => {
              const ansObj = fullSub.answers.find(
                (a) => String(a.qIndex) === String(qIdx),
              );
              const val = ansObj ? ansObj.val : "";
              return {
                q,
                ans: { val },
                status: val ? "submitted" : "skipped",
                earned: 0,
              };
            });
          }
        }

        if (
          (!fullTest.questions || fullTest.questions.length === 0) &&
          Array.isArray(fullSub.details) &&
          fullSub.details.length > 0
        ) {
          fullTest.questions = fullSub.details.map((d) => d.q).filter(Boolean);
        }
      }

      // 🛡️ ARCHITECTURE FIX: If questions are stripped (no options), recover full questions from backend!
      if (
        fullTest.questions && 
        fullTest.questions.length > 0 && 
        !fullTest.questions[0].options && 
        fullTest.questions[0].type !== "subjective"
      ) {
         try {
           const token = auth.currentUser ? await auth.currentUser.getIdToken(true) : "";
           const recRes = await fetch("/api/exam/legacy/recover", {
             method: "POST",
             headers: {
               "Content-Type": "application/json",
               ...(token ? { Authorization: `Bearer ${token}` } : {}),
             },
             body: JSON.stringify({
               testId: testId,
               legacyKey: historyItem.test?.dbKey || testId,
             }),
           });
           if (recRes.ok) {
             const recData = await recRes.json();
             if (recData?.questions && Array.isArray(recData.questions)) {
                fullTest.questions = recData.questions;
             }
           }
         } catch(e) {
           console.warn("Failed to inflate stripped questions", e);
         }
      }

      // 4. Force UI Render & Schema Alignment (Will NEVER say "not found" again)
      fullTest.totalMarks = Number(fullTest.totalMarks) || Number(fullSub.totalMarks) || 100;
      fullTest.title = fullTest.title || "Assessment";

      // 🛡️ CRASH GUARD: Ensure EVERY question has a fallback options array before giving it to React
      if (Array.isArray(fullTest.questions)) {
        fullTest.questions = fullTest.questions.map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : [],
        }));
      }

      setSelectedResult({ test: fullTest, sub: fullSub, canView: true });
    } catch (error) {
      console.error("Unbreakable Catch:", error);
      alert("A temporary glitch occurred, but your data is safe.");
    } finally {
      setOpeningResultId(null);
    }
  };

  //  PREMIUM EXAMITOP CERTIFICATE GENERATOR (1-Page Fix)
  const generateCertificate = () => {
    const { test, sub } = selectedResult;
    const pct = Math.round((sub.score / test.totalMarks) * 100);
    const dateOnly = sub.time.split(",")[0] || sub.time;

    let printHtml = `
    <html>
      <head>
        <title>ExamiTop_Certificate_${sub.roll || sub.name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Lora:ital,wght@0,500;0,700;1,400&display=swap');
          
          /* Strict 1-Page Landscape Print Settings */
          @page { size: A4 landscape; margin: 0; }
          html, body { margin: 0; padding: 0; width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; background: #fff; -webkit-print-color-adjust: exact; color-adjust: exact; overflow: hidden; }
          
          .cert-container { width: 100%; height: 100%; padding: 20px; box-sizing: border-box; }
          .cert-box { width: 100%; height: 100%; border: 12px solid #0B0F19; box-sizing: border-box; text-align: center; position: relative; background: #fff; outline: 3px solid #D4AF37; outline-offset: -22px; padding: 40px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          
          .header { font-family: 'Lora', serif; font-size: 48px; color: #0B0F19; margin-bottom: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
          .sub { font-family: 'Montserrat', sans-serif; font-size: 18px; color: #D4AF37; margin-bottom: 30px; letter-spacing: 4px; text-transform: uppercase; font-weight: 700; }
          
          .text { font-family: 'Lora', serif; font-size: 20px; color: #475569; margin-bottom: 15px; font-style: italic; }
          .name { font-family: 'Montserrat', sans-serif; font-size: 42px; color: #0B0F19; margin-bottom: 25px; font-weight: 700; border-bottom: 2px solid #D4AF37; padding-bottom: 10px; display: inline-block; min-width: 450px; }
          
          .desc { font-family: 'Montserrat', sans-serif; font-size: 18px; line-height: 1.6; color: #334155; max-width: 85%; margin: 0 auto 40px; }
          .highlight { font-weight: 700; color: #0B0F19; }
          
          .footer { display: flex; justify-content: space-between; width: 85%; position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); }
          .signature-box { text-align: center; }
          .signature { font-family: 'Lora', serif; font-size: 22px; color: #0B0F19; font-style: italic; margin-bottom: 5px; }
          .line { border-top: 2px solid #cbd5e1; width: 220px; padding-top: 8px; font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
          
          .seal { position: absolute; bottom: 35px; left: 50%; transform: translateX(-50%); width: 120px; height: 120px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; border: 2px dashed #D4AF37; box-shadow: 0 0 0 6px #0B0F19; color: #0B0F19; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 12px; flex-direction: column; }
          .seal-score { font-size: 26px; color: #D4AF37; margin: 4px 0; }
        </style>
      </head>
      <body>
        <div class="cert-container">
            <div class="cert-box">
              <div class="header">Certificate of Excellence</div>
              <div class="sub">ExamiTop &bull; Premium Assessment Platform</div>
              <div class="text">This is proudly presented to</div>
              <div class="name">${sub.name}</div>
              <div class="desc">
                for successfully clearing the <span class="highlight">${test.title}</span> examination on <span class="highlight">${dateOnly}</span>.<br><br>
                Demonstrating outstanding academic performance with a score of <span class="highlight">${sub.score} / ${test.totalMarks}</span> 
                (<span style="color: #D4AF37; font-weight: 700; font-size: 20px;">${pct}%</span>).
              </div>
              <div class="footer">
                 <div class="signature-box">
                    <div class="signature" style="font-family: monospace; font-size: 16px; color: #64748b; margin-top: 10px;">${test.code}</div>
                    <div class="line">Verification Hash</div>
                 </div>
                 <div class="signature-box">
                    <div class="signature">ExamiTop Engine</div>
                    <div class="line">Authorized System</div>
                 </div>
              </div>
              <div class="seal">
                  <span>SCORE</span>
                  <div class="seal-score">${pct}%</div>
                  <span style="font-size: 9px; letter-spacing: 1px;">EXAMITOP</span>
              </div>
            </div>
        </div>
        <script>
          window.onload = () => { setTimeout(() => { window.print(); }, 500); }
        </script>
      </body>
    </html>
    `;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();
    iframe.contentWindow.onafterprint = () => {
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 1000);
    };
  };

  // Smart Filter Changers (Pehle parda poora girega, fir 150ms baad data change hoga)
  const changeStatusFilter = (newFilter) => {
    if (newFilter === filter) return;
    setIsMathReady(false); // 1. Parda girao
    setTimeout(() => setFilter(newFilter), 150); // 2. Wait karo, fir data badlo
  };

  const changeSectionFilter = (newSec) => {
    if (newSec === sectionFilter) return;
    setIsMathReady(false); // 1. Parda girao
    setTimeout(() => setSectionFilter(newSec), 150); // 2. Wait karo, fir data badlo
  };

  // MathJax Auto-Renderer with Perfect Fade-In
  useEffect(() => {
    const renderMath = async () => {
      if (
        selectedResult &&
        typeof window !== "undefined" &&
        window.MathJax &&
        window.MathJax.typesetPromise
      ) {
        try {
          window.MathJax.typesetClear();
          await window.MathJax.typesetPromise();
        } catch (err) {
          console.log("MathJax Error:", err);
        } finally {
          // 3. MathJax banne ke 100ms baad parda uthao (Super smooth)
          setTimeout(() => setIsMathReady(true), 100);
        }
      } else {
        setIsMathReady(true);
      }
    };

    // Data change hone ke 50ms baad MathJax ko trigger karo
    const timer = setTimeout(renderMath, 50);
    return () => clearTimeout(timer);
  }, [selectedResult, filter, sectionFilter]);

  //  THE FIX 1: Premium Skeleton Loader for Student Results
  if (authLoading || fetchingResults) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 box-border">
        {/* Header Skeleton */}
        <div style={{ marginBottom: "2rem" }}>
          <div
            className="skeleton"
            style={{
              width: "250px",
              height: "36px",
              marginBottom: "8px",
              borderRadius: "8px",
            }}
          ></div>
          <div
            className="skeleton"
            style={{
              width: "380px",
              height: "18px",
              borderRadius: "6px",
              maxWidth: "100%",
            }}
          ></div>
        </div>

        {/* Result Cards Skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              style={{
                padding: "1.25rem 1.5rem",
                background: "var(--color-background-primary)",
                borderRadius: "12px",
                border: "1px solid var(--color-border-secondary)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    className="skeleton"
                    style={{
                      width: "200px",
                      height: "24px",
                      borderRadius: "6px",
                    }}
                  ></div>
                  <div
                    className="skeleton"
                    style={{
                      width: "70px",
                      height: "20px",
                      borderRadius: "12px",
                    }}
                  ></div>
                </div>
                <div
                  className="skeleton"
                  style={{
                    width: "150px",
                    height: "16px",
                    marginBottom: "10px",
                    borderRadius: "4px",
                  }}
                ></div>
                <div
                  className="skeleton"
                  style={{
                    width: "100px",
                    height: "18px",
                    borderRadius: "4px",
                  }}
                ></div>
              </div>
              <div>
                <div
                  className="skeleton"
                  style={{
                    width: "120px",
                    height: "36px",
                    borderRadius: "6px",
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "4rem",
          color: "var(--color-text-secondary)",
        }}
      >
        <i
          className="ti ti-lock"
          style={{
            fontSize: "48px",
            display: "block",
            marginBottom: "1rem",
            opacity: 0.5,
          }}
        ></i>
        <div style={{ fontSize: "16px", fontWeight: 500 }}>
          Please Login to view your results.
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: "1.5rem" }}
          onClick={() => router.push("/")}
        >
          Go to Home
        </button>
      </div>
    );
  }

  // Helpers for UI
  const getLabel = (type) =>
    ({
      mcq: "Single Correct",
      msq: "Multi Correct",
      integer: "Integer Type",
      subjective: "Subjective",
    })[type] || type;

  // ==========================================
  // VIEW 1: LIST OF PAST RESULTS (PREMIUM VAULT UI)
  // ==========================================
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
    if (
      s.includes("java") ||
      s.includes("network") ||
      s.includes("code") ||
      s.includes("test") ||
      s.includes("comp") ||
      s.includes("tech")
    ) {
      return {
        bg: "bg-sky-50 text-sky-700 border-sky-200",
        icon: "ti ti-terminal-2",
        label: subject,
      };
    }
    return {
      bg: "bg-slate-50 text-slate-700 border-slate-200",
      icon: "ti ti-book",
      label: subject || "General",
    };
  };

  if (!selectedResult) {
    const totalExams = myHistory.length;
    const evaluatedExams = myHistory.filter((h) =>
      isResultVisible(h.test, h.sub),
    );
    const evaluatedCount = evaluatedExams.length;
    const pendingCount = totalExams - evaluatedCount;

    let totalEarned = 0;
    let totalPossible = 0;
    evaluatedExams.forEach((h) => {
      totalEarned += Number(h.sub.score || 0);
      totalPossible += Number(h.test.totalMarks || 100);
    });
    const avgScorePct =
      totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    const uniqueSubjects = Array.from(
      new Set(
        myHistory.map((h) => h.test.subject || "General").filter(Boolean),
      ),
    );

    const filteredHistory = myHistory.filter((h) => {
      const isEval = isResultVisible(h.test, h.sub);
      if (statusFilter === "evaluated" && !isEval) return false;
      if (statusFilter === "pending" && isEval) return false;

      const subj = h.test.subject || "General";
      if (selectedSubject !== "all" && subj !== selectedSubject) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (h.test.title || "").toLowerCase().includes(q);
        const codeMatch = (h.test.code || "").toLowerCase().includes(q);
        const subMatch = subj.toLowerCase().includes(q);
        if (!titleMatch && !codeMatch && !subMatch) return false;
      }
      return true;
    });

    const sortedHistory = [...filteredHistory].sort((a, b) => {
      if (sortBy === "score") {
        const scoreA = Number(a.sub.score || 0);
        const scoreB = Number(b.sub.score || 0);
        return scoreB - scoreA;
      }
      const timeA = a.sub.timestamp || Date.parse(a.sub.time) || 0;
      const timeB = b.sub.timestamp || Date.parse(b.sub.time) || 0;
      return timeB - timeA;
    });

    return (
      <div className="w-full max-w-[1550px] mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 animate-[fadeIn_0.3s_ease]">
        {/* 🧭 TOP COMMAND BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shadow-sm">
              <i className="ti ti-file-analytics text-xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight leading-none">
                  Results & Solutions Vault
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  Performance Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Official answer keys, derivations, and question performance breakdowns
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => router.push("/student-dashboard")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <i className="ti ti-layout-dashboard text-sm"></i>
              <span>Dashboard</span>
            </button>
          </div>
        </div>

        {/* 🌟 1. PREMIUM WHITE HERO CARD (High-End SaaS Style) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03)] mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-2.5">
                <i className="ti ti-chart-dots text-xs"></i>
                In-Depth Assessment Analytics
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">
                Your Academic Results & Solutions
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-2xl">
                Review complete question papers with official answer keys, step-by-step LaTeX formula explanations, molecular chemistry figures, time spent per problem, and cohort leaderboards.
              </p>
            </div>

            {/* 4 Live Metric Pillars inside Hero */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
              {/* Exams Taken */}
              <div className="bg-slate-50/70 p-3 sm:p-3.5 rounded-xl border border-slate-200/70 text-center">
                <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none mb-1">
                  {totalExams}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Tests
                </div>
              </div>

              {/* Evaluated */}
              <div className="bg-emerald-50/60 p-3 sm:p-3.5 rounded-xl border border-emerald-200/70 text-center">
                <div className="text-xl sm:text-2xl font-black text-emerald-700 leading-none mb-1 flex items-center justify-center gap-1">
                  <span>{evaluatedCount}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Evaluated
                </div>
              </div>

              {/* Under Review */}
              <div className="bg-amber-50/60 p-3 sm:p-3.5 rounded-xl border border-amber-200/70 text-center">
                <div className="text-xl sm:text-2xl font-black text-amber-700 leading-none mb-1">
                  {pendingCount}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  In Review
                </div>
              </div>

              {/* Avg Score */}
              <div className="bg-blue-50/60 p-3 sm:p-3.5 rounded-xl border border-blue-200/70 text-center">
                <div className="text-xl sm:text-2xl font-black text-blue-700 leading-none mb-1">
                  {avgScorePct}%
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Avg Accuracy
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🔍 2. INTERACTIVE COMMAND & FILTER TOOLBAR */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-4 sm:mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              type="text"
              placeholder="Search by test title, subject, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:bg-white transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="ti ti-x text-xs"></i>
              </button>
            )}
          </div>

          {/* Filter Tabs & Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All ({totalExams})
              </button>
              <button
                onClick={() => setStatusFilter("evaluated")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === "evaluated"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Evaluated ({evaluatedCount})
              </button>
              <button
                onClick={() => setStatusFilter("pending")}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === "pending"
                    ? "bg-white text-amber-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                In Review ({pendingCount})
              </button>
            </div>

            {/* Subject Dropdown */}
            {uniqueSubjects.length > 1 && (
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:border-blue-400 shadow-xs"
              >
                <option value="all">All Subjects</option>
                {uniqueSubjects.map((sub, i) => (
                  <option key={i} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:border-blue-400 shadow-xs"
            >
              <option value="newest">Newest First</option>
              <option value="score">Highest Score</option>
            </select>
          </div>
        </div>

        {/* 🗂️ 3. RESULTS CARDS GRID */}
        {sortedHistory.length === 0 ? (
          <div className="bg-white rounded-2xl sm:rounded-3xl p-10 sm:p-14 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-4 text-3xl text-slate-400">
              <i className="ti ti-file-search"></i>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-800 mb-1 tracking-tight">
              {searchQuery || statusFilter !== "all" || selectedSubject !== "all"
                ? "No Matching Assessments Found"
                : "Results Vault is Empty"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed font-medium">
              {searchQuery || statusFilter !== "all" || selectedSubject !== "all"
                ? "Try clearing your search query or switching your filters."
                : "You haven't completed any assessments yet, or your test results are currently processing."}
            </p>
            {searchQuery || statusFilter !== "all" || selectedSubject !== "all" ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setSelectedSubject("all");
                }}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            ) : (
              <button
                onClick={() => router.push("/student")}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
              >
                <i className="ti ti-rocket"></i> Go to Active Arena
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
            {sortedHistory.map((h, idx) => {
              const subTimeMs = h.sub.timestamp || Date.parse(h.sub.time) || 0;
              const timeDiff = Date.now() - subTimeMs;
              const isRecent = timeDiff >= 0 && timeDiff < 180000;

              const validScore = Number(h.sub.score || 0);
              const validTotal = Number(h.test.totalMarks || 100);
              const pct =
                validTotal > 0
                  ? Math.round((validScore / validTotal) * 100)
                  : 0;
              const canViewNow = isResultVisible(h.test, h.sub);
              const isScheduled =
                h.test.resultVis === "scheduled" && h.test.resultPublishTime;

              const isOpen = openCardId === idx;
              const badge = getSubjectBadge(h.test.subject);

              // Distinct Status Themes
              const statusTheme = canViewNow
                ? {
                    border: "border-slate-200/90 hover:border-emerald-300",
                    accent: "bg-emerald-500",
                    pillBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    pillText: "Evaluated & Available",
                    icon: "ti-circle-check",
                    dropdownBg: "bg-emerald-50/20 border-emerald-100/70",
                    chevronActive:
                      "bg-emerald-600 text-white shadow-emerald-500/30",
                  }
                : isScheduled
                  ? {
                      border:
                        "border-blue-200/90 bg-blue-50/15 hover:border-blue-300",
                      accent: "bg-blue-500",
                      pillBg: "bg-blue-50 text-blue-700 border-blue-200",
                      pillText: "Scheduled Release",
                      icon: "ti-clock-play",
                      dropdownBg: "bg-blue-50/30 border-blue-200/60",
                      chevronActive:
                        "bg-blue-600 text-white shadow-blue-500/30",
                    }
                  : {
                      border:
                        "border-amber-200/90 bg-amber-50/15 hover:border-amber-300",
                      accent: "bg-amber-400",
                      pillBg: "bg-amber-50 text-amber-800 border-amber-200",
                      pillText: "Under Examiner Review",
                      icon: "ti-lock",
                      dropdownBg: "bg-amber-50/30 border-amber-200/60",
                      chevronActive:
                        "bg-amber-600 text-white shadow-amber-500/30",
                    };

              return (
                <div
                  key={idx}
                  className={`bg-white rounded-2xl border ${statusTheme.border} shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all overflow-hidden flex flex-col group ${
                    isRecent ? "ring-2 ring-blue-400 shadow-blue-500/10" : ""
                  }`}
                >
                  {/* Status Color Top Accent Stripe */}
                  <div className={`h-1.5 w-full ${statusTheme.accent}`}></div>

                  {/* VISIBLE CARD BODY */}
                  <div className="p-4 sm:p-5 flex flex-col justify-between flex-1">
                    <div>
                      {/* Top Badges Row */}
                      <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.bg}`}
                          >
                            <i className={badge.icon}></i> {badge.label}
                          </span>
                          {isRecent && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>{" "}
                              JUST NOW
                            </span>
                          )}
                        </div>

                        {/* Status Pill with distinct icon */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTheme.pillBg}`}
                        >
                          <i className={`ti ${statusTheme.icon} text-xs`}></i>
                          <span>{statusTheme.pillText}</span>
                        </span>
                      </div>

                      {/* Test Title */}
                      <h3
                        onClick={() =>
                          canViewNow &&
                          handleOpenReport(h, idx, {
                            stopPropagation: () => {},
                          })
                        }
                        className={`text-sm sm:text-base font-black text-slate-800 leading-snug line-clamp-2 mb-2 transition-colors ${
                          canViewNow
                            ? "cursor-pointer group-hover:text-blue-600"
                            : ""
                        }`}
                      >
                        {h.test.title}
                      </h3>

                      {/* Meta Information Row */}
                      <div className="flex items-center gap-2.5 text-[11px] font-medium text-slate-500 mb-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <i className="ti ti-calendar text-slate-400"></i>{" "}
                          {h.sub.time?.split(",")[0] || h.sub.time}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                          #{h.test.code || "EXAM"}
                        </span>
                      </div>
                    </div>

                    {/* Summary Row & Primary Action */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      {canViewNow ? (
                        <>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Score
                            </div>
                            <div className="text-base sm:text-lg font-black text-slate-900 leading-none mt-0.5">
                              {validScore}{" "}
                              <span className="text-xs font-semibold text-slate-400">
                                / {validTotal}
                              </span>
                              <span
                                className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  pct >= 75
                                    ? "bg-emerald-50 text-emerald-700"
                                    : pct >= 40
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-rose-50 text-rose-700"
                                }`}
                              >
                                {pct}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => handleOpenReport(h, idx, e)}
                              disabled={openingResultId === idx}
                              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-600/20 disabled:opacity-70"
                              title="Open Detailed Solutions & Analysis"
                            >
                              {openingResultId === idx ? (
                                <>
                                  <i className="ti ti-loader animate-spin text-xs"></i>
                                  <span>Loading...</span>
                                </>
                              ) : (
                                <>
                                  <span>Solutions</span>
                                  <i className="ti ti-arrow-right text-xs"></i>
                                </>
                              )}
                            </button>

                            {/* Dropdown Chevron Toggle */}
                            <button
                              onClick={() => setOpenCardId(isOpen ? null : idx)}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                                isOpen
                                  ? statusTheme.chevronActive
                                  : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600"
                              }`}
                              title={
                                isOpen ? "Collapse Details" : "Expand Details"
                              }
                            >
                              <i
                                className={`ti ti-chevron-down text-sm transition-transform duration-300 ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              ></i>
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                              Status
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-slate-700 mt-0.5 flex items-center gap-1">
                              <i className="ti ti-lock text-xs text-amber-500"></i>
                              <span>
                                {isScheduled ? "Scheduled" : "Held in Review"}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => setOpenCardId(isOpen ? null : idx)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              isOpen
                                ? statusTheme.chevronActive
                                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            }`}
                          >
                            <span>Details</span>
                            <i
                              className={`ti ti-chevron-down text-xs transition-transform duration-300 ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            ></i>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 🔽 EXPANDABLE DROPDOWN AREA (Color-coded by Status) */}
                  {isOpen && (
                    <div
                      className={`p-4 border-t text-xs animate-[fadeIn_0.2s_ease] ${statusTheme.dropdownBg}`}
                    >
                      {canViewNow ? (
                        <div className="flex flex-col gap-2.5">
                          <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-slate-200/80">
                            <div>
                              <div className="text-[10px] font-bold uppercase text-slate-400">
                                Date & Time
                              </div>
                              <div className="text-xs font-bold text-slate-800">
                                {h.sub.time}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase text-slate-400">
                                Accuracy & Score
                              </div>
                              <div className="text-xs font-bold text-slate-800">
                                {validScore} of {validTotal} Marks ({pct}%)
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => handleOpenReport(h, idx, e)}
                            disabled={openingResultId === idx}
                            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {openingResultId === idx ? (
                              <>
                                <i className="ti ti-loader animate-spin"></i>
                                <span>Loading Solution Paper...</span>
                              </>
                            ) : (
                              <>
                                <i className="ti ti-file-text"></i>
                                <span>Open Full Solution Paper & Keys</span>
                                <i className="ti ti-arrow-right text-xs"></i>
                              </>
                            )}
                          </button>
                        </div>
                      ) : isScheduled ? (
                        <div className="flex flex-col gap-2">
                          <div className="p-3 bg-white rounded-xl border border-blue-200 text-blue-900">
                            <div className="font-bold flex items-center gap-1.5 mb-1">
                              <i className="ti ti-calendar-time text-blue-600"></i>{" "}
                              Scheduled Release
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed m-0">
                              Official results and answers will publish
                              automatically on:{" "}
                              <strong className="text-blue-700">
                                {new Date(
                                  h.test.resultPublishTime,
                                ).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </strong>
                              . Please check back then.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="p-3 bg-white rounded-xl border border-amber-200 text-amber-900">
                            <div className="font-bold flex items-center gap-1.5 mb-1">
                              <i className="ti ti-info-circle text-amber-600"></i>{" "}
                              Results Under Review
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed m-0">
                              Your answers have been securely recorded. The test
                              examiner has placed results on hold until manual
                              evaluation is completed.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // VIEW 2: DETAILED RESULT ANALYSIS
  const { test: rawTest, sub } = selectedResult;

  const test = {
    ...rawTest,
    totalMarks: rawTest.totalMarks || sub.totalMarks || 100,
  };
  const pct =
    test.totalMarks > 0 ? Math.round((sub.score / test.totalMarks) * 100) : 0;
  const accuracy =
    sub.correct + sub.wrong > 0
      ? Math.round((sub.correct / (sub.correct + sub.wrong)) * 100)
      : 0;
  const maxH = Math.max(sub.correct, sub.wrong, sub.skipped, 1);
  const bH = (c) => Math.max(16, Math.round((c / maxH) * 80));

  const formatQTime = (seconds) => {
    if (!seconds) return "00s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  let displayTimeStr = sub.timeTaken || "00s";
  // 🛡️ CRASH GUARD: Ensure sub.details is a valid array
  if (sub.timeSpentPerQuestion && Array.isArray(sub.details)) {
    let totalSecs = 0;
    sub.details.forEach((d, idx) => {
      // 🛡️ FIX: Section Time mapped correctly from master questions
      const qIdx = d.q?.index !== undefined ? d.q.index : idx;
      const sec = test.questions?.[qIdx]?.section || d?.q?.section || test.sections?.[0] || "General";
      if (sectionFilter === "all_sections" || sec === sectionFilter) {
        totalSecs += Number(sub.timeSpentPerQuestion?.[qIdx] ?? sub.timeSpentPerQuestion?.[idx] ?? 0);
      }
    });
    if (totalSecs > 0) displayTimeStr = formatQTime(totalSecs);
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 animate-[fadeIn_0.3s_ease]">
      <button
        className="btn btn-ghost"
        style={{
          marginBottom: "1rem",
          padding: 0,
          fontWeight: 600,
          color: "var(--color-text-secondary)",
        }}
        onClick={() => {
          setSelectedResult(null);
          setSectionFilter("all_sections");
        }}
      >
        <i className="ti ti-arrow-left"></i> Back to Results
      </button>

      <div className="premium-hero">
        {/* Background Decorative Glow */}
        <div
          style={{
            position: "absolute",
            top: "-50px",
            right: "-50px",
            width: "200px",
            height: "200px",
            background: "rgba(255, 255, 255, 0.1)",
            filter: "blur(40px)",
            borderRadius: "50%",
          }}
        ></div>
        <div
          style={{
            position: "absolute",
            bottom: "-50px",
            left: "10%",
            width: "150px",
            height: "150px",
            background: "rgba(52, 211, 153, 0.2)",
            filter: "blur(40px)",
            borderRadius: "50%",
          }}
        ></div>

        {/* AREA 1: Left Info Section */}
        <div className="hero-info">
          <div
            className="pill-tag"
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              marginBottom: "12px",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            <i className="ti ti-notebook" style={{ color: "#fff" }}></i>{" "}
            {test.title}
          </div>

          <h2
            className="hero-title drop-shadow-sm"
            style={{ color: "#FFD54F" }}
          >
            {sub.name}
          </h2>

          <div className="hero-meta">
            {sub.roll && (
              <span>
                <i className="ti ti-id" style={{ opacity: 0.8 }}></i> {sub.roll}
              </span>
            )}
            {sub.roll && <span style={{ opacity: 0.5 }}>|</span>}
            <span>
              <i className="ti ti-calendar-time" style={{ opacity: 0.8 }}></i>{" "}
              {sub.time}
            </span>
          </div>
        </div>

        {/* AREA 2: Right Score Ring */}
        <div className="hero-score-wrapper">
          <div className="hero-score-ring">
            <div
              style={{
                position: "absolute",
                inset: "6px",
                borderRadius: "50%",
                border: "2px dashed rgba(255,255,255,0.4)",
              }}
            ></div>
            <div className="hero-score-val">{sub.score}</div>
            <div className="hero-score-lbl">/ {test.totalMarks}</div>
          </div>
        </div>

        {/* AREA 3: Bottom Tags Container */}
        <div className="hero-tags">
          {/*   DYNAMIC TIME PILL (Changes with Section Filter)   */}
          <div
            className="pill-tag"
            style={{
              background: "rgba(16,185,129,0.2)",
              borderColor: "rgba(16,185,129,0.4)",
              color: "#a7f3d0",
            }}
          >
            <i className="ti ti-stopwatch"></i>{" "}
            {sectionFilter === "all_sections"
              ? "Total Time: "
              : "Section Time: "}{" "}
            {displayTimeStr}
          </div>

          <div
            className="pill-tag"
            style={{
              background:
                pct >= 75
                  ? "rgba(52,211,153,0.2)"
                  : pct >= 40
                    ? "rgba(251,191,36,0.2)"
                    : "rgba(248,113,113,0.2)",
              borderColor:
                pct >= 75
                  ? "rgba(52,211,153,0.4)"
                  : pct >= 40
                    ? "rgba(251,191,36,0.4)"
                    : "rgba(248,113,113,0.4)",
            }}
          >
            <i className="ti ti-activity" style={{ fontSize: "14px" }}></i>{" "}
            {pct}% &bull;{" "}
            {pct >= 90
              ? "Excellent"
              : pct >= 75
                ? "Great Job"
                : pct >= 50
                  ? "Good Effort"
                  : pct >= 35
                    ? "Keep Practicing"
                    : "Needs Work"}
          </div>

          {pct >= 75 && (
            <button
              onClick={generateCertificate}
              className="pill-tag"
              style={{
                background: "#fff",
                color: "#185FA5",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.transform = "translateY(-2px)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.transform = "translateY(0)")
              }
            >
              <i
                className="ti ti-medal"
                style={{ color: "#d4af37", fontSize: "15px" }}
              ></i>{" "}
              Claim Certificate
            </button>
          )}
        </div>
      </div>

      {/*   PREMIUM CHEAT LOGS WARNING (Compact & Animated Dropdown)   */}
      {sub.cheatLogs && sub.cheatLogs.length > 0 && (
        <details
          className="group"
          style={{
            marginBottom: "1.5rem",
            background: "#fff",
            borderRadius: "12px",
            border:
              sub.cheatLogs.length >= 3
                ? "1px solid #ef4444"
                : "1px solid #fca5a5",
            boxShadow: "0 4px 15px rgba(239,68,68,0.05)",
            overflow: "hidden",
          }}
        >
          {/* Header (Summary) - Super Compact */}
          <summary
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              listStyle: "none",
              padding: "12px 16px",
              background: sub.cheatLogs.length >= 3 ? "#fef2f2" : "#fff",
              transition: "background 0.3s",
            }}
            className="[&::-webkit-details-marker]:hidden outline-none"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: sub.cheatLogs.length >= 3 ? "#ef4444" : "#fef2f2",
                  color: sub.cheatLogs.length >= 3 ? "#fff" : "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  flexShrink: 0,
                }}
              >
                <i className="ti ti-shield-x"></i>
              </div>
              <div>
                <h4
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: sub.cheatLogs.length >= 3 ? "#991b1b" : "#0f172a",
                    fontWeight: 800,
                  }}
                >
                  {sub.cheatLogs.length >= 3
                    ? "Exam Terminated Early (Violations)"
                    : "Security & Proctoring Alert"}
                </h4>
                <div
                  style={{
                    fontSize: "11px",
                    color: sub.cheatLogs.length >= 3 ? "#dc2626" : "#64748b",
                    fontWeight: 600,
                    marginTop: "1px",
                  }}
                >
                  System recorded suspicious activities. Click to view.
                </div>
              </div>
            </div>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: sub.cheatLogs.length >= 3 ? "#fca5a5" : "#f1f5f9",
                color: sub.cheatLogs.length >= 3 ? "#991b1b" : "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.3s",
              }}
              className="group-open:rotate-180"
            >
              <i className="ti ti-chevron-down text-sm"></i>
            </div>
          </summary>

          {/* Dropdown Content - Smooth Fade In Animation */}
          <div
            style={{
              padding: "0 16px 16px 16px",
              background: "#fff",
              borderTop:
                sub.cheatLogs.length >= 3
                  ? "1px solid #fecaca"
                  : "1px solid #f1f5f9",
            }}
            className="animate-[fadeIn_0.3s_ease]"
          >
            <div
              className="custom-scrollbar"
              style={{
                maxHeight: "180px",
                overflowY: "auto",
                paddingRight: "6px",
                marginTop: "12px",
              }}
            >
              {sub.cheatLogs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      background: "#fee2e2",
                      color: "#ef4444",
                      fontSize: "9px",
                      fontWeight: 800,
                      padding: "3px 6px",
                      borderRadius: "4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      flexShrink: 0,
                    }}
                  >
                    Warning {index + 1}
                  </div>
                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "10px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      flexShrink: 0,
                    }}
                  >
                    <i className="ti ti-clock"></i> {log.time}
                  </div>
                  <div
                    style={{
                      width: "1px",
                      height: "12px",
                      background: "#cbd5e1",
                      flexShrink: 0,
                    }}
                  ></div>
                  <div
                    style={{
                      color: "#334155",
                      fontSize: "12px",
                      fontWeight: 600,
                      flex: 1,
                      wordBreak: "break-word",
                    }}
                  >
                    {log.reason}
                  </div>
                </div>
              ))}
            </div>
            {sub.cheatLogs.length >= 3 && (
              <div
                style={{
                  background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                  color: "#fff",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
                  marginTop: "8px",
                }}
              >
                <i className="ti ti-ban" style={{ fontSize: "14px" }}></i>{" "}
                Auto-Submitted Due To Violations
              </div>
            )}
          </div>
        </details>
      )}

      {/*   PREMIUM SUMMARY DASHBOARD (V3 - THE ULTIMATE ANALYTICS)   */}
      {(() => {
        const totalAttempted = sub.correct + sub.wrong;
        const totalQs = sub.details
          ? sub.details.length
          : sub.correct + sub.wrong + sub.skipped;
        const percentage =
          test.totalMarks > 0
            ? ((sub.score / test.totalMarks) * 100).toFixed(1)
            : 0;
        const accuracyCalc =
          totalAttempted > 0
            ? ((sub.correct / totalAttempted) * 100).toFixed(1)
            : 0;
        const attemptRate =
          totalQs > 0 ? ((totalAttempted / totalQs) * 100).toFixed(1) : 0;
        // Secure Rank Calculation via Backend Leaderboard API
        let parsedSubmissions = [];
        if (test.submissions) {
          parsedSubmissions = Array.isArray(test.submissions)
            ? test.submissions.filter(Boolean)
            : Object.values(test.submissions).filter(Boolean);
        }
        const fallbackScores = parsedSubmissions.map((s) => s?.score || 0);
        const fallbackRank =
          fallbackScores.length > 0
            ? fallbackScores.filter((sc) => sc > sub.score).length + 1
            : 1;
        const fallbackTotal =
          fallbackScores.length > 0
            ? fallbackScores.length
            : test.submissionCount || 1;

        const myRank =
          leaderboardData.rank !== null
            ? leaderboardData.rank
            : leaderboardData.loading
              ? "..."
              : fallbackRank;
        const totalParticipants =
          leaderboardData.totalParticipants !== null
            ? leaderboardData.totalParticipants
            : leaderboardData.loading
              ? "..."
              : fallbackTotal;

        // Negative Marks Calculation
        const negMarks = (sub.wrong * (test.negMarking || 0)).toFixed(2);

        // Progress bar percentages
        const cPct = totalQs > 0 ? (sub.correct / totalQs) * 100 : 0;
        const wPct = totalQs > 0 ? (sub.wrong / totalQs) * 100 : 0;
        const sPct = totalQs > 0 ? (sub.skipped / totalQs) * 100 : 0;

        // Sectional Analysis & Finding Strengths/Weaknesses
        const sectionStats = {};
        let strongestSec = { name: "-", pct: -1 };
        let weakestSec = { name: "-", pct: 101 };

        if (sub.details) {
          sub.details.forEach((item, idx) => {
            // 🛡️ FIX: Analytics section mapped correctly from master questions
            const sec = test.questions?.[item.q?.index ?? idx]?.section || item.q?.section || "General";
            if (!sectionStats[sec])
              sectionStats[sec] = {
                score: 0,
                max: 0,
                correct: 0,
                total: 0,
                time: 0,
              };

            const qIdx = item.q?.index !== undefined ? item.q.index : idx;
            sectionStats[sec].total += 1;
            sectionStats[sec].max += Number(item.q?.marks || 0);
            sectionStats[sec].time += Number(sub.timeSpentPerQuestion?.[qIdx] ?? sub.timeSpentPerQuestion?.[idx] ?? 0);

            if (item.status === "correct" || item.status === "partial") {
              sectionStats[sec].score += Number(item.earned || 0);
              if (item.status === "correct") sectionStats[sec].correct += 1;
            } else if (item.status === "wrong") {
              sectionStats[sec].score += Number(item.earned || 0);
            }
          });

          // Calculate Strongest and Weakest Section
          const secKeys = Object.keys(sectionStats);
          if (secKeys.length > 1) {
            // Sirf tabhi batao jab 1 se zyada subjects hon
            secKeys.forEach((sec) => {
              const stat = sectionStats[sec];
              if (stat.max > 0) {
                const secPct = (stat.score / stat.max) * 100;
                if (secPct > strongestSec.pct) {
                  strongestSec = { name: sec, pct: secPct };
                }
                if (secPct < weakestSec.pct) {
                  weakestSec = { name: sec, pct: secPct };
                }
              }
            });
          }
        }

        return (
          <div
            style={{
              background: "#fff",
              padding: "1.25rem",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              marginBottom: "1.5rem",
              animation: "fadeIn 0.4s ease",
            }}
          >
            <h3
              style={{
                fontSize: "17px",
                color: "#0f172a",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <i
                className="ti ti-device-analytics"
                style={{ color: "#185FA5", fontSize: "20px" }}
              ></i>{" "}
              Performance Analytics
            </h3>
            {/*   MAC-STYLE SLEEK SCROLLBAR */}
            <style>{`
                      .premium-scroll::-webkit-scrollbar { height: 6px; }
                      .premium-scroll::-webkit-scrollbar-track { background: transparent; }
                      .premium-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                      .premium-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                  `}</style>

            {/* 📊 GRID 1: HORIZONTALLY SCROLLABLE METRICS (Phone Friendly & Premium) */}
            <div
              className="premium-scroll"
              style={{
                display: "flex",
                flexWrap: "nowrap",
                gap: "12px",
                overflowX: "auto",
                paddingBottom: "14px",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/*   NEW: Total Score Highlight Card */}
              <div
                style={{
                  flex: "0 0 auto",
                  minWidth: "160px",
                  background: "linear-gradient(135deg, #185FA5, #3C3489)",
                  padding: "12px",
                  borderRadius: "12px",
                  color: "#fff",
                  boxShadow: "0 4px 10px rgba(24,95,165,0.2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="ti ti-trophy"></i>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#e2e8f0",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Total Score
                  </div>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 800 }}>
                  {sub.score}{" "}
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#94a3b8",
                      fontWeight: 600,
                    }}
                  >
                    / {test.totalMarks}
                  </span>
                </div>
              </div>

              {/*Class Rank Card (Only if Examiner Published Ranks)*/}
              {test.ranksPublished && (
                <div
                  style={{
                    flex: "0 0 auto",
                    minWidth: "150px",
                    background: "linear-gradient(135deg, #6366f1, #4338ca)",
                    padding: "12px",
                    borderRadius: "12px",
                    color: "#fff",
                    boxShadow: "0 4px 10px rgba(99,102,241,0.2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                      }}
                    >
                      <i className="ti ti-medal"></i>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#e0e7ff",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      Your Rank
                    </div>
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 800 }}>
                    {myRank}{" "}
                    <span
                      style={{
                        fontSize: "14px",
                        color: "#a5b4fc",
                        fontWeight: 600,
                      }}
                    >
                      / {totalParticipants}
                    </span>
                  </div>
                </div>
              )}

              {/* Overall Percentage */}
              <div
                style={{
                  flex: "0 0 auto",
                  minWidth: "140px",
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background:
                        percentage >= 75
                          ? "#d1fae5"
                          : percentage >= 40
                            ? "#fef3c7"
                            : "#fee2e2",
                      color:
                        percentage >= 75
                          ? "#059669"
                          : percentage >= 40
                            ? "#d97706"
                            : "#dc2626",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="ti ti-percentage"></i>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Percentage
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  {percentage}%
                </div>
              </div>

              {/* Attempt Rate */}
              <div
                style={{
                  flex: "0 0 auto",
                  minWidth: "140px",
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "#ffedd5",
                      color: "#ea580c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="ti ti-flame"></i>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Attempt Rate
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  {attemptRate}%
                </div>
              </div>

              {/* Accuracy */}
              <div
                style={{
                  flex: "0 0 auto",
                  minWidth: "140px",
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "#e0e7ff",
                      color: "#4f46e5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="ti ti-target"></i>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Accuracy
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  {accuracyCalc}%
                </div>
              </div>

              {/* Negative Marks */}
              <div
                style={{
                  flex: "0 0 auto",
                  minWidth: "140px",
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "#fcebeb",
                      color: "#a32d2d",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                    }}
                  >
                    <i className="ti ti-minus"></i>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Negative
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "#a32d2d",
                  }}
                >
                  -{negMarks}
                </div>
              </div>

              {/*   NEW: Strongest Zone (If multiple sections exist) */}
              {Object.keys(sectionStats).length > 1 && strongestSec.pct > 0 && (
                <div
                  style={{
                    flex: "0 0 auto",
                    minWidth: "150px",
                    background: "#f8fafc",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "#d1fae5",
                        color: "#059669",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                      }}
                    >
                      <i className="ti ti-trending-up"></i>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#64748b",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      Strongest
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 800,
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {strongestSec.name}
                  </div>
                </div>
              )}

              {/*   NEW: Needs Work (Weakest Zone) */}
              {Object.keys(sectionStats).length > 1 &&
                weakestSec.name !== "-" && (
                  <div
                    style={{
                      flex: "0 0 auto",
                      minWidth: "150px",
                      background: "#f8fafc",
                      padding: "12px",
                      borderRadius: "12px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background: "#fee2e2",
                          color: "#dc2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "14px",
                        }}
                      >
                        <i className="ti ti-trending-down"></i>
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}
                      >
                        Needs Work
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {weakestSec.name}
                    </div>
                  </div>
                )}
            </div>

            {/* 📊 GRID 2: COMPACT QUESTION DISTRIBUTION */}
            <div
              style={{
                marginTop: "0.5rem",
                background: "#f8fafc",
                padding: "15px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#475569",
                  marginBottom: "10px",
                }}
              >
                <span>Questions Distribution</span>
                <span>
                  Attempted: {totalAttempted} / {totalQs}
                </span>
              </div>

              {/* Stacked Progress Bar (Lighter Pastel Colors) */}
              <div
                style={{
                  display: "flex",
                  height: "14px",
                  borderRadius: "10px",
                  overflow: "hidden",
                  background: "#f1f5f9",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    width: `${cPct}%`,
                    background: "#34d399",
                    transition: "width 1s ease",
                  }}
                ></div>{" "}
                {/* Soft Green */}
                <div
                  style={{
                    width: `${wPct}%`,
                    background: "#fca5a5",
                    transition: "width 1s ease",
                  }}
                ></div>{" "}
                {/* Soft Red */}
                <div
                  style={{
                    width: `${sPct}%`,
                    background: "#cbd5e1",
                    transition: "width 1s ease",
                  }}
                ></div>{" "}
                {/* Soft Grey */}
              </div>

              {/* Legends with Values */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    color: "#059669",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <i
                    className="ti ti-circle-check-filled"
                    style={{ fontSize: "14px" }}
                  ></i>{" "}
                  {sub.correct} Correct
                </span>
                <span
                  style={{
                    color: "#dc2626",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <i
                    className="ti ti-circle-x-filled"
                    style={{ fontSize: "14px" }}
                  ></i>{" "}
                  {sub.wrong} Wrong
                </span>
                <span
                  style={{
                    color: "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <i
                    className="ti ti-minus-circle"
                    style={{ fontSize: "14px" }}
                  ></i>{" "}
                  {sub.skipped} Skipped
                </span>
              </div>
            </div>

            {/* 📊 GRID 3: SWIPEABLE SECTION BREAKDOWN */}
            {Object.keys(sectionStats).length > 0 && (
              <div
                style={{
                  borderTop: "1px dashed #cbd5e1",
                  paddingTop: "1.25rem",
                  marginTop: "1.25rem",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#475569",
                    marginBottom: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Section-wise Scores
                </div>

                <div
                  className="premium-scroll"
                  style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    gap: "10px",
                    overflowX: "auto",
                    paddingBottom: "14px",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {Object.keys(sectionStats).map((sec, idx) => {
                    const stat = sectionStats[sec];
                    const secPercent =
                      stat.max > 0
                        ? ((stat.score / stat.max) * 100).toFixed(0)
                        : 0;

                    return (
                      <div
                        key={idx}
                        style={{
                          flex: "0 0 auto",
                          minWidth: "220px",
                          background: "#f1f5f9",
                          padding: "12px 15px",
                          borderRadius: "10px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <i
                              className="ti ti-folder"
                              style={{ color: "#185FA5", fontSize: "16px" }}
                            ></i>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#334155",
                                fontSize: "13px",
                                maxWidth: "90px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {sec}
                            </span>
                          </div>
                          {/*SECTION TIME BADGE*/}
                          <div
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#64748b",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "#e2e8f0",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              width: "fit-content",
                            }}
                          >
                            <i className="ti ti-stopwatch"></i>{" "}
                            {formatQTime(stat.time)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: "15px",
                              fontWeight: 900,
                              color: "#0f172a",
                            }}
                          >
                            {stat.score}{" "}
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#64748b",
                              }}
                            >
                              / {stat.max}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              background:
                                secPercent >= 75
                                  ? "#d1fae5"
                                  : secPercent >= 40
                                    ? "#fef3c7"
                                    : "#fee2e2",
                              color:
                                secPercent >= 75
                                  ? "#065f46"
                                  : secPercent >= 40
                                    ? "#92400e"
                                    : "#991b1b",
                              padding: "2px 6px",
                              borderRadius: "12px",
                              display: "inline-block",
                              marginTop: "4px",
                            }}
                          >
                            {secPercent}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/*   MINIMALIST & ADVANCED FILTERS (iOS/Apple Style)   */}
      <div className="mb-6 border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4">
          {/* Header & Status Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="text-[17px] font-extrabold text-slate-800 flex items-center gap-2 tracking-tight">
              <i className="ti ti-adjustments-horizontal text-blue-600 text-xl"></i>{" "}
              Review Filters
            </h3>

            {(() => {
              // 🛡️ CRASH GUARD: Defensive Array Fallback
              const safeDetails = Array.isArray(sub.details) ? sub.details : [];

              // 🛡️ FIX: Badge counts mapped correctly from master questions
              const secDetails = safeDetails.filter((d, idx) => {
                const qSec = test.questions?.[d.q?.index !== undefined ? d.q.index : idx]?.section || d?.q?.section || test.sections?.[0] || "General";
                return sectionFilter === "all_sections" || qSec === sectionFilter;
              });
              const countAll = secDetails.length;
              const countCorrect = secDetails.filter(
                (d) => d.status === "correct" || d.status === "partial",
              ).length;
              const countWrong = secDetails.filter(
                (d) => d.status === "wrong",
              ).length;
              const countSkipped = secDetails.filter(
                (d) =>
                  d.status === "skipped" ||
                  d.status === "submitted" ||
                  d.status === "evaluated",
              ).length;

              return (
                <div className="inline-flex bg-slate-100/80 p-1.5 rounded-xl overflow-x-auto scrollbar-hide -webkit-overflow-scrolling-touch border border-slate-200/60 w-full md:w-auto">
                  <button
                    className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${filter === "all" ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-800"}`}
                    onClick={() => changeStatusFilter("all")}
                  >
                    All{" "}
                    <span
                      className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${filter === "all" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"}`}
                    >
                      {countAll}
                    </span>
                  </button>

                  <button
                    className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${filter === "correct" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-800"}`}
                    onClick={() => changeStatusFilter("correct")}
                  >
                    Correct{" "}
                    <span
                      className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${filter === "correct" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}
                    >
                      {countCorrect}
                    </span>
                  </button>

                  <button
                    className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${filter === "wrong" ? "bg-white text-rose-700 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-800"}`}
                    onClick={() => changeStatusFilter("wrong")}
                  >
                    Wrong{" "}
                    <span
                      className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${filter === "wrong" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-500"}`}
                    >
                      {countWrong}
                    </span>
                  </button>

                  <button
                    className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${filter === "skipped" ? "bg-white text-slate-800 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-800"}`}
                    onClick={() => changeStatusFilter("skipped")}
                  >
                    Skipped{" "}
                    <span
                      className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${filter === "skipped" ? "bg-slate-200 text-slate-800" : "bg-slate-200 text-slate-500"}`}
                    >
                      {countSkipped}
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Section Filters (Sleek Pills) */}
          {test.sections && test.sections.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -webkit-overflow-scrolling-touch">
              <button
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 border ${sectionFilter === "all_sections" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                onClick={() => changeSectionFilter("all_sections")}
              >
                All Sections
              </button>
              {test.sections.map((sec, idx) => (
                <button
                  key={idx}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 border ${sectionFilter === sec ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                  onClick={() => changeSectionFilter(sec)}
                >
                  {sec}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/*   HYPER-VIBRANT QUESTION REVIEW CARDS (COMPACT SPLIT-GRID)   */}
      <div
        style={{
          opacity: isMathReady ? 1 : 0,
          transition: "opacity 0.3s ease-in",
          minHeight: "50vh",
        }}
        className="flex flex-col gap-5 sm:gap-6"
      >
        {/*   CSS Hack: Force SVG to scale properly without overflowing */}
        <style>{`
            .svg-eval-container svg { max-width: 100%; height: auto; max-height: 280px; min-height: 100px; }
        `}</style>

        {/* 🔥 OPTIMIZATION & CRASH GUARD: Safe Array Mapping */}
        {(Array.isArray(sub.details) ? sub.details : [])
          .map((d, index) => ({ d, originalQIdx: index }))
          .filter(({ d, originalQIdx }) => {
            let sMatch =
              filter === "all" ||
              d.status === filter ||
              (filter === "skipped" &&
                (d.status === "submitted" || d.status === "evaluated"));
            
            // 🛡️ FIX: Always look up the section from the master test questions array
            const qSec = test.questions?.[d.q?.index !== undefined ? d.q.index : originalQIdx]?.section || d?.q?.section || test.sections?.[0] || "General";
            let secMatch = sectionFilter === "all_sections" || qSec === sectionFilter;
            
            return sMatch && secMatch;
          })
          // 🛡️ ARCHITECTURE FIX: Join stripped submission reference with master test questions!
          .map(({ d, originalQIdx }, i) => {
            const masterQ = test.questions?.[d.q?.index !== undefined ? d.q.index : originalQIdx];
            const q = masterQ || d.q || {};
            const ans = d.ans || { val: "" };

            // Super Vibrant Colors
            const sProps = {
              correct: {
                grad: "from-emerald-400 to-teal-500",
                bg: "bg-emerald-50/50",
                text: "text-emerald-700",
                icon: "ti-circle-check",
                badgeBg: "bg-emerald-600",
              },
              wrong: {
                grad: "from-rose-500 to-red-500",
                bg: "bg-rose-50/50",
                text: "text-rose-700",
                icon: "ti-circle-x",
                badgeBg: "bg-rose-600",
              },
              partial: {
                grad: "from-amber-400 to-orange-500",
                bg: "bg-amber-50/50",
                text: "text-amber-700",
                icon: "ti-adjustments-alt",
                badgeBg: "bg-amber-600",
              },
              evaluated: {
                grad: "from-blue-500 to-indigo-600",
                bg: "bg-blue-50/50",
                text: "text-blue-700",
                icon: "ti-pencil",
                badgeBg: "bg-blue-600",
              },
              submitted: {
                grad: "from-blue-500 to-indigo-600",
                bg: "bg-blue-50/50",
                text: "text-blue-700",
                icon: "ti-pencil",
                badgeBg: "bg-blue-600",
              },
              skipped: {
                grad: "from-slate-400 to-slate-500",
                bg: "bg-slate-50",
                text: "text-slate-600",
                icon: "ti-minus",
                badgeBg: "bg-slate-600",
              },
            };

            const sp = sProps[d.status] || sProps.skipped;
            const statusLabel =
              d.status === "correct"
                ? "Correct"
                : d.status === "wrong"
                  ? "Wrong"
                  : d.status === "partial"
                    ? "Partial"
                    : d.status === "evaluated"
                      ? "Evaluated"
                      : d.status === "submitted"
                        ? "Pending"
                        : d.status === "extra_optional_ignored"
                          ? "Optional (Ignored)"
                          : "Skipped";
            const earnedStr =
              d.earned > 0
                ? "+" + d.earned
                : d.earned < 0
                  ? "" + d.earned
                  : "0";

            let userSel = Array.isArray(ans.val)
              ? ans.val
              : ans.val !== null
                ? [ans.val]
                : [];
            let corrSel = q.correct || [];

            return (
              <div
                key={i}
                className="relative bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] group"
              >
                {/* Vibrant Top Accent Line */}
                <div
                  className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${sp.grad}`}
                ></div>

                {/* Compact Header */}
                <div
                  className={`px-4 py-3 ${sp.bg} border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1`}
                >
                  <div
                    className={`flex items-center gap-2 font-black ${sp.text} text-[15px]`}
                  >
                    <i className={`ti ${sp.icon} text-[20px]`}></i>
                    <span>
                      Q{originalQIdx + 1}{" "}
                      <span className="opacity-40 mx-1">|</span>{" "}
                      <span className="font-semibold text-xs uppercase tracking-wide">
                        {getLabel(q.type)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <span
                      className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-white border border-slate-200 text-slate-600 shadow-sm flex items-center gap-1.5"
                      title="Time taken on this question"
                    >
                      <i className="ti ti-stopwatch text-slate-400 text-sm"></i>
                      {formatQTime(sub.timeSpentPerQuestion?.[originalQIdx])}
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-extrabold text-white shadow-sm ${sp.badgeBg}`}
                    >
                      {statusLabel}
                    </span>
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-slate-800 text-white shadow-sm flex items-center gap-1">
                      <i className="ti ti-target"></i> {earnedStr} Marks
                    </span>
                  </div>
                </div>

                {/* Body Section (SPLIT-GRID FOR LAPTOPS) */}
                <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 w-full">
                  {/* === LEFT COLUMN: Question Text & Figure === */}
                  <div className="flex flex-col gap-4">
                    <StaticMath
                      isBlock={true}
                      html={q.text}
                      className="text-[14px] sm:text-[15.5px] leading-relaxed text-slate-800 font-semibold whitespace-normal break-words"
                    />

                    {/* Universal Compact Figure Engine (With SVG/URL Fixes) */}
                    {q.figureType &&
                      q.figureType !== "none" &&
                      q.figureData && (
                        <div className="flex justify-center w-full bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                          {(q.figureType === "image" ||
                            q.figureType === "url") && (
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                              <img
                                src={q.figureData}
                                alt="Figure"
                                className="max-w-full max-h-[220px] object-contain"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  // 🔥 OPTIMIZATION: 100% Offline SVG Fallback
                                  e.target.src =
                                    "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23ef4444' font-family='sans-serif' font-weight='bold'%3EImage Load Failed (Offline)%3C/text%3E%3C/svg%3E";
                                }}
                              />
                            </div>
                          )}
                          {q.figureType === "svg" && (
                            <div
                              className="svg-eval-container w-full bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-center overflow-x-auto"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeSvg(q.figureData),
                              }}
                            />
                          )}
                          {q.figureType === "smiles" && (
                            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm inline-block">
                              <SmilesViewer
                                smilesCode={q.figureData}
                                width={200}
                                height={200}
                              />
                            </div>
                          )}
                          {q.figureType === "tikz" && (
                            <div className="hide-scroll max-w-full overflow-x-auto bg-white p-2 rounded-lg border border-slate-200 shadow-sm inline-block">
                              <img
                                src={`https://i.upmath.me/svg/${encodeURIComponent(
                                  q.figureData.includes("\\begin{tikzpicture}")
                                    ? q.figureData
                                    : "\\begin{tikzpicture}\n" +
                                        q.figureData +
                                        "\n\\end{tikzpicture}",
                                )}`}
                                alt="Math Graphic"
                                className="max-w-full max-h-[200px] object-contain"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  // 🔥 OPTIMIZATION: 100% Offline SVG Fallback for Tikz
                                  e.target.src =
                                    "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='200'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23ef4444' font-family='sans-serif' font-weight='bold'%3ETikZ Compilation Failed (Offline)%3C/text%3E%3C/svg%3E";
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                    {/* Fallback Legacy Image */}
                    {!q.figureType && q.imgUrl && (
                      <div className="flex justify-center w-full bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                        <img
                          src={q.imgUrl}
                          className="max-w-full max-h-[220px] rounded-lg border border-slate-200 object-contain bg-white shadow-sm"
                          alt="Legacy Figure"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src =
                              "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23ef4444' font-family='sans-serif' font-weight='bold'%3EImage Load Failed (Offline)%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* === RIGHT COLUMN: Options, Explanation, & Audit === */}
                  <div className="flex flex-col gap-4">
                    {/* MCQ / MSQ Options */}
                    <div className="flex flex-col gap-2.5">
                      {/* 🛡️ CRASH GUARD: Ensure options is always an array before mapping */}
                      {(q.type === "mcq" || q.type === "msq") &&
                        Array.isArray(q.options) &&
                        q.options.map((o, j) => {
                          let isUser = userSel.includes(j);
                          let isCorr = corrSel.includes(j);

                          let optBg =
                              "bg-slate-50 hover:bg-slate-100 border-slate-200",
                            optText = "text-slate-700",
                            iconUi = null;
                          if (isCorr && isUser) {
                            optBg =
                              "bg-emerald-50 border-emerald-500 shadow-[0_0_0_1px_#10b981]";
                            optText = "text-emerald-900 font-bold";
                            iconUi = (
                              <i className="ti ti-check text-xl text-emerald-600"></i>
                            );
                          } else if (isCorr && !isUser) {
                            optBg =
                              "bg-white border-emerald-400 border-dashed border-2";
                            optText = "text-emerald-800 font-bold";
                            iconUi = (
                              <i className="ti ti-check text-xl text-emerald-400 opacity-60"></i>
                            );
                          } else if (!isCorr && isUser) {
                            optBg =
                              "bg-rose-50 border-rose-500 shadow-[0_0_0_1px_#ef4444]";
                            optText = "text-rose-900 font-bold";
                            iconUi = (
                              <i className="ti ti-x text-xl text-rose-600"></i>
                            );
                          }

                          return (
                            <div
                              key={j}
                              className={`flex items-start gap-3 p-3 rounded-xl border-2 ${optBg} transition-all duration-200 w-full overflow-hidden`}
                            >
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border-2 bg-white ${isCorr && isUser ? "border-emerald-500 text-emerald-600 shadow-sm" : !isCorr && isUser ? "border-rose-500 text-rose-600 shadow-sm" : "border-slate-300 text-slate-500"}`}
                              >
                                {String.fromCharCode(65 + j)}
                              </div>
                              <div className="flex-1 flex flex-col gap-1.5 min-w-0 pt-0.5">
                                {String(o || "").startsWith("[smiles]") ? (
                                  <div className="pointer-events-none bg-white p-1.5 rounded-lg border border-slate-200 inline-block w-fit">
                                    <SmilesViewer
                                      smilesCode={o
                                        .replace("[smiles]", "")
                                        .trim()}
                                      width={120}
                                      height={120}
                                    />
                                  </div>
                                ) : (
                                  <StaticMath
                                    isBlock={true}
                                    html={o}
                                    className={`text-[14px] sm:text-[14.5px] whitespace-normal break-words ${optText}`}
                                  />
                                )}
                                {(isUser || isCorr) && (
                                  <div className="flex gap-2 flex-wrap mt-1">
                                    {isUser && (
                                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-sm">
                                        <i className="ti ti-hand-click"></i>{" "}
                                        Picked
                                      </span>
                                    )}
                                    {isCorr && (
                                      <span className="text-[9px] uppercase tracking-wider font-extrabold bg-emerald-500 text-white px-1.5 py-0.5 rounded shadow-sm">
                                        <i className="ti ti-key"></i> Key
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="mt-0.5 flex-shrink-0">
                                {iconUi}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Integer Type */}
                    {q.type === "integer" && (
                      <div className="flex gap-3 mt-1">
                        <div
                          className={`flex-1 p-3 sm:p-4 rounded-xl border-2 flex flex-col justify-center ${d.status === "correct" ? "bg-emerald-50 border-emerald-400 text-emerald-900" : "bg-rose-50 border-rose-400 text-rose-900"}`}
                        >
                          <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-70 mb-0.5">
                            Your Answer
                          </span>
                          <strong className="text-2xl">
                            {ans.val !== null ? ans.val : "—"}
                          </strong>
                        </div>
                        <div className="flex-1 p-3 sm:p-4 rounded-xl border-2 border-emerald-400 bg-white text-emerald-900 flex flex-col justify-center relative overflow-hidden shadow-sm">
                          <i className="ti ti-key absolute -right-2 -bottom-2 text-5xl text-emerald-50"></i>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-70 mb-0.5 relative z-10">
                            Correct
                          </span>
                          <strong className="text-2xl relative z-10">
                            {q.correctInt}
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* Subjective Type */}
                    {q.type === "subjective" && (
                      <div className="flex flex-col gap-3 mt-1">
                        <div className="p-4 rounded-xl border-2 bg-slate-50 border-slate-200 flex gap-3 items-start">
                          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <i className="ti ti-pencil text-slate-700 text-lg"></i>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 mb-1 block">
                              Your Answer
                            </span>
                            <span className="text-[14px] leading-relaxed text-slate-800 font-medium">
                              {ans.val || (
                                <em className="text-slate-400">No answer.</em>
                              )}
                            </span>
                          </div>
                        </div>
                        {q.modelAnswer && (
                          <div className="p-4 rounded-xl border-2 bg-emerald-50 border-emerald-300 flex gap-3 items-start">
                            <div className="w-8 h-8 rounded-full bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0 shadow-sm">
                              <i className="ti ti-bulb text-emerald-600 text-lg"></i>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 mb-1 block">
                                Model Answer
                              </span>
                              <span className="text-[14px] leading-relaxed text-emerald-900 font-medium">
                                {q.modelAnswer}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explanation Accordion */}
                    {q.explanation && (
                      <details className="group rounded-xl border border-indigo-100 overflow-hidden transition-all duration-300 bg-white shadow-sm mt-1">
                        <summary className="cursor-pointer p-3 sm:p-4 font-bold text-indigo-700 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 transition-colors select-none">
                          <span className="flex items-center gap-2 text-[13px] sm:text-[14px]">
                            <i className="ti ti-bulb text-lg text-indigo-500"></i>{" "}
                            Solution / Logic
                          </span>
                          <div className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-600 group-open:bg-indigo-600 group-open:text-white transition-all duration-300 transform group-open:rotate-180">
                            <i className="ti ti-chevron-down text-sm"></i>
                          </div>
                        </summary>
                        <div className="p-4 sm:p-5 border-t border-indigo-100 text-[13.5px] sm:text-[14px] text-slate-800 leading-relaxed font-medium bg-white">
                          <StaticMath
                            isBlock={true}
                            html={q.explanation}
                            className="math-scroll-box"
                          />
                        </div>
                      </details>
                    )}

                    {/*SLEEK AUDIT LOG*/}
                    {d.auditLogs && d.auditLogs.length > 0 && (
                      <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col gap-2">
                        <div className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <i className="ti ti-history text-sm"></i> Evaluation
                            Audit Trail
                          </span>
                        </div>

                        {d.auditLogs.map((log, lIdx) => (
                          <div
                            key={lIdx}
                            className="bg-white px-3 py-2.5 rounded-lg border border-slate-200 flex flex-col gap-1 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-[12px]">
                                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black shrink-0 border border-emerald-200 shadow-inner">
                                  {log.awarded} Mks
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                                  {log.examiner?.split("@")[0] || "Examiner"}
                                </span>
                              </div>
                              <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">
                                {log.date?.split(",")[0]}
                              </div>
                            </div>
                            <div className="text-[12px] font-semibold text-slate-600 italic leading-snug pl-1 border-l-2 border-slate-200 ml-1">
                              "{log.reason}"
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        {(!Array.isArray(sub.details) || sub.details.length === 0) && (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2">
            <i className="ti ti-clock-hour-4 text-3xl text-amber-500"></i>
            <h4 className="text-base font-bold text-slate-800">
              Detailed Question Analysis Synchronizing
            </h4>
            <p className="text-xs text-slate-500 max-w-md">
              Your overall score, subject analytics, and Certificate of
              Excellence are fully computed above. Question-level breakdown will
              populate once sync completes.
            </p>
          </div>
        )}
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          title="Back to Top"
          style={{
            position: "fixed",
            bottom: "30px",
            right: "30px",
            zIndex: 9998,
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #185FA5, #3C3489)",
            color: "#fff",
            border: "none",
            boxShadow: "0 10px 25px rgba(24,95,165,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            animation: "fadeIn 0.3s ease",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 15px 30px rgba(24,95,165,0.5)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 10px 25px rgba(24,95,165,0.4)";
          }}
        >
          <i className="ti ti-arrow-up" style={{ fontSize: "24px" }}></i>
        </button>
      )}
    </div>
  );
}
