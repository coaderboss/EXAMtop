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
import Script from 'next/script';

function Header() {
  const { currentUser, userRole, loginWithGoogle, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  
  
// Modals & Theme State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState(null); 
  
  // Profile States
  const [showProfile, setShowProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ college: '', phone: '', rollNo: '' });
  const settingsRef = useRef(null);

  //  1. CLEAN SHUTTER STATES & REFS
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0); 
  const isAnimating = useRef(false); //  FIX: Layout Jump Lock (Fake scroll ko rokne ke liye)
  const navState = useRef(true);     //  FIX: Direct memory state

  //  2. ANTI-FLICKER SCROLL ENGINE (With Animation Lock & Short-Page Guard)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
        const currentScrollY = window.scrollY;
        // Total kitna scroll ho sakta hai wo nikala
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

        // 🛡️ GUARD 1: SHORT PAGE PROTECTION
        // Agar page me thik se scroll karne ki jagah hi nahi hai, toh chhedo hi mat
        if (maxScroll < 150) {
            if (!navState.current) { 
                navState.current = true; 
                setIsNavVisible(true); 
            }
            return;
        }

        // 🛡️ GUARD 2: TOP BOUNCE PROTECTION 
        // Ekdum top par hamesha dikhao (Mobile bounce fix)
        if (currentScrollY <= 60) {
            if (!navState.current) { 
                navState.current = true; 
                setIsNavVisible(true); 
            }
            lastScrollY.current = currentScrollY;
            return;
        }

        // 🛡️ GUARD 3: THE ANIMATION LOCK 
        // Jab navbar band/khul raha ho, uske layout jump (fake scroll) ko puri tarah ignore karo
        if (isAnimating.current) {
            lastScrollY.current = currentScrollY; // Base update karte raho taaki lock khulte hi jhatka na lage
            return;
        }

        const distance = currentScrollY - lastScrollY.current;

        // 🛡️ SMART THRESHOLD TRIGGERS (20px ka solid finger swipe chahiye)
        if (distance > 20 && navState.current) {
            // Scroll Down -> Hide
            isAnimating.current = true;
            navState.current = false;
            setIsNavVisible(false);
            setTimeout(() => { isAnimating.current = false; }, 400); // 400ms ka strict lock

        } else if (distance < -20 && !navState.current) {
            // Scroll Up -> Show
            isAnimating.current = true;
            navState.current = true;
            setIsNavVisible(true);
            setTimeout(() => { isAnimating.current = false; }, 400); // 400ms ka strict lock
        }
        
        lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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

  //  LOGIN REDIRECT FIX
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

  //  THE TOAST HELPER FUNCTION
  const showToast = (msg, type = 'success') => {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = type === 'success' ? `<i class="ti ti-check" style="font-size:18px;"></i> ${msg}` : `<i class="ti ti-alert-triangle" style="font-size:18px;"></i> ${msg}`;
      container.appendChild(toast);
      setTimeout(() => { if (container.contains(toast)) toast.remove(); }, 3000);
  };
   
  // 🔥 PROFILE SAVE FUNCTION (Jo miss ho gaya tha)
  const saveProfile = async () => {
      if (!currentUser) return;
      try {
          await update(ref(database, `users/${currentUser.uid}`), {
              college: profileData.college,
              phone: profileData.phone,
              rollNo: profileData.rollNo
          });
          setIsEditingProfile(false);
          showToast("Profile updated successfully!", "success");
      } catch (e) { 
          showToast("Failed to update profile.", "error"); 
      }
  };

  //  DELETE ACCOUNT FIX (Replaced alert with toast, kept confirm as it's a DANGER zone)
  const deleteAccount = async () => {
      // Confirm browser wala hi theek hai yahan taaki galti se delete na ho
      if (window.confirm("DANGER: Are you absolutely sure you want to permanently delete your account? All your data will be lost.")) {
          try {
              await remove(ref(database, `users/${currentUser.uid}`));
              if(currentUser.delete) await currentUser.delete();
              else await logout(); 
              
              setShowProfile(false);
              router.push('/');
              showToast("Account deleted successfully.", "success");
          } catch (e) { 
              showToast("Failed to delete account. Re-login first.", "error"); 
          }
      }
  };

  ///  ADVANCED INTERACTIVE PAGE INSTRUCTIONS
  const getPageInstructions = () => {
    switch(pathname) {
        case '/student': return { 
            title: 'Live Exam Guidelines', 
            basic: 'Take a deep breath! This interface is designed to be completely failure-proof. Focus on your exam without worrying about internet drops or glitches.',
            tabs: [
                { id: 'anti-cheat', icon: 'ti-shield-lock', title: 'Sentinel Proctoring', content: 'Our background daemon strictly monitors tab-switching and screen behavior. Stay in full-screen mode to avoid auto-submission warnings.' },
                { id: 'offline', icon: 'ti-wifi-off', title: 'Zero-Connectivity Vault', content: 'Internet dropped? Keep solving! Your answers are securely locked in your device\'s local storage and will automatically sync the moment connection returns.' },
                { id: 'palette', icon: 'ti-layout-grid', title: 'Smart Palette', content: 'Use the right-side grid to jump between questions. Blue means Answered, Yellow means Marked for Review, and Grey is Unvisited.' }
            ]
        };
        case '/create': return { 
            title: 'Test Creator Masterclass', 
            basic: 'Design professional-grade assessments using our advanced Hybrid formatting engine.',
            tabs: [
                { id: 'hybrid', icon: 'ti-vector', title: 'Hybrid Figures Engine', content: 'Use the dropdown to attach Visuals! Select SMILES for auto-drawing Chemistry diagrams (e.g., c1ccccc1), or TikZ for Math geometry. Normal image upload is also fully supported offline.' },
                { id: 'math', icon: 'ti-math-symbols', title: 'MathJax Support', content: 'Wrap your mathematical equations in $$ (e.g., $$x^2 + y^2$$) to instantly render crisp, vector-based math formulas in the question text.' },
                { id: 'settings', icon: 'ti-adjustments', title: 'Smart Configuration', content: 'Set strict limits using Duration, Total Marks, and select Result Visibility (Instant vs Manual).' }
            ]
        };
        case '/tests': return { 
            title: 'Examiner Vault Operations', 
            basic: 'Welcome to your Command Center. Manage intakes, monitor live submissions, and evaluate papers seamlessly with these advanced tools.',
            tabs: [
                { id: 'bulk', icon: 'ti-file-upload', title: 'Bulk Import Template', content: 'Download our universal JSON template. Define figureType as "image", "smiles", "tikz", or "none" to seamlessly build complex papers completely offline.' },
                { id: 'rekey', icon: 'ti-wand', title: 'Magic Re-keying', content: 'Found a mistake in your question paper? Click "Edit Key", fix the correct option, and our engine will instantly auto-regrade hundreds of past student submissions in milliseconds.' },
                { id: 'evaluate', icon: 'ti-pencil-check', title: 'Manual Evaluation', content: 'Click "Evaluate" on any submission to manually override marks or grade subjective questions. Every single mark change is securely recorded in an Immutable Audit Log.' },
                { id: 'sections', icon: 'ti-layout-distribute-vertical', title: 'Sectional Analytics', content: 'Filter student performance by specific sections (e.g., Physics, Chemistry). Dive deep into class weaknesses, strengths, and question-level accuracy.' },
                { id: 'proctoring', icon: 'ti-shield-half-filled', title: 'Integrity Radar (Anti-Cheat)', content: 'Every submission comes with a timestamped Proctoring Log. Instantly verify if a student switched tabs, minimized the window, or attempted to bypass the full-screen lockdown.' },
                { id: 'export', icon: 'ti-file-spreadsheet', title: 'CSV Ledger Export', content: 'Generate a comprehensive Excel/CSV report of the entire batch in one click. Instantly download detailed metrics including Accuracy %, Total Score, Correct/Wrong counts, and Submission Timestamps.' },
                { id: 'publish', icon: 'ti-share', title: 'Smart Publishing & Share', content: 'Control exactly when results go live using the "Publish Results Manually" toggle. Once ready, use the 1-Click WhatsApp/Telegram share buttons to broadcast the secure test link directly to your students.' }
            ]
        };
        case '/arena': return { 
            title: 'Practice Arena Guide', 
            basic: 'Sharpen your logical building and problem-solving skills in a pressure-free environment.',
            tabs: [
                { id: 'gemini', icon: 'ti-sparkles', title: 'AI Mock Tests', content: 'Enter any specific engineering or academic topic, and our AI will dynamically generate a custom mock test tailored to your needs.' }
            ]
        };
        default: return { 
            title: 'ExamiTop Overview', 
            basic: 'Welcome to the most secure, offline-capable assessment platform built for modern academic needs.',
            tabs: []
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
                <Link href="/student/radar" className={`nav-tab ${pathname === '/student/radar' ? 'active' : ''}`}>
                    <i className="ti ti-radar"></i>My Educators
                </Link>
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

              {userRole && userRole !== 'guest' && pathname !== '/onboarding' && (
                <div 
                    id="dynamic-nav-wrapper" 
                    style={{ 
                        background: 'var(--color-background-secondary)', 
                        borderBottom: '1px solid var(--color-border-secondary)', 
                        
                        //  THE ULTRA-SMOOTH TRANSITION: Fluid iOS Curve
                        transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                        maxHeight: isNavVisible ? '50px' : '0px',
                        opacity: isNavVisible ? 1 : 0,
                        transform: isNavVisible ? 'translateY(0)' : 'translateY(-4px)',
                        
                        //  Jhatka Fix: Dono ko static lock rakha hai taaki layout jump na mare
                        overflowX: 'auto',
                        overflowY: 'hidden', 
                        scrollbarWidth: 'none',
                        position: 'relative',
                        zIndex: 90
                    }}
                >
                    <div className="nav-tabs" id="dynamic-nav-tabs" style={{ display: 'flex', gap: '8px', padding: '10px 20px', width: 'max-content', margin: '0 auto' }}>
                        {renderNavTabs()}
                    </div>
                </div>
            )}
            
        </div>

       {/*  PREMIUM INTERACTIVE GUIDE MODAL (Tailwind + Animations) */}
        {showInfo && (
            <div 
                className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md" 
                style={{ animation: 'fadeIn 0.3s ease-out forwards' }}
                onClick={() => { setShowInfo(false); setActiveGuideTab(null); }}
            >
                <div 
                    className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]" 
                    style={{ animation: 'slideUpScale 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Premium Header */}
                    <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <i className="ti ti-bulb text-2xl"></i>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 m-0">
                                {info.title}
                            </h3>
                        </div>
                        <button 
                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 flex items-center justify-center text-slate-500 transition-colors" 
                            onClick={() => { setShowInfo(false); setActiveGuideTab(null); }}
                        >
                            <i className="ti ti-x text-xl"></i>
                        </button>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="p-6 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                        <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-6">
                            {info.basic}
                        </p>

                        {info.tabs && info.tabs.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Feature Breakdown</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {info.tabs.map(tab => {
                                        const isActive = activeGuideTab === tab.id;
                                        return (
                                            <div 
                                                key={tab.id} 
                                                className={`rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer ${
                                                    isActive 
                                                    ? 'bg-blue-50/50 dark:bg-slate-800 border-blue-300 dark:border-blue-500/50 shadow-lg shadow-blue-500/10 md:col-span-2 ring-1 ring-blue-500/20' 
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                                                }`}
                                                onClick={() => setActiveGuideTab(isActive ? null : tab.id)}
                                            >
                                                {/* Tab Header */}
                                                <div className="px-5 py-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300 ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                                            <i className={`ti ${tab.icon} text-lg`}></i>
                                                        </div>
                                                        <span className={`font-bold transition-colors duration-300 ${isActive ? 'text-blue-700 dark:text-blue-400 text-[15px]' : 'text-slate-700 dark:text-slate-300 text-[14px]'}`}>
                                                            {tab.title}
                                                        </span>
                                                    </div>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isActive ? 'bg-blue-200/50 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                        <i className={`ti ti-chevron-down text-sm transition-transform duration-300 ${isActive ? 'rotate-180 text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}></i>
                                                    </div>
                                                </div>

                                                {/*  Advanced CSS Grid Animation for Height */}
                                                <div 
                                                    className="grid transition-all duration-300 ease-in-out"
                                                    style={{ gridTemplateRows: isActive ? '1fr' : '0fr' }}
                                                >
                                                    <div className="overflow-hidden">
                                                        <div className="px-5 pb-5 text-slate-600 dark:text-slate-300 text-[14px] leading-relaxed border-t border-blue-100 dark:border-slate-700/50 mt-1 pt-4">
                                                            {tab.content}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Inline Animation Keyframes (No need to touch globals.css) */}
                    <style dangerouslySetInnerHTML={{__html: `
                        @keyframes slideUpScale {
                            0% { opacity: 0; transform: translateY(20px) scale(0.95); }
                            100% { opacity: 1; transform: translateY(0) scale(1); }
                        }
                    `}} />
                </div>
            </div>
        )}

        {/* 櫨 ADVANCED PREMIUM PROFILE MODAL */}
        {showProfile && currentUser && (
            <div 
                className="modal-bg" 
                style={{ zIndex: 99999, padding: '20px' }} 
                onClick={() => { setShowProfile(false); setIsEditingProfile(false); }} //  Click outside to close
            >
                <div 
                    className="modal-box" 
                    onClick={(e) => e.stopPropagation()} //  Prevent closing when clicking inside the box
                    style={{ maxWidth: '420px', width: '100%', padding: 0, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: 'none' }}
                >
                    {/* Header Banner */}
                    <div style={{ background: 'linear-gradient(135deg, #185FA5 0%, #0B0F19 100%)', height: '110px', position: 'relative' }}>
                        <button 
                            onClick={() => { setShowProfile(false); setIsEditingProfile(false); }} 
                            style={{ position: 'absolute', right: '16px', top: '16px', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        >
                            <i className="ti ti-x" style={{ fontSize: '18px' }}></i>
                        </button>
                    </div>

                    {/* Overlapping Avatar */}
                    <div style={{ width: '90px', height: '90px', background: '#fff', borderRadius: '50%', padding: '4px', position: 'absolute', top: '65px', left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #185FA5, #3C3489)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800, boxShadow: '0 4px 15px rgba(24,95,165,0.3)' }}>
                            {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div style={{ padding: '60px 24px 24px 24px', textAlign: 'center', position: 'relative', background: '#fff' }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#0f172a', fontWeight: 800 }}>{currentUser.displayName || 'Platform User'}</h3>
                        <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px', fontFamily: 'monospace', background: '#f1f5f9', display: 'inline-block', padding: '4px 12px', borderRadius: '20px' }}>
                            {currentUser.email}
                        </div>
                        
                        {!isEditingProfile ? (
                            <>
                                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '20px', textAlign: 'left', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}><i className="ti ti-shield"></i> Role</div>
                                            <div style={{ fontWeight: 800, color: '#185FA5', fontSize: '15px', marginTop: '4px', textTransform: 'uppercase' }}>{userRole}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}><i className="ti ti-id"></i> ID / Roll No</div>
                                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px', marginTop: '4px' }}>{currentUser.rollNo || currentUser.examinerId || 'N/A'}</div>
                                        </div>
                                    </div>
                                    <div style={{ paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}><i className="ti ti-building-bank"></i> Institution</div>
                                        <div style={{ fontWeight: 600, color: '#334155', fontSize: '15px', marginTop: '4px' }}>{profileData.college || 'Not specified'}</div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '14px', fontWeight: 600, background: '#f1f5f9', color: '#475569', border: 'none' }} onClick={() => setShowProfile(false)}>Close</button>
                                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '14px', fontWeight: 600, boxShadow: '0 4px 15px rgba(24,95,165,0.2)' }} onClick={() => {
                                    // 🔥 Data pre-fill karo edit dabane par
                                    setProfileData({
                                        college: currentUser.college || '',
                                        phone: currentUser.phone || '',
                                        rollNo: currentUser.rollNo || ''
                                    });
                                    setIsEditingProfile(true);
                                 }}>
                                    <i className="ti ti-edit"></i> Edit Details
                                   </button>
                                </div>

                                {/*  The Danger Zone (Hidden safely at the bottom) */}
                                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                                    <button 
                                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', transition: 'color 0.2s' }} 
                                        onMouseOver={(e) => e.currentTarget.style.color = '#A32D2D'} 
                                        onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'} 
                                        onClick={deleteAccount}
                                    >
                                        <i className="ti ti-alert-triangle" style={{ fontSize: '14px' }}></i> Danger Zone: Delete Account
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'left', animation: 'fadeIn 0.3s ease' }}>
                                <label style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block' }}>Roll Number / Exam ID <span style={{color: '#A32D2D'}}>*</span></label>
                                <input type="text" placeholder="e.g. 2104540100" value={profileData.rollNo} onChange={e => setProfileData({...profileData, rollNo: e.target.value})} style={{ marginBottom: '16px', width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', outline: 'none', transition: 'border 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#185FA5'} onBlur={(e) => e.target.style.borderColor = '#e2e8f0'} />
                                <label style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block' }}>Institution / College Name</label>
                                <input type="text" placeholder="e.g. UIET Kanpur" value={profileData.college} onChange={e => setProfileData({...profileData, college: e.target.value})} style={{ marginBottom: '16px', width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', outline: 'none', transition: 'border 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#185FA5'} onBlur={(e) => e.target.style.borderColor = '#e2e8f0'} />
                                
                                <label style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '6px', display: 'block' }}>Phone Number</label>
                                <input type="text" placeholder="+91 XXXXX XXXXX" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} style={{ marginBottom: '24px', width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', outline: 'none', transition: 'border 0.2s' }} onFocus={(e) => e.target.style.borderColor = '#185FA5'} onBlur={(e) => e.target.style.borderColor = '#e2e8f0'} />
                                
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '14px', background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600 }} onClick={() => setIsEditingProfile(false)}>Cancel</button>
                                    <button className="btn btn-success" style={{ flex: 1, justifyContent: 'center', padding: '14px', fontWeight: 600, boxShadow: '0 4px 15px rgba(59,109,17,0.2)' }} onClick={saveProfile}>
                                        <i className="ti ti-device-floppy"></i> Save Info
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
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
        
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#185FA5" />
        <link rel="apple-touch-icon" href="/logo.png" />
        
        {/*  FIX 1: MathJax Configuration (Isko batana padta hai ki $ math hai) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.MathJax = {
                tex: {
                  inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                  displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
                }
              };
            `,
          }}
        />
        
        {/*  FIX 2: Standard HTML Script tag (Next.js tag use nahi kar rahe taaki delay na ho) */}
        <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async />
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
