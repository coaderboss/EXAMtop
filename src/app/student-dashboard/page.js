// src/app/student-dashboard/page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
// 🔥 THE FIX: Direct Firebase DB imports for On-Demand Fetching
import { database } from '../../lib/firebase';
import { ref, get } from 'firebase/database';

export default function StudentDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- NEW STATES FOR SMART FETCHING ---
  const [myHistory, setMyHistory] = useState([]);
  const [fetchingResults, setFetchingResults] = useState(true);

  // 🔥 THE FIX: Smart Database Query (Only fetch when dashboard opens)
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) {
        setFetchingResults(false);
        return;
      }
      
      try {
        setFetchingResults(true);
        const snapshot = await get(ref(database, 'tests'));
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            const allTests = Array.isArray(data) ? data : Object.values(data);
            let historyTemp = [];

            allTests.filter(Boolean).forEach(t => {
                if (t.submissions) {
                    const subsArray = Array.isArray(t.submissions) ? t.submissions : Object.values(t.submissions);
                    subsArray.filter(Boolean).forEach((s, idx) => {
                        let isExactMatch = (s.uid && currentUser.uid && s.uid === currentUser.uid) || 
                                           (s.email && currentUser.email && s.email.toLowerCase() === currentUser.email.toLowerCase());

                        if (isExactMatch) {
                            historyTemp.push({ testId: t.id, testTitle: t.title, testCode: t.code, score: s.score, totalMarks: s.totalMarks, correct: s.correct, wrong: s.wrong, skipped: s.skipped, time: s.time, sIdx: idx });
                        }
                    });
                }
            });
            // Dashboard calculations need correct chronological order
            setMyHistory(historyTemp);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setFetchingResults(false);
      }
    };

    fetchDashboardData();
  }, [currentUser]);

  if (authLoading || fetchingResults) {
    return (
      <div className="spinner-container" style={{ paddingTop: '10vh' }}>
        <div className="spinner"></div>
        <div style={{ fontWeight: 500, color: 'var(--color-text-secondary)' }}>Loading Analytics...</div>
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

  // 🔥 THE ULTRA GOOD IDEA: Rank & Trend Logic
  let rankTitle = "Starter"; let rankColor = "#64748b"; let rankIcon = "ti-star";
  if (totalTests > 0) {
      if (overallPercentage >= 85) { rankTitle = "Elite Scholar"; rankColor = "#d4af37"; rankIcon = "ti-award"; }
      else if (overallPercentage >= 70) { rankTitle = "Consistent Performer"; rankColor = "#185FA5"; rankIcon = "ti-trending-up"; }
      else if (overallPercentage >= 50) { rankTitle = "Developing Learner"; rankColor = "#3B6D11"; rankIcon = "ti-barbell"; }
      else { rankTitle = "Needs Focus"; rankColor = "#A32D2D"; rankIcon = "ti-alert-circle"; }
  }

  // Get last 10 tests for the trend graph
  const recentTrend = myHistory.slice(-10);

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
        <div>
            <div className="page-title">My Analytics Dashboard</div>
            <div className="page-sub">Track your performance, overall accuracy, and past exam history.</div>
        </div>
        {totalTests > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${rankColor}15`, border: `1px solid ${rankColor}40`, padding: '8px 16px', borderRadius: '30px', color: rankColor, fontWeight: 700 }}>
                <i className={`ti ${rankIcon}`} style={{ fontSize: '18px' }}></i> {rankTitle}
            </div>
        )}
      </div>

      {totalTests === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)', background: 'var(--color-background-primary)', borderRadius: '12px', border: '1px dashed var(--color-border-primary)' }}>
             <i className="ti ti-chart-line" style={{ fontSize: '48px', display: 'block', marginBottom: '1rem', opacity: 0.5 }}></i>
             <div style={{ fontSize: '16px', fontWeight: 500 }}>No tests attempted yet. Join a test to see your analytics!</div>
          </div>
      ) : (
          <>
            <div className="grid4" style={{ marginBottom: '1.5rem' }}>
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

            {/* 🔥 NEW FEATURE: Performance Trend Chart */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '12px', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                    <i className="ti ti-activity" style={{ color: '#185FA5' }}></i> Recent Performance Trend (Last 10 Tests)
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {recentTrend.map((h, i) => {
                        let pct = Math.round((h.score / h.totalMarks) * 100);
                        let barColor = pct >= 75 ? '#3B6D11' : pct >= 40 ? '#854F0B' : '#A32D2D';
                        let barBg = pct >= 75 ? '#EAF3DE' : pct >= 40 ? '#FAEEDA' : '#FCEBEB';
                        return (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: '40px', flex: 1 }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: barColor }}>{pct}%</div>
                                <div style={{ width: '100%', maxWidth: '30px', height: `${Math.max(pct, 5)}%`, background: barBg, border: `1px solid ${barColor}`, borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }}></div>
                            </div>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px', fontWeight: 600, textTransform: 'uppercase' }}>
                    <span>Older</span><span>Newer</span>
                </div>
            </div>

            <h3 style={{ marginBottom: '1rem', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-history" style={{ color: '#185FA5' }}></i> Past Exam Ledger
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myHistory.slice().reverse().map((h, index) => {
                    let pct = Math.round((h.score / h.totalMarks) * 100);
                    return (
                        <div key={index} className="test-entry" style={{ alignItems: 'center', padding: '1rem 1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                            <div className="te-meta">
                                <div style={{ fontWeight: 600, fontSize: '16px', color: '#0f172a' }}>
                                    {h.testTitle} <span className="badge b-gray" style={{ fontSize: '11px', marginLeft: '8px' }}>Code: {h.testCode}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Attempted on: {h.time}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{ textAlign: 'right' }} className="hide-mobile">
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