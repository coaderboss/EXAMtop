// src/app/results/page.js
'use client';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useRouter } from 'next/navigation';

export default function GlobalResults() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const { tests, loadingData } = useData();
  const router = useRouter();

  const [searchCode, setSearchCode] = useState('');
  const [searchedTest, setSearchedTest] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (authLoading || loadingData) {
    return <div className="spinner-container" style={{ paddingTop: '10vh' }}><div className="spinner"></div><div>Loading Global Database...</div></div>;
  }

  if (!currentUser || (userRole !== 'examiner' && userRole !== 'admin')) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <i className="ti ti-lock" style={{ fontSize: '48px', color: '#A32D2D', marginBottom: '1rem' }}></i>
        <h3>Access Denied</h3>
        <p>Only authorized personnel can access Global Results.</p>
        <button className="btn btn-primary" onClick={() => router.push('/')}>Go Home</button>
      </div>
    );
  }

  const handleSearch = () => {
    setErrorMsg('');
    setSearchedTest(null);

    if (!searchCode.trim()) {
      setErrorMsg('Please enter a 6-digit test code.');
      return;
    }

    const t = tests.find(x => x.code === searchCode.trim().toUpperCase());
    
    if (!t) {
      setErrorMsg('No test found with this code.');
      return;
    }

    if (!t.submissions || t.submissions.length === 0) {
      setErrorMsg('Test found, but no students have submitted yet.');
      setSearchedTest(t);
      return;
    }

    setSearchedTest(t);
  };

  // 🔥 FIX 1: Handle Enter Key Press for Search
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const exportLeaderboard = () => {
    if (!searchedTest || !searchedTest.submissions) return;
    
    let csv = 'Rank,Student Name,Roll Number,Total Score,Accuracy (%),Submission Time\n';
    
    const sortedSubs = [...searchedTest.submissions].sort((a, b) => (b.score || 0) - (a.score || 0));
    
    sortedSubs.forEach((s, idx) => {
      const corr = s.correct || 0;
      const wrng = s.wrong || 0;
      const accuracy = corr + wrng > 0 ? Math.round((corr / (corr + wrng)) * 100) : 0;
      
      // 🔥 FIX 2: Prevent CSV breaking if name contains quotes/commas
      const safeName = (s.name || 'Unknown').replace(/"/g, '""');
      const safeRoll = (s.roll || 'N/A').replace(/"/g, '""');
      
      csv += `${idx + 1},"${safeName}","${safeRoll}",${s.score || 0},${accuracy},"${s.time || 'N/A'}"\n`;
    });

    // 🔥 FIX 3: Safe Filename Generation (Removes special chars)
    const safeTitle = searchedTest.title.replace(/[^a-zA-Z0-9]/g, "_");
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle}_Global_Leaderboard.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
        <div className="page-header">
            <div className="page-title">Global Results & Leaderboard</div>
            <div className="page-sub">Search across the entire platform using a Test Code to view rankings.</div>
        </div>

        <div className="card" style={{ maxWidth: '600px', margin: '0 auto 2rem', textAlign: 'center', padding: '2rem' }}>
            <i className="ti ti-world-search" style={{ fontSize: '42px', color: '#185FA5', marginBottom: '1rem', display: 'block' }}></i>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>Enter Test Code</h3>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <input 
                    type="text" 
                    placeholder="e.g. A1B2C3" 
                    value={searchCode} 
                    onChange={e => setSearchCode(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDown} // 🔥 Added Enter Key Support
                    maxLength="6"
                    style={{ fontSize: '20px', letterSpacing: '4px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', width: '200px', background: 'var(--color-background-secondary)', color: 'var(--color-text-primary)' }} 
                />
                <button className="btn btn-primary" onClick={handleSearch} style={{ padding: '0 24px', fontWeight: 600 }}>
                    <i className="ti ti-search"></i> Search
                </button>
            </div>
            
            {errorMsg && <div style={{ color: '#A32D2D', marginTop: '1rem', fontWeight: 500, fontSize: '14px' }}>{errorMsg}</div>}
        </div>

        {searchedTest && (
            <div className="card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--color-border-secondary)', paddingBottom: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>{searchedTest.title}</h2>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: 500 }}>
                            Max Marks: {searchedTest.totalMarks || 0} &bull; Total Submissions: {searchedTest.submissions?.length || 0}
                        </div>
                    </div>
                    <button className="btn btn-success" onClick={exportLeaderboard} disabled={!searchedTest.submissions?.length}>
                        <i className="ti ti-download"></i> Download Leaderboard
                    </button>
                </div>

                {!searchedTest.submissions || searchedTest.submissions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>No data available to generate a leaderboard.</div>
                ) : (
                    // 🔥 FIX 4: Added hide-scroll for clean mobile view
                    <div className="hide-scroll" style={{ overflowX: 'auto', width: '100%' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', textAlign: 'left', borderBottom: '2px solid var(--color-border-secondary)' }}>
                                    <th style={{ padding: '12px 16px', fontWeight: 600, width: '80px' }}>Rank</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Student Info</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Accuracy</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...searchedTest.submissions].sort((a, b) => (b.score || 0) - (a.score || 0)).map((s, idx) => {
                                    const corr = s.correct || 0;
                                    const wrng = s.wrong || 0;
                                    const accuracy = corr + wrng > 0 ? Math.round((corr / (corr + wrng)) * 100) : 0;
                                    const isTop3 = idx < 3;
                                    
                                    // 🔥 FIX 5: Dark Mode Compatible Colors using rgba
                                    const rowBg = isTop3 
                                        ? (idx === 0 ? 'rgba(217, 119, 6, 0.08)' : idx === 1 ? 'rgba(100, 116, 139, 0.08)' : 'rgba(180, 83, 9, 0.08)') 
                                        : 'var(--color-background-primary)';
                                        
                                    const rankColor = isTop3 
                                        ? (idx === 0 ? '#d97706' : idx === 1 ? '#64748b' : '#b45309') 
                                        : 'var(--color-text-secondary)';

                                    return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-secondary)', background: rowBg }}>
                                            <td style={{ padding: '16px', fontWeight: 800, fontSize: '18px', color: rankColor }}>
                                                #{idx + 1}
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '15px' }}>{s.name || 'Unknown'}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', marginTop: '4px' }}>Roll: {s.roll || 'N/A'}</div>
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                                <div style={{ width: '100%', maxWidth: '100px', margin: '0 auto', background: 'var(--color-border-secondary)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${accuracy}%`, height: '100%', background: accuracy >= 70 ? '#10B981' : accuracy >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }}></div>
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '6px', fontWeight: 600 }}>{accuracy}%</div>
                                            </td>
                                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: '#185FA5' }}>
                                                {s.score || 0}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}