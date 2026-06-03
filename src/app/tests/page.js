// src/app/tests/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, set, update, remove } from 'firebase/database';

export default function ManageTests() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const { tests, loadingData } = useData();
  const router = useRouter();

  // --- NEW: Local Offline State ---
  const [localTests, setLocalTests] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // --- CORE STATE ---
  const [selectedTest, setSelectedTest] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'subs'
  const [searchQuery, setSearchQuery] = useState('');
  const [undoData, setUndoData] = useState(null); // For Delete Undo timer
  
  // --- MODALS & SUB-VIEWS ---
  const [modalType, setModalType] = useState(null); // 'analytics' | 'editKey' | 'audit'
  const [evaluateSub, setEvaluateSub] = useState(null); // Manual evaluation screen
  
  // --- EDIT KEY & EVALUATION STATE ---
  const [tempQuestions, setTempQuestions] = useState([]);
  const [evalOverrides, setEvalOverrides] = useState({});
  const [auditReason, setAuditReason] = useState('');
  const [evalFilter, setEvalFilter] = useState('all'); 

  // --- SYSTEM POPUP STATES ---
  const [sysAlert, setSysAlert] = useState(null); // { title, msg, type }
  const [sysConfirm, setSysConfirm] = useState(null); // { title, msg, action }

  // 1. Fetch Local Tests and Offline Status on Mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const offlineStatus = localStorage.getItem('isOfflineMode') === 'true';
        setIsOffline(offlineStatus);
        setLocalTests(JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]'));
        setIsMounted(true);
    }
  }, [selectedTest]);

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
    // 100ms delay ensures JSON DOM is fully painted before scanning
    const timer = setTimeout(renderMath, 100);
    return () => clearTimeout(timer);
  }, [selectedTest, evaluateSub, evalFilter, modalType, activeTab]);

  if (authLoading || loadingData || !isMounted) {
    return <div className="spinner-container" style={{ paddingTop: '10vh' }}><div className="spinner"></div><div>Loading Vault...</div></div>;
  }

  // 3. Strict Access Control (Allows Offline Access without Login)
  if (!isOffline && (!currentUser || (userRole !== 'examiner' && userRole !== 'admin'))) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <i className="ti ti-lock" style={{ fontSize: '48px', color: '#A32D2D', marginBottom: '1rem' }}></i>
        <h3>Access Denied</h3>
        <p>Login required for cloud sync. Activate Offline mode from Home to use locally.</p>
        <button className="btn btn-primary" onClick={() => router.push('/')}>Go Home</button>
      </div>
    );
  }

  // 4. Merge Cloud Tests with Local Tests
  const myTests = isOffline 
    ? localTests 
    : [...tests.filter(t => t?.creatorUid === currentUser?.uid), ...localTests];

  // 5. Universal Data Updater (Handles both LocalStorage and Firebase)
  const updateTestGlobal = async (updatedTest) => {
    if (updatedTest.isLocal) {
        let currentLocal = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
        const newLocal = currentLocal.map(x => x.id === updatedTest.id ? updatedTest : x);
        localStorage.setItem('examitop_offline_tests', JSON.stringify(newLocal));
        setLocalTests(newLocal);
        setSelectedTest(updatedTest);
    } else {
        const tIndex = tests.findIndex(x => x.id === updatedTest.id);
        if (tIndex > -1) {
            await update(ref(database, `tests/${tIndex}`), updatedTest);
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

  const triggerDelete = (t) => {
    setSysConfirm({
        title: 'Delete Test?',
        msg: `Are you sure you want to delete "${t.title}"? You will have 5 seconds to undo this action.`,
        action: () => {
            setSelectedTest(null); // Return to vault immediately
            
            // 5-second countdown for actual deletion
            const timeoutId = setTimeout(async () => {
                try {
                    if (t.isLocal) {
                        let currentLocal = JSON.parse(localStorage.getItem('examitop_offline_tests') || '[]');
                        let newLocal = currentLocal.filter(x => x.id !== t.id);
                        localStorage.setItem('examitop_offline_tests', JSON.stringify(newLocal));
                        setLocalTests(newLocal);
                    } else {
                        const newTests = tests.filter(x => x.id !== t.id);
                        await set(ref(database, 'tests'), newTests);
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
    doc.write('<html><head><title>Print: ' + t.title + '</title><script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script></head><body>' + printHtml + '</body></html>');
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus(); iframe.contentWindow.print();
      iframe.contentWindow.onafterprint = () => setTimeout(() => { document.body.removeChild(iframe); }, 1000);
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 60000);
    }, 1500);
  };

  // --- EDIT KEY LOGIC ---
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
      const neg = updatedTest.negMarking || 0;
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

  // --- EVALUATE SUBMISSION LOGIC ---
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

  const getLabel = (type) => ({ mcq: 'Single Correct', msq: 'Multi Correct', integer: 'Integer Type', subjective: 'Subjective' }[type] || type);

  // ==========================================
  // VIEW 3: EVALUATE PAPER (Full Detailed UI)
  // ==========================================
  if (evaluateSub) {
    const { sub, test, sIdx } = evaluateSub;
    const pct = test.totalMarks > 0 ? Math.round((sub.score / test.totalMarks) * 100) : 0;
    const perfText = pct >= 90 ? 'Excellent Score!' : pct >= 75 ? 'Great Job!' : pct >= 50 ? 'Good Effort' : pct >= 35 ? 'Keep Practicing' : 'Needs Improvement';
    const accuracy = sub.correct + sub.wrong > 0 ? Math.round((sub.correct / (sub.correct + sub.wrong)) * 100) : 0;
    const maxH = Math.max(sub.correct, sub.wrong, sub.skipped, 1);
    const bH = (c) => Math.max(16, Math.round((c / maxH) * 120));

    let qTypes = { mcq: { c: 0, w: 0, s: 0, total: 0 }, msq: { c: 0, w: 0, s: 0, total: 0 }, integer: { c: 0, w: 0, s: 0, total: 0 }, subjective: { c: 0, w: 0, s: 0, total: 0 } };
    sub.details.forEach(d => {
        let t = d.q.type;
        if(qTypes[t]) {
            qTypes[t].total++;
            if(d.status === 'correct') qTypes[t].c++;
            else if(d.status === 'wrong') qTypes[t].w++;
            else qTypes[t].s++;
        }
    });

    return (
      <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
        
        <div style={{ position: 'sticky', top: '70px', background: '#fff', zIndex: 90, padding: '15px 0', borderBottom: '1px solid var(--color-border-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn btn-ghost" style={{ fontWeight: 600, padding: 0 }} onClick={() => { setEvaluateSub(null); setEvalOverrides({}); }}><i className="ti ti-arrow-left"></i> Back to Submissions</button>
            <button className="btn btn-success" style={{ fontWeight: 600 }} onClick={() => setModalType('audit')}><i className="ti ti-device-floppy"></i> Save Evaluation</button>
        </div>

        <div className="result-hero" style={{ background: '#114B87', borderRadius: '12px', padding: '2rem 1.5rem', textAlign: 'center', color: '#fff', margin: '1.5rem 0', boxShadow: '0 10px 25px rgba(24,95,165,0.2)' }}>
            <div style={{ fontSize: '14px', opacity: 0.85, marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Evaluating Paper: {test.title}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, marginBottom: '0.25rem' }}>{sub.name} {sub.roll ? '• ' + sub.roll : ''}</div>
            <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '1.5rem' }}>Submitted on: {sub.time}</div>
            
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', width: '130px', height: '130px', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', margin: '0 auto 1.5rem', border: '4px solid rgba(255,255,255,0.2)' }}>
                <div style={{ fontSize: '42px', fontWeight: 700, marginBottom: '4px', lineHeight: 1 }}>{sub.score}</div>
                <div style={{ fontSize: '14px', opacity: 0.9, fontWeight: 600 }}>/ {test.totalMarks}</div>
            </div>
            
            <div>
                <div style={{ fontSize: '16px', fontWeight: 600, background: 'rgba(0,0,0,0.2)', display: 'inline-block', padding: '8px 24px', borderRadius: '30px' }}>
                    {pct}% &bull; {perfText}
                </div>
            </div>
        </div>

        <div className="grid4" style={{ marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: 0 }}>
                <div style={{ color: '#185FA5', fontSize: '28px', fontWeight: 700 }}>{sub.score}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginTop: '6px' }}>Total Score</div>
            </div>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: 0 }}>
                <div style={{ color: '#3B6D11', fontSize: '28px', fontWeight: 700 }}>{sub.correct}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginTop: '6px' }}>Correct</div>
            </div>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: 0 }}>
                <div style={{ color: '#A32D2D', fontSize: '28px', fontWeight: 700 }}>{sub.wrong}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginTop: '6px' }}>Incorrect</div>
            </div>
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: 0 }}>
                <div style={{ color: '#64748b', fontSize: '28px', fontWeight: 700 }}>{sub.skipped}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#64748b', marginTop: '6px' }}>Pending / Skipped</div>
            </div>
        </div>

        <div className="grid2" style={{ marginBottom: '2.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                    <i className="ti ti-chart-pie" style={{ color: '#185FA5', fontSize: '20px' }}></i> Performance Overview
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                    <span>Total Marks Scored</span><span style={{ fontWeight: 700, color: '#1e293b' }}>{sub.score} / {test.totalMarks}</span>
                </div>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '1.25rem', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#185FA5', borderRadius: '4px' }}></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569', marginBottom: '8px' }}>
                    <span>Accuracy (Attempted)</span><span style={{ fontWeight: 700, color: '#1e293b' }}>{accuracy}%</span>
                </div>
                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', marginBottom: '2.5rem', overflow: 'hidden' }}>
                    <div style={{ width: `${accuracy}%`, height: '100%', background: '#3B6D11', borderRadius: '4px' }}></div>
                </div>

                <div style={{ display: 'flex', gap: '8px', height: '140px', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#3B6D11' }}>{sub.correct}</div>
                        <div style={{ width: '100%', background: '#C0DD97', borderRadius: '4px 4px 0 0', height: `${bH(sub.correct)}px` }}></div>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>Correct</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#A32D2D' }}>{sub.wrong}</div>
                        <div style={{ width: '100%', background: '#F7C1C1', borderRadius: '4px 4px 0 0', height: `${bH(sub.wrong)}px` }}></div>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>Wrong</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{sub.skipped}</div>
                        <div style={{ width: '100%', background: '#cbd5e1', borderRadius: '4px 4px 0 0', height: `${bH(sub.skipped)}px` }}></div>
                        <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>Skipped</div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                    <i className="ti ti-list-details" style={{ color: '#185FA5', fontSize: '20px' }}></i> By Question Type
                </div>

                {Object.entries(qTypes).map(([type, stats]) => {
                    if(stats.total === 0) return null;
                    const att = stats.c + stats.w;
                    const attPct = Math.round((att / stats.total) * 100);
                    return (
                        <div key={type} style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#185FA5', fontWeight: 700, marginBottom: '8px' }}>
                                <span>{getLabel(type)}</span>
                                <span style={{ color: '#475569', fontWeight: 600 }}>{stats.c}C &bull; {stats.w}W &bull; {stats.s}S</span>
                            </div>
                            <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${attPct}%`, height: '100%', background: '#185FA5', borderRadius: '2px' }}></div>
                            </div>
                        </div>
                    )
                })}

                <div style={{ marginTop: '2.5rem', fontSize: '13px', color: '#475569', lineHeight: 1.8 }}>
                    Total Attempted: <strong style={{ color: '#1e293b', fontSize: '14px', marginLeft: '6px' }}>{sub.correct + sub.wrong} / {test.questions.length}</strong><br/>
                    Negative Marks: <strong style={{ color: '#A32D2D', fontSize: '14px', marginLeft: '6px' }}>-{(sub.wrong * (test.negMarking || 0)).toFixed(2)}</strong>
                </div>
            </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Question-wise Analysis</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-sm" style={{ background: evalFilter === 'all' ? '#185FA5' : '#fff', color: evalFilter === 'all' ? '#fff' : '#64748b', border: evalFilter === 'all' ? 'none' : '1px solid #cbd5e1', borderRadius: '20px', padding: '6px 16px', fontWeight: 600 }} onClick={() => setEvalFilter('all')}>All ({test.questions.length})</button>
                <button className="btn btn-sm" style={{ background: evalFilter === 'correct' ? '#fff' : '#fff', color: evalFilter === 'correct' ? '#3B6D11' : '#64748b', border: `1px solid ${evalFilter === 'correct' ? '#3B6D11' : '#cbd5e1'}`, borderRadius: '20px', padding: '6px 16px', fontWeight: 600 }} onClick={() => setEvalFilter('correct')}>Correct ({sub.correct})</button>
                <button className="btn btn-sm" style={{ background: evalFilter === 'wrong' ? '#fff' : '#fff', color: evalFilter === 'wrong' ? '#A32D2D' : '#64748b', border: `1px solid ${evalFilter === 'wrong' ? '#A32D2D' : '#cbd5e1'}`, borderRadius: '20px', padding: '6px 16px', fontWeight: 600 }} onClick={() => setEvalFilter('wrong')}>Wrong ({sub.wrong})</button>
                <button className="btn btn-sm" style={{ background: evalFilter === 'skipped' ? '#fff' : '#fff', color: evalFilter === 'skipped' ? '#64748b' : '#64748b', border: `1px solid ${evalFilter === 'skipped' ? '#94a3b8' : '#cbd5e1'}`, borderRadius: '20px', padding: '6px 16px', fontWeight: 600 }} onClick={() => setEvalFilter('skipped')}>Pending/Skipped ({sub.skipped})</button>
            </div>
        </div>

        {sub.details.filter(d => evalFilter === 'all' || d.status === evalFilter || (evalFilter === 'skipped' && (d.status === 'submitted' || d.status === 'evaluated'))).map((d, index) => {
            const originalQIdx = sub.details.indexOf(d);
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
                    
                    <div className="qr-body">
                        <div style={{ fontSize: '16px', lineHeight: 1.7, marginBottom: '1.25rem', fontWeight: 500 }}>{q.text}</div>
                        {q.imgUrl && <div style={{ marginBottom: '1.5rem' }}><img src={q.imgUrl} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)' }} /></div>}
                        
                        {(q.type === 'mcq' || q.type === 'msq') && q.options.map((o, j) => {
                            let isUser = userSel.includes(j);
                            let isCorr = corrSel.includes(j);
                            let cls = 'neutral', borderStyle = {};
                            if (isCorr && isUser) { cls = 'correct'; borderStyle = { borderColor: '#3B6D11', background: '#EAF3DE' }; }
                            else if (isCorr && !isUser) { cls = 'neutral'; borderStyle = { borderColor: '#C0DD97', background: '#f4f9ed' }; }
                            else if (!isCorr && isUser) { cls = 'wrong'; borderStyle = { borderColor: '#A32D2D', background: '#FCEBEB' }; }

                            return (
                                <div key={j} className={`qr-opt ${cls}`} style={borderStyle}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, flexShrink: 0, background: 'rgba(255,255,255,0.7)' }}>{String.fromCharCode(65 + j)}</div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', padding: '4px 0' }}>
                                        <div style={{ fontSize: '15px', fontWeight: isUser || isCorr ? 600 : 400 }}>{o}</div>
                                        {(isUser || isCorr) && (
                                            <div style={{ display: 'flex', gap: '6px' }}>
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
                                {/* Explanation Box for Examiner */}
                             {q.explanation && (
                                 <div style={{ padding: '1rem', background: '#EAF3DE', borderRadius: '8px', borderLeft: '4px solid #3B6D11', marginTop: '1.5rem', marginBottom: '1rem' }}>
                                     <strong style={{ color: '#27500A', display: 'block', marginBottom: '8px' }}><i className="ti ti-bulb"></i> Correct Explanation / Logic:</strong>
                                     <div style={{ fontSize: '14px', color: '#3B6D11', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
                                 </div>
                             )}
                                {q.modelAnswer && (
                                    <div style={{ padding: '1rem', background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: '8px', color: '#27500A' }}>
                                        <strong>Model Answer (Reference):</strong><br/><span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{q.modelAnswer}</span>
                                    </div>
                                )}
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

        {/* Audit Modal */}
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
    );
  }

  // ==========================================
  // VIEW 2: TEST DASHBOARD (Detail View)
  // ==========================================
  if (selectedTest) {
    const isLive = selectedTest.isActive !== false;
    const subCount = selectedTest.submissions ? selectedTest.submissions.length : 0;
    let filteredSubs = selectedTest.submissions || [];
    if (searchQuery) {
        filteredSubs = filteredSubs.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.roll && s.roll.toLowerCase().includes(searchQuery.toLowerCase())));
    }

    return (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isLive ? '#d1fae5' : '#f1f5f9', padding: '8px 16px', borderRadius: '30px', fontSize: '14px', fontWeight: 700, color: isLive ? '#065f46' : '#475569', border: `1px solid ${isLive ? '#34d399' : '#cbd5e1'}` }}>
                    {isLive ? <><span style={{ width: '10px', height: '10px', background: '#10B981', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span> Live Accepting</> : <><span style={{ width: '10px', height: '10px', background: '#94a3b8', borderRadius: '50%' }}></span> Intake Locked</>}
                </div>
            </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', overflowX: 'auto' }}>
            <button className="btn btn-ghost" style={{ fontSize: '15px', fontWeight: 600, color: activeTab === 'overview' ? '#185FA5' : '#64748b', background: activeTab === 'overview' ? '#E6F1FB' : 'transparent', borderRadius: '8px', padding: '10px 20px', whiteSpace: 'nowrap' }} onClick={() => setActiveTab('overview')}><i className="ti ti-dashboard"></i> Overview & Settings</button>
            <button className="btn btn-ghost" style={{ fontSize: '15px', fontWeight: 600, color: activeTab === 'subs' ? '#185FA5' : '#64748b', background: activeTab === 'subs' ? '#E6F1FB' : 'transparent', padding: '10px 20px', whiteSpace: 'nowrap' }} onClick={() => setActiveTab('subs')}><i className="ti ti-users"></i> Submissions <span className="badge b-gray" style={{ marginLeft: '8px' }}>{subCount}</span></button>
        </div>

        {activeTab === 'overview' && (
            <div className="grid2">
                <div className="card" style={{ borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-tool" style={{ color: '#185FA5' }}></i> Essential Tools</h3>
                    <div className="grid2" style={{ marginBottom: '2rem' }}>
                        <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600 }} onClick={() => autoJoinLocalTest(selectedTest.code)}><i className="ti ti-player-play text-blue"></i> Demo Test</button>
                        <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600 }} onClick={() => printTestPaper(selectedTest)}><i className="ti ti-printer"></i> Print Paper</button>
                        <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#FAEEDA', color: '#854F0B', borderColor: '#FAC775' }} onClick={openEditKey}><i className="ti ti-key"></i> Edit Key</button>
                        <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#EEEDFE', color: '#3C3489', borderColor: '#CECBF6' }} onClick={() => setModalType('analytics')}><i className="ti ti-chart-pie"></i> Analytics</button>
                    </div>

                    <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-share" style={{ color: '#10B981' }}></i> 1-Click Share</h3>
                    <div className="grid2">
                        <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#dcf8c6', color: '#075e54', border: '1px solid #25d366' }} onClick={() => shareTest(selectedTest, 'whatsapp')}><i className="ti ti-brand-whatsapp" style={{ fontSize: '20px' }}></i> WhatsApp</button>
                        <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#e0f2fe', color: '#0284c7', border: '1px solid #38bdf8' }} onClick={() => shareTest(selectedTest, 'telegram')}><i className="ti ti-brand-telegram" style={{ fontSize: '20px' }}></i> Telegram</button>
                    </div>
                </div>

                <div className="card" style={{ borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-settings" style={{ color: '#64748b' }}></i> Access Controls</h3>
                    <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px', marginBottom: '12px', background: isLive ? '#FCEBEB' : '#EAF3DE', color: isLive ? '#A32D2D' : '#3B6D11', borderColor: isLive ? '#A32D2D' : '#3B6D11', fontWeight: 700 }} onClick={() => toggleTestStatus(selectedTest)}>
                        <i className={`ti ${isLive ? 'ti-lock' : 'ti-door-enter'}`}></i> {isLive ? 'Close Exam Intake' : 'Open Exam Intake'}
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
            <div className="card" style={{ borderRadius: '12px', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Submissions Ledger</h3>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button className="btn btn-success" style={{ padding: '10px 16px', fontWeight: 600, borderRadius: '8px' }} onClick={() => exportToCSV(selectedTest)}><i className="ti ti-file-spreadsheet"></i> Export CSV</button>
                        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                            <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '18px' }}></i>
                            <input type="text" placeholder="Search by Name or Roll No..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 10px 10px 40px', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }} />
                        </div>
                    </div>
                </div>

                {filteredSubs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <i className="ti ti-ghost" style={{ fontSize: '48px', color: '#cbd5e1', display: 'block', marginBottom: '1rem' }}></i>
                        <h4 style={{ color: '#475569', marginBottom: '5px' }}>No Submissions Found</h4>
                        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Wait for students to complete the test.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
                        {filteredSubs.map((s, sIdx) => (
                            <div key={sIdx} style={{ padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px' }}>{(s.name || 'A').charAt(0).toUpperCase()}</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>{s.name}</div>
                                        <div style={{ fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>Roll: {s.roll || 'N/A'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    {s.evaluated || selectedTest.resultVis === 'instant' ? (
                                        <div style={{ textAlign: 'right' }}><div style={{ fontSize: '18px', fontWeight: 800, color: '#185FA5' }}>{s.score} <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>/ {selectedTest.totalMarks}</span></div><div style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>Evaluated</div></div>
                                    ) : (
                                        <div style={{ textAlign: 'right' }}><div style={{ fontSize: '15px', fontWeight: 700, color: '#f59e0b', marginBottom: '2px' }}><i className="ti ti-clock"></i> Pending</div><div style={{ fontSize: '11px', color: '#94a3b8' }}>Needs Check</div></div>
                                    )}
                                    <button className="btn btn-primary" style={{ padding: '10px 16px', fontWeight: 600, borderRadius: '8px' }} onClick={() => { setEvaluateSub({ sub: s, test: selectedTest, sIdx }); setEvalFilter('all'); }}><i className="ti ti-eye"></i> Evaluate</button>
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
    );
  }

  // ==========================================
  // VIEW 1: MASTER VAULT (List of Tests)
  // ==========================================
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
        <div className="page-header">
            <div className="page-title">My Tests Vault</div>
            <div className="page-sub">Manage your assessments, control intakes, and review results.</div>
        </div>

        {myTests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed #cbd5e1', background: 'transparent' }}>
                <i className="ti ti-folder-off" style={{ fontSize: '56px', color: '#cbd5e1', marginBottom: '1rem', display: 'block' }}></i>
                <h3 style={{ color: '#475569', fontSize: '20px', marginBottom: '8px' }}>Vault is Empty</h3>
                <p style={{ color: '#94a3b8', fontSize: '15px' }}>You haven't created any tests yet. Go to the 'Create' tab to build your first exam.</p>
            </div>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {myTests.map((t, i) => {
                    const isLive = t.isActive !== false;
                    const subCount = t.submissions ? t.submissions.length : 0;
                    return (
                        <div key={i} className="card mobile-card-stack" style={{ cursor: 'pointer', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${t.isLocal ? '#f59e0b' : (isLive ? '#10B981' : '#cbd5e1')}` }} onClick={() => setSelectedTest(t)}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                    <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>{t.title}</h3>
                                    
                                    {/* 🔥 THE FIX: Added Local Device Tag properly */}
                                    {t.isLocal && <span className="badge b-amber"><i className="ti ti-device-floppy"></i> Local Device</span>}
                                    
                                    {isLive && !t.isLocal ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#d1fae5', padding: '4px 10px', borderRadius: '20px' }}>
                                            <span style={{ display: 'block', width: '8px', height: '8px', background: '#10B981', borderRadius: '50%', boxShadow: '0 0 8px #10B981', animation: 'pulse 1.5s infinite' }}></span>
                                            <span style={{ color: '#065f46', fontWeight: 700, fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Live</span>
                                        </div>
                                    ) : (!t.isLocal && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '20px' }}>
                                            <span style={{ display: 'block', width: '8px', height: '8px', background: '#94a3b8', borderRadius: '50%' }}></span>
                                            <span style={{ color: '#64748b', fontWeight: 600, fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Closed</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px', fontWeight: 500 }}>
                                    <i className="ti ti-book"></i> {t.subject || 'General'} &nbsp;&bull;&nbsp; <i className="ti ti-list-numbers"></i> {t.questions?.length || 0} Qs &nbsp;&bull;&nbsp; <i className="ti ti-clock"></i> {t.duration} Mins
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <span className="badge b-blue" style={{ fontFamily: 'monospace', fontSize: '14px', padding: '6px 12px', background: '#EEEDFE', color: '#3C3489', border: '1px solid #CECBF6' }}><i className="ti ti-hash"></i> {t.code}</span>
                                    <span className="badge b-gray" style={{ padding: '6px 12px' }}><i className="ti ti-users"></i> {subCount} Submissions</span>
                                </div>
                            </div>
                            <div className="mobile-chevron" style={{ paddingLeft: '20px', color: '#185FA5' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <i className="ti ti-chevron-right" style={{ fontSize: '20px' }}></i>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Undo Toast Notification */}
      {undoData && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', background: '#334155', color: '#fff', padding: '16px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 9999, animation: 'slideUp 0.3s ease' }}>
              <div><i className="ti ti-trash"></i> Test moved to trash.</div>
              <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 700 }} onClick={handleUndo}>UNDO</button>
          </div>
      )}

        {/* 🔥 SYSTEM MODALS */}
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
    </div>
  );
}