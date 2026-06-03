// src/app/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, userRole, loginWithGoogle, loginAsGuest } = useAuth();
  
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- ONLINE ROUTING ---
  const handleStudentOnline = async () => {
    localStorage.setItem('isOfflineMode', 'false');
    if (currentUser) {
        if (userRole === 'student' || userRole === 'guest') router.push('/student-dashboard');
    } else {
        await loginWithGoogle('student');
    }
  };

  const handleExaminerOnline = async () => {
    localStorage.setItem('isOfflineMode', 'false');
    if (currentUser) {
        if (userRole === 'examiner' || userRole === 'admin') router.push('/tests');
    } else {
        await loginWithGoogle('examiner');
    }
  };

  // --- OFFLINE ROUTING (NO LOGIN REQUIRED) ---
  const routeOffline = (path) => {
    localStorage.setItem('isOfflineMode', 'true');
    router.push(path);
  };

  if (!isMounted) return null;

  // CARD BLOCKING LOGIC
  const isStudentBlocked = currentUser && (userRole === 'examiner' || userRole === 'admin');
  const isExaminerBlocked = currentUser && (userRole === 'student' || userRole === 'guest');

  return (
    <div style={{ animation: 'fadeIn 0.5s ease', minHeight: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', background: 'radial-gradient(circle at top, #f8fafc 0%, #e2e8f0 100%)' }}>
      
      <div style={{ textAlign: 'center', maxWidth: '800px', marginBottom: '4rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#E6F1FB', color: '#185FA5', padding: '6px 16px', borderRadius: '30px', fontSize: '14px', fontWeight: 700, marginBottom: '1.5rem', border: '1px solid #CECBF6' }}>
              <i className="ti ti-rocket"></i> ExamiTop
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, color: '#0f172a', lineHeight: 1.2, marginBottom: '1.5rem', letterSpacing: '-1px' }}>
              Secure & Smart <br/> <span style={{ color: '#185FA5' }}>Assessment Platform</span>
          </h1>
          <p style={{ fontSize: 'clamp(15px, 3vw, 18px)', color: '#475569', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto' }}>
              Advanced proctoring, instant evaluations, and seamless offline capabilities. Built for modern educators and brilliant students.
          </p>
      </div>

      {/* 🔥 THE FIX: Bulletproof Responsive Grid for Mobile & Desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', width: '100%', maxWidth: '1000px' }}>
          
          {/* 1. Student Portal */}
          <div className="card" style={{ padding: '2rem', textAlign: 'center', borderTop: '4px solid #185FA5', opacity: isStudentBlocked ? 0.5 : 1, pointerEvents: isStudentBlocked ? 'none' : 'auto', position: 'relative' }}>
              {isStudentBlocked && <div style={{ position: 'absolute', top: 15, right: 15, color: '#A32D2D' }}><i className="ti ti-lock" style={{ fontSize: '24px' }}></i></div>}
              
              <div style={{ width: '64px', height: '64px', background: '#E6F1FB', color: '#185FA5', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 1.5rem' }}>
                  <i className="ti ti-school"></i>
              </div>
              <h3 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px' }}>Student Portal</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>Join live tests, check analytics, and review past papers.</p>
              
              {currentUser && (userRole === 'student' || userRole === 'guest') ? (
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => router.push('/student-dashboard')}>Go to Dashboard</button>
              ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={handleStudentOnline}><i className="ti ti-brand-google"></i> Login to Portal</button>
                      <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 600, border: 'none' }} onClick={loginAsGuest}><i className="ti ti-user"></i> Continue as Guest</button>
                  </div>
              )}
          </div>

          {/* 2. Examiner Portal */}
          <div className="card" style={{ padding: '2rem', textAlign: 'center', borderTop: '4px solid #3B6D11', opacity: isExaminerBlocked ? 0.5 : 1, pointerEvents: isExaminerBlocked ? 'none' : 'auto', position: 'relative' }}>
              {isExaminerBlocked && <div style={{ position: 'absolute', top: 15, right: 15, color: '#A32D2D' }}><i className="ti ti-lock" style={{ fontSize: '24px' }}></i></div>}
              
              <div style={{ width: '64px', height: '64px', background: '#EAF3DE', color: '#3B6D11', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 1.5rem' }}>
                  <i className="ti ti-briefcase"></i>
              </div>
              <h3 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px' }}>Examiner Portal</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>Create exams, manage submissions, and auto-grade.</p>
              
              {currentUser && (userRole === 'examiner' || userRole === 'admin') ? (
                  <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={() => router.push('/tests')}>Go to Dashboard</button>
              ) : (
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: 600 }} onClick={handleExaminerOnline}><i className="ti ti-brand-google"></i> Login to Manage</button>
              )}
          </div>

          {/* 3. Offline Mode */}
          <div className="card" style={{ padding: '2rem', textAlign: 'center', borderTop: '4px solid #f59e0b', cursor: 'pointer' }} onClick={() => setShowOfflineModal(true)}>
              <div style={{ width: '64px', height: '64px', background: '#FEF5E5', color: '#d97706', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 1.5rem' }}>
                  <i className="ti ti-wifi-off"></i>
              </div>
              <h3 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px' }}>Offline Hub</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '1.5rem', lineHeight: 1.5 }}>No internet? No problem. Create, manage, and take tests locally.</p>
              <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: '#FEF5E5', color: '#854F0B', border: '1px solid #FAC775', fontWeight: 600 }}>Activate Local Mode</button>
          </div>

      </div>

      {/* 🚀 OFFLINE MODE ROUTING MODAL */}
      {showOfflineModal && (
          <div className="modal-bg" style={{ zIndex: 9999 }}>
              <div className="modal-box" style={{ maxWidth: '450px', textAlign: 'center', padding: '2rem', margin: '0 1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ color: '#854F0B', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
                          <i className="ti ti-wifi-off"></i> Device-Only Mode
                      </h3>
                      <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowOfflineModal(false)}>
                          <i className="ti ti-x" style={{ fontSize: '20px' }}></i>
                      </button>
                  </div>
                  
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                      You are entering <strong style={{ color: '#185FA5' }}>Local Mode</strong>. All data will be saved directly to this device's memory. No internet required. What do you want to do?
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button className="btn" style={{ width: '100%', padding: '16px', justifyContent: 'flex-start', fontSize: '15px', fontWeight: 600, background: '#f8fafc', border: '1px solid #cbd5e1' }} onClick={() => routeOffline('/create')}>
                          <i className="ti ti-pencil" style={{ fontSize: '22px', color: '#185FA5', marginRight: '8px' }}></i> Create Offline Exam
                      </button>
                      <button className="btn" style={{ width: '100%', padding: '16px', justifyContent: 'flex-start', fontSize: '15px', fontWeight: 600, background: '#f8fafc', border: '1px solid #cbd5e1' }} onClick={() => routeOffline('/student')}>
                          <i className="ti ti-school" style={{ fontSize: '22px', color: '#3B6D11', marginRight: '8px' }}></i> Give Exam / Handover Device
                      </button>
                      <button className="btn" style={{ width: '100%', padding: '16px', justifyContent: 'flex-start', fontSize: '15px', fontWeight: 600, background: '#f8fafc', border: '1px solid #cbd5e1' }} onClick={() => routeOffline('/tests')}>
                          <i className="ti ti-chart-bar" style={{ fontSize: '22px', color: '#854F0B', marginRight: '8px' }}></i> Check Local Vault
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}