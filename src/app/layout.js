// src/app/layout.js
"use client";
import "./globals.css";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { DataProvider } from "../context/DataContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { database } from "../lib/firebase";
import { ref, update, remove, get } from "firebase/database";
import Script from "next/script";

function Header() {
  const { currentUser, userRole, loginWithGoogle, loginWithEmail, logout } = useAuth();
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
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    college: "",
    phone: "",
    rollNo: "",
  });
  const settingsRef = useRef(null);

  //  Login Modal States (Profile States ke theek neeche add karo)
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  //  1. CLEAN SHUTTER STATES & REFS
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const isAnimating = useRef(false); //  FIX: Layout Jump Lock (Fake scroll ko rokne ke liye)
  const navState = useRef(true); //  FIX: Direct memory state

  //  2. ANTI-FLICKER SCROLL ENGINE (With Animation Lock & Short-Page Guard)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Total kitna scroll ho sakta hai wo nikala
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;

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
        setTimeout(() => {
          isAnimating.current = false;
        }, 400); // 400ms ka strict lock
      } else if (distance < -20 && !navState.current) {
        // Scroll Up -> Show
        isAnimating.current = true;
        navState.current = true;
        setIsNavVisible(true);
        setTimeout(() => {
          isAnimating.current = false;
        }, 400); // 400ms ka strict lock
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("theme") === "dark"
    ) {
      document.documentElement.setAttribute("data-theme", "dark");
      setIsDarkMode(true);
    }
  }, []);

  // 2.5 FETCH USER PROFILE DATA ON MODAL OPEN
  useEffect(() => {
    if (showProfile && currentUser?.uid) {
      get(ref(database, `users/${currentUser.uid}`))
        .then((snap) => {
          if (snap.exists()) {
            const d = snap.val();
            setProfileData({
              college: d.college || currentUser.college || "",
              phone: d.phone || currentUser.phone || "",
              rollNo: d.rollNo || d.examinerId || currentUser.rollNo || "",
            });
          }
        })
        .catch((e) => console.error("Error fetching user profile", e));
    }
  }, [showProfile, currentUser]);

  // 3. CLICK OUTSIDE TO CLOSE SETTINGS
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Agar settingsRef hai aur jis element par click hua hai wo settingsRef ke andar nahi hai
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSettingsOpen]);

  const toggleDarkMode = () => {
    const body = document.documentElement;
    if (body.getAttribute("data-theme") === "dark") {
      body.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      body.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
    setIsSettingsOpen(false);
  };

  //  LOGIN REDIRECT FIX
  const handleLogin = async (role) => {
    try {
      await loginWithGoogle(role);
      if (role === 'examiner' || role === 'admin') router.push('/dashboard');
      else router.push("/student-dashboard");
    } catch (error) {
      console.error("Login Failed", error);
    }
  };

  const handleLogout = async () => {
    await logout();
    setShowProfile(false);
    setIsSettingsOpen(false);
    router.push("/");
  };

  //  THE TOAST HELPER FUNCTION
  const showToast = (msg, type = "success") => {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML =
      type === "success"
        ? `<i class="ti ti-check" style="font-size:18px;"></i> ${msg}`
        : `<i class="ti ti-alert-triangle" style="font-size:18px;"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => {
      if (container.contains(toast)) toast.remove();
    }, 3000);
  };

  //   PROFILE SAVE FUNCTION (Jo miss ho gaya tha)
  const saveProfile = async () => {
    if (!currentUser?.uid) return;
    setIsSavingProfile(true);
    try {
      await update(ref(database, `users/${currentUser.uid}`), {
        college: profileData.college || "",
        phone: profileData.phone || "",
        rollNo: profileData.rollNo || "",
      });
      setIsEditingProfile(false);
      showToast("Profile updated successfully!", "success");
    } catch (e) {
      console.error("Save profile error:", e);
      showToast("Failed to update profile.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  //  DELETE ACCOUNT FIX (With Zombie Email Blacklisting)
  const deleteAccount = async () => {
    if (
      window.confirm(
        "DANGER: Are you absolutely sure you want to permanently delete your account? All your data will be lost.",
      )
    ) {
      try {
        // 🔥 NEW: Zombie Email Logic (Blacklisting the email to prevent free-tier abuse)
        if (currentUser && currentUser.email) {
          const safeEmail = currentUser.email.replace(/\./g, ',');
          await update(ref(database), {
            [`claimed_free_tokens/${safeEmail}`]: true
          });
        }

        await remove(ref(database, `users/${currentUser.uid}`));
        if (currentUser.delete) await currentUser.delete();
        else await logout();

        setShowProfile(false);
        router.push("/");
        showToast("Account deleted successfully.", "success");
      } catch (e) {
        showToast("Failed to delete account. Re-login first.", "error");
      }
    }
  };

  const renderNavTabs = () => {
    if (userRole === "student") {
      return (
        <>
          <Link
            href="/student-dashboard"
            className={`nav-tab ${pathname === "/student-dashboard" ? "active" : ""}`}
          >
            <i className="ti ti-chart-pie"></i> Dashboard
          </Link>
          <Link
            href="/student"
            className={`nav-tab ${pathname === "/student" ? "active" : ""}`}
          >
            <i className="ti ti-school"></i> Join Test
          </Link>
          <Link
            href="/student/radar"
            className={`nav-tab ${pathname === "/student/radar" ? "active" : ""}`}
          >
            <i className="ti ti-radar"></i>My Educators
          </Link>
          <Link
            href="/arena"
            className={`nav-tab ${pathname === "/arena" ? "active" : ""}`}
          >
            <i className="ti ti-swords"></i> Practice Arena
          </Link>
          <Link
            href="/student-results"
            className={`nav-tab ${pathname === "/student-results" ? "active" : ""}`}
          >
            <i className="ti ti-history"></i> My Results
          </Link>
        </>
      );
    } else if (userRole === "examiner") {
      return (
        <>
          <Link href="/dashboard" className={`nav-tab ${pathname === '/dashboard' ? 'active' : ''}`}><i className="ti ti-layout-dashboard"></i> Dashboard</Link>
          <Link
            href="/tests"
            className={`nav-tab ${pathname === "/tests" ? "active" : ""}`}
          >
            <i className="ti ti-list-check"></i> My Vault
          </Link>
          <Link
            href="/create"
            className={`nav-tab ${pathname === "/create" ? "active" : ""}`}
          >
            <i className="ti ti-pencil"></i> Create Test
          </Link>
        </>
      );
    } else if (userRole === "admin") {
      return (
        <Link
          href="/admin"
          className={`nav-tab ${pathname === "/admin" ? "active" : ""}`}
          style={{ color: "#A32D2D", fontWeight: 700 }}
        >
          <i className="ti ti-crown"></i> God Mode
        </Link>
      );
    } else if (userRole === "guest") {
      return (
        <Link
          href="/student"
          className={`nav-tab ${pathname === "/student" ? "active" : ""}`}
        >
          <i className="ti ti-school"></i> Join Test
        </Link>
      );
    }
    return null;
  };

  return (
    <>
      <div
        className="app-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.03)",
          borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
        }}
      >
        <div
          className="app-header-inner"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 4%",
            maxWidth: "100%",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Logo Area */}
          <Link
            href="/"
            className="logo"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              outline: "none",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #185FA5, #3C3489)",
                color: "#fff",
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                fontWeight: 900,
                boxShadow: "0 4px 15px rgba(24,95,165,0.2)",
              }}
            >
              E
            </div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 900,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.5px",
              }}
            >
              Exami<span style={{ color: "#185FA5" }}>Top</span>
            </div>
          </Link>

          {/* Actions Area */}
          <div
            className="header-actions"
            style={{ display: "flex", alignItems: "center", gap: "10px" }}
          >

            {/* Settings Dropdown */}
            <div style={{ position: "relative" }} ref={settingsRef}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                style={{
                  borderRadius: "12px",
                  width: "38px",
                  height: "38px",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
                }}
              >
                <i
                  className="ti ti-settings"
                  style={{ fontSize: "22px", margin: 0 }}
                ></i>
              </button>

              {isSettingsOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50px",
                    width: "190px",
                    background: "var(--color-background-primary)",
                    border: "1px solid var(--color-border-secondary)",
                    borderRadius: "16px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                    overflow: "hidden",
                    zIndex: 1000,
                    padding: "6px",
                    animation: "fadeIn 0.2s ease",
                  }}
                >
                  <button
                    onClick={toggleDarkMode}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      background: "transparent",
                      border: "none",
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--color-text-primary)",
                      fontSize: "13px",
                      fontWeight: 700,
                      borderRadius: "10px",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background =
                        "var(--color-background-secondary)")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <i
                      className={`ti ${isDarkMode ? "ti-sun" : "ti-moon"}`}
                      style={{ fontSize: "18px", color: "#185FA5" }}
                    ></i>{" "}
                    {isDarkMode ? "Light Mode" : "Dark Mode"}
                  </button>
                  <button
                    onClick={() => {
                      const currentTopic = pathname === '/' ? 'home' : pathname.replace('/', '');
                      router.push(`/guide?topic=${currentTopic}`);
                      setIsSettingsOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      background: "transparent",
                      border: "none",
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--color-text-primary)",
                      fontSize: "13px",
                      fontWeight: 700,
                      borderRadius: "10px",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background =
                        "var(--color-background-secondary)")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <i
                      className="ti ti-info-circle"
                      style={{ fontSize: "18px", color: "#10B981" }}
                    ></i>{" "}
                    Page Guide
                  </button>
                  {currentUser && userRole !== "guest" && (
                    <div
                      style={{
                        marginTop: "4px",
                        paddingTop: "4px",
                        borderTop: "1px solid var(--color-border-secondary)",
                      }}
                    >
                      {/*Sirf Examiner ko dikhega My Plan*/}
                      {userRole === "examiner" && (
                        <button
                          onClick={() => {
                            router.push("/pricing");
                            setIsSettingsOpen(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "10px 14px",
                            background: "transparent",
                            border: "none",
                            width: "100%",
                            textAlign: "left",
                            cursor: "pointer",
                            color: "var(--color-text-primary)",
                            fontSize: "13px",
                            fontWeight: 700,
                            borderRadius: "10px",
                            transition: "background 0.2s",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.background =
                              "var(--color-background-secondary)")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <i
                            className="ti ti-bolt"
                            style={{ fontSize: "18px", color: "#185FA5" }}
                          ></i>{" "}
                          Upgrade Plan
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowProfile(true);
                          setIsSettingsOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px 14px",
                          background: "transparent",
                          border: "none",
                          width: "100%",
                          textAlign: "left",
                          cursor: "pointer",
                          color: "var(--color-text-primary)",
                          fontSize: "13px",
                          fontWeight: 700,
                          borderRadius: "10px",
                          transition: "background 0.2s",
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.background =
                            "var(--color-background-secondary)")
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <i
                          className="ti ti-user-circle"
                          style={{ fontSize: "18px", color: "#f59e0b" }}
                        ></i>{" "}
                        My Profile
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auth Button */}
            {currentUser ? (
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  background: "#ffffff",
                  color: "#64748b",
                  border: "1px solid #e2e8f0",
                  fontWeight: 700,
                  fontSize: "13px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "#e11d48";
                  e.currentTarget.style.borderColor = "#fecdd3";
                  e.currentTarget.style.background = "#fff1f2";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "#64748b";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                <i className="ti ti-logout" style={{ fontSize: "17px" }}></i>{" "}
                <span className="hide-mobile">Logout</span>
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 18px",
                  background: "#185FA5",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  boxShadow: "0 4px 15px rgba(24,95,165,0.2)",
                  transition: "all 0.2s ease",
                }}
              >
                <i className="ti ti-login" style={{ fontSize: "18px" }}></i>{" "}
                <span className="hide-mobile">Login</span>
              </button>
            )}
          </div>
        </div>

        {/*   UNIFIED SMART SUB-NAVBAR   */}
        {userRole && userRole !== "guest" && pathname !== "/onboarding" && (
          <div
            id="dynamic-nav-wrapper"
            style={{
              background: "rgba(248, 250, 252, 0.8)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(226, 232, 240, 0.7)",
              transition:
                "max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
              maxHeight: isNavVisible ? "54px" : "0px",
              opacity: isNavVisible ? 1 : 0,
              transform: isNavVisible ? "translateY(0)" : "translateY(-4px)",
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "none",
              position: "relative",
              zIndex: 90,
            }}
          >
            <div
              className="nav-tabs"
              id="dynamic-nav-tabs"
              style={{
                display: "flex",
                gap: "6px",
                padding: "4px 8px",
                background: "rgba(241, 245, 249, 0.7)",
                borderRadius: "12px",
                border: "1px solid rgba(226, 232, 240, 0.8)",
                width: "max-content",
                margin: "6px auto",
              }}
            >
              {renderNavTabs()}
            </div>
          </div>
        )}
      </div>

      {/* 🌟 EXECUTIVE LIGHT BENTO PROFILE STUDIO (Clean, Crisp, Light Website Theme) */}
      {showProfile && currentUser && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          onClick={() => {
            setShowProfile(false);
            setIsEditingProfile(false);
          }}
        >
          <div
            className="profile-studio-card w-full max-w-[440px] max-h-[92vh] flex flex-col rounded-[28px] bg-white border border-slate-200 shadow-[0_25px_70px_-15px_rgba(15,23,42,0.15),0_4px_20px_rgba(15,23,42,0.06)] overflow-hidden relative animate-[modalSlideUp_0.25s_cubic-bezier(0.16,1,0.3,1)]"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
          >
            {/* 1. ELEGANT LIGHT TOP BANNER */}
            <div
              className="relative p-5 pb-8 select-none border-b border-blue-100/60"
              style={{
                background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #f0fdf4 100%)",
              }}
            >
              {/* Top Row: Verified Role Chip & Close Button */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 text-blue-700 border border-blue-200/90 text-[11px] font-black uppercase tracking-wider shadow-2xs">
                  <i className="ti ti-shield-check text-xs text-blue-600"></i>
                  <span>
                    {userRole === "examiner"
                      ? "Verified Educator"
                      : userRole === "admin"
                      ? "System Admin"
                      : "Verified Student"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfile(false);
                    setIsEditingProfile(false);
                  }}
                  className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-400 hover:text-slate-800 border border-slate-200/80 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                  title="Close"
                >
                  <i className="ti ti-x text-sm"></i>
                </button>
              </div>
            </div>

            {/* 2. AVATAR & IDENTITY */}
            <div className="px-6 pt-0 pb-6 text-center flex-1 overflow-y-auto" style={{ backgroundColor: "#ffffff" }}>
              {/* Elevated Modern Avatar */}
              <div className="relative -mt-10 mb-3 inline-block">
                <div
                  className="w-20 h-20 rounded-2xl text-white flex items-center justify-center font-black text-2xl select-none mx-auto ring-4 ring-white shadow-md shadow-blue-500/20"
                  style={{
                    background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                  }}
                >
                  {currentUser.displayName
                    ? currentUser.displayName.charAt(0).toUpperCase()
                    : currentUser.email?.charAt(0).toUpperCase() || "U"}
                </div>
                {/* Active Indicator Pulse */}
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                </span>
              </div>

              {/* Display Name */}
              <h3 className="text-xl font-black text-slate-900 tracking-tight m-0 mb-1" style={{ color: "#0f172a" }}>
                {currentUser.displayName || "Platform User"}
              </h3>

              {/* Copyable Email Pill */}
              <div className="flex items-center justify-center mb-5">
                <button
                  type="button"
                  onClick={() => {
                    if (currentUser?.email) {
                      navigator.clipboard.writeText(currentUser.email);
                      showToast("Email address copied!", "success");
                    }
                  }}
                  className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200 text-xs font-mono transition-all cursor-pointer"
                  title="Click to copy email"
                >
                  <i className="ti ti-mail text-xs text-slate-400 group-hover:text-blue-600"></i>
                  <span>{currentUser.email}</span>
                  <i className="ti ti-copy text-[11px] text-slate-400 group-hover:text-blue-600 transition-colors"></i>
                </button>
              </div>

              {!isEditingProfile ? (
                /* 3. POLISHED LIGHT BENTO TILES */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5 text-left">
                    {/* Role Tile */}
                    <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100/80 hover:bg-blue-50/80 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1">
                          <i className="ti ti-shield text-xs"></i> Role
                        </span>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100/90 text-blue-700">ACTIVE</span>
                      </div>
                      <div className="text-sm font-black text-slate-900 uppercase tracking-wide">
                        {userRole || "User"}
                      </div>
                    </div>

                    {/* ID / Roll Tile */}
                    <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100/80 hover:bg-indigo-50/80 transition-colors relative group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                          <i className="ti ti-id text-xs"></i> ID / Roll No
                        </span>
                        {(profileData.rollNo || currentUser.rollNo || currentUser.examinerId) && (
                          <button
                            type="button"
                            onClick={() => {
                              const idVal = profileData.rollNo || currentUser.rollNo || currentUser.examinerId;
                              navigator.clipboard.writeText(idVal);
                              showToast("ID copied to clipboard!", "success");
                            }}
                            className="text-indigo-400 hover:text-indigo-700 transition-colors cursor-pointer"
                            title="Copy ID"
                          >
                            <i className="ti ti-copy text-xs"></i>
                          </button>
                        )}
                      </div>
                      <div className="text-sm font-bold text-slate-900 truncate" title={profileData.rollNo || currentUser.rollNo || currentUser.examinerId || "N/A"}>
                        {profileData.rollNo || currentUser.rollNo || currentUser.examinerId || "Not assigned"}
                      </div>
                    </div>

                    {/* Institution Tile */}
                    <div className="col-span-2 p-3.5 rounded-2xl bg-purple-50/40 border border-purple-100/80 hover:bg-purple-50/70 transition-colors">
                      <div className="text-[10px] font-black uppercase tracking-wider text-purple-600 flex items-center gap-1 mb-1">
                        <i className="ti ti-building-bank text-xs"></i> Institution / College
                      </div>
                      <div className="text-sm font-bold text-slate-800 truncate" title={profileData.college || "Not specified"}>
                        {profileData.college || "Not specified"}
                      </div>
                    </div>

                    {/* Phone Tile */}
                    <div className="col-span-2 p-3.5 rounded-2xl bg-emerald-50/40 border border-emerald-100/80 flex items-center justify-between hover:bg-emerald-50/70 transition-colors">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1 mb-0.5">
                          <i className="ti ti-phone text-xs"></i> Contact Phone
                        </div>
                        <div className="text-sm font-bold text-slate-800">
                          {profileData.phone || "Not linked"}
                        </div>
                      </div>
                      <span className={"text-[10px] font-extrabold px-2 py-0.5 rounded-full " + (profileData.phone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                        {profileData.phone ? "Verified" : "Optional"}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons Deck */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProfile(false)}
                      className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm border border-slate-200/90 shadow-2xs transition-all active:scale-95 cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="ti ti-edit text-sm"></i>
                      <span>Edit Details</span>
                    </button>
                  </div>

                  {/* Danger Zone Accordion Safeguard */}
                  <details className="group mt-3 pt-3 border-t border-slate-100 text-left">
                    <summary className="cursor-pointer text-[11px] font-bold text-slate-400 hover:text-rose-600 transition-colors list-none flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <i className="ti ti-alert-triangle text-amber-500"></i>
                        <span>Account Management & Danger Zone</span>
                      </span>
                      <i className="ti ti-chevron-down text-xs text-slate-400 group-open:rotate-180 transition-transform"></i>
                    </summary>
                    <div className="mt-2.5 p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/70 text-left">
                      <p className="text-[11px] text-rose-700 font-medium mb-2.5 leading-relaxed">
                        Permanently delete your ExamiTop account and exam vault records. This action cannot be undone.
                      </p>
                      <button
                        type="button"
                        onClick={deleteAccount}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className="ti ti-trash text-xs"></i>
                        <span>Delete Account</span>
                      </button>
                    </div>
                  </details>
                </div>
              ) : (
                /* 4. CRISP LIGHT EDIT FORM */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveProfile();
                  }}
                  className="space-y-3.5 text-left animate-[fadeIn_0.2s_ease-out]"
                >
                  {/* Roll No Input */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <i className="ti ti-id text-blue-500"></i>
                      <span>Exam ID / Roll Number</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2104540100"
                      value={profileData.rollNo}
                      onChange={(e) =>
                        setProfileData({ ...profileData, rollNo: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>

                  {/* Institution Input */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <i className="ti ti-building-bank text-purple-500"></i>
                      <span>Institution / College</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Delhi Technological University"
                      value={profileData.college}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          college: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <i className="ti ti-phone text-emerald-500"></i>
                      <span>Contact Phone</span>
                    </label>
                    <input
                      type="text"
                      placeholder="+91 XXXXX XXXXX"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({ ...profileData, phone: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-900 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      disabled={isSavingProfile}
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold border border-slate-200 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-sm shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <>
                          <i className="ti ti-loader animate-spin text-sm"></i>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <i className="ti ti-device-floppy text-sm"></i>
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PREMIUM DUAL-LOGIN MODAL */}
      {showLoginModal && !currentUser && (
        <div className="modal-bg" style={{ zIndex: 999999, padding: "20px" }} onClick={() => setShowLoginModal(false)}>
          <div className="modal-box animate-[fadeIn_0.3s_ease]" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "420px", width: "100%", padding: "30px", borderRadius: "24px", background: "#fff", position: "relative", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <button onClick={() => setShowLoginModal(false)} style={{ position: "absolute", right: "20px", top: "20px", background: "#f8fafc", border: "none", width: "32px", height: "32px", borderRadius: "50%", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" }} onMouseOver={(e) => e.currentTarget.style.background = "#e2e8f0"} onMouseOut={(e) => e.currentTarget.style.background = "#f8fafc"}>
              <i className="ti ti-x text-lg"></i>
            </button>
            
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{ width: "56px", height: "56px", background: "linear-gradient(135deg, #185FA5, #3C3489)", color: "#fff", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", margin: "0 auto 16px", boxShadow: "0 4px 15px rgba(24,95,165,0.3)" }}>
                <i className="ti ti-user-scan"></i>
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#0f172a", marginBottom: "8px" }}>Welcome to ExamiTop</h2>
              <p style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>Login using Google or your Lab ID.</p>
            </div>

            {loginError && (
              <div style={{ background: "#fef2f2", color: "#ef4444", padding: "12px", borderRadius: "10px", fontSize: "12px", fontWeight: 700, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid #fecaca" }}>
                <i className="ti ti-alert-triangle text-lg"></i> {loginError}
              </div>
            )}

            {/* Email / Password Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Institution Email / Lab ID</label>
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="lab01@university.edu" style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "14px", fontWeight: 600, color: "#334155", outline: "none", transition: "border 0.2s" }} onFocus={(e)=>e.target.style.borderColor="#185FA5"} onBlur={(e)=>e.target.style.borderColor="#e2e8f0"} />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px", display: "block" }}>Secure Password</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: "2px solid #e2e8f0", fontSize: "14px", fontWeight: 600, color: "#334155", outline: "none", transition: "border 0.2s" }} onFocus={(e)=>e.target.style.borderColor="#185FA5"} onBlur={(e)=>e.target.style.borderColor="#e2e8f0"} />
              </div>
              <button 
                disabled={isLoggingIn}
                onClick={async () => {
                  if(!loginEmail || !loginPassword) { setLoginError("Please fill in both fields."); return; }
                  setIsLoggingIn(true); setLoginError("");
                  const res = await loginWithEmail(loginEmail, loginPassword, "student");
                  if(!res.success) { setLoginError("Invalid credentials. Try again."); setIsLoggingIn(false); }
                  else { setShowLoginModal(false); setIsLoggingIn(false); }
                }}
                style={{ width: "100%", padding: "14px", background: "#185FA5", color: "#fff", border: "none", borderRadius: "12px", fontWeight: 700, fontSize: "15px", cursor: isLoggingIn ? "not-allowed" : "pointer", boxShadow: "0 4px 15px rgba(24,95,165,0.2)", marginTop: "6px", transition: "transform 0.1s" }}
                onMouseOver={(e) => !isLoggingIn && (e.currentTarget.style.transform = "scale(0.98)")}
                onMouseOut={(e) => !isLoggingIn && (e.currentTarget.style.transform = "scale(1)")}
              >
                {isLoggingIn ? "Authenticating..." : "Login to Terminal"}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>OR</div>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
            </div>

            {/* Google Auth Option (Old System Preserved) */}
            <button 
              onClick={async () => {
                  setShowLoginModal(false);
                  await handleLogin("student");
              }}
              style={{ width: "100%", padding: "14px", background: "#fff", color: "#334155", border: "2px solid #e2e8f0", borderRadius: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "all 0.2s" }}
              onMouseOver={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
            >
              <i className="ti ti-brand-google text-[20px]" style={{ color: "#ea4335" }}></i> Continue with Google
            </button>
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
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#185FA5" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>

      {/*   THE FIX: Wapas Native Light Theme pe set kiya! */}
      <body suppressHydrationWarning>
        {/* 🔥 FIX 2: MathJax ko Next.js ke native <Script> tag se load kiya */}
        <Script id="mathjax-config" strategy="beforeInteractive">
          {`window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']] } };`}
        </Script>
        <Script
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
          strategy="beforeInteractive"
        />

        <AuthProvider>
          <DataProvider>
            <Header />
            <div id="app-viewport" style={{ width: "100%", minHeight: "85vh" }}>
              {children}
            </div>
            <div id="toast-container"></div>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}