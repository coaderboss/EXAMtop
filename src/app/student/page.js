// src/app/student/page.js
'use client';
import { useState, useEffect, useRef, memo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, push, set } from 'firebase/database';

// 🔥 THE MASTER FIX: Ye component MathJax ko React ke re-renders se bachayega
// Isse Timer aur Option Clicks par math equations galti se bhi raw JSON me nahi badlengi.
const StaticMath = memo(({ html, isBlock, style, className }) => {
  if (isBlock) return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
});

export default function StudentPortal() {
  const { currentUser, loading: authLoading } = useAuth();
  const { tests, loadingData } = useData();
  const router = useRouter();

  // --- SCREEN STATES ---
  const [step, setStep] = useState('join');
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [showConfirmModal, setShowConfirmModal] = useState(false); 
  
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

  const [joinError, setJoinError] = useState(''); 
  const [cheatWarning, setCheatWarning] = useState(null); 
  
  // --- REFS (For performance & avoiding re-renders) ---
  const timerRef = useRef(null);
  const endTimeRef = useRef(null);
  const warningsRef = useRef(0);
  const cheatLogsRef = useRef([]);
  const lastWarningTimeRef = useRef(0);
  const isActionLockedRef = useRef(false);

  // Auto-fill student name if logged in via Google
  useEffect(() => {
    if (currentUser && currentUser.displayName) {
      setName(currentUser.displayName);
    }
  }, [currentUser]);

  // 🔥 MathJax Auto-Renderer (Smooth Fade-In, No Flickering)
  useEffect(() => {
    const renderMath = async () => {
      if (step === 'exam' && typeof window !== 'undefined' && window.MathJax) {
        try {
          window.MathJax.typesetClear();
          await window.MathJax.typesetPromise();
        } catch (err) {
          console.log('MathJax Error:', err);
        } finally {
            // Processing hone ke baad slowly dikhao taaki raw text flash na ho
            let targetAreas = document.querySelectorAll('.q-area-content');
            targetAreas.forEach(el => {
                el.style.transition = 'opacity 0.25s ease-in';
                el.style.opacity = '1'; 
            });
        }
      }
    };
    
    // Sirf Question change hone par chalega
    const timer = setTimeout(renderMath, 20); 
    return () => clearTimeout(timer);
  }, [curQ, step]);

  // Hide Global Header during Active Exam
  useEffect(() => {
    const header = document.querySelector('.app-header');
    if (step === 'exam') {
      if (header) header.style.display = 'none'; 
    } else {
      if (header) header.style.display = ''; 
    }
    return () => { if (header) header.style.display = ''; };
  }, [step]);

  // ADVANCED ANTI-CHEAT ENGINE
  useEffect(() => {
    if (step !== 'exam' || !activeTest?.antiCheat) return;

    const handleCheat = (event) => {
        if (isActionLockedRef.current) return;

        const now = Date.now();
        if (now - lastWarningTimeRef.current < 3000) return; 

        let reason = "";
        let isTabSwitch = event.type === 'visibilitychange' && document.hidden;
        let isWindowBlur = event.type === 'blur';
        let isFullScreenExit = event.type === 'fullscreenchange' && !document.fullscreenElement && activeTest.fullScreenMode;

        if (isTabSwitch) reason = "Tab switching / App change";
        else if (isWindowBlur) reason = "Opened another window (Focus lost)";
        else if (isFullScreenExit) reason = "Exited full-screen mode";

        if (reason) {
            lastWarningTimeRef.current = now;
            warningsRef.current += 1;
            cheatLogsRef.current.push({ time: new Date().toLocaleTimeString('en-IN'), reason });

            if (warningsRef.current >= 3) {
                setCheatWarning({ fatal: true, msg: "SECURITY ALERT: Exam Blocked! Rules violated 3 times. Auto-submitting paper." });
                setTimeout(() => handleFinalSubmit(), 3000); 
            } else {
                setCheatWarning({ fatal: false, count: warningsRef.current, msg: `${reason} detected! Please do not leave the exam screen.` });
            }
        }
    };

    const blockCopyPaste = (e) => { e.preventDefault(); };

    document.addEventListener("visibilitychange", handleCheat);
    window.addEventListener("blur", handleCheat);
    if (activeTest.fullScreenMode) document.addEventListener("fullscreenchange", handleCheat);
    
    document.addEventListener('copy', blockCopyPaste);
    document.addEventListener('cut', blockCopyPaste);
    document.addEventListener('paste', blockCopyPaste);
    document.addEventListener('contextmenu', blockCopyPaste);
    document.body.style.userSelect = 'none';

    return () => {
        document.removeEventListener("visibilitychange", handleCheat);
        window.removeEventListener("blur", handleCheat);
        if (activeTest.fullScreenMode) document.removeEventListener("fullscreenchange", handleCheat);
        document.removeEventListener('copy', blockCopyPaste);
        document.removeEventListener('cut', blockCopyPaste);
        document.removeEventListener('paste', blockCopyPaste);
        document.removeEventListener('contextmenu', blockCopyPaste);
        document.body.style.userSelect = 'auto';
    };
  }, [step, activeTest]);


  // --- 1. JOIN LOGIC (WITH OFFLINE SUPPORT) ---
  const handleJoinTest = () => {
    setJoinError(''); 
    if (!name.trim()) { setJoinError('Please enter your full name.'); return; }
    if (!code.trim()) { setJoinError('Please enter the 6-digit test code.'); return; }

    const localTests = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
    const allTests = [...tests, ...localTests];

    const t = allTests.find(x => x.code === code.trim().toUpperCase());
    if (!t) { setJoinError('Invalid Test Code. Check and try again.'); return; }
    if (t.isActive === false) { setJoinError("Intake Closed: The examiner is no longer accepting submissions."); return; }
    if (t.expiryDate && new Date() > new Date(t.expiryDate)) { setJoinError("Exam Expired: The deadline has passed."); return; }

    let rollToMatch = roll ? roll.trim().toLowerCase() : '';
    let existingSub = t.submissions?.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase() && (s.roll || '').trim().toLowerCase() === rollToMatch);
    if (existingSub) { setJoinError("Submission Received: You have already submitted this test."); return; }

    setActiveTest(t);
    setStep('instructions');
  };

  // --- 2. START EXAM LOGIC ---
  const startExam = () => {
    if (!activeTest) return;

    if (activeTest.fullScreenMode) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) elem.requestFullscreen().catch(err => console.log("Fullscreen blocked by browser:", err));
    }

    const initialAnswers = activeTest.questions.map(() => ({ val: null, marked: false }));
    setAnswers(initialAnswers);
    warningsRef.current = 0;
    cheatLogsRef.current = [];
    isActionLockedRef.current = false;
    
    const durationMs = (activeTest?.duration || 60) * 60 * 1000;
    endTimeRef.current = Date.now() + durationMs;
    
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

  // 🔥 THE FLICKER-FREE NAVIGATION FIX
  // Ye function next/prev dabane par question area ko gayab karega, fir naya question layega 
  const changeQuestion = (newIdx) => {
    if (newIdx === curQ) return;
    
    let targetAreas = document.querySelectorAll('.q-area-content');
    targetAreas.forEach(el => {
        el.style.transition = 'none';
        el.style.opacity = '0'; // Screen hide before changing text
    });

    setTimeout(() => {
        setCurQ(newIdx);
        setIsMobilePaletteOpen(false); 
    }, 15);
  };

  // --- 3. QUESTION SELECTION LOGIC ---
  const pickMCQ = (qIndex, optIndex) => { let newAns = [...answers]; newAns[qIndex].val = optIndex; setAnswers(newAns); };
  const pickMSQ = (qIndex, optIndex) => { let newAns = [...answers]; let currentVal = Array.isArray(newAns[qIndex].val) ? [...newAns[qIndex].val] : []; if (currentVal.includes(optIndex)) { currentVal = currentVal.filter(v => v !== optIndex); } else { currentVal.push(optIndex); } newAns[qIndex].val = currentVal; setAnswers(newAns); };
  const pickInt = (qIndex, val) => { let newAns = [...answers]; newAns[qIndex].val = val === '' ? null : Number(val); setAnswers(newAns); };
  const pickSubj = (qIndex, val) => { let newAns = [...answers]; newAns[qIndex].val = val.trim() === '' ? null : val; setAnswers(newAns); };
  const toggleMark = (qIndex) => { let newAns = [...answers]; newAns[qIndex].marked = !newAns[qIndex].marked; setAnswers(newAns); };
  const clearAns = (qIndex) => { let newAns = [...answers]; newAns[qIndex].val = null; setAnswers(newAns); };

  const formatTime = (seconds) => { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return (h > 0 ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); };
  const getLabel = (type) => ({ mcq: 'Single Correct', msq: 'Multi Correct', integer: 'Integer Type', subjective: 'Subjective' }[type] || type);
  const getBadge = (type) => ({ mcq: 'b-blue', msq: 'b-green', integer: 'b-amber', subjective: 'b-purple' }[type] || 'b-gray');

  // --- 4. SUBMIT CONFIRMATION UI ---
  const confirmAndSubmit = () => {
    isActionLockedRef.current = true; 
    setShowConfirmModal(true);
  };

  const cancelSubmit = () => {
    setShowConfirmModal(false);
    setTimeout(() => { isActionLockedRef.current = false; }, 500); 
  };

  // --- 5. SECURE SUBMISSION LOGIC ---
  const handleFinalSubmit = async () => {
    if (!activeTest || step !== 'exam') return;
    
    clearInterval(timerRef.current);
    isActionLockedRef.current = true; 
    setShowConfirmModal(false); 
    setIsSubmitting(true); 

    let score = 0, correct = 0, wrong = 0, skipped = 0;
    const neg = activeTest.negMarking || 0;

    const details = activeTest.questions.map((q, i) => {
      let ans = answers[i];
      let status = 'skipped';
      let earned = 0;
      let hasVal = ans.val !== null && (!Array.isArray(ans.val) || ans.val.length > 0);

      if (!hasVal) {
        skipped++;
      } else if (q.type === 'mcq') {
        if (!q.correct || q.correct.length === 0) {
            status = 'submitted'; skipped++;
        } else if (ans.val === q.correct[0]) { 
            correct++; earned = q.marks; score += q.marks; status = 'correct'; 
        } else { 
            wrong++; earned = -neg; score -= neg; status = 'wrong'; 
        }
      } else if (q.type === 'msq') {
        let userSel = Array.isArray(ans.val) ? ans.val : [];
        let corrSel = q.correct || [];
        if (corrSel.length === 0) {
            status = 'submitted'; skipped++;
        } else {
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
        if (q.correctInt === null || q.correctInt === undefined || q.correctInt === '') {
             status = 'submitted'; skipped++;
        } else if (ans.val === q.correctInt) { 
            correct++; earned = q.marks; score += q.marks; status = 'correct'; 
        } else { 
            wrong++; earned = -neg; score -= neg; status = 'wrong'; 
        }
      } else {
        skipped++; status = 'submitted';
      }

      return { q, ans, status, earned };
    });

    score = Number(score.toFixed(2));

    const finalSub = {
      uid: currentUser ? currentUser.uid : 'anonymous',
      email: currentUser ? currentUser.email : '',
      name: name,
      roll: roll,
      score, correct, wrong, skipped, details,
      time: new Date().toLocaleString('en-IN'),
      totalMarks: activeTest.totalMarks,
      cheatLogs: cheatLogsRef.current 
    };

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
          const tIndex = tests.findIndex(x => x.id === activeTest.id);
          if (tIndex > -1) {
              const subsRef = ref(database, `tests/${tIndex}/submissions`);
              const newSubRef = push(subsRef); 
              await set(newSubRef, finalSub);  
          }
      }

      if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(err => console.log("Exit fullscreen failed:", err));
      }

      if (activeTest.resultVis === 'manual') {
          alert("Test Submitted Successfully! Your answers have been saved. Examiner will declare results later.");
          router.push('/student-dashboard');
      } else {
          router.push('/student-results'); 
      }

    } catch (error) {
        console.error("Transmission Error:", error);
        alert("Failed to securely submit the exam. Check your connection.");
        router.push('/');
    }
  };


  // --- CENTRALIZED LOADING UI ---
  if (authLoading || loadingData || isSubmitting) {
    return (
      <div className="spinner-container" style={{ paddingTop: '10vh' }}>
        <div className="spinner"></div>
        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          {isSubmitting ? 'Securely evaluating and saving paper...' : 'Loading Portal...'}
        </div>
      </div>
    );
  }

  // --- STATS CALCULATION ---
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
            <div style={{ fontSize: '15px', color: 'var(--color-text-primary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                <p style={{ marginBottom: '8px' }}><strong>Test:</strong> {activeTest?.title}</p>
                <p style={{ marginBottom: '15px' }}><strong>Subject:</strong> {activeTest?.subject || 'N/A'}</p>
                <ul style={{ marginLeft: '20px', color: 'var(--color-text-secondary)' }}>
                    <li style={{ marginBottom: '8px' }}><strong>Duration:</strong> {activeTest?.duration} Minutes</li>
                    <li style={{ marginBottom: '8px' }}><strong>Total Marks:</strong> {activeTest?.totalMarks} (Negative: {activeTest?.negMarking ? '-' + activeTest?.negMarking : 'None'})</li>
                    {activeTest?.antiCheat && <li style={{ marginBottom: '8px', color: '#A32D2D' }}><strong><i className="ti ti-shield-lock"></i> Tab-Switch Monitored:</strong> Changing tabs will auto-submit the exam.</li>}
                    {activeTest?.fullScreenMode && <li style={{ marginBottom: '8px', color: '#A32D2D' }}><strong><i className="ti ti-maximize"></i> Full-Screen Lock:</strong> Exiting full-screen will trigger a warning.</li>}
                </ul>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '16px' }} onClick={startExam}><i className="ti ti-player-play"></i> Start Exam Now</button>
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
            {/* Added "opacity: 0" so the very first question doesn't flash raw text */}
            <div className="q-area q-area-content" style={{ opacity: 0 }}>
              
              <div className="q-block-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border-secondary)', paddingBottom: '1rem' }}>
                <div className="q-num-badge" style={{ width: '36px', height: '36px', fontSize: '16px' }}>{curQ + 1}</div>
                <span className={`badge ${getBadge(currentQuestion?.type)}`}>{getLabel(currentQuestion?.type)}</span>
                {currentQuestion?.section && <span className="badge b-purple" style={{ fontWeight: 600 }}><i className="ti ti-layout-grid-add"></i> {currentQuestion.section}</span>}
                <span className="badge b-blue" style={{ fontSize: '13px' }}>{currentQuestion?.marks} Marks</span>
                {answers[curQ]?.marked && <span className="badge b-amber"><i className="ti ti-bookmark" style={{ fontSize: '12px' }}></i> Marked</span>}
              </div>
              
              {/* 🔥 StaticMath applied to Question Text */}
              <StaticMath isBlock={true} html={currentQuestion?.text} style={{ fontSize: '16px', lineHeight: 1.7, marginBottom: '2rem', color: 'var(--color-text-primary)', fontWeight: 500 }} />
              
              {currentQuestion?.imgUrl && (
                  <div style={{ marginBottom: '1.5rem' }}><img src={currentQuestion.imgUrl} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)' }} /></div>
              )}
              
              <div>
                  {currentQuestion?.type === 'mcq' && currentQuestion.options.map((opt, j) => (
                      <button key={j} className={`opt-btn ${answers[curQ]?.val === j ? 'sel' : ''}`} onClick={() => pickMCQ(curQ, j)}>
                          <div className="olabel">{answers[curQ]?.val === j ? <i className="ti ti-check"></i> : String.fromCharCode(65 + j)}</div>
                          {/* 🔥 StaticMath applied to Option Text */}
                          <StaticMath isBlock={false} html={opt} style={{ fontSize: '15px' }} />
                      </button>
                  ))}
                  
                  {currentQuestion?.type === 'msq' && currentQuestion.options.map((opt, j) => {
                      const isSelected = Array.isArray(answers[curQ]?.val) && answers[curQ].val.includes(j);
                      return (
                          <button key={j} className={`opt-btn ${isSelected ? 'sel' : ''}`} onClick={() => pickMSQ(curQ, j)}>
                              <div className="olabel" style={{ borderRadius: '4px' }}>{isSelected ? <i className="ti ti-check"></i> : String.fromCharCode(65 + j)}</div>
                              {/* 🔥 StaticMath applied to Option Text */}
                              <StaticMath isBlock={false} html={opt} style={{ fontSize: '15px' }} />
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

              <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-sm" onClick={() => toggleMark(curQ)} style={answers[curQ]?.marked ? { color: '#633806', borderColor: '#FAC775', background: '#FAEEDA', fontWeight: 600 } : {}}>
                  <i className="ti ti-bookmark"></i> {answers[curQ]?.marked ? 'Unmark' : 'Mark for Review'}
                </button>
                {answers[curQ]?.val !== null && (!Array.isArray(answers[curQ].val) || answers[curQ].val.length > 0) && (
                    <button className="btn btn-sm btn-danger" onClick={() => clearAns(curQ)}><i className="ti ti-eraser"></i> Clear Selection</button>
                )}
              </div>
              
                  {/* BOTTOM NAVIGATION ACTIONS (Sticky on Mobile) */}
                  <div className="mobile-sticky-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '2rem' }}>
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
            
            <div className={`sidebar-panel ${!isMobilePaletteOpen ? 'hide-mobile' : ''}`} style={isMobilePaletteOpen ? { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, margin: 0, borderRadius: '20px 20px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,0.15)' } : {}}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1rem 0' }}>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>Question Palette</div>
                  {isMobilePaletteOpen && <button className="btn btn-ghost" style={{ padding: 0 }} onClick={() => setIsMobilePaletteOpen(false)}><i className="ti ti-x" style={{ fontSize: '24px' }}></i></button>}
              </div>
              <div className="legend-row">
                <div className="leg"><div className="leg-dot" style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-primary)' }}></div>Unvisited</div>
                <div className="leg"><div className="leg-dot" style={{ background: '#185FA5' }}></div>Answered</div>
                <div className="leg"><div className="leg-dot" style={{ background: '#FAC775' }}></div>Marked</div>
              </div>
              
              {/* Palette Grid container with Scroll */}
              <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '5px' }}>
                  {activeTest?.sections && activeTest.sections.length > 0 ? (
                      activeTest.sections.map(sec => {
                          let localQNum = 1;
                          let secHTML = activeTest.questions.map((qq, i) => {
                              if (qq.section === sec || (!qq.section && sec === activeTest.sections[0])) {
                                  let a = answers[i];
                                  let isDone = a?.val !== null && (!Array.isArray(a?.val) || a.val.length > 0);
                                  let cls = (a?.marked && isDone) ? 'p-both' : a?.marked ? 'p-marked' : isDone ? 'p-answered' : 'p-unanswered';
                                  let currentNum = localQNum++; 
                                  return (
                                      <button key={i} className={`pal-btn ${cls} ${i === curQ ? 'p-current' : ''}`} onClick={() => changeQuestion(i)}>
                                          {currentNum}
                                      </button>
                                  );
                              }
                              return null;
                          }).filter(Boolean); 

                          if (secHTML.length === 0) return null;

                          return (
                              <div key={sec} style={{ marginBottom: '1rem' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)', margin: '15px 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                      <i className="ti ti-folder"></i> {sec}
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
              <div className="divider"></div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontWeight: 600, padding: '12px' }} onClick={confirmAndSubmit}><i className="ti ti-send"></i> Submit Final Test</button>
            </div>
          </div>

          {/* BEAUTIFUL CUSTOM CONFIRMATION MODAL */}
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
                                  Strike {cheatWarning.count} of 2
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

    </div>
  );
}