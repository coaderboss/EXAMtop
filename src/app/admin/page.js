// src/app/admin/page.js
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, get, update, set } from 'firebase/database';

export default function GodMode() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('pulse'); // 'pulse', 'users', 'tests'
  const [allUsers, setAllUsers] = useState([]);
  const [allTests, setAllTests] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // System Modals & Views
  const [sysAlert, setSysAlert] = useState(null);
  const [sysConfirm, setSysConfirm] = useState(null);
  const [viewingSubsFor, setViewingSubsFor] = useState(null); // Shows individual submissions ledger

  const fetchGodData = async () => {
    setIsLoadingData(true);
    try {
        const usersSnap = await get(ref(database, 'users'));
        const testsSnap = await get(ref(database, 'tests'));
        
        let uData = [];
        if (usersSnap.exists()) {
            const rawUsers = usersSnap.val();
            uData = Object.keys(rawUsers).map(key => ({ uid: key, ...rawUsers[key] }));
        }
        
        let tData = [];
        if (testsSnap.exists()) {
            const rawTests = testsSnap.val();
            tData = Array.isArray(rawTests) ? rawTests.filter(t => t !== null) : Object.values(rawTests).filter(t => t !== null);
        }

        setAllUsers(uData);
        setAllTests(tData);
    } catch (e) {
        setSysAlert({ title: 'Fetch Error', msg: 'Could not connect to Firebase Core.', type: 'error' });
    }
    setIsLoadingData(false);
  };

  useEffect(() => {
      if (userRole === 'admin') fetchGodData();
  }, [userRole]);

  if (authLoading || (isLoadingData && userRole === 'admin')) {
    return <div className="spinner-container" style={{ paddingTop: '20vh' }}><div className="spinner" style={{ borderColor: '#A32D2D', borderTopColor: 'transparent' }}></div><div style={{ color: '#A32D2D', fontWeight: 700 }}>Initializing God Mode...</div></div>;
  }

  if (!currentUser || userRole !== 'admin') {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <i className="ti ti-shield-x" style={{ fontSize: '64px', color: '#A32D2D', marginBottom: '1rem', animation: 'pulse 1s infinite' }}></i>
        <h2 style={{ color: '#A32D2D', fontWeight: 800 }}>SECURITY BREACH</h2>
        <p style={{ fontWeight: 600 }}>Your IP has been logged. You do not have Level-1 Admin clearance.</p>
        <button className="btn btn-danger" style={{ marginTop: '1.5rem' }} onClick={() => router.push('/')}>Evacuate</button>
      </div>
    );
  }

  // --- GOD POWERS ---
  const changeUserRole = async (uid, newRole, userName) => {
      setSysConfirm({
          title: 'Alter Reality?',
          msg: `Grant "${newRole.toUpperCase()}" privileges to ${userName}?`,
          action: async () => {
              try {
                  await update(ref(database, `users/${uid}`), { role: newRole });
                  setSysAlert({ title: 'Role Updated', msg: `${userName} is now an ${newRole}.`, type: 'success' });
                  fetchGodData(); 
              } catch(e) { setSysAlert({ title: 'Error', msg: 'Failed to update reality.', type: 'error' }); }
          }
      });
  };

  const deleteGlobalTest = (t) => {
      setSysConfirm({
          title: 'Eradicate Test?',
          msg: `WARNING: Permanently wipe "${t.title}" and its submissions?`,
          action: async () => {
              try {
                  const newTests = allTests.filter(x => x.id !== t.id);
                  await set(ref(database, 'tests'), newTests);
                  setSysAlert({ title: 'Eradicated', msg: 'Test wiped from existence.', type: 'success' });
                  fetchGodData();
              } catch(e) { setSysAlert({ title: 'Error', msg: 'Failed deletion.', type: 'error' }); }
          }
      });
  };

  // 🔥 THE FIX: INDIVIDUAL SUBMISSION DELETE
  const deleteIndividualSub = (t, idx, sName) => {
      setSysConfirm({
          title: 'Delete Student Record?',
          msg: `Delete submission of ${sName} from test "${t.title}"?`,
          action: async () => {
              try {
                  const tIndex = allTests.findIndex(x => x.id === t.id);
                  let newSubs = [...t.submissions];
                  newSubs.splice(idx, 1); // Remove specifically that student
                  
                  await set(ref(database, `tests/${tIndex}/submissions`), newSubs);
                  setSysAlert({ title: 'Deleted', msg: `${sName}'s record removed.`, type: 'success' });
                  
                  // Update local UI state
                  setViewingSubsFor({ ...t, submissions: newSubs });
                  fetchGodData();
              } catch(e) { setSysAlert({ title: 'Error', msg: 'Failed to delete record.', type: 'error' }); }
          }
      });
  };

  // Stats Calcs
  const liveExams = allTests.filter(t => t.isActive !== false).length;
  const totalSubs = allTests.reduce((acc, t) => acc + (t.submissions ? t.submissions.length : 0), 0);
  
  // Dummy logic for Total Installs (Since PWA logic isn't tied to DB directly here)
  const totalInstalls = Math.floor(allUsers.length * 1.5) + 42; 

  // ===============================================
  // VIEW: INDIVIDUAL SUBMISSIONS LEDGER (God Mode)
  // ===============================================
  if (viewingSubsFor) {
      const subs = viewingSubsFor.submissions || [];
      return (
        <div style={{ padding: '2rem 1.5rem', maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
            <button className="btn btn-ghost" style={{ marginBottom: '1.5rem', fontWeight: 600, color: '#A32D2D' }} onClick={() => setViewingSubsFor(null)}>
                <i className="ti ti-arrow-left"></i> Back to Vault
            </button>
            
            <div className="card" style={{ padding: '2rem', border: '1px solid #A32D2D' }}>
                <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>{viewingSubsFor.title}</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: 600 }}>Code: {viewingSubsFor.code} &bull; Total Submissions: {subs.length}</p>
                </div>

                {subs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                        <i className="ti ti-ghost" style={{ fontSize: '48px', display: 'block', marginBottom: '1rem' }}></i>
                        <p>No submissions exist for this test.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Student Info</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Submission Time</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Score</th>
                                    <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Admin Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {subs.map((s, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>{s.name}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>Roll: {s.roll || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: '#64748b' }}>{s.time}</td>
                                        <td style={{ padding: '16px', textAlign: 'center', fontWeight: 800, color: '#185FA5', fontSize: '16px' }}>{s.score}</td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <button className="btn btn-sm btn-danger" style={{ padding: '6px 12px', fontWeight: 600 }} onClick={() => deleteIndividualSub(viewingSubsFor, idx, s.name)}>
                                                <i className="ti ti-trash"></i> Delete Entry
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {sysConfirm && (
                <div className="modal-bg" style={{ zIndex: 9999 }}>
                    <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem', border: '2px solid #A32D2D' }}>
                        <h3 style={{ fontSize: '20px', marginBottom: '10px', color: '#A32D2D' }}>{sysConfirm.title}</h3>
                        <p style={{ color: 'var(--color-text-primary)', marginBottom: '1.5rem', lineHeight: 1.5, fontWeight: 500 }}>{sysConfirm.msg}</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSysConfirm(null)}>Abort</button>
                            <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { sysConfirm.action(); setSysConfirm(null); }}>Execute</button>
                        </div>
                    </div>
                </div>
            )}
            {sysAlert && (
                <div className="modal-bg" style={{ zIndex: 9999 }}>
                    <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                        <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>{sysAlert.title}</h3>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>{sysAlert.msg}</p>
                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSysAlert(null)}>Okay</button>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // ===============================================
  // VIEW: MAIN GOD MODE DASHBOARD
  // ===============================================
  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 0.4s ease' }}>
        
        {/* 🔥 THE FIX: BLACK ADMIN IDENTITY CARD */}
        <div style={{ background: '#0f172a', borderRadius: '16px', padding: '2rem', color: '#fff', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '70px', height: '70px', background: '#A32D2D', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: '#fff', fontWeight: 800 }}>
                    <i className="ti ti-shield-lock"></i>
                </div>
                <div>
                    <h2 style={{ margin: '0 0 5px 0', fontSize: '24px', fontWeight: 800, letterSpacing: '0.5px' }}>ADMINISTRATOR SECURE UPLINK</h2>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace', letterSpacing: '0.5px' }}>ID: {currentUser.uid} &bull; ROOT ACCESS GRANTED</div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', textAlign: 'right' }}>
                <div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#10B981' }}>{totalInstalls}</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Installs</div>
                </div>
            </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', overflowX: 'auto' }}>
            <button className="btn btn-ghost" style={{ fontWeight: 700, padding: '10px 24px', borderRadius: '8px', color: activeTab === 'pulse' ? '#A32D2D' : '#64748b', background: activeTab === 'pulse' ? '#FCEBEB' : 'transparent' }} onClick={() => setActiveTab('pulse')}><i className="ti ti-activity"></i> Platform Pulse</button>
            <button className="btn btn-ghost" style={{ fontWeight: 700, padding: '10px 24px', borderRadius: '8px', color: activeTab === 'users' ? '#A32D2D' : '#64748b', background: activeTab === 'users' ? '#FCEBEB' : 'transparent' }} onClick={() => setActiveTab('users')}><i className="ti ti-users-group"></i> User Matrix</button>
            <button className="btn btn-ghost" style={{ fontWeight: 700, padding: '10px 24px', borderRadius: '8px', color: activeTab === 'tests' ? '#A32D2D' : '#64748b', background: activeTab === 'tests' ? '#FCEBEB' : 'transparent' }} onClick={() => setActiveTab('tests')}><i className="ti ti-folders"></i> Global Vault</button>
        </div>

        {/* TAB 1: PLATFORM PULSE */}
        {activeTab === 'pulse' && (
            <div className="grid4">
                <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: '#e2e8f0' }}>
                    <i className="ti ti-users" style={{ fontSize: '32px', color: '#185FA5', marginBottom: '10px' }}></i>
                    <div style={{ fontSize: '36px', fontWeight: 900, color: '#1e293b' }}>{allUsers.length}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Citizens</div>
                </div>
                <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: '#e2e8f0' }}>
                    <i className="ti ti-files" style={{ fontSize: '32px', color: '#854F0B', marginBottom: '10px' }}></i>
                    <div style={{ fontSize: '36px', fontWeight: 900, color: '#1e293b' }}>{allTests.length}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Exams Created</div>
                </div>
                <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: '#e2e8f0' }}>
                    <i className="ti ti-device-gamepad" style={{ fontSize: '32px', color: '#10B981', marginBottom: '10px' }}></i>
                    <div style={{ fontSize: '36px', fontWeight: 900, color: '#1e293b' }}>{liveExams}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Intakes</div>
                </div>
                <div className="card" style={{ padding: '2rem', textAlign: 'center', borderColor: '#e2e8f0' }}>
                    <i className="ti ti-checklist" style={{ fontSize: '32px', color: '#3C3489', marginBottom: '10px' }}></i>
                    <div style={{ fontSize: '36px', fontWeight: 900, color: '#1e293b' }}>{totalSubs}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Submissions</div>
                </div>
            </div>
        )}

        {/* TAB 2: USER MATRIX */}
        {activeTab === 'users' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                        <thead>
                            <tr style={{ background: '#1e293b', color: '#fff', textAlign: 'left' }}>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Citizen ID</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Name & Email</th>
                                <th style={{ padding: '16px', fontWeight: 600, textAlign: 'center' }}>Power Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allUsers.map((u, i) => (
                                <tr key={u.uid} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '12px', color: '#94a3b8' }}>{u.uid}</td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>{u.name || 'Unknown'}</div>
                                        <div style={{ fontSize: '13px', color: '#64748b' }}>{u.email}</div>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <select 
                                            value={u.role || 'student'} 
                                            onChange={(e) => changeUserRole(u.uid, e.target.value, u.name || 'User')}
                                            disabled={u.uid === currentUser.uid} 
                                            style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, border: '1px solid #cbd5e1', background: u.role === 'admin' ? '#FCEBEB' : u.role === 'examiner' ? '#EAF3DE' : '#fff', color: u.role === 'admin' ? '#A32D2D' : u.role === 'examiner' ? '#3B6D11' : '#475569', cursor: u.uid === currentUser.uid ? 'not-allowed' : 'pointer' }}
                                        >
                                            <option value="student">Student</option>
                                            <option value="examiner">Examiner</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* TAB 3: GLOBAL VAULT */}
        {activeTab === 'tests' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr style={{ background: '#1e293b', color: '#fff', textAlign: 'left' }}>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Code</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Exam Title</th>
                                <th style={{ padding: '16px', fontWeight: 600 }}>Subs</th>
                                <th style={{ padding: '16px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                                <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>God Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allTests.map((t, i) => {
                                const subsCount = t.submissions ? t.submissions.length : 0;
                                return (
                                <tr key={t.id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '15px', color: '#185FA5', fontWeight: 800 }}>{t.code}</td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px', marginBottom: '4px' }}>{t.title}</div>
                                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{t.totalMarks} Marks</div>
                                    </td>
                                    <td style={{ padding: '16px', fontWeight: 700, color: '#475569' }}>{subsCount}</td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        {t.isActive !== false ? <span className="badge b-green" style={{ padding: '4px 10px' }}>LIVE</span> : <span className="badge b-gray" style={{ padding: '4px 10px' }}>CLOSED</span>}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                            <button className="btn btn-sm btn-ghost" style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 700, background: '#E6F1FB', color: '#185FA5', border: '1px solid #CECBF6' }} onClick={() => setViewingSubsFor(t)}>
                                                <i className="ti ti-eye"></i> View Subs
                                            </button>
                                            <button className="btn btn-sm btn-danger" style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 700 }} onClick={() => deleteGlobalTest(t)}>
                                                <i className="ti ti-trash"></i> Eradicate
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

        {/* SYSTEM MODALS */}
        {sysAlert && (
            <div className="modal-bg" style={{ zIndex: 9999 }}>
                <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                    <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>{sysAlert.title}</h3>
                    <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>{sysAlert.msg}</p>
                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setSysAlert(null)}>Okay</button>
                </div>
            </div>
        )}

        {sysConfirm && (
            <div className="modal-bg" style={{ zIndex: 9999 }}>
                <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem', border: '2px solid #A32D2D' }}>
                    <h3 style={{ fontSize: '20px', marginBottom: '10px', color: '#A32D2D' }}>{sysConfirm.title}</h3>
                    <p style={{ color: 'var(--color-text-primary)', marginBottom: '1.5rem', fontWeight: 500 }}>{sysConfirm.msg}</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setSysConfirm(null)}>Abort</button>
                        <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { sysConfirm.action(); setSysConfirm(null); }}>Execute</button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
}