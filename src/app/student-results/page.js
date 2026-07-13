// src/app/student-results/page.js
'use client';
import { useState, useEffect, memo } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, get } from 'firebase/database';
import FigureRenderer from '../../components/FigureRenderer'; 
import SmilesViewer from '../../components/SmilesViewer';

// 🔥 THE MASTER FIX: MathJax React Re-render Protector
const StaticMath = memo(({ html, isBlock, style, className }) => {
  if (isBlock) return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
  return <span className={className} style={style} dangerouslySetInnerHTML={{ __html: html || '' }} />;
});

export default function StudentResults() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- NEW: Local State for Smart Fetching ---
  const [myHistory, setMyHistory] = useState([]);
  const [fetchingResults, setFetchingResults] = useState(true);

  // State to toggle between List View and Detailed View
  const [selectedResult, setSelectedResult] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'correct', 'wrong', 'skipped'
  const [sectionFilter, setSectionFilter] = useState('all_sections'); //  NAYA: Section Filter
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMathReady, setIsMathReady] = useState(true);

  useEffect(() => {
      if (typeof window === 'undefined') return;
      const handleScroll = () => {
          // 400px se zyada scroll hone par arrow popup hoga
          setShowScrollTop(window.scrollY > 400);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
   
  //  THE FIX: Fetch results ON-DEMAND only when this page is opened
  useEffect(() => {
    const fetchStudentHistory = async () => {
      if (!currentUser) {
        setFetchingResults(false);
        return;
      }
      
      try {
        setFetchingResults(true);
        // Sirf ek baar get() request (Zero background data leak)
        const snapshot = await get(ref(database, 'tests'));
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            const allTests = Array.isArray(data) ? data : Object.values(data);
            let historyTemp = [];

            allTests.filter(Boolean).forEach(t => {
                if (t.submissions) {
                    const subsArray = Array.isArray(t.submissions) ? t.submissions : Object.values(t.submissions);
                    subsArray.filter(Boolean).forEach((s) => {
                        //  STRICT MATCH LOGIC
                        let isExactMatch = (s.uid && currentUser.uid && s.uid === currentUser.uid) || 
                                           (s.email && currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase());

                        if (isExactMatch) {
                            let canView = (t.resultVis === 'instant') || (t.released === true);
                            historyTemp.push({ test: t, sub: s, canView });
                        }
                    });
                }
            });
            
            // 🔥 FIX: BULLETPROOF INDIAN DATE SORTING
            historyTemp.sort((a, b) => {
                const parseIndianDate = (dateStr) => {
                    if (!dateStr) return 0;
                    try {
                        const dmy = dateStr.split(',')[0].trim().split('/');
                        if (dmy.length === 3) {
                            // YYYY, MM (0-indexed), DD
                            return new Date(dmy[2], dmy[1] - 1, dmy[0]).getTime();
                        }
                        return Date.parse(dateStr) || 0;
                    } catch(e) { return 0; }
                };
                
                const timeA = a.sub.timestamp || parseIndianDate(a.sub.time);
                const timeB = b.sub.timestamp || parseIndianDate(b.sub.time);
                return timeB - timeA; 
            });
            setMyHistory(historyTemp);

        }
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setFetchingResults(false);
      }
    };

    fetchStudentHistory();
  }, [currentUser]);

  //  PREMIUM EXAMITOP CERTIFICATE GENERATOR (1-Page Fix)
  const generateCertificate = () => {
    const { test, sub } = selectedResult;
    const pct = Math.round((sub.score / test.totalMarks) * 100);
    const dateOnly = sub.time.split(',')[0] || sub.time;

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

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(printHtml); doc.close();
    iframe.contentWindow.onafterprint = () => { setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1000); };
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
        if (selectedResult && typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
            try {
                window.MathJax.typesetClear();
                await window.MathJax.typesetPromise();
            } catch (err) {
                console.log('MathJax Error:', err);
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
        <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
            {/* Header Skeleton */}
            <div style={{ marginBottom: '2rem' }}>
                <div className="skeleton" style={{ width: '250px', height: '36px', marginBottom: '8px', borderRadius: '8px' }}></div>
                <div className="skeleton" style={{ width: '380px', height: '18px', borderRadius: '6px', maxWidth: '100%' }}></div>
            </div>

            {/* Result Cards Skeleton */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {[1, 2, 3, 4].map(n => (
                    <div key={n} style={{ padding: '1.25rem 1.5rem', background: 'var(--color-background-primary)', borderRadius: '12px', border: '1px solid var(--color-border-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                <div className="skeleton" style={{ width: '200px', height: '24px', borderRadius: '6px' }}></div>
                                <div className="skeleton" style={{ width: '70px', height: '20px', borderRadius: '12px' }}></div>
                            </div>
                            <div className="skeleton" style={{ width: '150px', height: '16px', marginBottom: '10px', borderRadius: '4px' }}></div>
                            <div className="skeleton" style={{ width: '100px', height: '18px', borderRadius: '4px' }}></div>
                        </div>
                        <div>
                            <div className="skeleton" style={{ width: '120px', height: '36px', borderRadius: '6px' }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
        <i className="ti ti-lock" style={{ fontSize: '48px', display: 'block', marginBottom: '1rem', opacity: 0.5 }}></i>
        <div style={{ fontSize: '16px', fontWeight: 500 }}>Please Login to view your results.</div>
        <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => router.push('/')}>Go to Home</button>
      </div>
    );
  }

  // Helpers for UI
  const getLabel = (type) => ({ mcq: 'Single Correct', msq: 'Multi Correct', integer: 'Integer Type', subjective: 'Subjective' }[type] || type);

  // ==========================================
  // VIEW 1: LIST OF PAST RESULTS
  // ==========================================
  if (!selectedResult) {
    return (
      <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div className="page-title">My Past Results</div>
          <div className="page-sub">Review your evaluated papers, correct answers, and examiner remarks.</div>
        </div>

        {myHistory.length === 0 ? (
          /*  PREMIUM EMPTY STATE */
          <div style={{ background: 'var(--color-background-primary)', borderRadius: '16px', padding: '3rem 2rem', textAlign: 'center', border: '2px dashed var(--color-border-secondary)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px' }}>
             <div style={{ width: '80px', height: '80px', background: 'var(--color-background-secondary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                 <i className="ti ti-file-off" style={{ fontSize: '36px', color: '#94a3b8' }}></i>
             </div>
             <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>No Results Yet</h3>
             <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem', fontSize: '14px', lineHeight: 1.6 }}>
                 You haven't received any evaluated results. Complete an assessment and wait for your examiner to publish the report.
             </p>
             <button className="btn btn-primary" onClick={() => router.push('/student')}>
                <i className="ti ti-pencil"></i> Go to Active Exams
             </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* CSS for Premium Blinking Effect */}
            <style>{`
                @keyframes recentPulse {
                    0% { box-shadow: 0 0 0 0 rgba(24,95,165,0.4); border-color: #185FA5; }
                    70% { box-shadow: 0 0 0 10px rgba(24,95,165,0); border-color: #60a5fa; }
                    100% { box-shadow: 0 0 0 0 rgba(24,95,165,0); border-color: #185FA5; }
                }
            `}</style>
            
            {myHistory.map((h, idx) => {
                const subTimeMs = h.sub.timestamp || Date.parse(h.sub.time) || 0;
                const timeDiff = Date.now() - subTimeMs;
                const isRecent = timeDiff >= 0 && timeDiff < 120000; 
                
                return (
                  /* 🔥 FIX 2 & 3: COMPACT CARDS & HIGHLIGHT NEWEST SUBMISSION */
                  <div 
                    key={idx} 
                    className="test-entry" 
                    style={{ 
                        alignItems: 'center', 
                        padding: '1rem 1.25rem', // Padding kam kar di (Sleek look)
                        opacity: 0,
                        animation: `staggerSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards${isRecent ? ', recentPulse 2s infinite' : ''}`,
                        animationDelay: `${idx * 0.05}s, 0s`,
                        borderLeft: h.canView ? '4px solid #185FA5' : '4px solid #f59e0b',
                        background: isRecent ? '#f0f7ff' : 'var(--color-background-primary)', // Light blue bg for recent
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderRadius: '12px',
                        border: isRecent ? '1px solid #185FA5' : '1px solid var(--color-border-secondary)'
                    }}
                  >
                    <div className="te-meta" style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {h.test.title} 
                        {isRecent && <span style={{ background: '#185FA5', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>JUST NOW</span>}
                        <span className="badge b-purple" style={{ fontSize: '11px', padding: '2px 8px', fontFamily: 'monospace' }}><i className="ti ti-hash"></i> {h.test.code}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '15px', marginTop: '6px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-calendar-time"></i> {h.sub.time}</span>
                        <span style={{ fontWeight: 600, color: '#185FA5', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-target"></i> Score: {h.sub.score} / {h.test.totalMarks}</span>
                      </div>
                    </div>
                    
                    <div style={{ flexShrink: 0, marginLeft: '12px' }}>
                      {h.canView ? (
                        <button className="btn btn-primary btn-sm" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setSelectedResult(h)}>
                          View Result
                        </button>
                      ) : (
                        <span className="badge b-amber" style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="ti ti-lock"></i> Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: DETAILED RESULT ANALYSIS
  // ==========================================
  const { test, sub } = selectedResult;
  const pct = Math.round((sub.score / test.totalMarks) * 100);
  const accuracy = sub.correct + sub.wrong > 0 ? Math.round((sub.correct / (sub.correct + sub.wrong)) * 100) : 0;
  
  const maxH = Math.max(sub.correct, sub.wrong, sub.skipped, 1);
  const bH = (c) => Math.max(16, Math.round((c / maxH) * 80));

  // 🔥 NAYA: Helper for Time Formatting
  const formatQTime = (seconds) => {
      if (!seconds) return '00s';
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // 🔥 NAYA: Dynamic Time Calculation Based on Section Filter
  let displayTimeStr = sub.timeTaken || '00s';
  if (sub.timeSpentPerQuestion) {
      let totalSecs = 0;
      sub.details.forEach((d, idx) => {
          const sec = d.q.section || 'General';
          if (sectionFilter === 'all_sections' || sec === sectionFilter) {
              totalSecs += (sub.timeSpentPerQuestion[idx] || 0);
          }
      });
      if (totalSecs > 0) displayTimeStr = formatQTime(totalSecs);
  }

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease' }}>
      
      <button className="btn btn-ghost" style={{ marginBottom: '1rem', padding: 0, fontWeight: 600, color: 'var(--color-text-secondary)' }} onClick={() => { setSelectedResult(null); setSectionFilter('all_sections'); }}>
        <i className="ti ti-arrow-left"></i> Back to Results
      </button>


      <div className="premium-hero">
          {/* Background Decorative Glow */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255, 255, 255, 0.1)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', bottom: '-50px', left: '10%', width: '150px', height: '150px', background: 'rgba(52, 211, 153, 0.2)', filter: 'blur(40px)', borderRadius: '50%' }}></div>

          {/* AREA 1: Left Info Section */}
          <div className="hero-info">
              <div className="pill-tag" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', marginBottom: '12px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  <i className="ti ti-notebook" style={{ color: '#fff' }}></i> {test.title}
              </div>
              
              <h2 className="hero-title">{sub.name}</h2>
              
              <div className="hero-meta">
                  {sub.roll && <span><i className="ti ti-id" style={{opacity: 0.8}}></i> {sub.roll}</span>}
                  {sub.roll && <span style={{ opacity: 0.5 }}>|</span>}
                  <span><i className="ti ti-calendar-time" style={{opacity: 0.8}}></i> {sub.time}</span>
              </div>
          </div>

          {/* AREA 2: Right Score Ring */}
          <div className="hero-score-wrapper">
              <div className="hero-score-ring">
                  <div style={{ position: 'absolute', inset: '6px', borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.4)' }}></div>
                  <div className="hero-score-val">{sub.score}</div>
                  <div className="hero-score-lbl">/ {test.totalMarks}</div>
              </div>
          </div>

          {/* AREA 3: Bottom Tags Container */}
          <div className="hero-tags">
              {/* 🔥 DYNAMIC TIME PILL (Changes with Section Filter) 🔥 */}
              <div className="pill-tag" style={{ background: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.4)', color: '#a7f3d0' }}>
                  <i className="ti ti-stopwatch"></i> {sectionFilter === 'all_sections' ? 'Total Time: ' : 'Section Time: '} {displayTimeStr}
              </div>

              <div className="pill-tag" style={{ background: pct >= 75 ? 'rgba(52,211,153,0.2)' : pct >= 40 ? 'rgba(251,191,36,0.2)' : 'rgba(248,113,113,0.2)', borderColor: pct >= 75 ? 'rgba(52,211,153,0.4)' : pct >= 40 ? 'rgba(251,191,36,0.4)' : 'rgba(248,113,113,0.4)' }}>
                  <i className="ti ti-activity" style={{ fontSize: '14px' }}></i> {pct}% &bull; {pct >= 90 ? 'Excellent' : pct >= 75 ? 'Great Job' : pct >= 50 ? 'Good Effort' : pct >= 35 ? 'Keep Practicing' : 'Needs Work'}
              </div>
              
              {pct >= 75 && (
                  <button onClick={generateCertificate} className="pill-tag" style={{ background: '#fff', color: '#185FA5', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                      <i className="ti ti-medal" style={{ color: '#d4af37', fontSize: '15px' }}></i> Claim Certificate
                  </button>
              )}
          </div>
      </div>

      {/* 🔥 PREMIUM CHEAT LOGS WARNING (Compact & Animated Dropdown) 🔥 */}
      {sub.cheatLogs && sub.cheatLogs.length > 0 && (
        <details className="group" style={{ marginBottom: '1.5rem', background: '#fff', borderRadius: '12px', border: sub.cheatLogs.length >= 3 ? '1px solid #ef4444' : '1px solid #fca5a5', boxShadow: '0 4px 15px rgba(239,68,68,0.05)', overflow: 'hidden' }}>
            
            {/* Header (Summary) - Super Compact */}
            <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', listStyle: 'none', padding: '12px 16px', background: sub.cheatLogs.length >= 3 ? '#fef2f2' : '#fff', transition: 'background 0.3s' }} className="[&::-webkit-details-marker]:hidden outline-none">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: sub.cheatLogs.length >= 3 ? '#ef4444' : '#fef2f2', color: sub.cheatLogs.length >= 3 ? '#fff' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                        <i className="ti ti-shield-x"></i>
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '14px', color: sub.cheatLogs.length >= 3 ? '#991b1b' : '#0f172a', fontWeight: 800 }}>
                           {sub.cheatLogs.length >= 3 ? 'Exam Terminated Early (Violations)' : 'Security & Proctoring Alert'}
                        </h4>
                        <div style={{ fontSize: '11px', color: sub.cheatLogs.length >= 3 ? '#dc2626' : '#64748b', fontWeight: 600, marginTop: '1px' }}>System recorded suspicious activities. Click to view.</div>
                    </div>
                </div>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: sub.cheatLogs.length >= 3 ? '#fca5a5' : '#f1f5f9', color: sub.cheatLogs.length >= 3 ? '#991b1b' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s' }} className="group-open:rotate-180">
                    <i className="ti ti-chevron-down text-sm"></i>
                </div>
            </summary>

            {/* Dropdown Content - Smooth Fade In Animation */}
            <div style={{ padding: '0 16px 16px 16px', background: '#fff', borderTop: sub.cheatLogs.length >= 3 ? '1px solid #fecaca' : '1px solid #f1f5f9' }} className="animate-[fadeIn_0.3s_ease]">
                <div className="custom-scrollbar" style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '6px', marginTop: '12px' }}>
                    {sub.cheatLogs.map((log, index) => (
                        <div key={index} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ background: '#fee2e2', color: '#ef4444', fontSize: '9px', fontWeight: 800, padding: '3px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Warning {index + 1}</div>
                            <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}><i className="ti ti-clock"></i> {log.time}</div>
                            <div style={{ width: '1px', height: '12px', background: '#cbd5e1', flexShrink: 0 }}></div>
                            <div style={{ color: '#334155', fontSize: '12px', fontWeight: 600, flex: 1, wordBreak: 'break-word' }}>{log.reason}</div>
                        </div>
                    ))}
                </div>
                {sub.cheatLogs.length >= 3 && (
                    <div style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', padding: '8px 14px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, boxShadow: '0 4px 12px rgba(239,68,68,0.3)', marginTop: '8px' }}>
                        <i className="ti ti-ban" style={{ fontSize: '14px' }}></i> Auto-Submitted Due To Violations
                    </div>
                )}
            </div>
        </details>
      )}

      {/* 🔥 PREMIUM SUMMARY DASHBOARD (V3 - THE ULTIMATE ANALYTICS) 🔥 */}
      {(() => {
          const totalAttempted = sub.correct + sub.wrong;
          const totalQs = sub.details ? sub.details.length : (sub.correct + sub.wrong + sub.skipped);
          const percentage = test.totalMarks > 0 ? ((sub.score / test.totalMarks) * 100).toFixed(1) : 0;
          const accuracyCalc = totalAttempted > 0 ? ((sub.correct / totalAttempted) * 100).toFixed(1) : 0;
          const attemptRate = totalQs > 0 ? ((totalAttempted / totalQs) * 100).toFixed(1) : 0;
          
          // Negative Marks Calculation
          const negMarks = (sub.wrong * (test.negMarking || 0)).toFixed(2);

          // Progress bar percentages
          const cPct = totalQs > 0 ? (sub.correct / totalQs) * 100 : 0;
          const wPct = totalQs > 0 ? (sub.wrong / totalQs) * 100 : 0;
          const sPct = totalQs > 0 ? (sub.skipped / totalQs) * 100 : 0;

          // Sectional Analysis & Finding Strengths/Weaknesses
          const sectionStats = {};
          let strongestSec = { name: '-', pct: -1 };
          let weakestSec = { name: '-', pct: 101 };

          if (sub.details) {
              sub.details.forEach((item, idx) => {
                  const sec = item.q.section || 'General';
                  if (!sectionStats[sec]) sectionStats[sec] = { score: 0, max: 0, correct: 0, total: 0, time: 0 };
                  
                  sectionStats[sec].total += 1;
                  sectionStats[sec].max += Number(item.q.marks || 0); 
                  sectionStats[sec].time += (sub.timeSpentPerQuestion?.[idx] || 0); 
                  
                  if (item.status === 'correct' || item.status === 'partial') {
                      sectionStats[sec].score += Number(item.earned || 0);
                      if (item.status === 'correct') sectionStats[sec].correct += 1;
                  } else if (item.status === 'wrong') {
                      sectionStats[sec].score += Number(item.earned || 0); 
                  }
              });

              // Calculate Strongest and Weakest Section
              const secKeys = Object.keys(sectionStats);
              if (secKeys.length > 1) { // Sirf tabhi batao jab 1 se zyada subjects hon
                  secKeys.forEach(sec => {
                      const stat = sectionStats[sec];
                      if (stat.max > 0) {
                          const secPct = (stat.score / stat.max) * 100;
                          if (secPct > strongestSec.pct) { strongestSec = { name: sec, pct: secPct }; }
                          if (secPct < weakestSec.pct) { weakestSec = { name: sec, pct: secPct }; }
                      }
                  });
              }
          }

          return (
              <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', marginBottom: '1.5rem', animation: 'fadeIn 0.4s ease' }}>
                  <h3 style={{ fontSize: '17px', color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="ti ti-device-analytics" style={{ color: '#185FA5', fontSize: '20px' }}></i> Performance Analytics
                  </h3>
                  {/* 🔥 MAC-STYLE SLEEK SCROLLBAR */}
                  <style>{`
                      .premium-scroll::-webkit-scrollbar { height: 6px; }
                      .premium-scroll::-webkit-scrollbar-track { background: transparent; }
                      .premium-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                      .premium-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                  `}</style>

                  {/* 📊 GRID 1: HORIZONTALLY SCROLLABLE METRICS (Phone Friendly & Premium) */}
                  <div className="premium-scroll" style={{ display: 'flex', flexWrap: 'nowrap', gap: '12px', overflowX: 'auto', paddingBottom: '14px', WebkitOverflowScrolling: 'touch' }}>                
                      {/* 🔥 NEW: Total Score Highlight Card */}
                      <div style={{ flex: '0 0 auto', minWidth: '160px', background: 'linear-gradient(135deg, #185FA5, #3C3489)', padding: '12px', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 10px rgba(24,95,165,0.2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}><i className="ti ti-trophy"></i></div>
                              <div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 700, textTransform: 'uppercase' }}>Total Score</div>
                          </div>
                          <div style={{ fontSize: '22px', fontWeight: 800 }}>
                              {sub.score} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>/ {test.totalMarks}</span>
                          </div>
                      </div>

                      {/* Overall Percentage */}
                      <div style={{ flex: '0 0 auto', minWidth: '140px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: percentage >= 75 ? '#d1fae5' : percentage >= 40 ? '#fef3c7' : '#fee2e2', color: percentage >= 75 ? '#059669' : percentage >= 40 ? '#d97706' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}><i className="ti ti-percentage"></i></div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Percentage</div>
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{percentage}%</div>
                      </div>

                      {/* Attempt Rate */}
                      <div style={{ flex: '0 0 auto', minWidth: '140px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ffedd5', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}><i className="ti ti-flame"></i></div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Attempt Rate</div>
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{attemptRate}%</div>
                      </div>

                      {/* Accuracy */}
                      <div style={{ flex: '0 0 auto', minWidth: '140px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}><i className="ti ti-target"></i></div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Accuracy</div>
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{accuracyCalc}%</div>
                      </div>

                      {/* Negative Marks */}
                      <div style={{ flex: '0 0 auto', minWidth: '140px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fcebeb', color: '#a32d2d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}><i className="ti ti-minus"></i></div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Negative</div>
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#a32d2d' }}>-{negMarks}</div>
                      </div>

                      {/* 🔥 NEW: Strongest Zone (If multiple sections exist) */}
                      {Object.keys(sectionStats).length > 1 && strongestSec.pct > 0 && (
                          <div style={{ flex: '0 0 auto', minWidth: '150px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}><i className="ti ti-trending-up"></i></div>
                                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Strongest</div>
                              </div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{strongestSec.name}</div>
                          </div>
                      )}

                      {/* 🔥 NEW: Needs Work (Weakest Zone) */}
                      {Object.keys(sectionStats).length > 1 && weakestSec.name !== '-' && (
                          <div style={{ flex: '0 0 auto', minWidth: '150px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}><i className="ti ti-trending-down"></i></div>
                                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Needs Work</div>
                              </div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{weakestSec.name}</div>
                          </div>
                      )}
                  </div>

                  {/* 📊 GRID 2: COMPACT QUESTION DISTRIBUTION */}
                  <div style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '10px' }}>
                           <span>Questions Distribution</span>
                           <span>Attempted: {totalAttempted} / {totalQs}</span>
                      </div>
                      
                      {/* Stacked Progress Bar (Lighter Pastel Colors) */}
                      <div style={{ display: 'flex', height: '14px', borderRadius: '10px', overflow: 'hidden', background: '#f1f5f9', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ width: `${cPct}%`, background: '#34d399', transition: 'width 1s ease' }}></div> {/* Soft Green */}
                          <div style={{ width: `${wPct}%`, background: '#fca5a5', transition: 'width 1s ease' }}></div> {/* Soft Red */}
                          <div style={{ width: `${sPct}%`, background: '#cbd5e1', transition: 'width 1s ease' }}></div> {/* Soft Grey */}
                      </div>
                      
                      {/* Legends with Values */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '12px', fontWeight: 700, flexWrap: 'wrap', gap: '8px' }}>
                           <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-circle-check-filled" style={{ fontSize: '14px' }}></i> {sub.correct} Correct</span>
                           <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-circle-x-filled" style={{ fontSize: '14px' }}></i> {sub.wrong} Wrong</span>
                           <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-minus-circle" style={{ fontSize: '14px' }}></i> {sub.skipped} Skipped</span>
                      </div>
                  </div>

                  {/* 📊 GRID 3: SWIPEABLE SECTION BREAKDOWN */}
                  {Object.keys(sectionStats).length > 0 && (
                      <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Section-wise Scores</div>
                          
                          <div className="premium-scroll" style={{ display: 'flex', flexWrap: 'nowrap', gap: '10px', overflowX: 'auto', paddingBottom: '14px', WebkitOverflowScrolling: 'touch' }}>
                              {Object.keys(sectionStats).map((sec, idx) => {
                                  const stat = sectionStats[sec];
                                  const secPercent = stat.max > 0 ? ((stat.score / stat.max) * 100).toFixed(0) : 0;
                                  
                                  return (
                                      <div key={idx} style={{ flex: '0 0 auto', minWidth: '220px', background: '#f1f5f9', padding: '12px 15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                  <i className="ti ti-folder" style={{ color: '#185FA5', fontSize: '16px' }}></i>
                                                  <span style={{ fontWeight: 700, color: '#334155', fontSize: '13px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec}</span>
                                              </div>
                                              {/*SECTION TIME BADGE*/}
                                              <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                                  <i className="ti ti-stopwatch"></i> {formatQTime(stat.time)}
                                              </div>
                                          </div>
                                          <div style={{ textAlign: 'right' }}>
                                              <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>{stat.score} <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>/ {stat.max}</span></div>
                                              <div style={{ fontSize: '10px', fontWeight: 700, background: secPercent >= 75 ? '#d1fae5' : secPercent >= 40 ? '#fef3c7' : '#fee2e2', color: secPercent >= 75 ? '#065f46' : secPercent >= 40 ? '#92400e' : '#991b1b', padding: '2px 6px', borderRadius: '12px', display: 'inline-block', marginTop: '4px' }}>
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

     {/* 🔥 MINIMALIST & ADVANCED FILTERS (iOS/Apple Style) 🔥 */}
      <div className="mb-6 border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4">
            
            {/* Header & Status Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h3 className="text-[17px] font-extrabold text-slate-800 flex items-center gap-2 tracking-tight">
                    <i className="ti ti-adjustments-horizontal text-blue-600 text-xl"></i> Review Filters
                </h3>
                
                {(() => {
                    const secDetails = sub.details.filter(d => sectionFilter === 'all_sections' || d.q.section === sectionFilter || (!d.q.section && sectionFilter === (test.sections?.[0])));
                    const countAll = secDetails.length;
                    const countCorrect = secDetails.filter(d => d.status === 'correct' || d.status === 'partial').length;
                    const countWrong = secDetails.filter(d => d.status === 'wrong').length;
                    const countSkipped = secDetails.filter(d => d.status === 'skipped' || d.status === 'submitted' || d.status === 'evaluated').length;
                    
                    return (
                        <div className="inline-flex bg-slate-100/80 p-1.5 rounded-xl overflow-x-auto scrollbar-hide -webkit-overflow-scrolling-touch border border-slate-200/60 w-full md:w-auto">
                          
                          <button 
                              className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${filter === 'all' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                              onClick={() => changeStatusFilter('all')}
                          >
                              All <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${filter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{countAll}</span>
                          </button>
                          
                          <button 
                              className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${filter === 'correct' ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                              onClick={() => changeStatusFilter('correct')}
                          >
                              Correct <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${filter === 'correct' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{countCorrect}</span>
                          </button>
                          
                          <button 
                              className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${filter === 'wrong' ? 'bg-white text-rose-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                              onClick={() => changeStatusFilter('wrong')}
                          >
                              Wrong <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${filter === 'wrong' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'}`}>{countWrong}</span>
                          </button>
                          
                          <button 
                              className={`flex-shrink-0 flex items-center justify-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${filter === 'skipped' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-800'}`} 
                              onClick={() => changeStatusFilter('skipped')}
                          >
                              Skipped <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${filter === 'skipped' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200 text-slate-500'}`}>{countSkipped}</span>
                          </button>
                        </div>
                    );
                })()}
            </div>

            {/* Section Filters (Sleek Pills) */}
            {test.sections && test.sections.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -webkit-overflow-scrolling-touch">
                    <button 
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 border ${sectionFilter === 'all_sections' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`} 
                        onClick={() => changeSectionFilter('all_sections')}
                    >
                        All Sections
                    </button>
                    {test.sections.map((sec, idx) => (
                        <button 
                            key={idx} 
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all duration-200 border ${sectionFilter === sec ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`} 
                            onClick={() => changeSectionFilter(sec)}
                        >
                            {sec}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* 🔥 HYPER-VIBRANT QUESTION REVIEW CARDS (COMPACT SPLIT-GRID) 🔥 */}
      <div style={{ opacity: isMathReady ? 1 : 0, transition: 'opacity 0.3s ease-in', minHeight: '50vh' }} className="flex flex-col gap-5 sm:gap-6">
        
        {/* 🔥 CSS Hack: Force SVG to scale properly without overflowing */}
        <style>{`
            .svg-eval-container svg { max-width: 100%; height: auto; max-height: 280px; min-height: 100px; }
        `}</style>

        {sub.details.filter(d => {
            let sMatch = filter === 'all' || d.status === filter || (filter === 'skipped' && (d.status === 'submitted' || d.status === 'evaluated'));
            let secMatch = sectionFilter === 'all_sections' || d.q.section === sectionFilter || (!d.q.section && sectionFilter === (test.sections?.[0]));
            return sMatch && secMatch;
        }).map((d, i) => {
           const q = d.q;
           const ans = d.ans;
           const originalQIdx = sub.details.indexOf(d);
           
           // Super Vibrant Colors
           const sProps = {
               correct: { grad: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-50/50', text: 'text-emerald-700', icon: 'ti-circle-check', badgeBg: 'bg-emerald-600' },
               wrong: { grad: 'from-rose-500 to-red-500', bg: 'bg-rose-50/50', text: 'text-rose-700', icon: 'ti-circle-x', badgeBg: 'bg-rose-600' },
               partial: { grad: 'from-amber-400 to-orange-500', bg: 'bg-amber-50/50', text: 'text-amber-700', icon: 'ti-adjustments-alt', badgeBg: 'bg-amber-600' },
               evaluated: { grad: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50/50', text: 'text-blue-700', icon: 'ti-pencil', badgeBg: 'bg-blue-600' },
               submitted: { grad: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50/50', text: 'text-blue-700', icon: 'ti-pencil', badgeBg: 'bg-blue-600' },
               skipped: { grad: 'from-slate-400 to-slate-500', bg: 'bg-slate-50', text: 'text-slate-600', icon: 'ti-minus', badgeBg: 'bg-slate-600' }
           };
           
           const sp = sProps[d.status] || sProps.skipped;
           const statusLabel = d.status === 'correct' ? 'Correct' : d.status === 'wrong' ? 'Wrong' : d.status === 'partial' ? 'Partial' : d.status === 'evaluated' ? 'Evaluated' : d.status === 'submitted' ? 'Pending' : 'Skipped';
           const earnedStr = d.earned > 0 ? '+' + d.earned : d.earned < 0 ? '' + d.earned : '0';

           let userSel = Array.isArray(ans.val) ? ans.val : (ans.val !== null ? [ans.val] : []);
           let corrSel = q.correct || [];

           return (
             <div key={i} className="relative bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] group">
                
                {/* Vibrant Top Accent Line */}
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${sp.grad}`}></div>
                
                {/* Compact Header */}
                <div className={`px-4 py-3 ${sp.bg} border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1`}>
                    <div className={`flex items-center gap-2 font-black ${sp.text} text-[15px]`}>
                        <i className={`ti ${sp.icon} text-[20px]`}></i>
                        <span>Q{originalQIdx + 1} <span className="opacity-40 mx-1">|</span> <span className="font-semibold text-xs uppercase tracking-wide">{getLabel(q.type)}</span></span>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                        
                        {/* 🔥 NAYA: INDIVIDUAL QUESTION TIME SPENT BADGE 🔥 */}
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-white border border-slate-200 text-slate-600 shadow-sm flex items-center gap-1.5" title="Time taken on this question">
                            <i className="ti ti-stopwatch text-slate-400 text-sm"></i> 
                            {formatQTime(sub.timeSpentPerQuestion?.[originalQIdx])}
                        </span>

                        <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-extrabold text-white shadow-sm ${sp.badgeBg}`}>
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
                        <StaticMath isBlock={true} html={q.text} className="text-[14px] sm:text-[15.5px] leading-relaxed text-slate-800 font-semibold whitespace-normal break-words" />
                        
                        {/* Universal Compact Figure Engine (With SVG/URL Fixes) */}
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
                                {/* 🔥 SMART TIKZ FIX 🔥 */}
                                {q.figureType === 'tikz' && (
                                    <div className="hide-scroll max-w-full overflow-x-auto bg-white p-2 rounded-lg border border-slate-200 shadow-sm inline-block">
                                        <img 
                                            src={`https://i.upmath.me/svg/${encodeURIComponent(
                                                q.figureData.includes('\\begin{tikzpicture}') 
                                                ? q.figureData 
                                                : '\\begin{tikzpicture}\n' + q.figureData + '\n\\end{tikzpicture}'
                                            )}`} 
                                            alt="Math Graphic" 
                                            className="max-w-full max-h-[200px] object-contain" 
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x150/f8fafc/ef4444?text=TikZ+Failed'; }} 
                                        />
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

                    {/* === RIGHT COLUMN: Options, Explanation, & Audit === */}
                    <div className="flex flex-col gap-4">
                        
                        {/* MCQ / MSQ Options */}
                        <div className="flex flex-col gap-2.5">
                            {(q.type === 'mcq' || q.type === 'msq') && q.options.map((o, j) => {
                                let isUser = userSel.includes(j);
                                let isCorr = corrSel.includes(j);
                                
                                let optBg = 'bg-slate-50 hover:bg-slate-100 border-slate-200', optText = 'text-slate-700', iconUi = null;
                                if (isCorr && isUser) { optBg = 'bg-emerald-50 border-emerald-500 shadow-[0_0_0_1px_#10b981]'; optText = 'text-emerald-900 font-bold'; iconUi = <i className="ti ti-check text-xl text-emerald-600"></i>; }
                                else if (isCorr && !isUser) { optBg = 'bg-white border-emerald-400 border-dashed border-2'; optText = 'text-emerald-800 font-bold'; iconUi = <i className="ti ti-check text-xl text-emerald-400 opacity-60"></i>; }
                                else if (!isCorr && isUser) { optBg = 'bg-rose-50 border-rose-500 shadow-[0_0_0_1px_#ef4444]'; optText = 'text-rose-900 font-bold'; iconUi = <i className="ti ti-x text-xl text-rose-600"></i>; }

                                return (
                                    <div key={j} className={`flex items-start gap-3 p-3 rounded-xl border-2 ${optBg} transition-all duration-200 w-full overflow-hidden`}>
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border-2 bg-white ${isCorr && isUser ? 'border-emerald-500 text-emerald-600 shadow-sm' : (!isCorr && isUser) ? 'border-rose-500 text-rose-600 shadow-sm' : 'border-slate-300 text-slate-500'}`}>
                                            {String.fromCharCode(65 + j)}
                                        </div>
                                        <div className="flex-1 flex flex-col gap-1.5 min-w-0 pt-0.5">
                                            {o.startsWith('[smiles]') ? (
                                                <div className="pointer-events-none bg-white p-1.5 rounded-lg border border-slate-200 inline-block w-fit">
                                                    <SmilesViewer smilesCode={o.replace('[smiles]', '').trim()} width={120} height={120} />
                                                </div>
                                            ) : (
                                                <StaticMath isBlock={true} html={o} className={`text-[14px] sm:text-[14.5px] whitespace-normal break-words ${optText}`} />
                                            )}
                                            {(isUser || isCorr) && (
                                                <div className="flex gap-2 flex-wrap mt-1">
                                                    {isUser && <span className="text-[9px] uppercase tracking-wider font-extrabold bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-sm"><i className="ti ti-hand-click"></i> Picked</span>}
                                                    {isCorr && <span className="text-[9px] uppercase tracking-wider font-extrabold bg-emerald-500 text-white px-1.5 py-0.5 rounded shadow-sm"><i className="ti ti-key"></i> Key</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-0.5 flex-shrink-0">{iconUi}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Integer Type */}
                        {q.type === 'integer' && (
                            <div className="flex gap-3 mt-1">
                                <div className={`flex-1 p-3 sm:p-4 rounded-xl border-2 flex flex-col justify-center ${d.status === 'correct' ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-rose-50 border-rose-400 text-rose-900'}`}>
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-70 mb-0.5">Your Answer</span>
                                    <strong className="text-2xl">{ans.val !== null ? ans.val : '—'}</strong>
                                </div>
                                <div className="flex-1 p-3 sm:p-4 rounded-xl border-2 border-emerald-400 bg-white text-emerald-900 flex flex-col justify-center relative overflow-hidden shadow-sm">
                                    <i className="ti ti-key absolute -right-2 -bottom-2 text-5xl text-emerald-50"></i>
                                    <span className="text-[10px] uppercase tracking-wider font-extrabold opacity-70 mb-0.5 relative z-10">Correct</span>
                                    <strong className="text-2xl relative z-10">{q.correctInt}</strong>
                                </div>
                            </div>
                        )}

                        {/* Subjective Type */}
                        {q.type === 'subjective' && (
                            <div className="flex flex-col gap-3 mt-1">
                                <div className="p-4 rounded-xl border-2 bg-slate-50 border-slate-200 flex gap-3 items-start">
                                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm"><i className="ti ti-pencil text-slate-700 text-lg"></i></div>
                                    <div>
                                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 mb-1 block">Your Answer</span>
                                        <span className="text-[14px] leading-relaxed text-slate-800 font-medium">{ans.val || <em className="text-slate-400">No answer.</em>}</span>
                                    </div>
                                </div>
                                {q.modelAnswer && (
                                    <div className="p-4 rounded-xl border-2 bg-emerald-50 border-emerald-300 flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full bg-white border border-emerald-200 flex items-center justify-center flex-shrink-0 shadow-sm"><i className="ti ti-bulb text-emerald-600 text-lg"></i></div>
                                        <div>
                                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 mb-1 block">Model Answer</span>
                                            <span className="text-[14px] leading-relaxed text-emerald-900 font-medium">{q.modelAnswer}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Explanation Accordion */}
                        {q.explanation && (
                            <details className="group rounded-xl border border-indigo-100 overflow-hidden transition-all duration-300 bg-white shadow-sm mt-1">
                                <summary className="cursor-pointer p-3 sm:p-4 font-bold text-indigo-700 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 transition-colors select-none">
                                    <span className="flex items-center gap-2 text-[13px] sm:text-[14px]"><i className="ti ti-bulb text-lg text-indigo-500"></i> Solution / Logic</span>
                                    <div className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-600 group-open:bg-indigo-600 group-open:text-white transition-all duration-300 transform group-open:rotate-180">
                                        <i className="ti ti-chevron-down text-sm"></i>
                                    </div>
                                </summary>
                                <div className="p-4 sm:p-5 border-t border-indigo-100 text-[13.5px] sm:text-[14px] text-slate-800 leading-relaxed font-medium bg-white">
                                    <StaticMath isBlock={true} html={q.explanation} className="math-scroll-box" />
                                </div>
                            </details>
                        )}
                        
                        {/*SLEEK AUDIT LOG*/}
                        {d.auditLogs && d.auditLogs.length > 0 && (
                            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col gap-2">
                                <div className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5"><i className="ti ti-history text-sm"></i> Evaluation Audit Trail</span>
                                </div>
                                
                                {d.auditLogs.map((log, lIdx) => (
                                    <div key={lIdx} className="bg-white px-3 py-2.5 rounded-lg border border-slate-200 flex flex-col gap-1 shadow-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 text-[12px]">
                                                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black shrink-0 border border-emerald-200 shadow-inner">{log.awarded} Mks</span>
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{log.examiner?.split('@')[0] || 'Examiner'}</span>
                                            </div>
                                            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">{log.date?.split(',')[0]}</div>
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
      </div>
      
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
    </div>
  );
}