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
            
            // 🔥 FIX 1: PERFECT SORTING (Sabse naya result sabse upar)
            historyTemp.sort((a, b) => {
                const timeA = a.sub.timestamp || Date.parse(a.sub.time) || 0;
                const timeB = b.sub.timestamp || Date.parse(b.sub.time) || 0;
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
                // Smart check: Agar exam pichle 2 minute me submit hua hai, toh usko chamkao
                const subTimeMs = h.sub.timestamp || Date.parse(h.sub.time) || 0;
                const isRecent = (Date.now() - subTimeMs) < 120000; 
                
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

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease' }}>
      
      <button className="btn btn-ghost" style={{ marginBottom: '1rem', padding: 0, fontWeight: 600, color: 'var(--color-text-secondary)' }} onClick={() => { setSelectedResult(null); setSectionFilter('all_sections'); }}>
        <i className="ti ti-arrow-left"></i> Back to Results
      </button>

      {/* 🔥 PREMIUM HERO & SECURITY SECTION (V6 - Time Taken & Scrollable Alerts) 🔥 */}
      <style>{`
          
          }
      `}</style>

      <div className="premium-hero">
          {/* Background Decorative Glow */}
          <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', background: 'rgba(255, 255, 255, 0.1)', filter: 'blur(40px)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', bottom: '-50px', left: '10%', width: '150px', height: '150px', background: 'rgba(52, 211, 153, 0.2)', filter: 'blur(40px)', borderRadius: '50%' }}></div>

          {/* Left Side: Student & Test Info */}
          <div className="hero-left">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                  <i className="ti ti-notebook" style={{ color: '#fff' }}></i> {test.title}
              </div>
              
              <h2 className="hero-title">{sub.name}</h2>
              
              <div className="hero-tags" style={{ fontSize: '12px', color: '#e2e8f0', marginBottom: '1.25rem', fontWeight: 600 }}>
                  {sub.roll && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '5px 10px', borderRadius: '8px' }}><i className="ti ti-id"></i> {sub.roll}</span>}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '5px 10px', borderRadius: '8px' }}><i className="ti ti-calendar-time"></i> {sub.time}</span>
                  
                  {/* 🔥 NEW: TIME TAKEN FEATURE */}
                  {sub.timeTaken && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.2)', padding: '5px 10px', borderRadius: '8px', color: '#a7f3d0', border: '1px solid rgba(16,185,129,0.3)' }}>
                          <i className="ti ti-stopwatch"></i> Time Taken: {sub.timeTaken}
                      </span>
                  )}
              </div>

              <div className="hero-tags">
                  {/* Premium Percentage Badge */}
                  <span style={{ fontSize: '13px', fontWeight: 700, background: pct >= 75 ? 'rgba(52,211,153,0.2)' : pct >= 40 ? 'rgba(251,191,36,0.2)' : 'rgba(248,113,113,0.2)', color: '#fff', border: `1px solid ${pct >= 75 ? 'rgba(52,211,153,0.4)' : pct >= 40 ? 'rgba(251,191,36,0.4)' : 'rgba(248,113,113,0.4)'}`, padding: '6px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(10px)' }}>
                      <i className="ti ti-activity" style={{ fontSize: '16px' }}></i> {pct}% &bull; {pct >= 90 ? 'Excellent' : pct >= 75 ? 'Great Job' : pct >= 50 ? 'Good Effort' : pct >= 35 ? 'Keep Practicing' : 'Needs Work'}
                  </span>
                  
                  {/* Certificate Button */}
                  {pct >= 75 && (
                      <button onClick={generateCertificate} style={{ background: '#fff', color: '#185FA5', border: 'none', padding: '7px 16px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                          <i className="ti ti-medal" style={{ fontSize: '16px', color: '#d4af37' }}></i> Certificate
                      </button>
                  )}
              </div>
          </div>

          {/* Right Side: Glowing Score Card */}
          <div className="hero-score-ring">
              <div style={{ position: 'absolute', inset: '6px', borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.4)' }}></div>
              <div className="hero-score-val">{sub.score}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginTop: '4px', zIndex: 2, textTransform: 'uppercase', letterSpacing: '1px' }}>/ {test.totalMarks}</div>
          </div>
      </div>

      {/* 🔥 PREMIUM CHEAT LOGS WARNING 🔥 */}
      {sub.cheatLogs && sub.cheatLogs.length > 0 && (
        <div className="security-card">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                    <i className="ti ti-shield-x"></i>
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>Security & Proctoring Alert</h4>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>System recorded suspicious activities</div>
                </div>
            </div>

            {/* 🔥 FIX: Warning Rows (Now Scrollable!) */}
            <div className="warn-container">
                {sub.cheatLogs.map((log, index) => (
                    <div key={index} className="warn-row" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#fee2e2', color: '#ef4444', fontSize: '10px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Warning {index + 1}</div>
                        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}><i className="ti ti-clock"></i> {log.time}</div>
                        <div className="warn-divider" style={{ width: '1px', height: '14px', background: '#cbd5e1' }}></div>
                        <div className="warn-text" style={{ color: '#334155', fontSize: '13px', fontWeight: 600, flex: 1 }}>{log.reason}</div>
                    </div>
                ))}
            </div>

            {/* Auto Submit Tag */}
            {sub.cheatLogs.length >= 3 && (
                <div style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', padding: '10px 16px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 15px rgba(239,68,68,0.3)' }}>
                    <i className="ti ti-ban" style={{ fontSize: '16px' }}></i> Auto-Submitted Due To Violations
                </div>
            )}
        </div>
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
              sub.details.forEach(item => {
                  const sec = item.q.section || 'General';
                  if (!sectionStats[sec]) sectionStats[sec] = { score: 0, max: 0, correct: 0, total: 0 };
                  
                  sectionStats[sec].total += 1;
                  sectionStats[sec].max += Number(item.q.marks || 0);
                  
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
                                      <div key={idx} style={{ flex: '0 0 auto', minWidth: '200px', background: '#f1f5f9', padding: '12px 15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <i className="ti ti-folder" style={{ color: '#185FA5', fontSize: '16px' }}></i>
                                              <span style={{ fontWeight: 700, color: '#334155', fontSize: '13px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec}</span>
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

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-secondary)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '18px', fontWeight: 600 }}>Question-wise Analysis</div>
            {(() => {
                //  DYNAMIC COUNT CALCULATION BASED ON ACTIVE SECTION
                const secDetails = sub.details.filter(d => sectionFilter === 'all_sections' || d.q.section === sectionFilter || (!d.q.section && sectionFilter === (test.sections?.[0])));
                const countAll = secDetails.length;
                const countCorrect = secDetails.filter(d => d.status === 'correct' || d.status === 'partial').length;
                const countWrong = secDetails.filter(d => d.status === 'wrong').length;
                const countSkipped = secDetails.filter(d => d.status === 'skipped' || d.status === 'submitted' || d.status === 'evaluated').length;
                
                return (
                    <div className="filter-tabs" style={{ marginBottom: 0 }}>
                      <button className={`ftab ${filter === 'all' ? 'active' : ''}`} onClick={() => changeStatusFilter('all')}>All ({countAll})</button>
                      <button className={`ftab ${filter === 'correct' ? 'active' : ''}`} onClick={() => changeStatusFilter('correct')}>Correct ({countCorrect})</button>
                      <button className={`ftab ${filter === 'wrong' ? 'active' : ''}`} onClick={() => changeStatusFilter('wrong')}>Wrong ({countWrong})</button>
                      <button className={`ftab ${filter === 'skipped' ? 'active' : ''}`} onClick={() => changeStatusFilter('skipped')}>Skipped ({countSkipped})</button>
                    </div>
                );
            })()}
        </div>

        {/*  NEW: Section Scrollable Pill Menu */}
        {test.sections && test.sections.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
                <button 
                    className="btn btn-sm" 
                    style={{ whiteSpace: 'nowrap', fontWeight: 600, background: sectionFilter === 'all_sections' ? '#185FA5' : '#f1f5f9', color: sectionFilter === 'all_sections' ? '#fff' : '#64748b', border: 'none', borderRadius: '20px', padding: '6px 16px' }} 
                    onClick={() => changeSectionFilter('all_sections')}
                >
                    All Sections
                </button>
                {test.sections.map((sec, idx) => (
                    <button 
                        key={idx} 
                        className="btn btn-sm" 
                        style={{ whiteSpace: 'nowrap', fontWeight: 600, background: sectionFilter === sec ? '#185FA5' : '#f1f5f9', color: sectionFilter === sec ? '#fff' : '#64748b', border: 'none', borderRadius: '20px', padding: '6px 16px' }} 
                        onClick={() => changeSectionFilter(sec)}
                    >
                        {sec}
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* Question Review Cards (With Shutter Fade Effect) */}
      <div style={{ opacity: isMathReady ? 1 : 0, transition: 'opacity 0.3s ease-in', minHeight: '50vh' }}>
        {sub.details.filter(d => {
            //  Dono conditions (Status aur Section) match honi chahiye
            let sMatch = filter === 'all' || d.status === filter || (filter === 'skipped' && (d.status === 'submitted' || d.status === 'evaluated'));
            let secMatch = sectionFilter === 'all_sections' || d.q.section === sectionFilter || (!d.q.section && sectionFilter === (test.sections?.[0]));
            return sMatch && secMatch;
        }).map((d, i) => {
           const q = d.q;
           const ans = d.ans;
           const originalQIdx = sub.details.indexOf(d);
           const headerBg = d.status === 'correct' ? '#EAF3DE' : d.status === 'wrong' ? '#FCEBEB' : d.status === 'partial' ? '#FAEEDA' : (d.status === 'submitted' || d.status === 'evaluated') ? '#EEEDFE' : 'var(--color-background-secondary)';
           const headerColor = d.status === 'correct' ? '#27500A' : d.status === 'wrong' ? '#791F1F' : d.status === 'partial' ? '#633806' : (d.status === 'submitted' || d.status === 'evaluated') ? '#3C3489' : 'var(--color-text-secondary)';
           const icon = d.status === 'correct' ? 'ti-circle-check' : d.status === 'wrong' ? 'ti-circle-x' : d.status === 'partial' ? 'ti-adjustments-alt' : (d.status === 'submitted' || d.status === 'evaluated') ? 'ti-pencil' : 'ti-minus';
           const statusLabel = d.status === 'correct' ? 'Correct' : d.status === 'wrong' ? 'Wrong' : d.status === 'partial' ? 'Partially Correct' : d.status === 'evaluated' ? 'Evaluated manually' : d.status === 'submitted' ? 'Pending Evaluation' : 'Skipped';
           const earnedStr = d.earned > 0 ? '+' + d.earned : d.earned < 0 ? '' + d.earned : '0';

           let userSel = Array.isArray(ans.val) ? ans.val : (ans.val !== null ? [ans.val] : []);
           let corrSel = q.correct || [];

           return (
             <div key={i} className="q-review-card">
                <div className="qr-header" style={{ background: headerBg, color: headerColor }}>
                    <i className={`ti ${icon}`} style={{ fontSize: '20px' }}></i>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>Question {originalQIdx + 1} &mdash; {getLabel(q.type)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: 600, background: 'rgba(255,255,255,0.6)', padding: '4px 10px', borderRadius: '12px' }}>{statusLabel} &nbsp; {earnedStr} marks</span>
                </div>
                {/*  OVERFLOW FIX: Strict maxWidth aur hide-scroll laga diya */}
                <div className="qr-body hide-scroll" style={{ maxWidth: '100%', overflowX: 'auto', minWidth: 0 }}>
                    
                    {/* 🔥 FIX: MathJax Protector applied to Question Text */}
                    <StaticMath isBlock={true} html={q.text} style={{ fontSize: '16px', lineHeight: 1.7, marginBottom: '1.5rem', color: 'var(--color-text-primary)', fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%' }} />
                    
                    {/* 🔥 NEW COMPACT FIGURE ENGINE (Perfectly Centered & No Extra Space) */}
                    {q.figureType && q.figureType !== 'none' && q.figureData && (
                        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '0.5rem 0 1.5rem 0' }}>
                            
                            {(q.figureType === 'image' || q.figureType === 'url') && (
                                <img src={q.figureData} alt="Figure" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)', objectFit: 'contain', background: '#fff' }} />
                            )}
                            
                            {q.figureType === 'smiles' && (
                                <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)', display: 'inline-block', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                    <SmilesViewer smilesCode={q.figureData} width={200} height={200} />
                                </div>
                            )}
                            
                            {q.figureType === 'tikz' && (
                                <div className="hide-scroll" style={{ maxWidth: '100%', overflowX: 'auto', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)', display: 'inline-block', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                    <img src={`https://i.upmath.me/svg/${encodeURIComponent('\\begin{tikzpicture}\n' + q.figureData + '\n\\end{tikzpicture}')}`} alt="Math Graphic" style={{ maxWidth: '100%', objectFit: 'contain' }} />
                                </div>
                            )}
                            
                        </div>
                    )}
                    
                    {/* Fallback for very old JSON imports that still use imgUrl */}
                    {!q.figureType && q.imgUrl && (
                        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', margin: '0.5rem 0 1.5rem 0' }}>
                            <img src={q.imgUrl} style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)', objectFit: 'contain', background: '#fff' }} alt="Legacy Question Figure" />
                        </div>
                    )}
                                        
                    {/* MCQ / MSQ Options */}
                    {(q.type === 'mcq' || q.type === 'msq') && q.options.map((o, j) => {
                        let isUser = userSel.includes(j);
                        let isCorr = corrSel.includes(j);
                        let cls = 'neutral', borderStyle = {};
                        
                        if (isCorr && isUser) { cls = 'correct'; borderStyle = { borderColor: '#3B6D11', background: '#EAF3DE' }; }
                        else if (isCorr && !isUser) { cls = 'neutral'; borderStyle = { borderColor: '#C0DD97', background: '#f4f9ed' }; }
                        else if (!isCorr && isUser) { cls = 'wrong'; borderStyle = { borderColor: '#A32D2D', background: '#FCEBEB' }; }

                        return (
                            //  FIX 1: hide-scroll and maxWidth to prevent outer div overflow
                            <div key={j} className={`qr-opt ${cls} hide-scroll`} style={{ ...borderStyle, maxWidth: '100%' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2px solid currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, flexShrink: 0, background: 'rgba(255,255,255,0.7)' }}>{String.fromCharCode(65 + j)}</div>
                                
                                {/*  FIX 2: minWidth: 0 is CRITICAL for flexbox to not stretch the screen */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', padding: '4px 0', minWidth: 0 }} className="hide-scroll">
                                    
                                    {/* MathJax Protector applied to Options */}
                                    {o.startsWith('[smiles]') ? (
                                        <div style={{ pointerEvents: 'none' }}>
                                            <SmilesViewer smilesCode={o.replace('[smiles]', '').trim()} width={150} height={150} />
                                        </div>
                                    ) : (
                                        <StaticMath isBlock={true} html={o} style={{ fontSize: '15px', fontWeight: isUser || isCorr ? 600 : 400, whiteSpace: 'normal', wordBreak: 'break-word' }} />
                                    )}

                                    {(isUser || isCorr) && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {isUser && <span style={{ fontSize: '11px', background: '#185FA5', color: '#fff', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>Student Picked</span>}
                                            {isCorr && <span style={{ fontSize: '11px', background: '#3B6D11', color: '#fff', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>Correct Key</span>}
                                        </div>
                                    )}
                                </div>
                                
                                {isCorr && isUser && <i className="ti ti-check" style={{ fontSize: '22px', color: '#3B6D11', flexShrink: 0 }}></i>}
                                {isUser && !isCorr && <i className="ti ti-x" style={{ fontSize: '22px', color: '#A32D2D', flexShrink: 0 }}></i>}
                            </div>
                        );
                    })}

                    {/* Integer Type */}
                    {q.type === 'integer' && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                            <div className={`qr-opt ${d.status}`} style={{ flex: 1, fontSize: '15px' }}>Answer Typed: <strong style={{ fontSize: '18px', marginLeft: '8px' }}>{ans.val !== null ? ans.val : '—'}</strong></div>
                            <div className="qr-opt correct" style={{ flex: 1, fontSize: '15px' }}>Correct Key: <strong style={{ fontSize: '18px', marginLeft: '8px' }}>{q.correctInt}</strong></div>
                        </div>
                    )}

                    {/* Subjective Type */}
                    {q.type === 'subjective' && (
                        <>
                            <div className="qr-opt neutral" style={{ marginBottom: '0.75rem', alignItems: 'flex-start', padding: '1rem' }}>
                                <i className="ti ti-note" style={{ flexShrink: 0, marginTop: '2px', fontSize: '18px', color: '#185FA5' }}></i>
                                <span style={{ fontSize: '15px', lineHeight: 1.6 }}>{ans.val || <em style={{ color: 'var(--color-text-secondary)' }}>No answer written.</em>}</span>
                            </div>
                            {q.modelAnswer && (
                                <div className="qr-opt correct" style={{ alignItems: 'flex-start', padding: '1rem' }}>
                                    <i className="ti ti-bulb" style={{ flexShrink: 0, marginTop: '2px', fontSize: '18px' }}></i>
                                    <span style={{ fontSize: '15px', lineHeight: 1.6 }}><strong>Model Answer:</strong><br />{q.modelAnswer}</span>
                                </div>
                            )}
                        </>
                    )}

                    {/* Explanation Box for Student */}
                    {q.explanation && (
                        <div style={{ padding: '1rem', background: '#E6F1FB', borderRadius: '8px', borderLeft: '4px solid #185FA5', marginTop: '1.5rem', marginBottom: '1rem' }}>
                            <strong style={{ color: '#114B87', display: 'block', marginBottom: '8px' }}><i className="ti ti-bulb"></i> Solution & Explanation:</strong>
                            {/* 🔥 FIX: MathJax Protector applied to Explanation */}
                            <StaticMath isBlock={true} html={q.explanation} className="math-scroll-box" style={{ fontSize: '14px', color: '#114B87', lineHeight: 1.6 }} />
                        </div>
                    )}
                    
                    {/* Audit Logs */}
                    {d.auditLogs && d.auditLogs.length > 0 && (
                        <div style={{ marginTop: '12px', padding: '10px', background: '#FEF5E5', border: '1px solid #FAC775', borderRadius: '6px', fontSize: '13px', color: '#633806' }}>
                            <div style={{ fontWeight: 600, marginBottom: '4px' }}><i className="ti ti-shield-check"></i> Audit Log (Manual Evaluation)</div>
                            Marks overridden to <strong>{d.auditLogs[d.auditLogs.length - 1].awarded}</strong>. <br /><strong>Reason:</strong> "{d.auditLogs[d.auditLogs.length - 1].reason}" <br />
                            <span style={{ fontSize: '11px', opacity: 0.7 }}>By: {d.auditLogs[d.auditLogs.length - 1].examiner} | Date: {d.auditLogs[d.auditLogs.length - 1].date}</span>
                        </div>
                    )}
                </div>
             </div>
           );
        })}
      </div>

      {/* 🔥 PREMIUM FLOATING SCROLL TO TOP BUTTON */}
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