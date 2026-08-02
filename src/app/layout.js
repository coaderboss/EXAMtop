// src/app/layout.js
"use client";
import "./globals.css";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { DataProvider } from "../context/DataContext";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { database } from "../lib/firebase";
import { ref, update, remove } from "firebase/database";
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
      if (role === "examiner" || role === "admin") router.push("/tests");
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
    if (!currentUser) return;
    try {
      await update(ref(database, `users/${currentUser.uid}`), {
        college: profileData.college,
        phone: profileData.phone,
        rollNo: profileData.rollNo,
      });
      setIsEditingProfile(false);
      showToast("Profile updated successfully!", "success");
    } catch (e) {
      showToast("Failed to update profile.", "error");
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
          <Link
            href="/results"
            className={`nav-tab ${pathname === "/results" ? "active" : ""}`}
          >
            <i className="ti ti-world"></i> Global Results
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
          background: "var(--color-background-primary)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
          borderBottom: "1px solid var(--color-border-secondary)",
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
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            {/* Settings Dropdown */}
            <div style={{ position: "relative" }} ref={settingsRef}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                style={{
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--color-background-secondary)",
                  border: "1px solid var(--color-border-secondary)",
                  color: "var(--color-text-primary)",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
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
                  padding: "10px 18px",
                  background: "#FCEBEB",
                  color: "#A32D2D",
                  border: "1px solid #F7C1C1",
                  fontWeight: 700,
                  fontSize: "14px",
                  borderRadius: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <i className="ti ti-logout" style={{ fontSize: "18px" }}></i>{" "}
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
              background: "var(--color-background-secondary)",
              borderBottom: "1px solid var(--color-border-secondary)",
              transition:
                "max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-out, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
              maxHeight: isNavVisible ? "60px" : "0px",
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
                gap: "8px",
                padding: "10px 20px",
                width: "max-content",
                margin: "0 auto",
              }}
            >
              {renderNavTabs()}
            </div>
          </div>
        )}
      </div>

      {/* ADVANCED PREMIUM PROFILE MODAL */}
      {showProfile && currentUser && (
        <div
          className="modal-bg"
          style={{ zIndex: 99999, padding: "20px" }}
          onClick={() => {
            setShowProfile(false);
            setIsEditingProfile(false);
          }}
        >
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "420px",
              width: "100%",
              padding: 0,
              borderRadius: "20px",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
              border: "none",
              background: "var(--color-background-primary)",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #185FA5 0%, #0B0F19 100%)",
                height: "110px",
                position: "relative",
              }}
            >
              <button
                onClick={() => {
                  setShowProfile(false);
                  setIsEditingProfile(false);
                }}
                style={{
                  position: "absolute",
                  right: "16px",
                  top: "16px",
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#fff",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "0.2s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.3)")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.2)")
                }
              >
                <i className="ti ti-x" style={{ fontSize: "18px" }}></i>
              </button>
            </div>

            <div
              style={{
                width: "90px",
                height: "90px",
                background: "var(--color-background-primary)",
                borderRadius: "50%",
                padding: "4px",
                position: "absolute",
                top: "65px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(135deg, #185FA5, #3C3489)",
                  color: "#fff",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "32px",
                  fontWeight: 800,
                  boxShadow: "0 4px 15px rgba(24,95,165,0.3)",
                }}
              >
                {currentUser.displayName
                  ? currentUser.displayName.charAt(0).toUpperCase()
                  : "U"}
              </div>
            </div>

            <div
              style={{
                padding: "60px 24px 24px 24px",
                textAlign: "center",
                position: "relative",
                background: "var(--color-background-primary)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "22px",
                  color: "var(--color-text-primary)",
                  fontWeight: 800,
                }}
              >
                {currentUser.displayName || "Platform User"}
              </h3>
              <div
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "13px",
                  marginBottom: "24px",
                  fontFamily: "monospace",
                  background: "var(--color-background-secondary)",
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  border: "1px solid var(--color-border-secondary)",
                }}
              >
                {currentUser.email}
              </div>

              {!isEditingProfile ? (
                <>
                  <div
                    style={{
                      background: "var(--color-background-secondary)",
                      borderRadius: "16px",
                      padding: "20px",
                      textAlign: "left",
                      marginBottom: "24px",
                      border: "1px solid var(--color-border-secondary)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "16px",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--color-text-secondary)",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          <i className="ti ti-shield"></i> Role
                        </div>
                        <div
                          style={{
                            fontWeight: 800,
                            color: "#185FA5",
                            fontSize: "15px",
                            marginTop: "4px",
                            textTransform: "uppercase",
                          }}
                        >
                          {userRole}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--color-text-secondary)",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          <i className="ti ti-id"></i> ID / Roll No
                        </div>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--color-text-primary)",
                            fontSize: "15px",
                            marginTop: "4px",
                          }}
                        >
                          {currentUser.rollNo ||
                            currentUser.examinerId ||
                            "N/A"}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        paddingTop: "16px",
                        borderTop: "1px solid var(--color-border-secondary)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--color-text-secondary)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        <i className="ti ti-building-bank"></i> Institution
                      </div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                          fontSize: "15px",
                          marginTop: "4px",
                        }}
                      >
                        {profileData.college || "Not specified"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      className="btn"
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        padding: "14px",
                        fontWeight: 600,
                        background: "var(--color-background-secondary)",
                        color: "var(--color-text-primary)",
                        border: "1px solid var(--color-border-secondary)",
                      }}
                      onClick={() => setShowProfile(false)}
                    >
                      Close
                    </button>
                    <button
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        padding: "14px",
                        fontWeight: 600,
                        background: "#185FA5",
                        color: "#fff",
                        border: "none",
                        boxShadow: "0 4px 15px rgba(24,95,165,0.2)",
                      }}
                      onClick={() => {
                        setProfileData({
                          college: currentUser.college || "",
                          phone: currentUser.phone || "",
                          rollNo: currentUser.rollNo || "",
                        });
                        setIsEditingProfile(true);
                      }}
                    >
                      <i className="ti ti-edit"></i> Edit Details
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: "24px",
                      paddingTop: "16px",
                      borderTop: "1px dashed var(--color-border-secondary)",
                    }}
                  >
                    <button
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-text-secondary)",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        width: "100%",
                        transition: "color 0.2s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.color = "#A32D2D")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.color =
                          "var(--color-text-secondary)")
                      }
                      onClick={deleteAccount}
                    >
                      <i
                        className="ti ti-alert-triangle"
                        style={{ fontSize: "14px" }}
                      ></i>{" "}
                      Danger Zone: Delete Account
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{ textAlign: "left", animation: "fadeIn 0.3s ease" }}
                >
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--color-text-secondary)",
                      marginBottom: "6px",
                      display: "block",
                    }}
                  >
                    Roll Number / Exam ID{" "}
                    <span style={{ color: "#A32D2D" }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2104540100"
                    value={profileData.rollNo}
                    onChange={(e) =>
                      setProfileData({ ...profileData, rollNo: e.target.value })
                    }
                    style={{
                      marginBottom: "16px",
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "2px solid var(--color-border-secondary)",
                      background: "var(--color-background-primary)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                      transition: "border 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#185FA5")}
                    onBlur={(e) =>
                      (e.target.style.borderColor =
                        "var(--color-border-secondary)")
                    }
                  />

                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--color-text-secondary)",
                      marginBottom: "6px",
                      display: "block",
                    }}
                  >
                    Institution / College Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UIET Kanpur"
                    value={profileData.college}
                    onChange={(e) =>
                      setProfileData({
                        ...profileData,
                        college: e.target.value,
                      })
                    }
                    style={{
                      marginBottom: "16px",
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "2px solid var(--color-border-secondary)",
                      background: "var(--color-background-primary)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                      transition: "border 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#185FA5")}
                    onBlur={(e) =>
                      (e.target.style.borderColor =
                        "var(--color-border-secondary)")
                    }
                  />

                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--color-text-secondary)",
                      marginBottom: "6px",
                      display: "block",
                    }}
                  >
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+91 XXXXX XXXXX"
                    value={profileData.phone}
                    onChange={(e) =>
                      setProfileData({ ...profileData, phone: e.target.value })
                    }
                    style={{
                      marginBottom: "24px",
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "2px solid var(--color-border-secondary)",
                      background: "var(--color-background-primary)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                      transition: "border 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#185FA5")}
                    onBlur={(e) =>
                      (e.target.style.borderColor =
                        "var(--color-border-secondary)")
                    }
                  />

                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      className="btn"
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        padding: "14px",
                        background: "var(--color-background-secondary)",
                        color: "var(--color-text-primary)",
                        border: "1px solid var(--color-border-secondary)",
                        fontWeight: 600,
                      }}
                      onClick={() => setIsEditingProfile(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-success"
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        padding: "14px",
                        fontWeight: 600,
                        background: "#3B6D11",
                        color: "#fff",
                        border: "none",
                        boxShadow: "0 4px 15px rgba(59,109,17,0.2)",
                      }}
                      onClick={saveProfile}
                    >
                      <i className="ti ti-device-floppy"></i> Save Info
                    </button>
                  </div>
                </div>
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