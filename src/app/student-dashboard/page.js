// src/app/student-dashboard/page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, get } from 'firebase/database';

export default function StudentDashboard() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [myHistory, setMyHistory] = useState([]);
  const [fetchingResults, setFetchingResults] = useState(true);
  const [animateGraph, setAnimateGraph] = useState(false);
  
  // 🔥 NEW: Analysis Dropdown State
  const [analysisMode, setAnalysisMode] = useState('insights'); 
  const [trendPage, setTrendPage] = useState(0);

  useEffect(() => {
      if (!fetchingResults && myHistory.length > 0) {
          setTimeout(() => setAnimateGraph(true), 150);
      }
  }, [fetchingResults, myHistory]);

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
                            historyTemp.push({ 
                                testId: t.id, testTitle: t.title, testCode: t.code, subject: t.subject || 'General', 
                                score: s.score, totalMarks: s.totalMarks, correct: s.correct, wrong: s.wrong, skipped: s.skipped, time: s.time, sIdx: idx 
                            });
                        }
                    });
                }
            });
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full animate-pulse">
        <div className="w-full h-[140px] sm:h-[120px] bg-slate-200 rounded-3xl mb-5 sm:mb-8"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-5 sm:mb-8">
            {[1, 2, 3, 4].map(n => <div key={n} className="h-[90px] sm:h-[100px] bg-slate-200 rounded-2xl"></div>)}
        </div>
        <div className="w-full h-[300px] bg-slate-200 rounded-3xl mb-6 sm:mb-8"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <i className="ti ti-lock text-4xl sm:text-5xl"></i>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">Access Restricted</h2>
        <p className="text-sm sm:text-base text-slate-500 font-medium mb-8">Please Login to view your personalized analytics and history.</p>
        <button className="px-6 sm:px-8 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95" onClick={() => router.push('/')}>
          Go to Home
        </button>
      </div>
    );
  }

  // --- 🧠 ADVANCED DATA ENGINE ---
  let totalTests = myHistory.length; 
  let totalCorrect = 0, totalWrong = 0, totalEarned = 0, totalMax = 0;
  let highestScorePct = 0;
  let weaknessData = {}; // For graphical weakness analysis
  
  myHistory.forEach(h => { 
      totalCorrect += h.correct; 
      totalWrong += h.wrong; 
      totalEarned += h.score; 
      totalMax += h.totalMarks; 
      
      let currentPct = h.totalMarks > 0 ? (h.score / h.totalMarks) * 100 : 0;
      if (currentPct > highestScorePct) highestScorePct = currentPct;

      // Calculate subject weaknesses
      if (!weaknessData[h.subject]) weaknessData[h.subject] = { mistakes: 0, attempts: 0 };
      weaknessData[h.subject].mistakes += h.wrong;
      weaknessData[h.subject].attempts += (h.correct + h.wrong + h.skipped);
  });

  let overallAccuracy = (totalCorrect + totalWrong) > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0;
  let overallPercentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

  // Rank & XP Math
  let rankTitle = "Starter"; let rankColor = "text-slate-600"; let rankBg = "bg-slate-100"; let rankIcon = "ti-star";
  if (totalTests > 0) {
      if (overallPercentage >= 85) { rankTitle = "Elite Scholar"; rankColor = "text-amber-700"; rankBg = "bg-amber-100"; rankIcon = "ti-crown"; }
      else if (overallPercentage >= 70) { rankTitle = "Consistent Pro"; rankColor = "text-indigo-700"; rankBg = "bg-indigo-100"; rankIcon = "ti-trending-up"; }
      else if (overallPercentage >= 50) { rankTitle = "Developing Learner"; rankColor = "text-emerald-700"; rankBg = "bg-emerald-100"; rankIcon = "ti-barbell"; }
      else { rankTitle = "Needs Focus"; rankColor = "text-rose-700"; rankBg = "bg-rose-100"; rankIcon = "ti-alert-circle"; }
  }

  const testsPerLevel = 5;
  const currentLevel = Math.floor(totalTests / testsPerLevel) + 1;
  const testsInCurrentLevel = totalTests % testsPerLevel;
  const progressPct = (testsInCurrentLevel / testsPerLevel) * 100;
  const testsToNextLevel = testsPerLevel - testsInCurrentLevel;
  
  // 🔥 SMART GRAPH PAGINATION LOGIC 🔥
  const ITEMS_PER_PAGE = 10;
  const totalTrendPages = Math.ceil(totalTests / ITEMS_PER_PAGE);
  // Hum array ko reverse karte hain taaki newest pehle aa jayein, fir page ke hisaab se 10 ka slice lete hain, aur graph me left-to-right dikhane ke liye wapas reverse kar dete hain.
  const reversedHistory = [...myHistory].reverse();
  const startIndex = trendPage * ITEMS_PER_PAGE;
  const recentTrend = reversedHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE).reverse();

  const hasOlder = (startIndex + ITEMS_PER_PAGE) < totalTests;
  const hasNewer = trendPage > 0;

  // Smart Insights Generation
  let smartInsights = [];
  if (totalTests > 0) {
      if (overallAccuracy >= 80) smartInsights.push({ icon: 'ti-target', title: "Sniper Accuracy!", desc: "Your hit rate is top-notch. Keep avoiding blind guesses.", color: "emerald" });
      else if (overallAccuracy < 50) smartInsights.push({ icon: 'ti-minus', title: "Watch the Negatives", desc: "Losing marks to wrong answers. Skip if completely unsure.", color: "rose" });
      
      if (totalTests >= 3 && overallPercentage > 75) smartInsights.push({ icon: 'ti-flame', title: "On Fire! 🔥", desc: "Consistently scoring high. You are ready for tougher exams.", color: "amber" });
      else if (totalTests >= 2) smartInsights.push({ icon: 'ti-trending-up', title: "Keep Grinding", desc: "Review past mistakes in the ledger below to improve.", color: "indigo" });
  }

  // ==========================================
  // UI COMPONENTS (Variables for bulletproof layout)
  // ==========================================

  const heroCard = (
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between gap-6 sm:gap-8 border border-slate-800">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none translate-y-1/2 -translate-x-1/4"></div>
          
          <div className="relative z-10 flex items-center gap-4 sm:gap-6">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-300 border-2 border-slate-400/20 flex flex-col items-center justify-center text-slate-800 shadow-xl shrink-0">
                  <i className="ti ti-user-scan text-2xl sm:text-4xl"></i>
              </div>
              <div className="flex-1">
                  <h1 className="text-xl sm:text-3xl font-black text-white mb-1.5 sm:mb-2 tracking-tight leading-tight">Welcome, {currentUser.displayName?.split(' ')[0] || 'Student'}!</h1>
                  <div className="flex flex-col gap-1.5 w-full max-w-[200px] sm:max-w-xs mt-2">
                      <div className="flex justify-between items-center">
                          <span className="text-[9px] sm:text-[11px] font-extrabold text-blue-400 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">Level {currentLevel}</span>
                          <span className="text-[9px] sm:text-[11px] font-bold text-slate-400">{testsToNextLevel} test(s) to Lvl {currentLevel + 1}</span>
                      </div>
                      <div className="h-1.5 sm:h-2 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-700">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full relative" style={{ width: `${progressPct}%`, transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {totalTests > 0 && (
              <div className="relative z-10 flex items-center gap-3 sm:gap-4 shrink-0 bg-white/5 backdrop-blur-md border border-white/10 p-3 sm:p-4 sm:pr-6 rounded-2xl md:self-end">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-3xl ${rankBg} ${rankColor} shadow-inner`}>
                      <i className={`ti ${rankIcon}`}></i>
                  </div>
                  <div>
                      <div className="text-[9px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-widest leading-none mb-1 sm:mb-1.5">Current Rank</div>
                      <div className={`text-[14px] sm:text-[18px] font-black ${rankColor.replace('text-', 'text-').replace('-700', '-400')} leading-none tracking-tight`}>{rankTitle}</div>
                  </div>
              </div>
          )}
      </div>
  );

  const bentoStatsCard = (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col items-center text-center group hover:border-blue-200 transition-colors">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl sm:text-2xl mb-2 sm:mb-3 border border-blue-100 group-hover:scale-110 transition-transform"><i className="ti ti-file-certificate"></i></div>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mb-1 leading-none">{totalTests}</div>
              <div className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-widest leading-tight">Exams Taken</div>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col items-center text-center group hover:border-emerald-200 transition-colors">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl sm:text-2xl mb-2 sm:mb-3 border border-emerald-100 group-hover:scale-110 transition-transform"><i className="ti ti-target"></i></div>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mb-1 leading-none">{overallAccuracy}%</div>
              <div className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-widest leading-tight">Hit Accuracy</div>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col items-center text-center group hover:border-amber-200 transition-colors">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl sm:text-2xl mb-2 sm:mb-3 border border-amber-100 group-hover:scale-110 transition-transform"><i className="ti ti-bolt"></i></div>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mb-1 leading-none">{totalEarned}</div>
              <div className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-widest leading-tight">Total XP (Marks)</div>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col items-center text-center group hover:border-rose-200 transition-colors">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl sm:text-2xl mb-2 sm:mb-3 border border-rose-100 group-hover:scale-110 transition-transform"><i className="ti ti-circle-x"></i></div>
              <div className="text-xl sm:text-2xl font-black text-slate-800 mb-1 leading-none">{totalWrong}</div>
              <div className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 uppercase tracking-widest leading-tight">Mistakes Made</div>
          </div>
      </div>
  );

  const trendChartCard = (
      <div className="bg-white p-4 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] h-full flex flex-col">
          <div className="flex items-center justify-between mb-6 sm:mb-8 shrink-0">
              <h3 className="text-[14px] sm:text-[18px] font-black text-slate-800 flex items-center gap-2 sm:gap-2.5 m-0 tracking-tight">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100"><i className="ti ti-chart-bar text-lg sm:text-xl"></i></div>
                  Performance Trend
              </h3>
          </div>
          
          <div className="w-full overflow-x-auto custom-scrollbar pb-2 flex-1 flex flex-col justify-end">
              <div className="flex items-end gap-2 sm:gap-4 h-[160px] sm:h-[200px] min-w-[380px] sm:min-w-[500px] border-b-2 border-slate-100 px-1 sm:px-2 relative">
                 <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                     <div className="border-t border-dashed border-slate-300 w-full h-0 relative"><span className="absolute -top-2.5 -left-1 text-[8px] sm:text-[9px] font-bold text-slate-400">100%</span></div>
                     <div className="border-t border-dashed border-slate-300 w-full h-0 relative"><span className="absolute -top-2.5 -left-1 text-[8px] sm:text-[9px] font-bold text-slate-400">50%</span></div>
                     <div className="border-t border-dashed border-slate-300 w-full h-0 relative"></div>
                 </div>

                 {recentTrend.map((h, i) => {
                      let validScore = h.score || 0;
                      let validTotal = h.totalMarks || 0;
                      let pct = validTotal > 0 ? Math.round((validScore / validTotal) * 100) : 0;
                      let isExcellent = pct >= 75; let isAverage = pct >= 40 && pct < 75;
                      let barColor = isExcellent ? 'border-emerald-500' : isAverage ? 'border-amber-400' : 'border-rose-400';
                      let barBg = isExcellent ? 'bg-gradient-to-t from-emerald-100 to-emerald-400' : isAverage ? 'bg-gradient-to-t from-amber-100 to-amber-400' : 'bg-gradient-to-t from-rose-100 to-rose-400';
                      let textColor = isExcellent ? 'text-emerald-700' : isAverage ? 'text-amber-700' : 'text-rose-700';

                      return (
                          <div key={i} className="flex flex-col items-center justify-end flex-1 h-full relative group z-10">
                              <div className={`text-[10px] sm:text-[12px] font-black ${textColor} mb-1 sm:mb-2 transition-all duration-700 delay-[${i * 50}ms] ${animateGraph ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                                  {pct}%
                              </div>
                              <div className={`w-full max-w-[30px] sm:max-w-[44px] rounded-t-lg sm:rounded-t-xl border-t border-x ${barColor} ${barBg} cursor-pointer relative overflow-hidden group-hover:-translate-y-1 transition-transform shadow-sm`}
                                   style={{ height: animateGraph ? `${Math.max(pct, 5)}%` : '0%', transition: `height 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.05}s` }}>
                                  <div className="absolute inset-0 w-full h-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              </div>
                              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] sm:text-[11px] font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg pointer-events-none whitespace-nowrap shadow-xl z-20">
                                  {h.testTitle} <span className="text-slate-400 font-medium">({validScore}/{validTotal})</span>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
          
          {/* 🔥 PAGINATION CONTROLS 🔥 */}
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest mt-3 sm:mt-4 px-2 shrink-0 select-none">
              <button 
                  onClick={() => { if (hasOlder) { setTrendPage(p => p + 1); setAnimateGraph(false); setTimeout(() => setAnimateGraph(true), 50); } }}
                  disabled={!hasOlder}
                  className={`flex items-center gap-1.5 transition-colors px-2 py-1.5 rounded-lg ${hasOlder ? 'text-blue-600 hover:bg-blue-50 cursor-pointer active:scale-95' : 'text-slate-300 cursor-not-allowed'}`}>
                  <i className="ti ti-arrow-left text-sm"></i> Older Exams
              </button>
              
              {totalTests > ITEMS_PER_PAGE && (
                  <span className="text-[9px] text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full shadow-inner border border-slate-200/50">
                      Page {trendPage + 1} / {totalTrendPages}
                  </span>
              )}

              <button 
                  onClick={() => { if (hasNewer) { setTrendPage(p => p - 1); setAnimateGraph(false); setTimeout(() => setAnimateGraph(true), 50); } }}
                  disabled={!hasNewer}
                  className={`flex items-center gap-1.5 transition-colors px-2 py-1.5 rounded-lg ${hasNewer ? 'text-blue-600 hover:bg-blue-50 cursor-pointer active:scale-95' : 'text-slate-300 cursor-not-allowed'}`}>
                  Newer Exams <i className="ti ti-arrow-right text-sm"></i>
              </button>
          </div>
      </div>
  );

  const advancedAnalyticsCard = (
      <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-inner h-full flex flex-col">
          <div className="flex items-center justify-between mb-4 sm:mb-5 shrink-0">
              <h3 className="text-[13px] sm:text-[14px] font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2 m-0">
                  <i className="ti ti-brain text-amber-500 text-lg sm:text-xl"></i> AI Analysis
              </h3>
              <select 
                  value={analysisMode} 
                  onChange={e => setAnalysisMode(e.target.value)} 
                  className="text-[10px] sm:text-[11px] font-bold bg-white border border-slate-200 text-slate-600 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 outline-none cursor-pointer focus:border-amber-400 shadow-sm"
              >
                  <option value="insights">Smart Insights</option>
                  <option value="weakness">Weakness Zone</option>
              </select>
          </div>
          
          <div className="flex-1 flex flex-col gap-3 sm:gap-4 overflow-y-auto custom-scrollbar pr-1">
              {analysisMode === 'insights' && smartInsights.map((insight, idx) => (
                  <div key={idx} className={`bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border flex items-start gap-3 shadow-sm border-${insight.color}-200`}>
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-${insight.color}-50 text-${insight.color}-600 flex items-center justify-center text-lg sm:text-xl shrink-0`}>
                          <i className={`ti ${insight.icon}`}></i>
                      </div>
                      <div>
                          <h4 className={`text-[13px] sm:text-[14px] font-black text-${insight.color}-800 mb-0.5 sm:mb-1 leading-tight`}>{insight.title}</h4>
                          <p className="text-[11px] sm:text-[12px] font-medium text-slate-600 leading-snug">{insight.desc}</p>
                      </div>
                  </div>
              ))}

              {analysisMode === 'weakness' && (
                  <div className="flex flex-col gap-3">
                      {Object.keys(weaknessData).length === 0 ? (
                          <div className="text-[12px] font-semibold text-slate-500 text-center py-4">No weakness data available yet.</div>
                      ) : (
                          Object.keys(weaknessData).map((sub, idx) => {
                              const d = weaknessData[sub];
                              const mistakePct = d.attempts > 0 ? Math.round((d.mistakes / d.attempts) * 100) : 0;
                              let barColor = mistakePct > 40 ? 'bg-rose-500' : mistakePct > 20 ? 'bg-amber-400' : 'bg-emerald-400';
                              
                              return (
                                  <div key={idx} className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm">
                                      <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                                          <div className="text-[12px] sm:text-[13px] font-bold text-slate-700 truncate pr-2"><i className="ti ti-book text-slate-400 mr-1"></i> {sub}</div>
                                          <div className="text-[10px] sm:text-[11px] font-extrabold text-slate-500">{mistakePct}% Errors</div>
                                      </div>
                                      <div className="w-full h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                                          <div className={`h-full ${barColor} rounded-full transition-all duration-1000`} style={{ width: `${mistakePct}%` }}></div>
                                      </div>
                                  </div>
                              );
                          })
                      )}
                  </div>
              )}
          </div>
      </div>
  );

  const pastLedgerCard = (
      <div>
          <h3 className="text-[13px] sm:text-[14px] font-extrabold text-slate-500 uppercase tracking-widest mb-3 sm:mb-4 flex items-center gap-2">
              <i className="ti ti-folders text-blue-500 text-lg"></i> Complete Exam History
          </h3>
          <div className="flex flex-col gap-3 sm:gap-4">
              {myHistory.slice().reverse().map((h, index) => {
                  let validScore = h.score || 0; let validTotal = h.totalMarks || 0;
                  let pct = validTotal > 0 ? Math.round((validScore / validTotal) * 100) : 0;
                  let corr = h.correct || 0; let wrng = h.wrong || 0;
                  let accPct = (corr + wrng) > 0 ? Math.round((corr / (corr + wrng)) * 100) : 0;

                  const isExcellent = pct >= 75; const isAverage = pct >= 40 && pct < 75;
                  const ringColor = isExcellent ? 'border-emerald-400' : isAverage ? 'border-amber-400' : 'border-rose-400';
                  const ringBg = isExcellent ? 'bg-emerald-50 text-emerald-700' : isAverage ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';

                  let performanceTag = null;
                  if (pct === highestScorePct && highestScorePct > 0) performanceTag = <span className="bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1 shrink-0"><i className="ti ti-trophy"></i> Best</span>;
                  else if (pct < 33) performanceTag = <span className="bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1 shrink-0"><i className="ti ti-alert-triangle"></i> Weak</span>;
                  
                  return (
                      <div key={index} className="bg-white p-3.5 sm:p-5 border border-slate-200 rounded-2xl sm:rounded-3xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:border-blue-300 hover:shadow-md transition-all duration-300 flex flex-row items-center justify-between gap-3 sm:gap-4 group">
                          
                          <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h4 className="text-[14px] sm:text-[16px] font-black text-slate-800 m-0 truncate group-hover:text-blue-700 transition-colors leading-none">{h.testTitle || 'Unnamed Test'}</h4>
                                  {performanceTag}
                              </div>
                              <div className="text-[11px] sm:text-[12px] font-semibold text-slate-500 flex items-center gap-2 sm:gap-3 flex-wrap leading-tight mt-0.5">
                                  <span className="flex items-center gap-1.5"><i className="ti ti-calendar text-slate-400"></i> {h.time?.split(',')[0] || 'Unknown'}</span>
                                  <span className="flex items-center gap-1 font-mono text-[9px] sm:text-[10px] bg-slate-50 px-1.5 sm:px-2 py-0.5 rounded border border-slate-200"><i className="ti ti-hash opacity-60"></i> {h.testCode || 'N/A'}</span>
                              </div>
                          </div>
                          
                          <div className="flex items-center gap-3 sm:gap-6 shrink-0 border-l border-slate-100 pl-3 sm:pl-4">
                              <div className="text-right hidden sm:block">
                                  <div className="text-[18px] sm:text-[20px] font-black text-slate-800 leading-none mb-1">
                                      {validScore} <span className="text-[12px] sm:text-[13px] font-bold text-slate-400">/ {validTotal}</span>
                                  </div>
                                  <div className="text-[10px] sm:text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
                                      Acc: <span className="text-slate-600">{accPct}%</span>
                                  </div>
                              </div>
                              
                              <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-[12px] sm:text-[15px] border-2 sm:border-[3px] shadow-sm shrink-0 ${ringColor} ${ringBg} transform group-hover:scale-105 transition-transform`}>
                                  {pct}%
                              </div>
                          </div>
                      </div>
                  );
              })}
          </div>
      </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full animate-[fadeIn_0.4s_ease]">
      
      {/* 🔥 BULLETPROOF CSS LAYOUT (Bypasses Tailwind Compile Issues) 🔥 */}
      <style>{`
          .dash-mobile-layout { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem; width: 100%; }
          .dash-desktop-layout { display: none; flex-direction: column; gap: 1.5rem; margin-bottom: 2rem; width: 100%; }
          
          /* 950px safe breakpoint for all laptops/tablets */
          @media (min-width: 950px) {
              .dash-mobile-layout { display: none !important; }
              .dash-desktop-layout { display: flex !important; }
          }
      `}</style>

      {/* 📱 MOBILE LAYOUT (Strict Vertical Order) */}
      <div className="dash-mobile-layout">
          {heroCard}
          {bentoStatsCard}
          {trendChartCard}
          {advancedAnalyticsCard}
          {pastLedgerCard}
      </div>

      {/* 💻 DESKTOP LAYOUT (Bulletproof Asymmetric Flexbox) */}
      <div className="dash-desktop-layout">
          {heroCard}
          {bentoStatsCard}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', width: '100%' }}>
              {/* Left Column (65% width) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '0 0 65%' }}>
                  {trendChartCard}
                  {pastLedgerCard}
              </div>
              {/* Right Column (Fills remaining space) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1', minWidth: 0 }}>
                  {advancedAnalyticsCard}
              </div>
          </div>
      </div>
    </div>
  );
}