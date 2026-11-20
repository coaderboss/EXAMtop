// src/app/student/page.js
"use client";
import { useState, useEffect, useRef, useMemo, memo, Suspense } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useRouter, useSearchParams } from "next/navigation";
import { database, auth } from "../../lib/firebase";
import {
  ref,
  push,
  set,
  get,
  onDisconnect,
  remove,
  query,
  orderByChild,
  equalTo,
  onValue,
} from "firebase/database";
import SmilesViewer from "../../components/SmilesViewer";
import { sanitizeSvg } from "../../lib/sanitizeSvg";

// THE MASTER FIX: MathJax React Re-render Protector
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

function StudentPortalContent() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const { fetchSingleTest } = useData();
  const router = useRouter();
  const searchParams = useSearchParams(); //   NAYA: URL Params Reader

  const [isMounted, setIsMounted] = useState(false);
  const [isFetchingTest, setIsFetchingTest] = useState(false);
  const autoJoinTriggered = useRef(false); //   Prevent infinite loop

  //  Examiner Demo Detection: checks userRole, URL query param, and sessionStorage
  const isExaminerDemo =
    userRole === "examiner" ||
    userRole === "admin" ||
    searchParams.get("demo") === "true" ||
    (typeof window !== "undefined" &&
      sessionStorage.getItem("examitop_demo_examiner") === "true");

  // --- SCREEN STATES ---
  const [step, setStep] = useState("join");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [draftToResume, setDraftToResume] = useState(null);
  const [paletteFilter, setPaletteFilter] = useState("all"); // "all" | "answered" | "marked" | "pending"
  const [visitedQs, setVisitedQs] = useState({ 0: true });

  // --- RESCUE / AUTO-HEAL STATE ---
  const [rescueState, setRescueState] = useState({
    active: false,
    status: "idle", // "idle" | "rescuing" | "success" | "error" | "not_found"
    message: "",
  });
  const rescueAttemptedRef = useRef(false);

  // --- FORM STATES ---
  const [name, setName] = useState("");
  const [roll, setRoll] = useState("");
  const [code, setCode] = useState("");
  const [activeTest, setActiveTest] = useState(null);
  const [isDirectJoin, setIsDirectJoin] = useState(false);

  // --- EXAM ENGINE STATES ---
  const [curQ, setCurQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [showRoughPad, setShowRoughPad] = useState(false);
  const [roughText, setRoughText] = useState("");

  //   NAYA: Figure Loading State (For TikZ & Images)
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoomFigure, setZoomFigure] = useState(null);

  // --- CUSTOM POPUPS & ALERTS ---
  const [joinError, setJoinError] = useState("");
  const [cheatWarning, setCheatWarning] = useState(null);
  const [sysModal, setSysModal] = useState(null);
  const [qTime, setQTime] = useState({});
  const [isDeviceOnline, setIsDeviceOnline] = useState(true);
  const [rulesAgreed, setRulesAgreed] = useState(true);

  // --- REFS ---
  const timerRef = useRef(null);
  const endTimeRef = useRef(null);
  const serverStartTimeRef = useRef(null);
  const serverOffsetRef = useRef(0);
  const warningsRef = useRef(0);
  const cheatLogsRef = useRef([]);
  const lastWarningTimeRef = useRef(0);
  const isActionLockedRef = useRef(false);
  const sessionUidRef = useRef(null);
  const presenceRefTarget = useRef(null);
  const handleFinalSubmitRef = useRef(null);

  // 🛡️ TRUE SERVER TIME (Google Atomic Clock Sync - Prevents Local Machine Clock Tampering)
  const getTrueNow = () => Date.now() + (serverOffsetRef.current || 0);

  // Maximum allowed questions based on section rules (Defined at component top to follow Rules of Hooks)
  const maxAllowedQuestions = useMemo(() => {
    if (!activeTest?.questions) return 0;
    if (
      !activeTest?.sectionRules ||
      Object.keys(activeTest.sectionRules).length === 0
    ) {
      return activeTest.questions.length;
    }
    const secs =
      activeTest.sections && activeTest.sections.length > 0
        ? activeTest.sections
        : [activeTest.questions[0]?.section || "General"];
    let total = 0;
    secs.forEach((sec) => {
      const secQs = activeTest.questions.filter(
        (q) => (q.section || secs[0]) === sec,
      ).length;
      const limit = Number(activeTest.sectionRules[sec]);
      if (limit > 0 && limit < secQs) {
        total += limit;
      } else {
        total += secQs;
      }
    });
    return total;
  }, [activeTest]);

  const currentQuestion = activeTest?.questions?.[curQ] || null;

  // Track visited questions across session
  useEffect(() => {
    if (step === "exam" && curQ !== undefined) {
      setVisitedQs((prev) => (prev[curQ] ? prev : { ...prev, [curQ]: true }));
    }
  }, [step, curQ]);

  useEffect(() => {
    setIsMounted(true);
    const handleOnline = () => setIsDeviceOnline(true);
    const handleOffline = () => setIsDeviceOnline(false);
    if (typeof window !== "undefined") {
      setIsDeviceOnline(navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    const offsetRef = ref(database, ".info/serverTimeOffset");
    const unsub = onValue(offsetRef, (snap) => {
      serverOffsetRef.current = Number(snap.val()) || 0;
    });
    return () => {
      unsub();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, []);

  //   Profile Details Auto-Fill
  useEffect(() => {
    if (currentUser) {
      if (currentUser.displayName) setName(currentUser.displayName);
      if (currentUser.rollNo || currentUser.examinerId) {
        setRoll(currentUser.rollNo || currentUser.examinerId || "");
      }
    }
  }, [currentUser]);

  // 🛡️ UNIVERSAL DRAFT RESCUE & AUTO-HEAL SENSOR
  useEffect(() => {
    if (!isMounted || step === "exam") return;

    const isRescueRequested = searchParams?.get("rescue") === "true";
    const urlCode = searchParams?.get("code");

    const scanForRescuableDraft = () => {
      let foundKey = null;
      let foundDraft = null;

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("exam_draft_")) {
          try {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            const decoded = decodeURIComponent(atob(raw));
            const parsed = JSON.parse(decoded);

            const hasAnswers =
              Array.isArray(parsed.answers) &&
              parsed.answers.some(
                (ans) =>
                  ans?.val !== null &&
                  ans?.val !== undefined &&
                  ans?.val !== "",
              );

            if (hasAnswers) {
              foundKey = k;
              foundDraft = parsed;
              break;
            }
          } catch (e) {
            console.warn("Skipping corrupt draft key:", k);
          }
        }
      }

      if (foundKey && foundDraft) {
        const isExpired =
          !foundDraft.endTime || foundDraft.endTime <= Date.now();

        // Trigger if explicit rescue link was clicked OR unsubmitted exam has already expired
        if (isRescueRequested || isExpired) {
          const rawParts = foundKey.replace(/^exam_draft_/, "").split("_");
          const parsedUid =
            rawParts.length >= 4
              ? rawParts[rawParts.length - 1]
              : "anonymous";
          const parsedRoll =
            rawParts.length >= 4 ? rawParts[rawParts.length - 2] : "";
          const parsedName =
            rawParts.length >= 4 ? rawParts[rawParts.length - 3] : "Student";
          const parsedTestId =
            rawParts.length >= 4
              ? rawParts.slice(0, rawParts.length - 3).join("_")
              : rawParts[0];

          performDraftRecovery(
            foundDraft,
            foundKey,
            urlCode || parsedTestId,
            parsedName,
            parsedRoll,
            parsedUid,
          );
        }
      } else if (isRescueRequested) {
        setRescueState({
          active: true,
          status: "not_found",
          message: "Is browser me koi unsubmitted exam draft nahi mila.",
        });
      }
    };

    scanForRescuableDraft();
  }, [isMounted, step, searchParams]);

  //   THE AUTO-JOIN SENSOR (SMART TOKEN DECODER & URL CODE LISTENER)
  useEffect(() => {
    if (isMounted && !authLoading && searchParams) {
      const secretToken = searchParams.get("token");
      const urlCode = searchParams.get("code");

      if (secretToken && !autoJoinTriggered.current) {
        try {
          // Token ko decode karo (e.g., "XYZ123-EXAMITOP-AUTO")
          const decoded = atob(secretToken);

          if (decoded.includes("-EXAMITOP-AUTO")) {
            const rawCode = decoded.split("-")[0]; // Asli code bahar nikalo
            autoJoinTriggered.current = true;
            setIsDirectJoin(true); // ENGINE KO BATA DIYA KI YE DIRECT AAYA HAI

            const immediateName = currentUser?.displayName || name;
            const immediateRoll =
              currentUser?.rollNo || currentUser?.examinerId || roll;

            setCode(rawCode);

            // URL se token hata do taaki refresh pe trigger na ho
            window.history.replaceState({}, document.title, "/student");

            // Trigger Main Join Function (with isAutoJoin = true)
            handleJoinTest(rawCode, immediateName, immediateRoll, true);
          }
        } catch (e) {
          console.error("Invalid Security Token");
        }
      } else if (urlCode && !autoJoinTriggered.current) {
        const cleanCode = urlCode.trim().toUpperCase();
        setCode(cleanCode);
        if (currentUser) {
          autoJoinTriggered.current = true;
          setIsDirectJoin(true);
          const immediateName =
            currentUser?.displayName ||
            currentUser?.email?.split("@")[0] ||
            name ||
            "Demo Examiner";
          const immediateRoll =
            currentUser?.rollNo || currentUser?.examinerId || roll || "DEMO";
          window.history.replaceState({}, document.title, "/student");
          handleJoinTest(cleanCode, immediateName, immediateRoll, true);
        }
      }
    }
  }, [isMounted, authLoading, searchParams, currentUser]);

  // Reset image loader when question changes
  useEffect(() => {
    setImgLoaded(false);
  }, [curQ]);

  //EXAM AMNESIA CURE (Remember active exam on Ctrl+R Refresh)
  useEffect(() => {
    if (step === "exam" && activeTest && code) {
      sessionStorage.setItem(
        "examitop_active_exam",
        JSON.stringify({
          code: code,
          name: name,
          roll: roll,
        }),
      );
    }
  }, [step, activeTest, code, name, roll]);

  useEffect(() => {
    if (isMounted && !authLoading && step === "join") {
      const savedSession = sessionStorage.getItem("examitop_active_exam");
      if (savedSession && !autoJoinTriggered.current) {
        try {
          const parsed = JSON.parse(savedSession);
          setCode(parsed.code);
          setName(parsed.name);
          setRoll(parsed.roll);
          autoJoinTriggered.current = true;
          handleJoinTest(parsed.code, parsed.name, parsed.roll, true); // true = silent/auto join
        } catch (e) {}
      }
    }
  }, [isMounted, authLoading, step]);

  // 1. MathJax Auto-Renderer
  useEffect(() => {
    let isCancelled = false;
    const renderMath = async () => {
      if (step === "exam" && typeof window !== "undefined" && window.MathJax) {
        try {
          window.MathJax.typesetClear();
          await window.MathJax.typesetPromise();
        } catch (err) {
          console.log("MathJax Error:", err);
        } finally {
          if (!isCancelled) {
            let targetAreas = document.querySelectorAll(".q-area-content");
            targetAreas.forEach((el) => {
              el.style.transition = "opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
              el.style.opacity = "1";
            });
          }
        }
      }
    };
    // Ab React pehle aaram se raw text daalega, fir MathJax aakar usko perfectly format karega!
    const timer = setTimeout(renderMath, 40);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [curQ, step]);

  // Hide Global Header & Sub-Navbar during Instructions and Exam
  useEffect(() => {
    const header = document.querySelector(".app-header");
    const subNav = document.getElementById("dynamic-nav-wrapper"); // Sub-navbar (pills) ko bhi target kiya

    if (step === "exam" || step === "instructions") {
      if (header) header.style.display = "none";
      if (subNav) subNav.style.display = "none";
    } else {
      if (header) header.style.display = "";
      if (subNav) subNav.style.display = "";
    }
    // Cleanup: Jab form submit karke page se bahar jaye (Results par), toh sab normal ho jaye
    return () => {
      if (header) header.style.display = "";
      if (subNav) subNav.style.display = "";
    };
  }, [step]);

  // NAYA: Keyboard Navigation Engine (Arrows & 1,2,3,4)
  useEffect(() => {
    if (step !== "exam" || !activeTest) return;

    const handleKeyDown = (e) => {
      // Prevent triggering if typing in Roughpad or Inputs
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName))
        return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (curQ < activeTest.questions.length - 1) changeQuestion(curQ + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (curQ > 0) changeQuestion(curQ - 1);
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const qType = activeTest.questions[curQ]?.type;
        const optIdx = parseInt(e.key) - 1;

        if (qType === "mcq" && activeTest.questions[curQ]?.options[optIdx]) {
          pickMCQ(curQ, optIdx);
        } else if (
          qType === "msq" &&
          activeTest.questions[curQ]?.options[optIdx]
        ) {
          pickMSQ(curQ, optIdx);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, curQ, activeTest, answers]);

  // 2. AUTO-SAVE DRAFT
  useEffect(() => {
    if (step === "exam" && activeTest && answers.length > 0) {
      const safeName = name.trim() || "guest";
      const safeRoll = roll.trim() || "noroll";
      const draftData = {
        answers,
        curQ,
        endTime: endTimeRef.current,
        serverStartTime: serverStartTimeRef.current,
        warnings: warningsRef.current,
        cheatLogs: cheatLogsRef.current,
        shuffledQuestions: activeTest.questions,
      };

      // AUTO-SAVE ENCODING (Line ~270)
      const jsonString = JSON.stringify(draftData);
      const secretPayload = btoa(encodeURIComponent(jsonString));

      const uidSafe = currentUser?.uid || "nouid";
      localStorage.setItem(
        `exam_draft_${activeTest.id}_${safeName}_${safeRoll || "noroll"}_${uidSafe}`,
        secretPayload,
      );
    }
  }, [answers, curQ, step, activeTest, name, roll]);

  // THE BULLETPROOF LIVE PRESENCE ENGINE
  useEffect(() => {
    if (!sessionUidRef.current) {
      sessionUidRef.current =
        currentUser?.uid || `guest_${Math.random().toString(36).substr(2, 9)}`;
    }

    if (step !== "exam" || !activeTest) return;

    const uid = sessionUidRef.current;
    const pRef = ref(database, `live_sessions/${activeTest.id}/${uid}`);
    presenceRefTarget.current = pRef;

    const establishPresence = () => {
      if (!navigator.onLine) return;

      set(pRef, {
        name: name || "Student",
        roll: roll || "N/A",
        joinedAt: new Date().toLocaleTimeString("en-IN"),
      })
        .then(() => {
          onDisconnect(pRef).remove();
        })
        .catch((err) => console.error("Presence Error", err));
    };

    establishPresence();

    window.addEventListener("online", establishPresence);

    return () => {
      window.removeEventListener("online", establishPresence);
      if (presenceRefTarget.current && navigator.onLine) {
        remove(presenceRefTarget.current).catch(() =>
          console.log("Cleanup silent fail"),
        );
        onDisconnect(presenceRefTarget.current)
          .cancel()
          .catch(() => console.log("onDisconnect cancel silent fail"));
      }
    };
  }, [step, activeTest, name, roll]);

  // Silent Background Timer for Active Question
  useEffect(() => {
    let qTimer;
    // Timer tabhi chalega jab exam chal raha ho
    if (step === "exam" && activeTest) {
      qTimer = setInterval(() => {
        setQTime((prev) => ({
          ...prev,
          [curQ]: (prev[curQ] || 0) + 1, // Har second active question ka time +1 hoga
        }));
      }, 1000);
    }
    return () => clearInterval(qTimer);
  }, [step, curQ, activeTest]);

  // 3. AUTO-SYNC OFFLINE SUBMISSIONS (Safe Idempotent Retry)
  useEffect(() => {
    const handleOnline = async () => {
      let pending = JSON.parse(
        localStorage.getItem("examitop_pending_subs") || "[]",
      );
      if (pending.length > 0) {
        let remaining = [];
        for (let p of pending) {
          try {
            const token = auth.currentUser
              ? await auth.currentUser.getIdToken(true)
              : "";
            const response = await fetch("/api/evaluate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify(p.payload),
            });

            const responseText = await response.text();
            let result;
            try {
              result = JSON.parse(responseText);
            } catch (e) {
              result = { success: false };
            }

            if (!response.ok || !result.success) {
              // If duplicate (403), let it drop. If server error (500), retain it!
              if (response.status !== 403) remaining.push(p);
            }
          } catch (e) {
            console.error("Offline Sync failed", e);
            remaining.push(p); // Retain on network drop
          }
        }

        if (remaining.length === 0) {
          localStorage.removeItem("examitop_pending_subs");
          setSysModal({
            type: "success",
            msg: "Internet restored! Pending offline submissions safely synced.",
          });
        } else {
          localStorage.setItem(
            "examitop_pending_subs",
            JSON.stringify(remaining),
          );
          setSysModal({
            type: "warning",
            msg: `Internet restored, but ${remaining.length} submissions failed to sync. Retrying later.`,
          });
        }
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // 4. ENTERPRISE ANTI-CHEAT ENGINE
  useEffect(() => {
    if (step !== "exam" || !activeTest?.antiCheat) return;

    const triggerCheat = (reason) => {
      if (isActionLockedRef.current) return;
      const now = Date.now();
      if (now - lastWarningTimeRef.current < 3000) return;

      lastWarningTimeRef.current = now;
      warningsRef.current += 1;
      cheatLogsRef.current.push({
        time: new Date().toLocaleTimeString("en-IN"),
        reason,
      });

      if (warningsRef.current >= 3) {
        setCheatWarning({
          fatal: true,
          msg: "SECURITY ALERT: Exam Blocked! Rules violated 3 times. Auto-submitting paper.",
        });
        setTimeout(() => {
          if (handleFinalSubmitRef.current) {
            handleFinalSubmitRef.current();
          }
        }, 3000);
      } else {
        setCheatWarning({
          fatal: false,
          count: warningsRef.current,
          msg: `${reason} detected! Please do not leave the exam screen.`,
        });
      }
    };

    const handleWindowCheat = (e) => {
      if (e.type === "visibilitychange" && document.hidden)
        triggerCheat("Tab switching / App change");
      else if (e.type === "blur")
        triggerCheat("Opened another window (Focus lost)");
      else if (
        e.type === "fullscreenchange" &&
        !document.fullscreenElement &&
        activeTest.fullScreenMode
      )
        triggerCheat("Exited full-screen mode");
    };

    const handleKeyCheat = (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey &&
          e.shiftKey &&
          ["I", "J", "C"].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && ["P", "U", "S"].includes(e.key.toUpperCase()))
      ) {
        e.preventDefault();
        triggerCheat(
          "Developer Tools / Print Shortcuts are strictly prohibited.",
        );
      }
    };

    const blockCopyPaste = (e) => {
      e.preventDefault();
    };

    document.addEventListener("visibilitychange", handleWindowCheat);
    window.addEventListener("blur", handleWindowCheat);
    document.addEventListener("keydown", handleKeyCheat);
    if (activeTest.fullScreenMode)
      document.addEventListener("fullscreenchange", handleWindowCheat);

    document.addEventListener("copy", blockCopyPaste);
    document.addEventListener("cut", blockCopyPaste);
    document.addEventListener("paste", blockCopyPaste);
    document.addEventListener("contextmenu", blockCopyPaste);
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("visibilitychange", handleWindowCheat);
      window.removeEventListener("blur", handleWindowCheat);
      document.removeEventListener("keydown", handleKeyCheat);
      if (activeTest.fullScreenMode)
        document.removeEventListener("fullscreenchange", handleWindowCheat);
      document.removeEventListener("copy", blockCopyPaste);
      document.removeEventListener("cut", blockCopyPaste);
      document.removeEventListener("paste", blockCopyPaste);
      document.removeEventListener("contextmenu", blockCopyPaste);
      document.body.style.userSelect = "";
    };
  }, [step, activeTest]);

  // 5. THE ULTIMATE EXAM TRAP
  useEffect(() => {
    if (step !== "exam") return;

    window.history.pushState(null, "", window.location.href);
    const handlePopState = (e) => {
      window.history.pushState(null, "", window.location.href);
      if (isExaminerDemo) {
        setSysModal({
          type: "confirm",
          msg: "Exit Examiner Demo and return to Tests Vault?",
          action: () => {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("examitop_demo_examiner");
            }
            router.push("/tests");
          },
        });
      } else {
        setSysModal({
          type: "error",
          msg: "SECURITY LOCK: You cannot go back during an active exam. You must submit the test to exit.",
        });
      }
    };
    window.addEventListener("popstate", handlePopState);

    let touchStartY = 0;
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e) => {
      const touchY = e.touches[0].clientY;
      const touchDiff = touchY - touchStartY;
      if (touchDiff > 0 && window.scrollY === 0) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [step]);

  const handleKeyDownJoin = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (name.trim() && code.trim() && !isFetchingTest) {
        handleJoinTest();
      }
    }
  };

  // 🛡️ DRAFT AUTO-RESCUE ENGINE (Recovers stuck & unsubmitted exams on client device)
  const performDraftRecovery = async (
    draft,
    draftKey,
    explicitTestId,
    explicitName,
    explicitRoll,
    explicitUid,
  ) => {
    if (rescueAttemptedRef.current) return;
    rescueAttemptedRef.current = true;

    setRescueState({
      active: true,
      status: "rescuing",
      message: "Syncing your answers with the evaluation vault...",
    });

    try {
      const targetTestId =
        explicitTestId || searchParams?.get("code") || activeTest?.id;
      if (!targetTestId) {
        throw new Error("Unable to identify Test ID for recovery.");
      }

      const questionsList =
        draft.shuffledQuestions || activeTest?.questions || [];

      // Map raw answers back to master indices
      const rawAnswers = (draft.answers || []).map((ans, idx) => {
        let actualQ = questionsList[idx];
        let origQIdx =
          actualQ?.originalQIdx !== undefined ? actualQ.originalQIdx : idx;
        let origVal = ans?.val ?? null;

        if (
          origVal !== null &&
          (actualQ?.type === "mcq" || actualQ?.type === "msq") &&
          actualQ?.optionMap
        ) {
          if (Array.isArray(origVal)) {
            origVal = origVal
              .map((v) => actualQ.optionMap[v])
              .filter((v) => v !== undefined);
          } else {
            origVal =
              actualQ.optionMap[origVal] !== undefined
                ? actualQ.optionMap[origVal]
                : null;
          }
        }

        if (typeof origVal === "string") {
          let trimmed = origVal.trim();
          if (
            trimmed === "" ||
            trimmed === "-" ||
            trimmed === "." ||
            trimmed === "-." ||
            trimmed === "-0."
          ) {
            origVal = null;
          }
        }

        return {
          qIndex: origQIdx,
          val: origVal,
        };
      });

      const studentName =
        currentUser?.displayName ||
        explicitName ||
        name ||
        "Student";
      const studentRoll =
        currentUser?.rollNo ||
        explicitRoll ||
        roll ||
        "";
      const studentUid =
        currentUser?.uid ||
        (explicitUid && explicitUid !== "nouid" ? explicitUid : "anonymous");

      const apiPayload = {
        testId: targetTestId,
        student: {
          uid: studentUid,
          name: studentName,
          roll: studentRoll,
        },
        answers: rawAnswers,
        timeTaken: "2:00:00 (Auto-Rescued)",
        timeSpentPerQuestion: {},
        cheatLogs: draft.cheatLogs || [],
        isRecovery: true,
      };

      const token = auth.currentUser
        ? await auth.currentUser.getIdToken(true)
        : "";

      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(apiPayload),
      });

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Evaluation engine returned invalid response.");
      }

      if (
        result.success ||
        (result.message && result.message.includes("Duplicate"))
      ) {
        if (draftKey) {
          localStorage.removeItem(draftKey);
        }
        sessionStorage.removeItem("examitop_active_exam");

        setRescueState({
          active: true,
          status: "success",
          message:
            "Aapka 2 ghante ka exam successfully submit aur evaluate ho chuka hai! Result page par redirect ho rahe hain...",
        });

        setTimeout(() => {
          router.replace("/student-results");
        }, 2200);
      } else {
        setRescueState({
          active: true,
          status: "error",
          message: result.message || "Failed to submit exam.",
        });
      }
    } catch (err) {
      console.error("Recovery execution failed:", err);
      setRescueState({
        active: true,
        status: "error",
        message: err.message || "Network error. Please tap Retry.",
      });
    }
  };

  /// --- JOIN LOGIC ---
  //   NAYA: isAutoJoin flag add kiya gaya hai
  const handleJoinTest = async (
    overrideCode = null,
    overrideName = null,
    overrideRoll = null,
    isAutoJoin = false,
  ) => {
    // Resolve Variables
    const finalCode =
      (typeof overrideCode === "string" ? overrideCode : code) || "";
    const finalName =
      (typeof overrideName === "string" ? overrideName : name) || "";
    const finalRoll =
      (typeof overrideRoll === "string" ? overrideRoll : roll) || "";

    setJoinError("");
    if (!currentUser) {
      setJoinError(
        "Guest access is temporarily locked (Coming Soon). Please log in to join exams.",
      );
      return;
    }
    if (!finalName.trim()) {
      setJoinError("Please enter your full name.");
      return;
    }
    if (!finalCode.trim()) {
      setJoinError("Please enter the 6-digit test code.");
      return;
    }

    setIsFetchingTest(true);

    try {
      const codeUpper = finalCode.trim().toUpperCase();
      let t = null;

      const localTests = JSON.parse(
        localStorage.getItem("examitop_offline_tests") || "[]",
      );
      t = localTests.find((x) => x.code === codeUpper);

      // 🚀 THE MASTER API & CLIENT FALLBACK ENGINE
      if (!t) {
        try {
          const res = await fetch(`/api/exam/fetch?code=${codeUpper}`);
          const textRes = await res.text(); // 🔥 FIX: Padhne se pehle text me convert karo taaki DOCTYPE crash na ho!

          try {
            const data = JSON.parse(textRes);
            if (data.success && data.testObj) t = data.testObj;
          } catch (parseErr) {
            console.warn(
              "Vercel API Crashed (Returned HTML). Switching to Direct Client Fetch.",
            );
          }
        } catch (apiErr) {
          console.warn("Network Error on API.");
        }
      }

      // 🛡️ FRONTEND DIRECT FALLBACK (Agar API Vercel .env issue ki wajah se fail ho jaye)
      if (!t) {
        try {
          // 1. Check New Metadata Node
          const metaQuery = query(
            ref(database, "tests_metadata"),
            orderByChild("code"),
            equalTo(codeUpper),
          );
          const metaSnap = await get(metaQuery);
          if (metaSnap.exists()) {
            t = Object.values(metaSnap.val())[0];
          } else {
            // 2. Check Legacy Tests Node
            const legacyQuery = query(
              ref(database, "tests"),
              orderByChild("code"),
              equalTo(codeUpper),
            );
            const legacySnap = await get(legacyQuery);
            if (legacySnap.exists()) {
              t = Object.values(legacySnap.val())[0];
            }
          }
        } catch (clientErr) {
          console.error("Client Database Fetch Blocked:", clientErr);
        }
      }

      // 🛡️ Final Check
      if (!t) {
        if (isAutoJoin)
          setSysModal({ type: "error", msg: "Invalid Test Link." });
        else setJoinError("Invalid Test Code. Check and try again.");
        setIsFetchingTest(false);
        return;
      }
      if (t.isActive === false) {
        if (isAutoJoin)
          setSysModal({
            type: "error",
            msg: "Intake Closed: The examiner is no longer accepting submissions.",
          });
        else
          setJoinError(
            "Intake Closed: The examiner is no longer accepting submissions.",
          );
        setIsFetchingTest(false);
        return;
      }

      const safeName = finalName.trim();
      const safeRoll = finalRoll.trim().toLowerCase();
      // PHASE 3: Frontend Bouncer (STRICT O(1) LOCKOUT)
      let existingSub = false;
      const safeUserKey = currentUser?.uid || "nouid";
      const safeEmail = currentUser?.email?.toLowerCase() || "";

      // 1. Direct Personal Index Check (100% Accurate)
      const userSubRef = await get(
        ref(database, `user_submissions/${safeUserKey}/${t.id}`),
      );
      if (userSubRef.exists()) {
        // 🛡️ REATTEMPT AUTO-DETECTION: Check if master submission was deleted by Admin/Examiner
        const masterSubRef = await get(
          ref(database, `test_submissions/${t.id}/submissions/${safeUserKey}`),
        );
        if (masterSubRef.exists()) {
          existingSub = true;
        } else {
          // Master record was deleted by Admin/Examiner! Auto-grant reattempt & clean up stale receipt
          existingSub = false;
          remove(
            ref(database, `user_submissions/${safeUserKey}/${t.id}`),
          ).catch(() => {});
        }
      }

      // 2. Deep Legacy Array Check (Agar index corrupt ho toh backup)
      if (!existingSub && t.submissions) {
        const legacySubs = Array.isArray(t.submissions)
          ? t.submissions
          : Object.values(t.submissions);

        existingSub = legacySubs.some((s) => {
          if (!s) return false;
          // Block if UID matches, Email matches, OR Roll Number matches
          if (s.uid && s.uid === safeUserKey && safeUserKey !== "nouid")
            return true;
          if (s.email && safeEmail && s.email.toLowerCase() === safeEmail)
            return true;
          if (s.roll && safeRoll && s.roll.toLowerCase() === safeRoll)
            return true;
          return false;
        });
      }

      const isCreator = Boolean(
        currentUser?.uid && t.creatorUid === currentUser.uid,
      );

      if (existingSub && !isCreator) {
        const msg =
          "You have already submitted this exam. Multiple attempts are not allowed.";
        if (isAutoJoin) setSysModal({ type: "error", msg });
        else setJoinError(msg);
        setIsFetchingTest(false);
        return;
      }

      // THE 10K SCALING FIX 2: O(1) Duplicate Checker (Rescues 10GB Bandwidth)
      let isAlreadyLive = false;
      const checkRoll = safeRoll || "N/A"; // Kyunki establishPresence me humne yahi set kiya tha

      // Poori list download karne ki jagah, sirf usi roll number ko query karo
      const dupQuery = query(
        ref(database, `live_sessions/${t.id}`),
        orderByChild("roll"),
        equalTo(checkRoll),
      );

      const liveSnap = await get(dupQuery);
      if (liveSnap.exists()) {
        const liveData = liveSnap.val();
        // Cross-verify the exact name as well
        isAlreadyLive = Object.values(liveData).some(
          (session) => session.name.toLowerCase() === safeName.toLowerCase(),
        );

        const uidSafe = currentUser?.uid || "nouid";
        const draftStr = localStorage.getItem(
          `exam_draft_${t.id}_${safeName}_${safeRoll || "noroll"}_${uidSafe}`,
        );

        // Agar student LIVE hai, aur uske paas local draft nahi hai (yani wo naye device ya incognito tab se aaya hai)
        if (isAlreadyLive && !draftStr && !isCreator) {
          const msg =
            "Multiple Device Detected: You are already active in this exam on another device or tab.";
          if (isAutoJoin) setSysModal({ type: "error", msg });
          else setJoinError(msg);
          setIsFetchingTest(false);
          return;
        }
      }

      // 🛡️ THE BULLETPROOF TIER BOUNCER LOGIC
      const creatorUid = t.creatorUid;
      if (creatorUid && !isCreator) {
        try {
          const creatorSnap = await get(ref(database, `users/${creatorUid}`));
          if (creatorSnap.exists()) {
            const creatorData = creatorSnap.val();

            // 1. Unlimited Pack Overrides Everything
            const isUnlimited =
              creatorData.is_unlimited === true ||
              creatorData.plan === "unlimited";

            const currentSubsCount = t.submissionCount || 0;

            const FREE_TIER_LIMIT = 10;

            // 🔥 THE MASTER CHECK:
            // Agar Examiner Unlimited plan pe nahi hai, TOH test ka tag check karo
            // Agar test "free" token se bana tha (ya old tests jinpe tag nahi hai), toh 10 ki limit lagegi
            if (!isUnlimited) {
              const isTestFree = t.tokenType === "free" || !t.tokenType;

              if (isTestFree && currentSubsCount >= FREE_TIER_LIMIT) {
                const limitMsg =
                  "This exam has reached its maximum free-tier limit of 10 students. The Examiner needs a Premium Token or an Unlimited Plan for higher intakes.";

                if (isAutoJoin) {
                  setSysModal({ type: "error", msg: limitMsg });
                } else {
                  setJoinError(limitMsg);
                }
                setIsFetchingTest(false);
                return; // ENTRY BLOCKED
              }
            }
          }
        } catch (tierErr) {
          console.warn(
            "Creator quota check bypassed at security boundary:",
            tierErr,
          );
        }
      }

      const uidSafe = currentUser?.uid || "nouid"; // Agar yahan scope me nahi hai toh wapas define karlo
      const draftStr = localStorage.getItem(
        `exam_draft_${t.id}_${safeName}_${safeRoll || "noroll"}_${uidSafe}`,
      );
      if (draftStr) {
        try {
          // DRAFT DECODING (Line ~475)
          const decodedString = decodeURIComponent(atob(draftStr));
          const draft = JSON.parse(decodedString);
          if (draft.endTime > Date.now()) {
            setDraftToResume(draft);
          } else {
            // Check if draft has answers — NEVER wipe completed exams!
            const hasAnswers =
              Array.isArray(draft.answers) &&
              draft.answers.some(
                (a) => a?.val !== null && a?.val !== undefined && a?.val !== "",
              );
            if (hasAnswers) {
              performDraftRecovery(
                draft,
                `exam_draft_${t.id}_${safeName}_${safeRoll || "noroll"}_${uidSafe}`,
                t.id,
                safeName,
                safeRoll,
                uidSafe,
              );
              return;
            } else {
              localStorage.removeItem(
                `exam_draft_${t.id}_${safeName}_${safeRoll || "noroll"}_${uidSafe}`,
              );
            }
          }
        } catch (e) {
          console.error(
            "Tampered or corrupt draft data found. Clearing draft.",
          );
          localStorage.removeItem(
            `exam_draft_${t.id}_${safeName}_${safeRoll || "noroll"}`,
          );
        }
      }

      setActiveTest(t);
      setStep("instructions");
    } catch (error) {
      console.error("Join test error:", error);
      if (isAutoJoin)
        setSysModal({
          type: "error",
          msg: "Network Error. Please try again later.",
        });
      else setJoinError("Network Error. Please try again.");
    } finally {
      setIsFetchingTest(false);
    }
  };

  const applySmartShuffle = (test) => {
    if (test.shuffleOpts === false && test.shuffleQs !== true) return test;

    let clonedTest = JSON.parse(JSON.stringify(test));

    // 0. 🔥 NAYA FIX: Store original Question Index before any shuffling
    clonedTest.questions = clonedTest.questions.map((q, idx) => {
      q.originalQIdx = idx;
      return q;
    });

    // 1. SHUFFLE OPTIONS (Intelligently)
    if (test.shuffleOpts !== false) {
      clonedTest.questions = clonedTest.questions.map((q) => {
        if ((q.type === "mcq" || q.type === "msq") && q.options) {
          const hasFixedOption = q.options.some((opt) => {
            let lowerOpt = opt
              .toLowerCase()
              .replace(/<[^>]*>?/gm, "")
              .trim();
            return (
              lowerOpt.includes("all of") ||
              lowerOpt.includes("none of") ||
              lowerOpt.includes("both ") ||
              lowerOpt.includes("only ")
            );
          });

          if (hasFixedOption) return q;

          let standardOpts = q.options.map((opt, idx) => ({
            text: opt,
            originalIdx: idx,
          }));

          for (let i = standardOpts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [standardOpts[i], standardOpts[j]] = [
              standardOpts[j],
              standardOpts[i],
            ];
          }

          q.options = standardOpts.map((o) => o.text);
          q.optionMap = standardOpts.map((o) => o.originalIdx); // 🔥 NAYA FIX: MAPPING SAVED HERE

          let newCorrectArray = [];
          if (q.correct) {
            q.correct.forEach((cIdx) => {
              let newIdx = standardOpts.findIndex(
                (o) => o.originalIdx === cIdx,
              );
              if (newIdx !== -1) newCorrectArray.push(newIdx);
            });
          }
          q.correct = newCorrectArray;
        }
        return q;
      });
    }

    // 2. SHUFFLE QUESTIONS
    if (test.shuffleQs === true) {
      if (clonedTest.sections && clonedTest.sections.length > 0) {
        let finalShuffledQuestions = [];
        clonedTest.sections.forEach((sec) => {
          let sectionQs = clonedTest.questions.filter(
            (q) =>
              q.section === sec ||
              (!q.section && sec === clonedTest.sections[0]),
          );
          for (let i = sectionQs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sectionQs[i], sectionQs[j]] = [sectionQs[j], sectionQs[i]];
          }
          finalShuffledQuestions = [...finalShuffledQuestions, ...sectionQs];
        });
        clonedTest.questions = finalShuffledQuestions;
      } else {
        for (let i = clonedTest.questions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [clonedTest.questions[i], clonedTest.questions[j]] = [
            clonedTest.questions[j],
            clonedTest.questions[i],
          ];
        }
      }
    }

    return clonedTest;
  };

  // STALE CLOSURE FIX:
  useEffect(() => {
    handleFinalSubmitRef.current = handleFinalSubmit;
  });

  // Auto-Submit Jitter (Fixed: passes { isAuto: true } to prevent deadlock)
  useEffect(() => {
    if (step === "exam" && endTimeRef.current) {
      const remaining = Math.floor((endTimeRef.current - getTrueNow()) / 1000);

      if (remaining <= 0 && !isActionLockedRef.current) {
        isActionLockedRef.current = true; // Block double submissions
        setIsSubmitting(true); // Spinner turant screen par aa jayega

        // 0 se 2500 milliseconds ka random delay (Firebase Write Load Balancer)
        const randomDelay = Math.floor(Math.random() * 2500);

        setTimeout(() => {
          // Guaranteed auto-submit bypasses isSubmitting deadlock
          if (handleFinalSubmitRef.current) {
            handleFinalSubmitRef.current({ isAuto: true });
          }
        }, randomDelay);
      }
    }
  }, [timeLeft, step]);

  // --- START EXAM LOGIC ---
  const startExam = () => {
    if (!activeTest) return;

    if (activeTest.fullScreenMode) {
      const elem = document.documentElement;
      if (elem.requestFullscreen)
        elem
          .requestFullscreen()
          .catch((err) => console.log("Fullscreen blocked:", err));
    }

    const totalDurationMs = (activeTest.duration || 60) * 60 * 1000;

    if (draftToResume) {
      setAnswers(draftToResume.answers);
      setCurQ(draftToResume.curQ);
      warningsRef.current = draftToResume.warnings || 0;
      cheatLogsRef.current = draftToResume.cheatLogs || [];

      // 🛡️ TRUE ELAPSED RESUME: Anti-tamper calculation using atomic server time
      if (draftToResume.serverStartTime) {
        serverStartTimeRef.current = draftToResume.serverStartTime;
        const elapsed = getTrueNow() - draftToResume.serverStartTime;
        endTimeRef.current =
          getTrueNow() + Math.max(0, totalDurationMs - elapsed);
      } else {
        endTimeRef.current =
          draftToResume.endTime || getTrueNow() + totalDurationMs;
      }

      //  YE BLOCK ADD KARNA HAI (Taki refresh hone par wahi shuffled paper khule)
      if (draftToResume.shuffledQuestions) {
        setActiveTest((prev) => ({
          ...prev,
          questions: draftToResume.shuffledQuestions,
        }));
      }
    } else {
      const shuffledTest = applySmartShuffle(activeTest);
      setActiveTest(shuffledTest);

      const initialAnswers = shuffledTest.questions.map(() => ({
        val: null,
        marked: false,
      }));
      setAnswers(initialAnswers);
      warningsRef.current = 0;
      cheatLogsRef.current = [];
      serverStartTimeRef.current = getTrueNow();
      endTimeRef.current = serverStartTimeRef.current + totalDurationMs;
    }

    isActionLockedRef.current = false;

    timerRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((endTimeRef.current - getTrueNow()) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
      }
    }, 1000);

    setStep("exam");
  };

  const changeQuestion = (newIdx) => {
    if (newIdx === curQ) return;
    let targetAreas = document.querySelectorAll(".q-area-content");
    targetAreas.forEach((el) => {
      el.style.transition = "none";
      el.style.opacity = "0";
    });
    setTimeout(() => {
      setCurQ(newIdx);
      setIsMobilePaletteOpen(false);
    }, 15);
  };

  // --- QUESTION SELECTION ---
  const canAttemptQuestion = (qIndex) => {
    if (!activeTest?.sectionRules || !activeTest?.questions) return true;
    const q = activeTest.questions[qIndex];
    if (!q) return true;
    const sec = q.section || (activeTest.sections && activeTest.sections[0]);
    if (!sec) return true;
    const limit = Number(activeTest.sectionRules[sec]);
    if (!limit || limit <= 0) return true;

    // Check if current question is already answered (modifications/re-selection allowed)
    const curVal = answers[qIndex]?.val;
    const isAnsweredAlready =
      curVal !== null &&
      curVal !== undefined &&
      curVal !== "" &&
      (!Array.isArray(curVal) || curVal.length > 0);
    if (isAnsweredAlready) return true;

    // Count answered questions in this section
    let answeredCount = 0;
    activeTest.questions.forEach((qq, idx) => {
      const qSec = qq.section || (activeTest.sections && activeTest.sections[0]);
      if (qSec === sec) {
        const val = answers[idx]?.val;
        if (
          val !== null &&
          val !== undefined &&
          val !== "" &&
          (!Array.isArray(val) || val.length > 0)
        ) {
          answeredCount++;
        }
      }
    });

    if (answeredCount >= limit) {
      setSysModal({
        type: "warning",
        msg: `Section Limit Reached: You have already attempted ${limit} out of ${limit} allowed questions in "${sec}". Please clear an existing response in this section before attempting this question.`,
      });
      return false;
    }
    return true;
  };

  const handleVirtualKey = (key) => {
    let cur = answers[curQ]?.val !== null && answers[curQ]?.val !== undefined ? String(answers[curQ].val) : "";
    if (cur === "NaN" || cur === "undefined" || cur === "null") cur = "";

    if (key === "backspace") {
      cur = cur.slice(0, -1);
      if (cur === "-" || cur === "") {
        pickInt(curQ, "");
      } else {
        pickInt(curQ, cur);
      }
    } else if (key === "clear") {
      clearAns(curQ);
    } else if (key === "-") {
      if (cur.startsWith("-")) {
        cur = cur.slice(1);
      } else {
        cur = "-" + cur;
      }
      pickInt(curQ, cur);
    } else if (key === ".") {
      if (!cur.includes(".")) {
        if (cur === "" || cur === "-") cur = cur + "0.";
        else cur = cur + ".";
        pickInt(curQ, cur);
      }
    } else {
      // Numerical Digits 0-9
      if (cur === "0") cur = key;
      else if (cur === "-0") cur = "-" + key;
      else if (cur.length < 16) cur += key;
      pickInt(curQ, cur);
    }
  };

  const pickMCQ = (qIndex, optIndex) => {
    if (!canAttemptQuestion(qIndex)) return;
    let newAns = [...answers];
    newAns[qIndex].val = optIndex;
    setAnswers(newAns);
  };
  const pickMSQ = (qIndex, optIndex) => {
    let newAns = [...answers];
    let currentVal = Array.isArray(newAns[qIndex].val)
      ? [...newAns[qIndex].val]
      : [];
    if (currentVal.includes(optIndex)) {
      currentVal = currentVal.filter((v) => v !== optIndex);
      newAns[qIndex].val = currentVal.length > 0 ? currentVal : null;
      setAnswers(newAns);
    } else {
      if (!canAttemptQuestion(qIndex)) return;
      currentVal.push(optIndex);
      newAns[qIndex].val = currentVal;
      setAnswers(newAns);
    }
  };
  const pickInt = (qIndex, val) => {
    if (val !== "" && val !== null && val !== undefined) {
      if (!canAttemptQuestion(qIndex)) return;
    }
    let newAns = [...answers];
    let clean = (val === "" || val === null || val === undefined) ? null : String(val).trim();
    if (clean === "NaN" || clean === "null" || clean === "undefined") clean = null;
    newAns[qIndex].val = clean;
    setAnswers(newAns);
  };
  const pickSubj = (qIndex, val) => {
    if (val.trim() !== "" && !canAttemptQuestion(qIndex)) return;
    let newAns = [...answers];
    newAns[qIndex].val = val.trim() === "" ? null : val;
    setAnswers(newAns);
  };
  const toggleMark = (qIndex) => {
    let newAns = [...answers];
    newAns[qIndex].marked = !newAns[qIndex].marked;
    setAnswers(newAns);
  };
  const clearAns = (qIndex) => {
    let newAns = [...answers];
    newAns[qIndex].val = null;
    setAnswers(newAns);
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return (
      (h > 0 ? h + ":" : "") +
      String(m).padStart(2, "0") +
      ":" +
      String(s).padStart(2, "0")
    );
  };
  const getLabel = (type) =>
    ({
      mcq: "Single Correct",
      msq: "Multi Correct",
      integer: "Integer Type",
      subjective: "Subjective",
    })[type] || type;
  const getBadge = (type) =>
    ({
      mcq: "b-blue",
      msq: "b-green",
      integer: "b-amber",
      subjective: "b-purple",
    })[type] || "b-gray";

  useEffect(() => {
    if (step !== "exam") return;
    const handleExamShortcuts = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "textarea" || (tag === "input" && document.activeElement?.type === "text")) {
        return;
      }
      if (e.key === "ArrowLeft") {
        if (curQ > 0) changeQuestion(curQ - 1);
      } else if (e.key === "ArrowRight") {
        if (curQ < (activeTest?.questions?.length || 1) - 1) changeQuestion(curQ + 1);
      } else if (e.key === "m" || e.key === "M") {
        toggleMark(curQ);
      } else if (e.key === "c" || e.key === "C") {
        clearAns(curQ);
      } else if (currentQuestion?.type === "integer") {
        if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "."].includes(e.key)) {
          e.preventDefault();
          handleVirtualKey(e.key);
        } else if (e.key === "Backspace") {
          e.preventDefault();
          handleVirtualKey("backspace");
        } else if (e.key === "Delete") {
          e.preventDefault();
          handleVirtualKey("clear");
        }
      } else if (["1", "2", "3", "4", "a", "b", "c", "d", "A", "B", "C", "D"].includes(e.key)) {
        const map = { "1": 0, "a": 0, "A": 0, "2": 1, "b": 1, "B": 1, "3": 2, "c": 2, "C": 2, "4": 3, "d": 3, "D": 3 };
        const optIdx = map[e.key];
        if (optIdx !== undefined) {
          if (currentQuestion?.type === "mcq" && currentQuestion.options?.[optIdx] !== undefined) {
            pickMCQ(curQ, optIdx);
          } else if (currentQuestion?.type === "msq" && currentQuestion.options?.[optIdx] !== undefined) {
            pickMSQ(curQ, optIdx);
          }
        }
      }
    };
    window.addEventListener("keydown", handleExamShortcuts);
    return () => window.removeEventListener("keydown", handleExamShortcuts);
  }, [step, curQ, activeTest, currentQuestion, answers]);

  // --- SUBMIT CONFIRMATION UI ---
  const confirmAndSubmit = () => {
    isActionLockedRef.current = true;
    setShowConfirmModal(true);
  };
  const cancelSubmit = () => {
    setShowConfirmModal(false);
    setTimeout(() => {
      isActionLockedRef.current = false;
    }, 500);
  };

  // --- SECURE SUBMISSION LOGIC (Dumb Client Version) ---
  const handleFinalSubmit = async (options = {}) => {
    const isAuto = options?.isAuto === true;
    if (!activeTest || step !== "exam") return;
    if (isSubmitting && !isAuto) return;

    clearInterval(timerRef.current);
    isActionLockedRef.current = true; // STRICT LOCK (Prevents double clicks)
    setIsSubmitting(true); // SPINNER TRIGGER
    setShowConfirmModal(false);

    // 1. CREATE LIGHTWEIGHT PAYLOAD (Mapping shuffled back to Master Paper)
    const rawAnswers = answers.map((ans, i) => {
      let actualQ = activeTest.questions[i];
      let origQIdx =
        actualQ?.originalQIdx !== undefined ? actualQ.originalQIdx : i;

      let origVal = ans?.val ?? null;
      //Reverse map the selected option to its original backend index
      if (
        origVal !== null &&
        (actualQ?.type === "mcq" || actualQ?.type === "msq") &&
        actualQ?.optionMap
      ) {
        if (Array.isArray(origVal)) {
          // Safe filter to prevent malformed data
          origVal = origVal
            .map((v) => actualQ.optionMap[v])
            .filter((v) => v !== undefined);
        } else {
          origVal =
            actualQ.optionMap[origVal] !== undefined
              ? actualQ.optionMap[origVal]
              : null;
        }
      }

      // Sanitize integer / partial inputs before submission
      if (typeof origVal === "string") {
        let trimmed = origVal.trim();
        if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-." || trimmed === "-0.") {
          origVal = null;
        }
      }
      return {
        qIndex: origQIdx,
        val: origVal,
      };
    });

    // Ensure time spent is also mapped to original backend question indices
    let mappedQTime = {};
    Object.keys(qTime).forEach((shuffledIdx) => {
      let origQIdx =
        activeTest.questions[shuffledIdx]?.originalQIdx !== undefined
          ? activeTest.questions[shuffledIdx].originalQIdx
          : shuffledIdx;
      mappedQTime[origQIdx] = qTime[shuffledIdx];
    });

    const totalSecondsGiven = activeTest.duration
      ? activeTest.duration * 60
      : 0;
    const exactRemaining = Math.max(
      0,
      Math.floor((endTimeRef.current - getTrueNow()) / 1000),
    );
    const secondsSpent =
      totalSecondsGiven > 0 ? totalSecondsGiven - exactRemaining : 0;
    const timeTakenStr = formatTime(secondsSpent);

    const apiPayload = {
      testId: activeTest.id,
      student: {
        uid: currentUser ? currentUser.uid : "anonymous",
        name: name,
        roll: roll,
      },
      answers: rawAnswers,
      timeTaken: timeTakenStr,
      timeSpentPerQuestion: mappedQTime, // Sent mapped time
      cheatLogs: cheatLogsRef.current,
    };

    // EXPLICITLY KILL LIVE COUNTER
    if (presenceRefTarget.current && navigator.onLine) {
      try {
        await remove(presenceRefTarget.current);
        await onDisconnect(presenceRefTarget.current).cancel();
      } catch (e) {
        console.error(e);
      }
    }

    // 🔥 FIX: Define uidSafe here so it can be used for deletion
    const uidSafe = currentUser?.uid || "nouid";
    localStorage.removeItem(
      `exam_draft_${activeTest.id}_${name.trim() || "guest"}_${roll.trim().toLowerCase() || "noroll"}_${uidSafe}`,
    );
    sessionStorage.removeItem("examitop_active_exam");

    // OFFLINE VAULT SYNC LOGIC
    if (!navigator.onLine && !activeTest.isLocal) {
      let pending = JSON.parse(
        localStorage.getItem("examitop_pending_subs") || "[]",
      );
      pending.push({ testId: activeTest.id, payload: apiPayload });
      localStorage.setItem("examitop_pending_subs", JSON.stringify(pending));

      if (document.fullscreenElement && document.exitFullscreen)
        document.exitFullscreen().catch((e) => {});
      setStep("offline_saved");
      setIsSubmitting(false); // Remove spinner
      return;
    }

    try {
      if (!activeTest.isLocal) {
        // 2. SEND TO THE BRAIN (Backend API Call with Auth Token)
        const token = auth.currentUser
          ? await auth.currentUser.getIdToken(true)
          : "";
        const response = await fetch("/api/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(apiPayload),
        });

        //Pehle raw text lo, phir JSON me convert karo
        const responseText = await response.text();
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (jsonError) {
          console.error(
            "Backend returned HTML instead of JSON. Server crashed!",
            responseText,
          );
          throw new Error("Backend API crashed.");
        }

        if (!response.ok || !result.success) {
          setIsSubmitting(false);

          // P1.2 FIX: Don't unlock if time is already up! Force offline vault.
          if (timeLeft > 0) {
            isActionLockedRef.current = false;
          }

          setSysModal({
            type: "error",
            msg: result.message || "Failed to submit exam.",
            action: () => {
              if (result.message && result.message.includes("Duplicate")) {
                router.replace("/student-results");
              } else if (
                result.message &&
                result.message.includes("Test not found")
              ) {
                router.replace("/student"); // Completely invalid test, force exit
              }
            },
          });
          return;
        }
      }

      if (document.fullscreenElement && document.exitFullscreen)
        document.exitFullscreen().catch((e) => {});

      // SUCCESS REDIRECT (No Popup, direct to results)
      // Spinner screen chalti rahegi tab tak jab tak route push na ho jaye
      if (isExaminerDemo) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("examitop_demo_examiner");
        }
        router.replace("/tests");
        return;
      }
      router.replace("/student-results");
      return;
    } catch (error) {
      console.error("Transmission Error:", error);
      setIsSubmitting(false);

      //INJECTION A FIX: Immediate force-save to Offline Vault (Don't wait for user click)
      let pending = JSON.parse(
        localStorage.getItem("examitop_pending_subs") || "[]",
      );
      pending.push({ testId: activeTest.id, payload: apiPayload });
      localStorage.setItem("examitop_pending_subs", JSON.stringify(pending));

      // P1.2 FIX: Only unlock the exam UI if they still have time left. Otherwise, keep it locked!
      if (timeLeft > 0) {
        isActionLockedRef.current = false;
      }

      setSysModal({
        type: "error",
        msg: "Network dropped during submission! Your exam has been securely locked in the Offline Vault and will auto-sync when internet returns.",
        action: () => {
          setStep("offline_saved");
        },
      });
    }
  };

  if (!isMounted || authLoading || isSubmitting || isFetchingTest) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center z-[99999] overflow-hidden select-none transition-colors duration-500 ${
        isSubmitting ? "bg-[#070b14] text-white" : "bg-slate-50"
      }`}>
        <style>{`
            @keyframes spinDash { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.4); } 70% { box-shadow: 0 0 0 20px rgba(37,99,235,0); } 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); } }
            @keyframes shimmerMove { 0% { transform: translateX(-150%); } 100% { transform: translateX(250%); } }
            @keyframes floatUp { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }

            /* 3D GYRO-VAULT PRECIPITATION ANIMATIONS (FAUX-3D HIGH-TECH) */
            @keyframes gyroX {
              0% { transform: rotateX(68deg) rotateY(15deg) rotateZ(0deg); }
              100% { transform: rotateX(68deg) rotateY(15deg) rotateZ(360deg); }
            }
            @keyframes gyroY {
              0% { transform: rotateY(70deg) rotateX(25deg) rotateZ(0deg); }
              100% { transform: rotateY(70deg) rotateX(25deg) rotateZ(360deg); }
            }
            @keyframes gyroZ {
              0% { transform: rotateX(30deg) rotateY(60deg) rotateZ(0deg); }
              100% { transform: rotateX(30deg) rotateY(60deg) rotateZ(360deg); }
            }
            @keyframes vaultSpherePulse {
              0%, 100% {
                transform: translate(-50%, -50%) scale(1);
                box-shadow: 0 0 35px rgba(16, 185, 129, 0.7), 0 10px 30px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.5), inset 0 -6px 12px rgba(0, 0, 0, 0.6);
              }
              50% {
                transform: translate(-50%, -50%) scale(1.08);
                box-shadow: 0 0 55px rgba(16, 185, 129, 0.9), 0 14px 40px rgba(0, 0, 0, 0.8), inset 0 3px 6px rgba(255, 255, 255, 0.7), inset 0 -8px 16px rgba(0, 0, 0, 0.6);
              }
            }
            @keyframes radarPing {
              0% { transform: scale(0.6); opacity: 0.9; }
              50% { opacity: 0.5; }
              100% { transform: scale(1.6); opacity: 0; }
            }
            @keyframes photonOrbit {
              0% { transform: rotate(0deg) translateX(85px) rotate(0deg); }
              100% { transform: rotate(360deg) translateX(85px) rotate(-360deg); }
            }
        `}</style>

        {isFetchingTest ? (
          <div className="text-center animate-[fadeIn_0.3s_ease] flex flex-col items-center max-w-sm px-6">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute -inset-2 bg-blue-600/20 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-400/40 animate-[spinDash_8s_linear_infinite]"></div>
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-blue-600 border-r-indigo-600 animate-[spinDash_1.2s_cubic-bezier(0.4,0,0.2,1)_infinite]"></div>
              <div className="absolute inset-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30">
                <i className="ti ti-lock-open text-2xl text-white"></i>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-extrabold uppercase tracking-widest mb-3 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
              Synchronizing Vault
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2 tracking-tight">
              Decrypting Exam Session
            </h2>
            <p className="text-xs font-semibold text-slate-500 mb-5 leading-relaxed">
              Verifying security tokens and retrieving encrypted question papers...
            </p>
            {/* Shimmer Progress Track */}
            <div className="w-52 h-1.5 bg-slate-200/80 rounded-full overflow-hidden relative">
              <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full animate-[shimmerMove_1.5s_infinite]"></div>
            </div>
          </div>
        ) : isSubmitting ? (
          <div className="text-center animate-[fadeIn_0.4s_ease] flex flex-col items-center max-w-md px-6 z-10 relative">
            {/* Ambient Radial Spotlight */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

            {/* Top Security Seal Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-widest mb-8 shadow-[0_0_25px_rgba(16,185,129,0.2)] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Cryptographic Vault Seal
            </div>

            {/* FAUX-3D GYRO-VAULT SPHERE STAGE */}
            <div className="relative w-[210px] h-[210px] sm:w-[230px] sm:h-[230px] mb-8 flex items-center justify-center [perspective:800px]">
              {/* Sonar Expanding Waves */}
              <div
                className="absolute inset-0 rounded-full border border-emerald-400/30 pointer-events-none"
                style={{ animation: "radarPing 2.8s cubic-bezier(0, 0.2, 0.8, 1) infinite" }}
              ></div>
              <div
                className="absolute inset-0 rounded-full border border-teal-400/20 pointer-events-none"
                style={{ animation: "radarPing 2.8s cubic-bezier(0, 0.2, 0.8, 1) infinite 1.4s" }}
              ></div>

              {/* 3D Gyro Ring 1 (X-Axis Equator Precession) */}
              <div
                className="absolute inset-[6px] rounded-full border-[2.5px] border-emerald-500/40 pointer-events-none"
                style={{
                  borderTopColor: "#10b981",
                  borderRightColor: "#34d399",
                  boxShadow: "0 0 18px rgba(16, 185, 129, 0.35), inset 0 0 15px rgba(16, 185, 129, 0.2)",
                  animation: "gyroX 4.5s linear infinite",
                }}
              ></div>

              {/* 3D Gyro Ring 2 (Y-Axis Polar Precession with dashes) */}
              <div
                className="absolute inset-[18px] rounded-full border-[2.5px] border-dashed border-cyan-400/40 pointer-events-none"
                style={{
                  borderTopColor: "#06b6d4",
                  borderBottomColor: "#38bdf8",
                  boxShadow: "0 0 22px rgba(6, 182, 212, 0.3)",
                  animation: "gyroY 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                }}
              ></div>

              {/* 3D Gyro Ring 3 (Z-Axis Diagonal Precession) */}
              <div
                className="absolute inset-[30px] rounded-full border-[2px] border-indigo-400/30 pointer-events-none"
                style={{
                  borderLeftColor: "#818cf8",
                  borderRightColor: "#a855f7",
                  animation: "gyroZ 5.5s linear infinite reverse",
                }}
              ></div>

              {/* Orbiting Photon Bead */}
              <div
                className="absolute top-1/2 left-1/2 -mt-1 -ml-1 w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#34d399] pointer-events-none"
                style={{ animation: "photonOrbit 3s linear infinite" }}
              ></div>

              {/* Levitating 3D Isometric Core Sphere */}
              <div
                className="absolute top-1/2 left-1/2 w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-full flex items-center justify-center pointer-events-none"
                style={{
                  background: "radial-gradient(circle at 35% 32%, #6ee7b7 0%, #10b981 40%, #064e3b 85%, #022c22 100%)",
                  animation: "vaultSpherePulse 2.2s ease-in-out infinite",
                }}
              >
                {/* Core Lock Symbol with 3D Specular Relief */}
                <div className="relative text-white flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                  <i className="ti ti-lock-check text-3xl sm:text-4xl text-white"></i>
                </div>
              </div>
            </div>

            {/* Primary Headline */}
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              Encrypting & Locking Vault
            </h2>

            <p className="text-xs sm:text-[13px] font-semibold text-slate-400 leading-relaxed max-w-xs sm:max-w-sm mb-6">
              Signing session cryptographic keys, packaging proctoring telemetry, and securing paper responses...
            </p>

            {/* 3-Step Milestone Progression Bar */}
            <div className="w-full max-w-xs mb-5">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2 px-1">
                <span className="text-emerald-400 flex items-center gap-1">
                  <i className="ti ti-check text-xs font-black"></i> Packaged
                </span>
                <span className="text-cyan-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span> Encrypting
                </span>
                <span className="text-slate-500">Transferred</span>
              </div>

              {/* Shimmer Progress Track */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
                <div
                  className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full"
                  style={{ animation: "shimmerMove 1.4s ease-in-out infinite" }}
                ></div>
              </div>
            </div>

            {/* Trust & Compliance Badge */}
            <div className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 bg-slate-900/80 px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-sm">
              <i className="ti ti-shield-check text-emerald-400 text-sm"></i>
              <span>256-Bit SHA Encrypted Transmission</span>
            </div>
          </div>
        ) : (
          <div className="text-center animate-[fadeIn_0.4s_ease] flex flex-col items-center">
            <div className="relative w-[100px] h-[100px] mb-8">
              <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-slate-300 animate-[spinDash_8s_linear_infinite]"></div>
              <div className="absolute inset-[10px] rounded-full border-[3px] border-transparent border-t-blue-600 animate-[spinDash_1s_cubic-bezier(0.4,0,0.2,1)_infinite]"></div>
              <div className="absolute inset-[20px] bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center shadow-lg animate-[pulseGlow_2s_infinite]">
                <i className="ti ti-shield-lock text-3xl text-white"></i>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2 tracking-tight">
              Initializing Secure Portal...
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Please wait
            </p>
          </div>
        )}
      </div>
    );
  }

  if (step === "offline_saved") {
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "5rem",
          padding: "2rem",
          maxWidth: "500px",
          margin: "5rem auto",
        }}
      >
        <i
          className="ti ti-wifi-off"
          style={{
            fontSize: "80px",
            color: "#854F0B",
            marginBottom: "1rem",
            animation: "pulse 2s infinite",
          }}
        ></i>
        <h2 style={{ color: "#0f172a", marginBottom: "10px" }}>
          Connection Lost, But You're Safe!
        </h2>
        <p
          style={{
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
            marginBottom: "2rem",
          }}
        >
          Your answers have been securely saved to this device. Please do not
          clear your browser cache. Connect to the internet and return to this
          platform, and the system will automatically sync your submission.
        </p>
        <button className="btn btn-primary" onClick={() => router.push("/")}>
          Return Home
        </button>
      </div>
    );
  }

  const answeredQs = answers.filter(
    (a) => a?.val !== null && a?.val !== undefined && a?.val !== "" && (!Array.isArray(a?.val) || a.val.length > 0),
  ).length;
  const markedQs = answers.filter((a) => a?.marked).length;
  const remainingQs = Math.max(0, maxAllowedQuestions - answeredQs);

  // Phase 4: Ergonomic Question Palette Button Renderer
  const renderPalButton = (i, displayNum, isMobile = false) => {
    const a = answers[i];
    const isDone = a?.val !== null && a?.val !== undefined && a?.val !== "" && (!Array.isArray(a?.val) || a.val.length > 0);
    const isMarked = !!a?.marked;
    const isVisited = !!visitedQs[i];
    const isCurrent = i === curQ;

    // Filter matching
    let matches = true;
    if (paletteFilter === "answered") matches = isDone;
    else if (paletteFilter === "marked") matches = isMarked;
    else if (paletteFilter === "pending") matches = !isDone;

    // High-tech status badges
    let btnStyle = "bg-white text-slate-700 border border-slate-200 hover:border-slate-400";
    if (isDone && isMarked) {
      btnStyle = "bg-purple-600 text-white font-black shadow-xs hover:bg-purple-700 border border-purple-500";
    } else if (isMarked) {
      btnStyle = "bg-purple-100 text-purple-900 font-extrabold border-2 border-purple-400 hover:bg-purple-200";
    } else if (isDone) {
      btnStyle = "bg-emerald-600 text-white font-black shadow-xs hover:bg-emerald-700 border border-emerald-500";
    } else if (isVisited) {
      btnStyle = "bg-rose-50 text-rose-700 font-bold border border-rose-300 hover:bg-rose-100";
    }

    const currentIndicator = isCurrent
      ? "ring-2 ring-blue-600 ring-offset-2 scale-105 z-10 shadow-md font-black"
      : "";

    const filterDim = matches ? "opacity-100" : "opacity-20 hover:opacity-70 scale-95";

    return (
      <button
        key={i}
        type="button"
        className={`relative ${isMobile ? "h-11 text-sm font-black" : "h-9 text-xs font-bold"} w-full rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-90 ${btnStyle} ${currentIndicator} ${filterDim}`}
        onClick={() => {
          changeQuestion(i);
          if (isMobile) setIsMobilePaletteOpen(false);
        }}
        title={`Question ${displayNum || i + 1}: ${isDone ? "Answered" : isVisited ? "Visited (Unanswered)" : "Not Visited"}${isMarked ? " (Marked)" : ""}`}
      >
        {displayNum || i + 1}
        {isDone && isMarked && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-white"></span>
        )}
      </button>
    );
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 animate-[fadeIn_0.3s_ease]">
      {/* 🚀 AUTO-RESCUE / RECOVERY OVERLAY VIEW */}
      {rescueState.active && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {rescueState.status === "rescuing" && (
              <>
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 text-3xl">
                  <i className="ti ti-loader-2 animate-spin"></i>
                </div>
                <h2 className="text-xl sm:text-2xl font-black mb-2 text-white">
                  Rescuing Exam Submission
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mb-6 font-medium">
                  {rescueState.message ||
                    "Aapke 2 ghante ke answers cloud me sync aur evaluate ho rahe hain..."}
                </p>
                <div className="space-y-2 text-left bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <i className="ti ti-check"></i> Encrypted answers restored from device
                  </div>
                  <div className="flex items-center gap-2 text-blue-400 font-bold animate-pulse">
                    <i className="ti ti-refresh animate-spin"></i> Submitting to Cloud Evaluation Engine...
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <i className="ti ti-circle"></i> Preparing Scorecard & Leaderboard
                  </div>
                </div>
              </>
            )}

            {rescueState.status === "success" && (
              <>
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-3xl">
                  <i className="ti ti-circle-check"></i>
                </div>
                <h2 className="text-xl sm:text-2xl font-black mb-2 text-emerald-400">
                  Exam Successfully Submitted!
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mb-6 font-medium">
                  {rescueState.message ||
                    "Aapke answers evaluate ho chuke hain. Result portal par redirect ho rahe hain..."}
                </p>
                <button
                  onClick={() => router.replace("/student-results")}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  View My Result / Scorecard
                </button>
              </>
            )}

            {rescueState.status === "error" && (
              <>
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-3xl">
                  <i className="ti ti-alert-triangle"></i>
                </div>
                <h2 className="text-xl sm:text-2xl font-black mb-2 text-rose-400">
                  Submission Notice
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mb-6 font-medium">
                  {rescueState.message}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setRescueState({
                        active: false,
                        status: "idle",
                        message: "",
                      })
                    }
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer border border-slate-700"
                  >
                    Go to Portal
                  </button>
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined")
                        window.location.reload();
                    }}
                    className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-blue-600/30"
                  >
                    Retry Now
                  </button>
                </div>
              </>
            )}

            {rescueState.status === "not_found" && (
              <>
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-3xl">
                  <i className="ti ti-info-circle"></i>
                </div>
                <h2 className="text-xl sm:text-2xl font-black mb-2 text-amber-400">
                  No Pending Draft Found
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mb-6 font-medium">
                  Is browser me koi unsubmitted exam ka draft nahi mila. Ho sakta hai aapka paper pehle hi submit ho chuka ho.
                </p>
                <button
                  onClick={() => router.replace("/student-results")}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  Check Student Results
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* STEP 1: PREMIUM JOIN FORM */}
      {step === "join" && (
        <div className="relative max-w-[460px] mx-auto mt-6 sm:mt-14 animate-[fadeIn_0.4s_ease]">
          {/* Subtle Ambient Glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-sky-500/20 rounded-[36px] blur-2xl opacity-70 -z-10"></div>

          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] border border-slate-200/80 overflow-hidden p-6 sm:p-9 transition-all">
            {/* Header Badge & Title */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-[11px] font-extrabold uppercase tracking-widest mb-4 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                Secure CBT Gateway
              </div>

              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-600/25 mx-auto mb-4 ring-4 ring-blue-50">
                <i className="ti ti-shield-check"></i>
              </div>
              <h1 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight mb-1.5">
                Join Examination
              </h1>
              <p className="text-xs sm:text-[13px] font-medium text-slate-500 leading-relaxed">
                Enter your roll number and the 6-digit test code to access the assessment hall.
              </p>
            </div>

            {/* Authenticated Candidate Identity Card */}
            {currentUser && (
              <div className="mb-5 bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
                    {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : "S"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-800 truncate">
                      {currentUser.displayName || "Authenticated Student"}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 truncate">
                      {currentUser.email || "Verified Candidate"}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <i className="ti ti-circle-check-filled text-emerald-500 text-xs"></i> Verified
                </span>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {/* Candidate Full Name */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <i className="ti ti-user text-slate-400 text-sm"></i> Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Kumar"
                  disabled={!!currentUser}
                  onKeyDown={handleKeyDownJoin}
                  className={`w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all ${currentUser ? "bg-slate-100/70 text-slate-500 cursor-not-allowed" : "bg-white"}`}
                />
              </div>

              {/* Roll Number */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <i className="ti ti-id text-slate-400 text-sm"></i> Roll Number / Candidate ID
                </label>
                <input
                  type="text"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  placeholder="e.g. 2024CS001"
                  onKeyDown={handleKeyDownJoin}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white"
                />
              </div>

              {/* 6-Digit Secure Code */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <i className="ti ti-key text-slate-400 text-sm"></i> 6-Digit Test Code
                  </label>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${code.length === 6 ? "text-emerald-600" : "text-slate-400"}`}>
                    {code.length === 6 ? "✓ Ready" : `${code.length}/6 Digits`}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="• • • • • •"
                    maxLength="6"
                    onKeyDown={handleKeyDownJoin}
                    className={`w-full px-4 py-3.5 rounded-2xl border-2 text-2xl font-black text-center text-slate-900 tracking-[0.35em] uppercase outline-none transition-all placeholder:tracking-widest placeholder:text-slate-300 ${
                      code.length === 6
                        ? "border-emerald-500 bg-emerald-50/20 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10"
                        : "border-slate-200 bg-slate-50/60 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    }`}
                  />
                  {code.length === 6 && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500 text-lg pointer-events-none">
                      <i className="ti ti-check"></i>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {joinError && (
              <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-2xl text-[12.5px] font-bold mb-6 border border-rose-200/80 flex items-center gap-2.5 shadow-xs animate-[fadeIn_0.2s_ease]">
                <i className="ti ti-alert-triangle text-rose-500 text-lg shrink-0"></i>
                <span className="leading-snug">{joinError}</span>
              </div>
            )}

            {!currentUser ? (
              <div className="space-y-3">
                <div className="bg-amber-50/80 border border-amber-200 text-amber-800 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-xs">
                  <i className="ti ti-lock text-base text-amber-600 shrink-0"></i>
                  <span>Guest entry is locked. Please login with your student account.</span>
                </div>
                <button
                  type="button"
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white font-black text-[15px] rounded-2xl shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  onClick={() => router.push("/")}
                >
                  <i className="ti ti-login text-lg"></i> Login to Take Exam
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-[15px] rounded-2xl shadow-lg shadow-blue-600/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                onClick={handleJoinTest}
                disabled={!name.trim() || !code.trim() || isFetchingTest}
              >
                <span>Enter Assessment Hall</span>
                <i className="ti ti-arrow-right text-lg"></i>
              </button>
            )}

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
              <i className="ti ti-shield-lock text-emerald-600 text-sm"></i>
              <span>256-Bit Encrypted &bull; Automated Proctoring</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PROFESSIONAL PRE-EXAM INSTRUCTIONS & READINESS */}
      {step === "instructions" && activeTest && (
        <div className="max-w-4xl mx-auto mt-4 sm:mt-8 bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.06)] border border-slate-200/80 overflow-hidden animate-[fadeIn_0.4s_ease]">
          {/* Top Ambient Header Banner */}
          <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-6 sm:p-8 overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <span className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  <i className="ti ti-books"></i> {activeTest?.subject || "General"}
                </span>
                <span className="inline-flex items-center gap-1 bg-white/10 text-white/90 text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border border-white/15">
                  #{activeTest?.code || code}
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold ml-auto">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Pre-Flight Verified
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight mb-2">
                {activeTest?.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <i className="ti ti-user-check text-blue-400"></i>
                  Candidate: <strong className="text-white">{name}</strong>
                </span>
                {roll && (
                  <span className="flex items-center gap-1.5">
                    <i className="ti ti-id text-indigo-400"></i>
                    Roll: <strong className="text-white">{roll}</strong>
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-slate-400">
                  <i className="ti ti-cpu text-slate-400"></i> ExamiTop CBT Engine
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* Session Restored Alert Banner */}
            {draftToResume && (
              <div className="bg-amber-50/90 text-amber-900 border border-amber-200/90 px-5 py-4 rounded-2xl mb-6 shadow-xs flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <i className="ti ti-history text-xl"></i>
                </div>
                <div>
                  <h4 className="text-sm font-black text-amber-900 mb-0.5">
                    Active Session Restored
                  </h4>
                  <p className="text-xs sm:text-[13px] font-medium text-amber-800/90 leading-relaxed">
                    We detected an incomplete exam session. Your previously chosen answers have been loaded securely, and your timer will resume from where you left off.
                  </p>
                </div>
              </div>
            )}

            {/* Test Details Metric Bento Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-7">
              {/* Tile 1: Duration */}
              <div className="bg-slate-50/80 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Time Allotted
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                    <i className="ti ti-clock"></i>
                  </div>
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-black text-slate-900">
                    {activeTest?.duration} <span className="text-xs font-bold text-slate-500">Mins</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {Number(activeTest?.duration) >= 60
                      ? `${(Number(activeTest?.duration) / 60).toFixed(1)} Hours Total`
                      : "Strict Countdown"}
                  </div>
                </div>
              </div>

              {/* Tile 2: Questions & Sections */}
              <div className="bg-slate-50/80 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Questions
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm">
                    <i className="ti ti-file-text"></i>
                  </div>
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-black text-slate-900">
                    {activeTest?.questions?.length || 0} <span className="text-xs font-bold text-slate-500">Items</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {activeTest?.sections?.length || 1} Section(s)
                  </div>
                </div>
              </div>

              {/* Tile 3: Total Score */}
              <div className="bg-slate-50/80 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Total Marks
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                    <i className="ti ti-award"></i>
                  </div>
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-black text-emerald-700">
                    {activeTest?.totalMarks} <span className="text-xs font-bold text-emerald-600">Marks</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Max Scaled Score
                  </div>
                </div>
              </div>

              {/* Tile 4: Marking Scheme */}
              <div className="bg-slate-50/80 border border-slate-200/80 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Marking Scheme
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm">
                    <i className="ti ti-target"></i>
                  </div>
                </div>
                <div>
                  <div className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                    <span className="text-emerald-600">Correct: +{activeTest?.questions?.length ? (Number(activeTest.totalMarks) / activeTest.questions.length).toFixed(0) : 4}</span>
                  </div>
                  <div className="text-[11px] font-bold mt-0.5">
                    {activeTest?.negMarking ? (
                      <span className="text-rose-600">Neg: -{Math.abs(activeTest.negMarking)} per wrong</span>
                    ) : (
                      <span className="text-emerald-600">No Negative Marking</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section Attempt Rules Guideline (If optional questions exist) */}
            {activeTest?.sectionRules &&
              Object.keys(activeTest.sectionRules).some(
                (s) => Number(activeTest.sectionRules[s]) > 0,
              ) && (
                <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl mb-7 shadow-xs">
                  <div className="text-[11px] font-extrabold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <i className="ti ti-adjustments-alt text-indigo-600 text-sm"></i>
                    Section Rules (Evaluation Limits)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {Object.entries(activeTest.sectionRules).map(([sec, limit]) => {
                      const lim = Number(limit);
                      if (!lim || lim <= 0) return null;
                      return (
                        <div
                          key={sec}
                          className="bg-white border border-indigo-200/80 px-3.5 py-2.5 rounded-xl shadow-xs flex items-center justify-between"
                        >
                          <span className="text-xs font-bold text-slate-800 truncate mr-2">
                            {sec}
                          </span>
                          <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 shrink-0">
                            Max {lim} Qs
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* PRE-FLIGHT SYSTEM & DEVICE READINESS DOCK */}
            <div className="mb-7">
              <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <i className="ti ti-checklist text-blue-600 text-sm"></i> System & Device Readiness Check
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Fullscreen Engine */}
                <div className="bg-slate-50/90 border border-slate-200/80 p-3.5 rounded-2xl flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${activeTest?.fullScreenMode ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    <i className="ti ti-maximize"></i>
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-800">
                      {activeTest?.fullScreenMode ? "Fullscreen Required" : "Standard Display"}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      {activeTest?.fullScreenMode
                        ? "Browser will auto-lock into full screen."
                        : "Works in normal browser window."}
                    </div>
                  </div>
                </div>

                {/* 2. Real-time Network / Offline Vault */}
                <div className="bg-slate-50/90 border border-slate-200/80 p-3.5 rounded-2xl flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${isDeviceOnline ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    <i className={`ti ${isDeviceOnline ? "ti-wifi" : "ti-wifi-off"}`}></i>
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>Offline Sync Vault</span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isDeviceOnline ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      Answers auto-save locally in real-time. Zero data loss.
                    </div>
                  </div>
                </div>

                {/* 3. Anti-Cheat / Tab Monitoring */}
                <div className="bg-slate-50/90 border border-slate-200/80 p-3.5 rounded-2xl flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${activeTest?.antiCheat ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                    <i className="ti ti-shield-lock"></i>
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-800">
                      {activeTest?.antiCheat ? "Proctoring Armed" : "Standard Rules"}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      {activeTest?.antiCheat
                        ? "Tab-switch, minimizing & splits trigger strikes."
                        : "Honor code monitoring active."}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Critical Exam Guidelines */}
            <div className="bg-slate-900 text-slate-300 p-4 sm:p-5 rounded-2xl text-[12.5px] leading-relaxed mb-6 border border-slate-800 shadow-inner">
              <div className="text-white font-extrabold flex items-center gap-2 mb-2 text-sm">
                <i className="ti ti-alert-circle text-amber-400 text-base"></i>
                <span>Important Candidate Notice</span>
              </div>
              <ul className="space-y-1.5 text-slate-300 text-xs sm:text-[12.5px]">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold shrink-0">&bull;</span>
                  <span><strong>Do not refresh or click the browser's Back button</strong> during the live exam.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold shrink-0">&bull;</span>
                  <span>Use the <strong>Question Palette</strong> to jump across questions. You may mark questions for review and return anytime.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 font-bold shrink-0">&bull;</span>
                  <span>When time expires, the assessment will <strong>automatically seal and submit</strong> all saved answers.</span>
                </li>
              </ul>
            </div>

            {/* Candidate Declaration Checkbox */}
            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors mb-6 select-none">
              <input
                type="checkbox"
                checked={rulesAgreed}
                onChange={(e) => setRulesAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 leading-relaxed">
                I have read and agree to all exam instructions. I confirm that I will not switch tabs or use unauthorized resources during this assessment.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!draftToResume && (
                <button
                  type="button"
                  className="w-full sm:w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[14px] rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                  onClick={() => {
                    if (isExaminerDemo) {
                      if (typeof window !== "undefined") {
                        sessionStorage.removeItem("examitop_demo_examiner");
                      }
                      router.push("/tests");
                    } else if (isDirectJoin) {
                      router.push("/student/radar");
                    } else {
                      setStep("join");
                    }
                  }}
                >
                  <i className="ti ti-arrow-left"></i>
                  <span>{isExaminerDemo ? "Exit Demo to Vault" : "Go Back"}</span>
                </button>
              )}

              <button
                type="button"
                className={`w-full ${draftToResume ? "" : "sm:w-2/3"} py-3.5 text-white font-black text-[15px] rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
                  rulesAgreed
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-600/25"
                    : "bg-slate-400 cursor-not-allowed opacity-60 shadow-none"
                }`}
                onClick={startExam}
                disabled={!rulesAgreed}
              >
                <i className="ti ti-player-play text-lg"></i>
                <span>{draftToResume ? "Resume Assessment Now" : "Start Assessment Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: LIVE EXAM ENGINE */}
      {step === "exam" &&
        activeTest &&
        currentQuestion &&
        answers.length > 0 && (
          <>
            {/* UNIFIED ZERO-WASTE GLASS EXAM TOPBAR */}
            <div className="sticky top-0 z-[100] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-sm mb-3 px-3 sm:px-5 py-2.5 sm:py-3 transition-all">
              <div className="flex items-center justify-between gap-2.5 sm:gap-4">
                {/* Left Column: Brand Emblem + Title + Q Breadcrumb + Counters */}
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-center font-black text-sm sm:text-base shadow-sm shadow-blue-600/20 shrink-0 ring-2 ring-blue-50">
                    <i className="ti ti-file-text"></i>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2
                        className="text-xs sm:text-sm font-black text-slate-800 truncate max-w-[130px] sm:max-w-[260px] md:max-w-[360px]"
                        title={activeTest?.title}
                      >
                        {activeTest?.title}
                      </h2>
                      {isExaminerDemo && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200/80 px-2 py-0.5 rounded-full shrink-0">
                          Demo Mode
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 mt-0.5">
                      <span className="hidden sm:inline truncate max-w-[120px]">
                        {name} {roll ? `(${roll})` : ""}
                      </span>
                      <span className="hidden sm:inline text-slate-300">&bull;</span>
                      <span className="text-blue-700 font-extrabold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 shrink-0">
                        Q {curQ + 1} of {activeTest?.questions?.length}
                      </span>
                      <span className="hidden md:inline text-slate-300">&bull;</span>
                      {/* Inline Live Metric Counters (Saves 45px vertical strip!) */}
                      <div className="hidden md:flex items-center gap-3 text-[11px] font-bold">
                        <span className="flex items-center gap-1.5 text-blue-700" title="Attempted Questions">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span> {answeredQs} Attempted
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-700" title="Marked for Review">
                          <span className="w-2 h-2 rounded-full bg-amber-400"></span> {markedQs} Marked
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500" title="Pending Questions">
                          <span className="w-2 h-2 rounded-full bg-slate-200 border border-slate-400"></span> {remainingQs} Pending
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center Column: Section Switcher Chips (Integrated directly, Desktop & Tablet) */}
                {activeTest?.sections && activeTest.sections.length > 1 && (
                  <div className="hidden lg:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80 max-w-[440px] overflow-x-auto hide-scroll">
                    {activeTest.sections.map((sec, idx) => {
                      const firstQIdx = activeTest.questions.findIndex(
                        (qq) => String(qq.section) === String(sec) || (!qq.section && idx === 0)
                      );
                      const isCurrentSec =
                        String(currentQuestion?.section) === String(sec) ||
                        (!currentQuestion?.section && idx === 0);

                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                            isCurrentSec
                              ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                              : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                          }`}
                          onClick={() => {
                            if (firstQIdx > -1) changeQuestion(firstQIdx);
                          }}
                        >
                          {sec}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Right Column: Autosaved pill + Exit Demo + Timer + Finish button */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                  {/* Autosaved Live Indicator */}
                  <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Encrypted & Saved</span>
                  </div>

                  {/* Exit Demo button (for examiner demo) */}
                  {isExaminerDemo && (
                    <button
                      type="button"
                      className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          sessionStorage.removeItem("examitop_demo_examiner");
                        }
                        router.push("/tests");
                      }}
                      title="Exit Demo to Tests Vault"
                    >
                      <i className="ti ti-arrow-left"></i>
                      <span className="hidden sm:inline">Exit Demo</span>
                    </button>
                  )}

                  {/* Glowing Countdown Timer */}
                  <div
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black font-mono tracking-tight transition-all shadow-xs ${
                      timeLeft <= 300
                        ? "bg-rose-50 text-rose-700 border-2 border-rose-400 animate-pulse"
                        : "bg-slate-900 text-white border border-slate-800"
                    }`}
                  >
                    <i className={`ti ti-clock text-sm sm:text-base ${timeLeft <= 300 ? "text-rose-600 animate-spin" : "text-blue-400"}`}></i>
                    <span className="tabular-nums">{formatTime(timeLeft)}</span>
                  </div>

                  {/* Finish Assessment Button */}
                  <button
                    type="button"
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                    onClick={confirmAndSubmit}
                    title="Review & Submit Exam"
                  >
                    <i className="ti ti-send text-xs sm:text-sm"></i>
                    <span className="hidden sm:inline">Finish</span>
                  </button>
                </div>
              </div>

              {/* Mobile / Tablet Section Ribbon (Only if multiple sections exist) */}
              {activeTest?.sections && activeTest.sections.length > 1 && (
                <div className="lg:hidden flex items-center gap-1.5 pt-2 mt-2 border-t border-slate-100 overflow-x-auto hide-scroll">
                  {activeTest.sections.map((sec, idx) => {
                    const firstQIdx = activeTest.questions.findIndex(
                      (qq) => String(qq.section) === String(sec) || (!qq.section && idx === 0)
                    );
                    const isCurrentSec =
                      String(currentQuestion?.section) === String(sec) ||
                      (!currentQuestion?.section && idx === 0);

                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`px-3 py-1 rounded-lg text-[11px] font-black whitespace-nowrap transition-all cursor-pointer ${
                          isCurrentSec
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                        onClick={() => {
                          if (firstQIdx > -1) changeQuestion(firstQIdx);
                        }}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="split-exam-layout">
              {/* LEFT PANE: INDEPENDENT QUESTION SECTION */}
              <div className="q-area-wrapper">
                <div className="q-area-scroll custom-scrollbar">
                  {/* EXECUTIVE QUESTION CANVAS CARD */}
                  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_10px_35px_-10px_rgba(15,23,42,0.05)] p-4 sm:p-7 mb-4 transition-all">
                    {/* 1. CLEAN EXECUTIVE META HEADER (Focused, Uncluttered) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100">
                      {/* Left: Question Tag + Type + Section + Mark */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs sm:text-sm tracking-wide shadow-xs">
                          Q.{curQ + 1}
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80">
                          <span className={`w-2 h-2 rounded-full ${
                            currentQuestion?.type === "mcq" ? "bg-blue-600" :
                            currentQuestion?.type === "msq" ? "bg-emerald-600" :
                            currentQuestion?.type === "integer" ? "bg-amber-500" : "bg-purple-600"
                          }`}></span>
                          {getLabel(currentQuestion?.type)}
                        </span>

                        {currentQuestion?.section && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70">
                            <i className="ti ti-folder text-purple-500 text-[11px]"></i> {currentQuestion.section}
                          </span>
                        )}

                        {answers[curQ]?.marked && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs">
                            <i className="ti ti-bookmark-filled text-amber-600 text-xs"></i>
                            <span>Marked</span>
                          </span>
                        )}
                      </div>

                      {/* Right: Consolidated Marking Tag + Section Attempt Limit */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-flex items-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 shadow-2xs">
                          <span className="text-emerald-700 font-extrabold flex items-center gap-0.5">
                            +{currentQuestion?.marks || 4}
                          </span>
                          {activeTest?.negMarking ? (
                            <>
                              <span className="text-slate-300 mx-1.5">|</span>
                              <span className="text-rose-600 font-extrabold flex items-center gap-0.5">
                                -{Math.abs(activeTest.negMarking)}
                              </span>
                            </>
                          ) : null}
                          <span className="text-slate-400 font-normal ml-1">marks</span>
                        </div>

                        {(() => {
                          const curSec =
                            currentQuestion?.section ||
                            (activeTest?.sections && activeTest.sections[0]);
                          const secRule =
                            activeTest?.sectionRules && curSec
                              ? Number(activeTest.sectionRules[curSec])
                              : 0;
                          if (secRule > 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg shadow-2xs">
                                <i className="ti ti-target text-amber-600 text-xs"></i> Max {secRule} Attempt
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* 2. QUESTION CONTENT AREA (With Zero Raw-LaTeX Flicker Protection) */}
                    <div className="q-area-content transition-opacity duration-200" style={{ flex: 1, opacity: 0 }}>
                      {/* Question Text Box - Commanding High-Contrast Hero Reading Stage */}
                      <div className="relative pl-4 sm:pl-6 py-2.5 my-1 border-l-[3.5px] border-l-blue-600 bg-gradient-to-r from-blue-50/25 via-slate-50/15 to-transparent rounded-r-2xl mb-6">
                        <StaticMath
                          isBlock={true}
                          html={currentQuestion?.text}
                          style={{
                            fontSize: "18px",
                            lineHeight: 1.9,
                            color: "#090d16",
                            fontWeight: 600,
                            letterSpacing: "-0.01em",
                          }}
                        />
                      </div>

                      {/* 3. UNIVERSAL FIGURE ENGINE (Graphs, SVGs, SMILES, TikZ) */}
                      {currentQuestion?.figureType &&
                        currentQuestion.figureType !== "none" &&
                        currentQuestion.figureData && (
                          <div className="bg-white border-2 border-slate-200/90 rounded-2xl overflow-hidden shadow-xs mb-6 max-w-full">
                            {/* Figure Header Ribbon */}
                            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/80">
                              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                <i className="ti ti-chart-dots text-blue-600 text-sm"></i>
                                Reference Diagram / Graph
                              </span>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[11px] font-black text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer shadow-2xs"
                                onClick={() => setZoomFigure({ type: currentQuestion.figureType, data: currentQuestion.figureData })}
                              >
                                <i className="ti ti-zoom-in text-xs"></i> Fullscreen Zoom
                              </button>
                            </div>

                            {/* Figure Visual Display */}
                            <div
                              className="p-4 sm:p-6 flex items-center justify-center bg-gradient-to-b from-slate-50/30 to-white min-h-[140px] cursor-zoom-in"
                              onClick={() => setZoomFigure({ type: currentQuestion.figureType, data: currentQuestion.figureData })}
                              title="Click to zoom in fullscreen"
                            >
                              {(currentQuestion.figureType === "image" ||
                                currentQuestion.figureType === "url") && (
                                <div className="relative flex justify-center">
                                  {!imgLoaded && (
                                    <div className="h-32 flex items-center justify-center text-slate-400">
                                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                  )}
                                  <img
                                    key={`img-${curQ}`}
                                    src={currentQuestion.figureData}
                                    alt="Question Diagram"
                                    className="max-w-full max-h-[280px] object-contain rounded-xl transition-opacity duration-300"
                                    style={{ opacity: imgLoaded ? 1 : 0 }}
                                    onLoad={() => setImgLoaded(true)}
                                    onError={(e) => {
                                      setImgLoaded(true);
                                      e.target.onerror = null;
                                      e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23ef4444' font-family='sans-serif' font-weight='bold'%3EImage Load Failed (Offline)%3C/text%3E%3C/svg%3E";
                                    }}
                                  />
                                </div>
                              )}

                              {currentQuestion.figureType === "svg" && (
                                <div
                                  className="w-full flex justify-center items-center overflow-x-auto"
                                  dangerouslySetInnerHTML={{
                                    __html: sanitizeSvg(currentQuestion.figureData),
                                  }}
                                />
                              )}

                              {currentQuestion.figureType === "smiles" && (
                                <div className="flex justify-center items-center">
                                  <SmilesViewer
                                    smilesCode={currentQuestion.figureData}
                                    width={280}
                                    height={220}
                                  />
                                </div>
                              )}

                              {currentQuestion.figureType === "tikz" && (
                                <div className="w-full flex justify-center items-center overflow-x-auto">
                                  <img
                                    key={`tikz-${curQ}`}
                                    src={`https://i.upmath.me/svg/${encodeURIComponent(currentQuestion.figureData.includes("\\begin{tikzpicture}") ? currentQuestion.figureData : "\\begin{tikzpicture}\n" + currentQuestion.figureData + "\n\\end{tikzpicture}")}`}
                                    alt="TikZ Graph"
                                    className="max-w-full max-h-[280px] object-contain"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='200'%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23ef4444' font-family='sans-serif' font-weight='bold'%3ETikZ Compilation Failed (Offline)%3C/text%3E%3C/svg%3E";
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* 4. OPTIONS & INPUTS ARENA */}
                      <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mt-4 mb-2.5 px-1">
                        <span className="flex items-center gap-1.5">
                          <i className="ti ti-list-check text-slate-500"></i>
                          {currentQuestion?.type === "msq"
                            ? "Select one or more correct options:"
                            : currentQuestion?.type === "mcq"
                            ? "Select the correct option:"
                            : currentQuestion?.type === "integer"
                            ? "Enter numerical answer:"
                            : "Type your answer:"}
                        </span>
                        {currentQuestion?.type === "msq" && (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md normal-case tracking-normal">
                            Multiple options can be correct
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 mt-1 mb-8">
                        {/* MCQ Options (Single Correct) */}
                        {currentQuestion?.type === "mcq" &&
                          currentQuestion.options.map((opt, j) => {
                            const isSelected = answers[curQ]?.val === j;
                            return (
                              <button
                                key={j}
                                type="button"
                                className={`group relative flex items-start w-full text-left p-4 sm:p-4.5 rounded-2xl border-2 transition-all duration-200 ease-in-out cursor-pointer active:scale-[0.99] ${
                                  isSelected
                                    ? "bg-gradient-to-r from-blue-50/90 to-indigo-50/50 border-blue-600 shadow-[0_4px_25px_rgba(37,99,235,0.14)] ring-4 ring-blue-500/10"
                                    : "bg-white border-slate-200/90 hover:border-blue-300 hover:bg-slate-50/90 shadow-2xs"
                                }`}
                                onClick={() => pickMCQ(curQ, j)}
                              >
                                <div
                                  className={`shrink-0 w-8 h-8 mt-0.5 rounded-full flex items-center justify-center font-black text-sm transition-all duration-200 ${
                                    isSelected
                                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-105"
                                      : "bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-blue-100 group-hover:text-blue-700"
                                  }`}
                                >
                                  {isSelected ? (
                                    <i className="ti ti-check text-base font-black"></i>
                                  ) : (
                                    String.fromCharCode(65 + j)
                                  )}
                                </div>
                                <div className="ml-3.5 flex-1 overflow-x-auto hide-scroll pt-0.5">
                                  {opt.startsWith("[smiles]") ? (
                                    <div style={{ pointerEvents: "none" }}>
                                      <SmilesViewer
                                        smilesCode={opt.replace("[smiles]", "").trim()}
                                        width={160}
                                        height={160}
                                      />
                                    </div>
                                  ) : (
                                    <StaticMath
                                      isBlock={false}
                                      html={opt}
                                      style={{
                                        fontSize: "16px",
                                        whiteSpace: "normal",
                                        wordBreak: "break-word",
                                        color: isSelected ? "#0f172a" : "#334155",
                                        fontWeight: isSelected ? "700" : "500",
                                      }}
                                    />
                                  )}
                                </div>
                                <div className="ml-2 shrink-0 self-center hidden sm:block">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                    isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 group-hover:border-blue-400"
                                  }`}>
                                    {isSelected && <i className="ti ti-check text-xs"></i>}
                                  </div>
                                </div>
                              </button>
                            );
                          })}

                        {/* MSQ Options (Multi-Correct) */}
                        {currentQuestion?.type === "msq" &&
                          currentQuestion.options.map((opt, j) => {
                            const isSelected =
                              Array.isArray(answers[curQ]?.val) &&
                              answers[curQ].val.includes(j);
                            return (
                              <button
                                key={j}
                                type="button"
                                className={`group relative flex items-start w-full text-left p-4 sm:p-4.5 rounded-2xl border-2 transition-all duration-200 ease-in-out cursor-pointer active:scale-[0.99] ${
                                  isSelected
                                    ? "bg-gradient-to-r from-emerald-50/90 to-teal-50/50 border-emerald-600 shadow-[0_4px_25px_rgba(16,185,129,0.14)] ring-4 ring-emerald-500/10"
                                    : "bg-white border-slate-200/90 hover:border-emerald-300 hover:bg-slate-50/90 shadow-2xs"
                                }`}
                                onClick={() => pickMSQ(curQ, j)}
                              >
                                <div
                                  className={`shrink-0 w-8 h-8 mt-0.5 rounded-xl flex items-center justify-center font-black text-sm transition-all duration-200 ${
                                    isSelected
                                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-105"
                                      : "bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-emerald-100 group-hover:text-emerald-700"
                                  }`}
                                >
                                  {isSelected ? (
                                    <i className="ti ti-check text-base font-black"></i>
                                  ) : (
                                    String.fromCharCode(65 + j)
                                  )}
                                </div>
                                <div className="ml-3.5 flex-1 overflow-x-auto hide-scroll pt-0.5">
                                  {opt.startsWith("[smiles]") ? (
                                    <div style={{ pointerEvents: "none" }}>
                                      <SmilesViewer
                                        smilesCode={opt.replace("[smiles]", "").trim()}
                                        width={160}
                                        height={160}
                                      />
                                    </div>
                                  ) : (
                                    <StaticMath
                                      isBlock={false}
                                      html={opt}
                                      style={{
                                        fontSize: "16px",
                                        whiteSpace: "normal",
                                        wordBreak: "break-word",
                                        color: isSelected ? "#0f172a" : "#334155",
                                        fontWeight: isSelected ? "700" : "500",
                                      }}
                                    />
                                  )}
                                </div>
                                <div className="ml-2 shrink-0 self-center hidden sm:block">
                                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${
                                    isSelected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 group-hover:border-emerald-400"
                                  }`}>
                                    {isSelected && <i className="ti ti-check text-xs"></i>}
                                  </div>
                                </div>
                              </button>
                            );
                          })}

                        {/* Numerical / Integer Type with VIRTUAL NTA KEYPAD */}
                        {currentQuestion?.type === "integer" && (
                          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl max-w-md mx-auto w-full text-white">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                <i className="ti ti-calculator text-amber-400 text-sm"></i> Numerical Input
                              </span>
                              <span className="text-[10px] font-extrabold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                                NTA Keypad
                              </span>
                            </div>

                            {/* Numerical Display Screen */}
                            <div className="bg-slate-950 border-2 border-slate-700/80 rounded-2xl p-4 mb-5 shadow-inner text-center">
                              <div className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-emerald-400 min-h-[44px] flex items-center justify-center">
                                {answers[curQ]?.val !== null && answers[curQ]?.val !== undefined && String(answers[curQ].val).trim() !== "" ? (
                                  <span>{String(answers[curQ].val)}</span>
                                ) : (
                                  <span className="text-slate-500 font-sans text-base sm:text-lg font-semibold">Use keypad or numpad below</span>
                                )}
                              </div>
                            </div>

                            {/* Virtual Keypad Grid */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-[300px] mx-auto">
                              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "0", "."].map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  className="py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white font-black text-xl rounded-xl border border-slate-700 shadow-xs transition-all active:scale-95 cursor-pointer"
                                  onClick={() => handleVirtualKey(k)}
                                >
                                  {k}
                                </button>
                              ))}
                              <button
                                type="button"
                                className="col-span-1 py-3 bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 text-rose-300 font-black text-xs rounded-xl border border-rose-500/40 shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                                onClick={() => handleVirtualKey("clear")}
                              >
                                <i className="ti ti-trash text-sm"></i> Clear
                              </button>
                              <button
                                type="button"
                                className="col-span-2 py-3 bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 text-amber-300 font-black text-xs rounded-xl border border-amber-500/40 shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                                onClick={() => handleVirtualKey("backspace")}
                              >
                                <i className="ti ti-backspace text-base"></i> Backspace
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Subjective / Descriptive Answer Box */}
                        {currentQuestion?.type === "subjective" && (
                          <div className="bg-purple-50/40 border-2 border-purple-200/90 rounded-3xl p-5 sm:p-6 flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-black text-purple-900 uppercase tracking-widest flex items-center gap-1.5">
                                <i className="ti ti-writing text-purple-600 text-sm"></i> Descriptive Response
                              </span>
                              <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                                {(answers[curQ]?.val || "").trim().split(/\s+/).filter(Boolean).length} Words &bull; {(answers[curQ]?.val || "").length} Chars
                              </span>
                            </div>
                            <textarea
                              value={answers[curQ]?.val || ""}
                              onChange={(e) => pickSubj(curQ, e.target.value)}
                              placeholder="Type your structured, step-by-step descriptive answer here..."
                              className="w-full flex-1 min-h-[220px] bg-white border-2 border-purple-200 text-[16px] font-medium text-slate-800 rounded-2xl p-4 sm:p-5 outline-none focus:border-purple-600 focus:ring-4 focus:ring-purple-500/10 transition-all resize-none shadow-inner leading-relaxed custom-scrollbar"
                            ></textarea>
                            <div className="mt-2.5 text-right text-[11px] font-bold text-slate-400">
                              Auto-saved to local secure vault in real-time
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BOTTOM NAVIGATION ACTIONS DOCK (Fixed & Ergonomic) */}
                <div className="q-area-footer bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 sm:p-4 z-40 shadow-[0_-4px_25px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center justify-between gap-2 sm:gap-4 max-w-full">
                    {/* Left: Clear & Mark for Review */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleMark(curQ)}
                        className={`px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 cursor-pointer border ${
                          answers[curQ]?.marked
                            ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/25"
                            : "bg-amber-50/90 hover:bg-amber-100 text-amber-900 border-amber-200/90"
                        }`}
                        title="Mark question for review (Shortcut: M)"
                      >
                        <i className={`ti ${answers[curQ]?.marked ? "ti-bookmark-filled" : "ti-bookmark"} text-sm sm:text-base`}></i>
                        <span>{answers[curQ]?.marked ? "Marked" : "Mark for Review"}</span>
                      </button>

                      {answers[curQ]?.val !== null &&
                        answers[curQ]?.val !== undefined &&
                        (!Array.isArray(answers[curQ].val) || answers[curQ].val.length > 0) && (
                          <button
                            type="button"
                            onClick={() => clearAns(curQ)}
                            className="px-2.5 sm:px-3.5 py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                            title="Clear Selection (Shortcut: C)"
                          >
                            <i className="ti ti-eraser text-sm sm:text-base"></i>
                            <span className="hidden sm:inline">Clear</span>
                          </button>
                        )}
                    </div>

                    {/* Center on Mobile: Palette Toggle Icon */}
                    <button
                      type="button"
                      className="lg:hidden w-11 h-11 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200 flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer shadow-xs"
                      onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
                      title="Open Question Palette"
                    >
                      <i className="ti ti-layout-grid text-xl"></i>
                    </button>

                    {/* Right: Prev & Next/Submit */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={curQ === 0}
                        onClick={() => changeQuestion(curQ - 1)}
                        className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                      >
                        <i className="ti ti-arrow-left text-sm"></i>
                        <span className="hidden sm:inline">Prev</span>
                      </button>

                      {curQ < (activeTest?.questions?.length || 1) - 1 ? (
                        <button
                          type="button"
                          onClick={() => changeQuestion(curQ + 1)}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-blue-600/25 active:scale-95 transition-all cursor-pointer"
                        >
                          <span>Save & Next</span>
                          <i className="ti ti-arrow-right text-sm"></i>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={confirmAndSubmit}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
                        >
                          <i className="ti ti-check text-sm"></i>
                          <span>Submit Test</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ======================================= */}
              {/* RIGHT PANE: DESKTOP EXECUTIVE QUESTION PALETTE */}
              {/* ======================================= */}
              <div className="desktop-palette">
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.05)] p-4 sm:p-5 flex flex-col h-full overflow-hidden">
                  {/* 1. Header with Stats & Progress */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <i className="ti ti-layout-grid text-blue-600 text-base"></i>
                        Question Palette
                      </h3>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        {answeredQs} of {maxAllowedQuestions} Attempted ({Math.round((answeredQs / Math.max(1, maxAllowedQuestions)) * 100)}%)
                      </p>
                    </div>
                    {/* Progress Pill */}
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 font-mono font-black text-xs shadow-2xs">
                      {Math.round((answeredQs / Math.max(1, maxAllowedQuestions)) * 100)}%
                    </div>
                  </div>

                  {/* 2. Interactive Quick Filter Chips */}
                  <div className="grid grid-cols-4 gap-1.5 py-3 shrink-0">
                    {[
                      { id: "all", label: "All", count: activeTest?.questions?.length || 0 },
                      { id: "answered", label: "Done", count: answeredQs },
                      { id: "marked", label: "Review", count: markedQs },
                      { id: "pending", label: "Left", count: Math.max(0, (activeTest?.questions?.length || 0) - answeredQs) },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPaletteFilter(tab.id)}
                        className={`px-1.5 py-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                          paletteFilter === tab.id
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                        }`}
                      >
                        <span className="leading-tight">{tab.label}</span>
                        <span className={`text-[10px] font-black ${paletteFilter === tab.id ? "text-blue-300" : "text-slate-400"}`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* 3. Sleek Compact Legends Row */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-2 bg-slate-50/70 rounded-xl border border-slate-100 mb-3 text-[10px] font-bold text-slate-600 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-md bg-emerald-600"></span> Done
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-md bg-rose-400"></span> Visited
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-md bg-purple-600"></span> Review
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-md bg-white border border-slate-300"></span> Left
                    </div>
                  </div>

                  {/* 4. Scrollable Sections & Question Grid */}
                  <div className="desktop-palette-scroll custom-scrollbar flex-1 overflow-y-auto pr-1">
                    {activeTest?.sections && activeTest.sections.length > 0 ? (
                      activeTest.sections.map((sec) => {
                        let secAttempted = 0;
                        let secTotal = 0;
                        const secQuestions = [];

                        activeTest.questions.forEach((qq, i) => {
                          if (
                            qq.section === sec ||
                            (!qq.section && sec === activeTest.sections[0])
                          ) {
                            secTotal++;
                            const a = answers[i];
                            const isDone = a?.val !== null && a?.val !== undefined && a?.val !== "" && (!Array.isArray(a?.val) || a.val.length > 0);
                            if (isDone) secAttempted++;
                            secQuestions.push({ qIndex: i, num: secTotal });
                          }
                        });

                        if (secTotal === 0) return null;

                        const secRule = activeTest?.sectionRules ? Number(activeTest.sectionRules[sec]) : 0;
                        const hasLimit = secRule > 0 && secRule < secTotal;
                        const targetLimit = hasLimit ? secRule : secTotal;
                        const isSecComplete = secAttempted >= targetLimit;

                        return (
                          <div key={sec} className="mb-5 last:mb-2">
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="ti ti-folder text-blue-600"></i> {sec}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                isSecComplete
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}>
                                {secAttempted}/{targetLimit} {hasLimit ? "(Max)" : "Done"}
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                              {secQuestions.map((q) => renderPalButton(q.qIndex, q.num, false))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="grid grid-cols-5 gap-2">
                        {activeTest?.questions?.map((_, i) => renderPalButton(i, i + 1, false))}
                      </div>
                    )}
                  </div>

                  {/* 5. Sticky Bottom Final Submit Button */}
                  <div className="pt-3 mt-2 border-t border-slate-100 shrink-0">
                    <button
                      type="button"
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 active:scale-[0.98] text-white font-black text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                      onClick={confirmAndSubmit}
                    >
                      <i className="ti ti-lock-check text-base"></i>
                      Submit Final Exam
                    </button>
                  </div>
                </div>
              </div>

              {/* ======================================= */}
              {/* MOBILE BOTTOM SHEET PALETTE (PREMIUM)   */}
              {/* ======================================= */}
              {isMobilePaletteOpen && (
                <div
                  className="hide-desktop fixed inset-0 z-[995] bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease]"
                  onClick={() => setIsMobilePaletteOpen(false)}
                ></div>
              )}

              <div
                className={`hide-desktop fixed bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.25)] flex flex-col transition-transform duration-300 ease-out ${
                  isMobilePaletteOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
                }`}
                style={{
                  maxHeight: "88vh",
                  height: isMobilePaletteOpen ? "auto" : "0",
                }}
              >
                {/* Pull Handle */}
                <div
                  className="w-full flex justify-center pt-3 pb-2 shrink-0 cursor-pointer"
                  onClick={() => setIsMobilePaletteOpen(false)}
                >
                  <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                </div>

                {/* Mobile Drawer Header */}
                <div className="px-5 pb-3 shrink-0 flex justify-between items-center border-b border-slate-100">
                  <div>
                    <div className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <span>Question Palette</span>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                        {answeredQs}/{maxAllowedQuestions}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                    onClick={() => setIsMobilePaletteOpen(false)}
                  >
                    <i className="ti ti-x text-base font-bold"></i>
                  </button>
                </div>

                {/* Mobile Filter Chips */}
                <div className="px-5 pt-3 pb-2 shrink-0">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "all", label: "All", count: activeTest?.questions?.length || 0 },
                      { id: "answered", label: "Done", count: answeredQs },
                      { id: "marked", label: "Review", count: markedQs },
                      { id: "pending", label: "Left", count: Math.max(0, (activeTest?.questions?.length || 0) - answeredQs) },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPaletteFilter(tab.id)}
                        className={`px-1.5 py-1.5 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                          paletteFilter === tab.id
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/70"
                        }`}
                      >
                        <span className="leading-tight">{tab.label}</span>
                        <span className={`text-[10px] font-black ${paletteFilter === tab.id ? "text-blue-300" : "text-slate-400"}`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Legends */}
                <div className="px-5 pb-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-600">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Done
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span> Visited
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span> Review
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-white border border-slate-300"></span> Left
                    </div>
                  </div>
                </div>

                {/* Mobile Scrollable Grid */}
                <div className="flex-1 overflow-y-auto px-5 py-2 custom-scrollbar">
                  {activeTest?.sections && activeTest.sections.length > 0 ? (
                    activeTest.sections.map((sec) => {
                      let secAttempted = 0;
                      let secTotal = 0;
                      const secQuestions = [];

                      activeTest.questions.forEach((qq, i) => {
                        if (
                          qq.section === sec ||
                          (!qq.section && sec === activeTest.sections[0])
                        ) {
                          secTotal++;
                          const a = answers[i];
                          const isDone = a?.val !== null && a?.val !== undefined && a?.val !== "" && (!Array.isArray(a?.val) || a.val.length > 0);
                          if (isDone) secAttempted++;
                          secQuestions.push({ qIndex: i, num: secTotal });
                        }
                      });

                      if (secTotal === 0) return null;

                      const secRule = activeTest?.sectionRules ? Number(activeTest.sectionRules[sec]) : 0;
                      const hasLimit = secRule > 0 && secRule < secTotal;
                      const targetLimit = hasLimit ? secRule : secTotal;
                      const isSecComplete = secAttempted >= targetLimit;

                      return (
                        <div key={sec} className="mb-5">
                          <div className="flex justify-between items-center mb-2.5">
                            <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <i className="ti ti-folder text-blue-600 text-sm"></i> {sec}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                              isSecComplete
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}>
                              {secAttempted}/{targetLimit} {hasLimit ? "(Max)" : "Done"}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-2.5">
                            {secQuestions.map((q) => renderPalButton(q.qIndex, q.num, true))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="grid grid-cols-5 gap-2.5">
                      {activeTest?.questions?.map((_, i) => renderPalButton(i, i + 1, true))}
                    </div>
                  )}
                </div>

                {/* Fixed Mobile Bottom Submit Button */}
                <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                  <button
                    type="button"
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-2xl font-black text-[15px] shadow-lg shadow-blue-600/25 flex justify-center items-center gap-2 transition-transform active:scale-95 cursor-pointer"
                    onClick={() => {
                      setIsMobilePaletteOpen(false);
                      confirmAndSubmit();
                    }}
                  >
                    <i className="ti ti-lock-check text-lg"></i> Submit Final Test
                  </button>
                </div>
              </div>
            </div>

            
            {/* FULL-SCREEN FIGURE LIGHTBOX MODAL */}
            {zoomFigure && (
              <div
                className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease]"
                onClick={() => setZoomFigure(null)}
              >
                <div
                  className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl p-6 shadow-2xl overflow-auto flex flex-col items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                    onClick={() => setZoomFigure(null)}
                  >
                    <i className="ti ti-x text-lg"></i>
                  </button>
                  <div className="mt-4 w-full flex justify-center">
                    {zoomFigure.type === "image" && (
                      <img src={zoomFigure.data} alt="Zoomed Diagram" className="max-w-full max-h-[75vh] object-contain rounded-xl" />
                    )}
                    {zoomFigure.type === "svg" && (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeSvg(zoomFigure.data) }} className="w-full flex justify-center overflow-auto" />
                    )}
                    {zoomFigure.type === "smiles" && (
                      <SmilesViewer smilesCode={zoomFigure.data} width={380} height={320} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VIRTUAL ROUGH PAD (Floating) */}
            {showRoughPad && (
              <div
                style={{
                  position: "fixed",
                  bottom: "90px",
                  right: "20px",
                  width: "300px",
                  height: "350px",
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  zIndex: 999,
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                }}
              >
                <div
                  style={{
                    background: "#185FA5",
                    color: "#fff",
                    padding: "10px 15px",
                    borderRadius: "12px 12px 0 0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <i className="ti ti-pencil"></i> Rough Pad
                  </span>
                  <i
                    className="ti ti-x"
                    style={{ cursor: "pointer", fontSize: "18px" }}
                    onClick={() => setShowRoughPad(false)}
                  ></i>
                </div>
                <textarea
                  value={roughText}
                  onChange={(e) => setRoughText(e.target.value)}
                  style={{
                    flex: 1,
                    border: "none",
                    padding: "12px",
                    outline: "none",
                    resize: "none",
                    fontSize: "14px",
                    lineHeight: 1.5,
                  }}
                  placeholder="Scribble your rough calculations here..."
                ></textarea>
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{
                position: "fixed",
                bottom: "90px",
                right: "20px",
                borderRadius: "50%",
                width: "54px",
                height: "54px",
                zIndex: 998,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 15px rgba(24,95,165,0.4)",
              }}
              onClick={() => setShowRoughPad(!showRoughPad)}
            >
              <i
                className="ti ti-pencil"
                style={{ fontSize: "24px", margin: 0 }}
              ></i>
            </button>

            {/* EXECUTIVE FINAL SUBMISSION BENTO MODAL */}
            {showConfirmModal && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-[fadeIn_0.2s_ease]">
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 max-w-lg w-full animate-[popIn_0.25s_cubic-bezier(0.16,1,0.3,1)] max-h-[90vh] flex flex-col">
                  {/* Modal Header */}
                  <div className="text-center mb-5 shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-3xl font-black mx-auto mb-3 shadow-lg shadow-blue-600/25 ring-4 ring-blue-50">
                      <i className="ti ti-lock-check"></i>
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                      Submit Exam Paper?
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                      Review your paper statistics before final encryption and lock.
                    </p>
                  </div>

                  {/* Bento Metric Summary (4 Cards) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5 shrink-0">
                    {/* Answered */}
                    <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-0.5 flex items-center justify-center gap-1">
                        <i className="ti ti-circle-check text-xs"></i> Attempted
                      </div>
                      <div className="text-2xl font-black text-emerald-800 font-mono">
                        {answeredQs}
                      </div>
                    </div>

                    {/* Marked */}
                    <div className="bg-purple-50/80 border border-purple-200/80 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-black uppercase tracking-wider text-purple-700 mb-0.5 flex items-center justify-center gap-1">
                        <i className="ti ti-bookmark text-xs"></i> Marked
                      </div>
                      <div className="text-2xl font-black text-purple-800 font-mono">
                        {markedQs}
                      </div>
                    </div>

                    {/* Left / Pending */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5 flex items-center justify-center gap-1">
                        <i className="ti ti-clock-pause text-xs"></i> Left
                      </div>
                      <div className="text-2xl font-black text-slate-700 font-mono">
                        {Math.max(0, (activeTest?.questions?.length || 0) - answeredQs)}
                      </div>
                    </div>

                    {/* Time Remaining */}
                    <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3 text-center">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 mb-0.5 flex items-center justify-center gap-1">
                        <i className="ti ti-hourglass-empty text-xs"></i> Time Left
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-blue-900 font-mono">
                        {formatTime(timeLeft)}
                      </div>
                    </div>
                  </div>

                  {/* Section-wise Breakdown Table (If sections exist) */}
                  {activeTest?.sections && activeTest.sections.length > 0 && (
                    <div className="flex-1 overflow-y-auto mb-5 border border-slate-200/80 rounded-2xl overflow-hidden custom-scrollbar max-h-44">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Section</th>
                            <th className="py-2.5 px-3 text-center">Attempted</th>
                            <th className="py-2.5 px-3 text-center">Allowed</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {activeTest.sections.map((sec) => {
                            let secAttempted = 0;
                            let secTotal = 0;
                            activeTest.questions.forEach((qq, idx) => {
                              if (qq.section === sec || (!qq.section && sec === activeTest.sections[0])) {
                                secTotal++;
                                const a = answers[idx];
                                if (a?.val !== null && a?.val !== undefined && a?.val !== "" && (!Array.isArray(a?.val) || a.val.length > 0)) {
                                  secAttempted++;
                                }
                              }
                            });
                            const secRule = activeTest?.sectionRules ? Number(activeTest.sectionRules[sec]) : 0;
                            const limit = secRule > 0 ? secRule : secTotal;
                            const isLimitHit = secAttempted >= limit;

                            return (
                              <tr key={sec} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-bold text-slate-800 flex items-center gap-1.5">
                                  <i className="ti ti-folder text-blue-500 text-xs"></i> {sec}
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                                  {secAttempted} / {secTotal}
                                </td>
                                <td className="py-2 px-3 text-center font-mono text-slate-500">
                                  {secRule > 0 ? `Max ${secRule}` : "All"}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    isLimitHit
                                      ? "bg-emerald-100 text-emerald-800"
                                      : secAttempted > 0
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {isLimitHit ? "Completed" : secAttempted > 0 ? "In Progress" : "Pending"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Warning Notice */}
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 mb-5 text-[11px] font-medium text-amber-900 flex items-start gap-2 shrink-0">
                    <i className="ti ti-alert-triangle text-amber-600 text-sm mt-0.5 shrink-0"></i>
                    <span>
                      <strong>Strict Security Notice:</strong> Once submitted, all answers are permanently locked and evaluated. You cannot re-enter this exam.
                    </span>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      className="flex-1 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      onClick={cancelSubmit}
                      disabled={isSubmitting}
                    >
                      <i className="ti ti-arrow-left"></i>
                      Review Paper
                    </button>

                    <button
                      type="button"
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                      onClick={() => handleFinalSubmit()}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <i className="ti ti-loader animate-spin text-base"></i>
                          <span>Encrypting...</span>
                        </>
                      ) : (
                        <>
                          <i className="ti ti-check text-base"></i>
                          <span>Confirm & Lock Paper</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      {/* PREMIUM ANTI-CHEAT OVERLAY */}
      {cheatWarning && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 99999,
            backdropFilter: "blur(12px)",
            background: "rgba(255, 255, 255, 0.4)",
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 text-center animate-[popIn_0.3s_ease] border-2 border-rose-500"
            style={{ maxWidth: "450px" }}
          >
            <i
              className="ti ti-shield-x"
              style={{
                fontSize: "64px",
                color: "#A32D2D",
                display: "block",
                marginBottom: "1rem",
                animation: "pulse 1s infinite",
              }}
            ></i>
            <h3
              style={{
                fontSize: "24px",
                color: "#A32D2D",
                marginBottom: "10px",
              }}
            >
              {cheatWarning.fatal ? "EXAM BLOCKED" : "SECURITY WARNING"}
            </h3>
            <p
              style={{
                fontSize: "16px",
                color: "#1e293b",
                marginBottom: "1rem",
                fontWeight: 500,
              }}
            >
              {cheatWarning.msg}
            </p>

            {!cheatWarning.fatal && (
              <>
                <div
                  style={{
                    display: "inline-block",
                    background: "#FCEBEB",
                    color: "#A32D2D",
                    padding: "6px 16px",
                    borderRadius: "20px",
                    fontSize: "13px",
                    fontWeight: 700,
                    marginBottom: "2rem",
                  }}
                >
                  Strike {cheatWarning.count} of 3
                </div>
                <button
                  className="btn btn-danger"
                  style={{
                    width: "100%",
                    padding: "14px",
                    justifyContent: "center",
                    fontSize: "16px",
                  }}
                  onClick={() => {
                    setCheatWarning(null);
                    if (
                      activeTest.fullScreenMode &&
                      document.documentElement.requestFullscreen
                    )
                      document.documentElement
                        .requestFullscreen()
                        .catch((e) => console.log(e));
                  }}
                >
                  I Understand, Resume Exam
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/*   PREMIUM SYSTEM MODALS */}
      {sysModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            zIndex: 999999,
            backdropFilter: "blur(8px)",
            background: "rgba(255, 255, 255, 0.2)",
          }}
        >
          <style>{`
                  @keyframes popIn { 0% { opacity: 0; transform: scale(0.9) translateY(15px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
              `}</style>

          <div
            className="modal-box"
            style={{
              maxWidth: "420px",
              width: "90%",
              textAlign: "center",
              padding: "0",
              border: "none",
              borderRadius: "24px",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
              animation: "popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            {/* Top Color Banner */}
            <div
              style={{
                height: "120px",
                background:
                  sysModal.type === "error"
                    ? "linear-gradient(135deg, #ef4444, #991b1b)"
                    : "linear-gradient(135deg, #10b981, #047857)",
                position: "relative",
              }}
            >
              {/* Floating Icon overlapping the banner */}
              <div
                style={{
                  position: "absolute",
                  bottom: "-35px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "70px",
                  height: "70px",
                  background: "#fff",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  style={{
                    width: "54px",
                    height: "54px",
                    borderRadius: "50%",
                    background:
                      sysModal.type === "error" ? "#fef2f2" : "#ecfdf5",
                    color: sysModal.type === "error" ? "#ef4444" : "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "28px",
                  }}
                >
                  <i
                    className={`ti ${sysModal.type === "error" ? "ti-shield-x" : "ti-shield-check"}`}
                  ></i>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: "45px 30px 30px 30px", background: "#fff" }}>
              <h3
                style={{
                  fontSize: "22px",
                  marginBottom: "12px",
                  color: "#0f172a",
                  fontWeight: 800,
                }}
              >
                {sysModal.type === "error" ? "Security Alert" : "Success"}
              </h3>
              <p
                style={{
                  color: "#475569",
                  marginBottom: "2rem",
                  fontWeight: 500,
                  lineHeight: 1.6,
                  fontSize: "15px",
                }}
              >
                {sysModal.msg}
              </p>

              <button
                className="btn"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "14px",
                  borderRadius: "12px",
                  background: sysModal.type === "error" ? "#ef4444" : "#185FA5",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "15px",
                  boxShadow: `0 4px 15px ${sysModal.type === "error" ? "rgba(239,68,68,0.3)" : "rgba(24,95,165,0.3)"}`,
                  transition: "transform 0.2s",
                  letterSpacing: "0.5px",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.transform = "translateY(-2px)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.transform = "translateY(0)")
                }
                onClick={() => {
                  const action = sysModal.action;
                  setSysModal(null);
                  if (action) action();
                }}
              >
                {sysModal.type === "error" ? "Acknowledge" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

//   THE VERCEL BUILD FIX: Suspense Boundary Wrapper
export default function StudentPortal() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="spinner"
            style={{ width: "40px", height: "40px", borderWidth: "3px" }}
          ></div>
        </div>
      }
    >
      <StudentPortalContent />
    </Suspense>
  );
}
