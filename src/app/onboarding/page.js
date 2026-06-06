'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { database } from '../../lib/firebase';
import { ref, update } from 'firebase/database';

export default function Onboarding() {
  const { currentUser, userRole, loading } = useAuth();
  const router = useRouter();

  const [legalName, setLegalName] = useState('');
  const [identifier, setIdentifier] = useState(''); // Roll No for students, College for examiners
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Agar user pehle se setup kar chuka hai, toh usko yahan se bhagao
  useEffect(() => {
    if (!loading && currentUser) {
      if (currentUser.profileLocked) {
        router.replace(userRole === 'student' ? '/student-dashboard' : '/tests');
      } else {
        // Pre-fill name from Google if available, but let them edit it ONCE
        setLegalName(currentUser.displayName || '');
      }
    } else if (!loading && !currentUser) {
        router.replace('/');
    }
  }, [currentUser, loading, userRole, router]);

  const handleLockProfile = async () => {
    setError('');
    if (!legalName.trim()) { setError('Full Name is strictly required.'); return; }
    if (userRole === 'student' && !identifier.trim()) { setError('Roll Number is required for students.'); return; }
    if (userRole === 'examiner' && !identifier.trim()) { setError('Institution/College name is required.'); return; }

    setIsSaving(true);
    try {
      let updateData = {
        legalName: legalName.trim(),
        profileLocked: true, // 🔒 LOCK LAG GAYA!
      };

      if (userRole === 'student') {
        updateData.rollNo = identifier.trim().toUpperCase();
      } else if (userRole === 'examiner') {
        updateData.college = identifier.trim();
        // 🔥 Generate Smart Examiner ID (e.g., EXT-9A3K)
        updateData.examinerId = 'EXT-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      }

      // Firebase me user node update karo
      await update(ref(database, `users/${currentUser.uid}`), updateData);
      
      // Page reload karke naye data ke sath dashboard bhejo
      window.location.href = userRole === 'student' ? '/student-dashboard' : '/tests';
      
    } catch (err) {
      console.error(err);
      setError('Failed to secure profile. Please try again.');
      setIsSaving(false);
    }
  };

  if (loading || !currentUser) return <div className="spinner-container" style={{ paddingTop: '10vh' }}><div className="spinner"></div></div>;

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '600px', margin: '4rem auto', animation: 'fadeIn 0.3s ease' }}>
      <div className="card" style={{ padding: '2.5rem 2rem', borderTop: '4px solid #A32D2D', textAlign: 'center' }}>
        <i className="ti ti-shield-lock" style={{ fontSize: '56px', color: '#185FA5', marginBottom: '1rem' }}></i>
        <h2 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>Identity Verification</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '15px', marginBottom: '2rem', lineHeight: 1.6 }}>
          Welcome to ExamiTop. Please confirm your official details below. <br/>
          <strong style={{ color: '#A32D2D' }}>Warning: This action is irreversible.</strong> The name provided here will be permanently printed on your exams and certificates.
        </p>

        {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '1.5rem' }}><i className="ti ti-alert-triangle"></i> {error}</div>}

        <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Official Full Name (As per records) <span style={{ color: '#A32D2D' }}>*</span></label>
          <input type="text" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Rahul Sharma" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '16px', marginTop: '6px' }} />
        </div>

        <div style={{ textAlign: 'left', marginBottom: '2.5rem' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>{userRole === 'student' ? 'University Roll Number' : 'Institution / College Name'} <span style={{ color: '#A32D2D' }}>*</span></label>
          <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={userRole === 'student' ? "e.g. 2024CS001" : "e.g. UIET Kanpur"} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '16px', marginTop: '6px', textTransform: userRole === 'student' ? 'uppercase' : 'none' }} />
        </div>

        <button className="btn btn-primary" style={{ width: '100%', padding: '16px', justifyContent: 'center', fontSize: '16px', fontWeight: 700, letterSpacing: '1px' }} onClick={handleLockProfile} disabled={isSaving}>
          {isSaving ? 'SECURING IDENTITY...' : 'LOCK MY PROFILE'} <i className="ti ti-lock"></i>
        </button>
      </div>
    </div>
  );
}