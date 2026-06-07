// src/context/AuthContext.js
'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { auth, database } from '../lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { ref, get, set } from 'firebase/database';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            const userData = snapshot.val();
            setUserRole(userData.role);
            
            // 🔥 THE MASTER OVERRIDE: Ab puri app me 'displayName' ki jagah legalName dikhega
            setCurrentUser({
                uid: user.uid,
                email: user.email,
                photoURL: user.photoURL,
                displayName: userData.legalName || user.displayName, 
                role: userData.role,
                profileLocked: userData.profileLocked || false,
                rollNo: userData.rollNo || null,
                examinerId: userData.examinerId || null
            });
          } else {
            setUserRole('student'); 
            setCurrentUser({ uid: user.uid, email: user.email, displayName: user.displayName, profileLocked: false });
          }
        } catch (err) {
          console.error("Error fetching role:", err);
          setUserRole('student');
          setCurrentUser(user);
        }
      } else {
        if (userRole !== 'guest') {
            setCurrentUser(null);
            setUserRole(null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userRole]);

  // --- GOOGLE LOGIN ---
  const loginWithGoogle = async (intendedRole = 'student') => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' }); 
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      
      let finalRole = intendedRole;
      let isLocked = false;
      let legalName = null;

      if (!snapshot.exists()) {
        await set(userRef, {
          name: user.displayName,
          email: user.email,
          uid: user.uid,
          role: intendedRole,
          profileLocked: false 
        });
      } else {
        const userData = snapshot.val();
        finalRole = userData.role;
        isLocked = userData.profileLocked || false;
        legalName = userData.legalName;
      }

      // 🔥 Force Override
      setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: isLocked ? legalName : user.displayName,
          role: finalRole,
          profileLocked: isLocked
      });
      setUserRole(finalRole);

      // 🔥 SMART REDIRECT: Admin ko aur verify ho chuke logo ko seedha unki jagah bhejo
      setTimeout(() => {
        // Admin ko onboarding nahi dikhana hai
        if (!isLocked && finalRole !== 'guest' && finalRole !== 'admin') {
            router.push('/onboarding');
        } else {
            if (finalRole === 'admin') router.push('/admin');
            else if (finalRole === 'examiner') router.push('/tests');
            else router.push('/student-dashboard');
        }
      }, 500);

    } catch (error) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') return;
      console.error("Login Error:", error);
      alert("Login failed. Please try again.");
    }
  };

  const loginAsGuest = () => {
      setCurrentUser({ uid: 'guest_' + Date.now(), displayName: 'Guest User', email: 'guest@examitop.local', profileLocked: true });
      setUserRole('guest');
      setTimeout(() => router.push('/student'), 300);
  };

  const logout = async () => {
    if (userRole !== 'guest') await signOut(auth);
    setCurrentUser(null);
    setUserRole(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ currentUser, userRole, loading, loginWithGoogle, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};