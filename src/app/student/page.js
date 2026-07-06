// src/app/student/page.js
'use client';
import { useState, useEffect, useRef, memo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, push, set, get } from 'firebase/database'; 
import SmilesViewer from '../../components/SmilesViewer';

// THE MASTER FIX: MathJax React Re-render Protector
const StaticMath = memo(({ html, isBlock, style, className }) => {
  if (isBlock) return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
});

export default function StudentPortal() {
  const { currentUser, loading: authLoading } = useAuth();
  const { fetchSingleTest } = useData(); 
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [isFetchingTest, setIsFetchingTest] = useState(false);

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
  
  // --- REFS ---
  const timerRef = useRef(null);
  const endTimeRef = useRef(null);
  const warningsRef = useRef(0);
  const cheatLogsRef = useRef([]);
  const lastWarningTimeRef = useRef(0);
  const isActionLockedRef = useRef(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (currentUser && currentUser.displayName) setName(currentUser.displayName);
  }, [currentUser]);

  // Reset image loader when question changes
  useEffect(() => {
    setImgLoaded(false);
  }, [curQ]);

  // 1. MathJax Auto-Renderer
  useEffect(() => {
    const renderMath = async () => {
      if (step === 'exam' && typeof window !== 'undefined' && window.MathJax) {
        try {
          window.MathJax.typesetClear();
          await window.MathJax.typesetPromise();
        } catch (err) {
          console.log('MathJax Error:', err);
        } finally {
            let targetAreas = document.querySelectorAll('.q-area-content');
            targetAreas.forEach(el => {
                el.style.transition = 'opacity 0.25s ease-in';
                el.style.opacity = '1'; 
            });
        }
      }
    };
    const timer = setTimeout(renderMath, 20); 
    return () => clearTimeout(timer);
  }, [curQ, step]);

  // Hide Global Header during Exam
  useEffect(() => {
    const header = document.querySelector('.app-header');
    if (step === 'exam' && header) header.style.display = 'none'; 
    else if (header) header.style.display = ''; 
    return () => { if (header) header.style.display = ''; };
  }, [step]);

  // 🔥 NAYA: Keyboard Navigation Engine (Arrows & 1,2,3,4)
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


  // --- JOIN LOGIC ---
  const handleJoinTest = async () => {
    setJoinError(''); 
    if (!name.trim()) { setJoinError('Please enter your full name.'); return; }
    if (!code.trim()) { setJoinError('Please enter the 6-digit test code.'); return; }

    setIsFetchingTest(true); 
    
    try {
        const codeUpper = code.trim().toUpperCase();
        let t = null;

        const localTests = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
        t = localTests.find(x => x.code === codeUpper);

        if (!t) {
            t = await fetchSingleTest(codeUpper);
        }

        if (!t) { setJoinError('Invalid Test Code. Check and try again.'); setIsFetchingTest(false); return; }
        if (t.isActive === false) { setJoinError("Intake Closed: The examiner is no longer accepting submissions."); setIsFetchingTest(false); return; }
        if (t.expiryDate && new Date() > new Date(t.expiryDate)) { setJoinError("Exam Expired: The deadline has passed."); setIsFetchingTest(false); return; }

        const safeName = name.trim();
        const safeRoll = roll.trim().toLowerCase();
        const safeSubmissions = Array.isArray(t.submissions) ? t.submissions : Object.values(t.submissions || {});
        
        let existingSub = safeSubmissions.find(s => s && s.name && s.name.trim().toLowerCase() === safeName.toLowerCase() && (s.roll || '').trim().toLowerCase() === safeRoll);       
        if (existingSub) { setJoinError("Submission Received: You have already submitted this test."); setIsFetchingTest(false); return; }

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
        setJoinError("Network Error. Please try again.");
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
    const secondsSpent = totalSecondsGiven > 0 ? (totalSecondsGiven - timeLeft) : 0;
    const timeTakenStr = formatTime(secondsSpent);

    const finalSub = {
      uid: currentUser ? currentUser.uid : 'anonymous',
      email: currentUser ? currentUser.email : '',
      name: name,
      roll: roll,
      score: Number(score.toFixed(2)), correct, wrong, skipped, details,
      time: new Date().toLocaleString('en-IN'),
      totalMarks: activeTest.totalMarks,
      cheatLogs: cheatLogsRef.current,
      timeTaken: timeTakenStr 
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
      <div style={{ height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0, background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
        {isSubmitting ? (
            <div style={{ textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
                <div className="animation-wrapper">
                    <div className="orbit-ring"></div>
                    <div className="premium-success">
                        <svg className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                            <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                        </svg>
                    </div>
                </div>
                <h2 style={{ fontSize: '26px', color: '#0f172a', marginBottom: '8px', fontWeight: 800, letterSpacing: '-0.5px' }}>Submission Secured</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: '15px' }}>Encrypting and transferring your responses...</p>
            </div>
        ) : (
            <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 1.5rem auto', width: '50px', height: '50px', borderWidth: '4px' }}></div>
                <div style={{ fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '16px' }}>
                    {isFetchingTest ? 'Decrypting Exam Vault...' : 'Initializing Portal...'}
                </div>
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
    <div style={{ animation: 'fadeIn 0.3s ease', width: '100%', maxWidth: '1080px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      
      {/* STEP 1: JOIN FORM */}
      {step === 'join' && (
        <div style={{ maxWidth: '460px', margin: '3rem auto' }}>
          <div className="card" style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: 'none' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div className="logo-icon" style={{ width: '56px', height: '56px', borderRadius: '14px', fontSize: '26px', margin: '0 auto 1rem', boxShadow: '0 4px 10px rgba(24,95,165,0.3)' }}>E</div>
              <div style={{ fontSize: '22px', fontWeight: 600, marginBottom: '4px' }}>Join a Test</div>
              <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Enter your details and the 6-digit test code</div>
            </div>
            <div style={{ marginBottom: '1rem' }}><label>Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Kumar" disabled={!!currentUser} style={currentUser ? { background: '#f1f5f9', color: '#475569', cursor: 'not-allowed' } : {}}/></div>
            <div style={{ marginBottom: '1rem' }}><label>Roll Number (Optional)</label><input type="text" value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 2024CS001" /></div>
            <div style={{ marginBottom: '2rem' }}><label>Test Code</label><input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ENTER CODE" style={{ textTransform: 'uppercase', letterSpacing: '6px', fontSize: '20px', fontWeight: 600, textAlign: 'center', height: '50px' }} maxLength="6" /></div>
            {joinError && <div style={{ color: '#A32D2D', background: '#FCEBEB', padding: '10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="ti ti-alert-triangle"></i> {joinError}</div>}
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '16px', fontWeight: 600 }} onClick={handleJoinTest}>Start Test <i className="ti ti-arrow-right"></i></button>
          </div>
        </div>
      )}

      {/* STEP 2: INSTRUCTIONS */}
      {step === 'instructions' && activeTest && (
        <div style={{ maxWidth: '600px', margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '12px', border: '1px solid var(--color-border-secondary)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '24px', color: '#185FA5' }}><i className="ti ti-file-info"></i> Pre-Exam Instructions</h2>
            
            {draftToResume && (
                <div style={{ background: '#FAEEDA', borderLeft: '4px solid #854F0B', padding: '12px', borderRadius: '6px', marginBottom: '1.5rem', color: '#633806' }}>
                    <strong><i className="ti ti-history"></i> Session Restored:</strong> We found your previously incomplete exam session. You will resume from where you left off.
                </div>
            )}

            <div style={{ fontSize: '15px', color: 'var(--color-text-primary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                <p style={{ marginBottom: '8px' }}><strong>Test:</strong> {activeTest?.title}</p>
                <p style={{ marginBottom: '15px' }}><strong>Subject:</strong> {activeTest?.subject || 'N/A'}</p>
                <ul style={{ marginLeft: '20px', color: 'var(--color-text-secondary)' }}>
                    <li style={{ marginBottom: '8px' }}><strong>Duration:</strong> {activeTest?.duration} Minutes</li>
                    <li style={{ marginBottom: '8px' }}><strong>Total Marks:</strong> {activeTest?.totalMarks} (Negative: {activeTest?.negMarking ? '-' + Math.abs(activeTest?.negMarking) : 'None'})</li>
                    {activeTest?.antiCheat && <li style={{ marginBottom: '8px', color: '#A32D2D' }}><strong><i className="ti ti-shield-lock"></i> Tab-Switch Monitored:</strong> Changing tabs will auto-submit the exam.</li>}
                    {activeTest?.fullScreenMode && <li style={{ marginBottom: '8px', color: '#A32D2D' }}><strong><i className="ti ti-maximize"></i> Full-Screen Lock:</strong> Exiting full-screen will trigger a warning.</li>}
                </ul>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '16px' }} onClick={startExam}><i className="ti ti-player-play"></i> {draftToResume ? 'Resume Exam Now' : 'Start Exam Now'}</button>
            <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '16px', marginTop: '12px' }} onClick={() => setStep('join')}><i className="ti ti-arrow-left"></i> Go Back</button>
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
                  
                  {/* 🔥 NAYA: HYBRID FIGURE ENGINE RENDERER (With Cache-Busting Loaders) */}
                  {currentQuestion?.figureType && currentQuestion.figureType !== 'none' && currentQuestion.figureData && (
                    <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
                        
                        {(currentQuestion.figureType === 'image' || currentQuestion.figureType === 'url') && (
                            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', minHeight: !imgLoaded ? '150px' : 'auto' }}>
                                {!imgLoaded && (
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                                        <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
                                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Loading Image...</span>
                                    </div>
                                )}
                                <img 
                                    key={`img-${curQ}`} 
                                    src={currentQuestion.figureData} 
                                    alt="" 
                                    ref={el => { if(el && el.complete) setImgLoaded(true); }} /* 🔥 CACHE FIX */
                                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)', objectFit: 'contain', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }} 
                                    onLoad={() => setImgLoaded(true)} 
                                    onError={(e) => { e.target.style.display = 'none'; setImgLoaded(true); }} 
                                />
                            </div>
                        )}

                        {currentQuestion.figureType === 'smiles' && (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <SmilesViewer smilesCode={currentQuestion.figureData} width={280} height={280} />
                            </div>
                        )}

                        {currentQuestion.figureType === 'tikz' && (
                            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', overflowX: 'auto', maxWidth: '100%', minHeight: !imgLoaded ? '150px' : 'auto' }}>
                                {!imgLoaded && (
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                                        <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
                                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Drawing Figure...</span>
                                    </div>
                                )}
                                <img 
                                    key={`tikz-${curQ}`}
                                    src={`https://i.upmath.me/svg/${encodeURIComponent('\\begin{tikzpicture}\n' + currentQuestion.figureData + '\n\\end{tikzpicture}')}`} 
                                    alt="Math Graphic" 
                                    ref={el => { if(el && el.complete) setImgLoaded(true); }} /* 🔥 CACHE FIX */
                                    style={{ maxWidth: '100%', objectFit: 'contain', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease' }} 
                                    onLoad={() => setImgLoaded(true)} 
                                    onError={(e) => { e.target.style.display = 'none'; setImgLoaded(true); }} 
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

      {/* CUSTOM SYSTEM MODALS */}
      {sysModal && (
          <div className="modal-bg" style={{ zIndex: 999999 }}>
              <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2.5rem', border: `2px solid ${sysModal.type === 'error' ? '#A32D2D' : '#3B6D11'}`, borderRadius: '16px' }}>
                  <i className={`ti ${sysModal.type === 'error' ? 'ti-alert-octagon' : 'ti-circle-check'}`} style={{ fontSize: '48px', color: sysModal.type === 'error' ? '#A32D2D' : '#3B6D11', marginBottom: '15px' }}></i>
                  <h3 style={{ fontSize: '20px', marginBottom: '10px', color: '#0f172a', fontWeight: 800 }}>{sysModal.type === 'error' ? 'Alert' : 'Success'}</h3>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', fontWeight: 500, lineHeight: 1.6 }}>{sysModal.msg}</p>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', background: sysModal.type === 'error' ? '#A32D2D' : '#3B6D11', color: '#fff', border: 'none', fontWeight: 800, letterSpacing: '1px' }} onClick={() => {
                      const action = sysModal.action;
                      setSysModal(null);
                      if(action) action();
                  }}>ACKNOWLEDGE</button>
              </div>
          </div>
      )}

    </div>
  );
}