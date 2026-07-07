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

  const [isMounted, setIsMounted] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  const [followedEducators, setFollowedEducators] = useState([]); 
  const [educatorProfiles, setEducatorProfiles] = useState([]); 
  const [allRadarTests, setAllRadarTests] = useState([]); 
  
  const [activeTeacher, setActiveTeacher] = useState(null); 
  
  const [searchId, setSearchId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [sysAlert, setSysAlert] = useState(null);

  useEffect(() => { setIsMounted(true); }, []);

  const fetchRadarData = useCallback(async () => {
      if (!currentUser?.uid) return;
      setIsFetching(true);
      try {
          const studentSnap = await get(ref(database, `users/${currentUser.uid}/followed`));
          const followedList = studentSnap.val() || [];
          setFollowedEducators(followedList);

          if (followedList.length === 0) {
              setIsFetching(false);
              return;
          }

          const usersSnap = await get(ref(database, 'users'));
          const allUsers = usersSnap.val() || {};
          let profiles = [];
          
          followedList.forEach(uid => {
              if (allUsers[uid]) {
                  const u = allUsers[uid];
                  profiles.push({ 
                      uid, 
                      name: u.name || 'Educator', 
                      code: u.examinerId || u.rollNo || u.examinerCode || 'N/A',
                      email: u.email
                  });
              }
          });
          setEducatorProfiles(profiles);

          const testsSnap = await get(ref(database, 'tests'));
          const allTests = testsSnap.val() || [];
          let feed = [];

          allTests.forEach(test => {
              // STRICT TRUE CHECK
              if (test && followedList.includes(test.creatorUid) && test.radarVisible === true) {
                  if (test.expiryDate) {
                      const expiryTime = new Date(test.expiryDate).getTime();
                      if (Date.now() - expiryTime > 18 * 60 * 60 * 1000) return; 
                  }
                  feed.push(test);
              }
          });

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
              const dbCode = (u.examinerId || u.rollNo || u.examinerCode || '').toUpperCase();
              
              if (u.role === 'examiner' && dbCode === searchUpper) {
                  found = { uid, name: u.name || 'Educator', code: dbCode };
              }
          });

          if (found) setSearchResult(found);
          else setSysAlert({ title: 'Not Found', msg: 'No educator found with this EXT code.', type: 'error' });
          
      } catch (error) {
          setSysAlert({ title: 'Error', msg: 'Network error during search.', type: 'error' });
      } finally {
          setIsSearching(false);
      }
  };

  const handleFollow = async () => {
      if (!searchResult || !currentUser?.uid) return;
      
      if (followedEducators.includes(searchResult.uid)) {
          setSysAlert({ title: 'Connected', msg: 'You are already following this educator.', type: 'info' });
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
      const closeTime = test.closeDate ? new Date(test.closeDate).getTime() : (test.expiryDate ? new Date(test.expiryDate).getTime() : null);

      if (openTime && now < openTime) return 'upcoming';
      if (test.isActive === false || (closeTime && now > closeTime)) return 'closed';
      return 'live';
  };

  const formatScheduleTime = (dateString) => {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

 // 🔥 ASALI DIRECT JOIN ENGINE
  const handleJoinClick = async (test) => {
      if (test.directEntry) {
          try {
              // 1. Database se fresh check karo ki bacche ne Roll No save kiya hai ya nahi (No Cache Issues)
              const userSnap = await get(ref(database, `users/${currentUser.uid}`));
              const userData = userSnap.val() || {};

              if (!userData.rollNo || userData.rollNo.trim() === '') {
                  // Agar Roll No nahi hai, toh alert do
                  setSysAlert({ 
                      title: 'Roll Number Missing! 🚨', 
                      msg: 'To use Direct Join, please click the Settings icon (top right) ⚙️ -> My Profile, and save your Roll Number first.', 
                      type: 'warning' 
                  });
                  return;
              }

              // 2. Sab theek hai toh seedha Student Live Exam route par URL params ke sath push karo
              router.push(`/student?code=${test.code}&autoJoin=true`);
              
          } catch (error) {
              setSysAlert({ title: 'Error', msg: 'Failed to verify profile.', type: 'error' });
          }
      } else {
          // Normal route (Bina code ke)
          router.push(`/student`); 
      }
  };


  if (!isMounted || authLoading) return null;
  if (!currentUser) return <div style={{ textAlign: 'center', padding: '4rem' }}>Please login to access your Radar.</div>;

  return (
    <div style={{ padding: '2rem 1.25rem', maxWidth: '850px', margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      
      {/* 🛡️ VIEW 1: MASTER LIST */}
      {!activeTeacher && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '2rem' }}>
                <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #185FA5, #3C3489)', color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', boxShadow: '0 4px 15px rgba(24,95,165,0.2)' }}>
                    <i className="ti ti-radar"></i>
                </div>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>Educator Connect</h1>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Follow your teachers to get exams directly on your radar.</p>
                </div>
            </div>

            {/* 🔍 COMPACT SEARCH (WITH CLEAR BUG FIX) */}
            <div style={{ background: '#fff', padding: '8px', borderRadius: '12px', display: 'flex', gap: '8px', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <i className="ti ti-hash" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#185FA5', fontSize: '18px' }}></i>
                    <input 
                        type="text" 
                        placeholder="Enter Code (e.g. EXT-1TIR)" 
                        value={searchId}
                        onChange={(e) => {
                            setSearchId(e.target.value.toUpperCase());
                            if (e.target.value.trim() === '') setSearchResult(null); // Auto clear result
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchEducator()}
                        style={{ width: '100%', padding: '10px 30px 10px 38px', border: 'none', background: '#f8fafc', borderRadius: '8px', fontSize: '14px', fontWeight: 600, outline: 'none', textTransform: 'uppercase' }}
                    />
                    {/* Clear Cross Icon */}
                    {searchId && (
                        <i className="ti ti-x" 
                           style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }} 
                           onClick={() => { setSearchId(''); setSearchResult(null); }}
                        ></i>
                    )}
                </div>
                <button className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px' }} onClick={handleSearchEducator} disabled={isSearching || !searchId.trim()}>
                    {isSearching ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div> : 'Find'}
                </button>
            </div>

            {searchResult && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'slideDown 0.2s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '42px', height: '42px', background: '#0284c7', color: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
                            {searchResult.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>{searchResult.name} <i className="ti ti-circle-check-filled text-blue" style={{ fontSize: '14px' }}></i></div>
                            <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600, fontFamily: 'monospace' }}>{searchResult.code}</div>
                        </div>
                    </div>
                    <button className="btn btn-sm" style={{ background: '#0284c7', color: '#fff', fontWeight: 700, borderRadius: '8px', padding: '8px 16px', border: 'none' }} onClick={handleFollow}>
                        Connect
                    </button>
                </div>
            )}

            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                Your Network
            </h3>

            {isFetching ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                    {[1, 2, 3].map(n => <div key={n} className="skeleton" style={{ height: '70px', borderRadius: '12px' }}></div>)}
                </div>
            ) : educatorProfiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <i className="ti ti-users-plus" style={{ fontSize: '40px', color: '#cbd5e1', marginBottom: '1rem' }}></i>
                    <h4 style={{ color: '#475569', fontSize: '15px', margin: '0 0 4px 0' }}>No connections yet</h4>
                    <p style={{ color: '#94a3b8', fontSize: '13px' }}>Enter an EXT code above to follow a teacher.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {educatorProfiles.map(prof => {
                        const activeExamsCount = allRadarTests.filter(t => t.creatorUid === prof.uid).length;
                        
                        return (
                            <div key={prof.uid} style={{ background: '#fff', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.2s', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onClick={() => setActiveTeacher(prof)} onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(24,95,165,0.08)'} onMouseOut={e => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'}>
                                <div style={{ width: '40px', height: '40px', background: '#f1f5f9', color: '#185FA5', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800 }}>
                                    {prof.name.charAt(0).toUpperCase()}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prof.name}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>{prof.code}</div>
                                </div>
                                <div className={`badge ${activeExamsCount > 0 ? 'b-blue' : 'b-gray'}`} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}>
                                    {activeExamsCount} {activeExamsCount === 1 ? 'Test' : 'Tests'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
          </>
      )}

      {/* 📊 VIEW 2: COMPACT TEACHER SPECIFIC FEED */}
      {activeTeacher && (
          <div style={{ animation: 'fadeInRight 0.2s ease' }}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', marginBottom: '1.5rem', background: '#f8fafc', fontSize: '13px', fontWeight: 600 }} onClick={() => setActiveTeacher(null)}>
                  <i className="ti ti-arrow-left"></i> Back
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1.5rem' }}>
                  <div style={{ width: '48px', height: '48px', background: '#185FA5', color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800 }}>
                      {activeTeacher.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                      <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>{activeTeacher.name}</h2>
                      <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, fontFamily: 'monospace' }}>{activeTeacher.code}</div>
                  </div>
              </div>

              {(() => {
                  const teacherExams = allRadarTests.filter(t => t.creatorUid === activeTeacher.uid);
                  
                  if (teacherExams.length === 0) {
                      return (
                          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                              <i className="ti ti-calendar-off" style={{ fontSize: '40px', color: '#cbd5e1', marginBottom: '1rem' }}></i>
                              <h4 style={{ color: '#475569', margin: '0 0 4px 0', fontSize: '15px' }}>No scheduled exams</h4>
                              <p style={{ color: '#94a3b8', fontSize: '13px' }}>Exams created by this educator will appear here.</p>
                          </div>
                      );
                  }

                  return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {teacherExams.map((test) => {
                              const status = getExamStatus(test);
                              
                              return (
                                  <div key={test.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', transition: 'border-color 0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor = status === 'live' ? '#10B981' : '#e2e8f0'} onMouseOut={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                                      
                                      {/* Soft Premium Top Border */}
                                      <div style={{ height: '4px', background: status === 'live' ? '#10B981' : status === 'upcoming' ? '#F59E0B' : '#cbd5e1' }}></div>
                                      
                                      <div style={{ padding: '1rem 1.25rem' }}>
                                          {test.radarNote && (
                                              <div style={{ background: '#FEF3C7', padding: '6px 10px', borderRadius: '6px', fontSize: '12px', color: '#92400E', fontWeight: 600, marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                                  <i className="ti ti-pin" style={{ marginTop: '2px' }}></i> {test.radarNote}
                                              </div>
                                          )}
                                          
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                              <div style={{ flex: 1 }}>
                                                  <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>{test.title}</h4>
                                                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b', fontWeight: 600, flexWrap: 'wrap' }}>
                                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-book"></i> {test.subject || 'General'}</span>
                                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-clock"></i> {test.duration} Mins</span>
                                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-target"></i> {test.totalMarks} Marks</span>
                                                  </div>
                                              </div>

                                              {status === 'live' && <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #a7f3d0' }}><span style={{ width: '6px', height: '6px', background: '#10B981', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span> LIVE</span>}
                                              {status === 'upcoming' && <span style={{ background: '#fffbeb', color: '#d97706', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, border: '1px solid #fde68a' }}><i className="ti ti-calendar"></i> UPCOMING</span>}
                                              {status === 'closed' && <span style={{ background: '#f8fafc', color: '#64748b', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, border: '1px solid #e2e8f0' }}>CLOSED</span>}
                                          </div>

                                          <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                              
                                              {status === 'upcoming' ? (
                                                  <div style={{ fontSize: '12px', color: '#854F0B', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                      <i className="ti ti-calendar-time" style={{ fontSize: '14px' }}></i> Opens: {formatScheduleTime(test.openDate)}
                                                  </div>
                                              ) : status === 'live' ? (
                                                  <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                      <i className="ti ti-key text-blue" style={{ fontSize: '14px' }}></i> Entry: {test.directEntry ? 'No Code Required' : 'Code Required'}
                                                  </div>
                                              ) : (
                                                  <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                                                      Intake window closed.
                                                  </div>
                                              )}

                                              {status === 'live' ? (
                                                  <button 
                                                      className="btn btn-sm" 
                                                      style={{ padding: '6px 14px', fontWeight: 700, borderRadius: '6px', background: test.directEntry ? 'linear-gradient(to right, #10B981, #059669)' : '#185FA5', color: '#fff', border: 'none' }} 
                                                      onClick={() => handleJoinClick(test)}
                                                  >
                                                      {test.directEntry ? <><i className="ti ti-bolt"></i> Direct Join</> : 'Enter Code'}
                                                  </button>
                                              ) : status === 'upcoming' ? (
                                                  <button className="btn btn-sm" style={{ padding: '6px 14px', fontWeight: 600, borderRadius: '6px', background: '#f1f5f9', color: '#94a3b8', border: 'none', cursor: 'not-allowed' }}>
                                                      <i className="ti ti-lock"></i> Locked
                                                  </button>
                                              ) : null}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  );
              })()}
          </div>
      )}

      {sysAlert && (
          <div className="modal-bg" style={{ zIndex: 9999 }}>
              <div className="modal-box" style={{ maxWidth: '350px', textAlign: 'center', padding: '2rem 1.5rem', borderRadius: '16px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', background: sysAlert.type === 'success' ? '#ecfdf5' : sysAlert.type === 'error' ? '#fef2f2' : '#fffbeb', color: sysAlert.type === 'success' ? '#059669' : sysAlert.type === 'error' ? '#dc2626' : '#d97706' }}>
                      <i className={`ti ${sysAlert.type === 'success' ? 'ti-check' : sysAlert.type === 'error' ? 'ti-x' : 'ti-info-circle'}`}></i>
                  </div>
                  <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{sysAlert.title}</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '1.5rem', lineHeight: 1.5 }}>{sysAlert.msg}</p>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', borderRadius: '8px' }} onClick={() => setSysAlert(null)}>Okay</button>
              </div>
          </div>
      )}

    </div>
  );
}