// src/app/tests/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, set, update, remove, get } from 'firebase/database'; 
import FigureRenderer from '../../components/FigureRenderer'; 
import SmilesViewer from '../../components/SmilesViewer';

export default function ManageTests() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  // 🔥 THE FIX: Naye On-Demand fetch functions ko destructure kiya hai
  const { tests, setTests, loadingData, fetchMyTests } = useData();
  const router = useRouter();

  // --- NEW: Local Offline State ---
  const [localTests, setLocalTests] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [isInitialLoad, setIsInitialLoad] = useState(true); // 🔥 THE MAKKHAN FIX
  
  // --- CORE STATE ---
  const [selectedTest, setSelectedTest] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'subs'
  const [searchQuery, setSearchQuery] = useState('');
  const [undoData, setUndoData] = useState(null); // For Delete Undo timer
  const [vaultSearchQuery, setVaultSearchQuery] = useState(''); 
  const [sortBy, setSortBy] = useState('newest'); 
  
  // --- MODALS & SUB-VIEWS ---
  const [modalType, setModalType] = useState(null); // 'analytics' | 'editKey' | 'audit'
  const [evaluateSub, setEvaluateSub] = useState(null); // Manual evaluation screen
  
  // --- EDIT KEY & EVALUATION STATE ---
  const [tempQuestions, setTempQuestions] = useState([]);
  const [evalOverrides, setEvalOverrides] = useState({});
  const [auditReason, setAuditReason] = useState('');
  const [evalFilter, setEvalFilter] = useState('all'); 
  const [evalSectionFilter, setEvalSectionFilter] = useState('all_sections'); // 🔥 NAYA: Examiner Section Filter
  

  // --- SYSTEM POPUP STATES ---
  const [sysAlert, setSysAlert] = useState(null); // { title, msg, type }
  const [sysConfirm, setSysConfirm] = useState(null); // { title, msg, action }
  const baseTests = isOffline ? localTests : [...(tests || []), ...localTests];

  // 🔥 FIX 1: THE AMNESIA CURE (State Memory on Refresh)
  useEffect(() => {
    const savedTestId = sessionStorage.getItem('examitop_activeTestId');
    const savedTab = sessionStorage.getItem('examitop_activeTab');
    const savedEvalIdx = sessionStorage.getItem('examitop_evalSubIdx');

    if (savedTestId && isMounted) {
      const t = baseTests.find(x => x.id === savedTestId);
      if (t) {
        setSelectedTest(t);
        if (savedTab) setActiveTab(savedTab);
        if (savedEvalIdx && savedEvalIdx !== 'null' && t.submissions) {
          setEvaluateSub({ sub: t.submissions[parseInt(savedEvalIdx)], test: t, sIdx: parseInt(savedEvalIdx) });
        }
      }
    }
  }, [isMounted, baseTests]); // BaseTests load hone par trigger hoga

  useEffect(() => {
    // 2. Jaise hi kuch change ho, memory me save kar do
    if (selectedTest) sessionStorage.setItem('examitop_activeTestId', selectedTest.id);
    else sessionStorage.removeItem('examitop_activeTestId');

    sessionStorage.setItem('examitop_activeTab', activeTab);

    if (evaluateSub) sessionStorage.setItem('examitop_evalSubIdx', evaluateSub.sIdx);
    else sessionStorage.removeItem('examitop_evalSubIdx');
  }, [selectedTest, activeTab, evaluateSub]);

  // 1. Fetch Local Tests and Offline Status on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const offlineStatus = localStorage.getItem('isOfflineMode') === 'true';
        setIsOffline(offlineStatus);
        setLocalTests(JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]'));
        setIsMounted(true);
    }
  }, [selectedTest]);

  // 🔥 THE FIX 1: Sirf apne tests fetch karo (With Anti-Flicker Logic)
  useEffect(() => {
      if (isMounted && !isOffline && currentUser?.uid && (userRole === 'examiner' || userRole === 'admin')) {
          fetchMyTests(currentUser.uid).finally(() => setIsInitialLoad(false));
      } else if (isMounted) {
          setIsInitialLoad(false);
      }
  }, [isMounted, isOffline, currentUser, userRole]);

  // 2. MathJax Auto-Renderer
  useEffect(() => {
    const renderMath = async () => {
        if (typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
            try {
                window.MathJax.typesetClear();
                await window.MathJax.typesetPromise();
            } catch (err) {
                console.log('MathJax Error:', err);
            }
        }
    };
    const timer = setTimeout(renderMath, 100);
    return () => clearTimeout(timer);
  }, [selectedTest, evaluateSub, evalFilter, evalSectionFilter, modalType, activeTab]);
  
  // 🔥 AUTO-KICK BOUNCER
  useEffect(() => {
      if (isMounted && !authLoading && !isOffline && (!currentUser || (userRole !== 'examiner' && userRole !== 'admin'))) {
          const kickTimer = setTimeout(() => {
              router.replace('/');
            }, 3000); 
        return () => clearTimeout(kickTimer);
    }
  }, [currentUser, userRole, authLoading, isMounted, isOffline, router]);

  // 🔥 FIX 1: Premium Skeleton Loader (Replaces the boring spinner)
  if (authLoading || !isMounted || (!isOffline && (loadingData || isInitialLoad))) {
    return (
        <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            {/* Page Header Skeleton */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div className="skeleton" style={{ width: '220px', height: '32px', marginBottom: '8px', borderRadius: '8px' }}></div>
                <div className="skeleton" style={{ width: '100%', maxWidth: '400px', height: '20px', borderRadius: '6px' }}></div>
            </div>

            {/* Search & Sort Panel Skeleton */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div className="skeleton" style={{ flex: '1', minWidth: '250px', height: '45px', borderRadius: '10px' }}></div>
                <div className="skeleton" style={{ width: '160px', height: '45px', borderRadius: '10px' }}></div>
            </div>

            {/* Skeleton Cards List (3 dummy cards dikhayega) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2, 3].map((n) => (
                    <div key={n} style={{ 
                        padding: '1.25rem 1rem', 
                        background: 'var(--color-background-primary)', 
                        borderRadius: '12px', 
                        border: '1px solid var(--color-border-secondary)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                        <div style={{ flex: 1 }}>
                            {/* Title & Badge */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                                <div className="skeleton" style={{ width: '180px', height: '24px', borderRadius: '6px' }}></div>
                                <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: '12px' }}></div>
                            </div>
                            {/* Meta Info (Qs, Mins) */}
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '12px' }}>
                                <div className="skeleton" style={{ width: '80px', height: '16px' }}></div>
                                <div className="skeleton" style={{ width: '80px', height: '16px' }}></div>
                                <div className="skeleton" style={{ width: '80px', height: '16px' }}></div>
                            </div>
                            {/* Tags */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <div className="skeleton" style={{ width: '100px', height: '24px', borderRadius: '20px' }}></div>
                                <div className="skeleton" style={{ width: '100px', height: '24px', borderRadius: '20px' }}></div>
                            </div>
                        </div>
                        {/* Right Arrow Skeleton (Hidden on Mobile) */}
                        <div className="hide-mobile skeleton" style={{ width: '38px', height: '38px', borderRadius: '50%' }}></div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  if (!isOffline && (!currentUser || (userRole !== 'examiner' && userRole !== 'admin'))) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', marginTop: '10vh' }}>
        <i className="ti ti-shield-x" style={{ fontSize: '64px', color: '#A32D2D', marginBottom: '1rem', animation: 'pulse 1s infinite' }}></i>
        <h3 style={{ color: '#A32D2D', fontSize: '24px' }}>SECURITY CLEARANCE REQUIRED</h3>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
          Your account does not have Examiner privileges. <br/> Redirecting you to the safe zone in 3 seconds...
        </p>
        <div className="spinner" style={{ margin: '0 auto', borderColor: '#A32D2D', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  // 🔥 THE FIX 2: Kyunki ab 'tests' me pehle se hi sirf is examiner ke tests hain, humein filter lagane ki zaroorat nahi
  const myTests = baseTests.filter(t => t.id !== undoData?.test?.id);
  
  // 🔥 THE FIX 3: SAFE UPDATER (Firebase Index Matcher)
  const updateTestGlobal = async (updatedTest) => {
    if (updatedTest.isLocal) {
        let currentLocal = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
        const newLocal = currentLocal.map(x => x.id === updatedTest.id ? updatedTest : x);
        localStorage.setItem('examitop_offline_tests', JSON.stringify(newLocal));
        setLocalTests(newLocal);
        setSelectedTest(updatedTest);
    } else {
        // Ek mini-fetch karke exact real index nikalna (Data Leak Proof)
        const snapshot = await get(ref(database, 'tests'));
        const allTests = snapshot.val() || [];
        const tIndex = allTests.findIndex(x => x && x.id === updatedTest.id);
        
        if (tIndex > -1) {
            await update(ref(database, `tests/${tIndex}`), updatedTest);
            // Local state turant update karna bina page reload kiye
            if (setTests) setTests(prev => prev.map(t => t.id === updatedTest.id ? updatedTest : t));
            setSelectedTest(updatedTest);
        }
    }
  };

  // --- DASHBOARD ACTIONS ---
  const toggleTestStatus = async (t) => {
    try {
      await updateTestGlobal({ ...t, isActive: !t.isActive });
    } catch (e) { setSysAlert({ title: 'Error', msg: 'Error toggling status.', type: 'error' }); }
  };

  // 🔥 THE FIX 4: SAFE DELETER (Cross-Check Delete)
  const triggerDelete = (t) => {
    setSysConfirm({
        title: 'Delete Test?',
        msg: `Are you sure you want to delete "${t.title}"? You will have 5 seconds to undo this action.`,
        action: () => {
            setSelectedTest(null); 
            const timeoutId = setTimeout(async () => {
                try {
                    if (t.isLocal) {
                        let currentLocal = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
                        let newLocal = currentLocal.filter(x => x.id !== t.id);
                        localStorage.setItem('examitop_offline_tests', JSON.stringify(newLocal));
                        setLocalTests(newLocal);
                    } else {
                        // DB se safely wo element nikal kar array set karna
                        const snapshot = await get(ref(database, 'tests'));
                        let allTests = snapshot.val() || [];
                        const newTests = allTests.filter(x => x && x.id !== t.id);
                        await set(ref(database, 'tests'), newTests);
                        if (setTests) setTests(prev => prev.filter(x => x.id !== t.id));
                    }
                    setUndoData(null); 
                } catch (e) { console.error("Deletion failed", e); }
            }, 5000);
            setUndoData({ test: t, timeoutId });
        }
    });
  };

  const handleUndo = () => {
      if (undoData?.timeoutId) clearTimeout(undoData.timeoutId);
      setUndoData(null);
  };

  const publishResults = async (t) => {
    try {
      await updateTestGlobal({ ...t, released: true });
      setSysAlert({ title: 'Published', msg: 'Results published successfully! Students can now view their papers.', type: 'success' });
    } catch (e) { setSysAlert({ title: 'Error', msg: 'Error publishing results.', type: 'error' }); }
  };

  const shareTest = (t, platform) => {
    const shareLink = `${window.location.origin}/student?code=${t.code}`;
    const shareText = `*${t.title}* is now live!\n\n🕒 *Time:* ${t.duration} Mins\n💯 *Marks:* ${t.totalMarks}\n🔑 *Test Code:* ${t.code}\n\nClick the link below to join directly:\n${shareLink}`;
    if (platform === 'whatsapp') window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(shareText), '_blank');
    if (platform === 'telegram') window.open('https://t.me/share/url?url=&text=' + encodeURIComponent(shareText), '_blank');
  };

  const autoJoinLocalTest = (code) => { router.push(`/student?code=${code}`); };

  const exportToCSV = (t) => {
    if (!t.submissions || !t.submissions.length) {
        setSysAlert({ title: 'Empty', msg: 'No submissions available to export yet.', type: 'warning' });
        return;
    }
    let csv = 'Student Name,Roll Number,Total Score,Max Marks,Accuracy (%),Correct Qs,Wrong Qs,Skipped Qs,Submission Time\n';
    t.submissions.forEach(s => {
      const accuracy = s.correct + s.wrong > 0 ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0;
      csv += `"${s.name}","${s.roll || 'N/A'}",${s.score},${t.totalMarks},${accuracy},${s.correct},${s.wrong},${s.skipped},"${s.time}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${t.title.replace(/ /g, "_")}_Results.csv`;
    link.click();
  };

  const printTestPaper = (t) => {
    let printHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #000;">
          <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
              <h1 style="margin:0 0 10px 0; font-size:24px; text-transform:uppercase;">${t.title}</h1>
              <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold;">
                  <span>Subject: ${t.subject || 'General'}</span><span>Time: ${t.duration} Mins</span><span>Max Marks: ${t.totalMarks}</span>
              </div>
          </div>
          <div style="margin-bottom: 25px; display:flex; justify-content:space-between; font-size:15px;">
              <div><strong>Student Name:</strong> ______________________________</div><div><strong>Roll No:</strong> ______________________</div>
          </div>`;

    t.questions.forEach((q, i) => {
      printHtml += `<div style="margin-bottom: 25px; page-break-inside: avoid;">
        <div style="font-weight:bold; margin-bottom:8px; font-size:15px;">Q${i + 1}. ${q.text} <span style="float:right; font-weight:normal; font-size:13px;">[${q.marks} Marks]</span></div>`;
      if (q.imgUrl) printHtml += `<img src="${q.imgUrl}" style="max-height:200px; display:block; margin:10px 0; border:1px solid #ccc;">`;
      
      if (q.type === 'mcq' || q.type === 'msq') {
        q.options.forEach((opt, j) => { printHtml += `<div style="margin-bottom: 6px; margin-left: 25px; font-size:14px;">${String.fromCharCode(65 + j)}) ${opt}</div>`; });
      } else if (q.type === 'integer') {
        printHtml += `<div style="margin-left:25px; margin-top:10px; font-size:14px;">Answer: ______________________</div>`;
      } else {
        printHtml += `<div style="margin-top:10px; height: 120px; border: 1px dotted #999; margin-left:25px;"></div>`;
      }
      printHtml += `</div>`;
    });
    printHtml += `<div style="text-align:center; margin-top:40px; font-size:12px; color:#666;">Generated by ExamiTop Platform &bull; Secure Proctoring Engine</div></div>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    
    // 🔥 FIX 2: BULLETPROOF MATHJAX & IMAGE SYNC ENGINE
    const mathJaxScript = `
        <script>
            window.MathJax = {
                tex: { 
                    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], 
                    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] 
                },
                startup: {
                    pageReady: () => {
                        return MathJax.startup.defaultPageReady().then(() => {
                            // Math render hone ke baad check karo saari images aayi ya nahi
                            const images = Array.from(document.images);
                            Promise.all(images.map(img => {
                                if (img.complete) return Promise.resolve();
                                return new Promise(resolve => { img.onload = img.onerror = resolve; });
                            })).then(() => {
                                // Ek dum solid render hone ke baad hi print ka popup do
                                setTimeout(() => { window.print(); }, 500);
                            });
                        });
                    }
                }
            };
        </script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
    `;

    doc.write('<html><head><title>Print: ' + t.title + '</title>' + mathJaxScript + '</head><body>' + printHtml + '</body></html>');
    doc.close();
    
    iframe.contentWindow.onafterprint = () => { setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1000); };
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 120000); 
  };

  const openEditKey = () => {
    setTempQuestions(JSON.parse(JSON.stringify(selectedTest.questions)));
    setModalType('editKey');
  };

  const handleRekeyChange = (i, type, val) => {
    let n = [...tempQuestions];
    if (type === 'mcq') n[i].correct = [val];
    else if (type === 'msq') {
      if (!n[i].correct) n[i].correct = [];
      if (n[i].correct.includes(val)) n[i].correct = n[i].correct.filter(x => x !== val);
      else n[i].correct.push(val);
    } else if (type === 'integer') n[i].correctInt = val;
    setTempQuestions(n);
  };

  const saveNewKeyAndReevaluate = async () => {
    let updatedTest = { ...selectedTest, questions: tempQuestions };
    if (updatedTest.submissions && updatedTest.submissions.length > 0) {
      const neg = Math.abs(Number(updatedTest.negMarking || 0));
      updatedTest.submissions.forEach(sub => {
        let newScore = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
        sub.details.forEach((d, i) => {
          let q = tempQuestions[i]; d.q = q; let ans = d.ans;
          let hasVal = ans.val !== null && (!Array.isArray(ans.val) || ans.val.length > 0);

          if (!hasVal) {
            if (d.status === 'evaluated') { newScore += (d.earned || 0); newSkipped++; } 
            else { d.status = 'skipped'; d.earned = 0; newSkipped++; }
          } else if (q.type === 'mcq') {
            if (ans.val === q.correct[0]) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } 
            else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
          } else if (q.type === 'msq') {
            let userSel = Array.isArray(ans.val) ? ans.val : []; let corrSel = q.correct || [];
            let hasWrongOption = userSel.some(x => !corrSel.includes(x)); let correctlySelected = userSel.filter(x => corrSel.includes(x)).length;
            if (hasWrongOption) { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; } 
            else if (correctlySelected === corrSel.length) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } 
            else if (correctlySelected > 0) { let partialMarks = (q.marks / corrSel.length) * correctlySelected; let earned = Math.round(partialMarks * 100) / 100; newScore += earned; newCorrect++; d.status = 'partial'; } 
            else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
          } else if (q.type === 'integer') {
            if (ans.val === q.correctInt) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; } 
            else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
          } else {
            if (d.status === 'evaluated') { newScore += (d.earned || 0); if (d.earned > 0) newCorrect++; else newSkipped++; } 
            else { d.status = 'submitted'; d.earned = 0; newSkipped++; }
          }
        });
        sub.score = Number(newScore.toFixed(2)); sub.correct = newCorrect; sub.wrong = newWrong; sub.skipped = newSkipped;
      });
    }

    try {
      await updateTestGlobal(updatedTest);
      setModalType(null);
      setSysAlert({ title: 'Answer Key Updated', msg: `Successfully re-graded ${updatedTest.submissions?.length || 0} student(s).`, type: 'success' });
    } catch (e) { setSysAlert({ title: 'Error', msg: 'Error saving new key.', type: 'error' }); }
  };

  const saveEvaluation = async () => {
    if (!auditReason.trim()) {
        setSysAlert({ title: 'Required', msg: 'Audit reason is mandatory for manual grading.', type: 'warning' });
        return;
    }
    
    let hasError = false;
    Object.keys(evalOverrides).forEach(qIdx => {
      if (evalOverrides[qIdx] > evaluateSub.sub.details[qIdx].q.marks) {
        setSysAlert({ title: 'Invalid Marks', msg: `Marks for Q${Number(qIdx) + 1} cannot exceed ${evaluateSub.sub.details[qIdx].q.marks}!`, type: 'error' });
        hasError = true;
      }
    });
    if (hasError) return;

    let newSub = { ...evaluateSub.sub };
    Object.keys(evalOverrides).forEach(qIdx => {
      let awarded = Number(evalOverrides[qIdx]);
      newSub.details[qIdx].earned = awarded;
      newSub.details[qIdx].status = 'evaluated';
      if (!newSub.details[qIdx].auditLogs) newSub.details[qIdx].auditLogs = [];
      newSub.details[qIdx].auditLogs.push({ date: new Date().toLocaleString('en-IN'), examiner: currentUser?.displayName || 'Offline Examiner', reason: auditReason, awarded });
    });

    let newTotal = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
    newSub.details.forEach(d => {
      newTotal += (d.earned || 0);
      if (d.status === 'skipped') newSkipped++;
      else if (d.earned > 0) newCorrect++;
      else if (d.earned < 0) newWrong++;
      else { if (d.q.type === 'subjective') newSkipped++; else newWrong++; }
    });
    newSub.score = Number(newTotal.toFixed(2)); newSub.correct = newCorrect; newSub.wrong = newWrong; newSub.skipped = newSkipped;

    try {
      let updatedTest = { ...selectedTest };
      updatedTest.submissions[evaluateSub.sIdx] = newSub;
      
      await updateTestGlobal(updatedTest);
      setEvaluateSub({ ...evaluateSub, sub: newSub });
      
      setModalType(null); setEvalOverrides({}); setAuditReason('');
      setSysAlert({ title: 'Saved', msg: 'Marks & Audit Log securely recorded.', type: 'success' });
    } catch (e) { setSysAlert({ title: 'Error', msg: 'Failed to save evaluation.', type: 'error' }); }
  };

 // 🔥 THE BULLETPROOF MAGIC RECALCULATE ENGINE (Fixed Skipped Logic)
  const triggerMagicRecalculate = async () => {
    let updatedTest = { ...selectedTest };
    if (!updatedTest.submissions || updatedTest.submissions.length === 0) {
      setSysAlert({ title: 'Empty', msg: 'No submissions to fix yet!', type: 'warning' });
      return;
    }

    const neg = Math.abs(Number(updatedTest.negMarking || 0));

    updatedTest.submissions.forEach(sub => {
      let newScore = 0, newCorrect = 0, newWrong = 0, newSkipped = 0;
      
      sub.details.forEach(d => {
        let q = d.q; 
        let ans = d.ans || {};
        let val = ans.val;

        // 🔥 ASLI SKIPPED CHECK: null, undefined, khali string, -1, ya khali array = SKIPPED!
        let isSkipped = val === null || val === undefined || val === '' || val === -1 || (Array.isArray(val) && val.length === 0);

        if (isSkipped) {
          d.status = 'skipped'; 
          d.earned = 0; 
          newSkipped++;
        } else if (q.type === 'mcq') {
          if (val === q.correct[0]) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; }
          else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
        } else if (q.type === 'msq') {
          let userSel = Array.isArray(val) ? val : []; let corrSel = q.correct || [];
          let hasWrongOption = userSel.some(x => !corrSel.includes(x)); 
          let correctlySelected = userSel.filter(x => corrSel.includes(x)).length;
          
          if (hasWrongOption) { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
          else if (correctlySelected === corrSel.length) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; }
          else if (correctlySelected > 0) { let partialMarks = (q.marks / corrSel.length) * correctlySelected; d.earned = Math.round(partialMarks * 100) / 100; newScore += d.earned; newCorrect++; d.status = 'partial'; }
          else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
        } else if (q.type === 'integer') {
          if (val === q.correctInt || String(val) === String(q.correctInt)) { newCorrect++; d.earned = q.marks; newScore += q.marks; d.status = 'correct'; }
          else { newWrong++; d.earned = -neg; newScore -= neg; d.status = 'wrong'; }
        } else { d.status = 'submitted'; d.earned = 0; newSkipped++; }
      });
      sub.score = Number(newScore.toFixed(2)); sub.correct = newCorrect; sub.wrong = newWrong; sub.skipped = newSkipped;
    });

    try {
      await updateTestGlobal(updatedTest);
      setSysAlert({ title: 'System Restored!', msg: `Skipped questions fixed! Scores recalculated for ${updatedTest.submissions.length} students.`, type: 'success' });
    } catch (e) { setSysAlert({ title: 'Error', msg: 'Failed to recalculate scores.', type: 'error' }); }
  };

  const getLabel = (type) => ({ mcq: 'Single Correct', msq: 'Multi Correct', integer: 'Integer Type', subjective: 'Subjective' }[type] || type);

  return (
    <>
      {evaluateSub ? (
        // ==========================================
        // VIEW 3: EVALUATE PAPER
        // ==========================================
        <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
          
          <div style={{ position: 'sticky', top: '70px', background: '#fff', zIndex: 90, padding: '15px 0', borderBottom: '1px solid var(--color-border-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* 🔥 FIX: setEvalSectionFilter reset added here */}
              <button className="btn btn-ghost" style={{ fontWeight: 600, padding: 0 }} onClick={() => { setEvaluateSub(null); setEvalOverrides({}); setEvalSectionFilter('all_sections'); }}><i className="ti ti-arrow-left"></i> Back to Submissions</button>
              <button className="btn btn-success" style={{ fontWeight: 600 }} onClick={() => setModalType('audit')}><i className="ti ti-device-floppy"></i> Save Evaluation</button>
          </div>

          <div className="result-hero" style={{ background: '#114B87', borderRadius: '12px', padding: '2rem 1.5rem', textAlign: 'center', color: '#fff', margin: '1.5rem 0', boxShadow: '0 10px 25px rgba(24,95,165,0.2)' }}>
              <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Evaluating Paper: {evaluateSub.test.title}</div>
              <div style={{ fontSize: '26px', fontWeight: 700, marginBottom: '0.25rem' }}>{evaluateSub.sub.name} {evaluateSub.sub.roll ? '• ' + evaluateSub.sub.roll : ''}</div>
              <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '1.5rem' }}>Submitted on: {evaluateSub.sub.time}</div>
              
             <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', width: '130px', height: '130px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', margin: '0 auto 1rem', border: '4px solid rgba(255,255,255,0.2)' }}>
                  <div style={{ fontSize: '42px', fontWeight: 700, marginBottom: '4px', lineHeight: 1 }}>{evaluateSub.sub.score}</div>
                  <div style={{ fontSize: '14px', opacity: 0.9, fontWeight: 600 }}>/ {evaluateSub.test.totalMarks}</div>
              </div>
              {/* 🔥 FIX: Centered Premium Percentage Badge */}
              <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.25)', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', letterSpacing: '0.5px' }}>
                      <i className="ti ti-target"></i> {((evaluateSub.sub.score / evaluateSub.test.totalMarks) * 100).toFixed(1)}% Accuracy
                  </div>
              </div>
          </div>

          <div className="grid4" style={{ marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ color: '#185FA5', fontSize: '28px', fontWeight: 700 }}>{evaluateSub.sub.score}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginTop: '6px' }}>Total Score</div>
              </div>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ color: '#3B6D11', fontSize: '28px', fontWeight: 700 }}>{evaluateSub.sub.correct}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginTop: '6px' }}>Correct</div>
              </div>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ color: '#A32D2D', fontSize: '28px', fontWeight: 700 }}>{evaluateSub.sub.wrong}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginTop: '6px' }}>Incorrect</div>
              </div>
              <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: 0 }}>
                  <div style={{ color: '#64748b', fontSize: '28px', fontWeight: 700 }}>{evaluateSub.sub.skipped}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginTop: '6px' }}>Pending / Skipped</div>
              </div>
          </div>

          {/* 🔥 NAYA: Performance Overview Graph */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '16px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-chart-donut"></i> Performance Breakdown
              </h3>
              
              <div style={{ display: 'flex', height: '16px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', background: '#f1f5f9' }}>
                  <div style={{ width: `${(evaluateSub.sub.correct / evaluateSub.test.questions.length) * 100}%`, background: '#10B981', transition: 'width 1s ease' }}></div>
                  <div style={{ width: `${(evaluateSub.sub.wrong / evaluateSub.test.questions.length) * 100}%`, background: '#EF4444', transition: 'width 1s ease' }}></div>
                  <div style={{ width: `${(evaluateSub.sub.skipped / evaluateSub.test.questions.length) * 100}%`, background: '#94A3B8', transition: 'width 1s ease' }}></div>
              </div>
              <div style={{ display: 'flex', gap: '15px', fontSize: '13px', fontWeight: 600, color: '#64748b', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: '#10B981', borderRadius: '50%' }}></span> {Math.round((evaluateSub.sub.correct / evaluateSub.test.questions.length) * 100)}% Correct</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: '#EF4444', borderRadius: '50%' }}></span> {Math.round((evaluateSub.sub.wrong / evaluateSub.test.questions.length) * 100)}% Incorrect</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', background: '#94A3B8', borderRadius: '50%' }}></span> {Math.round((evaluateSub.sub.skipped / evaluateSub.test.questions.length) * 100)}% Skipped</div>
              </div>
          </div>

          {/* 🔥 FIX: Integrity & Time Analytics Box (With Ultimate Data Catcher) */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b', background: '#FEF5E5' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '16px', color: '#854F0B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ti ti-shield-half-filled"></i> Integrity & Session Analytics
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ fontSize: '13px', color: '#b45309', marginBottom: '6px', fontWeight: 600 }}>Total Time Taken</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#854f0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="ti ti-clock"></i>
                        {evaluateSub.sub.timeTaken ? evaluateSub.sub.timeTaken : <span style={{fontSize: '14px', color: '#b45309', fontWeight: 500}}>Not Tracked (Old Paper)</span>}
                      </div>
                  </div>
                  
                  <div style={{ flex: 2, minWidth: '250px' }}>
                      <div style={{ fontSize: '13px', color: '#b45309', marginBottom: '6px', fontWeight: 600 }}>Proctoring Alerts / Logs</div>
                      {(() => {
                          // 🔥 ULTIMATE FALLBACK: Har possible naam check karo jisme student ne logs save kiye ho
                           const logs = evaluateSub.sub.cheatLogs || evaluateSub.sub.antiCheatLogs || evaluateSub.sub.logs || evaluateSub.sub.events || evaluateSub.sub.warnings || [];                          if (logs.length > 0) {
                              return (
                                  <div style={{ maxHeight: '120px', overflowY: 'auto', background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                                      {logs.map((log, idx) => (
                                          <div key={idx} style={{ fontSize: '13px', color: '#991b1b', marginBottom: '6px', display: 'flex', gap: '6px' }}>
                                              <i className="ti ti-alert-triangle" style={{ marginTop: '2px' }}></i> 
                                              <span>{typeof log === 'string' ? log : log.msg || log.type || log.event || JSON.stringify(log)}</span>
                                          </div>
                                      ))}
                                  </div>
                              );
                          } else {
                              return (
                                  <div style={{ fontSize: '14px', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', background: '#dcfce7', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                      <i className="ti ti-check"></i> No suspicious activity detected. All clear.
                                  </div>
                              );
                          }
                      })()}
                  </div>
              </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-secondary)' }}>              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Question-wise Analysis</h3>
                  {(() => {
                      // 🔥 DYNAMIC COUNT CALCULATION BASED ON ACTIVE SECTION (EXAMINER)
                      const secDetails = evaluateSub.sub.details.filter(d => evalSectionFilter === 'all_sections' || d.q.section === evalSectionFilter || (!d.q.section && evalSectionFilter === (evaluateSub.test.sections?.[0])));
                      const countAll = secDetails.length;
                      const countCorrect = secDetails.filter(d => d.status === 'correct' || d.status === 'partial').length;
                      const countWrong = secDetails.filter(d => d.status === 'wrong').length;
                      const countSkipped = secDetails.filter(d => d.status === 'skipped' || d.status === 'submitted' || d.status === 'evaluated').length;

                      return (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button className="btn btn-sm" style={{ background: evalFilter === 'all' ? '#185FA5' : '#fff', color: evalFilter === 'all' ? '#fff' : '#64748b', border: evalFilter === 'all' ? 'none' : '1px solid #cbd5e1', borderRadius: '20px', padding: '6px 16px', fontWeight: 600 }} onClick={() => setEvalFilter('all')}>All ({countAll})</button>
                              <button className="btn btn-sm" style={{ background: evalFilter === 'correct' ? '#fff' : '#fff', color: evalFilter === 'correct' ? '#3B6D11' : '#64748b', border: `1px solid ${evalFilter === 'correct' ? '#3B6D11' : '#cbd5e1'}`, borderRadius: '20px', padding: '6px 16px', fontWeight: 600 }} onClick={() => setEvalFilter('correct')}>Correct ({countCorrect})</button>
                              <button className="btn btn-sm" style={{ background: evalFilter === 'wrong' ? '#fff' : '#fff', color: evalFilter === 'wrong' ? '#A32D2D' : '#64748b', border: `1px solid ${evalFilter === 'wrong' ? '#A32D2D' : '#cbd5e1'}`, borderRadius: '20px', padding: '6px 16px', fontWeight: 600 }} onClick={() => setEvalFilter('wrong')}>Wrong ({countWrong})</button>
                              <button className="btn btn-sm" style={{ background: evalFilter === 'skipped' ? '#fff' : '#fff', color: evalFilter === 'skipped' ? '#64748b' : '#64748b', border: `1px solid ${evalFilter === 'skipped' ? '#94a3b8' : '#cbd5e1'}`, borderRadius: '20px', padding: '6px 16px', fontWeight: 600 }} onClick={() => setEvalFilter('skipped')}>Pending/Skipped ({countSkipped})</button>
                          </div>
                      );
                  })()}
              </div>

              {/* 🔥 NEW: Section Scrollable Pill Menu for Examiner */}
              {evaluateSub.test.sections && evaluateSub.test.sections.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
                      <button 
                          className="btn btn-sm" 
                          style={{ whiteSpace: 'nowrap', fontWeight: 600, background: evalSectionFilter === 'all_sections' ? '#185FA5' : '#f1f5f9', color: evalSectionFilter === 'all_sections' ? '#fff' : '#64748b', border: 'none', borderRadius: '20px', padding: '6px 16px' }} 
                          onClick={() => setEvalSectionFilter('all_sections')}
                      >
                          All Sections
                      </button>
                      {evaluateSub.test.sections.map((sec, idx) => (
                          <button 
                              key={idx} 
                              className="btn btn-sm" 
                              style={{ whiteSpace: 'nowrap', fontWeight: 600, background: evalSectionFilter === sec ? '#185FA5' : '#f1f5f9', color: evalSectionFilter === sec ? '#fff' : '#64748b', border: 'none', borderRadius: '20px', padding: '6px 16px' }} 
                              onClick={() => setEvalSectionFilter(sec)}
                          >
                              {sec}
                          </button>
                      ))}
                  </div>
              )}
          </div>

          {evaluateSub.sub.details.filter(d => {
              // 🔥 Dono conditions (Status aur Section) match honi chahiye
              let sMatch = evalFilter === 'all' || d.status === evalFilter || (evalFilter === 'skipped' && (d.status === 'submitted' || d.status === 'evaluated'));
              let secMatch = evalSectionFilter === 'all_sections' || d.q.section === evalSectionFilter || (!d.q.section && evalSectionFilter === (evaluateSub.test.sections?.[0]));
              return sMatch && secMatch;
          }).map((d, index) => {
              const originalQIdx = evaluateSub.sub.details.indexOf(d);
              const q = d.q;
              const ans = d.ans;
              let userSel = Array.isArray(ans.val) ? ans.val : (ans.val !== null ? [ans.val] : []);
              let corrSel = q.correct || [];

              return (
                  <div key={originalQIdx} className="q-review-card" style={{ marginBottom: '1.5rem', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                      <div className="qr-header" style={{ background: d.status === 'evaluated' ? '#EEEDFE' : 'var(--color-background-secondary)' }}>
                          <i className="ti ti-pencil" style={{ fontSize: '20px', color: '#185FA5' }}></i>
                          <span style={{ fontWeight: 600, fontSize: '15px' }}>Q{originalQIdx + 1} &mdash; {getLabel(q.type)}</span>
                          <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 600 }}>Earned: {d.earned || 0} / {q.marks}</span>
                      </div>
                      
                      {/* 🔥 OVERFLOW FIX: Strict maxWidth aur hide-scroll laga diya */}
                      <div className="qr-body hide-scroll" style={{ maxWidth: '100%', overflowX: 'auto', minWidth: 0 }}>
                         
                         {/* 🔥 TEXT OVERFLOW FIX: wordBreak aur whiteSpace laga diya taaki lamba question break ho jaye */}
                         <div style={{ fontSize: '16px', lineHeight: 1.7, marginBottom: '1.25rem', fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%' }} dangerouslySetInnerHTML={{ __html: q.text }}></div>           
                         
                         {/* Universal Hybrid Figure Renderer Wrapper */}
                         <div className="hide-scroll" style={{ maxWidth: '100%', minWidth: 0 }}>
                             <FigureRenderer figureType={q.figureType} figureData={q.figureData} />
                         </div>
                         
                         {/* Fallback for legacy tests that only have imgUrl */}
                         {!q.figureType && q.imgUrl && (
                             <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                                 <img src={q.imgUrl} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)' }} alt="Legacy Question Figure" />
                             </div>
                         )}
                                                   
                          {(q.type === 'mcq' || q.type === 'msq') && q.options.map((o, j) => {
                              let isUser = userSel.includes(j);
                              let isCorr = corrSel.includes(j);
                              let cls = 'neutral', borderStyle = {};
                              if (isCorr && isUser) { cls = 'correct'; borderStyle = { borderColor: '#3B6D11', background: '#EAF3DE' }; }
                              else if (isCorr && !isUser) { cls = 'neutral'; borderStyle = { borderColor: '#C0DD97', background: '#f4f9ed' }; }
                              else if (!isCorr && isUser) { cls = 'wrong'; borderStyle = { borderColor: '#A32D2D', background: '#FCEBEB' }; }

                              return (
                                  // 🔥 FIX 1: hide-scroll and maxWidth added to prevent outer div overflow
                                  <div key={j} className={`qr-opt ${cls} hide-scroll`} style={{ ...borderStyle, maxWidth: '100%' }}>
                                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, flexShrink: 0, background: 'rgba(255,255,255,0.7)' }}>{String.fromCharCode(65 + j)}</div>
                                      
                                      {/* 🔥 FIX 2: minWidth: 0 is CRITICAL for flexbox to allow inner scrolling without expanding the parent */}
                                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', padding: '4px 0', minWidth: 0 }} className="hide-scroll">
                                          
                                          {/* 🔥 FIX 3: Smart SMILES Renderer inside Option */}
                                          {o.startsWith('[smiles]') ? (
                                              <div style={{ pointerEvents: 'none' }}>
                                                  <SmilesViewer smilesCode={o.replace('[smiles]', '').trim()} width={150} height={150} />
                                              </div>
                                          ) : (
                                              <div style={{ fontSize: '15px', fontWeight: isUser || isCorr ? 600 : 400, whiteSpace: 'normal', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: o }}></div>
                                          )}

                                          {(isUser || isCorr) && (
                                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                  {isUser && <span style={{ fontSize: '11px', background: '#185FA5', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Student Picked</span>}
                                                  {isCorr && <span style={{ fontSize: '11px', background: '#3B6D11', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>Correct Key</span>}
                                              </div>
                                          )}
                                      </div>
                                      
                                      {isCorr && isUser && <i className="ti ti-check" style={{ fontSize: '22px', color: '#3B6D11', flexShrink: 0 }}></i>}
                                      {isUser && !isCorr && <i className="ti ti-x" style={{ fontSize: '22px', color: '#A32D2D', flexShrink: 0 }}></i>}
                                  </div>
                              );
                          })}

                          {q.type === 'integer' && (
                              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                  <div className={`qr-opt ${d.status}`} style={{ flex: 1, fontSize: '15px' }}>Student Typed: <strong style={{ fontSize: '18px', marginLeft: '8px' }}>{ans.val !== null ? ans.val : '—'}</strong></div>
                                  <div className="qr-opt correct" style={{ flex: 1, fontSize: '15px' }}>Correct Key: <strong style={{ fontSize: '18px', marginLeft: '8px' }}>{q.correctInt}</strong></div>
                              </div>
                          )}

                          {q.type === 'subjective' && (
                              <div style={{ marginBottom: '1rem' }}>
                                  <div style={{ padding: '1rem', background: 'var(--color-background-tertiary)', borderRadius: '8px', border: '1px solid var(--color-border-secondary)', marginBottom: '1rem' }}>
                                      <strong>Student Answer:</strong><br/><span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ans.val || <em style={{ color: 'var(--color-text-secondary)' }}>No answer provided.</em>}</span>
                                  </div>
                                  {q.modelAnswer && (
                                      <div style={{ padding: '1rem', background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: '8px', color: '#27500A' }}>
                                          <strong>Model Answer (Reference):</strong><br/><span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{q.modelAnswer}</span>
                                      </div>
                                  )}
                              </div>
                          )}

                          {q.explanation && (
                              <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '8px', borderLeft: '4px solid #475569', marginTop: '1.5rem', marginBottom: '1rem' }}>
                                  <strong style={{ color: '#334155', display: 'block', marginBottom: '8px' }}><i className="ti ti-bulb"></i> Correct Explanation / Logic:</strong>
                                  <div className="math-scroll-box" style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                              </div>
                          )}

                          {d.auditLogs && d.auditLogs.length > 0 && (
                              <div style={{ marginTop: '12px', marginBottom: '16px', padding: '10px', background: '#FEF5E5', border: '1px solid #FAC775', borderRadius: '6px', fontSize: '13px', color: '#633806' }}>
                                  <div style={{ fontWeight: 600, marginBottom: '4px' }}><i className="ti ti-shield-check"></i> Past Evaluations</div>
                                  {d.auditLogs.map((log, lIdx) => (
                                      <div key={lIdx} style={{ borderBottom: lIdx !== d.auditLogs.length - 1 ? '1px dashed #FAC775' : 'none', paddingBottom: lIdx !== d.auditLogs.length - 1 ? '6px' : '0', marginBottom: lIdx !== d.auditLogs.length - 1 ? '6px' : '0' }}>
                                          Marks overridden to <strong>{log.awarded}</strong>. Reason: "{log.reason}" <br />
                                          <span style={{ fontSize: '11px', opacity: 0.8 }}>By: {log.examiner} | Date: {log.date}</span>
                                      </div>
                                  ))}
                              </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
                              <div style={{ fontSize: '14px', color: '#185FA5', fontWeight: 600 }}><i className="ti ti-edit"></i> Override / Award Marks:</div>
                              <input 
                                  type="number" 
                                  max={q.marks} 
                                  step="0.25" 
                                  value={evalOverrides[originalQIdx] !== undefined ? evalOverrides[originalQIdx] : (d.earned || 0)} 
                                  onChange={(e) => setEvalOverrides({ ...evalOverrides, [originalQIdx]: e.target.value })} 
                                  style={{ width: '90px', padding: '6px', fontSize: '15px', fontWeight: 'bold', color: '#185FA5', border: '2px solid #185FA5', borderRadius: '6px', textAlign: 'center' }} 
                              />
                              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>/ {q.marks} Max</span>
                          </div>
                      </div>
                  </div>
              );
          })}

          {modalType === 'audit' && (
              <div className="modal-bg" style={{ zIndex: 1000 }}>
                  <div className="modal-box">
                      <h3 style={{ color: '#854F0B', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-shield-check"></i> Evaluation Audit</h3>
                      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>To ensure transparency, please provide a justification for these manual overrides.</p>
                      <label>Reason for changing marks: <span style={{ color: '#A32D2D' }}>*</span></label>
                      <textarea value={auditReason} onChange={e => setAuditReason(e.target.value)} placeholder="e.g., 'Partial marks for correct formula'" style={{ minHeight: '80px', marginBottom: '1.5rem', width: '100%' }}></textarea>
                      <div style={{ display: 'flex', gap: '12px' }}>
                          <button className="btn" style={{ flex: 1 }} onClick={() => setModalType(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEvaluation}><i className="ti ti-lock"></i> Confirm & Save</button>
                      </div>
                  </div>
              </div>
          )}
        </div>

      ) : selectedTest ? (

        // ==========================================
        // VIEW 2: TEST DASHBOARD
        // ==========================================
        <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
          
          <button className="btn btn-ghost" style={{ marginBottom: '1.25rem', padding: 0, fontSize: '15px', color: '#475569', fontWeight: 600 }} onClick={() => setSelectedTest(null)}>
              <i className="ti ti-arrow-left"></i> Back to Vault
          </button>

          <div className="card" style={{ borderTop: '4px solid #185FA5', padding: '1.5rem 2rem', marginBottom: '1.5rem', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                      <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 800 }}>{selectedTest.title}</h2>
                      <p style={{ margin: 0, color: '#475569', fontSize: '15px', fontWeight: 500 }}>
                          Code: <span className="badge b-purple" style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '1px' }}>{selectedTest.code}</span> &nbsp;&bull;&nbsp; {selectedTest.duration} Mins &nbsp;&bull;&nbsp; {selectedTest.totalMarks} Marks
                          {selectedTest.isLocal && <span className="badge b-amber" style={{ marginLeft: '10px' }}><i className="ti ti-device-floppy"></i> Local Data</span>}
                      </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: selectedTest.isActive !== false ? '#d1fae5' : '#f1f5f9', padding: '8px 16px', borderRadius: '30px', fontSize: '14px', fontWeight: 700, color: selectedTest.isActive !== false ? '#065f46' : '#475569', border: `1px solid ${selectedTest.isActive !== false ? '#34d399' : '#cbd5e1'}` }}>
                      {selectedTest.isActive !== false ? <><span style={{ width: '10px', height: '10px', background: '#10B981', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span> Live Accepting</> : <><span style={{ width: '10px', height: '10px', background: '#94a3b8', borderRadius: '50%' }}></span> Intake Locked</>}
                  </div>
              </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', overflowX: 'auto' }}>
              <button className="btn btn-ghost" style={{ fontSize: '15px', fontWeight: 600, color: activeTab === 'overview' ? '#185FA5' : '#64748b', background: activeTab === 'overview' ? '#E6F1FB' : 'transparent', borderRadius: '8px', padding: '10px 20px', whiteSpace: 'nowrap' }} onClick={() => setActiveTab('overview')}><i className="ti ti-dashboard"></i> Overview & Settings</button>
              <button className="btn btn-ghost" style={{ fontSize: '15px', fontWeight: 600, color: activeTab === 'subs' ? '#185FA5' : '#64748b', background: activeTab === 'subs' ? '#E6F1FB' : 'transparent', padding: '10px 20px', whiteSpace: 'nowrap' }} onClick={() => setActiveTab('subs')}><i className="ti ti-users"></i> Submissions <span className="badge b-gray" style={{ marginLeft: '8px' }}>{selectedTest.submissions ? selectedTest.submissions.length : 0}</span></button>
          </div>

          {activeTab === 'overview' && (
              <div className="grid2">
                  <div className="card" style={{ borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-tool" style={{ color: '#185FA5' }}></i> Essential Tools</h3>
                      <div className="grid2" style={{ marginBottom: '1rem' }}>
                          <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600 }} onClick={() => autoJoinLocalTest(selectedTest.code)}><i className="ti ti-player-play text-blue"></i> Demo Test</button>
                          <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600 }} onClick={() => printTestPaper(selectedTest)}><i className="ti ti-printer"></i> Print Paper</button>
                          <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#FAEEDA', color: '#854F0B', borderColor: '#FAC775' }} onClick={openEditKey}><i className="ti ti-key"></i> Edit Key</button>
                          <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#EEEDFE', color: '#3C3489', borderColor: '#CECBF6' }} onClick={() => setModalType('analytics')}><i className="ti ti-chart-pie"></i> Analytics</button>
                      </div>
                      
                      {/* 🔥 FIX 3: Magic Recalculate Button */}
                      <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 700, background: '#FEF5E5', color: '#d97706', borderColor: '#fcd34d', marginBottom: '2rem' }} onClick={triggerMagicRecalculate}>
                          <i className="ti ti-wand"></i> Fix Corrupted Scores (Remove Double-Negative)
                      </button>

                      <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-share" style={{ color: '#10B981' }}></i> 1-Click Share</h3>                      <div className="grid2">
                          <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#dcf8c6', color: '#075e54', border: '1px solid #25d366' }} onClick={() => shareTest(selectedTest, 'whatsapp')}><i className="ti ti-brand-whatsapp" style={{ fontSize: '20px' }}></i> WhatsApp</button>
                          <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#e0f2fe', color: '#0284c7', border: '1px solid #38bdf8' }} onClick={() => shareTest(selectedTest, 'telegram')}><i className="ti ti-brand-telegram" style={{ fontSize: '20px' }}></i> Telegram</button>
                      </div>
                  </div>

                  <div className="card" style={{ borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-settings" style={{ color: '#64748b' }}></i> Access Controls</h3>
                      <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px', marginBottom: '12px', background: selectedTest.isActive !== false ? '#FCEBEB' : '#EAF3DE', color: selectedTest.isActive !== false ? '#A32D2D' : '#3B6D11', borderColor: selectedTest.isActive !== false ? '#A32D2D' : '#3B6D11', fontWeight: 700 }} onClick={() => toggleTestStatus(selectedTest)}>
                          <i className={`ti ${selectedTest.isActive !== false ? 'ti-lock' : 'ti-door-enter'}`}></i> {selectedTest.isActive !== false ? 'Close Exam Intake' : 'Open Exam Intake'}
                      </button>
                      
                      {!selectedTest.released && selectedTest.resultVis === 'manual' && (
                          <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 600, marginBottom: '12px' }} onClick={() => publishResults(selectedTest)}>
                              <i className="ti ti-send"></i> Publish Results Manually
                          </button>
                      )}
                      
                      <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px dashed #F7C1C1' }}>
                          <h3 style={{ fontSize: '16px', color: '#A32D2D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-alert-triangle"></i> Danger Zone</h3>
                          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '15px' }}>Deleting a test is irreversible. All associated student submissions and analytics will be permanently erased.</p>
                          <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 600 }} onClick={() => triggerDelete(selectedTest)}><i className="ti ti-trash"></i> Delete Entire Test</button>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'subs' && (
              <div className="card" style={{ padding: '2rem 1rem', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Submissions Ledger</h3>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
                          <button className="btn btn-success" style={{ padding: '10px 16px', fontWeight: 600, borderRadius: '8px', flexGrow: 1, justifyContent: 'center' }} onClick={() => exportToCSV(selectedTest)}><i className="ti ti-file-spreadsheet"></i> Export CSV</button>
                          <div style={{ position: 'relative', flexGrow: 2, minWidth: '200px' }}>
                              <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '18px' }}></i>
                              <input type="text" placeholder="Search by Name or Roll No..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 10px 10px 40px', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', boxSizing: 'border-box' }} />
                          </div>
                      </div>
                  </div>

                  {(!selectedTest.submissions || selectedTest.submissions.length === 0) ? (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                          <i className="ti ti-ghost" style={{ fontSize: '48px', color: '#cbd5e1', display: 'block', marginBottom: '1rem' }}></i>
                          <h4 style={{ color: '#475569', marginBottom: '5px' }}>No Submissions Found</h4>
                          <p style={{ color: '#94a3b8', fontSize: '14px' }}>Wait for students to complete the test.</p>
                      </div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
                          {(searchQuery ? selectedTest.submissions.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.roll && s.roll.toLowerCase().includes(searchQuery.toLowerCase()))) : selectedTest.submissions).map((s, sIdx) => (
                              <div key={sIdx} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
                                  
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '150px' }}>
                                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>{(s.name || 'A').charAt(0).toUpperCase()}</div>
                                      <div style={{ overflow: 'hidden' }}>
                                          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{s.name}</div>
                                          <div style={{ fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>Roll: {s.roll || 'N/A'}</div>
                                      </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', flexGrow: 1, justifyContent: 'flex-end' }}>
                                      {s.evaluated || selectedTest.resultVis === 'instant' ? (
                                          <div style={{ textAlign: 'right' }}><div style={{ fontSize: '18px', fontWeight: 800, color: '#185FA5' }}>{s.score} <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>/ {selectedTest.totalMarks}</span></div><div style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>Evaluated</div></div>
                                      ) : (
                                          <div style={{ textAlign: 'right' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b', marginBottom: '2px' }}><i className="ti ti-clock"></i> Pending</div><div style={{ fontSize: '11px', color: '#94a3b8' }}>Needs Check</div></div>
                                      )}
                                      <button className="btn btn-primary" style={{ padding: '8px 14px', fontWeight: 600, borderRadius: '8px', whiteSpace: 'nowrap' }} onClick={() => { setEvaluateSub({ sub: s, test: selectedTest, sIdx }); setEvalFilter('all'); }}><i className="ti ti-eye"></i> Evaluate</button>
                                  </div>

                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {/* MODALS INLINE */}
          {modalType === 'editKey' && (
              <div className="modal-bg" style={{ zIndex: 1000 }}>
                  <div className="modal-box" style={{ maxWidth: '800px' }}>
                      <h3 style={{ marginBottom: '1rem', color: '#185FA5', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-key"></i> Smart Key Update</h3>
                      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>Fix any wrong answers in your key below. When you save, all <strong>{selectedTest.submissions?.length || 0}</strong> existing student submissions will be automatically re-graded instantly.</p>
                      
                      <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: '10px', marginBottom: '1.5rem' }}>
                          {tempQuestions.map((q, i) => (
                              <div key={i} style={{ marginBottom: '1.25rem', padding: '12px', border: '1px solid var(--color-border-secondary)', borderRadius: '8px', background: 'var(--color-background-secondary)' }}>
                                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>Q{i + 1}: {q.text}</div>
                                  
                                  {q.type === 'mcq' && (
                                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                          {q.options.map((opt, j) => (
                                              <label key={j} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                                  <input type="radio" name={`rekey_${i}`} checked={(q.correct || []).includes(j)} onChange={() => handleRekeyChange(i, 'mcq', j)} style={{ width: '16px', height: '16px' }} />
                                                  Opt {String.fromCharCode(65 + j)}
                                              </label>
                                          ))}
                                      </div>
                                  )}
                                  
                                  {q.type === 'msq' && (
                                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                          {q.options.map((opt, j) => (
                                              <label key={j} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                                  <input type="checkbox" checked={(q.correct || []).includes(j)} onChange={() => handleRekeyChange(i, 'msq', j)} style={{ width: '16px', height: '16px' }} />
                                                  Opt {String.fromCharCode(65 + j)}
                                              </label>
                                          ))}
                                      </div>
                                  )}

                                  {q.type === 'integer' && (
                                      <label style={{ fontSize: '13px', fontWeight: 500 }}>Correct Integer Key: 
                                          <input type="number" value={q.correctInt || ''} onChange={e => handleRekeyChange(i, 'integer', Number(e.target.value))} style={{ width: '100px', padding: '6px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '4px', marginLeft: '8px' }} />
                                      </label>
                                  )}

                                  {q.type === 'subjective' && (
                                      <div style={{ fontSize: '12px', color: '#854F0B', fontWeight: 500 }}><i className="ti ti-info-circle"></i> Subjective question (Requires manual evaluation).</div>
                                  )}
                              </div>
                          ))}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                          <button className="btn" style={{ flex: 1, padding: '12px', fontWeight: 600 }} onClick={() => setModalType(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{ flex: 2, background: '#854F0B', borderColor: '#854F0B', padding: '12px', fontWeight: 600 }} onClick={saveNewKeyAndReevaluate}><i className="ti ti-refresh"></i> Update & Auto-Grade All</button>
                      </div>
                  </div>
              </div>
          )}

          {/* Custom CSS Bell Curve & Analytics */}
          {modalType === 'analytics' && (
              <div className="modal-bg" style={{ zIndex: 1000 }}>
                  <div className="modal-box" style={{ maxWidth: '900px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                          <h3 style={{ color: '#185FA5', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-chart-bar" style={{ fontSize: '24px' }}></i> Class Analytics</h3>
                          <button className="btn btn-sm" onClick={() => setModalType(null)}>Close</button>
                      </div>
                      
                      {(() => {
                          if (!selectedTest.submissions || selectedTest.submissions.length === 0) return <p>Not enough data! At least 1 student must submit.</p>;
                          
                          const totalStudents = selectedTest.submissions.length;
                          const scores = selectedTest.submissions.map(s => s.score);
                          const maxScore = Math.max(...scores);
                          const minScore = Math.min(...scores);
                          const avgScore = (scores.reduce((a, b) => a + b, 0) / totalStudents).toFixed(2);
                          const passRate = Math.round((selectedTest.submissions.filter(s => (s.score / selectedTest.totalMarks) >= 0.33).length / totalStudents) * 100);

                          let qStats = selectedTest.questions.map((q, i) => ({ qIndex: i, text: q.text, wrongCount: 0, correctCount: 0 }));
                          selectedTest.submissions.forEach(sub => { sub.details.forEach((d, i) => { if (d.status === 'wrong') qStats[i].wrongCount++; else if (d.status === 'correct') qStats[i].correctCount++; }); });

                          const toughestQs = [...qStats].sort((a, b) => b.wrongCount - a.wrongCount).slice(0, 3);
                          const easiestQs = [...qStats].sort((a, b) => b.correctCount - a.correctCount).slice(0, 3);

                          let brackets = [0, 0, 0, 0];
                          scores.forEach(s => {
                              let pct = (s / selectedTest.totalMarks) * 100;
                              if (pct <= 25) brackets[0]++; else if (pct <= 50) brackets[1]++; else if (pct <= 75) brackets[2]++; else brackets[3]++;
                          });
                          const maxBracket = Math.max(...brackets, 1);

                          return (
                              <>
                                  <div className="grid4" style={{ marginBottom: '2rem' }}>
                                      <div className="stat-card" style={{ borderColor: '#185FA5', padding: '1rem' }}><div className="stat-val" style={{ color: '#185FA5', fontSize: '24px' }}>{avgScore}</div><div className="stat-lbl">Average Score</div></div>
                                      <div className="stat-card" style={{ borderColor: '#3B6D11', padding: '1rem' }}><div className="stat-val" style={{ color: '#3B6D11', fontSize: '24px' }}>{maxScore}</div><div className="stat-lbl">Highest Score</div></div>
                                      <div className="stat-card" style={{ borderColor: '#A32D2D', padding: '1rem' }}><div className="stat-val" style={{ color: '#A32D2D', fontSize: '24px' }}>{minScore}</div><div className="stat-lbl">Lowest Score</div></div>
                                      <div className="stat-card" style={{ borderColor: '#854F0B', padding: '1rem' }}><div className="stat-val" style={{ color: '#854F0B', fontSize: '24px' }}>{passRate}%</div><div className="stat-lbl">Class Pass Rate</div></div>
                                  </div>

                                  <div className="grid2">
                                      <div style={{ background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '12px', padding: '1.5rem' }}>
                                          <h4 style={{ marginTop: 0, marginBottom: '15px' }}><i className="ti ti-trending-up"></i> Score Distribution</h4>
                                          <div className="bar-chart" style={{ height: '180px', marginTop: '2rem' }}>
                                              {brackets.map((count, i) => (
                                                  <div key={i} className="bar-col">
                                                      <div className="bar-val" style={{ color: ['#A32D2D', '#854F0B', '#185FA5', '#3B6D11'][i] }}>{count}</div>
                                                      <div className="bar" style={{ height: `${(count / maxBracket) * 120}px`, background: ['#FCEBEB', '#FAEEDA', '#E6F1FB', '#EAF3DE'][i], border: `1px solid ${['#A32D2D', '#854F0B', '#185FA5', '#3B6D11'][i]}` }}></div>
                                                      <div className="bar-lbl" style={{ fontSize: '10px' }}>{['0-25%', '26-50%', '51-75%', '76-100%'][i]}</div>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                      
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                          <div style={{ background: '#FCEBEB', border: '1px solid #F7C1C1', borderRadius: '12px', padding: '1rem' }}>
                                              <h4 style={{ marginTop: 0, color: '#A32D2D', fontSize: '14px', marginBottom: '8px' }}><i className="ti ti-alert-triangle"></i> Toughest (Max Mistakes)</h4>
                                              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#791F1F' }}>
                                                  {toughestQs.map(q => <li key={q.qIndex} style={{ marginBottom: '6px' }}><strong>Q{q.qIndex + 1}:</strong> {q.text.substring(0, 35)}... <br/><span className="badge b-red" style={{ fontSize: '10px', marginTop: '4px' }}>Failed by {q.wrongCount} students</span></li>)}
                                              </ul>
                                          </div>
                                          <div style={{ background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: '12px', padding: '1rem' }}>
                                              <h4 style={{ marginTop: 0, color: '#27500A', fontSize: '14px', marginBottom: '8px' }}><i className="ti ti-award"></i> Easiest (Most Correct)</h4>
                                              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#27500A' }}>
                                                  {easiestQs.map(q => <li key={q.qIndex} style={{ marginBottom: '6px' }}><strong>Q{q.qIndex + 1}:</strong> {q.text.substring(0, 35)}... <br/><span className="badge b-green" style={{ fontSize: '10px', marginTop: '4px' }}>Solved by {q.correctCount} students</span></li>)}
                                              </ul>
                                          </div>
                                      </div>
                                  </div>
                              </>
                          );
                      })()}
                  </div>
              </div>
          )}

        </div>

      ) : (
        // ==========================================
        // VIEW 1: MASTER VAULT (List of Tests)
        // ==========================================
        <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
                <div className="page-title">My Tests Vault</div>
                <div className="page-sub">Manage your assessments, control intakes, and review results.</div>
            </div>

            {myTests.length === 0 ? (
                /* 🔥 PROPER EMPTY STATE UI (Jab ek bhi test na banaya ho) */
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-h-[350px]">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-5">
                        <i className="ti ti-folder-off text-4xl text-slate-400"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Your Vault is Empty</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
                        You haven't created any assessments yet. Click the button below to start building your first secure test.
                    </p>
                    <button 
                        className="btn btn-primary" 
                        style={{ padding: '12px 24px', fontWeight: 600, fontSize: '15px' }} 
                        onClick={() => router.push('/create')}
                    >
                        <i className="ti ti-plus"></i> Create New Test
                    </button>
                </div>
            ) : (
                <>
                    {/* 🔥 SEARCH & SORT CONTROL PANEL */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
                        {/* Instant Word Search */}
                        <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
                            <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '18px' }}></i>
                            <input 
                                type="text" 
                                placeholder="Search test name, code, or subject..." 
                                value={vaultSearchQuery}
                                onChange={(e) => setVaultSearchQuery(e.target.value)}
                                style={{ padding: '12px 12px 12px 40px', width: '100%', borderRadius: '10px', border: '1px solid var(--color-border-primary)', background: 'var(--color-background-primary)', fontSize: '15px' }}
                            />
                        </div>
                        
                        {/* Premium Sorting Dropdown */}
                        <div style={{ position: 'relative', minWidth: '160px' }}>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{ padding: '12px 36px 12px 16px', width: '100%', borderRadius: '10px', border: '1px solid var(--color-border-primary)', background: 'var(--color-background-primary)', fontSize: '14px', fontWeight: 600, appearance: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="alphabetical">Name (A - Z)</option>
                            </select>
                            <i className="ti ti-sort-descending" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}></i>
                        </div>
                    </div>

                    {/* 🔥 FILTERING, SORTING & RENDERING ENGINE */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {(() => {
                            // 1. Filter by Search Query
                            let filtered = myTests.filter(t => {
                                if (!vaultSearchQuery) return true;
                                const sq = vaultSearchQuery.toLowerCase();
                                return (t.title?.toLowerCase().includes(sq) || t.code?.toLowerCase().includes(sq) || t.subject?.toLowerCase().includes(sq));
                            });

                            // 2. 🔥 THE FIX: Bulletproof Sort Logic (Prevents TypeErrors on Numbers)
                            filtered.sort((a, b) => {
                                // String() laga diya taaki agar id number ho toh bhi localeCompare crash na kare
                                const idA = String(a.id || '');
                                const idB = String(b.id || '');
                                
                                if (sortBy === 'newest') return idB.localeCompare(idA); 
                                if (sortBy === 'oldest') return idA.localeCompare(idB); 
                                if (sortBy === 'alphabetical') {
                                    return String(a.title || '').toLowerCase().localeCompare(String(b.title || '').toLowerCase());
                                }
                                return 0;
                            });
                            // 3. No Results Found UI
                            if (filtered.length === 0) {
                                return (
                                    <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--color-background-primary)', borderRadius: '12px', border: '1px solid var(--color-border-secondary)' }}>
                                        <i className="ti ti-search-off" style={{ fontSize: '48px', color: '#cbd5e1', display: 'block', marginBottom: '1rem' }}></i>
                                        <h4 style={{ color: '#475569', marginBottom: '5px', fontSize: '18px' }}>No tests found</h4>
                                        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '1rem' }}>We couldn't find any tests matching "{vaultSearchQuery}".</p>
                                        <button className="btn btn-ghost" onClick={() => setVaultSearchQuery('')}>Clear Search</button>
                                    </div>
                                );
                            }

                            // 4. Render Sorted & Filtered Cards
                            return filtered.map((t, i) => {
                                const isLive = t.isActive !== false;
                                const subCount = t.submissions ? t.submissions.length : 0;
                                
                                return (
                                    <div 
                                        key={t.id || i} 
                                        className="test-entry" 
                                        style={{ 
                                            cursor: 'pointer', 
                                            borderLeft: t.isLocal ? '4px solid #f59e0b' : (isLive ? '4px solid #3B6D11' : '4px solid #cbd5e1'),
                                            opacity: 0,
                                            animation: `staggerSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                                            animationDelay: `${(i > 10 ? 10 : i) * 0.06}s`, // Max delay cap for performance
                                            padding: '1.25rem 1rem', // 🔥 Compact Mobile Padding
                                            marginBottom: 0,
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}
                                        onClick={() => setSelectedTest(t)}
                                    >
                                        <div style={{ flex: 1, minWidth: '220px' }}> 
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>{t.title}</h3>
                                                
                                                {t.isLocal && <span className="badge b-amber" style={{ padding: '2px 8px', fontSize: '11px' }}><i className="ti ti-device-floppy"></i> Local</span>}
                                                
                                                {isLive && !t.isLocal ? (
                                                    <span className="badge b-green" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '11px' }}>
                                                        <span style={{ width: '6px', height: '6px', background: '#27500A', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span> Live
                                                    </span>
                                                ) : (!t.isLocal && (
                                                    <span className="badge b-gray" style={{ padding: '2px 8px', fontSize: '11px' }}>Closed</span>
                                                ))}
                                            </div>
                                            
                                            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500, display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-book text-base"></i> {t.subject || 'General'}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-list-numbers text-base"></i> {t.questions?.length || 0} Qs</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-clock text-base"></i> {t.duration} Mins</span>
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                <span className="badge b-purple" style={{ fontFamily: 'monospace', letterSpacing: '0.5px', padding: '4px 10px', fontSize: '12px' }}><i className="ti ti-hash text-base"></i> {t.code}</span>
                                                <span className="badge b-gray" style={{ padding: '4px 10px', fontSize: '12px' }}><i className="ti ti-users text-base"></i> {subCount} Subs</span>
                                            </div>
                                        </div>
                                        
                                        <div className="hide-mobile" style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <i className="ti ti-chevron-right" style={{ fontSize: '20px' }}></i>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </>
            )}
        </div>
      )}

      {/* 🔥 ROOT LEVEL SYSTEM POPUPS */}
      
      {undoData && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', background: '#334155', color: '#fff', padding: '16px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 9999, animation: 'slideUp 0.3s ease' }}>
              <div><i className="ti ti-trash"></i> Test moved to trash.</div>
              <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 700 }} onClick={handleUndo}>UNDO</button>
          </div>
      )}

      {sysAlert && (
          <div className="modal-bg" style={{ zIndex: 9999 }}>
              <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', background: sysAlert.type === 'success' ? '#EAF3DE' : sysAlert.type === 'error' ? '#FCEBEB' : '#FEF5E5', color: sysAlert.type === 'success' ? '#3B6D11' : sysAlert.type === 'error' ? '#A32D2D' : '#d97706' }}>
                      <i className={`ti ${sysAlert.type === 'success' ? 'ti-check' : sysAlert.type === 'error' ? 'ti-x' : 'ti-alert-triangle'}`}></i>
                  </div>
                  <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>{sysAlert.title}</h3>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>{sysAlert.msg}</p>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => setSysAlert(null)}>Okay</button>
              </div>
          </div>
      )}

      {sysConfirm && (
          <div className="modal-bg" style={{ zIndex: 9999 }}>
              <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', background: '#FCEBEB', color: '#A32D2D' }}>
                      <i className="ti ti-alert-circle"></i>
                  </div>
                  <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>{sysConfirm.title}</h3>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>{sysConfirm.msg}</p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={() => setSysConfirm(null)}>Cancel</button>
                      <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={() => { sysConfirm.action(); setSysConfirm(null); }}>Yes, Proceed</button>
                  </div>
              </div>
          </div>
      )}
    </>
  );
}