// src/app/student/radar/page.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { database } from '../../../lib/firebase';
import { ref, get, set } from 'firebase/database';

export default function EducatorRadar() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // --- LAZY LOADING STATES ---
  const [isMounted, setIsMounted] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  // --- CORE DATA STATES ---
  const [followedEducators, setFollowedEducators] = useState([]); 
  const [educatorProfiles, setEducatorProfiles] = useState([]); // Array of Teacher Objects
  const [allRadarTests, setAllRadarTests] = useState([]); // All tests from all followed teachers
  
  // --- UI MASTER-DETAIL STATES ---
  const [activeTeacher, setActiveTeacher] = useState(null); // null = show master list, object = show details
  
  // --- SEARCH STATES ---
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [sysAlert, setSysAlert] = useState(null);

  useEffect(() => { setIsMounted(true); }, []);

  // --- 🚀 FETCH ENGINE (PROFILES + TESTS) ---
  const fetchRadarData = useCallback(async () => {
      if (!currentUser?.uid) return;
      setIsFetching(true);
      try {
          // 1. Fetch Followed UIDs
          const studentSnap = await get(ref(database, `users/${currentUser.uid}/followed`));
          const followedList = studentSnap.val() || [];
          setFollowedEducators(followedList);

          if (followedList.length === 0) {
              setIsFetching(false);
              return;
          }

          // 2. Fetch Users to build Teacher Cards (Even if they have 0 tests)
          const usersSnap = await get(ref(database, 'users'));
          const allUsers = usersSnap.val() || {};
          let profiles = [];
          
          followedList.forEach(uid => {
              if (allUsers[uid]) {
                  const u = allUsers[uid];
                  profiles.push({ 
                      uid, 
                      name: u.name || 'Educator', 
                      // 🔥 FIX: Check all possible keys where the EXT code is saved
                      code: u.examinerId || u.rollNo || u.examinerCode || 'N/A',
                      email: u.email
                  });
              }
          });
          setEducatorProfiles(profiles);

          // 3. Fetch Tests for those Teachers
          const testsSnap = await get(ref(database, 'tests'));
          const allTests = testsSnap.val() || [];
          let feed = [];

          allTests.forEach(test => {
              // 🔥 FIX: STRICTLY TRUE check. Purane tests ya undefined automatically hide ho jayenge.
              if (test && followedList.includes(test.creatorUid) && test.radarVisible === true) {
                  // Ignore older than 18 hours after expiry
                  if (test.expiryDate) {
                      const expiryTime = new Date(test.expiryDate).getTime();
                      if (Date.now() - expiryTime > 18 * 60 * 60 * 1000) return; 
                  }
                  feed.push(test);
              }
          });

          // Sort by newest/upcoming
          feed.sort((a, b) => {
              const timeA = a.openDate ? new Date(a.openDate).getTime() : new Date(a.createdAt).getTime();
              const timeB = b.openDate ? new Date(b.openDate).getTime() : new Date(b.createdAt).getTime();
              return timeB - timeA; 
          });

          setAllRadarTests(feed);
      } catch (error) {
          console.error("Radar Fetch Error:", error);
      } finally {
          setIsFetching(false);
      }
  }, [currentUser]);

  useEffect(() => {
      if (isMounted && !authLoading && currentUser) {
          fetchRadarData();
      }
  }, [isMounted, authLoading, currentUser, fetchRadarData]);


  // --- 🔍 EDUCATOR SEARCH (BY EXT/EXT CODE) ---
  const handleSearchEducator = async () => {
      if (!searchId.trim()) return;
      setIsSearching(true);
      setSearchResult(null);
      
      try {
          const searchUpper = searchId.trim().toUpperCase();
          const usersSnap = await get(ref(database, 'users'));
          const allUsers = usersSnap.val() || {};
          
          let found = null;
          Object.keys(allUsers).forEach(uid => {
              const u = allUsers[uid];
              
              // 🔥 STRICT MATCH: Database me jahan bhi code save hai, wahan check karo
              const dbCode = (u.examinerId || u.rollNo || u.examinerCode || '').toUpperCase();
              
              if (u.role === 'examiner' && dbCode === searchUpper) {
                  found = { uid, name: u.name || 'Educator', code: dbCode };
              }
          });

          if (found) setSearchResult(found);
          else setSysAlert({ title: 'Not Found', msg: 'No educator found with this EXT/EXM code.', type: 'error' });
          
      } catch (error) {
          setSysAlert({ title: 'Error', msg: 'Network error during search.', type: 'error' });
      } finally {
          setIsSearching(false);
      }
  };

  const handleFollow = async () => {
      if (!searchResult || !currentUser?.uid) return;
      
      if (followedEducators.includes(searchResult.uid)) {
          setSysAlert({ title: 'Already Connected', msg: 'You are already following this educator.', type: 'info' });
          return;
      }

      try {
          const newList = [...followedEducators, searchResult.uid];
          await set(ref(database, `users/${currentUser.uid}/followed`), newList);
          setSearchResult(null);
          setSearchId('');
          setSysAlert({ title: 'Connected!', msg: `You are now following ${searchResult.name}.`, type: 'success' });
          fetchRadarData(); 
      } catch (error) {
          setSysAlert({ title: 'Error', msg: 'Failed to connect with educator.', type: 'error' });
      }
  };

  const getExamStatus = (test) => {
      const now = Date.now();
      const openTime = test.openDate ? new Date(test.openDate).getTime() : null;
      // 🔥 FIX: Ab ye closeDate check karega, agar purana test hai toh expiryDate check karega
      const closeTime = test.closeDate ? new Date(test.closeDate).getTime() : (test.expiryDate ? new Date(test.expiryDate).getTime() : null);

      if (openTime && now < openTime) return 'upcoming';
      if (test.isActive === false || (closeTime && now > closeTime)) return 'closed';
      return 'live';
  };

  const formatScheduleTime = (dateString) => {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };


  if (!isMounted || authLoading) return null;
  if (!currentUser) return <div style={{ textAlign: 'center', padding: '4rem' }}>Please login to access your Radar.</div>;

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '900px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      
      {/* 🛡️ VIEW 1: MASTER LIST (Educator Cards & Search) */}
      {!activeTeacher && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: '#E6F1FB', color: '#185FA5', borderRadius: '16px', fontSize: '28px', marginBottom: '1rem', boxShadow: '0 4px 15px rgba(24,95,165,0.15)' }}>
                    <i className="ti ti-radar"></i>
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>Educator Connect</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>Connect with your teachers via their EXT Code to track scheduled exams.</p>
            </div>

            {/* 🔍 EXT CODE SEARCH */}
            <div className="card" style={{ padding: '1rem', borderRadius: '16px', display: 'flex', gap: '10px', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.03)', border: '1px solid #e2e8f0', marginBottom: '2.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <i className="ti ti-hash" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#185FA5', fontSize: '20px' }}></i>
                    <input 
                        type="text" 
                        placeholder="Enter Educator Code (e.g. EXT-123456)" 
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchEducator()}
                        style={{ width: '100%', padding: '12px 12px 12px 45px', border: 'none', background: '#f8fafc', borderRadius: '10px', fontSize: '15px', fontWeight: 600, outline: 'none', letterSpacing: '1px', textTransform: 'uppercase' }}
                    />
                </div>
                <button className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 700 }} onClick={handleSearchEducator} disabled={isSearching}>
                    {isSearching ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></div> : 'Find'}
                </button>
            </div>

            {/* 🟢 SEARCH RESULT CARD */}
            {searchResult && (
                <div style={{ background: '#fff', border: '2px solid #185FA5', borderRadius: '16px', padding: '1.5rem', marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'slideUp 0.3s ease', boxShadow: '0 10px 30px rgba(24,95,165,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '50px', height: '50px', background: '#185FA5', color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800 }}>
                            {searchResult.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{searchResult.name} <i className="ti ti-circle-check-filled text-blue" style={{ fontSize: '16px' }}></i></div>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, fontFamily: 'monospace', marginTop: '2px' }}><i className="ti ti-id"></i> {searchResult.code}</div>
                        </div>
                    </div>
                    <button className="btn btn-success" style={{ fontWeight: 700, padding: '10px 20px', borderRadius: '10px' }} onClick={handleFollow}>
                        <i className="ti ti-user-plus"></i> Connect
                    </button>
                </div>
            )}

            {/* 🏫 CONNECTED EDUCATORS GRID */}
            <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
                <i className="ti ti-users text-blue"></i> My Educators
            </h3>

            {isFetching ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                    {[1, 2, 3].map(n => <div key={n} className="skeleton" style={{ height: '100px', borderRadius: '16px' }}></div>)}
                </div>
            ) : educatorProfiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                    <i className="ti ti-school" style={{ fontSize: '48px', color: '#cbd5e1', display: 'block', marginBottom: '1rem' }}></i>
                    <h4 style={{ color: '#475569', marginBottom: '5px', fontSize: '16px' }}>Not connected to any educator</h4>
                    <p style={{ color: '#94a3b8', fontSize: '13px', maxWidth: '300px', margin: '0 auto' }}>Enter an EXT code above to connect with your teacher.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                    {educatorProfiles.map(prof => {
                        const activeExamsCount = allRadarTests.filter(t => t.creatorUid === prof.uid).length;
                        
                        return (
                            <div key={prof.uid} className="card" style={{ padding: '1.25rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #e2e8f0' }} onClick={() => setActiveTeacher(prof)} onMouseOver={e => e.currentTarget.style.borderColor = '#185FA5'} onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                                <div style={{ width: '45px', height: '45px', background: '#E6F1FB', color: '#185FA5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
                                    {prof.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{prof.name}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>{prof.code}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className={`badge ${activeExamsCount > 0 ? 'b-green' : 'b-gray'}`} style={{ padding: '4px 8px', fontSize: '11px' }}>
                                        {activeExamsCount} {activeExamsCount === 1 ? 'Exam' : 'Exams'}
                                    </div>
                                </div>
                                <i className="ti ti-chevron-right" style={{ color: '#94a3b8' }}></i>
                            </div>
                        );
                    })}
                </div>
            )}
          </>
      )}

      {/* 📊 VIEW 2: TEACHER SPECIFIC FEED (Detail View) */}
      {activeTeacher && (
          <div style={{ animation: 'slideInRight 0.3s ease' }}>
              <button className="btn btn-ghost" style={{ padding: '8px 12px', marginBottom: '1.5rem', background: '#f8fafc', fontWeight: 600 }} onClick={() => setActiveTeacher(null)}>
                  <i className="ti ti-arrow-left"></i> Back to Educators
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem', padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '56px', height: '56px', background: '#185FA5', color: '#fff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 800 }}>
                      {activeTeacher.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>{activeTeacher.name}</h2>
                      <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}><i className="ti ti-id"></i> {activeTeacher.code}</div>
                  </div>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>Active & Upcoming Exams</h3>
              
              {(() => {
                  const teacherExams = allRadarTests.filter(t => t.creatorUid === activeTeacher.uid);
                  
                  if (teacherExams.length === 0) {
                      return (
                          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                              <i className="ti ti-calendar-off" style={{ fontSize: '48px', color: '#cbd5e1', display: 'block', marginBottom: '1rem' }}></i>
                              <h4 style={{ color: '#475569', marginBottom: '5px', fontSize: '16px' }}>No exams scheduled</h4>
                              <p style={{ color: '#94a3b8', fontSize: '13px' }}>There are currently no active or upcoming exams from this educator.</p>
                          </div>
                      );
                  }

                  return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {teacherExams.map((test) => {
                              const status = getExamStatus(test);
                              
                              return (
                                  <div key={test.id} className="card" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: `6px solid ${status === 'live' ? '#10B981' : status === 'upcoming' ? '#f59e0b' : '#cbd5e1'}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                      
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{test.title}</h4>
                                          {status === 'live' && <span className="badge b-green" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px' }}><span style={{ width: '6px', height: '6px', background: '#27500A', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span> LIVE NOW</span>}
                                          {status === 'upcoming' && <span className="badge b-amber" style={{ padding: '4px 10px', fontSize: '12px' }}><i className="ti ti-clock"></i> UPCOMING</span>}
                                          {status === 'closed' && <span className="badge b-gray" style={{ padding: '4px 10px', fontSize: '12px' }}>CLOSED</span>}
                                      </div>

                                      <div style={{ display: 'flex', gap: '15px', fontSize: '13px', color: '#475569', fontWeight: 500, flexWrap: 'wrap' }}>
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-book text-base"></i> {test.subject || 'General'}</span>
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-clock text-base"></i> {test.duration} Mins</span>
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-target text-base"></i> {test.totalMarks} Marks</span>
                                      </div>

                                      {/* 🔥 NAYA: TEACHER NOTE DISPLAY */}
                                      {test.radarNote && (
                                          <div style={{ background: '#FFFBEB', borderLeft: '4px solid #F59E0B', padding: '10px 12px', borderRadius: '4px', fontSize: '13px', color: '#92400E', fontWeight: 500 }}>
                                              <i className="ti ti-pin" style={{ marginRight: '6px' }}></i>
                                              {test.radarNote}
                                          </div>
                                      )}

                                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                          
                                          {status === 'upcoming' ? (
                                              <div style={{ fontSize: '13px', color: '#854F0B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <i className="ti ti-calendar-time" style={{ fontSize: '16px' }}></i> Opens: {formatScheduleTime(test.openDate)}
                                              </div>
                                          ) : status === 'live' ? (
                                              <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <i className="ti ti-key text-blue" style={{ fontSize: '16px' }}></i> Need entry code to start
                                              </div>
                                          ) : (
                                              <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
                                                  Intake has been closed.
                                              </div>
                                          )}

                                          {status === 'live' ? (
                                              <button className="btn btn-primary" style={{ padding: '8px 16px', fontWeight: 600, borderRadius: '8px' }} onClick={() => router.push('/student')}>
                                                  Enter Code & Join
                                              </button>
                                          ) : status === 'upcoming' ? (
                                              <button className="btn" style={{ padding: '8px 16px', fontWeight: 600, borderRadius: '8px', background: '#e2e8f0', color: '#64748b', border: 'none', cursor: 'not-allowed' }}>
                                                  <i className="ti ti-lock"></i> Locked
                                              </button>
                                          ) : null}
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  );
              })()}
          </div>
      )}

      {/* SYSTEM ALERTS */}
      {sysAlert && (
          <div className="modal-bg" style={{ zIndex: 9999 }}>
              <div className="modal-box" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', background: sysAlert.type === 'success' ? '#EAF3DE' : sysAlert.type === 'error' ? '#FCEBEB' : '#FEF5E5', color: sysAlert.type === 'success' ? '#3B6D11' : sysAlert.type === 'error' ? '#A32D2D' : '#d97706' }}>
                      <i className={`ti ${sysAlert.type === 'success' ? 'ti-check' : sysAlert.type === 'error' ? 'ti-x' : 'ti-info-circle'}`}></i>
                  </div>
                  <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>{sysAlert.title}</h3>
                  <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>{sysAlert.msg}</p>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => setSysAlert(null)}>Okay</button>
              </div>
          </div>
      )}

    </div>
  );
}