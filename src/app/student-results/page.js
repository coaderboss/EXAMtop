// src/app/student-results/page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter } from 'next/navigation';

export default function StudentResults() {
  const { currentUser, loading: authLoading } = useAuth();
  const { tests, loadingData } = useData();
  const router = useRouter();

  // State to toggle between List View and Detailed View
  const [selectedResult, setSelectedResult] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'correct', 'wrong', 'skipped'

  // MathJax Auto-Renderer for detailed view
  // MathJax Auto-Renderer for detailed view
  // MathJax Auto-Renderer for detailed view
  useEffect(() => {
    const renderMath = async () => {
        if (selectedResult && typeof window !== 'undefined' && window.MathJax && window.MathJax.typesetPromise) {
            try {
                window.MathJax.typesetClear();
                await window.MathJax.typesetPromise();
            } catch (err) {
                console.log('MathJax Error:', err);
            }
        }
    };
    // 100ms delay ensures JSON text is painted before scanning
    const timer = setTimeout(renderMath, 100);
    return () => clearTimeout(timer);
  }, [selectedResult, filter]); // 🔥 THE FIX: selectedResult kar diya!

  if (authLoading || loadingData) {
    return <div className="spinner-container" style={{ paddingTop: '10vh' }}><div className="spinner"></div><div>Fetching Results...</div></div>;
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

  // Calculate History
  let myHistory = [];
  tests.forEach(t => {
    if (t.submissions) {
      t.submissions.forEach((s, idx) => {
        if (s.uid === currentUser.uid || (s.name && currentUser.displayName && s.name.toLowerCase() === currentUser.displayName.toLowerCase())) {
          let canView = (t.resultVis === 'instant') || (t.released === true);
          myHistory.push({ test: t, sub: s, canView });
        }
      });
    }
  });
  myHistory.reverse();

  // Helpers for UI
  const getLabel = (type) => ({ mcq: 'Single Correct', msq: 'Multi Correct', integer: 'Integer Type', subjective: 'Subjective' }[type] || type);
  const getBadge = (type) => ({ mcq: 'b-blue', msq: 'b-green', integer: 'b-amber', subjective: 'b-purple' }[type] || 'b-gray');

  // ==========================================
  // VIEW 1: LIST OF PAST RESULTS
  // ==========================================
  if (!selectedResult) {
    return (
      <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease' }}>
        <div className="page-header">
          <div className="page-title">My Past Results</div>
          <div className="page-sub">Review your evaluated papers, correct answers, and examiner remarks.</div>
        </div>

        {myHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
            <i className="ti ti-file-off" style={{ fontSize: '48px', display: 'block', marginBottom: '1rem', opacity: 0.5 }}></i>
            <div style={{ fontSize: '16px', fontWeight: 500 }}>No results found.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myHistory.map((h, idx) => (
              <div key={idx} className="test-entry" style={{ alignItems: 'center', padding: '1.25rem 1.5rem' }}>
                <div className="te-meta">
                  <div style={{ fontWeight: 600, fontSize: '16px' }}>
                    {h.test.title} <span className="badge b-gray" style={{ fontSize: '11px', marginLeft: '8px' }}>Code: {h.test.code}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>Submitted: {h.sub.time}</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#185FA5', marginTop: '6px' }}>Score: {h.sub.score}/{h.test.totalMarks}</div>
                </div>
                <div>
                  {h.canView ? (
                    <button className="btn btn-primary btn-sm" onClick={() => setSelectedResult(h)}>
                      <i className="ti ti-eye"></i> Review Paper
                    </button>
                  ) : (
                    <span className="badge b-amber" style={{ fontSize: '13px', padding: '6px 12px' }}>
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
      
      <button className="btn btn-ghost" style={{ marginBottom: '1rem', padding: 0, fontWeight: 600, color: 'var(--color-text-secondary)' }} onClick={() => setSelectedResult(null)}>
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
            <button className="btn btn-sm" style={{ background: '#FAEEDA', color: '#854F0B', borderColor: '#FAC775', fontWeight: 600, marginTop: '12px' }} onClick={() => alert('Certificate feature will be linked here!')}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '12px', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-secondary)' }}>
        <div style={{ fontSize: '18px', fontWeight: 600 }}>Question-wise Analysis</div>
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          <button className={`ftab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All ({sub.details.length})</button>
          <button className={`ftab ${filter === 'correct' ? 'active' : ''}`} onClick={() => setFilter('correct')}>Correct ({sub.correct})</button>
          <button className={`ftab ${filter === 'wrong' ? 'active' : ''}`} onClick={() => setFilter('wrong')}>Wrong ({sub.wrong})</button>
          <button className={`ftab ${filter === 'skipped' ? 'active' : ''}`} onClick={() => setFilter('skipped')}>Skipped ({sub.skipped})</button>
        </div>
      </div>

      {/* Question Review Cards */}
      <div>
        {sub.details.filter(d => filter === 'all' || d.status === filter || (filter === 'skipped' && (d.status === 'submitted' || d.status === 'evaluated'))).map((d, i) => {
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
                <div className="qr-body">
                    <div style={{ fontSize: '16px', lineHeight: 1.7, marginBottom: '1.5rem', color: 'var(--color-text-primary)', fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: q.text }}></div>
                    {q.imgUrl && <div style={{ marginBottom: '1.5rem' }}><img src={q.imgUrl} style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--color-border-secondary)' }} /></div>}
                    
                    {/* MCQ / MSQ Options */}
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
                                         <div style={{ fontSize: '15px', fontWeight: isUser || isCorr ? 600 : 400 }} dangerouslySetInnerHTML={{ __html: o }}></div>                                    {(isUser || isCorr) && (
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
                            <div style={{ fontSize: '14px', color: '#114B87', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
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
    </div>
  );
}