// src/app/tests/page.js
'use client';
import { useState, useEffect, useRef, memo } from 'react'; // 🔥 FIX: memo import kiya
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, set, update, remove, get } from 'firebase/database'; 
import FigureRenderer from '../../components/FigureRenderer'; 
import SmilesViewer from '../../components/SmilesViewer';

// 🔥 THE MASTER FIX: MathJax React Re-render Protector
const StaticMath = memo(({ html, isBlock, style, className }) => {
  if (isBlock) return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
});

export default function ManageTests() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  //  THE FIX: Naye On-Demand fetch functions ko destructure kiya hai
  const { tests, setTests, loadingData, fetchMyTests } = useData();
  const router = useRouter();

  // --- NEW: Local Offline State ---
  const [localTests, setLocalTests] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [isInitialLoad, setIsInitialLoad] = useState(true); //  THE MAKKHAN FIX
  
  // --- CORE STATE ---
  const [selectedTest, setSelectedTest] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'subs'
  const [searchQuery, setSearchQuery] = useState('');
  const [undoData, setUndoData] = useState(null); // For Delete Undo timer
  const [vaultSearchQuery, setVaultSearchQuery] = useState(''); 
  const [sortBy, setSortBy] = useState('newest'); 
  const searchRef = typeof window !== 'undefined' ? require('react').useRef(null) : null; 
  
  // --- MODALS & SUB-VIEWS ---
  const [modalType, setModalType] = useState(null); // 'analytics' | 'editKey' | 'audit'
  const [editSettingsData, setEditSettingsData] = useState({});
  const [evaluateSub, setEvaluateSub] = useState(null); // Manual evaluation screen
  
  // --- EDIT KEY & EVALUATION STATE ---
  const [tempQuestions, setTempQuestions] = useState([]);
  const [evalOverrides, setEvalOverrides] = useState({});
  const [auditReason, setAuditReason] = useState('');
  const [evalFilter, setEvalFilter] = useState('all'); 
  const [evalSectionFilter, setEvalSectionFilter] = useState('all_sections'); // NAYA: Examiner Section Filter
  const [followerCount, setFollowerCount] = useState(0);
  const [isEvalMathReady, setIsEvalMathReady] = useState(true);
  

  // --- SYSTEM POPUP STATES ---
  const [sysAlert, setSysAlert] = useState(null); // { title, msg, type }
  const [sysConfirm, setSysConfirm] = useState(null); // { title, msg, action }
  const [showScrollTop, setShowScrollTop] = useState(false);
  const baseTests = isOffline ? localTests : [...(tests || []), ...localTests];

  // EVALUATION NAV SHUTTER STATES ---
  const [isEvalNavVisible, setIsEvalNavVisible] = useState(true);
  const evalLastScrollY = useRef(0);
  const isEvalAnimating = useRef(false);
  const evalNavState = useRef(true);

  // EVALUATION SCROLL SHUTTER ENGINE
  useEffect(() => {
      if (typeof window === 'undefined') return;
      const handleScroll = () => {
          if (!evaluateSub) return; 
          
          // Seedha Navbar ka HTML element uthaya
          const navEl = document.getElementById('eval-shutter-nav');
          if (!navEl) return;

          const currentScrollY = window.scrollY;
          
          // Top bounce protection
          if (currentScrollY <= 70) {
              if (!evalNavState.current) {
                  evalNavState.current = true;
                  navEl.style.top = '60px';
                  navEl.style.opacity = '1';
                  navEl.style.boxShadow = '0 4px 25px rgba(0,0,0,0.06)';
              }
              evalLastScrollY.current = currentScrollY;
              return;
          }

          if (isEvalAnimating.current) {
              evalLastScrollY.current = currentScrollY;
              return;
          }

          const distance = currentScrollY - evalLastScrollY.current;
          
          if (distance > 20 && evalNavState.current) {
              // Scroll Down -> Hide (Direct DOM Style Update)
              isEvalAnimating.current = true;
              evalNavState.current = false;
              navEl.style.top = '-100px';
              navEl.style.opacity = '0';
              navEl.style.boxShadow = 'none';
              setTimeout(() => { isEvalAnimating.current = false; }, 400); 
              
          } else if (distance < -20 && !evalNavState.current) {
              // Scroll Up -> Show (Direct DOM Style Update)
              isEvalAnimating.current = true;
              evalNavState.current = true;
              navEl.style.top = '60px';
              navEl.style.opacity = '1';
              navEl.style.boxShadow = '0 4px 25px rgba(0,0,0,0.06)';
              setTimeout(() => { isEvalAnimating.current = false; }, 400); 
          }
          evalLastScrollY.current = currentScrollY;
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
  }, [evaluateSub]);

  // Smart Wrappers: Parda girao (hide), thoda wait karo, fir state change karo
  const changeEvalStatus = (newFilter) => {
      if (newFilter === evalFilter) return;
      setIsEvalMathReady(false); // 1. Drop Shutter
      setTimeout(() => setEvalFilter(newFilter), 50); // 2. Change data behind the scenes
  };

  const changeEvalSection = (newSec) => {
      if (newSec === evalSectionFilter) return;
      setIsEvalMathReady(false); // 1. Drop Shutter
      setTimeout(() => setEvalSectionFilter(newSec), 50); // 2. Change data behind the scenes
  };

  //  FIX: Press '/' to focus Search Bar automatically
  typeof require('react').useEffect(() => {
    const handleSlashKey = (e) => {
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            searchRef?.current?.focus();
        }
    };
    window.addEventListener('keydown', handleSlashKey);
    return () => window.removeEventListener('keydown', handleSlashKey);
  }, [searchRef]);

  //  FIX 1: THE AMNESIA CURE (State Memory on Refresh)
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

  //  THE FIX 1: Sirf apne tests fetch karo (With Anti-Flicker Logic)
  useEffect(() => {
      if (isMounted && !isOffline && currentUser?.uid && (userRole === 'examiner' || userRole === 'admin')) {
          fetchMyTests(currentUser.uid).finally(() => setIsInitialLoad(false));
      } else if (isMounted) {
          setIsInitialLoad(false);
      }
  }, [isMounted, isOffline, currentUser, userRole]);

  useEffect(() => {
      if (typeof window === 'undefined') return;
      const handleScroll = () => {
          // Agar 400px se zyada scroll ho gaya hai, toh arrow dikhao
          setShowScrollTop(window.scrollY > 400);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

 // 2. MathJax Auto-Renderer (ULTIMATE BULLETPROOF FIX WITH FADE-IN)
  useEffect(() => {
    let isSubscribed = true;
    
    const renderMath = () => {
        if (!isSubscribed) return;
        if (typeof window !== 'undefined' && window.MathJax) {
            try {
                if (typeof window.MathJax.typesetClear === 'function') {
                    window.MathJax.typesetClear();
                }
                if (typeof window.MathJax.typesetPromise === 'function') {
                    // Promise ke resolve hone ke baad parda uthao
                    window.MathJax.typesetPromise().then(() => {
                        if (isSubscribed) setIsEvalMathReady(true);
                    }).catch(err => {
                        console.log('MathJax Error:', err);
                        if (isSubscribed) setIsEvalMathReady(true); // Fallback
                    });
                } else if (typeof window.MathJax.typeset === 'function') {
                    window.MathJax.typeset();
                    setIsEvalMathReady(true);
                }
            } catch (err) {
                console.error('MathJax Error:', err);
                setIsEvalMathReady(true);
            }
        } else {
            setIsEvalMathReady(true);
        }
    };

    // React ko DOM render karne ka time do, fir MathJax chalao
    const timer1 = setTimeout(() => { requestAnimationFrame(renderMath); }, 50);

    return () => {
        isSubscribed = false;
        clearTimeout(timer1);
    };
  }, [selectedTest, evaluateSub, evalFilter, evalSectionFilter, modalType, activeTab]);

  // Fetch Followers Count on Mount
  useEffect(() => {
      if (currentUser?.uid && (userRole === 'examiner' || userRole === 'admin')) {
          const fetchFollowers = async () => {
              try {
                  const snap = await get(ref(database, 'users'));
                  const allUsers = snap.val() || {};
                  let count = 0;
                  // Har student ka account check karo ki unke 'followed' array me is teacher ka UID hai ya nahi
                  Object.values(allUsers).forEach(u => {
                      if (u.followed && u.followed.includes(currentUser.uid)) {
                          count++;
                      }
                  });
                  setFollowerCount(count);
              } catch (e) {
                  console.error("Error fetching followers", e);
              }
          };
          fetchFollowers();
      }
  }, [currentUser, userRole]);

  //  FIX 1: Premium Skeleton Loader (Replaces the boring spinner)
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

  //  THE FIX 2: Kyunki ab 'tests' me pehle se hi sirf is examiner ke tests hain, humein filter lagane ki zaroorat nahi
  const myTests = baseTests.filter(t => t.id !== undoData?.test?.id);
  
  //  THE FIX 3: SAFE UPDATER (Firebase Index Matcher)
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
      // 1. Pehle check karo test ka current asali status kya hai
      const now = Date.now();
      const closeTime = t.closeDate ? new Date(t.closeDate).getTime() : null;
      const openTime = t.openDate ? new Date(t.openDate).getTime() : null;
      
      let currentStatus = 'live';
      if (t.isActive === false || (closeTime && now > closeTime)) currentStatus = 'closed';
      else if (openTime && now < openTime) currentStatus = 'upcoming';

      let updatedTest = { ...t };

      if (currentStatus === 'live') {
          // Agar abhi LIVE hai, toh manual close karo
          updatedTest.isActive = false;
      } else {
          // Agar CLOSED ya UPCOMING hai, toh FORCE OPEN karo
          updatedTest.isActive = true;
          // 🔥 MAGIC: Jo bhi time lock lagaga tha, usko mita do taaki test turant khul jaye
          if (closeTime && now > closeTime) updatedTest.closeDate = ''; 
          if (openTime && now < openTime) updatedTest.openDate = '';   
      }

      await updateTestGlobal(updatedTest);
    } catch (e) { setSysAlert({ title: 'Error', msg: 'Error toggling status.', type: 'error' }); }
  };

  //  THE FIX 4: SAFE DELETER (Cross-Check Delete)
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
    
    //  FIX 2: BULLETPROOF MATHJAX & IMAGE SYNC ENGINE
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

 const openEditSettings = () => {
      setEditSettingsData({
          duration: selectedTest.duration || 60,
          negMarking: selectedTest.negMarking || 0,
          resultVis: selectedTest.resultVis || 'manual',
          radarVisible: selectedTest.radarVisible || false, 
          radarNote: selectedTest.radarNote || '',
          openDate: selectedTest.openDate || '',
          closeDate: selectedTest.closeDate || '',
          // 🔥 NAYA: Direct Entry default OFF
          directEntry: selectedTest.directEntry || false
      });
      setModalType('editSettings');
  };

  const saveTestSettings = async () => {
      try {
          let updatedTest = { 
              ...selectedTest, 
              duration: Number(editSettingsData.duration),
              negMarking: Number(editSettingsData.negMarking),
              resultVis: editSettingsData.resultVis,
              radarVisible: editSettingsData.radarVisible,
              radarNote: editSettingsData.radarNote,
              openDate: editSettingsData.openDate,
              closeDate: editSettingsData.closeDate,
              // 🔥 NAYA: Save Direct Entry setting
              directEntry: editSettingsData.directEntry
          };
          
          if (new Date(editSettingsData.closeDate) > new Date()) updatedTest.isActive = true;

          await updateTestGlobal(updatedTest);
          setModalType(null);
          setSysAlert({ title: 'Success', msg: 'Test config & schedule updated.', type: 'success' });
      } catch (e) {
          setSysAlert({ title: 'Error', msg: 'Failed to update settings.', type: 'error' });
      }
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

 //  THE BULLETPROOF MAGIC RECALCULATE ENGINE (Fixed Skipped Logic)
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

        //  ASLI SKIPPED CHECK: null, undefined, khali string, -1, ya khali array = SKIPPED!
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
  
  const deleteSubmission = async (sIdx, subName) => {
    if (window.confirm(`Are you sure you want to permanently delete the submission for "${subName}"? (Use this to remove Demo/Dummy tests)`)) {
        try {
            let updatedTest = { ...selectedTest };
            updatedTest.submissions = updatedTest.submissions.filter((_, idx) => idx !== sIdx);
            
            await updateTestGlobal(updatedTest);
            setSysAlert({ title: 'Deleted', msg: 'Demo submission removed successfully.', type: 'success' });
        } catch (e) {
            setSysAlert({ title: 'Error', msg: 'Failed to delete submission.', type: 'error' });
        }
    }
  };

  return (
    <>
      {evaluateSub ? (
        // ==========================================
        // VIEW 3: EVALUATE PAPER
        // ==========================================
        <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
          
          {/* 🔥 STATIC PREMIUM EVALUATION NAVBAR 🔥 */}
          <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] mb-2 mt-2">
              <button 
                  className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors active:scale-95" 
                  onClick={() => { setEvaluateSub(null); setEvalOverrides({}); setEvalSectionFilter('all_sections'); }}
              >
                  <i className="ti ti-arrow-left text-lg"></i> <span className="hidden sm:inline">Back to Vault</span>
              </button>
              
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-black text-[11px] uppercase tracking-widest border border-blue-100">
                  <i className="ti ti-pencil-check text-base"></i> Evaluation Mode
              </div>

              <button 
                  className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all active:scale-95" 
                  onClick={() => setModalType('audit')}
              >
                  <i className="ti ti-device-floppy text-lg"></i> <span>Save <span className="hidden sm:inline">Evaluation</span></span>
              </button>
          </div>

         {/* 🔥 EXAMINER PRO DASHBOARD (Ultra-Compact, Data-Driven) 🔥 */}
          <div className="flex flex-col gap-4 mb-8 mt-2">
              
              {/* 1. COMPACT HERO CARD */}
              <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-center gap-5 shadow-lg border border-slate-800 relative overflow-hidden">
                  {/* Subtle Background Glow */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
                  
                  {/* Left Info */}
                  <div className="w-full sm:w-auto flex flex-col items-center sm:items-start text-center sm:text-left z-10">
                      <div className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest mb-1">
                          Evaluating: {evaluateSub.test.title}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">
                          {evaluateSub.sub.name}
                      </h2>
                      <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 text-xs font-semibold text-slate-300">
                          {evaluateSub.sub.roll && <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">Roll: {evaluateSub.sub.roll}</span>}
                          <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1"><i className="ti ti-clock opacity-70"></i> {evaluateSub.sub.time}</span>
                      </div>
                  </div>

                  {/* Right Score */}
                  <div className="flex items-center gap-4 z-10 w-full sm:w-auto justify-center sm:justify-end">
                      <div className="flex flex-col items-end">
                          <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest mb-1">Total Score</div>
                          <div className="bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5 shadow-inner">
                              <span className="text-2xl font-black text-white">{evaluateSub.sub.score}</span>
                              <span className="text-sm font-bold text-slate-500">/ {evaluateSub.test.totalMarks}</span>
                          </div>
                      </div>
                      {/* Circular Accuracy Indicator */}
                      <div className="w-14 h-14 rounded-full border-4 border-slate-700 flex flex-col items-center justify-center shrink-0 relative bg-slate-800">
                          {/* Green ring based on percentage (Simplified CSS representation) */}
                          <div className="absolute inset-[-4px] rounded-full border-4 border-emerald-500 opacity-50" style={{ clipPath: `polygon(0 0, 100% 0, 100% ${(evaluateSub.sub.score / evaluateSub.test.totalMarks) * 100}%, 0 ${(evaluateSub.sub.score / evaluateSub.test.totalMarks) * 100}%)` }}></div>
                          <span className="text-[13px] font-black text-white z-10">{((evaluateSub.sub.score / evaluateSub.test.totalMarks) * 100).toFixed(0)}%</span>
                      </div>
                  </div>
              </div>

              {/* 🔥 2. SLEEK PERFORMANCE & SECTIONS (Replaces Bulky 4-Grid) 🔥 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  
                  {/* Left: One-Line Smart Progress Bar */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest"><i className="ti ti-chart-bar text-blue-500 text-sm"></i> Performance Bar</h3>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{evaluateSub.test.questions.length} Qs Total</span>
                      </div>
                      
                      {/* Stacked Bar */}
                      <div className="flex h-3.5 rounded-full overflow-hidden mb-4 bg-slate-100 shadow-inner">
                          <div style={{ width: `${(evaluateSub.sub.correct / evaluateSub.test.questions.length) * 100}%` }} className="bg-emerald-500"></div>
                          <div style={{ width: `${(evaluateSub.sub.wrong / evaluateSub.test.questions.length) * 100}%` }} className="bg-rose-500"></div>
                          <div style={{ width: `${(evaluateSub.sub.skipped / evaluateSub.test.questions.length) * 100}%` }} className="bg-slate-300"></div>
                      </div>
                      
                      {/* Legends */}
                      <div className="flex justify-between items-center text-[12px] font-bold">
                          <span className="flex items-center gap-1.5 text-emerald-700"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> {evaluateSub.sub.correct} Correct</span>
                          <span className="flex items-center gap-1.5 text-rose-700"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span> {evaluateSub.sub.wrong} Wrong</span>
                          <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 bg-slate-300 rounded-full"></span> {evaluateSub.sub.skipped} Skipped</span>
                      </div>
                  </div>

                  {/* Right: Ultra-Thin Section Marks */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><i className="ti ti-category text-indigo-500 text-sm"></i> Section-Wise Score</h3>
                      <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[90px] custom-scrollbar pr-1">
                          {(() => {
                              const secStats = {};
                              const sectionsList = evaluateSub.test.sections || [];
                              if (sectionsList.length === 0) secStats['General Paper'] = { earned: 0, total: 0 };
                              else sectionsList.forEach(s => secStats[s] = { earned: 0, total: 0 });

                              evaluateSub.sub.details.forEach(d => {
                                  const sec = d.q.section || sectionsList[0] || 'General Paper';
                                  if (!secStats[sec]) secStats[sec] = { earned: 0, total: 0 };
                                  secStats[sec].total += d.q.marks;
                                  secStats[sec].earned += (d.earned || 0);
                              });

                              return Object.keys(secStats).map((sec, idx) => {
                                  const sData = secStats[sec];
                                  const pct = sData.total > 0 ? ((sData.earned / sData.total) * 100).toFixed(0) : 0;
                                  
                                  return (
                                      <div key={sec} className={`flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 ${idx !== Object.keys(secStats).length - 1 ? 'border-b border-slate-100' : ''}`}>
                                          <div className="font-bold text-[12.5px] text-slate-700 truncate mr-2 flex items-center gap-1.5"><i className="ti ti-folder text-slate-400 text-[14px]"></i> {sec}</div>
                                          <div className="flex items-center gap-3 shrink-0">
                                              <div className="text-[12.5px] font-black text-slate-800">{Number(sData.earned.toFixed(2))} <span className="text-[10px] font-bold text-slate-400">/ {sData.total}</span></div>
                                              <div className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded w-10 text-center ${pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{pct}%</div>
                                          </div>
                                          
                                      </div>
                                  );
                              });
                          })()}
                      </div>
                  </div>
              </div>

              {/* 🔥 3. SMART PROCTORING SHUTTER (Accordion UI) 🔥 */}
              {(() => {
                  const logs = evaluateSub.sub.cheatLogs || evaluateSub.sub.antiCheatLogs || evaluateSub.sub.logs || evaluateSub.sub.events || evaluateSub.sub.warnings || [];
                  const isClean = logs.length === 0;
                  
                  // Logic to check if student was auto-kicked (either 3+ warnings or explicit 'auto-submit' string)
                  const isKicked = logs.length >= 3 || logs.some(l => typeof l === 'string' ? l.toLowerCase().includes('auto-submit') || l.toLowerCase().includes('violat') : (l.reason||l.msg||l.event||'').toLowerCase().includes('auto-submit'));
                  
                  // Dynamic styles based on status
                  const sStyle = isClean ? { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: 'ti-shield-check', badge: 'bg-emerald-100 text-emerald-800' } :
                                 isKicked ? { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: 'ti-ban', badge: 'bg-rose-600 text-white shadow-sm shadow-rose-500/30' } :
                                 { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: 'ti-alert-triangle', badge: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30' };

                  return (
                      <details className={`group rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${sStyle.bg}`}>
                          <summary className="cursor-pointer p-4 flex items-center justify-between select-none hover:bg-black/5 transition-colors list-none [&::-webkit-details-marker]:hidden">
                              
                              <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full md:w-auto">
                                  {/* Time Taken Badge */}
                                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[13px] bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                                      <i className="ti ti-clock text-slate-500"></i> {evaluateSub.sub.timeTaken || <span className="opacity-60 text-[11px]">N/A</span>}
                                  </div>
                                  
                                  {/* Dynamic Status Title */}
                                  <div className={`flex items-center gap-2 font-black text-[14px] ${sStyle.text}`}>
                                      <i className={`ti ${sStyle.icon} text-lg`}></i>
                                      {isClean ? 'Clean Session (No Flags)' : 
                                       isKicked ? 'AUTO-KICKED / SUBMITTED' : 
                                       `${logs.length} Warning(s) Recorded`}
                                  </div>
                              </div>
                              
                              <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center ${sStyle.text} border ${sStyle.border} shadow-sm group-open:bg-current group-open:text-white transition-all transform group-open:rotate-180 shrink-0`}>
                                  <i className="ti ti-chevron-down"></i>
                              </div>
                          </summary>
                          
                          {/* Shutter Content (Opens smoothly on click) */}
                          <div className={`p-4 border-t bg-white/50 ${sStyle.border}`}>
                              {isClean ? (
                                  <div className="text-[13px] font-bold text-emerald-700 flex items-center gap-2">
                                      <i className="ti ti-check bg-emerald-200 p-0.5 rounded-full"></i> 
                                      The system did not detect any tab-switching or suspicious behavior during the exam.
                                  </div>
                              ) : (
                                  <div className="max-h-[120px] overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-2">
                                      {logs.map((log, idx) => {
                                          let cleanReason = "Suspicious Activity", cleanTime = "";
                                          if (typeof log === 'string') {
                                              try { const parsed = JSON.parse(log); cleanReason = parsed.reason || parsed.event || log; cleanTime = parsed.time || ""; } 
                                              catch(e) { cleanReason = log; }
                                          } else {
                                              cleanReason = log.reason || log.msg || log.event || "Alert Recorded"; cleanTime = log.time || "";
                                          }

                                          return (
                                              <div key={idx} className="text-[12px] font-bold text-slate-700 flex items-start gap-2 leading-tight bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                                  <div className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5">
                                                      #{idx + 1}
                                                  </div>
                                                  <span className="flex-1 break-words mt-0.5">{cleanReason}</span>
                                                  {cleanTime && <span className="shrink-0 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded uppercase font-black tracking-wider border border-slate-200 mt-0.5">{cleanTime}</span>}
                                              </div>
                                          );
                                      })}
                                  </div>
                              )}
                          </div>
                      </details>
                  );
              })()}
          </div>

          {/* 🔥 MINIMALIST & ADVANCED FILTERS (Apple/Stripe Style) - EXAMINER MODE 🔥 */}
          <div className="mb-6 border-b border-slate-200 pb-5 mt-8">
            <div className="flex flex-col gap-4">
                
                {/* Header & Status Filters */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <h3 className="text-[17px] font-extrabold text-slate-800 flex items-center gap-2 tracking-tight">
                        <i className="ti ti-adjustments-horizontal text-blue-600 text-xl"></i> Evaluation Filters
                    </h3>
                    
                    {(() => {
                        const secDetails = evaluateSub.sub.details.filter(d => evalSectionFilter === 'all_sections' || d.q.section === evalSectionFilter || (!d.q.section && evalSectionFilter === (evaluateSub.test.sections?.[0])));
                        const countAll = secDetails.length;
                        const countCorrect = secDetails.filter(d => d.status === 'correct' || d.status === 'partial').length;
                        const countWrong = secDetails.filter(d => d.status === 'wrong').length;
                        const countSkipped = secDetails.filter(d => d.status === 'skipped' || d.status === 'submitted' || d.status === 'evaluated').length;
                        
                        return (
                            <div className="inline-flex bg-slate-100/80 p-1.5 rounded-xl overflow-x-auto scrollbar-hide -webkit-overflow-scrolling-touch border border-slate-200/60 w-full md:w-auto">
                              
                              <button 
                                  className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${evalFilter === 'all' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                                  onClick={() => { changeEvalStatus('all'); setTimeout(() => setIsEvalMathReady(true), 500); }}
                              >
                                  All <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${evalFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{countAll}</span>
                              </button>
                              
                              <button 
                                  className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${evalFilter === 'correct' ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                                  onClick={() => { changeEvalStatus('correct'); setTimeout(() => setIsEvalMathReady(true), 500); }}
                              >
                                  Correct <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${evalFilter === 'correct' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{countCorrect}</span>
                              </button>
                              
                              <button 
                                  className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${evalFilter === 'wrong' ? 'bg-white text-rose-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                                  onClick={() => { changeEvalStatus('wrong'); setTimeout(() => setIsEvalMathReady(true), 500); }}
                              >
                                  Wrong <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${evalFilter === 'wrong' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'}`}>{countWrong}</span>
                              </button>
                              
                              <button 
                                  className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${evalFilter === 'skipped' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                                  onClick={() => { changeEvalStatus('skipped'); setTimeout(() => setIsEvalMathReady(true), 500); }}
                              >
                                  Pending <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${evalFilter === 'skipped' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200 text-slate-500'}`}>{countSkipped}</span>
                              </button>
                            </div>
                        );
                    })()}
                </div>

                {/* Section Filters (Sleek Pills) */}
                {evaluateSub.test.sections && evaluateSub.test.sections.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -webkit-overflow-scrolling-touch">
                        <button 
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 border ${evalSectionFilter === 'all_sections' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`} 
                            onClick={() => { changeEvalSection('all_sections'); setTimeout(() => setIsEvalMathReady(true), 500); }}
                        >
                            All Sections
                        </button>
                        {evaluateSub.test.sections.map((sec, idx) => (
                            <button 
                                key={idx} 
                                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 border ${evalSectionFilter === sec ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`} 
                                onClick={() => { changeEvalSection(sec); setTimeout(() => setIsEvalMathReady(true), 500); }}
                            >
                                {sec}
                            </button>
                        ))}
                    </div>
                )}
            </div>
          </div>

          {/* 🔥 PREMIUM QUESTION REVIEW CARDS (Examiner Mode) 🔥 */}
          {/* ⚡ FIX: Added min-opacity 0.1 so it never completely disappears, and added a robust fallback in state toggles above */}
          <div style={{ opacity: isEvalMathReady ? 1 : 0.05, transition: 'opacity 0.2s ease-in', minHeight: '50vh' }} className="flex flex-col gap-6">
            {evaluateSub.sub.details.filter(d => {
                let sMatch = evalFilter === 'all' || d.status === evalFilter || (evalFilter === 'skipped' && (d.status === 'submitted' || d.status === 'evaluated'));
                let secMatch = evalSectionFilter === 'all_sections' || d.q.section === evalSectionFilter || (!d.q.section && evalSectionFilter === (evaluateSub.test.sections?.[0]));
                return sMatch && secMatch;
            }).map((d, index) => {
               const originalQIdx = evaluateSub.sub.details.indexOf(d);
               const q = d.q;
               const ans = d.ans;
               
               const statusColors = {
                   correct: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: 'ti-circle-check', header: 'bg-emerald-100/50' },
                   wrong: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', icon: 'ti-circle-x', header: 'bg-rose-100/50' },
                   partial: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: 'ti-adjustments-alt', header: 'bg-amber-100/50' },
                   evaluated: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'ti-pencil', header: 'bg-blue-100/50' },
                   submitted: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', icon: 'ti-file-search', header: 'bg-indigo-100/50' },
                   skipped: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', icon: 'ti-minus', header: 'bg-slate-100/50' }
               };
               
               const sColor = statusColors[d.status] || statusColors.skipped;
               let userSel = Array.isArray(ans.val) ? ans.val : (ans.val !== null ? [ans.val] : []);
               let corrSel = q.correct || [];

               return (
                 <div key={originalQIdx} className={`bg-white rounded-2xl border ${sColor.border} overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1`}>
                    
                    {/* Header Section */}
                    <div className={`px-5 py-3 ${sColor.header} border-b ${sColor.border} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                        <div className={`flex items-center gap-2 font-bold ${sColor.text} text-[15px]`}>
                            <i className={`ti ${sColor.icon} text-[20px]`}></i>
                            <span>Question {originalQIdx + 1} <span className="opacity-50 mx-1">|</span> {getLabel(q.type)}</span>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-white shadow-sm">
                                Earned: {d.earned || 0} / {q.marks}
                            </span>
                        </div>
                    </div>

                    {/* Body Section */}
                    <div className="p-5 overflow-x-auto hide-scroll w-full">
                        
                        <StaticMath isBlock={true} html={q.text} className="text-[16px] leading-relaxed text-slate-800 font-medium mb-5 whitespace-normal break-words" />
                        
                        {/* Universal Compact Figure Engine */}
                        {q.figureType && q.figureType !== 'none' && q.figureData && (
                            <div className="flex justify-center w-full my-4">
                                {(q.figureType === 'image' || q.figureType === 'url') && (
                                    <img src={q.figureData} alt="Figure" className="max-w-full max-h-[200px] rounded-lg border border-slate-200 object-contain bg-white shadow-sm" />
                                )}
                                {q.figureType === 'smiles' && (
                                    <div className="bg-white p-3 rounded-lg border border-slate-200 inline-block shadow-sm">
                                        <SmilesViewer smilesCode={q.figureData} width={200} height={200} />
                                    </div>
                                )}
                                {q.figureType === 'tikz' && (
                                    <div className="hide-scroll max-w-full overflow-x-auto bg-white p-3 rounded-lg border border-slate-200 inline-block shadow-sm">
                                        <img src={`https://i.upmath.me/svg/${encodeURIComponent('\\begin{tikzpicture}\n' + q.figureData + '\n\\end{tikzpicture}')}`} alt="Math Graphic" className="max-w-full object-contain" />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Fallback Legacy Image */}
                        {!q.figureType && q.imgUrl && (
                            <div className="flex justify-center w-full my-4">
                                <img src={q.imgUrl} className="max-w-full max-h-[200px] rounded-lg border border-slate-200 object-contain bg-white shadow-sm" alt="Legacy Figure" />
                            </div>
                        )}
                                            
                        {/* MCQ / MSQ Options */}
                        <div className="flex flex-col gap-3">
                            {(q.type === 'mcq' || q.type === 'msq') && q.options.map((o, j) => {
                                let isUser = userSel.includes(j);
                                let isCorr = corrSel.includes(j);
                                
                                let optBg = 'bg-slate-50 hover:bg-slate-100', optBorder = 'border-slate-200', optText = 'text-slate-700', iconUi = null;
                                if (isCorr && isUser) { optBg = 'bg-emerald-50'; optBorder = 'border-emerald-300'; optText = 'text-emerald-900 font-semibold'; iconUi = <i className="ti ti-check text-2xl text-emerald-600 flex-shrink-0"></i>; }
                                else if (isCorr && !isUser) { optBg = 'bg-emerald-50/50'; optBorder = 'border-emerald-200 border-dashed'; optText = 'text-emerald-800'; iconUi = <i className="ti ti-check text-2xl text-emerald-400 opacity-50 flex-shrink-0"></i>; }
                                else if (!isCorr && isUser) { optBg = 'bg-rose-50'; optBorder = 'border-rose-300'; optText = 'text-rose-900 font-semibold'; iconUi = <i className="ti ti-x text-2xl text-rose-600 flex-shrink-0"></i>; }

                                return (
                                    <div key={j} className={`flex items-start gap-4 p-4 rounded-xl border ${optBg} ${optBorder} transition-colors duration-200 w-full overflow-hidden`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2 bg-white ${isCorr && isUser ? 'border-emerald-500 text-emerald-600' : (!isCorr && isUser) ? 'border-rose-500 text-rose-600' : 'border-slate-400 text-slate-500'}`}>
                                            {String.fromCharCode(65 + j)}
                                        </div>
                                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                                            {o.startsWith('[smiles]') ? (
                                                <div className="pointer-events-none bg-white p-2 rounded-lg border border-slate-200 inline-block w-fit">
                                                    <SmilesViewer smilesCode={o.replace('[smiles]', '').trim()} width={150} height={150} />
                                                </div>
                                            ) : (
                                                <StaticMath isBlock={true} html={o} className={`text-[15px] whitespace-normal break-words ${optText}`} />
                                            )}
                                            {(isUser || isCorr) && (
                                                <div className="flex gap-2 flex-wrap mt-1">
                                                    {isUser && <span className="text-[10px] uppercase tracking-wide font-bold bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm"><i className="ti ti-hand-click"></i> Student Picked</span>}
                                                    {isCorr && <span className="text-[10px] uppercase tracking-wide font-bold bg-emerald-600 text-white px-2 py-0.5 rounded shadow-sm"><i className="ti ti-key"></i> Correct Key</span>}
                                                </div>
                                            )}
                                        </div>
                                        {iconUi}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Integer Type */}
                        {q.type === 'integer' && (
                            <div className="flex flex-col sm:flex-row gap-4 mt-2">
                                <div className={`flex-1 p-4 rounded-xl border flex flex-col justify-center ${d.status === 'correct' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                                    <span className="text-xs uppercase font-bold opacity-70 mb-1">Student Answer</span>
                                    <strong className="text-2xl">{ans.val !== null ? ans.val : '—'}</strong>
                                </div>
                                <div className="flex-1 p-4 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 flex flex-col justify-center relative overflow-hidden">
                                    <i className="ti ti-key absolute -right-2 -bottom-2 text-6xl opacity-10"></i>
                                    <span className="text-xs uppercase font-bold opacity-70 mb-1">Correct Answer</span>
                                    <strong className="text-2xl">{q.correctInt}</strong>
                                </div>
                            </div>
                        )}

                        {/* Subjective Type */}
                        {q.type === 'subjective' && (
                            <div className="flex flex-col gap-4 mt-2">
                                <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 flex gap-3 items-start">
                                    <i className="ti ti-pencil text-blue-600 text-xl mt-0.5 flex-shrink-0"></i>
                                    <div>
                                        <span className="text-xs uppercase font-bold text-slate-500 mb-1 block">Student Answer</span>
                                        <span className="text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap">{ans.val || <em className="text-slate-400">No answer written.</em>}</span>
                                    </div>
                                </div>
                                {q.modelAnswer && (
                                    <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-200 flex gap-3 items-start">
                                        <i className="ti ti-bulb text-emerald-600 text-xl mt-0.5 flex-shrink-0"></i>
                                        <div>
                                            <span className="text-xs uppercase font-bold text-emerald-600 mb-1 block">Model Answer</span>
                                            <span className="text-[15px] leading-relaxed text-emerald-900 whitespace-pre-wrap">{q.modelAnswer}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Smart Accordion Explanation */}
                        {q.explanation && (
                            <details className="group mt-6 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden transition-all duration-300">
                                <summary className="cursor-pointer p-4 font-semibold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-colors select-none">
                                    <span className="flex items-center gap-2"><i className="ti ti-bulb text-lg text-slate-500"></i> View Solution / Logic</span>
                                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-open:bg-slate-700 group-open:text-white transition-colors">
                                        <i className="ti ti-chevron-down transform group-open:rotate-180 transition-transform duration-300"></i>
                                    </div>
                                </summary>
                                <div className="p-5 border-t border-slate-200 text-[15px] text-slate-700 leading-relaxed bg-white">
                                    <StaticMath isBlock={true} html={q.explanation} className="math-scroll-box" />
                                </div>
                            </details>
                        )}
                        
                        <div className="mt-8 flex flex-col gap-5">
                            {/* 🔥 REDESIGNED AUDIT LOGS (Sleek Timeline Style) 🔥 */}
                            {d.auditLogs && d.auditLogs.length > 0 && (
                                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5">
                                    <div className="font-extrabold text-[12px] text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <i className="ti ti-history text-base"></i> Evaluation History
                                    </div>
                                    <div className="flex flex-col gap-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-slate-200 ml-1">
                                        {d.auditLogs.map((log, lIdx) => (
                                            <div key={lIdx} className="relative pl-8">
                                                <div className="absolute left-0 top-1 w-[24px] h-[24px] bg-white border-2 border-slate-300 rounded-full flex items-center justify-center z-10 -ml-[5px]">
                                                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                                </div>
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                                                    <div className="text-[13px] text-slate-800 font-semibold mb-1.5 flex items-center gap-2">
                                                        Marks changed to <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-black">{log.awarded}</span>
                                                    </div>
                                                    <div className="text-[13px] text-slate-600 mb-3 italic bg-slate-50 p-2 rounded-lg border border-slate-100">"{log.reason}"</div>
                                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-2 border-t border-slate-100">
                                                        <span className="flex items-center gap-1.5"><i className="ti ti-user text-sm"></i> {log.examiner}</span>
                                                        <span className="flex items-center gap-1.5"><i className="ti ti-clock text-sm"></i> {log.date}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 🔥 REDESIGNED OVERRIDE TOOL (Premium Action Area) 🔥 */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border-2 border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden shadow-[0_4px_15px_rgb(0,0,0,0.02)]">
                                <div className="absolute -right-6 -top-6 text-blue-200 opacity-40 text-8xl pointer-events-none"><i className="ti ti-award"></i></div>
                                
                                <div className="relative z-10">
                                    <div className="text-[14px] text-blue-800 font-black flex items-center gap-2 mb-1">
                                        <i className="ti ti-wand text-lg"></i> Manual Grade Override
                                    </div>
                                    <div className="text-[12px] text-blue-600/80 font-semibold">
                                        Adjust the marks for this specific question.
                                    </div>
                                </div>
                                
                                <div className="relative z-10 flex items-center gap-3 bg-white p-2 rounded-xl border-2 border-blue-200 shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                                    <input 
                                        type="number" 
                                        max={q.marks} 
                                        step="0.25" 
                                        value={evalOverrides[originalQIdx] !== undefined ? evalOverrides[originalQIdx] : (d.earned || 0)} 
                                        onChange={(e) => setEvalOverrides({ ...evalOverrides, [originalQIdx]: e.target.value })} 
                                        className="w-20 p-2 text-[18px] font-black text-blue-700 bg-blue-50 border-none rounded-lg text-center outline-none"
                                    />
                                    <div className="flex flex-col pr-3">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Max</span>
                                        <span className="text-[15px] font-black text-slate-700">{q.marks}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
               );
            })}
          </div>

          {/* 🔥 PREMIUM AUDIT MODAL 🔥 */}
          {modalType === 'audit' && (
              <div className="modal-bg flex items-center justify-center p-4" style={{ zIndex: 10000, backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.7)' }}>
                  <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl transform transition-all animate-[popIn_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]">
                      
                      <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl shrink-0"><i className="ti ti-shield-check"></i></div>
                          <div>
                              <h3 className="text-xl font-black text-amber-900 m-0">Evaluation Audit</h3>
                              <p className="text-xs font-bold text-amber-700/70 uppercase tracking-widest mt-1">Transparency Log</p>
                          </div>
                      </div>

                      <div className="p-6">
                          <p className="text-sm font-semibold text-slate-600 mb-5 leading-relaxed">
                              To ensure platform integrity, please provide a clear justification for these manual overrides. This will be visible in the student's audit trail.
                          </p>
                          
                          <div className="mb-6">
                              <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">Reason for changing marks <span className="text-rose-500">*</span></label>
                              <textarea 
                                  value={auditReason} 
                                  onChange={e => setAuditReason(e.target.value)} 
                                  placeholder="e.g., 'Awarded partial marks for using the correct formula despite calculation error.'" 
                                  className="w-full min-h-[100px] p-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 outline-none transition-all text-[14px] font-medium text-slate-700 resize-y custom-scrollbar"
                              ></textarea>
                          </div>

                          <div className="flex gap-3">
                              <button className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors active:scale-95" onClick={() => setModalType(null)}>Cancel</button>
                              <button className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 transition-all active:scale-95 flex items-center justify-center gap-2" onClick={saveEvaluation}>
                                  <i className="ti ti-lock"></i> Confirm & Save
                              </button>
                          </div>
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
                  
                  {/* 🔥 SMART UI BADGE (Live, Scheduled, or Closed) */}
                  {(() => {
                      const stNow = Date.now();
                      const stClose = selectedTest.closeDate ? new Date(selectedTest.closeDate).getTime() : null;
                      const stOpen = selectedTest.openDate ? new Date(selectedTest.openDate).getTime() : null;
                      
                      let stStatus = 'live';
                      if (selectedTest.isActive === false || (stClose && stNow > stClose)) stStatus = 'closed';
                      else if (stOpen && stNow < stOpen) stStatus = 'upcoming';

                      return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', 
                              background: stStatus === 'live' ? '#d1fae5' : (stStatus === 'upcoming' ? '#fef3c7' : '#f1f5f9'), 
                              color: stStatus === 'live' ? '#065f46' : (stStatus === 'upcoming' ? '#92400e' : '#475569'), 
                              border: `1px solid ${stStatus === 'live' ? '#34d399' : (stStatus === 'upcoming' ? '#fbbf24' : '#cbd5e1')}`, 
                              padding: '8px 16px', borderRadius: '30px', fontSize: '14px', fontWeight: 700 
                          }}>
                              {stStatus === 'live' && <><span style={{ width: '10px', height: '10px', background: '#10B981', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span> Live Accepting</>}
                              {stStatus === 'upcoming' && <><i className="ti ti-clock" style={{ fontSize: '16px' }}></i> Scheduled</>}
                              {stStatus === 'closed' && <><span style={{ width: '10px', height: '10px', background: '#94a3b8', borderRadius: '50%' }}></span> Intake Closed</>}
                          </div>
                      );
                  })()}
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

                      {/*  NAYA: Configuration Card */}
                  <div className="card" style={{ borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-adjustments" style={{ color: '#854F0B' }}></i> Configuration</h3>
                      
                      <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 700, marginBottom: '12px', background: '#FEF5E5', color: '#d97706', borderColor: '#fcd34d' }} onClick={openEditSettings}>
                          <i className="ti ti-edit"></i> Edit Time & Settings
                      </button>
                      
                      <div style={{ fontSize: '14px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Duration:</strong> <span>{selectedTest.duration} Mins</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Neg. Marking:</strong> <span>{selectedTest.negMarking || 0} Marks</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Results:</strong> <span>{selectedTest.resultVis === 'instant' ? 'Instant' : 'Manual'}</span></div>
                      </div>
                  </div>
                      
                      {/*  FIX 3: Magic Recalculate Button */}
                      {/* <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontWeight: 700, background: '#FEF5E5', color: '#d97706', borderColor: '#fcd34d', marginBottom: '2rem' }} onClick={triggerMagicRecalculate}>
                          <i className="ti ti-wand"></i> Fix Corrupted Scores (Remove Double-Negative)
                      </button> */}

                      <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-share" style={{ color: '#10B981' }}></i> 1-Click Share</h3>                      <div className="grid2">
                          <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#dcf8c6', color: '#075e54', border: '1px solid #25d366' }} onClick={() => shareTest(selectedTest, 'whatsapp')}><i className="ti ti-brand-whatsapp" style={{ fontSize: '20px' }}></i> WhatsApp</button>
                          <button className="btn" style={{ justifyContent: 'center', padding: '12px', fontWeight: 600, background: '#e0f2fe', color: '#0284c7', border: '1px solid #38bdf8' }} onClick={() => shareTest(selectedTest, 'telegram')}><i className="ti ti-brand-telegram" style={{ fontSize: '20px' }}></i> Telegram</button>
                      </div>
                  </div>

                  <div className="card" style={{ borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '16px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="ti ti-settings" style={{ color: '#64748b' }}></i> Access Controls</h3>
                      
                      {/* 🔥 SMART MANUAL OVERRIDE BUTTON */}
                      {(() => {
                          const now = Date.now();
                          const closeTime = selectedTest.closeDate ? new Date(selectedTest.closeDate).getTime() : null;
                          const openTime = selectedTest.openDate ? new Date(selectedTest.openDate).getTime() : null;
                          
                          let currentStatus = 'live';
                          if (selectedTest.isActive === false || (closeTime && now > closeTime)) currentStatus = 'closed';
                          else if (openTime && now < openTime) currentStatus = 'upcoming';
                          
                          const isLive = currentStatus === 'live';

                          return (
                              <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px', marginBottom: '12px', background: isLive ? '#FCEBEB' : '#EAF3DE', color: isLive ? '#A32D2D' : '#3B6D11', borderColor: isLive ? '#A32D2D' : '#3B6D11', fontWeight: 700 }} onClick={() => toggleTestStatus(selectedTest)}>
                                  <i className={`ti ${isLive ? 'ti-lock' : 'ti-door-enter'}`}></i> {isLive ? 'Close Exam Intake' : 'Force Open Intake Now'}
                              </button>
                          );
                      })()}
                      
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
                                      
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                          <button className="btn btn-primary" style={{ padding: '8px 14px', fontWeight: 600, borderRadius: '8px', whiteSpace: 'nowrap' }} onClick={() => { setEvaluateSub({ sub: s, test: selectedTest, sIdx }); setEvalFilter('all'); }}><i className="ti ti-eye"></i> Evaluate</button>
                                          
                                          {/*  SECURITY FIX: Button sirf Admin ko ya Examiner ke khud ke demo test par dikhega */}
                                          {(userRole === 'admin' || s.uid === currentUser?.uid || s.email === currentUser?.email) && (
                                              <button 
                                                  className="btn btn-ghost" 
                                                  style={{ padding: '8px 12px', color: '#A32D2D', border: '1px solid #F7C1C1', background: '#FCEBEB', borderRadius: '8px' }}
                                                  title="Delete this demo submission"
                                                  onClick={() => deleteSubmission(sIdx, s.name)}
                                              >
                                                  <i className="ti ti-trash" style={{ margin: 0, fontSize: '18px' }}></i>
                                              </button>
                                          )}
                                      </div>
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
                                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', display: 'flex', gap: '6px' }}>
                                    <span style={{ flexShrink: 0 }}>Q{i + 1}:</span>
                                    {/* 🔥 FIX: MathJax Protector applied to Edit Key Modal */}
                                    <StaticMath isBlock={false} html={q.text} />
                                  </div>
                                  
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

         {/* 🔥 UPGRADED EDIT SETTINGS MODAL */}
          {modalType === 'editSettings' && (
              <div className="modal-bg" style={{ zIndex: 1000 }}>
                  <div className="modal-box" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                      <h3 style={{ marginBottom: '1.5rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="ti ti-adjustments"></i> Exam Configuration
                      </h3>
                      
                      <div className="grid2" style={{ gap: '15px', marginBottom: '15px' }}>
                          <div>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Duration (Mins)</label>
                              <input type="number" value={editSettingsData.duration} onChange={e => setEditSettingsData({...editSettingsData, duration: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', outline: 'none' }} />
                          </div>
                          <div>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Negative Marking</label>
                              <input type="number" step="0.25" value={editSettingsData.negMarking} onChange={e => setEditSettingsData({...editSettingsData, negMarking: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', outline: 'none' }} />
                          </div>
                      </div>

                      {/* 🔥 WAPAS AAYA HUA RESULT VISIBILITY DROPDOWN */}
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Result Visibility</label>
                      <select value={editSettingsData.resultVis} onChange={e => setEditSettingsData({...editSettingsData, resultVis: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '8px', border: '2px solid #e2e8f0', outline: 'none', background: '#fff' }}>
                          <option value="manual">Manual (Publish Later)</option>
                          <option value="instant">Instant (Show after submit)</option>
                      </select>

                      {/* 🔥 NAYA: START & END TIME GRID */}
                      <div className="grid2" style={{ gap: '15px', marginBottom: '1.5rem' }}>
                          <div>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Schedule Start (Open)</label>
                              <input type="datetime-local" value={editSettingsData.openDate} onChange={e => setEditSettingsData({...editSettingsData, openDate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', outline: 'none' }} />
                          </div>
                          <div>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>Auto-Close Intake</label>
                              <input type="datetime-local" value={editSettingsData.closeDate} onChange={e => setEditSettingsData({...editSettingsData, closeDate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid #e2e8f0', outline: 'none' }} />
                          </div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <div style={{ fontWeight: 700, color: '#185FA5', fontSize: '14px' }}><i className="ti ti-radar"></i> Show on Student Radar?</div>
                              <label className="toggle">
                                  <input type="checkbox" checked={editSettingsData.radarVisible} onChange={e => setEditSettingsData({...editSettingsData, radarVisible: e.target.checked})} />
                                  <span className="tog-slider"></span>
                              </label>
                          </div>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px 0' }}>If OFF, students won't see this test even if they follow you. (Keeps test hidden as Draft).</p>
                          
                          {editSettingsData.radarVisible && (
                              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Message / Note for Students (Optional)</label>
                                  <textarea value={editSettingsData.radarNote} onChange={e => setEditSettingsData({...editSettingsData, radarNote: e.target.value})} placeholder="e.g. Bring your calculators..." style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', minHeight: '60px', resize: 'vertical' }}></textarea>
                              </div>
                          )}
                      </div>

                      <div style={{ background: '#ecfdf5', padding: '15px', borderRadius: '10px', border: '1px solid #a7f3d0', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <div style={{ fontWeight: 700, color: '#059669', fontSize: '14px' }}><i className="ti ti-bolt"></i> Enable Direct Entry</div>
                              <label className="toggle">
                                  <input type="checkbox" checked={editSettingsData.directEntry} onChange={e => setEditSettingsData({...editSettingsData, directEntry: e.target.checked})} />
                                  <span className="tog-slider"></span>
                              </label>
                          </div>
                          <p style={{ fontSize: '12px', color: '#065f46', margin: 0, opacity: 0.8 }}>
                              If ON, students who saved their Roll Number in profile can join instantly without entering the exam code. (Default: OFF)
                          </p>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                          <button className="btn" style={{ flex: 1, padding: '12px', fontWeight: 600, justifyContent: 'center' }} onClick={() => setModalType(null)}>Cancel</button>
                          <button className="btn btn-primary" style={{ flex: 1, padding: '12px', fontWeight: 600, justifyContent: 'center' }} onClick={saveTestSettings}><i className="ti ti-device-floppy"></i> Save Config</button>
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
       <div style={{ padding: '1.5rem 1rem', paddingBottom: '40vh', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
            
            {/* 🔥 MODERN ULTRA-COMPACT HEADER (NO-WRAP MOBILE FIX) */}
            <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '8px' }}>
                
                {/* Left Side: Title & Subtitle (With Truncation for small screens) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 'clamp(18px, 5vw, 22px)', fontWeight: 800, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <i className="ti ti-vault" style={{ color: '#185FA5', fontSize: 'clamp(20px, 5vw, 24px)', flexShrink: 0 }}></i> 
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>My Tests Vault</span>
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Manage assessments, control intakes, and review results.
                    </p>
                </div>
                
                {/* 🔥 SLEEK FOLLOWERS PILL (Micro-sized & Locked) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', flexShrink: 0 }}>
                    <i className="ti ti-users" style={{ fontSize: '15px', color: '#185FA5' }}></i>
                    <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#0f172a', fontWeight: 800 }}>{followerCount}</span> <span className="hide-mobile">Followers</span>
                    </div>
                </div>
            </div>

            {myTests.length === 0 ? (
                /* Empty State UI */
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center min-h-[350px]">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-5">
                        <i className="ti ti-folder-off text-4xl text-slate-400"></i>
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">Your Vault is Empty</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-8 text-sm leading-relaxed">
                        You haven't created any assessments yet. Click the button below to start building your first secure test.
                    </p>
                    <button className="btn btn-primary" style={{ padding: '12px 24px', fontWeight: 600, fontSize: '15px' }} onClick={() => router.push('/create')}>
                        <i className="ti ti-plus"></i> Create New Test
                    </button>
                </div>
            ) : (
                <>
                    {/*  Inline Search & Sort Panel */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '1.25rem', width: '100%' }}>
                        
                        {/* Instant Search Bar */}
                        <div style={{ position: 'relative', flex: 1 }}>
                            <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '16px' }}></i>
                            <input 
                                ref={searchRef} //  Added Ref for keyboard focus
                                type="text" 
                                placeholder="Search tests... (Press '/')" // Indicator for PC users
                                value={vaultSearchQuery}
                                onChange={(e) => setVaultSearchQuery(e.target.value)}
                                style={{ padding: '10px 10px 10px 36px', width: '100%', borderRadius: '10px', border: '1px solid var(--color-border-primary)', background: 'var(--color-background-primary)', fontSize: '14px', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        
                        {/* Premium Dropdown with Integrated Status Filters */}
                        <div style={{ position: 'relative', width: '110px', flexShrink: 0 }}>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                style={{ padding: '10px 24px 10px 10px', width: '100%', borderRadius: '10px', border: '1px solid var(--color-border-primary)', background: 'var(--color-background-primary)', fontSize: '13px', fontWeight: 600, appearance: 'none', cursor: 'pointer', color: 'var(--color-text-primary)' }}
                            >
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="alphabetical">A - Z</option>
                                <option value="live">🟢 Live</option> {/*  Status option added */}
                                <option value="closed">⚪ Closed</option> {/*  Status option added */}
                            </select>
                            <i className="ti ti-sort-descending" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none', fontSize: '16px' }}></i>
                        </div>
                    </div>

                    {/*  FILTERING, SORTING & RENDERING ENGINE */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {(() => {
                            // 1. Filter by Search Query AND Dropdown Status
                            let filtered = myTests.filter(t => {
                                const sq = vaultSearchQuery.toLowerCase();
                                const matchesSearch = !vaultSearchQuery || (t.title?.toLowerCase().includes(sq) || t.code?.toLowerCase().includes(sq) || t.subject?.toLowerCase().includes(sq));
                                
                                const isLive = t.isActive !== false;
                                let matchesStatus = true;
                                if (sortBy === 'live') matchesStatus = isLive;
                                if (sortBy === 'closed') matchesStatus = !isLive;
                                
                                return matchesSearch && matchesStatus;
                            });

                            // 2. Sort Logic (Handles fallback inner chronological order for live/closed status)
                            filtered.sort((a, b) => {
                                const idA = String(a.id || '');
                                const idB = String(b.id || '');
                                
                                if (sortBy === 'newest' || sortBy === 'live' || sortBy === 'closed') return idB.localeCompare(idA); 
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
                                // 🔥 NAYA TIME-BASED STATUS LOGIC
                                const now = Date.now();
                                const closeTime = t.closeDate ? new Date(t.closeDate).getTime() : null;
                                const openTime = t.openDate ? new Date(t.openDate).getTime() : null;
                                
                                let status = 'live';
                                if (t.isActive === false || (closeTime && now > closeTime)) status = 'closed';
                                else if (openTime && now < openTime) status = 'upcoming';

                                const subCount = t.submissions ? t.submissions.length : 0;
                                
                                return (
                                    <div 
                                        key={t.id || i} 
                                        className="test-entry" 
                                        style={{ 
                                            cursor: 'pointer', 
                                            // 🔥 Status ke hisaab se border color change
                                            borderLeft: t.isLocal ? '4px solid #f59e0b' : (status === 'live' ? '4px solid #3B6D11' : (status === 'upcoming' ? '4px solid #f59e0b' : '4px solid #cbd5e1')),
                                            opacity: 0,
                                            animation: `staggerSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                                            animationDelay: `${(i > 10 ? 10 : i) * 0.06}s`, 
                                            padding: '1.25rem 1rem', 
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
                                                
                                                {/* 🔥 Status ke hisaab se Badge */}
                                                {!t.isLocal && status === 'live' && (
                                                    <span className="badge b-green" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '11px' }}>
                                                        <span style={{ width: '6px', height: '6px', background: '#27500A', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span> Live
                                                    </span>
                                                )}
                                                {!t.isLocal && status === 'upcoming' && (
                                                    <span className="badge b-amber" style={{ padding: '2px 8px', fontSize: '11px' }}>Scheduled</span>
                                                )}
                                                {!t.isLocal && status === 'closed' && (
                                                    <span className="badge b-gray" style={{ padding: '2px 8px', fontSize: '11px' }}>Closed</span>
                                                )}
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

      {/*  ROOT LEVEL SYSTEM POPUPS */}
      
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

      {/* 🔥 NAYA: PREMIUM FLOATING SCROLL TO TOP BUTTON */}
      {showScrollTop && (
          <button 
              onClick={scrollToTop}
              title="Back to Top"
              style={{ 
                  position: 'fixed', 
                  bottom: '30px', 
                  right: '30px', 
                  zIndex: 9998, 
                  width: '50px', 
                  height: '50px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #185FA5, #3C3489)', 
                  color: '#fff', 
                  border: 'none', 
                  boxShadow: '0 10px 25px rgba(24,95,165,0.4)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer', 
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  animation: 'fadeIn 0.3s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(24,95,165,0.5)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(24,95,165,0.4)'; }}
          >
              <i className="ti ti-arrow-up" style={{ fontSize: '24px' }}></i>
          </button>
      )}
    </>
  );
}