// src/context/AuthContext.js
'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { auth, database } from '../lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
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
        // 🛡️ THE FIX: Security Guard ko VIP Pass ke baare me batao
        const isOfficialAccount = user.email && user.email.toLowerCase().endsWith('@examitop.in');

        // Agar naya email user hai, verify nahi hai, AUR official (@ExamiTop.in) account nahi hai, tabhi block karo!
        if (user.providerData.some(p => p.providerId === 'password') && !user.emailVerified && !isOfficialAccount) {
           setCurrentUser(null);
           setUserRole(null);
           setLoading(false);
           return; 
        }

        try {
          const userRef = ref(database, `users/${user.uid}`);
          const snapshot = await get(userRef);
          
          if (snapshot.exists()) {
            const userData = snapshot.val();
            setUserRole(userData.role);
            
            // THE MASTER OVERRIDE: Ab puri app me 'displayName' ki jagah legalName dikhega
            setCurrentUser({
                uid: user.uid,
                email: user.email,
                photoURL: user.photoURL,
                displayName: userData.legalName || user.displayName, 
                role: userData.role,
                profileLocked: userData.profileLocked || false,
                rollNo: userData.rollNo || null,
                examinerId: userData.examinerId || null,
                available_quota: userData.available_quota !== undefined ? userData.available_quota : 3, 
                is_unlimited: userData.is_unlimited || false 
            });
          } else {
            // 🛠️ Auto-Create DB Record for Manual Firebase Auth Users
            const defaultRole = 'student'; 
            
            await set(userRef, {
              name: user.email.split('@')[0], 
              email: user.email,
              uid: user.uid,
              role: defaultRole,
              profileLocked: false,
              available_quota: 3,
              is_unlimited: false
            });

            setUserRole(defaultRole); 
            setCurrentUser({ 
              uid: user.uid, 
              email: user.email, 
              displayName: user.email.split('@')[0], 
              role: defaultRole,
              profileLocked: false 
            });
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
          profileLocked: false,
          available_quota: 3, 
          is_unlimited: false 
        });
      } else {
        const userData = snapshot.val();
        finalRole = userData.role;
        isLocked = userData.profileLocked || false;
        legalName = userData.legalName;
      }

      //  Force Override
      setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: isLocked ? legalName : user.displayName,
          role: finalRole,
          profileLocked: isLocked
      });
      setUserRole(finalRole);

      //  SMART REDIRECT: Admin ko aur verify ho chuke logo ko seedha unki jagah bhejo
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

 // --- MANUAL EMAIL LOGIN (ULTRA CLEAN & CRASH-PROOF) ---
  const loginWithEmail = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Force status check
      await result.user.reload();
      
      // Strictly bypass verification ONLY for @ExamiTop.in
      const isOfficialAccount = email.toLowerCase().endsWith('@examitop.in');
      
      if (!auth.currentUser.emailVerified && !isOfficialAccount) {
        await signOut(auth);
        return { success: false, error: "Email not verified! Please check your inbox/spam." };
      }
      // onAuthStateChanged khud background me kar lega!
      return { success: true };
    } catch (error) {
      console.error("Login Crash:", error);
      if (error.code === 'auth/invalid-credential') return { success: false, error: "Incorrect Email or Password." };
      return { success: false, error: "Error: " + error.message };
    }
  };

  // --- MANUAL EMAIL REGISTRATION (WITH VERIFICATION & NAME LOCK) ---
  const registerWithEmail = async (email, password, name, college, rollNo, role) => {
    try {
      // 🛑 STRICT SECURITY BLOCK: Public users cannot create @ExamiTop.in accounts
      if (email.toLowerCase().endsWith('@examitop.in')) {
       return { 
          success: false, 
          error: "Registration failed: This email domain is restricted. Please use a valid personal email." 
        };
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // 1. Sabse pehle Verification Email bhejo
      await sendEmailVerification(user);

      // 2. Data save karo
      const userRef = ref(database, `users/${user.uid}`);
      await set(userRef, {
        name: name,
        legalName: name, 
        email: user.email,
        uid: user.uid,
        role: role,
        college: college || "",
        rollNo: rollNo || "",
        profileLocked: true, 
        available_quota: 3,
        is_unlimited: false
      });

      // 3. Shaanti se Logout kar do (ab koi error nahi aayega)
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error("Registration Error:", error);
      return { success: false, error: error.message };
    }
  };

  // --- FORGOT PASSWORD ---
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
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
    <AuthContext.Provider value={{ currentUser, userRole, loading, loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};