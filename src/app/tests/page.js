// src/app/tests/page.js
'use client';
import { useState, useEffect, useRef, memo } from 'react'; // 🔥 FIX: memo import kiya
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, set, update, remove, get, onValue } from 'firebase/database'; 
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
  const [liveCount, setLiveCount] = useState(0);
  

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

  // 🔥 NAYA FIX: AUTO-SCROLL TO TOP ON TEST OPEN/CLOSE 🔥
  useEffect(() => {
      if (typeof window !== 'undefined') {
          // Jab bhi 'selectedTest' change hoga (kisi test ko kholne ya band karne par), page smoothly top par jayega
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [selectedTest]);

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

  useEffect(() => {
      // Jab bhi koi test open hoga, ye listener background me active ho jayega
      if (!selectedTest?.id || isOffline) return;
      const liveRef = ref(database, `live_sessions/${selectedTest.id}`);
      
      const unsubscribe = onValue(liveRef, (snapshot) => {
          const data = snapshot.val();
          // Data me active users ki keys hongi, unki length = Live Students
          setLiveCount(data ? Object.keys(data).length : 0);
      });
      return () => unsubscribe(); // Cleanup jab test close ho
  }, [selectedTest?.id, isOffline]);

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

  // Helper for Time Formatting 
  const formatQTime = (seconds) => {
      if (!seconds) return '00s';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <>
      {evaluateSub ? (
        // ==========================================
        // VIEW 3: EVALUATE PAPER
        // ==========================================
        <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
          
          {/* STATIC PREMIUM EVALUATION NAVBAR */}
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

         {/* EXAMINER PRO DASHBOARD (Ultra-Compact, Data-Driven) */}
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
                                  {/* 🔥 NAYA: DYNAMIC TIME TAKEN BADGE 🔥 */}
                                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-[13px] bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                                      <i className="ti ti-clock text-slate-500"></i> 
                                      {(() => {
                                          let displayTimeStr = evaluateSub.sub.timeTaken || <span className="opacity-60 text-[11px]">N/A</span>;
                                          if (evaluateSub.sub.timeSpentPerQuestion) {
                                              let totalSecs = 0;
                                              evaluateSub.sub.details.forEach((dt, idx) => {
                                                  const sec = dt.q.section || 'General';
                                                  if (evalSectionFilter === 'all_sections' || sec === evalSectionFilter || (!dt.q.section && evalSectionFilter === (evaluateSub.test.sections?.[0]))) {
                                                      totalSecs += (evaluateSub.sub.timeSpentPerQuestion[idx] || 0);
                                                  }
                                              });
                                              if (totalSecs > 0) displayTimeStr = formatQTime(totalSecs);
                                          }
                                          return <>{evalSectionFilter === 'all_sections' ? 'Total: ' : 'Section: '} {displayTimeStr}</>;
                                      })()}
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

          {/* 🔥 PREMIUM QUESTION REVIEW CARDS (Examiner Mode - Split Grid) 🔥 */}
          <div style={{ opacity: isEvalMathReady ? 1 : 0.05, transition: 'opacity 0.2s ease-in', minHeight: '50vh' }} className="flex flex-col gap-6">
            
            {/* CSS Hack for SVGs */}
            <style>{`.svg-eval-container svg { max-width: 100%; height: auto; max-height: 280px; min-height: 100px; }`}</style>

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
                    <div className={`px-4 py-3 ${sColor.header} border-b ${sColor.border} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                        <div className={`flex items-center gap-2 font-black ${sColor.text} text-[15px]`}>
                            <i className={`ti ${sColor.icon} text-[20px]`}></i>
                            <span>Q{originalQIdx + 1} <span className="opacity-40 mx-1">|</span> <span className="font-semibold text-xs uppercase tracking-wide">{getLabel(q.type)}</span></span>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            
                            {/*  NAYA: INDIVIDUAL QUESTION TIME BADGE  */}
                            <span className="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold bg-white border border-slate-200 text-slate-600 shadow-sm flex items-center gap-1.5" title="Time taken by student on this question">
                                <i className="ti ti-stopwatch text-slate-400 text-sm"></i> 
                                {formatQTime(evaluateSub.sub.timeSpentPerQuestion?.[originalQIdx])}
                            </span>

                            <span className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold bg-slate-800 text-white shadow-sm flex items-center gap-1.5">
                                <i className="ti ti-target"></i> Earned: {d.earned || 0} / {q.marks}
                            </span>
                        </div>
                    </div>

                    {/* Split Grid Body Section */}
                    <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 w-full">
                        
                        {/* LEFT COLUMN: Question Text & Universal Figure */}
                        <div className="flex flex-col gap-4">
                            <StaticMath isBlock={true} html={q.text} className="text-[15px] sm:text-[16px] leading-relaxed text-slate-800 font-semibold whitespace-normal break-words" />
                            
                            {q.figureType && q.figureType !== 'none' && q.figureData && (
                                <div className="flex justify-center w-full bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                    {(q.figureType === 'image' || q.figureType === 'url') && (
                                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                            <img src={q.figureData} alt="Figure" className="max-w-full max-h-[220px] object-contain" onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x150/f8fafc/ef4444?text=Image+Load+Failed'; }} />
                                        </div>
                                    )}
                                    {q.figureType === 'svg' && (
                                        <div className="svg-eval-container w-full bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: q.figureData }} />
                                    )}
                                    {q.figureType === 'smiles' && (
                                        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm inline-block">
                                            <SmilesViewer smilesCode={q.figureData} width={200} height={200} />
                                        </div>
                                    )}
                                    {q.figureType === 'tikz' && (
                                        <div className="hide-scroll max-w-full overflow-x-auto bg-white p-2 rounded-lg border border-slate-200 shadow-sm inline-block">
                                            <img src={`https://i.upmath.me/svg/${encodeURIComponent('\\begin{tikzpicture}\n' + q.figureData + '\n\\end{tikzpicture}')}`} alt="Math Graphic" className="max-w-full max-h-[200px] object-contain" onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x150/f8fafc/ef4444?text=TikZ+Failed'; }} />
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Fallback Legacy Image */}
                            {!q.figureType && q.imgUrl && (
                                <div className="flex justify-center w-full bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                    <img src={q.imgUrl} className="max-w-full max-h-[220px] rounded-lg border border-slate-200 object-contain bg-white shadow-sm" alt="Legacy Figure" />
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Options, Logic, Audit & Override */}
                        <div className="flex flex-col gap-4">
                            {/* MCQ / MSQ Options */}
                            {(q.type === 'mcq' || q.type === 'msq') && (
                                <div className="flex flex-col gap-2.5">
                                    {q.options.map((o, j) => {
                                        let isUser = userSel.includes(j);
                                        let isCorr = corrSel.includes(j);
                                        let optBg = 'bg-slate-50', optBorder = 'border-slate-200', optText = 'text-slate-700', iconUi = null;
                                        
                                        if (isCorr && isUser) { optBg = 'bg-emerald-50 shadow-[0_0_0_1px_#10b981]'; optBorder = 'border-emerald-500'; optText = 'text-emerald-900 font-bold'; iconUi = <i className="ti ti-check text-xl text-emerald-600"></i>; }
                                        else if (isCorr && !isUser) { optBg = 'bg-white border-dashed border-2'; optBorder = 'border-emerald-400'; optText = 'text-emerald-800 font-bold'; iconUi = <i className="ti ti-check text-xl text-emerald-400 opacity-60"></i>; }
                                        else if (!isCorr && isUser) { optBg = 'bg-rose-50 shadow-[0_0_0_1px_#ef4444]'; optBorder = 'border-rose-500'; optText = 'text-rose-900 font-bold'; iconUi = <i className="ti ti-x text-xl text-rose-600"></i>; }

                                        return (
                                            <div key={j} className={`flex items-start gap-3 p-3 rounded-xl border-2 ${optBg} ${optBorder} transition-all w-full overflow-hidden`}>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 border-2 bg-white ${isCorr && isUser ? 'border-emerald-500 text-emerald-600' : (!isCorr && isUser) ? 'border-rose-500 text-rose-600' : 'border-slate-300 text-slate-500'}`}>
                                                    {String.fromCharCode(65 + j)}
                                                </div>
                                                <div className="flex-1 flex flex-col gap-1.5 min-w-0 pt-0.5">
                                                    {o.startsWith('[smiles]') ? (
                                                        <div className="bg-white p-1.5 rounded-lg border border-slate-200 inline-block w-fit pointer-events-none">
                                                            <SmilesViewer smilesCode={o.replace('[smiles]', '').trim()} width={120} height={120} />
                                                        </div>
                                                    ) : (
                                                        <StaticMath isBlock={true} html={o} className={`text-[14px] sm:text-[14.5px] whitespace-normal break-words ${optText}`} />
                                                    )}
                                                    {(isUser || isCorr) && (
                                                        <div className="flex gap-2 mt-1">
                                                            {isUser && <span className="text-[9px] uppercase font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-sm"><i className="ti ti-hand-click"></i> Picked</span>}
                                                            {isCorr && <span className="text-[9px] uppercase font-extrabold bg-emerald-500 text-white px-1.5 py-0.5 rounded shadow-sm"><i className="ti ti-key"></i> Key</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="shrink-0 mt-0.5">{iconUi}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Integer Type */}
                            {q.type === 'integer' && (
                                <div className="flex gap-3">
                                    <div className={`flex-1 p-3 sm:p-4 rounded-xl border-2 flex flex-col justify-center ${d.status === 'correct' ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-rose-50 border-rose-400 text-rose-900'}`}>
                                        <span className="text-[10px] uppercase font-extrabold opacity-70 mb-0.5">Student Answer</span>
                                        <strong className="text-2xl">{ans.val !== null ? ans.val : '—'}</strong>
                                    </div>
                                    <div className="flex-1 p-3 sm:p-4 rounded-xl border-2 border-emerald-400 bg-white text-emerald-900 flex flex-col justify-center relative overflow-hidden shadow-sm">
                                        <i className="ti ti-key absolute -right-2 -bottom-2 text-5xl text-emerald-50"></i>
                                        <span className="text-[10px] uppercase font-extrabold opacity-70 mb-0.5 relative z-10">Correct Key</span>
                                        <strong className="text-2xl relative z-10">{q.correctInt}</strong>
                                    </div>
                                </div>
                            )}

                            {/* Subjective Type */}
                            {q.type === 'subjective' && (
                                <div className="flex flex-col gap-3">
                                    <div className="p-4 rounded-xl border-2 bg-slate-50 border-slate-200 flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm"><i className="ti ti-pencil text-slate-700"></i></div>
                                        <div>
                                            <span className="text-[10px] uppercase font-extrabold text-slate-500 mb-1 block">Student Answer</span>
                                            <span className="text-[14px] leading-relaxed text-slate-800 font-medium">{ans.val || <em className="text-slate-400">No answer written.</em>}</span>
                                        </div>
                                    </div>
                                    {q.modelAnswer && (
                                        <div className="p-4 rounded-xl border-2 bg-emerald-50 border-emerald-300 flex gap-3 items-start">
                                            <div className="w-8 h-8 rounded-full bg-white border border-emerald-200 flex items-center justify-center shrink-0 shadow-sm"><i className="ti ti-bulb text-emerald-600"></i></div>
                                            <div>
                                                <span className="text-[10px] uppercase font-extrabold text-emerald-700 mb-1 block">Model Answer</span>
                                                <span className="text-[14px] leading-relaxed text-emerald-900 font-medium">{q.modelAnswer}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Smart Accordion Explanation */}
                            {q.explanation && (
                                <details className="group bg-slate-50 rounded-xl border border-slate-200 overflow-hidden transition-all duration-300">
                                    <summary className="cursor-pointer p-3 sm:p-4 font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-colors select-none">
                                        <span className="flex items-center gap-2 text-[13px]"><i className="ti ti-bulb text-lg text-slate-500"></i> View Solution / Logic</span>
                                        <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-open:bg-slate-700 group-open:text-white transition-colors">
                                            <i className="ti ti-chevron-down transform group-open:rotate-180 transition-transform duration-300 text-xs"></i>
                                        </div>
                                    </summary>
                                    <div className="p-4 border-t border-slate-200 text-[13.5px] text-slate-700 leading-relaxed font-medium bg-white">
                                        <StaticMath isBlock={true} html={q.explanation} className="math-scroll-box" />
                                    </div>
                                </details>
                            )}

                            {/* Audit & Overrides Zone */}
                            <div className="mt-auto flex flex-col gap-2.5 pt-4">
                                {d.auditLogs && d.auditLogs.length > 0 && (
                                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                                        <div className="text-[10px] uppercase font-extrabold tracking-widest mb-1.5 flex items-center gap-1.5 text-amber-700"><i className="ti ti-history text-sm"></i> Evaluation Audit Log</div>
                                        <div className="flex flex-col gap-1.5 mt-2">
                                            {d.auditLogs.map((log, lIdx) => (
                                                <div key={lIdx} className="bg-white px-3 py-2 rounded-lg border border-amber-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                                    <div className="flex items-center gap-2 text-[12px]">
                                                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black shrink-0">{log.awarded} Mk</span>
                                                        <span className="text-amber-800/80 truncate max-w-[180px] italic">"{log.reason}"</span>
                                                    </div>
                                                    <div className="text-[9px] font-bold text-amber-500/70 uppercase tracking-wider shrink-0">{log.examiner} • {log.date.split(',')[0]}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Compact Grade Override Tool */}
                                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 shadow-inner">
                                            <i className="ti ti-wand text-lg"></i>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[13px] font-bold text-blue-900 leading-none mb-1">Grade Override</span>
                                            <span className="text-[10px] font-semibold text-blue-600/70 leading-none">Update manual marks</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200 shadow-inner focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all ml-auto">
                                        <input 
                                            type="number" 
                                            max={q.marks} 
                                            step="0.25" 
                                            value={evalOverrides[originalQIdx] !== undefined ? evalOverrides[originalQIdx] : (d.earned || 0)} 
                                            onChange={(e) => setEvalOverrides({ ...evalOverrides, [originalQIdx]: e.target.value })} 
                                            className="w-14 sm:w-16 text-[15px] font-black text-blue-700 bg-transparent text-center outline-none"
                                            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                                        />
                                        <div className="w-px h-5 bg-slate-200"></div>
                                        <div className="text-[11px] font-extrabold text-slate-400 pr-1 shrink-0">/ {q.marks}</div>
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
          
          {/* 🔥 PREMIUM TEST DASHBOARD HEADER & TABS 🔥 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <button 
                  className="flex w-fit items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors active:scale-95 text-sm" 
                  onClick={() => setSelectedTest(null)}
              >
                  <i className="ti ti-arrow-left text-lg"></i> Back
              </button>
              
              <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 w-full sm:w-fit overflow-hidden">
                  <button 
                      className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'overview' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                      onClick={() => setActiveTab('overview')}
                  >
                      <i className="ti ti-dashboard"></i> Overview
                  </button>
                  <button 
                      className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'subs' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                      onClick={() => setActiveTab('subs')}
                  >
                      <i className="ti ti-users"></i> Subs
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'subs' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                          {selectedTest.submissions ? selectedTest.submissions.length : 0}
                      </span>
                  </button>
              </div>
          </div>

          {/* ULTRA-COMPACT DASHBOARD HERO CARD  */}
          <div className="bg-slate-900 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 shadow-lg border border-slate-800 relative overflow-hidden mb-6">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500"></div>
              
              {/* Left Column (Title & Info) */}
              <div className="flex flex-col min-w-0 z-10 w-full sm:w-auto">
                  <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] font-extrabold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          {selectedTest.subject || 'General'}
                      </span>
                      {selectedTest.isLocal && <span className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1"><i className="ti ti-device-floppy"></i> Local</span>}
                  </div>
                  
                  <h2 className="text-[18px] sm:text-xl font-black text-white mb-2.5 tracking-tight leading-snug truncate">{selectedTest.title}</h2>
                  
                  <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-bold text-slate-300">
                      <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50 font-mono text-[10px] sm:text-[11px] shadow-sm"><i className="ti ti-hash opacity-50"></i> {selectedTest.code}</span>
                      <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50 flex items-center gap-1 shadow-sm"><i className="ti ti-clock text-blue-400"></i> {selectedTest.duration}m</span>
                      <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50 flex items-center gap-1 shadow-sm"><i className="ti ti-target text-emerald-400"></i> {selectedTest.totalMarks} Mks</span>
                  </div>
              </div>

              {/* Right Column (Status & Live Counter - Flex Row on Mobile) */}
              <div className="shrink-0 z-10 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2.5 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-700/50 sm:border-none">
                  
                  {/* Status Badge */}
                  {(() => {
                      const stNow = Date.now();
                      const stClose = selectedTest.closeDate ? new Date(selectedTest.closeDate).getTime() : null;
                      const stOpen = selectedTest.openDate ? new Date(selectedTest.openDate).getTime() : null;
                      
                      let stStatus = 'live';
                      if (selectedTest.isActive === false || (stClose && stNow > stClose)) stStatus = 'closed';
                      else if (stOpen && stNow < stOpen) stStatus = 'upcoming';

                      return (
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-black text-[10px] uppercase tracking-widest border ${stStatus === 'live' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : (stStatus === 'upcoming' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-800/50 text-slate-400 border-slate-700/50')}`}>
                              {stStatus === 'live' && <><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Active</>}
                              {stStatus === 'upcoming' && <><i className="ti ti-clock text-xs"></i> Scheduled</>}
                              {stStatus === 'closed' && <><i className="ti ti-lock text-xs"></i> Closed</>}
                          </div>
                      );
                  })()}
                  
                  {/* REDESIGNED SLEEK LIVE COUNTER BADGE */}
                  {liveCount > 0 ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 border border-rose-500/30 rounded-full text-white font-bold text-[11px] shadow-sm backdrop-blur-md">
                          <div className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600 shadow-[0_0_6px_#e11d48]"></span>
                          </div>
                          <span>{liveCount} <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] ml-0.5">In Exam</span></span>
                      </div>
                  ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/50 border border-slate-700/50 rounded-full text-slate-400 font-bold text-[11px]">
                          <span className="w-1.5 h-1.5 bg-slate-600 rounded-full"></span>
                          <span>0 <span className="font-semibold uppercase tracking-wider text-[9px] ml-0.5">In Exam</span></span>
                      </div>
                  )}
              </div>
          </div>

          {/* 🔥 MAIN OVERVIEW CONTENT (Perfect Layout via React Variables) 🔥 */}
          {activeTab === 'overview' && (() => {

              const intakeCard = (
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-5">
                      <div className="flex-1 text-center sm:text-left">
                          <h3 className="text-[13px] sm:text-[14px] font-extrabold text-slate-800 uppercase tracking-widest mb-1.5 flex items-center justify-center sm:justify-start gap-2">
                              <i className="ti ti-door-enter text-blue-600 text-lg"></i> Exam Intake Access
                          </h3>
                          <p className="text-[12px] sm:text-[13px] text-slate-500 font-semibold leading-relaxed">
                              Control whether students can join this test right now. Locking the intake will prevent any new students from starting the exam.
                          </p>
                      </div>
                      {(() => {
                          const now = Date.now();
                          const closeTime = selectedTest.closeDate ? new Date(selectedTest.closeDate).getTime() : null;
                          const openTime = selectedTest.openDate ? new Date(selectedTest.openDate).getTime() : null;
                          let isLive = !(selectedTest.isActive === false || (closeTime && now > closeTime));
                          
                          return (
                              <button 
                                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm text-sm sm:text-base shrink-0 ${isLive ? 'bg-rose-50 text-rose-700 border-2 border-rose-200 hover:bg-rose-100 hover:border-rose-300' : 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'}`} 
                                  onClick={() => toggleTestStatus(selectedTest)}
                              >
                                  <i className={`ti ${isLive ? 'ti-lock' : 'ti-door-enter'} text-xl`}></i> {isLive ? 'Lock Exam Intake' : 'Open Intake Now'}
                              </button>
                          );
                      })()}
                  </div>
              );

              const settingsCard = (
                  <div className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                      <i className="ti ti-settings absolute -right-4 -top-4 text-slate-200 text-7xl sm:text-8xl pointer-events-none opacity-50"></i>
                      
                      <div>
                          <div className="flex items-center justify-between mb-5 relative z-10">
                              <h3 className="text-[13px] font-extrabold text-slate-600 uppercase tracking-widest flex items-center gap-1.5"><i className="ti ti-adjustments text-slate-700 text-lg"></i> Exam Settings</h3>
                              <button className="text-[11px] sm:text-[12px] font-bold text-blue-700 bg-blue-100/80 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors shadow-sm" onClick={openEditSettings}>Edit Settings</button>
                          </div>
                          
                          <div className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm relative z-10">
                              <div className="flex justify-between items-center p-3.5 border-b border-slate-100">
                                  <span className="text-[12px] sm:text-[13px] font-bold text-slate-500">Duration</span>
                                  <span className="text-[13px] sm:text-[14px] font-black text-slate-800">{selectedTest.duration} Mins</span>
                              </div>
                              <div className="flex justify-between items-center p-3.5 border-b border-slate-100">
                                  <span className="text-[12px] sm:text-[13px] font-bold text-slate-500">Neg. Marking</span>
                                  <span className="text-[13px] sm:text-[14px] font-black text-rose-600">-{selectedTest.negMarking || 0}</span>
                              </div>
                              <div className="flex justify-between items-center p-3.5 border-b border-slate-100">
                                  <span className="text-[12px] sm:text-[13px] font-bold text-slate-500">Results Type</span>
                                  <span className="text-[13px] sm:text-[14px] font-black text-slate-800">{selectedTest.resultVis === 'instant' ? 'Instant' : 'Manual'}</span>
                              </div>
                              <div className="flex justify-between items-center p-3.5 border-b border-slate-100 bg-slate-50/50">
                                  <span className="text-[12px] font-bold text-slate-500">Radar Visibility</span>
                                  {selectedTest.radarVisible ? (
                                      <span className="text-[11px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1"><i className="ti ti-eye text-[10px]"></i> VISIBLE</span>
                                  ) : (
                                      <span className="text-[11px] font-extrabold bg-slate-200 text-slate-600 px-2 py-0.5 rounded border border-slate-300 flex items-center gap-1"><i className="ti ti-eye-off text-[10px]"></i> HIDDEN</span>
                                  )}
                              </div>
                              <div className="flex justify-between items-center p-3.5 bg-slate-50/50">
                                  <span className="text-[12px] sm:text-[13px] font-bold text-slate-500">Direct Entry</span>
                                  {selectedTest.directEntry ? (
                                      <span className="text-[11px] font-extrabold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1"><i className="ti ti-check text-[10px]"></i> ON</span>
                                  ) : (
                                      <span className="text-[11px] font-extrabold bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">OFF</span>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              );

              const toolsCard = (
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h3 className="text-[12px] sm:text-[13px] font-extrabold text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-1.5"><i className="ti ti-apps text-blue-500 text-lg"></i> Management Tools</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Demo Test */}
                          <button onClick={() => autoJoinLocalTest(selectedTest.code)} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-blue-50 hover:border-blue-200 transition-all text-left group shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-blue-600 group-hover:scale-105 transition-transform"><i className="ti ti-player-play text-xl"></i></div>
                              <div>
                                  <div className="font-bold text-[14px] sm:text-[15px] text-slate-800 group-hover:text-blue-700">Demo Test</div>
                                  <div className="text-[11px] sm:text-[12px] text-slate-500 font-semibold mt-0.5">Experience as student</div>
                              </div>
                          </button>
                          {/* Print Paper */}
                          <button onClick={() => printTestPaper(selectedTest)} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all text-left group shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-indigo-600 group-hover:scale-105 transition-transform"><i className="ti ti-printer text-xl"></i></div>
                              <div>
                                  <div className="font-bold text-[14px] sm:text-[15px] text-slate-800 group-hover:text-indigo-700">Print Paper</div>
                                  <div className="text-[11px] sm:text-[12px] text-slate-500 font-semibold mt-0.5">Generate PDF copy</div>
                              </div>
                          </button>
                          {/* Edit Key */}
                          <button onClick={openEditKey} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-amber-50 hover:border-amber-200 transition-all text-left group shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-amber-600 group-hover:scale-105 transition-transform"><i className="ti ti-key text-xl"></i></div>
                              <div>
                                  <div className="font-bold text-[14px] sm:text-[15px] text-slate-800 group-hover:text-amber-700">Edit Answer Key</div>
                                  <div className="text-[11px] sm:text-[12px] text-slate-500 font-semibold mt-0.5">Fix errors & Auto-Regrade</div>
                              </div>
                          </button>
                          {/* Analytics */}
                          <button onClick={() => setModalType('analytics')} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 transition-all text-left group shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                              <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-emerald-600 group-hover:scale-105 transition-transform"><i className="ti ti-chart-pie text-xl"></i></div>
                              <div>
                                  <div className="font-bold text-[14px] sm:text-[15px] text-slate-800 group-hover:text-emerald-700">View Analytics</div>
                                  <div className="text-[11px] sm:text-[12px] text-slate-500 font-semibold mt-0.5">Class performance stats</div>
                              </div>
                          </button>
                      </div>
                  </div>
              );

              const resultsAndSharingCard = (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <h3 className="text-[12px] sm:text-[13px] font-extrabold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i className="ti ti-file-certificate text-indigo-500 text-lg"></i> Assessment Results</h3>
                          {!selectedTest.released && selectedTest.resultVis === 'manual' ? (
                              <button className="w-full p-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-700 transition-all active:scale-95 text-sm" onClick={() => publishResults(selectedTest)}>
                                  <i className="ti ti-send text-xl"></i> Publish Now
                              </button>
                          ) : (
                              <div className="w-full p-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-slate-50 text-slate-500 border border-slate-200 text-sm">
                                  <i className={`ti ${selectedTest.resultVis === 'instant' ? 'ti-bolt text-amber-500' : 'ti-check text-emerald-500'} text-xl`}></i> 
                                  {selectedTest.resultVis === 'instant' ? 'Instant Access Active' : 'Results Published'}
                              </div>
                          )}
                      </div>
                      
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <h3 className="text-[12px] sm:text-[13px] font-extrabold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-1.5"><i className="ti ti-share text-emerald-500 text-lg"></i> Quick Sharing</h3>
                          <div className="flex gap-2">
                              <button className="flex-1 p-3 rounded-xl bg-[#25d366]/10 text-[#075e54] hover:bg-[#25d366]/20 transition-all active:scale-95 flex items-center justify-center shadow-sm border border-[#25d366]/20" onClick={() => shareTest(selectedTest, 'whatsapp')} title="Share via WhatsApp">
                                  <i className="ti ti-brand-whatsapp text-2xl"></i>
                              </button>
                              <button className="flex-1 p-3 rounded-xl bg-[#0088cc]/10 text-[#0088cc] hover:bg-[#0088cc]/20 transition-all active:scale-95 flex items-center justify-center shadow-sm border border-[#0088cc]/20" onClick={() => shareTest(selectedTest, 'telegram')} title="Share via Telegram">
                                  <i className="ti ti-brand-telegram text-2xl"></i>
                              </button>
                          </div>
                      </div>
                  </div>
              );

              const dangerCard = (
                  <div className="bg-white p-5 sm:p-6 rounded-2xl border border-rose-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
                      <div className="relative z-10">
                          <h3 className="text-[13px] font-extrabold text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2"><i className="ti ti-alert-triangle text-lg"></i> Danger Zone</h3>
                          <p className="text-[12px] font-semibold text-slate-500 mb-5 leading-relaxed">
                              Irreversible action. Deletes all questions, analytics, and student submissions permanently.
                          </p>
                      </div>
                      <button className="w-full py-3 bg-rose-50 border-2 border-rose-200 text-rose-700 font-bold text-sm rounded-xl hover:bg-rose-100 hover:border-rose-300 transition-all active:scale-95 flex items-center justify-center gap-2 relative z-10 shadow-sm" onClick={() => triggerDelete(selectedTest)}>
                          <i className="ti ti-trash text-lg"></i> Delete Entire Test
                      </button>
                  </div>
              );

             return (
                  <>
                      {/* 🔥 BULLETPROOF CSS LAYOUT (Bypasses Tailwind Compile Issues) 🔥 */}
                      <style>{`
                          .overview-mobile-layout { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem; width: 100%; }
                          .overview-desktop-layout { display: none; width: 100%; gap: 1.5rem; margin-bottom: 2rem; align-items: flex-start; }
                          
                          /* 950px safe breakpoint for all laptops/tablets */
                          @media (min-width: 950px) {
                              .overview-mobile-layout { display: none !important; }
                              .overview-desktop-layout { display: flex !important; }
                          }
                      `}</style>

                      {/* 📱 MOBILE & TABLET LAYOUT */}
                      {/* Logical Flow: Intake -> Settings -> Tools -> Results -> Danger */}
                      <div className="overview-mobile-layout">
                          {intakeCard}
                          {settingsCard}
                          {toolsCard}
                          {resultsAndSharingCard}
                          {dangerCard}
                      </div>

                      {/* 💻 DESKTOP LAYOUT (2 Columns - No Vertical Stretching!) */}
                      <div className="overview-desktop-layout">
                          
                          {/* Left Column (Fixed 62% Width - Tools & Core Actions) */}
                          <div style={{ flex: '0 0 62%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                              {intakeCard}
                              {toolsCard}
                              {resultsAndSharingCard}
                          </div>
                          
                          {/* Right Column (Fills remaining space - Settings & Danger) */}
                          <div style={{ flex: '1', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                              {settingsCard}
                              {dangerCard}
                          </div>
                          
                      </div>
                  </>
              );
          })()}

          {/* 🔥 PREMIUM SUBMISSIONS LEDGER (Tailwind SaaS Style) 🔥 */}
          {activeTab === 'subs' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-8 animate-[fadeIn_0.3s_ease]">
                  
                  {/* Ledger Header & Controls */}
                  <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                          <h3 className="text-[16px] sm:text-[18px] font-black text-slate-800 flex items-center gap-2 m-0 tracking-tight">
                              <i className="ti ti-users-group text-blue-600 text-xl"></i> 
                              Submissions Ledger
                              <span className="bg-blue-100 text-blue-700 text-[11px] px-2 py-0.5 rounded-full font-bold ml-1 border border-blue-200">
                                  {selectedTest.submissions ? selectedTest.submissions.length : 0}
                              </span>
                          </h3>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                          {/* Search Bar */}
                          <div className="relative flex-1 sm:min-w-[260px]">
                              <i className="ti ti-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"></i>
                              <input 
                                  type="text" 
                                  placeholder="Search by Name or Roll No..." 
                                  value={searchQuery} 
                                  onChange={(e) => setSearchQuery(e.target.value)} 
                                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] sm:text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm" 
                              />
                          </div>
                          {/* Export CSV Button */}
                          <button 
                              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[13px] sm:text-sm rounded-xl hover:bg-emerald-100 transition-colors active:scale-95 shadow-sm whitespace-nowrap" 
                              onClick={() => exportToCSV(selectedTest)}
                          >
                              <i className="ti ti-file-spreadsheet text-lg"></i> Export CSV
                          </button>
                      </div>
                  </div>

                  {/* Ledger List Container */}
                  <div className="p-4 sm:p-6 bg-slate-50/30">
                      {(!selectedTest.submissions || selectedTest.submissions.length === 0) ? (
                          
                          /* Empty State */
                          <div className="text-center py-12 px-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                  <i className="ti ti-ghost text-4xl text-slate-300"></i>
                              </div>
                              <h4 className="text-lg font-bold text-slate-700 mb-1">No Submissions Found</h4>
                              <p className="text-sm text-slate-500 font-medium">Wait for students to complete and submit the test.</p>
                          </div>
                      
                      ) : (
                          
                          /* Scrollable Submissions List */
                          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1 sm:pr-2">
                              {(searchQuery ? selectedTest.submissions.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.roll && s.roll.toLowerCase().includes(searchQuery.toLowerCase()))) : selectedTest.submissions).map((s, sIdx) => (
                                  
                                  <div key={sIdx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-200 hover:shadow-md transition-all duration-200 group">
                                      
                                      {/* Left: Student Info */}
                                      <div className="flex items-center gap-3.5">
                                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-500 text-lg shrink-0 shadow-inner group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                              {(s.name || 'A').charAt(0).toUpperCase()}
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                              <div className="font-bold text-[14px] sm:text-[15px] text-slate-800 truncate mb-0.5 group-hover:text-blue-700 transition-colors">{s.name}</div>
                                              <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest">
                                                  <i className="ti ti-id"></i> Roll: <span className="text-slate-500">{s.roll || 'N/A'}</span>
                                              </div>
                                          </div>
                                      </div>

                                      {/* Right: Score & Actions (Border top on mobile) */}
                                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto mt-1 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-100 sm:border-0">
                                          
                                          {/* Status / Score display */}
                                          <div className="text-left sm:text-right shrink-0">
                                              {s.evaluated || selectedTest.resultVis === 'instant' ? (
                                                  <div className="flex flex-col items-start sm:items-end">
                                                      <div className="text-[16px] sm:text-[18px] font-black text-blue-700 leading-none mb-1.5">
                                                          {s.score} <span className="text-[11px] sm:text-[12px] font-bold text-slate-400">/ {selectedTest.totalMarks}</span>
                                                      </div>
                                                      <div className="text-[9px] font-extrabold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-widest flex items-center gap-1"><i className="ti ti-check"></i> Evaluated</div>
                                                  </div>
                                              ) : (
                                                  <div className="flex flex-col items-start sm:items-end">
                                                      <div className="text-[13px] sm:text-[14px] font-bold text-amber-600 leading-none mb-1.5 flex items-center gap-1"><i className="ti ti-clock text-lg"></i> Pending</div>
                                                      <div className="text-[9px] font-extrabold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-widest">Needs Check</div>
                                                  </div>
                                              )}
                                          </div>

                                          {/* Action Buttons */}
                                          <div className="flex items-center gap-2 shrink-0">
                                              <button 
                                                  className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 text-white font-bold text-[13px] sm:text-sm rounded-xl shadow-md shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-1.5" 
                                                  onClick={() => { setEvaluateSub({ sub: s, test: selectedTest, sIdx }); setEvalFilter('all'); }}
                                              >
                                                  <i className="ti ti-microscope text-[16px] sm:text-lg"></i> <span className="hidden sm:inline">Evaluate</span>
                                              </button>
                                              
                                              {/* Demo Test Delete Button (Only for Admin/Owner) */}
                                              {(userRole === 'admin' || s.uid === currentUser?.uid || s.email === currentUser?.email) && (
                                                  <button 
                                                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white text-rose-500 border border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition-colors active:scale-95 shrink-0 shadow-sm"
                                                      title="Delete Demo Submission"
                                                      onClick={() => deleteSubmission(sIdx, s.name)}
                                                  >
                                                      <i className="ti ti-trash text-lg"></i>
                                                  </button>
                                              )}
                                          </div>
                                      </div>

                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
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

         {/* 🔥 UPGRADED EDIT SETTINGS MODAL (Ultra Premium SaaS Style) 🔥 */}
          {modalType === 'editSettings' && (
              <div className="modal-bg flex items-center justify-center p-4" style={{ zIndex: 10000, backdropFilter: 'blur(5px)', background: 'rgba(15, 23, 42, 0.6)' }}>
                  <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-[popIn_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]">
                      
                      {/* Modal Header */}
                      <div className="bg-slate-50 p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl shadow-inner"><i className="ti ti-adjustments"></i></div>
                              <div>
                                  <h3 className="text-lg font-black text-slate-800 m-0 leading-none">Exam Configuration</h3>
                                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-none">Manage Rules & Access</p>
                              </div>
                          </div>
                          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors" onClick={() => setModalType(null)}>
                              <i className="ti ti-x text-lg"></i>
                          </button>
                      </div>

                      {/* Modal Body (Scrollable) */}
                      <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 bg-slate-50/50">
                          
                          {/* Section 1: Core Rules */}
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="ti ti-ruler-2"></i> Core Rules</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Duration (Mins)</label>
                                      <div className="relative">
                                          <i className="ti ti-clock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
                                          <input type="number" value={editSettingsData.duration} onChange={e => setEditSettingsData({...editSettingsData, duration: e.target.value})} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all" />
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Negative Marking</label>
                                      <div className="relative">
                                          <i className="ti ti-minus absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-400 text-lg"></i>
                                          <input type="number" step="0.25" value={editSettingsData.negMarking} onChange={e => setEditSettingsData({...editSettingsData, negMarking: e.target.value})} className="w-full pl-10 pr-4 py-2.5 bg-rose-50/50 border-2 border-slate-200 rounded-xl text-sm font-bold text-rose-700 outline-none focus:border-rose-400 focus:bg-white transition-all" />
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* Section 2: Schedule & Visibility */}
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="ti ti-calendar-time"></i> Schedule & Visibility</h4>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                                  <div>
                                      <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Auto-Open Intake (Start)</label>
                                      <input type="datetime-local" value={editSettingsData.openDate} onChange={e => setEditSettingsData({...editSettingsData, openDate: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all" />
                                  </div>
                                  <div>
                                      <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Auto-Close Intake (End)</label>
                                      <input type="datetime-local" value={editSettingsData.closeDate} onChange={e => setEditSettingsData({...editSettingsData, closeDate: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all" />
                                  </div>
                              </div>

                              <div className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                  <div>
                                      <div className="text-[13px] font-black text-indigo-900 mb-0.5 flex items-center gap-1.5"><i className="ti ti-radar text-lg"></i> Show on Student Radar</div>
                                      <div className="text-[11px] font-semibold text-indigo-700/70">If OFF, students won't see this test (Keeps it as Draft).</div>
                                  </div>
                                  <div className={`w-12 h-6 rounded-full cursor-pointer relative transition-colors duration-300 shrink-0 border border-black/5 ${editSettingsData.radarVisible ? 'bg-indigo-500' : 'bg-slate-300'}`} onClick={() => setEditSettingsData({...editSettingsData, radarVisible: !editSettingsData.radarVisible})}>
                                      <div className={`absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${editSettingsData.radarVisible ? 'left-6' : 'left-[2px]'}`}></div>
                                  </div>
                              </div>
                              
                              {editSettingsData.radarVisible && (
                                  <div className="mt-3 animate-[fadeIn_0.3s_ease]">
                                      <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Note for Students (Optional)</label>
                                      <textarea value={editSettingsData.radarNote} onChange={e => setEditSettingsData({...editSettingsData, radarNote: e.target.value})} placeholder="e.g. Bring your calculators..." className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 transition-all min-h-[60px] resize-y custom-scrollbar"></textarea>
                                  </div>
                              )}
                          </div>

                          {/* Section 3: Access & Security */}
                          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="ti ti-shield-lock"></i> Access & Security</h4>
                              
                              <div className="mb-5">
                                  <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">Results Visibility</label>
                                  <div className="relative">
                                      <select value={editSettingsData.resultVis} onChange={e => setEditSettingsData({...editSettingsData, resultVis: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:bg-white transition-all appearance-none cursor-pointer">
                                          <option value="manual">Manual Verification (Publish Later)</option>
                                          <option value="instant">Instant Access (Show after submit)</option>
                                      </select>
                                      <i className="ti ti-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                  </div>
                              </div>

                              <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                  <div>
                                      <div className="text-[13px] font-black text-emerald-900 mb-0.5 flex items-center gap-1.5"><i className="ti ti-bolt text-lg"></i> Enable Direct Entry</div>
                                      <div className="text-[11px] font-semibold text-emerald-700/70">Allow students to join instantly without the exam code.</div>
                                  </div>
                                  <div className={`w-12 h-6 rounded-full cursor-pointer relative transition-colors duration-300 shrink-0 border border-black/5 ${editSettingsData.directEntry ? 'bg-emerald-500' : 'bg-slate-300'}`} onClick={() => setEditSettingsData({...editSettingsData, directEntry: !editSettingsData.directEntry})}>
                                      <div className={`absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${editSettingsData.directEntry ? 'left-6' : 'left-[2px]'}`}></div>
                                  </div>
                              </div>
                          </div>

                      </div>

                      {/* Modal Footer */}
                      <div className="bg-white p-5 sm:p-6 border-t border-slate-100 flex gap-3 shrink-0">
                          <button className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors active:scale-95" onClick={() => setModalType(null)}>Cancel</button>
                          <button className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2" onClick={saveTestSettings}>
                              <i className="ti ti-device-floppy text-lg"></i> Save Configuration
                          </button>
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
       <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[30vh] animate-[fadeIn_0.3s_ease]">
            
            {/* 🔥 PREMIUM HEADER (Fixed Mobile Layout & Icon) 🔥 */}
            <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                {/* Fixed Icon: Using an inline SVG so it never fails to load */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-[0_8px_20px_rgb(37,99,235,0.25)] shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                
                <div className="flex flex-col min-w-0 justify-center">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <h2 className="text-xl sm:text-[28px] font-black text-slate-800 tracking-tight leading-none m-0 truncate">My Tests Vault</h2>
                        
                        {/* Followers Pill (Moved next to title for compactness) */}
                        <div className="bg-blue-50 text-blue-700 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-bold border border-blue-100 flex items-center gap-1 shadow-sm shrink-0">
                            <i className="ti ti-users text-sm"></i>
                            {followerCount} Followers
                        </div>
                    </div>
                    <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 mt-1.5 sm:mt-2 truncate">
                        Manage assessments, control intakes, and review results.
                    </p>
                </div>
            </div>

            {myTests.length === 0 ? (
                /* Empty State UI */
                <div className="bg-white rounded-3xl p-10 sm:p-16 text-center border-2 border-dashed border-slate-200 shadow-sm flex flex-col items-center justify-center mt-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100">
                        <i className="ti ti-folder-off text-4xl text-slate-300"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-700 mb-2 tracking-tight">Your Vault is Empty</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mb-8 text-[13px] sm:text-sm font-medium leading-relaxed">
                        You haven't created any assessments yet. Click the button below to start building your first secure test.
                    </p>
                    <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95" onClick={() => router.push('/create')}>
                        <i className="ti ti-plus text-lg"></i> Create New Test
                    </button>
                </div>
            ) : (
                <>
                    {/* 🔥 SMART SEARCH & FILTER BAR (Side-by-side on all screens) 🔥 */}
                    <div className="flex flex-row gap-2 sm:gap-3 mb-6 relative z-20">
                        {/* Instant Search Bar */}
                        <div className="relative flex-1 group min-w-0">
                            <i className="ti ti-search absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base sm:text-lg group-focus-within:text-blue-500 transition-colors pointer-events-none"></i>
                            <input 
                                ref={searchRef} 
                                type="text" 
                                placeholder="Search tests..." 
                                value={vaultSearchQuery}
                                onChange={(e) => setVaultSearchQuery(e.target.value)}
                                className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3.5 bg-white border border-slate-200 rounded-xl text-[13px] sm:text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                                <span>Press</span> <kbd className="font-mono text-slate-500">/</kbd>
                            </div>
                        </div>
                        
                        {/* Premium Dropdown */}
                        <div className="relative shrink-0 w-[110px] sm:w-[150px]">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full pl-3 sm:pl-4 pr-7 sm:pr-10 py-2.5 sm:py-3.5 bg-white border border-slate-200 rounded-xl text-[12px] sm:text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm appearance-none cursor-pointer"
                            >
                                <option value="newest">Newest</option>
                                <option value="oldest">Oldest</option>
                                <option value="alphabetical">A - Z</option>
                                <option value="live">🟢 Live</option>
                                <option value="closed">⚪ Closed</option>
                            </select>
                            <i className="ti ti-chevron-down absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                        </div>
                    </div>

                    {/* 🔥 THE NATIVE PREMIUM LIST ENGINE 🔥 */}
                    <div className="flex flex-col gap-3 sm:gap-4">
                        {(() => {
                            // Filter Logic
                            let filtered = myTests.filter(t => {
                                const sq = vaultSearchQuery.toLowerCase();
                                const matchesSearch = !vaultSearchQuery || (t.title?.toLowerCase().includes(sq) || t.code?.toLowerCase().includes(sq) || t.subject?.toLowerCase().includes(sq));
                                const isLive = t.isActive !== false;
                                let matchesStatus = true;
                                if (sortBy === 'live') matchesStatus = isLive;
                                if (sortBy === 'closed') matchesStatus = !isLive;
                                return matchesSearch && matchesStatus;
                            });

                            // Sort Logic
                            filtered.sort((a, b) => {
                                const idA = String(a.id || '');
                                const idB = String(b.id || '');
                                if (sortBy === 'newest' || sortBy === 'live' || sortBy === 'closed') return idB.localeCompare(idA); 
                                if (sortBy === 'oldest') return idA.localeCompare(idB); 
                                if (sortBy === 'alphabetical') return String(a.title || '').toLowerCase().localeCompare(String(b.title || '').toLowerCase());
                                return 0;
                            });

                            // No Results UI
                            if (filtered.length === 0) {
                                return (
                                    <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm flex flex-col items-center mt-2">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                            <i className="ti ti-search-off text-3xl text-slate-400"></i>
                                        </div>
                                        <h4 className="text-[16px] font-black text-slate-700 mb-1">No tests found</h4>
                                        <p className="text-[13px] font-semibold text-slate-500 mb-5">We couldn't find any tests matching "{vaultSearchQuery}".</p>
                                        <button className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-xl transition-colors active:scale-95" onClick={() => setVaultSearchQuery('')}>Clear Search</button>
                                    </div>
                                );
                            }

                            // Render Premium Cards
                            return filtered.map((t, i) => {
                                const now = Date.now();
                                const closeTime = t.closeDate ? new Date(t.closeDate).getTime() : null;
                                const openTime = t.openDate ? new Date(t.openDate).getTime() : null;
                                
                                let status = 'live';
                                if (t.isActive === false || (closeTime && now > closeTime)) status = 'closed';
                                else if (openTime && now < openTime) status = 'upcoming';

                                const subCount = t.submissions ? t.submissions.length : 0;
                                
                                // Dynamic Accent Line Color
                                let statusColorLine = 'bg-slate-200';
                                if (t.isLocal) statusColorLine = 'bg-amber-400';
                                else if (status === 'live') statusColorLine = 'bg-emerald-500';
                                else if (status === 'upcoming') statusColorLine = 'bg-blue-400';

                                return (
                                    <div 
                                        key={t.id || i} 
                                        className="group bg-white rounded-2xl border border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-blue-300 transition-all duration-300 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer relative overflow-hidden animate-[slideUp_0.4s_ease_forwards] opacity-0"
                                        style={{ animationDelay: `${(i > 10 ? 10 : i) * 0.05}s` }}
                                        onClick={() => setSelectedTest(t)}
                                    >
                                        {/* Status Accent Line */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${statusColorLine}`}></div>
                                        
                                        <div className="flex flex-col min-w-0 pl-1.5 sm:pl-2">
                                            
                                            {/* Title & Status Badge Row */}
                                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                <h3 className="text-[16px] sm:text-[18px] font-black text-slate-800 truncate group-hover:text-blue-700 transition-colors leading-tight m-0">{t.title}</h3>
                                                
                                                <div className="flex items-center gap-2">
                                                    {t.isLocal && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1 border border-amber-200"><i className="ti ti-device-floppy"></i> Local</span>}
                                                    
                                                    {!t.isLocal && status === 'live' && (
                                                        <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 border border-emerald-200">
                                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Live
                                                        </span>
                                                    )}
                                                    {!t.isLocal && status === 'upcoming' && (
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1 border border-blue-200"><i className="ti ti-clock"></i> Scheduled</span>
                                                    )}
                                                    {!t.isLocal && status === 'closed' && (
                                                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1 border border-slate-200"><i className="ti ti-lock"></i> Closed</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Meta Info Row */}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] sm:text-[13px] font-semibold text-slate-500 mb-3">
                                                <span className="flex items-center gap-1.5"><i className="ti ti-book text-slate-400 text-base"></i> {t.subject || 'General'}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                                                <span className="flex items-center gap-1.5"><i className="ti ti-list-numbers text-slate-400 text-base"></i> {t.questions?.length || 0} Qs</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span>
                                                <span className="flex items-center gap-1.5"><i className="ti ti-clock text-slate-400 text-base"></i> {t.duration} Mins</span>
                                            </div>
                                            
                                            {/* Data Tags & Radar Badge (Mobile-First Layout) */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="bg-slate-50 text-slate-600 px-2.5 py-1.5 sm:py-1 rounded-lg text-[11px] font-bold font-mono tracking-widest border border-slate-200 shadow-sm flex items-center gap-1"><i className="ti ti-hash opacity-60"></i> {t.code}</span>
                                                
                                                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1.5 sm:py-1 rounded-lg text-[11px] font-bold border border-indigo-200 shadow-sm flex items-center gap-1.5"><i className="ti ti-users"></i> {subCount} Subs</span>
                                                
                                                {/* 🔥 THUNDER ICON FIXED: Ab ye tags ke sath same line me perfectly fit hoga 🔥 */}
                                                {t.radarVisible && (
                                                    <span className="bg-amber-50 text-amber-600 px-2.5 py-1.5 sm:py-1 rounded-lg border border-amber-200 shadow-sm flex items-center gap-1" title="Visible on Student Radar">
                                                        <i className="ti ti-bolt text-[14px] animate-[pulse_2s_infinite]"></i> 
                                                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">On Radar</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Hover Arrow (Desktop only - Mobile ka faltu border hata diya) */}
                                        <div className="hidden sm:flex shrink-0 ml-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all shadow-sm">
                                                <i className="ti ti-chevron-right text-lg transform group-hover:translate-x-0.5 transition-transform"></i>
                                            </div>
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


      {/* ROOT LEVEL SYSTEM POPUPS */}
      
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