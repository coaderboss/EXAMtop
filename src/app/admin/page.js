// src/app/admin/page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, get, update, set, remove } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';

// 🔥 UTILITY: Safe Array Converter
const safeArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data.filter(Boolean);
    return Object.values(data).filter(Boolean);
};

// 🔥 SIMPLE & CLEAN ANIMATIONS
const fadeUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

export default function GodMode() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- STATES ---
  const [activeTab, setActiveTab] = useState('pulse'); // 'pulse', 'analytics', 'users', 'tests'
  const [allUsers, setAllUsers] = useState([]);
  const [allTests, setAllTests] = useState([]);
  const [platformInstalls, setPlatformInstalls] = useState(0);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [currentBroadcast, setCurrentBroadcast] = useState('');
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false); 

  // System Modals & Views
  const [sysAlert, setSysAlert] = useState(null);
  const [sysConfirm, setSysConfirm] = useState(null);
  const [viewingSubsFor, setViewingSubsFor] = useState(null); 

  useEffect(() => {
    const handlePopState = () => {
        if (viewingSubsFor) {
            setViewingSubsFor(null);
            window.history.pushState(null, '', '#admin'); 
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewingSubsFor]);

  useEffect(() => {
      if (activeTab === 'analytics' && !window.Chart) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
          script.onload = () => renderCharts();
          document.head.appendChild(script);
      } else if (activeTab === 'analytics' && window.Chart) {
          renderCharts();
      }
  }, [activeTab, allTests]);

  // 🔥 CORE DATA FETCH
  const fetchGodData = async () => {
    setIsLoadingData(true);
    try {
        const testsSnap = await get(ref(database, 'tests'));
        let tData = [];
        if (testsSnap.exists()) {
            const rawTests = testsSnap.val();
            Object.keys(rawTests).forEach(key => {
                if(rawTests[key]) tData.push({ ...rawTests[key], dbKey: key });
            });
        }
        setAllTests(tData.reverse()); 

        try {
            const statsSnap = await get(ref(database, 'platform_stats/total_downloads'));
            setPlatformInstalls(statsSnap.exists() ? statsSnap.val() : 42);
        } catch(err) { setPlatformInstalls(42); } 

        try {
            const broadSnap = await get(ref(database, 'platform_settings/announcement'));
            if (broadSnap.exists()) setCurrentBroadcast(broadSnap.val());
        } catch(err) {}

    } catch (e) {
        setSysAlert({ title: 'CRITICAL FAILURE', msg: 'Database Rules blocked core access or connection failed.', type: 'error' });
    }
    setIsLoadingData(false);
  };

  // 🔥 ON-DEMAND USER FETCHING
  const fetchUsersOnDemand = async () => {
      setIsLoadingUsers(true);
      try {
          const usersSnap = await get(ref(database, 'users'));
          if (usersSnap.exists()) {
              const rawUsers = usersSnap.val();
              const uData = Object.keys(rawUsers).map(key => ({ uid: key, ...rawUsers[key] }));
              setAllUsers(uData);
          }
      } catch (e) {
          setSysAlert({ title: 'Error', msg: 'Failed to fetch users matrix.', type: 'error' });
      } finally {
          setIsLoadingUsers(false);
      }
  };

  useEffect(() => {
      if (userRole === 'admin') fetchGodData();
  }, [userRole]);
  
  // 🔥 AUTO-KICK BOUNCER
  useEffect(() => {
      if (!authLoading && (!currentUser || userRole !== 'admin')) {
          const kickTimer = setTimeout(() => {
              router.replace('/');
          }, 3000); 
          return () => clearTimeout(kickTimer);
      }
  }, [currentUser, userRole, authLoading, router]);
  
  // ===============================================
  // CHART RENDERING LOGIC (Animation & Timing Fixed)
  // ===============================================
  const renderCharts = () => {
      let attempts = 0;
      
      // Smart Checker: Check every 100ms if animation is complete and canvas is in DOM
      const checkReady = setInterval(() => {
          attempts++;
          const accCanvas = document.getElementById('accuracyChart');
          const trendCanvas = document.getElementById('trendChart');
          
          // Agar 20 attempts (2 seconds) tak canvas nahi mila toh loop rok do
          if (attempts > 20) {
              clearInterval(checkReady);
              return;
          }

          // Jaise hi Script aur dono Canvas mil jayein, drawing start karo!
          if (window.Chart && accCanvas && trendCanvas) {
              clearInterval(checkReady); 
              
              let totalCorrect = 0, totalWrong = 0, totalSkipped = 0;
              let testAttempts = {}; 

              allTests.forEach(t => {
                  safeArray(t.submissions).forEach(s => {
                      totalCorrect += (s.correct || 0);
                      totalWrong += (s.wrong || 0);
                      totalSkipped += (s.skipped || 0);
                      
                      let dateStr = (s.time || "").split(',')[0].trim();
                      if(dateStr) testAttempts[dateStr] = (testAttempts[dateStr] || 0) + 1;
                  });
              });

              // Accuracy Chart
              if(window.accChartInstance) window.accChartInstance.destroy();
              const ctxAcc = accCanvas.getContext('2d');
              window.accChartInstance = new window.Chart(ctxAcc, {
                  type: 'doughnut',
                  data: {
                      labels: ['Correct', 'Wrong', 'Skipped'],
                      datasets: [{
                          data: [totalCorrect, totalWrong, totalSkipped],
                          backgroundColor: ['#10B981', '#ef4444', '#334155'],
                          borderColor: '#020617',
                          borderWidth: 4
                      }]
                  },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'monospace' } } } }, cutout: '75%' }
              });

              // Trend Chart
              if(window.trendChartInstance) window.trendChartInstance.destroy();
              const dates = Object.keys(testAttempts).slice(-7); 
              const counts = dates.map(d => testAttempts[d]);
              
              const ctxTrend = trendCanvas.getContext('2d');
              window.trendChartInstance = new window.Chart(ctxTrend, {
                  type: 'line',
                  data: {
                      labels: dates.length ? dates : ['No Data'],
                      datasets: [{
                          label: 'Submissions',
                          data: counts.length ? counts : [0],
                          borderColor: '#f59e0b',
                          backgroundColor: 'rgba(245, 158, 11, 0.1)',
                          borderWidth: 2,
                          fill: true,
                          tension: 0.4,
                          pointBackgroundColor: '#f59e0b',
                          pointRadius: 4
                      }]
                  },
                  options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#1e293b' }, ticks: { color: '#64748b', stepSize: 1, font: { family: 'monospace' } } }, x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'monospace' } } } }, plugins: { legend: { display: false } } }
              });
          }
      }, 100); 
  };

  if (authLoading || (isLoadingData && userRole === 'admin')) {
    return (
        <div className="fixed inset-0 z-[99999] bg-[#0B0F19] flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin"></div>
            <div className="text-[#D4AF37] font-bold mt-6 tracking-[2px]">AUTHENTICATING ROOT ACCESS...</div>
        </div>
    );
  }

  if (!currentUser || userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center p-6 text-center text-white">
        <i className="ti ti-shield-x text-[80px] text-red-500 mb-4 animate-pulse"></i>
        <h2 className="text-red-500 font-black text-3xl md:text-4xl tracking-[2px] mb-2">SECURITY BREACH DETECTED</h2>
        <p className="font-semibold text-slate-400 mb-8">Your IP has been logged. Level-1 Admin clearance required.</p>
        <button className="px-8 py-3 text-base font-black bg-[#8B0000] text-white rounded-lg hover:bg-red-900 transition-colors" onClick={() => router.push('/')}>Evacuate Sector</button>
      </div>
    );
  }

  // ===============================================
  // REAL-WORLD GOD POWERS 
  // ===============================================
  
  const updateGodVoice = async () => {
      if(!broadcastMsg.trim()) { setSysAlert({ title: 'Invalid', msg: 'Cannot broadcast an empty message.', type: 'error' }); return; }
      try {
          await set(ref(database, 'platform_settings/announcement'), broadcastMsg);
          setCurrentBroadcast(broadcastMsg);
          setBroadcastMsg('');
          setSysAlert({ title: 'Broadcast Live', msg: 'The entire platform will see this message.', type: 'success' });
      } catch(e) { setSysAlert({ title: 'Database Locked', msg: 'Update your Firebase Realtime DB rules.', type: 'error' }); }
  };

  const changeUserRole = async (uid, newRole, userName) => {
      setSysConfirm({
          title: 'Alter Reality?',
          msg: `Grant "${newRole.toUpperCase()}" privileges to ${userName}?`,
          action: async () => {
              try { 
                  await update(ref(database, `users/${uid}`), { role: newRole }); 
                  setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u)); 
                  setSysAlert({ title: 'Role Updated', msg: `${userName} is now an ${newRole}.`, type: 'success' }); 
              } catch(e) { setSysAlert({ title: 'Error', msg: 'Failed to update reality.', type: 'error' }); }
          }
      });
  };

  const toggleUserBlock = async (uid, isCurrentlyBlocked, userName) => {
      const actionTxt = isCurrentlyBlocked ? "UNBLOCK" : "SUSPEND";
      setSysConfirm({
          title: `${actionTxt} USER?`,
          msg: `Are you sure you want to ${actionTxt.toLowerCase()} ${userName}'s account access?`,
          action: async () => {
              try { 
                  await update(ref(database, `users/${uid}`), { isBlocked: !isCurrentlyBlocked }); 
                  setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, isBlocked: !isCurrentlyBlocked } : u)); 
                  setSysAlert({ title: 'Access Updated', msg: `${userName} has been ${actionTxt.toLowerCase()}ed.`, type: 'success' }); 
              } catch(e) { setSysAlert({ title: 'Error', msg: 'Action failed.', type: 'error' }); }
          }
      });
  };

  const eradicateUser = async (uid, userName) => {
      setSysConfirm({
          title: 'WIPE CITIZEN?',
          msg: `NUCLEAR WARNING: This will permanently delete ${userName} from the database. Proceed?`,
          action: async () => {
              try { 
                  await remove(ref(database, `users/${uid}`)); 
                  setAllUsers(prev => prev.filter(u => u.uid !== uid)); 
                  setSysAlert({ title: 'Target Neutralized', msg: `${userName} wiped from existence.`, type: 'success' }); 
              } catch(e) { setSysAlert({ title: 'Error', msg: 'Eradication failed.', type: 'error' }); }
          }
      });
  };

  const deleteGlobalTest = (t) => {
      setSysConfirm({
          title: 'ERADICATE TEST?',
          msg: `WARNING: Permanently wipe "${t.title}" and ALL its student submissions?`,
          action: async () => {
              try {
                  await remove(ref(database, `tests/${t.dbKey}`));
                  setAllTests(prev => prev.filter(test => test.dbKey !== t.dbKey)); 
                  setSysAlert({ title: 'Eradicated', msg: 'Test wiped from existence.', type: 'success' });
                  setViewingSubsFor(null);
              } catch(e) { setSysAlert({ title: 'Error', msg: 'Failed deletion.', type: 'error' }); }
          }
      });
  };

  const deleteIndividualSub = (t, idx, sName) => {
      setSysConfirm({
          title: 'DELETE RECORD?',
          msg: `Erase submission of ${sName} from "${t.title}"?`,
          action: async () => {
              try {
                  let newSubs = safeArray(t.submissions);
                  newSubs.splice(idx, 1); 
                  await set(ref(database, `tests/${t.dbKey}/submissions`), newSubs);
                  const updatedTest = { ...t, submissions: newSubs };
                  setViewingSubsFor(updatedTest);
                  setAllTests(prev => prev.map(test => test.dbKey === t.dbKey ? updatedTest : test));
                  setSysAlert({ title: 'Deleted', msg: `${sName}'s record removed.`, type: 'success' });
              } catch(e) { setSysAlert({ title: 'Error', msg: 'Failed to delete record.', type: 'error' }); }
          }
      });
  };

  const adminChangeName = async (uid, currentName) => {
      const newName = prompt(`Enter new legal name for user (Current: ${currentName || 'N/A'}):`);
      if (newName && newName.trim() !== '') {
          try {
              await update(ref(database, `users/${uid}`), { legalName: newName.trim() });
              setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, legalName: newName.trim() } : u));
              setSysAlert({ title: 'Name Updated', msg: `User's official name overridden to ${newName.trim()}`, type: 'success' });
          } catch (e) { setSysAlert({ title: 'Error', msg: 'Failed to update name in database.', type: 'error' }); }
      }
  };

  // ===============================================
  // DERIVED DATA & METRICS
  // ===============================================
  const liveExams = allTests.filter(t => t.isActive !== false).length;
  let totalSubsCount = 0;
  let totalQuestionsInSystem = 0;
  let cheatAttemptsCaught = 0;
  let radarFeed = []; 

  allTests.forEach(t => {
      totalQuestionsInSystem += safeArray(t.questions).length;
      const subs = safeArray(t.submissions);
      totalSubsCount += subs.length;
      
      subs.forEach(s => {
          cheatAttemptsCaught += safeArray(s.cheatLogs).length;
          if (s.time && s.name) {
              radarFeed.push({ time: s.time, msg: `${s.name} submitted test [${t.code}] with score: ${s.score}` });
          }
      });
  });

  radarFeed.reverse().slice(0, 8); 

  // ===============================================
  // VIEW 1: INDIVIDUAL SUBMISSIONS LEDGER (God Mode)
  // ===============================================
  if (viewingSubsFor) {
      const subs = safeArray(viewingSubsFor.submissions);
      return (
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="p-4 md:p-8 max-w-5xl mx-auto font-sans min-h-screen">
            <button className="mb-6 px-4 py-2 font-black text-[#D4AF37] bg-[#0B0F19] border border-[#D4AF37] rounded-md hover:bg-slate-900 transition-colors flex items-center gap-2" onClick={() => { setViewingSubsFor(null); }}>
                <i className="ti ti-arrow-left"></i> BACK TO VAULT
            </button>
            
            <div className="bg-white border-2 border-[#8B0000] rounded-xl p-5 md:p-8 shadow-sm">
                <div className="border-b-2 border-slate-200 pb-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="m-0 text-[#0B0F19] font-black text-2xl mb-1">{viewingSubsFor.title}</h2>
                        <p className="m-0 text-slate-500 text-sm font-bold">ACCESS CODE: <span className="text-[#A32D2D]">{viewingSubsFor.code}</span></p>
                    </div>
                    <div className="bg-[#0B0F19] text-[#D4AF37] px-4 py-2 rounded-lg font-black text-sm whitespace-nowrap">
                        TOTAL SUBMISSIONS: {subs.length}
                    </div>
                </div>

                {subs.length === 0 ? (
                    <div className="text-center py-16 px-4 text-slate-400">
                        <i className="ti ti-ghost text-6xl block mb-4 opacity-50"></i>
                        <p className="font-semibold text-base">Vault empty. No submissions exist for this test.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-slate-200 hide-scrollbar">
                        <table className="w-full min-w-[700px] border-collapse text-left">
                            <thead>
                                <tr className="bg-[#0B0F19] text-[#D4AF37]">
                                    <th className="p-4 font-bold uppercase tracking-wider text-sm">Student Identity</th>
                                    <th className="p-4 font-bold uppercase tracking-wider text-sm">Timestamp</th>
                                    <th className="p-4 font-bold uppercase tracking-wider text-sm text-center">Score</th>
                                    <th className="p-4 font-bold uppercase tracking-wider text-sm text-right">God Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subs.map((s, idx) => {
                                    const pct = viewingSubsFor.totalMarks ? Math.round((s.score / viewingSubsFor.totalMarks) * 100) : 0;
                                    const hasCheated = safeArray(s.cheatLogs).length > 0;
                                    return (
                                    <tr key={idx} className={`border-b border-slate-200 ${hasCheated ? 'bg-red-50' : 'even:bg-white odd:bg-slate-50'} hover:bg-slate-100 transition-colors`}>
                                        <td className="p-4">
                                            <div className="font-black text-[#0B0F19] text-[15px] flex items-center gap-1.5">
                                                {s.name}
                                                {hasCheated && <i className="ti ti-shield-x text-[#A32D2D]" title="Cheat Attempt Detected"></i>}
                                            </div>
                                            <div className="text-xs text-slate-500 font-semibold mt-1">Roll: {s.roll || 'N/A'}</div>
                                        </td>
                                        <td className="p-4 text-[13px] text-slate-600 font-medium">{s.time}</td>
                                        <td className="p-4 text-center">
                                            <div className="font-black text-[#185FA5] text-lg leading-none">{s.score}</div>
                                            <div className="text-[11px] text-slate-400 font-bold mt-1">{pct}%</div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button className="px-3 py-2 font-bold bg-[#FCEBEB] text-[#A32D2D] border border-[#F7C1C1] rounded-md hover:bg-red-100 transition-colors text-[13px] flex items-center justify-end gap-1.5 ml-auto" onClick={() => deleteIndividualSub(viewingSubsFor, idx, s.name)}>
                                                <i className="ti ti-trash-x"></i> Purge
                                            </button>
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {/* Inline Confirm Modal */}
            <AnimatePresence>
                {sysConfirm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-[#0B0F19]/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0B0F19] border-2 border-[#A32D2D] rounded-2xl p-6 md:p-8 max-w-sm w-full text-center shadow-xl">
                            <i className="ti ti-alert-triangle text-5xl text-red-500 mb-4 block"></i>
                            <h3 className="text-xl mb-3 text-white font-black">{sysConfirm.title}</h3>
                            <p className="text-slate-300 mb-8 font-medium leading-relaxed">{sysConfirm.msg}</p>
                            <div className="flex gap-3">
                                <button className="flex-1 justify-center py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700" onClick={() => setSysConfirm(null)}>Abort</button>
                                <button className="flex-1 justify-center py-3 bg-[#8B0000] text-white font-black rounded-lg hover:bg-red-900" onClick={() => { sysConfirm.action(); setSysConfirm(null); }}>Execute</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
      );
  }

  // ===============================================
  // VIEW 2: MAIN GOD MODE DASHBOARD
  // ===============================================
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="p-4 md:p-8 max-w-6xl mx-auto font-sans min-h-screen">
        
        {/* HEADER PANEL (Exact Original Design) */}
        <div className="bg-gradient-to-br from-[#0B0F19] to-[#1a0b0b] rounded-2xl p-6 md:p-10 text-white mb-8 flex flex-col md:flex-row justify-between items-center gap-5 border border-[#3f1515] shadow-[0_15px_35px_rgba(139,0,0,0.2)]">
            <div className="flex items-center gap-4 md:gap-5 w-full md:w-auto">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-[#D4AF37]/10 border-2 border-[#D4AF37] rounded-2xl flex items-center justify-center text-3xl md:text-[38px] text-[#D4AF37] font-black shadow-[inset_0_0_15px_rgba(212,175,55,0.2)] flex-shrink-0">
                    <i className="ti ti-crown"></i>
                </div>
                <div>
                    <h2 className="m-0 text-xl md:text-[26px] font-black tracking-wide text-white mb-1">OMNI-CONTROL CENTER</h2>
                    <div className="text-[11px] md:text-[13px] text-[#D4AF37] font-mono tracking-wider font-semibold">
                        <i className="ti ti-fingerprint mr-1"></i> UID: {currentUser.uid.substring(0,8)}... &bull; ROOT CLEARANCE ACTIVE
                    </div>
                </div>
            </div>
            <div className="flex gap-5 text-right bg-black/40 px-6 py-4 rounded-xl border border-[#333] w-full md:w-auto justify-center md:justify-end">
                <div>
                    <div className="text-3xl md:text-[32px] font-black text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.3)] leading-none mb-1">{platformInstalls}</div>
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-[1.5px]">Global Installs</div>
                </div>
            </div>
        </div>

        {/* TABS (Mobile Scrollable) */}
        <div className="flex overflow-x-auto gap-2 md:gap-3 mb-8 pb-2 hide-scrollbar">
            {[
                { id: 'pulse', icon: 'ti-activity-heartbeat', label: 'System Pulse' },
                { id: 'analytics', icon: 'ti-chart-pie', label: 'Analytics' },
                { id: 'users', icon: 'ti-users-group', label: 'Citizen Matrix' },
                { id: 'tests', icon: 'ti-database', label: 'Global Vault' }
            ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 px-4 md:px-6 py-3 font-black rounded-lg transition-colors flex items-center gap-2 text-sm md:text-base ${activeTab === tab.id ? 'bg-[#8B0000] text-white' : 'bg-transparent text-slate-500 hover:bg-slate-200'}`}>
                    <i className={`ti ${tab.icon}`}></i> {tab.label}
                </button>
            ))}
        </div>

        <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                
                {/* ============================== */}
                {/* TAB 1: PLATFORM PULSE          */}
                {/* ============================== */}
                {activeTab === 'pulse' && (
                    <div className="space-y-6 md:space-y-8">
                        
                        {/* God Voice */}
                        <div className="bg-[#0B0F19] border border-slate-800 p-5 md:p-6 rounded-2xl">
                            <div className="flex items-center gap-2 mb-4">
                                <i className="ti ti-speakerphone text-[#D4AF37] text-xl"></i>
                                <h3 className="text-white m-0 text-base font-bold">God Voice (Global Broadcast)</h3>
                            </div>
                            {currentBroadcast && (
                                <div className="p-3 md:p-4 bg-[#D4AF37]/10 border-l-4 border-[#D4AF37] text-slate-300 text-sm mb-4 italic rounded-r-md">
                                    <strong className="mr-1">Current Broadcast:</strong> "{currentBroadcast}"
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input type="text" placeholder="Type an emergency message or system update for all users..." value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} className="flex-1 p-3 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none min-w-[200px]" />
                                <button className="px-6 py-3 bg-[#D4AF37] text-[#0B0F19] font-black rounded-lg border-none hover:bg-amber-400 transition-colors" onClick={updateGodVoice}>Send to All</button>
                            </div>
                        </div>

                        {/* Exact Original White Stats Cards */}
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            {[
                                { icon: 'ti-users', color: '#185FA5', val: allUsers.length || 'N/A', label: 'Total Citizens' },
                                { icon: 'ti-files', color: '#854F0B', val: allTests.length, label: 'Exams Forged' },
                                { icon: 'ti-device-gamepad', color: '#10B981', val: liveExams, label: 'Active Intakes' },
                                { icon: 'ti-server', color: '#3C3489', val: totalSubsCount, label: 'Total Submissions' }
                            ].map((stat, i) => (
                                <motion.div variants={fadeUp} key={i} className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl text-center">
                                    <i className={`ti ${stat.icon} text-[38px] mb-4 block`} style={{ color: stat.color }}></i>
                                    <div className="text-[32px] md:text-[42px] font-black text-[#0B0F19] leading-none mb-2">{stat.val}</div>
                                    <div className="text-[11px] md:text-[13px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</div>
                                </motion.div>
                            ))}
                        </motion.div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                            {/* Live System Radar (Original Colors) */}
                            <div className="bg-[#0B0F19] rounded-2xl p-5 md:p-6 border border-slate-800">
                                <h3 className="text-[#D4AF37] m-0 mb-4 text-base font-bold flex items-center gap-2"><i className="ti ti-radar"></i> Live System Radar</h3>
                                <div className="h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                    {radarFeed.length > 0 ? radarFeed.map((feed, i) => (
                                        <div key={i} className="border-l-2 border-slate-700 pl-3 mb-4 relative">
                                            <div className="absolute w-2 h-2 bg-[#10B981] rounded-full -left-[5px] top-1"></div>
                                            <div className="text-[11px] text-slate-500 mb-1 font-mono">[{feed.time}]</div>
                                            <div className="text-[13px] text-slate-200 leading-relaxed">{feed.msg}</div>
                                        </div>
                                    )) : <div className="text-slate-500 text-[13px] italic">No recent activity detected.</div>}
                                </div>
                            </div>
                            
                            {/* Analytics blocks (Original colors) */}
                            <div className="flex flex-col gap-4 md:gap-6">
                                <div className="bg-[#FCEBEB] border border-[#F7C1C1] rounded-2xl p-5 md:p-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-[#A32D2D] m-0 text-base font-bold flex items-center gap-2"><i className="ti ti-shield-x"></i> Proctoring AI Module</h3>
                                        <span className="bg-[#A32D2D] text-white px-2.5 py-1 rounded-full text-xs font-black">ACTIVE</span>
                                    </div>
                                    <div className="text-[36px] font-black text-[#A32D2D] leading-none mb-2">{cheatAttemptsCaught}</div>
                                    <div className="text-[13px] text-[#791F1F] font-bold">Total Cheat Violations Intercepted</div>
                                </div>

                                <div className="bg-[#f8fafc] border border-slate-200 rounded-2xl p-5 md:p-6">
                                    <h3 className="text-[#0f172a] m-0 mb-4 text-base font-bold flex items-center gap-2"><i className="ti ti-database"></i> Database Quota Health</h3>
                                    <div className="flex justify-between text-[13px] text-slate-600 font-bold mb-2">
                                        <span>Storage Nodes (Questions)</span>
                                        <span>{totalQuestionsInSystem} Units</span>
                                    </div>
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                                        <div className="h-full bg-[#185FA5]" style={{ width: `${Math.min(100, (totalQuestionsInSystem/5000)*100)}%` }}></div>
                                    </div>
                                    <div className="text-[11px] text-slate-400 text-right font-semibold">Free Tier Limit: ~5000</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ============================== */}
                {/* TAB 2: GRAPHICAL ANALYTICS     */}
                {/* ============================== */}
                {activeTab === 'analytics' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                        <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
                            <h3 className="text-white text-base m-0 mb-6 font-bold flex items-center gap-2"><i className="ti ti-target text-[#D4AF37]"></i> Global Platform Accuracy</h3>
                            <div className="h-[300px] relative w-full"><canvas id="accuracyChart"></canvas></div>
                        </div>
                        <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
                            <h3 className="text-white text-base m-0 mb-6 font-bold flex items-center gap-2"><i className="ti ti-trending-up text-[#D4AF37]"></i> Recent Engagement (Last 7 Days)</h3>
                            <div className="h-[300px] relative w-full"><canvas id="trendChart"></canvas></div>
                        </div>
                    </div>
                )}

                {/* ============================== */}
                {/* TAB 3: USER MATRIX             */}
                {/* ============================== */}
                {activeTab === 'users' && (
                    <motion.div className="bg-white border border-slate-200 p-4 md:p-6 rounded-2xl shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <h2 className="text-lg m-0 font-bold text-slate-900">Citizen Registry</h2>
                            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-[#185FA5] text-white font-medium rounded-md hover:bg-[#0C447C] transition-colors text-sm w-full sm:w-auto disabled:opacity-50" onClick={fetchUsersOnDemand} disabled={isLoadingUsers}>
                                {isLoadingUsers ? 'Fetching...' : <><i className="ti ti-download"></i> Load Users Matrix</>}
                            </button>
                        </div>

                        {isLoadingUsers ? (
                            <div className="text-center py-12"><div className="w-8 h-8 border-4 border-[#185FA5] border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                        ) : allUsers.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 font-medium">Click "Load Users Matrix" to fetch database records.</div>
                        ) : (
                            <div className="overflow-x-auto border border-slate-200 rounded-lg hide-scrollbar">
                                <table className="w-full min-w-[900px] text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#0B0F19] text-[#D4AF37] text-[13px] uppercase tracking-wide">
                                            <th className="p-4 font-bold">Citizen Info</th>
                                            <th className="p-4 font-bold">Email & UID</th>
                                            <th className="p-4 font-bold text-center">Clearance Level</th>
                                            <th className="p-4 font-bold text-right">God Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {allUsers.map((u, i) => (
                                            <tr key={u.uid} className={`${u.isBlocked ? 'bg-[#fff0f0] opacity-70' : 'even:bg-white odd:bg-slate-50'} hover:bg-slate-100 transition-colors`}>
                                                <td className="p-4">
                                                    <div className="font-black text-slate-900 text-base flex items-center gap-2">
                                                        {u.legalName || u.name || 'Unknown Entity'}
                                                        {u.isBlocked && <i className="ti ti-ban text-[#A32D2D]" title="Account Suspended"></i>}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="text-[12px] text-slate-500 font-bold">{u.rollNo || u.examinerId || 'No ID'}</span>
                                                        {u.profileLocked ? <span className="bg-[#EAF3DE] text-[#27500A] px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#C0DD97] flex items-center gap-1"><i className="ti ti-lock"></i> Locked</span> : <span className="bg-[#FAEEDA] text-[#633806] px-1.5 py-0.5 rounded text-[10px] font-bold border border-[#FAC775]">Unverified</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="text-[14px] text-slate-800 font-bold">{u.email}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono mt-1">{u.uid}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {u.uid === currentUser.uid ? (
                                                        <span className="inline-flex bg-[#0B0F19] text-[#D4AF37] text-[12px] font-black px-3 py-1.5 rounded-md tracking-wider"><i className="ti ti-crown mr-1"></i> SYSTEM OWNER</span>
                                                    ) : (
                                                        <select 
                                                            value={u.role || 'student'} 
                                                            onChange={(e) => changeUserRole(u.uid, e.target.value, u.legalName || u.name || 'User')}
                                                            className={`p-2 rounded-lg text-[13px] font-bold border outline-none cursor-pointer text-center ${u.role === 'admin' ? 'bg-[#FCEBEB] text-[#A32D2D] border-[#F7C1C1]' : u.role === 'examiner' ? 'bg-[#EAF3DE] text-[#3B6D11] border-[#C0DD97]' : 'bg-slate-100 text-slate-600 border-slate-300'}`}
                                                        >
                                                            <option value="student">Student</option>
                                                            <option value="examiner">Examiner</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {u.uid !== currentUser.uid && (
                                                        <div className="flex gap-2 justify-end flex-wrap">
                                                            <button className="p-2 bg-white text-[#854F0B] border border-[#FAC775] rounded-md hover:bg-[#FAEEDA] transition-colors" onClick={() => adminChangeName(u.uid, u.legalName || u.name)} title="Force Edit Name">
                                                                <i className="ti ti-pencil text-base"></i>
                                                            </button>
                                                            <button className={`p-2 border rounded-md transition-colors ${u.isBlocked ? 'bg-[#EAF3DE] text-[#3B6D11] border-[#C0DD97] hover:bg-[#dcefc8]' : 'bg-[#fff5f5] text-[#A32D2D] border-[#ffcdd2] hover:bg-[#f8d0d0]'}`} onClick={() => toggleUserBlock(u.uid, u.isBlocked, u.legalName || u.name || 'User')} title={u.isBlocked ? "Unblock User" : "Suspend User"}>
                                                                <i className={`ti ${u.isBlocked ? 'ti-user-check' : 'ti-user-off'} text-base`}></i>
                                                            </button>
                                                            <button className="p-2 bg-[#8B0000] text-white rounded-md hover:bg-red-800 transition-colors border-none" onClick={() => eradicateUser(u.uid, u.legalName || u.name || 'User')} title="Permanently Eradicate">
                                                                <i className="ti ti-trash-x text-base"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* ============================== */}
                {/* TAB 4: GLOBAL VAULT            */}
                {/* ============================== */}
                {activeTab === 'tests' && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-0">
                        <div className="overflow-x-auto hide-scrollbar">
                            <table className="w-full min-w-[900px] text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#0B0F19] text-[#D4AF37] text-[13px] uppercase tracking-wide">
                                        <th className="p-4 font-bold">Unique Code</th>
                                        <th className="p-4 font-bold">Exam Title</th>
                                        <th className="p-4 font-bold text-center">Data Blocks</th>
                                        <th className="p-4 font-bold text-center">Status</th>
                                        <th className="p-4 font-bold text-right">God Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {allTests.map((t, i) => {
                                        const subs = safeArray(t.submissions);
                                        return (
                                        <tr key={t.dbKey} className="even:bg-white odd:bg-slate-50 hover:bg-slate-100 transition-colors">
                                            <td className="p-4 font-mono text-base text-[#A32D2D] font-black tracking-[2px]">{t.code}</td>
                                            <td className="p-4">
                                                <div className="font-black text-slate-900 text-[15px] mb-1">{t.title}</div>
                                                <div className="text-xs text-slate-500 font-bold">{t.totalMarks} Marks System</div>
                                            </td>
                                            <td className="p-4 font-black text-[#185FA5] text-center text-lg">{subs.length}</td>
                                            <td className="p-4 text-center">
                                                {t.isActive !== false ? <span className="px-3 py-1.5 bg-[#EAF3DE] text-[#27500A] text-[11px] font-black rounded-full tracking-wide">LIVE</span> : <span className="px-3 py-1.5 bg-slate-200 text-slate-600 text-[11px] font-black rounded-full tracking-wide">CLOSED</span>}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex gap-2 justify-end flex-wrap">
                                                    <button className="flex items-center gap-1 px-3 py-1.5 bg-[#0B0F19] text-[#D4AF37] border border-[#D4AF37] rounded-md font-bold text-[13px] hover:bg-slate-900 transition-colors" onClick={() => setViewingSubsFor(t)}>
                                                        <i className="ti ti-eye"></i> View Vault
                                                    </button>
                                                    <button className="flex items-center gap-1 px-3 py-1.5 bg-[#8B0000] text-white border-none rounded-md font-bold text-[13px] hover:bg-red-800 transition-colors" onClick={() => deleteGlobalTest(t)}>
                                                        <i className="ti ti-flame"></i> Nuke
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>

        {/* ALERTS & MODALS (Exact original style but animated) */}
        <AnimatePresence>
            {sysAlert && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-[#0B0F19]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className={`bg-[#0B0F19] border-2 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl ${sysAlert.type === 'error' ? 'border-[#ff4444]' : 'border-[#10B981]'}`}>
                        <i className={`ti ${sysAlert.type === 'error' ? 'ti-alert-octagon text-[#ff4444]' : 'ti-circle-check text-[#10B981]'} text-5xl mb-4 block`}></i>
                        <h3 className="text-[20px] text-white font-black mb-2">{sysAlert.title}</h3>
                        <p className="text-slate-300 mb-8 font-medium text-[15px]">{sysAlert.msg}</p>
                        <button className={`w-full py-3 font-black text-white rounded-lg tracking-wider transition-colors ${sysAlert.type === 'error' ? 'bg-[#8B0000] hover:bg-red-900' : 'bg-[#10B981] hover:bg-emerald-600'}`} onClick={() => setSysAlert(null)}>ACKNOWLEDGE</button>
                    </motion.div>
                </motion.div>
            )}

            {sysConfirm && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] bg-[#0B0F19]/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0B0F19] border-2 border-[#ff4444] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
                        <i className="ti ti-alert-triangle text-5xl text-[#ff4444] mb-4 block"></i>
                        <h3 className="text-[20px] text-white font-black mb-3">{sysConfirm.title}</h3>
                        <p className="text-slate-300 mb-8 font-medium leading-relaxed text-[15px]">{sysConfirm.msg}</p>
                        <div className="flex gap-3">
                            <button className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700" onClick={() => setSysConfirm(null)}>ABORT</button>
                            <button className="flex-1 py-3 bg-[#8B0000] text-white font-black rounded-lg hover:bg-red-900 tracking-wider" onClick={() => { sysConfirm.action(); setSysConfirm(null); }}>EXECUTE</button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        <style jsx global>{`
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        `}</style>
    </motion.div>
  );
}