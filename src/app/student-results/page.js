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
            // Naye tests upar dikhane ke liye reverse
            setMyHistory(historyTemp.reverse());
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {myHistory.map((h, idx) => (
              /*  UPGRADED ANIMATED CARDS */
              <div 
                key={idx} 
                className="test-entry" 
                style={{ 
                    alignItems: 'center', 
                    padding: '1.25rem 1.5rem',
                    opacity: 0,
                    animation: `staggerSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                    animationDelay: `${idx * 0.08}s`,
                    borderLeft: h.canView ? '4px solid #185FA5' : '4px solid #f59e0b'
                }}
              >
                <div className="te-meta" style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {h.test.title} 
                    <span className="badge b-purple" style={{ fontSize: '12px', padding: '4px 10px', fontFamily: 'monospace' }}><i className="ti ti-hash text-base"></i> {h.test.code}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ti ti-calendar-time"></i> Submitted: {h.sub.time}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#185FA5', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ti ti-target"></i> Score: {h.sub.score} / {h.test.totalMarks}
                  </div>
                </div>
                
                <div style={{ flexShrink: 0, marginLeft: '15px' }}>
                  {h.canView ? (
                    <button className="btn btn-primary" style={{ padding: '10px 16px', fontWeight: 600 }} onClick={() => setSelectedResult(h)}>
                      <i className="ti ti-eye"></i> View Report
                    </button>
                  ) : (
                    <span className="badge b-amber" style={{ fontSize: '13px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="ti ti-lock"></i> Pending Release
                    </span>
                  )}
                </div>
              </div>
            ))}
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

      {/* Hero Section */}
      <div className="result-hero">
        <div style={{ fontSize: '15px', opacity: 0.85, marginBottom: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>{test.title}</div>
        <div style={{ fontSize: '24px', fontWeight: 600, marginBottom: '0.25rem' }}>{sub.name} {sub.roll ? '• ' + sub.roll : ''}</div>
        <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '1.5rem' }}>{sub.time}</div>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: '50%', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', margin: '0 auto 1.5rem', boxShadow: '0 0 0 6px rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '42px', fontWeight: 600, marginBottom: '4px' }}>{sub.score}</div>
          <div style={{ fontSize: '14px', opacity: 0.8, fontWeight: 500 }}>/ {test.totalMarks}</div>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 600, background: 'rgba(0,0,0,0.15)', display: 'inline-block', padding: '8px 24px', borderRadius: '30px' }}>
          {pct}% &bull; {pct >= 90 ? 'Excellent Score!' : pct >= 75 ? 'Great Job!' : pct >= 50 ? 'Good Effort' : pct >= 35 ? 'Keep Practicing' : 'Needs Improvement'}
        </div>
        {pct >= 75 && (
          <div style={{ marginTop: '10px' }}>
            <button className="btn btn-sm" style={{ background: '#FAEEDA', color: '#854F0B', borderColor: '#FAC775', fontWeight: 600, marginTop: '12px' }} onClick={generateCertificate}>
              <i className="ti ti-medal"></i> Claim Certificate
            </button>
          </div>
        )}
      </div>

      {/* Cheat Logs Warning */}
      {sub.cheatLogs && sub.cheatLogs.length > 0 && (
        <div className="card" style={{ borderColor: '#A32D2D', background: '#FCEBEB', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(163, 45, 45, 0.1)' }}>
            <h4 style={{ color: '#A32D2D', margin: '0 0 10px 0', fontSize: '16px' }}><i className="ti ti-shield-x" style={{ fontSize: '20px' }}></i> Security & Proctoring Alerts</h4>
            <p style={{ fontSize: '13px', color: '#791F1F', marginBottom: '10px' }}>The system detected suspicious activity during the exam:</p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#791F1F', lineHeight: 1.6 }}>
                {sub.cheatLogs.map((log, index) => <li key={index} style={{ marginBottom: '6px' }}><strong>Warning {index + 1} [{log.time}]:</strong> {log.reason}</li>)}
            </ul>
            {sub.cheatLogs.length >= 3 && <div className="badge b-red" style={{ marginTop: '10px', padding: '6px 10px', fontSize: '13px' }}><i className="ti ti-ban"></i> Test Auto-Submitted due to repeated violations</div>}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-val" style={{ color: '#185FA5' }}>{sub.score}</div><div className="stat-lbl">Total Score</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: '#3B6D11' }}>{sub.correct}</div><div className="stat-lbl">Correct</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: '#A32D2D' }}>{sub.wrong}</div><div className="stat-lbl">Incorrect</div></div>
        <div className="stat-card"><div className="stat-val" style={{ color: 'var(--color-text-secondary)' }}>{sub.skipped}</div><div className="stat-lbl">Skipped</div></div>
      </div>

      <div className="grid2" style={{ marginBottom: '2rem' }}>
        {/* Performance Overview */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title"><i className="ti ti-chart-pie" style={{ fontSize: '20px', color: '#185FA5' }}></i> Performance Overview</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}><span>Total Marks Scored</span><span style={{ fontWeight: 600 }}>{sub.score} / {test.totalMarks}</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }}></div></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', margin: '1.25rem 0 8px' }}><span>Accuracy (Attempted)</span><span style={{ fontWeight: 600 }}>{accuracy}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${accuracy}%`, background: '#3B6D11' }}></div></div>
          
          <div style={{ marginTop: '1.5rem' }} className="bar-chart">
            <div className="bar-col"><div className="bar-val" style={{ color: '#3B6D11' }}>{sub.correct}</div><div className="bar" style={{ height: `${bH(sub.correct)}px`, background: '#C0DD97' }}></div><div className="bar-lbl">Correct</div></div>
            <div className="bar-col"><div className="bar-val" style={{ color: '#A32D2D' }}>{sub.wrong}</div><div className="bar" style={{ height: `${bH(sub.wrong)}px`, background: '#F7C1C1' }}></div><div className="bar-lbl">Wrong</div></div>
            <div className="bar-col"><div className="bar-val" style={{ color: 'var(--color-text-secondary)' }}>{sub.skipped}</div><div className="bar" style={{ height: `${bH(sub.skipped)}px`, background: 'var(--color-border-primary)' }}></div><div className="bar-lbl">Skipped</div></div>
          </div>
        </div>

        {/* Warning/Notes Summary */}
        <div className="card" style={{ marginBottom: 0 }}>
           <div className="card-title"><i className="ti ti-list-details" style={{ fontSize: '20px', color: '#185FA5' }}></i> Test Summary</div>
           <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
              Total Attempted: <strong style={{ color: 'var(--color-text-primary)', fontSize: '15px' }}>{sub.correct + sub.wrong}</strong> / {test.questions.length}<br/>
              Negative Marks: <strong style={{ color: '#A32D2D', fontSize: '15px' }}>-{(sub.wrong * (test.negMarking || 0)).toFixed(2)}</strong>
           </div>
        </div>
      </div>

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
                    
                    {/* Universal Hybrid Figure Renderer Wrapper */}
                    <div className="hide-scroll" style={{ maxWidth: '100%', minWidth: 0 }}>
                        <FigureRenderer figureType={q.figureType} figureData={q.figureData} />
                    </div>
                    
                    {/* Fallback for very old JSON imports that still use imgUrl */}
                    {!q.figureType && q.imgUrl && (
                         <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                             <img src={q.imgUrl} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)' }} alt="Legacy Question Figure" />
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