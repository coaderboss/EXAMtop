// src/app/layout.js
'use client'; 
import './globals.css';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { database } from '../lib/firebase';
import { ref, update, remove } from 'firebase/database';


function Header() {
  const { currentUser, userRole, loginWithGoogle, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  
  
  // Modals & Theme State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // Profile States
  const [showProfile, setShowProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ college: '', phone: '' });
  const settingsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setIsSettingsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      setIsDarkMode(true);
    }
  }, []);

  const toggleDarkMode = () => {
    const body = document.documentElement;
    if (body.getAttribute('data-theme') === 'dark') {
      body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
    setIsSettingsOpen(false); 
  };

  // 🔥 LOGIN REDIRECT FIX
  const handleLogin = async (role) => {
      try {
          await loginWithGoogle(role);
          if (role === 'examiner' || role === 'admin') router.push('/tests');
          else router.push('/student-dashboard');
      } catch (error) {
          console.error("Login Failed", error);
      }
  };

  const handleLogout = async () => {
      await logout();
      setShowProfile(false);
      setIsSettingsOpen(false);
      router.push('/');
  };

  // 🔥 PROFILE SAVE & DELETE FIX
  const saveProfile = async () => {
      if (!currentUser) return;
      try {
          await update(ref(database, `users/${currentUser.uid}`), {
              college: profileData.college,
              phone: profileData.phone
          });
          setIsEditingProfile(false);
          alert("Profile updated successfully!");
      } catch (e) { alert("Failed to update profile."); }
  };

  const deleteAccount = async () => {
      if (confirm("DANGER: Are you absolutely sure you want to permanently delete your account? All your data will be lost.")) {
          try {
              await remove(ref(database, `users/${currentUser.uid}`));
              if(currentUser.delete) await currentUser.delete();
              else await logout(); 
              
              setShowProfile(false);
              router.push('/');
              alert("Account deleted successfully.");
          } catch (e) { alert("Failed to delete account. You may need to re-login first."); }
      }
  };

  // 🔥 HIGHLY DETAILED INSTRUCTIONS
  const getPageInstructions = () => {
    switch(pathname) {
        case '/student': return { 
            title: 'Live Exam Engine Guide', 
            content: <><p style={{ marginBottom: '10px' }}>Welcome to the Secure Exam Engine. This interface is heavily monitored to ensure fair play.</p><ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}><li><strong>Anti-Cheat Active:</strong> Do NOT switch tabs, minimize the browser, or exit full-screen mode. Doing so will trigger warnings and auto-submit your exam.</li><li><strong>Question Palette:</strong> Use the right-side grid to jump between questions. Colors indicate status (Blue = Answered, Yellow = Marked for Review).</li><li><strong>Timer:</strong> Keep an eye on the top-right clock. The paper will auto-submit when time is up.</li></ul></>
        };
        case '/create': return { 
            title: 'Test Creator Masterclass', 
            content: <><p style={{ marginBottom: '10px' }}>This is your canvas to build professional-grade assessments.</p><ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}><li><strong>Basic Config:</strong> Set strict limits using Duration, Total Marks, and Expiry Dates.</li><li><strong>Result Visibility:</strong> Choose 'Instant' if you want students to see their score immediately, or 'Manual' if you have subjective questions.</li><li><strong>MathJax Support:</strong> Type complex equations in question fields, and they will auto-render.</li></ul></>
        };
        case '/tests': return { 
            title: 'Examiner Vault Operations', 
            content: <><p style={{ marginBottom: '10px' }}>Manage all your created tests and evaluate student submissions.</p><ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}><li><strong>Live/Closed Toggle:</strong> Instantly stop accepting new submissions.</li><li><strong>Smart Re-keying:</strong> Click "Edit Key", fix the answer, and instantly re-grade all past submissions.</li><li><strong>Manual Evaluation:</strong> Click "Evaluate" to override auto-graded marks.</li></ul></>
        };
        case '/arena': return { 
            title: 'Practice Arena Guide', 
            content: <><p style={{ marginBottom: '10px' }}>Sharpen your logical building skills.</p><ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}><li><strong>General Mode:</strong> Pick a standard subject template.</li><li><strong>Gemini AI Mode:</strong> Enter any specific topic, and our AI will generate a custom mock test.</li></ul></>
        };
        case '/admin': return { 
            title: 'God Mode Guide', 
            content: <><p style={{ marginBottom: '10px', color: '#A32D2D', fontWeight: 'bold' }}>WARNING: You are in Root Access Mode.</p><ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}><li><strong>User Matrix:</strong> Change any user's role to Admin/Examiner.</li><li><strong>Global Vault:</strong> Delete individual submissions or nuke entire tests.</li><li><strong>Kill Switch:</strong> Instantly halt all active exams platform-wide.</li></ul></>
        };
        default: return { 
            title: 'ExamiTop Portal Overview', 
            content: <><p style={{ marginBottom: '10px' }}>Welcome to the most secure assessment platform.</p><ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}><li>Use the top navigation bar to switch between tabs.</li><li>Click on your Profile icon to update details or logout.</li><li>Use the Settings (Gear) icon to toggle Dark Mode.</li></ul></>
        };
    }
  };
  const info = getPageInstructions();

  const renderNavTabs = () => {
    if (userRole === 'student') {
        return (
            <>
                <Link href="/student-dashboard" className={`nav-tab ${pathname === '/student-dashboard' ? 'active' : ''}`}><i className="ti ti-chart-pie"></i> Dashboard</Link>
                <Link href="/student" className={`nav-tab ${pathname === '/student' ? 'active' : ''}`}><i className="ti ti-school"></i> Join Test</Link>
                <Link href="/arena" className={`nav-tab ${pathname === '/arena' ? 'active' : ''}`}><i className="ti ti-swords"></i> Practice Arena</Link>
                <Link href="/student-results" className={`nav-tab ${pathname === '/student-results' ? 'active' : ''}`}><i className="ti ti-history"></i> My Results</Link>
            </>
        );
    } else if (userRole === 'examiner') {
        return (
            <>
                <Link href="/tests" className={`nav-tab ${pathname === '/tests' ? 'active' : ''}`}><i className="ti ti-list-check"></i> My Vault</Link>
                <Link href="/create" className={`nav-tab ${pathname === '/create' ? 'active' : ''}`}><i className="ti ti-pencil"></i> Create Test</Link>
                <Link href="/results" className={`nav-tab ${pathname === '/results' ? 'active' : ''}`}><i className="ti ti-world"></i> Global Results</Link>
            </>
        );
    } else if (userRole === 'admin') {
        return <Link href="/admin" className={`nav-tab ${pathname === '/admin' ? 'active' : ''}`} style={{ color: '#A32D2D', fontWeight: 700 }}><i className="ti ti-crown"></i> God Mode</Link>;
    } else if (userRole === 'guest') {
        return <Link href="/student" className={`nav-tab ${pathname === '/student' ? 'active' : ''}`}><i className="ti ti-school"></i> Join Test</Link>;
    }
    return null;
  };

  return (
    <>
        <div className="app-header" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--color-background-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div className="app-header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-secondary)', padding: '12px 20px' }}>
                
                <Link href="/" className="logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>  
                    <div style={{ background: '#185FA5', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>E</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text-primary)' }}>Exami<span style={{ color: '#185FA5' }}>Top</span></div>
                </Link>
                
                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
                    <div style={{ position: 'relative' }} ref={settingsRef}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setIsSettingsOpen(!isSettingsOpen)} style={{ borderRadius: '50%', width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-background-secondary)', border: '1px solid var(--color-border-secondary)' }}>
                            <i className="ti ti-settings" style={{ fontSize: '22px', margin: 0, color: 'var(--color-text-primary)' }}></i>
                        </button>
                        
                        {isSettingsOpen && (
                            <div style={{ position: 'absolute', right: 0, top: '48px', width: '180px', background: 'var(--color-background-primary)', border: '1px solid var(--color-border-secondary)', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
                                <button onClick={toggleDarkMode} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-secondary)', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 600 }}>
                                    <i className={`ti ${isDarkMode ? 'ti-sun' : 'ti-moon'}`} style={{ fontSize: '18px', color: '#185FA5' }}></i> <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
                                </button>
                                <button onClick={() => { setShowInfo(true); setIsSettingsOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--color-border-secondary)', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 600 }}>
                                    <i className="ti ti-info-circle" style={{ fontSize: '18px', color: '#3B6D11' }}></i> Page Guide
                                </button>
                                {currentUser && userRole !== 'guest' && (
                                    <button onClick={() => { setShowProfile(true); setIsSettingsOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 600 }}>
                                        <i className="ti ti-user-circle" style={{ fontSize: '18px', color: '#854F0B' }}></i> My Profile
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {currentUser ? (
                        <button onClick={handleLogout} className="btn btn-sm btn-danger" style={{ padding: '8px 16px', fontWeight: 600 }}>
                            <i className="ti ti-logout" style={{ fontSize: '18px', margin: 0 }}></i> <span className="hide-mobile" style={{ marginLeft: '6px' }}>Logout</span>
                        </button>
                    ) : (
                        <button onClick={() => handleLogin('student')} className="btn btn-sm btn-primary" style={{ padding: '8px 16px', fontWeight: 600 }}>
                            <i className="ti ti-brand-google" style={{ fontSize: '18px', margin: 0 }}></i> <span className="hide-mobile" style={{ marginLeft: '6px' }}>Login</span>
                        </button>
                    )}
                </div>
            </div>

            {userRole && userRole !== 'guest' && (
                <div id="dynamic-nav-wrapper" style={{ background: 'var(--color-background-secondary)', overflowX: 'auto', borderBottom: '1px solid var(--color-border-secondary)', scrollbarWidth: 'none' }}>
                    <div className="nav-tabs" id="dynamic-nav-tabs" style={{ display: 'flex', gap: '8px', padding: '10px 20px', width: 'max-content', margin: '0 auto' }}>
                        {renderNavTabs()}
                    </div>
                </div>
            )}
        </div>

        {/* 🔥 DETAILED INFO MODAL */}
        {showInfo && (
            <div className="modal-bg" style={{ zIndex: 99999 }}>
                <div className="modal-box" style={{ maxWidth: '550px', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border-secondary)', paddingBottom: '10px' }}>
                        <h3 style={{ margin: 0, color: '#185FA5', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px' }}><i className="ti ti-bulb"></i> {info.title}</h3>
                        <button className="btn btn-sm btn-ghost" onClick={() => setShowInfo(false)}><i className="ti ti-x" style={{ fontSize: '20px' }}></i></button>
                    </div>
                    <div style={{ background: 'var(--color-background-secondary)', padding: '1.5rem', borderRadius: '10px', border: '1px solid var(--color-border-secondary)', color: 'var(--color-text-primary)', fontSize: '15px', lineHeight: 1.6 }}>
                        {info.content}
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', padding: '14px', fontSize: '16px', justifyContent: 'center' }} onClick={() => setShowInfo(false)}>Understood</button>
                </div>
            </div>
        )}

        {/* 🔥 ADVANCED PROFILE MODAL */}
        {showProfile && currentUser && (
            <div className="modal-bg" style={{ zIndex: 99999 }}>
                <div className="modal-box" style={{ maxWidth: '450px', padding: '2.5rem 2rem', textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, #185FA5, #3C3489)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 800, margin: '0 auto 1rem', boxShadow: '0 4px 15px rgba(24,95,165,0.3)' }}>
                        {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    
                    <h3 style={{ margin: '0 0 5px 0', fontSize: '24px', color: 'var(--color-text-primary)' }}>{currentUser.displayName || 'Platform User'}</h3>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '1.5rem', fontFamily: 'monospace' }}>{currentUser.email}</div>
                    
                    {!isEditingProfile ? (
                        <>
                            <div style={{ background: 'var(--color-background-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-border-secondary)', textAlign: 'left', marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Role</div>
                                <div style={{ fontWeight: 700, color: '#185FA5', textTransform: 'uppercase', marginBottom: '12px' }}>{userRole}</div>
                                
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Institution / College</div>
                                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>{profileData.college || 'Not specified'}</div>
                                
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Phone Number</div>
                                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{profileData.phone || 'Not specified'}</div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                                <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '12px', fontWeight: 600 }} onClick={() => setShowProfile(false)}>Close</button>
                                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px', fontWeight: 600 }} onClick={() => setIsEditingProfile(true)}><i className="ti ti-edit"></i> Edit Details</button>
                            </div>
                            
                            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', color: '#A32D2D', padding: '10px', fontSize: '13px', fontWeight: 600 }} onClick={deleteAccount}>
                                <i className="ti ti-trash"></i> Permanently Delete Account
                            </button>
                        </>
                    ) : (
                        <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '14px', fontWeight: 600 }}>Institution / College Name</label>
                            <input type="text" placeholder="e.g. UIET Kanpur" value={profileData.college} onChange={e => setProfileData({...profileData, college: e.target.value})} style={{ marginBottom: '1rem', width: '100%', padding: '10px', borderRadius: '8px' }} />
                            
                            <label style={{ fontSize: '14px', fontWeight: 600 }}>Phone Number</label>
                            <input type="text" placeholder="+91 XXXXX XXXXX" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} style={{ marginBottom: '1.5rem', width: '100%', padding: '10px', borderRadius: '8px' }} />
                            
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={() => setIsEditingProfile(false)}>Cancel</button>
                                <button className="btn btn-success" style={{ flex: 1, justifyContent: 'center', padding: '12px' }} onClick={saveProfile}><i className="ti ti-device-floppy"></i> Save Info</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
    </>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>ExamiTop | Secure Assessment Platform</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
        
        {/* PWA Manifest aur Theme Color yahan direct HTML style me daal do */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#185FA5" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      
      <body suppressHydrationWarning>
        <AuthProvider>
          <DataProvider>
            <Header />
            <div id="app-viewport" style={{ width: '100%', minHeight: '80vh' }}>
                {children}
            </div>
            <div id="toast-container"></div>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
