// src/app/student/page.js
'use client';
import { useState, useEffect, useRef, memo, Suspense } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, push, set, get, onDisconnect, remove } from 'firebase/database'; 
import SmilesViewer from '../../components/SmilesViewer';

// THE MASTER FIX: MathJax React Re-render Protector
const StaticMath = memo(({ html, isBlock, style, className }) => {
  if (isBlock) return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
});

function StudentPortalContent() { 
  const { currentUser, loading: authLoading } = useAuth();
  const { fetchSingleTest } = useData(); 
  const router = useRouter();
  const searchParams = useSearchParams(); // 🔥 NAYA: URL Params Reader

  const [isMounted, setIsMounted] = useState(false);
  const [isFetchingTest, setIsFetchingTest] = useState(false);
  const autoJoinTriggered = useRef(false); // 🔥 Prevent infinite loop

  // --- SCREEN STATES ---
  const [step, setStep] = useState('join');
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [showConfirmModal, setShowConfirmModal] = useState(false); 
  const [draftToResume, setDraftToResume] = useState(null); 
  
  // --- FORM STATES ---
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [code, setCode] = useState('');
  const [activeTest, setActiveTest] = useState(null);
  const [isDirectJoin, setIsDirectJoin] = useState(false); 

  // --- EXAM ENGINE STATES ---
  const [curQ, setCurQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [showRoughPad, setShowRoughPad] = useState(false);
  const [roughText, setRoughText] = useState('');
  
  // 🔥 NAYA: Figure Loading State (For TikZ & Images)
  const [imgLoaded, setImgLoaded] = useState(false);

  // --- CUSTOM POPUPS & ALERTS ---
  const [joinError, setJoinError] = useState(''); 
  const [cheatWarning, setCheatWarning] = useState(null); 
  const [sysModal, setSysModal] = useState(null);
  const [qTime, setQTime] = useState({});
  
  // --- REFS ---
  const timerRef = useRef(null);
  const endTimeRef = useRef(null);
  const warningsRef = useRef(0);
  const cheatLogsRef = useRef([]);
  const lastWarningTimeRef = useRef(0);
  const isActionLockedRef = useRef(false);

  useEffect(() => { setIsMounted(true); }, []);

  // 🔥 Profile Details Auto-Fill
  useEffect(() => {
    if (currentUser) {
        if (currentUser.displayName) setName(currentUser.displayName);
        if (currentUser.rollNo || currentUser.examinerId) {
            setRoll(currentUser.rollNo || currentUser.examinerId || '');
        }
    }
  }, [currentUser]);

  // 🔥 THE AUTO-JOIN SENSOR (SMART TOKEN DECODER)
  useEffect(() => {
      if (isMounted && !authLoading && searchParams) {
          const secretToken = searchParams.get('token');
          
          if (secretToken && !autoJoinTriggered.current) {
              try {
                  // Token ko decode karo (e.g., "XYZ123-EXAMITOP-AUTO")
                  const decoded = atob(secretToken);
                  
                  if (decoded.includes('-EXAMITOP-AUTO')) {
                      const urlCode = decoded.split('-')[0]; // Asli code bahar nikalo
                      autoJoinTriggered.current = true; 
                      setIsDirectJoin(true); // ENGINE KO BATA DIYA KI YE DIRECT AAYA HAI 
                      
                      const immediateName = currentUser?.displayName || name;
                      const immediateRoll = currentUser?.rollNo || currentUser?.examinerId || roll;
                      
                      setCode(urlCode);
                      
                      // URL se token hata do taaki refresh pe trigger na ho
                      window.history.replaceState({}, document.title, "/student");
                      
                      // Trigger Main Join Function (with isAutoJoin = true)
                      handleJoinTest(urlCode, immediateName, immediateRoll, true);
                  }
              } catch (e) {
                  console.error("Invalid Security Token");
              }
          }
      }
  }, [isMounted, authLoading, searchParams, currentUser]);

  // Reset image loader when question changes
  useEffect(() => {
    setImgLoaded(false);
  }, [curQ]);

 // 1. MathJax Auto-Renderer
  useEffect(() => {
    let isCancelled = false;
    const renderMath = async () => {
      if (step === 'exam' && typeof window !== 'undefined' && window.MathJax) {
        try {
          window.MathJax.typesetClear();
          await window.MathJax.typesetPromise();
        } catch (err) {
          console.log('MathJax Error:', err);
        } finally {
            if (!isCancelled) {
                let targetAreas = document.querySelectorAll('.q-area-content');
                targetAreas.forEach(el => {
                    el.style.transition = 'opacity 0.25s ease-in';
                    el.style.opacity = '1'; 
                });
            }
        }
      }
    };
        // Ab React pehle aaram se raw text daalega, fir MathJax aakar usko perfectly format karega!
    const timer = setTimeout(renderMath, 150); 
    return () => {
        isCancelled = true;
        clearTimeout(timer);
    };
  }, [curQ, step]);

  // Hide Global Header & Sub-Navbar during Instructions and Exam
  useEffect(() => {
    const header = document.querySelector('.app-header');
    const subNav = document.getElementById('dynamic-nav-wrapper'); // Sub-navbar (pills) ko bhi target kiya

    if (step === 'exam' || step === 'instructions') {
        if (header) header.style.display = 'none'; 
        if (subNav) subNav.style.display = 'none';
    } else {
        if (header) header.style.display = ''; 
        if (subNav) subNav.style.display = '';
    }
    // Cleanup: Jab form submit karke page se bahar jaye (Results par), toh sab normal ho jaye
    return () => { 
        if (header) header.style.display = ''; 
        if (subNav) subNav.style.display = '';
    };
  }, [step]);

  // NAYA: Keyboard Navigation Engine (Arrows & 1,2,3,4)
  useEffect(() => {
    if (step !== 'exam' || !activeTest) return;
    
    const handleKeyDown = (e) => {
        // Prevent triggering if typing in Roughpad or Inputs
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (curQ < activeTest.questions.length - 1) changeQuestion(curQ + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (curQ > 0) changeQuestion(curQ - 1);
        } else if (['1', '2', '3', '4'].includes(e.key)) {
            e.preventDefault();
            const qType = activeTest.questions[curQ]?.type;
            const optIdx = parseInt(e.key) - 1;
            
            if (qType === 'mcq' && activeTest.questions[curQ]?.options[optIdx]) {
                pickMCQ(curQ, optIdx);
            } else if (qType === 'msq' && activeTest.questions[curQ]?.options[optIdx]) {
                pickMSQ(curQ, optIdx);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, curQ, activeTest, answers]); 

  // 2. AUTO-SAVE DRAFT
  useEffect(() => {
    if (step === 'exam' && activeTest && answers.length > 0) {
        const safeName = name.trim() || 'guest';
        const safeRoll = roll.trim() || 'noroll';
        const draftData = {
            answers, curQ, endTime: endTimeRef.current,
            warnings: warningsRef.current, cheatLogs: cheatLogsRef.current
        };
        
        const jsonString = JSON.stringify(draftData);
        const reversedString = jsonString.split('').reverse().join('');
        const secretPayload = btoa(encodeURIComponent(reversedString));
        
        localStorage.setItem(`exam_draft_${activeTest.id}_${safeName}_${safeRoll}`, secretPayload);
    }
  }, [answers, curQ, step, activeTest, name, roll]);

  // NAYA: REAL-TIME LIVE PRESENCE ENGINE
  useEffect(() => {
    // Sirf tab active hoga jab student exam de raha ho
    if (step !== 'exam' || !activeTest || !navigator.onLine) return;

    // Unique ID: Agar user login hai toh UID, warna ek random ID
    const sessionUid = currentUser?.uid || `guest_${Math.random().toString(36).substr(2, 9)}`;
    const presenceRef = ref(database, `live_sessions/${activeTest.id}/${sessionUid}`);

    // Student ko "LIVE" mark karo
    set(presenceRef, {
        name: name || 'Student',
        roll: roll || 'N/A',
        joinedAt: new Date().toLocaleTimeString('en-IN')
    });
    //Agar tab close ho jaye ya net cut jaye, toh Firebase khud isko delete kar dega
    onDisconnect(presenceRef).remove();
    // CLEANUP: Jab exam submit ho jaye ya piche back kare
    return () => {
        remove(presenceRef);
    };
  }, [step, activeTest, currentUser, name, roll]);

  // Silent Background Timer for Active Question
  useEffect(() => {
      let qTimer;
      // Timer tabhi chalega jab exam chal raha ho
      if (step === 'exam' && activeTest) {
          qTimer = setInterval(() => {
              setQTime(prev => ({
                  ...prev,
                  [curQ]: (prev[curQ] || 0) + 1 // Har second active question ka time +1 hoga
              }));
          }, 1000);
      }
      return () => clearInterval(qTimer);
  }, [step, curQ, activeTest]);

  // 3. AUTO-SYNC OFFLINE SUBMISSIONS
  useEffect(() => {
    const handleOnline = async () => {
        let pending = JSON.parse(localStorage.getItem('examitop_pending_subs') || '[]');
        if (pending.length > 0) {
            for (let p of pending) {
                try {
                    const snapshot = await get(ref(database, 'tests'));
                    const allTests = snapshot.val() || [];
                    const tIndex = allTests.findIndex(x => x && x.id === p.testId);
                    
                    if (tIndex > -1) await set(push(ref(database, `tests/${tIndex}/submissions`)), p.sub);
                } catch(e) {}
            }
            localStorage.removeItem('examitop_pending_subs');
            setSysModal({ type: 'success', msg: "Internet restored! Pending offline submissions have been synced safely." });
        }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 4. ENTERPRISE ANTI-CHEAT ENGINE
  useEffect(() => {
    if (step !== 'exam' || !activeTest?.antiCheat) return;

    const triggerCheat = (reason) => {
        if (isActionLockedRef.current) return;
        const now = Date.now();
        if (now - lastWarningTimeRef.current < 3000) return; 
        
        lastWarningTimeRef.current = now;
        warningsRef.current += 1;
        cheatLogsRef.current.push({ time: new Date().toLocaleTimeString('en-IN'), reason });

        if (warningsRef.current >= 3) {
            setCheatWarning({ fatal: true, msg: "SECURITY ALERT: Exam Blocked! Rules violated 3 times. Auto-submitting paper." });
            setTimeout(() => handleFinalSubmit(), 3000); 
        } else {
            setCheatWarning({ fatal: false, count: warningsRef.current, msg: `${reason} detected! Please do not leave the exam screen.` });
        }
    };

    const handleWindowCheat = (e) => {
        if (e.type === 'visibilitychange' && document.hidden) triggerCheat("Tab switching / App change");
        else if (e.type === 'blur') triggerCheat("Opened another window (Focus lost)");
        else if (e.type === 'fullscreenchange' && !document.fullscreenElement && activeTest.fullScreenMode) triggerCheat("Exited full-screen mode");
    };

    const handleKeyCheat = (e) => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase())) || (e.ctrlKey && ['P','U','S'].includes(e.key.toUpperCase()))) {
            e.preventDefault();
            triggerCheat("Developer Tools / Print Shortcuts are strictly prohibited.");
        }
    };

    const blockCopyPaste = (e) => { e.preventDefault(); };

    document.addEventListener("visibilitychange", handleWindowCheat);
    window.addEventListener("blur", handleWindowCheat);
    document.addEventListener("keydown", handleKeyCheat);
    if (activeTest.fullScreenMode) document.addEventListener("fullscreenchange", handleWindowCheat);
    
    document.addEventListener('copy', blockCopyPaste);
    document.addEventListener('cut', blockCopyPaste);
    document.addEventListener('paste', blockCopyPaste);
    document.addEventListener('contextmenu', blockCopyPaste);
    document.body.style.userSelect = 'none';

    return () => {
        document.removeEventListener("visibilitychange", handleWindowCheat);
        window.removeEventListener("blur", handleWindowCheat);
        document.removeEventListener("keydown", handleKeyCheat);
        if (activeTest.fullScreenMode) document.removeEventListener("fullscreenchange", handleWindowCheat);
        document.removeEventListener('copy', blockCopyPaste);
        document.removeEventListener('cut', blockCopyPaste);
        document.removeEventListener('paste', blockCopyPaste);
        document.removeEventListener('contextmenu', blockCopyPaste);
        document.body.style.userSelect = 'auto';
    };
  }, [step, activeTest]);

  // 5. THE ULTIMATE EXAM TRAP
  useEffect(() => {
    if (step !== 'exam') return;

    window.history.pushState(null, "", window.location.href);
    const handlePopState = (e) => {
        window.history.pushState(null, "", window.location.href); 
        setSysModal({ type: 'error', msg: "SECURITY LOCK: You cannot go back during an active exam. You must submit the test to exit." });
    };
    window.addEventListener('popstate', handlePopState);

    let touchStartY = 0;
    const handleTouchStart = (e) => { touchStartY = e.touches[0].clientY; };
    const handleTouchMove = (e) => {
        const touchY = e.touches[0].clientY;
        const touchDiff = touchY - touchStartY;
        if (touchDiff > 0 && window.scrollY === 0) {
            if (e.cancelable) e.preventDefault();
        }
    };
    
    const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
        window.removeEventListener('popstate', handlePopState);
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [step]);


 /// --- JOIN LOGIC ---
  // 🔥 NAYA: isAutoJoin flag add kiya gaya hai
  const handleJoinTest = async (overrideCode = null, overrideName = null, overrideRoll = null, isAutoJoin = false) => {
    
    // Resolve Variables
    const finalCode = (typeof overrideCode === 'string' ? overrideCode : code) || '';
    const finalName = (typeof overrideName === 'string' ? overrideName : name) || '';
    const finalRoll = (typeof overrideRoll === 'string' ? overrideRoll : roll) || '';

    setJoinError(''); 
    if (!finalName.trim()) { setJoinError('Please enter your full name.'); return; }
    if (!finalCode.trim()) { setJoinError('Please enter the 6-digit test code.'); return; }

    setIsFetchingTest(true); 
    
    try {
        const codeUpper = finalCode.trim().toUpperCase();
        let t = null;

        const localTests = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
        t = localTests.find(x => x.code === codeUpper);

        if (!t) {
            t = await fetchSingleTest(codeUpper);
        }

        if (!t) { 
            if (isAutoJoin) setSysModal({ type: 'error', msg: 'Invalid Test Link.' });
            else setJoinError('Invalid Test Code. Check and try again.'); 
            setIsFetchingTest(false); return; 
        }
        if (t.isActive === false) { 
            if (isAutoJoin) setSysModal({ type: 'error', msg: 'Intake Closed: The examiner is no longer accepting submissions.' });
            else setJoinError("Intake Closed: The examiner is no longer accepting submissions."); 
            setIsFetchingTest(false); return; 
        }

        const safeName = finalName.trim(); 
        const safeRoll = finalRoll.trim().toLowerCase(); 
        const safeSubmissions = Array.isArray(t.submissions) ? t.submissions : Object.values(t.submissions || {});
        
        let existingSub = safeSubmissions.find(s => s && s.name && s.name.trim().toLowerCase() === safeName.toLowerCase() && (s.roll || '').trim().toLowerCase() === safeRoll);       
        
        // 🔥 MAGIC: Agar pehle test de chuka hai aur direct link se aaya hai!
        if (existingSub) { 
            if (isAutoJoin) {
                setStep('already_completed'); // 🔥 FIX: Ye line form ko background se uda degi
                setSysModal({
                    type: 'success',
                    msg: 'You have already completed this assessment! Redirecting you to the Results Vault...',
                    action: () => { router.push('/student-results'); }
                });
            } else {
                setJoinError("Submission Received: You have already submitted this test."); 
            }
            setIsFetchingTest(false); 
            return; 
        }

        const draftStr = localStorage.getItem(`exam_draft_${t.id}_${safeName}_${safeRoll || 'noroll'}`);
        if (draftStr) {
            try {
                const decodedString = decodeURIComponent(atob(draftStr));
                const originalJson = decodedString.split('').reverse().join('');
                const draft = JSON.parse(originalJson);

                if (draft.endTime > Date.now()) {
                     setDraftToResume(draft); 
                } else {
                     localStorage.removeItem(`exam_draft_${t.id}_${safeName}_${safeRoll || 'noroll'}`);
                }
            } catch (e) {
                console.error("Tampered or corrupt draft data found. Clearing draft.");
                localStorage.removeItem(`exam_draft_${t.id}_${safeName}_${safeRoll || 'noroll'}`);
            }
        }

        setActiveTest(t);
        setStep('instructions');
    } catch (error) {
        console.error("Join test error:", error);
        if (isAutoJoin) setSysModal({ type: 'error', msg: 'Network Error. Please try again later.' });
        else setJoinError("Network Error. Please try again.");
    } finally {
        setIsFetchingTest(false);
    }
  };

  const applySmartShuffle = (test) => {
    if (!test.shuffleOpts) return test;
    
    let clonedTest = JSON.parse(JSON.stringify(test)); 
    
    clonedTest.questions = clonedTest.questions.map(q => {
        if ((q.type === 'mcq' || q.type === 'msq') && q.options) {
            
            const hasFixedOption = q.options.some(opt => {
                let lowerOpt = opt.toLowerCase().replace(/<[^>]*>?/gm, '').trim();
                return lowerOpt.includes('all of') || 
                       lowerOpt.includes('none of') || 
                       lowerOpt.includes('both ') || 
                       lowerOpt.includes('only ');
            });

            if (hasFixedOption) return q; 

            let standardOpts = q.options.map((opt, idx) => ({ text: opt, originalIdx: idx }));

            for (let i = standardOpts.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [standardOpts[i], standardOpts[j]] = [standardOpts[j], standardOpts[i]];
            }

            q.options = standardOpts.map(o => o.text);
            
            let newCorrectArray = [];
            if (q.correct) {
                q.correct.forEach(cIdx => {
                    let newIdx = standardOpts.findIndex(o => o.originalIdx === cIdx);
                    if(newIdx !== -1) newCorrectArray.push(newIdx);
                });
            }
            q.correct = newCorrectArray;
        }
        return q;
    });
    return clonedTest;
  };

  // --- START EXAM LOGIC ---
  const startExam = () => {
    if (!activeTest) return;

    if (activeTest.fullScreenMode) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(err => console.log("Fullscreen blocked:", err));
    }

    if (draftToResume) {
        setAnswers(draftToResume.answers);
        setCurQ(draftToResume.curQ);
        endTimeRef.current = draftToResume.endTime;
        warningsRef.current = draftToResume.warnings || 0;
        cheatLogsRef.current = draftToResume.cheatLogs || [];
    } else {
        const shuffledTest = applySmartShuffle(activeTest);
        setActiveTest(shuffledTest); 

        const initialAnswers = shuffledTest.questions.map(() => ({ val: null, marked: false }));
        setAnswers(initialAnswers);
        warningsRef.current = 0;
        cheatLogsRef.current = [];
        endTimeRef.current = Date.now() + (shuffledTest.duration || 60) * 60 * 1000;
    }
    
    isActionLockedRef.current = false;
    
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        handleFinalSubmit(); 
      }
    }, 1000);

    setStep('exam');
  };

  const changeQuestion = (newIdx) => {
    if (newIdx === curQ) return;
    let targetAreas = document.querySelectorAll('.q-area-content');
    targetAreas.forEach(el => { el.style.transition = 'none'; el.style.opacity = '0'; });
    setTimeout(() => { setCurQ(newIdx); setIsMobilePaletteOpen(false); }, 15);
  };

  // --- QUESTION SELECTION ---
  const pickMCQ = (qIndex, optIndex) => { let newAns = [...answers]; newAns[qIndex].val = optIndex; setAnswers(newAns); };
  const pickMSQ = (qIndex, optIndex) => { let newAns = [...answers]; let currentVal = Array.isArray(newAns[qIndex].val) ? [...newAns[qIndex].val] : []; if (currentVal.includes(optIndex)) { currentVal = currentVal.filter(v => v !== optIndex); } else { currentVal.push(optIndex); } newAns[qIndex].val = currentVal; setAnswers(newAns); };
  const pickInt = (qIndex, val) => { let newAns = [...answers]; newAns[qIndex].val = val === '' ? null : Number(val); setAnswers(newAns); };
  const pickSubj = (qIndex, val) => { let newAns = [...answers]; newAns[qIndex].val = val.trim() === '' ? null : val; setAnswers(newAns); };
  const toggleMark = (qIndex) => { let newAns = [...answers]; newAns[qIndex].marked = !newAns[qIndex].marked; setAnswers(newAns); };
  const clearAns = (qIndex) => { let newAns = [...answers]; newAns[qIndex].val = null; setAnswers(newAns); };

  const formatTime = (seconds) => { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return (h > 0 ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); };
  const getLabel = (type) => ({ mcq: 'Single Correct', msq: 'Multi Correct', integer: 'Integer Type', subjective: 'Subjective' }[type] || type);
  const getBadge = (type) => ({ mcq: 'b-blue', msq: 'b-green', integer: 'b-amber', subjective: 'b-purple' }[type] || 'b-gray');

  // --- SUBMIT CONFIRMATION UI ---
  const confirmAndSubmit = () => { isActionLockedRef.current = true; setShowConfirmModal(true); };
  const cancelSubmit = () => { setShowConfirmModal(false); setTimeout(() => { isActionLockedRef.current = false; }, 500); };

  // --- SECURE SUBMISSION LOGIC ---
  const handleFinalSubmit = async () => {
    if (!activeTest || step !== 'exam') return;
    
    clearInterval(timerRef.current);
    isActionLockedRef.current = true; 
    setShowConfirmModal(false); 
    setIsSubmitting(true); 

   let score = 0, correct = 0, wrong = 0, skipped = 0;
   const neg = Math.abs(Number(activeTest.negMarking || 0));

    const details = activeTest.questions.map((q, i) => {
      let ans = answers[i] || {};
      let val = ans.val;
      let status = 'skipped';
      let earned = 0;

      let isSkipped = val === null || val === undefined || val === '' || val === -1 || (Array.isArray(val) && val.length === 0);

      if (isSkipped) {
        skipped++;
        status = 'skipped';
      } else if (q.type === 'mcq') {
        if (!q.correct || q.correct.length === 0) { status = 'submitted'; skipped++; } 
        else if (val === q.correct[0]) { correct++; earned = q.marks; score += q.marks; status = 'correct'; } 
        else { wrong++; earned = -neg; score -= neg; status = 'wrong'; }
      } else if (q.type === 'msq') {
        let userSel = Array.isArray(val) ? val : [];
        let corrSel = q.correct || [];
        if (corrSel.length === 0) { status = 'submitted'; skipped++; } 
        else {
            let hasWrongOption = userSel.some(x => !corrSel.includes(x));
            let correctlySelected = userSel.filter(x => corrSel.includes(x)).length;
            if (hasWrongOption) { wrong++; earned = -neg; score -= neg; status = 'wrong'; }
            else if (correctlySelected === corrSel.length) { correct++; earned = q.marks; score += q.marks; status = 'correct'; }
            else if (correctlySelected > 0) {
              let partialMarks = (q.marks / corrSel.length) * correctlySelected;
              earned = Math.round(partialMarks * 100) / 100;
              score += earned; correct++; status = 'partial';
            } else { wrong++; earned = -neg; score -= neg; status = 'wrong'; }
        }
      } else if (q.type === 'integer') {
        if (q.correctInt === null || q.correctInt === undefined || q.correctInt === '') { status = 'submitted'; skipped++; } 
        else if (val === q.correctInt || String(val) === String(q.correctInt)) { correct++; earned = q.marks; score += q.marks; status = 'correct'; } 
        else { wrong++; earned = -neg; score -= neg; status = 'wrong'; }
      } else { skipped++; status = 'submitted'; }

      return { q, ans, status, earned };
    });

    const totalSecondsGiven = activeTest.duration ? activeTest.duration * 60 : 0;
    const exactRemaining = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
    const secondsSpent = totalSecondsGiven > 0 ? (totalSecondsGiven - exactRemaining) : 0;
    
    const timeTakenStr = formatTime(secondsSpent);

   const finalSub = {
      uid: currentUser ? currentUser.uid : 'anonymous',
      email: currentUser ? currentUser.email : '',
      name: name,
      roll: roll,
      score: Number(score.toFixed(2)), correct, wrong, skipped, details,
      time: new Date().toLocaleString('en-IN'),
      timestamp: Date.now(), 
      totalMarks: activeTest.totalMarks,
      cheatLogs: cheatLogsRef.current,
      timeTaken: timeTakenStr,
      timeSpentPerQuestion: qTime
    };

    localStorage.removeItem(`exam_draft_${activeTest.id}_${name.trim() || 'guest'}_${roll.trim().toLowerCase() || 'noroll'}`);

    // OFFLINE VAULT SYNC LOGIC
    if (!navigator.onLine && !activeTest.isLocal) {
        let pending = JSON.parse(localStorage.getItem('examitop_pending_subs') || '[]');
        pending.push({ testId: activeTest.id, sub: finalSub });
        localStorage.setItem('examitop_pending_subs', JSON.stringify(pending));
        
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(e => {});
        setStep('offline_saved');
        setIsSubmitting(false);
        return;
    }

    try {
      if (activeTest.isLocal) {
          let localTests = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
          const tIndex = localTests.findIndex(x => x.id === activeTest.id);
          if (tIndex > -1) {
              if (!localTests[tIndex].submissions) localTests[tIndex].submissions = [];
              localTests[tIndex].submissions.push(finalSub);
              localStorage.setItem('examitop_offline_tests', JSON.stringify(localTests));
          }
      } else {
          const snapshot = await get(ref(database, 'tests'));
          const allTests = snapshot.val() || [];
          const tIndex = allTests.findIndex(x => x && x.id === activeTest.id);
          
          if (tIndex > -1) {
              const subsRef = ref(database, `tests/${tIndex}/submissions`);
              await set(push(subsRef), finalSub);  
          }
      }

      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(e => {});

      if (activeTest.resultVis === 'manual') {
          setSysModal({
              type: 'success',
              msg: 'Test Submitted Successfully! Your answers have been saved securely. Examiner will declare results later.',
              action: () => {
                  try { router.push('/student-dashboard'); } 
                  catch (e) { window.location.href = '/student-dashboard'; }
              }
          });
      } else {
          setTimeout(() => {
              try { router.push('/student-results'); } 
              catch (e) { window.location.href = '/student-results'; }
          }, 1500);
      }

    } catch (error) {
        console.error("Transmission Error:", error);
        setIsSubmitting(false);
        setSysModal({
            type: 'error',
            msg: 'Failed to securely submit the exam over internet. Activating Offline Vault...',
            action: () => {
                let pending = JSON.parse(localStorage.getItem('examitop_pending_subs') || '[]');
                pending.push({ testId: activeTest.id, sub: finalSub });
                localStorage.setItem('examitop_pending_subs', JSON.stringify(pending));
                setStep('offline_saved');
            }
        });
    }
  };


  if (!isMounted || authLoading || isSubmitting || isFetchingTest) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center z-[99999]">
        <style>{`
            @keyframes spinDash { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.4); } 70% { box-shadow: 0 0 0 20px rgba(37,99,235,0); } 100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); } }
            @keyframes lockPulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
            @keyframes floatUp { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        `}</style>

        {isSubmitting ? (
            <div className="text-center animate-[fadeIn_0.4s_ease] flex flex-col items-center">
                <div className="relative w-[120px] h-[120px] mb-8">
                    <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-emerald-500/40 animate-[spinDash_6s_linear_infinite]"></div>
                    <div className="absolute inset-[10px] rounded-full border-4 border-transparent border-t-emerald-500 border-b-emerald-500 animate-[spinDash_2s_ease-in-out_infinite_reverse]"></div>
                    <div className="absolute inset-[20px] bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-inner animate-[lockPulse_2s_infinite]">
                        <i className="ti ti-lock-check text-4xl text-white"></i>
                    </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-3 tracking-tight flex items-center gap-3">
                    Encrypting Vault <span className="w-5 h-5 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></span>
                </h2>
                <div className="bg-emerald-50 text-emerald-600 px-5 py-2 rounded-full text-xs font-extrabold uppercase tracking-widest border border-emerald-200 shadow-sm animate-[floatUp_0.5s_ease_forwards]">
                    Establishing Secure Transfer...
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
                    {isFetchingTest ? 'Decrypting Exam Vault...' : 'Initializing Secure Portal...'}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Please wait</p>
            </div>
        )}
      </div>
    );
  }

  if (step === 'offline_saved') {
      return (
          <div style={{ textAlign: 'center', marginTop: '5rem', padding: '2rem', maxWidth: '500px', margin: '5rem auto' }}>
             <i className="ti ti-wifi-off" style={{ fontSize: '80px', color: '#854F0B', marginBottom: '1rem', animation: 'pulse 2s infinite' }}></i>
             <h2 style={{ color: '#0f172a', marginBottom: '10px' }}>Connection Lost, But You're Safe!</h2>
             <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
                 Your answers have been securely saved to this device. Please do not clear your browser cache. Connect to the internet and return to this platform, and the system will automatically sync your submission.
             </p>
             <button className="btn btn-primary" onClick={() => router.push('/')}>Return Home</button>
          </div>
      );
  }

  const answeredQs = answers.filter(a => a?.val !== null && (!Array.isArray(a?.val) || a?.val.length > 0)).length;
  const markedQs = answers.filter(a => a?.marked).length;
  const remainingQs = activeTest?.questions ? activeTest.questions.length - answeredQs : 0;
  const currentQuestion = activeTest?.questions?.[curQ];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 animate-[fadeIn_0.3s_ease]">
      
      {/* STEP 1: PREMIUM JOIN FORM */}
      {step === 'join' && (
        <div className="max-w-[420px] mx-auto mt-10 sm:mt-16 animate-[fadeIn_0.4s_ease]">
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shadow-blue-600/20 mx-auto mb-4">E</div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-1.5">Join a Test</h1>
              <p className="text-sm font-medium text-slate-500">Enter your details and the 6-digit secure code.</p>
            </div>
            
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 block">Full Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Kumar" disabled={!!currentUser} className={`w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all ${currentUser ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`} />
                </div>
                <div>
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 block">Roll Number / ID</label>
                    <input type="text" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 2024CS001" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white" />
                </div>
                <div>
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-1.5 block">Secure Test Code</label>
                    <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXXX" maxLength="6" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xl font-black text-center text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all bg-slate-50 uppercase tracking-[0.3em] placeholder:tracking-normal" />
                </div>
            </div>

            {joinError && (
                <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl text-[13px] font-bold mb-6 border border-rose-100 flex items-center gap-2 shadow-sm animate-[fadeIn_0.2s_ease]">
                    <i className="ti ti-alert-triangle text-lg"></i> {joinError}
                </div>
            )}
            
            <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[15px] rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2" onClick={handleJoinTest}>
                Start Assessment <i className="ti ti-arrow-right text-lg"></i>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PROFESSIONAL INSTRUCTIONS */}
      {step === 'instructions' && activeTest && (
        <div className="max-w-2xl mx-auto mt-6 sm:mt-10 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 sm:p-8 animate-[fadeIn_0.4s_ease]">
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl shadow-inner shrink-0"><i className="ti ti-file-info"></i></div>
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Pre-Exam Instructions</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Please read carefully before starting</p>
                </div>
            </div>
            
            {draftToResume && (
                <div className="bg-amber-50 text-amber-800 border border-amber-200 px-5 py-4 rounded-xl mb-6 shadow-sm flex items-start gap-3">
                    <i className="ti ti-history text-xl text-amber-600 shrink-0 mt-0.5"></i>
                    <p className="text-[13px] font-medium leading-relaxed"><strong>Session Restored:</strong> We found your previously incomplete exam session. You will resume exactly from where you left off.</p>
                </div>
            )}

            {/* Test Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Subject</div>
                    <div className="text-[13px] font-black text-slate-700 truncate">{activeTest?.subject || 'General'}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl col-span-1 sm:col-span-3">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Test Title</div>
                    <div className="text-[13px] font-black text-slate-700 truncate">{activeTest?.title}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl col-span-2">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Duration</div>
                    <div className="text-[14px] font-black text-blue-600 flex items-center gap-1.5"><i className="ti ti-clock"></i> {activeTest?.duration} Minutes</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl col-span-2">
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Marking Scheme</div>
                    <div className="text-[14px] font-black text-emerald-600 flex items-center gap-1.5"><i className="ti ti-target"></i> {activeTest?.totalMarks} Max <span className="text-rose-500 text-xs ml-1 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200">{activeTest?.negMarking ? `-${Math.abs(activeTest?.negMarking)} Neg` : 'No Neg'}</span></div>
                </div>
            </div>

            {/* Security Rules */}
            {(activeTest?.antiCheat || activeTest?.fullScreenMode) && (
                <div className="mb-8">
                    <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Security Protocols Active</h3>
                    <div className="flex flex-col gap-2.5">
                        {activeTest?.antiCheat && (
                            <div className="flex items-start gap-3 bg-rose-50/50 border border-rose-100 p-3.5 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"><i className="ti ti-shield-lock text-lg"></i></div>
                                <div>
                                    <h4 className="text-[13px] font-bold text-rose-800 mb-0.5">Proctoring Enabled</h4>
                                    <p className="text-[12px] font-medium text-rose-700/80 leading-snug">Tab-switching, minimizing the window, or using split-screen will automatically trigger warnings and submit your exam.</p>
                                </div>
                            </div>
                        )}
                        {activeTest?.fullScreenMode && (
                            <div className="flex items-start gap-3 bg-amber-50/50 border border-amber-100 p-3.5 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><i className="ti ti-maximize text-lg"></i></div>
                                <div>
                                    <h4 className="text-[13px] font-bold text-amber-800 mb-0.5">Full-Screen Lock</h4>
                                    <p className="text-[12px] font-medium text-amber-700/80 leading-snug">The exam will launch in full-screen mode. Exiting full-screen will be recorded as a strict violation.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Critical Note */}
            <div className="bg-slate-800 text-slate-300 p-4 rounded-xl text-[12px] font-medium leading-relaxed mb-6 border border-slate-700 shadow-inner">
                <strong className="text-white flex items-center gap-1.5 mb-1"><i className="ti ti-info-square-rounded text-blue-400"></i> Critical Note:</strong> 
                Once the exam starts, do not use the browser's back or refresh buttons. In case of an internet drop, your answers will be securely cached offline and synced automatically when the connection returns.
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button className="w-full sm:w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[14px] rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2" 
                    onClick={() => {
                        if (isDirectJoin) router.push('/student/radar');
                        else setStep('join');
                    }}>
                    <i className="ti ti-arrow-left"></i> Go Back
                </button>
                <button className="w-full sm:w-2/3 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[15px] rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2" onClick={startExam}>
                    <i className="ti ti-player-play"></i> {draftToResume ? 'Resume Assessment Now' : 'I Agree, Start Assessment'}
                </button>
            </div>
        </div>
      )}

      {/* STEP 3: LIVE EXAM ENGINE */}
      {step === 'exam' && activeTest && currentQuestion && answers.length > 0 && (
        <>
          <div className="test-topbar">
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '2px' }}>{activeTest?.title}</div>
              <div style={{ fontSize: '13px', opacity: 0.85 }}>{name} {roll ? '· ' + roll : ''} &bull; Q {curQ + 1} / {activeTest?.questions?.length}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className={`timer-pill ${timeLeft <= 300 ? 'timer-warn' : ''}`}>
                  <i className="ti ti-clock" style={{ fontSize: '18px' }}></i><span>{formatTime(timeLeft)}</span>
              </div>
              <button className="btn btn-sm hide-mobile" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontWeight: 600 }} onClick={confirmAndSubmit}><i className="ti ti-send"></i> Finish</button>
            </div>
          </div>
          
          <div id="live-stats-bar" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600 }}>
              <span style={{ color: '#185FA5', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#185FA5', borderRadius: '50%' }}></span> Attempted: {answeredQs}</span>
              <span style={{ color: '#854F0B', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#FAC775', borderRadius: '50%' }}></span> Marked: {markedQs}</span>
              <span style={{ color: '#A32D2D', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', background: '#f8fafc', border: '1px solid #A32D2D', borderRadius: '50%' }}></span> Pending: {remainingQs}</span>
          </div>

          {/* SECTION TABS */}
          {activeTest?.sections && activeTest.sections.length > 0 && (
             <div style={{ display: 'flex', gap: '8px', background: 'var(--color-background-secondary)', padding: '8px 16px', borderBottom: '1px solid var(--color-border-secondary)', overflowX: 'auto', scrollbarWidth: 'none', marginBottom: '1rem', marginTop: '1rem' }}>
                  {activeTest.sections.map((sec, idx) => {
                      var firstQIdx = activeTest.questions.findIndex(qq => qq.section === sec);
                      var isCurrentSec = (currentQuestion?.section === sec) || (!currentQuestion?.section && sec === activeTest.sections[0]);
                      return (
                          <button key={idx} className="btn btn-sm" 
                              style={isCurrentSec ? { background: '#185FA5', color: '#fff', borderColor: '#185FA5', fontWeight: 600, whiteSpace: 'nowrap' } : { background: '#fff', color: 'var(--color-text-secondary)', borderColor: '#cbd5e1', fontWeight: 600, whiteSpace: 'nowrap' }} 
                              onClick={() => { if(firstQIdx > -1) changeQuestion(firstQIdx); }}>
                              {sec}
                          </button>
                      );
                  })}
              </div>
          )}

        <div className="test-layout" style={{ marginTop: '1rem' }}>
            
            <div className="q-area" style={{ display: 'flex', flexDirection: 'column', minHeight: '65vh' }}> 
              
              {/* SMART SPACE-SAVING HEADER FOR MOBILE */}
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--color-border-secondary)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="q-num-badge" style={{ width: '36px', height: '36px', fontSize: '16px', flexShrink: 0 }}>{curQ + 1}</div>
                        <span className={`badge ${getBadge(currentQuestion?.type)}`}>{getLabel(currentQuestion?.type)}</span>
                    </div>
                    {answers[curQ]?.marked && <span className="badge b-amber" style={{ alignSelf: 'flex-start' }}><i className="ti ti-bookmark" style={{ fontSize: '12px' }}></i> Marked</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    <span className="badge b-blue" style={{ fontSize: '13px', fontWeight: 600 }}>{currentQuestion?.marks} Marks</span>
                    {currentQuestion?.section && <span className="badge b-purple" style={{ fontSize: '11px', fontWeight: 600 }}><i className="ti ti-layout-grid-add"></i> {currentQuestion.section}</span>}
                </div>
              </div>
              
              <div className="q-area-content" style={{ opacity: 0, flex: 1 }}>
                  
                  {/* StaticMath applied to Question Text */}
                  <StaticMath isBlock={true} html={currentQuestion?.text} style={{ fontSize: '16px', lineHeight: 1.7, marginBottom: '2rem', color: 'var(--color-text-primary)', fontWeight: 500 }} />
                  
                 {/*  UNIVERSAL FIGURE ENGINE (Smart Scaling, Centering & Fallbacks)  */}
                  {currentQuestion?.figureType && currentQuestion.figureType !== 'none' && currentQuestion.figureData && (
                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
                        
                        {/* CSS Hack: SVG height strictly controlled for Mobile/Laptop */}
                        <style>{`
                            .svg-figure-container svg { max-width: 100%; height: auto; min-height: 80px; max-height: 250px; }
                        `}</style>

                        {/* URL & IMAGE RENDERER */}
                        {(currentQuestion.figureType === 'image' || currentQuestion.figureType === 'url') && (
                            <div style={{ position: 'relative', width: 'fit-content', display: 'flex', justifyContent: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', minHeight: !imgLoaded ? '100px' : 'auto', minWidth: !imgLoaded ? '150px' : 'auto' }}>
                                
                                {!imgLoaded && (
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                                        <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '3px' }}></div>
                                    </div>
                                )}
                                
                                <img 
                                    key={`img-${curQ}`} 
                                    src={currentQuestion.figureData} 
                                    alt="Question Figure" 
                                    style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }} 
                                    onLoad={() => setImgLoaded(true)}
                                    onError={(e) => { 
                                        setImgLoaded(true); 
                                        e.target.onerror = null; 
                                        e.target.src = 'https://via.placeholder.com/400x150/f8fafc/ef4444?text=Image+Load+Failed'; 
                                    }} 
                                />
                            </div>
                        )}

                        {/* RAW SVG RENDERER (Perfect Centering) */}
                        {currentQuestion.figureType === 'svg' && (
                            <div 
                                className="svg-figure-container"
                                style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                                dangerouslySetInnerHTML={{ __html: currentQuestion.figureData }} 
                            />
                        )}

                        {/* SMILES RENDERER */}
                        {currentQuestion.figureType === 'smiles' && (
                            <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <SmilesViewer smilesCode={currentQuestion.figureData} width={250} height={200} />
                            </div>
                        )}

                        {/* 🔥 SMART TIKZ RENDERER (Auto-wraps only if needed to prevent errors) 🔥 */}
                        {currentQuestion.figureType === 'tikz' && (
                            <div className="hide-scroll" style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                <img 
                                    key={`tikz-${curQ}`}
                                    src={`https://i.upmath.me/svg/${encodeURIComponent(
                                        currentQuestion.figureData.includes('\\begin{tikzpicture}') 
                                        ? currentQuestion.figureData 
                                        : '\\begin{tikzpicture}\n' + currentQuestion.figureData + '\n\\end{tikzpicture}'
                                    )}`} 
                                    alt="TikZ Graphic" 
                                    style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain' }} 
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/500x200/f8fafc/ef4444?text=TikZ+Compilation+Failed'; }}
                                />
                            </div>
                        )}
                    </div>
                  )}
                    
                  
                  {/* OPTIONS AREA */}
                  <div>
                      {currentQuestion?.type === 'mcq' && currentQuestion.options.map((opt, j) => (
                          <button key={j} className={`opt-btn ${answers[curQ]?.val === j ? 'sel' : ''}`} onClick={() => pickMCQ(curQ, j)}>
                              <div className="olabel">{answers[curQ]?.val === j ? <i className="ti ti-check"></i> : String.fromCharCode(65 + j)}</div>
                              <div className="hide-scroll" style={{ width: '100%', maxWidth: '100%', padding: '2px 0' }}>
                                {opt.startsWith('[smiles]') ? (
                                    <div style={{ pointerEvents: 'none' }}><SmilesViewer smilesCode={opt.replace('[smiles]', '').trim()} width={150} height={150} /></div>
                                ) : (
                                    <StaticMath isBlock={false} html={opt} style={{ fontSize: '15px', whiteSpace: 'normal', wordBreak: 'break-word' }} />
                                )}
                             </div>
                          </button>
                      ))}
                      
                      {currentQuestion?.type === 'msq' && currentQuestion.options.map((opt, j) => {
                          const isSelected = Array.isArray(answers[curQ]?.val) && answers[curQ].val.includes(j);
                          return (
                              <button key={j} className={`opt-btn ${isSelected ? 'sel' : ''}`} onClick={() => pickMSQ(curQ, j)}>
                                  <div className="olabel" style={{ borderRadius: '4px' }}>{isSelected ? <i className="ti ti-check"></i> : String.fromCharCode(65 + j)}</div>
                                  <div className="hide-scroll" style={{ width: '100%', maxWidth: '100%', padding: '2px 0' }}>
                                  {opt.startsWith('[smiles]') ? (
                                    <div style={{ pointerEvents: 'none' }}><SmilesViewer smilesCode={opt.replace('[smiles]', '').trim()} width={150} height={150} /></div>
                                 ) : (
                                    <StaticMath isBlock={false} html={opt} style={{ fontSize: '15px', whiteSpace: 'normal', wordBreak: 'break-word' }} />
                                  )}
                                </div>
                              </button>
                          );
                      })}

                      {currentQuestion?.type === 'integer' && (
                          <div style={{ marginBottom: '1rem' }}>
                              <label style={{ fontSize: '15px' }}>Enter your integer answer below:</label>
                              <input type="number" value={answers[curQ]?.val !== null ? answers[curQ].val : ''} onChange={(e) => pickInt(curQ, e.target.value)} style={{ maxWidth: '250px', fontSize: '20px', fontWeight: 600, textAlign: 'center', padding: '12px' }} placeholder="0" />
                          </div>
                      )}

                      {currentQuestion?.type === 'subjective' && (
                          <div style={{ marginBottom: '1rem' }}>
                              <label style={{ fontSize: '15px' }}>Type your descriptive answer below:</label>
                              <textarea value={answers[curQ]?.val || ''} onChange={(e) => pickSubj(curQ, e.target.value)} style={{ minHeight: '160px', fontSize: '15px' }} placeholder="Write your detailed answer here..."></textarea>
                          </div>
                      )}
                  </div>
              </div> 

              {/* ACTION BUTTONS */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-sm" onClick={() => toggleMark(curQ)} style={answers[curQ]?.marked ? { color: '#633806', borderColor: '#FAC775', background: '#FAEEDA', fontWeight: 600 } : {}}>
                  <i className="ti ti-bookmark"></i> {answers[curQ]?.marked ? 'Unmark' : 'Mark for Review'}
                </button>
                {answers[curQ]?.val !== null && (!Array.isArray(answers[curQ].val) || answers[curQ].val.length > 0) && (
                    <button className="btn btn-sm btn-danger" onClick={() => clearAns(curQ)}><i className="ti ti-eraser"></i> Clear Selection</button>
                )}
              </div>
              
              {/* BOTTOM NAVIGATION ACTIONS */}
              <div className="mobile-sticky-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '1.5rem' }}>
                  <button className="btn" style={{ flex: 1, padding: '14px', justifyContent: 'center', minWidth: '0' }} onClick={() => changeQuestion(curQ - 1)} disabled={curQ === 0}>
                      <i className="ti ti-arrow-left"></i> <span className="hide-mobile">Prev</span>
                  </button>
                  
                  <button className="btn hide-desktop" style={{ width: '60px', padding: '14px', background: '#f8fafc', justifyContent: 'center', border: '1px solid #cbd5e1', flexShrink: 0 }} onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}>
                      <i className="ti ti-layout-grid" style={{ fontSize: '24px', color: '#185FA5' }}></i>
                  </button>
                  
                  {curQ < (activeTest?.questions?.length || 1) - 1 ? (
                      <button className="btn btn-primary" style={{ flex: 1, padding: '14px', justifyContent: 'center', minWidth: '0' }} onClick={() => changeQuestion(curQ + 1)}>
                          <span className="hide-mobile">Next</span> <i className="ti ti-arrow-right"></i>
                      </button>
                  ) : (
                      <button className="btn btn-success" style={{ flex: 1, padding: '14px', justifyContent: 'center', minWidth: '0', fontWeight: 600 }} onClick={confirmAndSubmit}>
                          <i className="ti ti-check"></i> Submit
                      </button>
                  )}
              </div>
            </div>
            
           {/* 🔥 NAYA: SIDEBAR PALETTE (FLEXIBLE HEIGHT FIX FOR MOBILE) */}
           <div className={`sidebar-panel ${!isMobilePaletteOpen ? 'hide-mobile' : ''}`} style={isMobilePaletteOpen ? { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, margin: 0, borderRadius: '24px 24px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,0.15)', padding: '20px', display: 'flex', flexDirection: 'column', maxHeight: '85vh', background: 'var(--color-background-primary)' } : {}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1.25rem 0' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>Question Palette</div>
                  {isMobilePaletteOpen && <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setIsMobilePaletteOpen(false)}><i className="ti ti-x" style={{ fontSize: '24px' }}></i></button>}
              </div>
              
              <div className="legend-row" style={{ padding: '0 4px', marginBottom: '1.25rem' }}>
                <div className="leg"><div className="leg-dot" style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}></div>Unvisited</div>
                <div className="leg"><div className="leg-dot" style={{ background: '#185FA5' }}></div>Answered</div>
                <div className="leg"><div className="leg-dot" style={{ background: '#FAC775' }}></div>Marked</div>
              </div>
              
              <div className="hide-scroll" style={{ flex: isMobilePaletteOpen ? 1 : 'none', maxHeight: isMobilePaletteOpen ? 'none' : '55vh', overflowY: 'auto', padding: '4px 10px', margin: '0 -10px' }}>
                  {activeTest?.sections && activeTest.sections.length > 0 ? (
                      activeTest.sections.map(sec => {
                          let secAttempted = 0;
                          let secTotal = 0;
                          let secHTML = [];

                          activeTest.questions.forEach((qq, i) => {
                              if (qq.section === sec || (!qq.section && sec === activeTest.sections[0])) {
                                  secTotal++;
                                  let a = answers[i];
                                  let isDone = a?.val !== null && (!Array.isArray(a?.val) || a.val.length > 0);
                                  
                                  if (isDone) secAttempted++;
                                  
                                  let cls = (a?.marked && isDone) ? 'p-both' : a?.marked ? 'p-marked' : isDone ? 'p-answered' : 'p-unanswered';
                                  
                                  secHTML.push(
                                      <button key={i} className={`pal-btn ${cls} ${i === curQ ? 'p-current' : ''}`} onClick={() => changeQuestion(i)}>
                                          {secTotal}
                                      </button>
                                  );
                              }
                          });

                          if (secTotal === 0) return null;

                          return (
                              <div key={sec} style={{ marginBottom: '1.5rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0' }}>
                                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                          <i className="ti ti-folder"></i> {sec}
                                      </div>
                                      <div style={{ fontSize: '11px', fontWeight: 700, background: secAttempted === secTotal ? '#EAF3DE' : '#E6F1FB', color: secAttempted === secTotal ? '#27500A' : '#185FA5', padding: '4px 10px', borderRadius: '12px', border: `1px solid ${secAttempted === secTotal ? '#C0DD97' : '#CECBF6'}` }}>
                                          Attempted: {secAttempted}/{secTotal}
                                      </div>
                                  </div>
                                  <div className="palette-grid">{secHTML}</div>
                              </div>
                          );
                      })
                  ) : (
                      <div className="palette-grid">
                          {activeTest?.questions?.map((_, i) => {
                              let a = answers[i];
                              let isDone = a?.val !== null && (!Array.isArray(a?.val) || a.val.length > 0);
                              let cls = (a?.marked && isDone) ? 'p-both' : a?.marked ? 'p-marked' : isDone ? 'p-answered' : 'p-unanswered';
                              return (
                                  <button key={i} className={`pal-btn ${cls} ${i === curQ ? 'p-current' : ''}`} onClick={() => changeQuestion(i)}>
                                      {i + 1}
                                  </button>
                              );
                          })}
                      </div>
                  )}
              </div>
              <div className="divider" style={{ margin: '1rem 0' }}></div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontWeight: 700, padding: '14px', fontSize: '15px' }} onClick={confirmAndSubmit}><i className="ti ti-send"></i> Submit Final Test</button>
            </div>            
          </div>

          {/* VIRTUAL ROUGH PAD (Floating) */}
          {showRoughPad && (
              <div style={{ position: 'fixed', bottom: '90px', right: '20px', width: '300px', height: '350px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '12px', zIndex: 999, display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                  <div style={{ background: '#185FA5', color: '#fff', padding: '10px 15px', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-pencil"></i> Rough Pad</span>
                      <i className="ti ti-x" style={{ cursor: 'pointer', fontSize: '18px' }} onClick={() => setShowRoughPad(false)}></i>
                  </div>
                  <textarea value={roughText} onChange={e => setRoughText(e.target.value)} style={{ flex: 1, border: 'none', padding: '12px', outline: 'none', resize: 'none', fontSize: '14px', lineHeight: 1.5 }} placeholder="Scribble your rough calculations here..."></textarea>
              </div>
          )}
          <button className="btn btn-primary" style={{ position: 'fixed', bottom: '90px', right: '20px', borderRadius: '50%', width: '54px', height: '54px', zIndex: 998, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(24,95,165,0.4)' }} onClick={() => setShowRoughPad(!showRoughPad)}>
              <i className="ti ti-pencil" style={{ fontSize: '24px', margin: 0 }}></i>
          </button>

          {/* CONFIRMATION MODAL */}
          {showConfirmModal && (
              <div className="modal-bg" style={{ zIndex: 9999 }}>
                  <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center', padding: '2rem' }}>
                      <div style={{ width: '64px', height: '64px', background: '#EAF3DE', color: '#3B6D11', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 1rem' }}>
                          <i className="ti ti-send"></i>
                      </div>
                      <h3 style={{ fontSize: '22px', marginBottom: '10px', color: '#1e293b' }}>Submit Exam?</h3>
                      <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                          You have attempted <strong style={{ color: '#185FA5' }}>{answeredQs}</strong> out of {activeTest?.questions?.length} questions. Once submitted, you cannot change your answers.
                      </p>
                      <div style={{ display: 'flex', gap: '12px' }}>
                          <button className="btn" style={{ flex: 1, padding: '12px', justifyContent: 'center', fontWeight: 600 }} onClick={cancelSubmit}>Review Again</button>
                          <button className="btn btn-success" style={{ flex: 1, padding: '12px', justifyContent: 'center', fontWeight: 600 }} onClick={handleFinalSubmit}>Yes, Submit</button>
                      </div>
                  </div>
              </div>
          )}

        </>
      )}

      {/* PREMIUM ANTI-CHEAT OVERLAY */}
      {cheatWarning && (
          <div className="modal-bg" style={{ zIndex: 99999, background: 'rgba(0,0,0,0.9)' }}>
              <div className="modal-box" style={{ maxWidth: '450px', textAlign: 'center', padding: '3rem 2rem', border: '2px solid #A32D2D' }}>
                  <i className="ti ti-shield-x" style={{ fontSize: '64px', color: '#A32D2D', display: 'block', marginBottom: '1rem', animation: 'pulse 1s infinite' }}></i>
                  <h3 style={{ fontSize: '24px', color: '#A32D2D', marginBottom: '10px' }}>{cheatWarning.fatal ? 'EXAM BLOCKED' : 'SECURITY WARNING'}</h3>
                  <p style={{ fontSize: '16px', color: '#1e293b', marginBottom: '1rem', fontWeight: 500 }}>{cheatWarning.msg}</p>
                  
                  {!cheatWarning.fatal && (
                      <>
                          <div style={{ display: 'inline-block', background: '#FCEBEB', color: '#A32D2D', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, marginBottom: '2rem' }}>
                              Strike {cheatWarning.count} of 3
                          </div>
                          <button className="btn btn-danger" style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '16px' }} onClick={() => {
                              setCheatWarning(null);
                              if (activeTest.fullScreenMode && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(e => console.log(e));
                          }}>
                              I Understand, Resume Exam
                          </button>
                      </>
                  )}
              </div>
          </div>
      )}

     {/* 🔥 PREMIUM SYSTEM MODALS */}
      {sysModal && (
          <div className="modal-bg" style={{ zIndex: 999999, backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.6)' }}>
              
              <style>{`
                  @keyframes popIn { 0% { opacity: 0; transform: scale(0.9) translateY(15px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
              `}</style>
              
              <div className="modal-box" style={{ maxWidth: '420px', width: '90%', textAlign: 'center', padding: '0', border: 'none', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                  
                  {/* Top Color Banner */}
                  <div style={{ height: '120px', background: sysModal.type === 'error' ? 'linear-gradient(135deg, #ef4444, #991b1b)' : 'linear-gradient(135deg, #10b981, #047857)', position: 'relative' }}>
                      {/* Floating Icon overlapping the banner */}
                      <div style={{ position: 'absolute', bottom: '-35px', left: '50%', transform: 'translateX(-50%)', width: '70px', height: '70px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                          <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: sysModal.type === 'error' ? '#fef2f2' : '#ecfdf5', color: sysModal.type === 'error' ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                              <i className={`ti ${sysModal.type === 'error' ? 'ti-shield-x' : 'ti-shield-check'}`}></i>
                          </div>
                      </div>
                  </div>

                  {/* Content Area */}
                  <div style={{ padding: '45px 30px 30px 30px', background: '#fff' }}>
                      <h3 style={{ fontSize: '22px', marginBottom: '12px', color: '#0f172a', fontWeight: 800 }}>{sysModal.type === 'error' ? 'Security Alert' : 'Success'}</h3>
                      <p style={{ color: '#475569', marginBottom: '2rem', fontWeight: 500, lineHeight: 1.6, fontSize: '15px' }}>{sysModal.msg}</p>
                      
                      <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '14px', borderRadius: '12px', background: sysModal.type === 'error' ? '#ef4444' : '#185FA5', color: '#fff', border: 'none', fontWeight: 700, fontSize: '15px', boxShadow: `0 4px 15px ${sysModal.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(24,95,165,0.3)'}`, transition: 'transform 0.2s', letterSpacing: '0.5px' }} 
                          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                          onClick={() => {
                              const action = sysModal.action;
                              setSysModal(null);
                              if(action) action();
                          }}
                      >
                          {sysModal.type === 'error' ? 'Acknowledge' : 'Continue'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

// 🔥 THE VERCEL BUILD FIX: Suspense Boundary Wrapper
export default function StudentPortal() {
  return (
    <Suspense fallback={
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }}></div>
      </div>
    }>
      <StudentPortalContent />
    </Suspense>
  );
}