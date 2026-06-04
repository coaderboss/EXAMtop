// src/app/student-dashboard/page.js
'use client';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext'; // Asli data yahan se aayega
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const { tests, loadingData } = useData(); 
  const router = useRouter();

  if (authLoading || loadingData) {
    return (
      <div className="spinner-container" style={{ paddingTop: '10vh' }}>
        <div className="spinner"></div>
        <div style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>Loading Dashboard...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
        <i className="ti ti-lock" style={{ fontSize: '48px', display: 'block', marginBottom: '1rem', opacity: 0.5 }}></i>
        <div style={{ fontSize: '16px', fontWeight: 500 }}>Please Login to view your analytics.</div>
        <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => router.push('/')}>
          Go to Home
        </button>
      </div>
    );
  }

  // --- DATA CALCULATION LOGIC ---
  // --- DATA CALCULATION LOGIC ---
  let myHistory = [];
  tests.forEach(t => {
      if (t.submissions) {
          t.submissions.forEach((s, idx) => {
              // 🔥 STRICT MATCH LOGIC: Match ONLY by unique Firebase UID or authenticated Email. NO NAME MATCHING!
              let isExactMatch = (s.uid && currentUser.uid && s.uid === currentUser.uid) || 
                                 (s.email && currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase());

              if (isExactMatch) {
                  myHistory.push({ testId: t.id, testTitle: t.title, testCode: t.code, score: s.score, totalMarks: s.totalMarks, correct: s.correct, wrong: s.wrong, skipped: s.skipped, time: s.time, sIdx: idx });
              }
          });
      }
  });

  let totalTests = myHistory.length; 
  let totalCorrect = 0, totalWrong = 0, totalEarned = 0, totalMax = 0;
  
  myHistory.forEach(h => { 
      totalCorrect += h.correct; 
      totalWrong += h.wrong; 
      totalEarned += h.score; 
      totalMax += h.totalMarks; 
  });

  let overallAccuracy = (totalCorrect + totalWrong) > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;
  let overallPercentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div className="page-title">My Analytics Dashboard</div>
        <div className="page-sub">Track your performance, overall accuracy, and past exam history.</div>
      </div>


      {totalTests === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)', background: 'var(--color-background-primary)', borderRadius: '12px', border: '1px dashed var(--color-border-primary)' }}>
             <i className="ti ti-chart-line" style={{ fontSize: '48px', display: 'block', marginBottom: '1rem', opacity: 0.5 }}></i>
             <div style={{ fontSize: '16px', fontWeight: 500 }}>No tests attempted yet. Join a test to see your analytics!</div>
          </div>
      ) : (
          <>
            <div className="grid4" style={{ marginBottom: '2rem' }}>
                <div className="stat-card">
                    <div className="stat-val" style={{ color: '#185FA5' }}>{totalTests}</div>
                    <div className="stat-lbl">Tests Attempted</div>
                </div>
                <div className="stat-card">
                    <div className="stat-val" style={{ color: '#3B6D11' }}>{overallAccuracy}%</div>
                    <div className="stat-lbl">Overall Accuracy</div>
                </div>
                <div className="stat-card">
                    <div className="stat-val" style={{ color: '#A32D2D' }}>{totalWrong}</div>
                    <div className="stat-lbl">Total Mistakes</div>
                </div>
                <div className="stat-card">
                    <div className="stat-val" style={{ color: '#854F0B' }}>{overallPercentage}%</div>
                    <div className="stat-lbl">Avg Percentage</div>
                </div>
            </div>

            <h3 style={{ marginBottom: '1rem', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-history" style={{ color: '#185FA5' }}></i> Recent Test History
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myHistory.slice().reverse().map((h, index) => {
                    let pct = Math.round((h.score / h.totalMarks) * 100);
                    return (
                        <div key={index} className="test-entry" style={{ alignItems: 'center', padding: '1rem 1.5rem' }}>
                            <div className="te-meta">
                                <div style={{ fontWeight: 600, fontSize: '16px', color: '#0f172a' }}>
                                    {h.testTitle} <span className="badge b-gray" style={{ fontSize: '11px', marginLeft: '8px' }}>Code: {h.testCode}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Attempted on: {h.time}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 600, color: '#185FA5', fontSize: '16px' }}>
                                        {h.score} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>/ {h.totalMarks}</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                        Accuracy: {h.correct + h.wrong > 0 ? Math.round((h.correct / (h.correct + h.wrong)) * 100) : 0}%
                                    </div>
                                </div>
                                <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: pct >= 75 ? '#EAF3DE' : pct >= 40 ? '#FAEEDA' : '#FCEBEB', color: pct >= 75 ? '#27500A' : pct >= 40 ? '#633806' : '#791F1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', border: `2px solid ${pct >= 75 ? '#C0DD97' : pct >= 40 ? '#FAC775' : '#F7C1C1'}` }}>
                                    {pct}%
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
          </>
      )}
    </div>
  );
}