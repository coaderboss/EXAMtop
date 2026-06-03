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
        setCurrentUser(user);
        try {
          const userRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            setUserRole(snapshot.val().role);
          } else {
            setUserRole('student'); // Default fallback
          }
        } catch (err) {
          console.error("Error fetching role:", err);
          setUserRole('student');
        }
      } else {
        // Only clear state if it's NOT a guest (Guests aren't tracked by Firebase auth)
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

      if (!snapshot.exists()) {
        await set(userRef, {
          name: user.displayName,
          email: user.email,
          uid: user.uid,
          role: intendedRole
        });
      } else {
        finalRole = snapshot.val().role;
      }

      setCurrentUser(user);
      setUserRole(finalRole);

      // 🔥 Ensure stable redirect after login
      setTimeout(() => {
        if (finalRole === 'admin') router.push('/admin');
        else if (finalRole === 'examiner') router.push('/tests');
        else router.push('/student-dashboard');
      }, 500);

    } catch (error) {
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        console.log("Login popup closed by user.");
        return;
      }
      console.error("Login Error:", error);
      alert("Login failed. Please try again.");
    }
  };

  // --- GUEST LOGIN ---
  const loginAsGuest = () => {
      const guestUser = {
          uid: 'guest_' + Date.now(),
          displayName: 'Guest User',
          email: 'guest@examitop.local'
      };
      setCurrentUser(guestUser);
      setUserRole('guest');
      setTimeout(() => {
          router.push('/student'); // Guests usually go straight to joining a test
      }, 300);
  };

  const logout = async () => {
    if (userRole !== 'guest') {
        await signOut(auth);
    }
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