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

  const [animateGraph, setAnimateGraph] = useState(false); // 🔥 Animation Trigger State

  // Jaise hi data load hoga, ye 100ms baad animation shuru kar dega
  useEffect(() => {
      if (!fetchingResults && myHistory.length > 0) {
          setTimeout(() => setAnimateGraph(true), 150);
      }
  }, [fetchingResults, myHistory]);

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

  // 🔥 THE FIX: Premium Student Dashboard Skeleton Loader
  if (authLoading || fetchingResults) {
    return (
      <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* 1. Header Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', marginBottom: '2rem' }}>
          <div>
            <div className="skeleton" style={{ width: '280px', height: '34px', marginBottom: '8px', borderRadius: '8px' }}></div>
            <div className="skeleton" style={{ width: '350px', height: '18px', borderRadius: '6px', maxWidth: '100%' }}></div>
          </div>
          <div className="skeleton hide-mobile" style={{ width: '160px', height: '38px', borderRadius: '30px' }}></div>
        </div>

        {/* 2. Top Stats Grid Skeleton (4 Cards) */}
        <div className="grid4" style={{ marginBottom: '1.5rem' }}>
            {[1, 2, 3, 4].map(n => (
                <div key={n} className="stat-card" style={{ padding: '1.5rem 1.25rem', borderColor: 'transparent' }}>
                    <div className="skeleton" style={{ width: '45px', height: '32px', margin: '0 auto 10px', borderRadius: '6px' }}></div>
                    <div className="skeleton" style={{ width: '110px', height: '14px', margin: '0 auto', borderRadius: '4px' }}></div>
                </div>
            ))}
        </div>

        {/* 3. The Graph Card Skeleton */}
        <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '16px', height: '290px', display: 'flex', flexDirection: 'column', borderColor: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
                <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '8px' }}></div>
                <div className="skeleton" style={{ width: '210px', height: '22px', borderRadius: '6px' }}></div>
            </div>
            {/* Fake Graph Bars with Staggered Heights */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flex: 1, borderBottom: '2px solid var(--color-border-secondary)' }}>
                {[30, 60, 40, 80, 50, 90, 45, 75, 60, 95].map((h, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div className="skeleton" style={{ width: '24px', height: '12px', marginBottom: '8px', borderRadius: '4px' }}></div>
                        <div className="skeleton" style={{ width: '100%', maxWidth: '36px', height: `${h}%`, borderRadius: '6px 6px 0 0' }}></div>
                    </div>
                ))}
            </div>
            {/* X-Axis Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div className="skeleton" style={{ width: '80px', height: '14px', borderRadius: '4px' }}></div>
                <div className="skeleton" style={{ width: '80px', height: '14px', borderRadius: '4px' }}></div>
            </div>
        </div>

        {/* 4. Past Ledger Title & List Skeleton */}
        <div className="skeleton" style={{ width: '180px', height: '24px', marginBottom: '1rem', borderRadius: '6px' }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map(n => (
                <div key={n} className="test-entry" style={{ padding: '1.25rem 1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'transparent' }}>
                    <div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div className="skeleton" style={{ width: '160px', height: '22px', borderRadius: '6px' }}></div>
                            <div className="skeleton" style={{ width: '60px', height: '22px', borderRadius: '12px' }}></div>
                        </div>
                        <div className="skeleton" style={{ width: '130px', height: '14px', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div className="hide-mobile" style={{ textAlign: 'right' }}>
                            <div className="skeleton" style={{ width: '70px', height: '22px', marginBottom: '6px', borderRadius: '4px', marginLeft: 'auto' }}></div>
                            <div className="skeleton" style={{ width: '90px', height: '14px', borderRadius: '4px' }}></div>
                        </div>
                        <div className="skeleton" style={{ width: '46px', height: '46px', borderRadius: '50%' }}></div>
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

            {/* 🔥 UPGRADED PREMIUM FEATURE: Animated Performance Trend Chart */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '16px', background: 'var(--color-background-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--color-border-secondary)' }}>
                <h3 style={{ marginTop: 0, marginBottom: '2rem', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-primary)' }}>
                    <div style={{ background: '#E6F1FB', padding: '6px', borderRadius: '8px', display: 'flex', color: '#185FA5' }}>
                        <i className="ti ti-chart-bar" style={{ fontSize: '18px' }}></i>
                    </div>
                    Recent Performance Trend
                </h3>
                
                {/* Graph Container with Hide-Scroll for Mobile */}
                <div className="hide-scroll" style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
                    {/* The Chart Area */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '160px', minWidth: '400px', borderBottom: '2px solid var(--color-border-secondary)', padding: '0 10px' }}>
                       {recentTrend.map((h, i) => {
                            // 🔥 FIX: Prevent NaN if totalMarks is 0 or undefined
                            let validScore = h.score || 0;
                            let validTotal = h.totalMarks || 0;
                            let pct = validTotal > 0 ? Math.round((validScore / validTotal) * 100) : 0;

                            let isExcellent = pct >= 75;
                            let isAverage = pct >= 40 && pct < 75;
                            
                            let barColor = isExcellent ? '#3B6D11' : isAverage ? '#854F0B' : '#A32D2D';
                            let barBg = isExcellent ? '#EAF3DE' : isAverage ? '#FAEEDA' : '#FCEBEB';
                            let barHoverBg = isExcellent ? '#dcefc8' : isAverage ? '#f8e4c2' : '#fad4d4';

                            return (
                                // 🔥 BUG FIX: height: '100%' and justifyContent: 'flex-end' makes it a real column
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flex: 1, height: '100%', position: 'relative', group: 'true' }}>
                                    
                                    {/* Percentage Label (Fades in) */}
                                    <div style={{ 
                                        fontSize: '12px', fontWeight: 800, color: barColor, marginBottom: '8px',
                                        opacity: animateGraph ? 1 : 0, transform: animateGraph ? 'translateY(0)' : 'translateY(10px)',
                                        transition: `all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.05}s` 
                                    }}>
                                        {pct}%
                                    </div>
                                    
                                    {/* 🔥 THE ANIMATED BAR */}
                                    <div 
                                        style={{ 
                                            width: '100%', maxWidth: '36px', 
                                            height: animateGraph ? `${Math.max(pct, 5)}%` : '0%', // Starts from 0%
                                            background: barBg, 
                                            border: `1px solid ${barColor}`, borderBottom: 'none',
                                            borderRadius: '6px 6px 0 0', 
                                            transition: `height 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.05}s`, // Sleek stagger animation
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = barHoverBg; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.transition = 'all 0.2s'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = barBg; e.currentTarget.style.transform = 'translateY(0)'; }}
                                        title={`Score: ${h.score}/${h.totalMarks} (${h.testTitle})`} // Quick Tooltip on hover
                                    ></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Axis Labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0 5px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-arrow-left"></i> Older Tests</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>Newer Tests <i className="ti ti-arrow-right"></i></span>
                </div>
            </div>

            <h3 style={{ marginBottom: '1rem', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-history" style={{ color: '#185FA5' }}></i> Past Exam Ledger
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myHistory.slice().reverse().map((h, index) => {
                    // 🔥 FIX: Safe math for Ledger percentages
                    let validScore = h.score || 0;
                    let validTotal = h.totalMarks || 0;
                    let pct = validTotal > 0 ? Math.round((validScore / validTotal) * 100) : 0;
                    
                    // 🔥 FIX: Safe math for Accuracy (handles missing data properly)
                    let corr = h.correct || 0;
                    let wrng = h.wrong || 0;
                    let accPct = (corr + wrng) > 0 ? Math.round((corr / (corr + wrng)) * 100) : 0;

                    return (
                        <div key={index} className="test-entry" style={{ alignItems: 'center', padding: '1rem 1.5rem', background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '12px' }}>
                            <div className="te-meta">
                                <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--color-text-primary)' }}>
                                    {h.testTitle || 'Unnamed Test'} <span className="badge b-gray" style={{ fontSize: '11px', marginLeft: '8px' }}>Code: {h.testCode || 'N/A'}</span>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Attempted on: {h.time || 'Unknown Time'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div style={{ textAlign: 'right' }} className="hide-mobile">
                                    <div style={{ fontWeight: 600, color: '#185FA5', fontSize: '16px' }}>
                                        {validScore} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>/ {validTotal}</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                                        Accuracy: {accPct}%
                                    </div>
                                </div>
                                <div style={{ width: '46px', height: '46px', flexShrink: 0, borderRadius: '50%', background: pct >= 75 ? '#EAF3DE' : pct >= 40 ? '#FAEEDA' : '#FCEBEB', color: pct >= 75 ? '#27500A' : pct >= 40 ? '#633806' : '#791F1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', border: `2px solid ${pct >= 75 ? '#C0DD97' : pct >= 40 ? '#FAC775' : '#F7C1C1'}` }}>
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