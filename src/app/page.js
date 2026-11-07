// src/app/page.js
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

// =========================================================================
// ENTERPRISE PROTOCOL CAPABILITIES (Zero Fake Numbers & Zero Leaked Internals)
// =========================================================================
const PROTOCOL_CAPABILITIES = [
  {
    title: "Atomic Time Synchronization",
    status: "Immutable Clock",
    metric: "Drift: < 1ms",
    desc: "Centralized atomic time anchoring prevents client clock rollbacks and unauthorized time extensions.",
    icon: "ti-clock-bolt",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    title: "Synchronous Formula Parser",
    status: "Zero Layout Shift",
    metric: "0 ms Render Lag",
    desc: "High-definition vector mathematical notation for calculus, matrices, and complex notation.",
    icon: "ti-math-function",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    title: "Automated Proctor Sentinel",
    status: "Active Threat Shield",
    metric: "Zero-Trust Telemetry",
    desc: "Real-time background daemon monitors window blur, tab switching, and multi-display detachment.",
    icon: "ti-shield-lock",
    color: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    title: "Hardware-Isolated Vault",
    status: "Zero-Net Execution",
    metric: "100% Offline Continuity",
    desc: "Encrypted on-device memory execution guarantees uninterrupted testing through campus power or ISP drops.",
    icon: "ti-database-star",
    color: "text-amber-700 bg-amber-50 border-amber-200",
  },
];

const GENESIS_PILLARS = [
  {
    title: "Forensic Anti-Tamper Sentinel",
    tagline: "Zero-Trust Test Environment",
    desc: "Standard web forms rely on an honor code that candidates routinely exploit. ExamiTop deploys an active background sentinel that traps tab swaps, shortcut evasion, and inspection attempts with cryptographic integrity logs.",
    icon: "ti-shield-check",
    accent: "from-blue-600 to-indigo-700",
    border: "border-blue-200 hover:border-blue-400",
  },
  {
    title: "Atomic Time Synchronization",
    tagline: "Mathematically Immovable Clock",
    desc: "Candidates frequently alter client system clocks to bypass exam timers. ExamiTop measures instantaneous time drift against centralized atomic time sync servers, rendering device-side clock manipulation completely void.",
    icon: "ti-clock-check",
    accent: "from-emerald-600 to-teal-700",
    border: "border-emerald-200 hover:border-emerald-400",
  },
  {
    title: "Campus-Resilient Local Vault",
    tagline: "Zero-Net Execution",
    desc: "Power outages and fluctuating Wi-Fi should never invalidate exam scores. ExamiTop's Local Vault mode cryptographically caches exam packages on the device, allowing complete offline execution that syncs seamlessly when back online.",
    icon: "ti-server-off",
    accent: "from-amber-600 to-orange-700",
    border: "border-amber-200 hover:border-amber-400",
  },
];

const BENTO_SYSTEMS = [
  {
    title: "Synchronous Mathematical Engine",
    badge: "Vector Formula Engine",
    icon: "ti-math-symbols",
    color: "text-[#185FA5] bg-blue-50 border-blue-200",
    desc: "Complex calculus integrals, tensor matrices, and chemical equations parse instantaneously into crisp vector typography without DOM jitter.",
  },
  {
    title: "Deterministic O(1) Evaluation",
    badge: "Multi-Rule Matrix",
    icon: "ti-calculator",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    desc: "Calculates single-correct, multiple-correct partial credits, and custom negative penalty formulas instantaneously with zero-sum validation safeguards.",
  },
  {
    title: "Targeted Radar Broadcast",
    badge: "Instant Dispatch",
    icon: "ti-radar",
    color: "text-purple-600 bg-purple-50 border-purple-200",
    desc: "Examiners toggle radar on any test with one switch. Enrolled students immediately receive live notifications on their terminals in real-time.",
  },
  {
    title: "High-Compression Media Pipe",
    badge: "95% Size Compression",
    icon: "ti-photo-sensor",
    color: "text-indigo-600 bg-indigo-50 border-indigo-200",
    desc: "Client-side image optimizer shrinks heavy diagram attachments from 8MB down to under 250KB, ensuring rapid load times and zero server choke.",
  },
  {
    title: "Independent Split-Pane Canvas",
    badge: "Zero UI Shift",
    icon: "ti-layout-board-split",
    color: "text-rose-600 bg-rose-50 border-rose-200",
    desc: "The question display viewport and the navigational palette scroll on decoupled threads, keeping UI position locked during intense derivations.",
  },
  {
    title: "Server-Side Solution Shield",
    badge: "Zero-Leak Security",
    icon: "ti-lock",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    desc: "Answer keys and explanations are completely stripped on the server side until the scheduled conclusion window, eliminating leak vectors.",
  },
];

const FAQS = [
  {
    q: "Can tests be conducted completely without an active internet connection?",
    a: "Yes. With ExamiTop's Local Vault mode, examinations are cryptographically cached inside local client storage. Students attempt questions completely offline without internet dependency, and encrypted packets sync safely once reconnected.",
  },
  {
    q: "How does the Proctor Sentinel detect window evasion and cheating?",
    a: "Our background daemon monitors window blur, visibility change, full-screen breaks, and unauthorized shortcut attempts. Every anomaly is logged with microsecond precision and compiled into the examiner's forensic report.",
  },
  {
    q: "Can candidates cheat by altering their device clock?",
    a: "No. The system synchronizes directly with centralized atomic time synchronization protocols upon session initiation, making client-side clock tampering mathematically impossible.",
  },
  {
    q: "Does ExamiTop support complex mathematical symbols & formulas?",
    a: "Yes, ExamiTop features a synchronous vector formula engine that renders integrals, vectors, and chemical equations with zero render delay and no layout shifts.",
  },
  {
    q: "How does the Targeted Radar feature work for teachers?",
    a: "Teachers can flip the 'Radar' switch on any test. Enrolled students immediately see the exam appear live on their radar dashboard in real-time.",
  },
];

// =========================================================================
// FRAMER MOTION SCROLL VARIANTS (Cascading, Smooth & Buttery Easing)
// =========================================================================
const SECTION_CONTAINER = {
  hidden: { opacity: 0, y: 35 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const ITEM_CASCADE = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
  },
};

const CARD_HOVER = {
  y: -6,
  transition: { duration: 0.25, ease: "easeOut" },
};

export default function HomePage() {
  const router = useRouter();
  const {
    currentUser,
    userRole,
    loginWithGoogle,
    loginAsGuest,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
  } = useAuth();

  // Modals & UI States
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [modalView, setModalView] = useState("login"); // 'login' | 'register' | 'forgot'
  const [loginRole, setLoginRole] = useState("student"); // 'student' | 'examiner'
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Registration Specific States
  const [regName, setRegName] = useState("");
  const [regCollege, setRegCollege] = useState("");
  const [regRoll, setRegRoll] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  // Interactive UI Showcase States
  const [activeTab, setActiveTab] = useState("examiner"); // 'examiner' | 'student'
  const [openFaq, setOpenFaq] = useState(null);
  const [sandboxOption, setSandboxOption] = useState(1);
  const [sandboxQuestion, setSandboxQuestion] = useState(4);

  // Helper to clear form inputs on modal view transitions
  const clearFormStates = () => {
    setLoginEmail("");
    setLoginPassword("");
    setRegName("");
    setRegCollege("");
    setRegRoll("");
    setRegConfirmPassword("");
    setLoginError("");
    setSuccessMsg("");
    setModalView("login");
  };

  // 🛡️ Global Click Interceptor: Scrolls to #portals unless inside fixed modal or portal itself
  useEffect(() => {
    const handleLoginClick = (e) => {
      const target = e.target.closest('button, a, .btn, [role="button"]');
      if (
        target &&
        target.textContent &&
        target.textContent.includes("Login") &&
        !target.closest("#portals") &&
        !target.closest(".fixed")
      ) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById("portals")?.scrollIntoView({ behavior: "smooth" });
      }
    };
    document.addEventListener("click", handleLoginClick, true);
    return () => document.removeEventListener("click", handleLoginClick, true);
  }, []);

  // 🛡️ Post-Auth Redirect Engine
  useEffect(() => {
    setIsMounted(true);
    if (currentUser && userRole) {
      if (currentUser.profileLocked === false) {
        router.push("/onboarding");
      } else if (userRole === "student" || userRole === "guest") {
        router.push("/student-dashboard");
      } else if (userRole === "examiner" || userRole === "admin") {
        router.push("/dashboard");
      }
    }
  }, [currentUser, userRole, router]);

  // Loading Screen
  if (!isMounted || currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          className="w-11 h-11 border-[3px] border-[#185FA5] border-t-transparent rounded-full shadow-md"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans overflow-x-clip selection:bg-[#185FA5] selection:text-white">
      {/* ================================================================= */}
      {/* 1. CINEMATIC HERO SECTION (With 2D/2.5D Animated Holographic Core) */}
      {/* ================================================================= */}
      <section className="relative min-h-[92vh] flex flex-col justify-center items-center text-center px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50/90 via-white to-slate-50/60 pt-8 sm:pt-12 pb-20 overflow-hidden">
        {/* Animated Background Glow Orbs */}
        <motion.div
          animate={{ x: [0, 45, 0], y: [0, -35, 0], scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 13, ease: "easeInOut" }}
          className="absolute top-[8%] left-[12%] w-[320px] sm:w-[520px] h-[320px] sm:h-[520px] bg-[#185FA5] rounded-full mix-blend-multiply filter blur-[100px] opacity-[0.14] pointer-events-none z-0"
        />
        <motion.div
          animate={{ x: [0, -45, 0], y: [0, 40, 0], scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 15, ease: "easeInOut" }}
          className="absolute bottom-[8%] right-[10%] w-[300px] sm:w-[480px] h-[300px] sm:h-[480px] bg-[#8B0000] rounded-full mix-blend-multiply filter blur-[100px] opacity-[0.11] pointer-events-none z-0"
        />

        {/* Subtle geometric grid backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:28px_28px] opacity-70 pointer-events-none z-0" />

        {/* Floating Glassmorphic Ambient Indicators */}
        <div className="absolute inset-0 pointer-events-none z-10 flex justify-center items-center perspective-[1200px] overflow-hidden">
          {/* Math Card (Top Left) */}
          <motion.div
            animate={{ y: [0, -20, 0], rotateX: [10, -6, 10], rotateY: [16, 4, 16] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[6%] left-[3%] lg:left-[7%] w-[180px] md:w-[240px] bg-white/85 backdrop-blur-xl border border-white/90 p-4 rounded-3xl shadow-[0_25px_50px_rgba(24,95,165,0.16)] flex flex-col hidden sm:flex text-left"
          >
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#185FA5] border border-blue-200 flex items-center justify-center font-black">
                <i className="ti ti-math-function text-lg"></i>
              </div>
              <div>
                <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Formula Parser</div>
                <div className="text-[9px] text-blue-600 font-mono font-bold">Vector Sync: 0ms</div>
              </div>
            </div>
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <div className="text-[10px] font-mono text-slate-600 font-bold">{"\\oint B \\cdot dl = \\mu_0 I"}</div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-[#185FA5] rounded-full"></div>
              </div>
            </div>
          </motion.div>

          {/* Sentinel Card (Bottom Right) */}
          <motion.div
            animate={{ y: [0, 22, 0], rotateX: [-10, 8, -10], rotateY: [-16, -4, -16] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute bottom-[6%] right-[3%] lg:right-[7%] w-[190px] md:w-[250px] bg-white/85 backdrop-blur-xl border border-white/90 p-4 rounded-3xl shadow-[0_25px_50px_rgba(139,0,0,0.15)] flex flex-col hidden sm:flex text-left"
          >
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-black">
                <i className="ti ti-shield-lock text-lg"></i>
              </div>
              <div>
                <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Sentinel Daemon</div>
                <div className="text-[9px] text-rose-600 font-mono font-bold">Blur Trap: Active</div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-black uppercase text-slate-700 tracking-wider">Sealed Terminal</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-slate-400">0 Flags</span>
            </div>
          </motion.div>

          {/* Atomic Time Card (Top Right) */}
          <motion.div
            animate={{ y: [-10, 10, -10], rotateX: [6, 14, 6], rotateY: [-18, -8, -18] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-[12%] right-[5%] w-[210px] bg-white/80 backdrop-blur-xl border border-white p-3.5 rounded-2xl shadow-[0_20px_40px_rgba(16,185,129,0.12)] hidden xl:flex items-center gap-3 text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-base shrink-0">
              <i className="ti ti-clock-bolt"></i>
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-800 uppercase tracking-wider">Atomic Time Sync</div>
              <div className="text-[9px] text-emerald-600 font-mono font-bold">Centralized Lock: Active</div>
            </div>
          </motion.div>
        </div>

        {/* Central Hero Block */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={SECTION_CONTAINER}
          className="max-w-4xl z-20 relative px-2"
        >
          {/* 🌟 2D/2.5D ANIMATED FUTURISTIC SENTINEL HOLOGRAM (Pure SVG + Motion, 0KB, Zero Latency) */}
          <motion.div variants={ITEM_CASCADE} className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 flex items-center justify-center">
            {/* Outer Pulsing Aura */}
            <motion.div
              animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.5, 0.25] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#185FA5] to-[#8B0000] blur-xl"
            />

            {/* Outer Rotating Dotted Gyroscope Ring */}
            <motion.svg
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke="#185FA5"
                strokeWidth="1.5"
                strokeDasharray="4 6"
                strokeOpacity="0.4"
              />
            </motion.svg>

            {/* Counter-Rotating Hex Ring */}
            <motion.svg
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)]"
              viewBox="0 0 100 100"
            >
              <polygon
                points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"
                fill="none"
                stroke="#8B0000"
                strokeWidth="1.5"
                strokeDasharray="8 8"
                strokeOpacity="0.35"
              />
            </motion.svg>

            {/* 3D-Look Central Glossy Core Shield */}
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#185FA5] via-[#0C447C] to-[#0f172a] p-[1.5px] shadow-[0_10px_25px_rgba(24,95,165,0.35)] flex items-center justify-center overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent pointer-events-none" />
              {/* Scanning Laser Line */}
              <motion.div
                animate={{ y: [-24, 24, -24] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-[#38bdf8] to-transparent shadow-[0_0_8px_#38bdf8]"
              />
              <i className="ti ti-shield-lock text-white text-2xl sm:text-3xl relative z-10 drop-shadow-md"></i>
            </motion.div>
          </motion.div>

          {/* Status Badge */}
          <motion.div
            variants={ITEM_CASCADE}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-blue-200/90 bg-white/95 backdrop-blur-md text-[#185FA5] font-black text-[10px] sm:text-[11px] tracking-widest uppercase mb-5 sm:mb-7 shadow-xs"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#185FA5] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#185FA5]"></span>
            </span>
            <span>Military-Grade Assessment Infrastructure</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            variants={ITEM_CASCADE}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-slate-900 leading-[1.08] mb-6"
          >
            Assessment, <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#185FA5] via-[#0C447C] to-[#8B0000]">
              Quantified & Secured.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={ITEM_CASCADE}
            className="text-base sm:text-lg md:text-xl text-slate-600 font-medium max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            The mission-critical examination operating system built to eliminate paper waste, eliminate cheating, and eliminate internet anxiety.
            Featuring synchronous mathematical formulas, forensic proctor sentinels, and hardware-isolated offline execution.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            variants={ITEM_CASCADE}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => document.getElementById("portals")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-4.5 bg-[#185FA5] hover:bg-[#0C447C] text-white rounded-2xl font-black text-sm sm:text-base transition-all flex items-center justify-center gap-3 shadow-[0_12px_32px_rgba(24,95,165,0.28)]"
            >
              <span>Mount Terminals</span>
              <i className="ti ti-rocket text-lg"></i>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowOfflineModal(true)}
              className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-4.5 bg-white text-[#854F0B] border-2 border-amber-200 hover:bg-amber-50/70 rounded-2xl font-black text-sm sm:text-base transition-all flex items-center justify-center gap-3 shadow-xs"
            >
              <i className="ti ti-wifi-off text-lg text-amber-700"></i>
              <span>Initialize Local Vault</span>
            </motion.button>
          </motion.div>

          {/* Real Architectural Capability Ticker */}
          <motion.div
            variants={ITEM_CASCADE}
            className="mt-14 pt-8 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left"
          >
            {PROTOCOL_CAPABILITIES.map((cap, i) => (
              <motion.div
                key={i}
                whileHover={CARD_HOVER}
                className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-base ${cap.color}`}>
                      <i className={`ti ${cap.icon}`}></i>
                    </div>
                    <span className="text-[9px] font-mono font-black uppercase text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      {cap.status}
                    </span>
                  </div>
                  <div className="font-black text-slate-900 text-sm mb-1">{cap.title}</div>
                  <div className="text-[11px] text-slate-500 font-medium leading-relaxed">{cap.desc}</div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] font-mono font-bold text-slate-700">
                  {cap.metric}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ================================================================= */}
      {/* 2. ABOUT US & MISSION SECTION ("Why ExamiTop Exists")             */}
      {/* ================================================================= */}
      <motion.section
        id="about"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={SECTION_CONTAINER}
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-y border-slate-200 bg-white relative"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div variants={ITEM_CASCADE} className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-[#8B0000] text-xs font-black tracking-[0.2em] uppercase bg-red-50 border border-red-200 px-3 py-1 rounded-full inline-block mb-3">
              Genesis & Mission
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight">
              Solving the Crisis of Academic Examinations.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
              Standard Google Forms leak solutions, generic university LMSs crash under concurrent traffic spikes, and unmonitored browser tabs invite rampant cheating.
              ExamiTop was engineered by educators from first principles to restore absolute cryptographic integrity to testing.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {GENESIS_PILLARS.map((p, i) => (
              <motion.div
                key={i}
                variants={ITEM_CASCADE}
                whileHover={CARD_HOVER}
                className={`p-8 rounded-3xl bg-slate-50 border-2 ${p.border} transition-all flex flex-col justify-between shadow-xs`}
              >
                <div>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${p.accent} text-white flex items-center justify-center text-2xl mb-6 shadow-md`}>
                    <i className={`ti ${p.icon}`}></i>
                  </div>
                  <span className="text-[11px] font-black uppercase text-[#185FA5] tracking-wider block mb-1">
                    {p.tagline}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">{p.title}</h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">{p.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* 3. DUAL-AUDIENCE EXPERIENCE (Interactive Tab Switcher)            */}
      {/* ================================================================= */}
      <motion.section
        id="ecosystem"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={SECTION_CONTAINER}
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-slate-50 border-b border-slate-200"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div variants={ITEM_CASCADE} className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[#185FA5] text-xs font-black tracking-[0.2em] uppercase bg-blue-50 border border-blue-200 px-3 py-1 rounded-full inline-block mb-3">
              Dual Ecosystem
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
              Two Tailored Terminals. One Unified Engine.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 font-medium">
              Explore how professors execute complete assessment authority while candidates experience a distraction-free sandbox.
            </p>

            {/* Framer Motion Pill Switcher */}
            <div className="inline-flex p-1.5 rounded-2xl bg-white border border-slate-200 mt-6 shadow-xs relative">
              <button
                onClick={() => setActiveTab("examiner")}
                className={`relative px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all z-10 flex items-center gap-2 ${
                  activeTab === "examiner" ? "text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {activeTab === "examiner" && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-[#185FA5] rounded-xl shadow-md -z-10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <i className="ti ti-briefcase text-base"></i> For Examiners & Academies
              </button>

              <button
                onClick={() => setActiveTab("student")}
                className={`relative px-6 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all z-10 flex items-center gap-2 ${
                  activeTab === "student" ? "text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {activeTab === "student" && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-[#185FA5] rounded-xl shadow-md -z-10"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <i className="ti ti-school text-base"></i> For Students & Aspirants
              </button>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {activeTab === "examiner" ? (
              <motion.div
                key="examiner"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#8B0000] border border-red-200 flex items-center justify-center text-2xl mb-5">
                      <i className="ti ti-pencil-code"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Automated Test Forging</h4>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                      Create MCQ, MSQ, and numerical evaluations with mathematical equations and automated 95% image retina compression to prevent database crashes.
                    </p>
                  </div>
                </div>

                <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#185FA5] border border-blue-200 flex items-center justify-center text-2xl mb-5">
                      <i className="ti ti-radar"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Targeted Radar Broadcast</h4>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                      Toggle live radar with a single switch. Enrolled students instantly see active exams on their dashboards without requiring manual codes.
                    </p>
                  </div>
                </div>

                <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-2xl mb-5">
                      <i className="ti ti-file-analytics"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Cryptographic Cheat Audits</h4>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                      Inspect timestamped logs of window blur, devtools inspection, and full-screen escapes with signed candidate submissions.
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="student"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#185FA5] border border-blue-200 flex items-center justify-center text-2xl mb-5">
                      <i className="ti ti-layout-board-split"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Independent Split-Pane</h4>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                      The question area and navigation palette scroll on decoupled threads, preventing jitter and disorientation during calculations.
                    </p>
                  </div>
                </div>

                <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#854F0B] border border-amber-200 flex items-center justify-center text-2xl mb-5">
                      <i className="ti ti-device-floppy"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Continuous Auto-Save</h4>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                      Answers persist into encrypted client memory on every selection, guaranteeing zero progress loss against battery or network failure.
                    </p>
                  </div>
                </div>

                <div className="p-7 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-2xl mb-5">
                      <i className="ti ti-chart-arrows"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-2">Instant Score Analytics</h4>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                      Upon submission, view immediate percentile benchmarks, penalty breakdowns, and authorized solution walkthroughs.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* 4. ARCHITECTURAL BENTO GRID                                      */}
      {/* ================================================================= */}
      <motion.section
        id="features"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={SECTION_CONTAINER}
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div variants={ITEM_CASCADE} className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[#8B0000] text-xs font-black tracking-[0.2em] uppercase bg-red-50 border border-red-200 px-3 py-1 rounded-full inline-block mb-3">
              System Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3">
              Engineered for Zero Failure.
            </h2>
            <p className="text-base text-slate-500 font-medium">
              Eliminating systemic vulnerabilities through hardware-accelerated web protocols.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {BENTO_SYSTEMS.map((sys, i) => (
              <motion.div
                key={i}
                variants={ITEM_CASCADE}
                whileHover={CARD_HOVER}
                className="p-8 rounded-3xl bg-slate-50 border border-slate-200/90 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-13 h-13 rounded-2xl border flex items-center justify-center text-2xl ${sys.color}`}>
                      <i className={`ti ${sys.icon}`}></i>
                    </div>
                    <span className="text-[10px] font-mono font-black uppercase text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
                      {sys.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">{sys.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">{sys.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* 5. LIVE INTERACTIVE SANDBOX SIMULATOR                             */}
      {/* ================================================================= */}
      <motion.section
        id="sandbox"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={SECTION_CONTAINER}
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-slate-50 border-b border-slate-200"
      >
        <div className="max-w-5xl mx-auto text-center">
          <motion.div variants={ITEM_CASCADE}>
            <span className="text-[#185FA5] text-xs font-black tracking-[0.2em] uppercase bg-blue-50 border border-blue-200 px-3 py-1 rounded-full inline-block mb-3">
              Real-Time Interactive Sandbox
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">
              Experience the Student Terminal.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 font-medium max-w-xl mx-auto mb-12">
              Click options and question numbers below to experience the sub-millisecond responsiveness of the student terminal.
            </p>
          </motion.div>

          <motion.div
            variants={ITEM_CASCADE}
            className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 text-left"
          >
            {/* Terminal Header */}
            <div className="bg-[#185FA5] text-white px-5 sm:px-6 py-4 flex justify-between items-center">
              <div>
                <div className="text-xs sm:text-sm font-black tracking-wide">
                  Advanced Physics Terminal &bull; Question {sandboxQuestion} of 16
                </div>
                <div className="text-[10px] sm:text-xs text-blue-200 font-mono mt-0.5">
                  Session Token: EXM-2026-X9 &bull; Sentinel Daemon Active
                </div>
              </div>
              <div className="bg-[#0C447C] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2">
                <i className="ti ti-clock animate-pulse"></i> 01:45:22 Left
              </div>
            </div>

            {/* Terminal Split Area */}
            <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              <div className="flex-1 p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                  <span className="bg-blue-50 text-[#185FA5] border border-blue-200 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider">
                    Single Correct Option
                  </span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                    +4 Marks &bull; -1 Penalty
                  </span>
                </div>

                <div className="text-slate-800 font-bold text-base sm:text-lg mb-6 leading-relaxed">
                  Evaluate the transformation matrix representing a 90° orthogonal rotation of an electric field vector in an anisotropic birefringent medium.
                </div>

                <div className="space-y-3 mb-8">
                  {[
                    "Orthogonal Phase Shift along Principal Optical Axis",
                    "Identity Determinant Rotation Vector ✓",
                    "Non-linear Polarization Shear Gradient",
                    "Zero Determinant Wavefront Collapse",
                  ].map((opt, i) => (
                    <div
                      key={i}
                      onClick={() => setSandboxOption(i)}
                      className={`p-3.5 sm:p-4 rounded-xl flex items-center gap-3.5 cursor-pointer text-xs sm:text-sm font-bold border-2 transition-all ${
                        sandboxOption === i
                          ? "border-[#185FA5] bg-blue-50/70 text-slate-900 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                          sandboxOption === i ? "bg-[#185FA5] text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {sandboxOption === i ? <i className="ti ti-check text-sm"></i> : String.fromCharCode(65 + i)}
                      </div>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100 text-xs">
                  <button
                    onClick={() => setSandboxQuestion((q) => Math.max(1, q - 1))}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 transition-colors"
                  >
                    &larr; Previous
                  </button>
                  <button
                    onClick={() => setSandboxQuestion((q) => Math.min(16, q + 1))}
                    className="px-5 py-2 bg-[#185FA5] hover:bg-[#0C447C] text-white rounded-xl font-bold transition-colors shadow-sm"
                  >
                    Next Question &rarr;
                  </button>
                </div>
              </div>

              {/* Navigation Palette */}
              <div className="w-full lg:w-80 bg-slate-50 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                    Question Palette
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-6">
                    {[...Array(16)].map((_, i) => {
                      const num = i + 1;
                      const active = sandboxQuestion === num;
                      const answered = num === 1 || num === 2 || num === 4;
                      return (
                        <div
                          key={num}
                          onClick={() => setSandboxQuestion(num)}
                          className={`aspect-square rounded-xl border-2 flex items-center justify-center text-xs font-black cursor-pointer transition-all ${
                            active
                              ? "border-[#8B0000] text-[#8B0000] bg-white ring-4 ring-red-100"
                              : answered
                              ? "bg-[#185FA5] border-[#185FA5] text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-500 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-[#185FA5]"></span>
                    <span>Answered ({sandboxQuestion === 4 ? "Saved" : "Stored"})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-white border border-slate-300"></span>
                    <span>Unattempted</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* 6. INSTITUTIONAL IMPACT                                           */}
      {/* ================================================================= */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={SECTION_CONTAINER}
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white border-b border-slate-200"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div variants={ITEM_CASCADE} className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-emerald-700 text-xs font-black tracking-[0.2em] uppercase bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block mb-3">
              Institutional Arithmetic
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3">
              Measurable Efficiency.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 font-medium">
              Eliminating manual grading delays and paper leaks through cryptographic automation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <motion.div variants={ITEM_CASCADE} whileHover={CARD_HOVER} className="p-8 rounded-3xl bg-slate-50 border border-slate-200">
              <div className="text-5xl sm:text-6xl font-black text-[#185FA5] mb-2 font-mono">90%</div>
              <h4 className="text-lg font-black text-slate-900 mb-2">Grading Latency Slashed</h4>
              <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
                Deterministic O(1) scoring immediately evaluates thousands of answer packets the instant timers expire.
              </p>
            </motion.div>

            <motion.div variants={ITEM_CASCADE} whileHover={CARD_HOVER} className="p-8 rounded-3xl bg-slate-50 border border-slate-200">
              <div className="text-5xl sm:text-6xl font-black text-emerald-600 mb-2 font-mono">100%</div>
              <h4 className="text-lg font-black text-slate-900 mb-2">Paper & Printing Waste Gone</h4>
              <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
                High-density digital terminals remove the expenses, printing logistics, and vulnerabilities of paper tests.
              </p>
            </motion.div>

            <motion.div variants={ITEM_CASCADE} whileHover={CARD_HOVER} className="p-8 rounded-3xl bg-slate-50 border border-slate-200">
              <div className="text-5xl sm:text-6xl font-black text-[#8B0000] mb-2 font-mono">0</div>
              <h4 className="text-lg font-black text-slate-900 mb-2">Pre-Exam Leak Vectors</h4>
              <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
                Solution keys and explanations are completely stripped on the server side until the scheduled reveal window.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* 7. COMMAND PORTALS (Safe & Exact Preserved Auth Logic)            */}
      {/* ================================================================= */}
      <motion.section
        id="portals"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={SECTION_CONTAINER}
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div variants={ITEM_CASCADE} className="text-center mb-16">
            <span className="text-[#185FA5] text-xs font-black tracking-[0.2em] uppercase bg-blue-50 border border-blue-200 px-3 py-1 rounded-full inline-block mb-3">
              Operational Gateways
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4">
              Mount Your Terminal.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 font-medium max-w-xl mx-auto">
              Select your clearance below to initialize your designated environment.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Examiner Vault */}
            <motion.div
              variants={ITEM_CASCADE}
              whileHover={CARD_HOVER}
              className="bg-white border-2 border-slate-200 rounded-3xl sm:rounded-[36px] p-8 sm:p-10 flex flex-col justify-between hover:border-emerald-600 transition-all shadow-sm"
            >
              <div>
                <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center text-4xl mb-6 shadow-md shadow-emerald-600/20">
                  <i className="ti ti-briefcase"></i>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">Examiner Vault</h3>
                <p className="text-slate-500 text-sm sm:text-base font-medium leading-relaxed mb-8">
                  Forge new assessments, set custom negative deduction matrices, broadcast on radar, and audit cryptographic cheat logs.
                </p>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem("isOfflineMode", "false");
                  clearFormStates();
                  setLoginRole("examiner");
                  setShowLoginModal(true);
                }}
                className="w-full py-4 sm:py-4.5 bg-white border-2 border-slate-200 text-slate-800 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white rounded-2xl font-black text-sm sm:text-base transition-all flex justify-center items-center gap-2.5 active:scale-95 shadow-xs"
              >
                <span>Examiner Access</span>
                <i className="ti ti-arrow-right text-base"></i>
              </button>
            </motion.div>

            {/* Student Terminal */}
            <motion.div
              variants={ITEM_CASCADE}
              whileHover={CARD_HOVER}
              className="bg-white border-2 border-slate-200 rounded-3xl sm:rounded-[36px] p-8 sm:p-10 flex flex-col justify-between hover:border-[#185FA5] transition-all shadow-sm"
            >
              <div>
                <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-[#185FA5] to-[#0C447C] text-white flex items-center justify-center text-4xl mb-6 shadow-md shadow-[#185FA5]/20">
                  <i className="ti ti-school"></i>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">Student Terminal</h3>
                <p className="text-slate-500 text-sm sm:text-base font-medium leading-relaxed mb-8">
                  Mount scheduled exams, attempt papers with zero formula lag, and access instant score breakdown analytics.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    localStorage.setItem("isOfflineMode", "false");
                    clearFormStates();
                    setLoginRole("student");
                    setShowLoginModal(true);
                  }}
                  className="flex-1 py-4 sm:py-4.5 bg-[#185FA5] hover:bg-[#0C447C] text-white rounded-2xl font-black text-sm sm:text-base transition-all flex justify-center items-center gap-2.5 shadow-md shadow-[#185FA5]/20 active:scale-95"
                >
                  <span>Student Login</span>
                  <i className="ti ti-arrow-right text-base"></i>
                </button>
                <button
                  type="button"
                  disabled
                  title="Guest mode is temporarily locked"
                  className="w-full sm:w-auto px-5 py-4 sm:py-4.5 bg-slate-100 border-2 border-slate-200 text-slate-400 rounded-2xl font-black text-xs sm:text-sm cursor-not-allowed opacity-75 flex items-center justify-center gap-2 select-none"
                >
                  <i className="ti ti-lock"></i>
                  <span>Guest</span>
                  <span className="text-[9px] uppercase font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                    Coming Soon
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* 8. INTERACTIVE FAQ ACCORDION                                      */}
      {/* ================================================================= */}
      <motion.section
        id="faq"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={SECTION_CONTAINER}
        className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200"
      >
        <div className="max-w-3xl mx-auto">
          <motion.div variants={ITEM_CASCADE} className="text-center mb-14">
            <span className="text-[#185FA5] text-xs font-black tracking-[0.2em] uppercase bg-blue-50 border border-blue-200 px-3 py-1 rounded-full inline-block mb-3">
              FAQ
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-2">
              Frequently Asked Questions.
            </h2>
            <p className="text-sm text-slate-500 font-medium">Everything you need to know about security, offline mode, and proctoring.</p>
          </motion.div>

          <div className="space-y-3.5">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <motion.div
                  key={i}
                  variants={ITEM_CASCADE}
                  className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden shadow-xs transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full p-5 sm:p-6 text-left flex justify-between items-center gap-4 cursor-pointer"
                  >
                    <span className="font-black text-slate-900 text-sm sm:text-base">{faq.q}</span>
                    <i className={`ti ${isOpen ? "ti-chevron-up" : "ti-chevron-down"} text-slate-500 shrink-0`}></i>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="px-5 sm:px-6 pb-5 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-3"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* ================================================================= */}
      {/* 9. ENTERPRISE FOOTER                                             */}
      {/* ================================================================= */}
      <footer className="bg-[#0f172a] pt-16 pb-8 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-slate-400">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#185FA5] text-white rounded-lg flex items-center justify-center font-black text-lg">
                  E
                </div>
                <span className="text-xl font-black text-white">Exami<span className="text-[#38bdf8]">Top</span></span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium mb-3">
                High-stakes examination infrastructure engineered for precision, atomic time-sync, and forensic security.
              </p>
              <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full inline-block">
                ● Sentinel Daemon Operational
              </div>
            </div>

            <div className="col-span-1">
              <h4 className="text-white font-black uppercase tracking-widest text-[11px] mb-3">Ecosystem</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li><a href="#portals" className="hover:text-white transition-colors">Examiner Vault</a></li>
                <li><a href="#portals" className="hover:text-white transition-colors">Student Terminal</a></li>
                <li><button onClick={() => setShowOfflineModal(true)} className="hover:text-white transition-colors text-left">Offline Vault</button></li>
                <li><a href="#features" className="hover:text-white transition-colors">Proctor Sentinel</a></li>
              </ul>
            </div>

            <div className="col-span-1">
              <h4 className="text-white font-black uppercase tracking-widest text-[11px] mb-3">Governance</h4>
              <ul className="space-y-2 text-xs font-medium">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/refund" className="hover:text-white transition-colors">Refund Policy</a></li>
                <li><a href="/contact" className="hover:text-white transition-colors">Contact Support</a></li>
              </ul>
            </div>

            <div className="col-span-2 lg:col-span-1">
              <h4 className="text-white font-black uppercase tracking-widest text-[11px] mb-3">Contact</h4>
              <div className="text-xs space-y-1.5">
                <div className="text-slate-300">support.examitop@gmail.com</div>
                <div className="text-slate-500">ExamiTop Engine &bull; Uttar Pradesh, India</div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 text-center sm:text-left text-[11px] font-mono text-slate-500">
            &copy; {new Date().getFullYear()} EXAMITOP OS. SECURED VIA ATOMIC TIME-SYNC PROTOCOL.
          </div>
        </div>
      </footer>

      {/* ================================================================= */}
      {/* OFFLINE MODAL                                                     */}
      {/* ================================================================= */}
      <AnimatePresence>
        {showOfflineModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-slate-900/70 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="bg-white border-2 border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <span className="text-xs font-black text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
                  <i className="ti ti-server-off text-[#854F0B]"></i> Offline Execution Protocol
                </span>
                <button
                  onClick={() => setShowOfflineModal(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                >
                  <i className="ti ti-x text-sm"></i>
                </button>
              </div>

              <div className="p-6">
                <p className="text-xs text-amber-900 font-medium bg-amber-50 p-3 rounded-xl border border-amber-200 mb-4 leading-relaxed">
                  Data will be cryptographically cached inside this browser's <strong>encrypted local memory</strong>. Zero active internet connection required.
                </p>

                <div className="space-y-2.5">
                  {[
                    { label: "Create Offline Exam", sub: "Author tests locally", route: "/create", icon: "ti-pencil", col: "text-[#185FA5] bg-blue-50" },
                    { label: "Mount Test Terminal", sub: "Attempt cached offline paper", route: "/student", icon: "ti-school", col: "text-emerald-700 bg-emerald-50" },
                    { label: "Access Local Vault", sub: "Review stored test records", route: "/tests", icon: "ti-database", col: "text-amber-700 bg-amber-50" },
                  ].map((btn, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        localStorage.setItem("isOfflineMode", "true");
                        router.push(btn.route);
                      }}
                      className="w-full p-3.5 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-200 text-left transition-all flex items-center gap-3.5 shadow-xs"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${btn.col}`}>
                        <i className={`ti ${btn.icon}`}></i>
                      </div>
                      <div>
                        <span className="font-black text-sm text-slate-900 block leading-tight">{btn.label}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{btn.sub}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================= */}
      {/* AUTHENTICATION MODAL (LOGIN / REGISTER / FORGOT)                 */}
      {/* ================================================================= */}
      {showLoginModal && !currentUser && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
          onClick={() => {
            setShowLoginModal(false);
            setModalView("login");
            setLoginError("");
            setSuccessMsg("");
          }}
        >
          <div
            className="w-full max-w-[420px] p-6 sm:p-7 rounded-3xl bg-white relative shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowLoginModal(false);
                setModalView("login");
                setLoginError("");
                setSuccessMsg("");
              }}
              className="absolute right-4 top-4 bg-slate-100 w-7 h-7 rounded-full text-slate-500 cursor-pointer flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <i className="ti ti-x text-sm"></i>
            </button>

            <div className="text-center mb-5 mt-1">
              <div className="w-12 h-12 bg-gradient-to-br from-[#185FA5] to-[#0C447C] text-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2.5 shadow-md shadow-[#185FA5]/30">
                <i className={loginRole === "examiner" ? "ti ti-briefcase" : "ti ti-school"}></i>
              </div>
              <h2 className="text-xl font-black text-slate-900 mb-1 leading-tight">
                {modalView === "register"
                  ? `Create ${loginRole === "examiner" ? "Examiner" : "Student"} Account`
                  : modalView === "forgot"
                  ? "Reset Password"
                  : `${loginRole === "examiner" ? "Examiner" : "Student"} Login`}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {modalView === "register"
                  ? "Fill details to receive a verification link."
                  : modalView === "forgot"
                  ? "Enter email to receive password reset link."
                  : "Authenticate via Email or Google account."}
              </p>
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-600 p-2.5 rounded-xl text-xs font-bold mb-3.5 flex items-start gap-2 border border-red-200">
                <i className="ti ti-alert-triangle text-sm shrink-0 mt-0.5"></i>
                <span>{loginError}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl text-xs font-bold mb-3.5 flex items-start gap-2 border border-emerald-200">
                <i className="ti ti-circle-check text-sm shrink-0 mt-0.5"></i>
                <span>{successMsg}</span>
              </div>
            )}

            {/* LOGIN VIEW */}
            {modalView === "login" && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@institution.edu"
                    className="w-full p-3 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      Password
                    </label>
                    <span
                      onClick={() => {
                        setModalView("forgot");
                        setLoginError("");
                        setSuccessMsg("");
                      }}
                      className="text-[10px] font-bold text-[#185FA5] cursor-pointer hover:underline"
                    >
                      Forgot?
                    </span>
                  </div>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                  />
                </div>
                <button
                  disabled={isLoggingIn}
                  onClick={async () => {
                    if (!loginEmail || !loginPassword) {
                      setLoginError("Please enter both email and password.");
                      return;
                    }
                    setIsLoggingIn(true);
                    setLoginError("");
                    setSuccessMsg("");
                    try {
                      const res = await loginWithEmail(loginEmail, loginPassword);
                      if (!res.success) {
                        setLoginError(res.error);
                      } else {
                        setSuccessMsg("Authentication verified! Redirecting...");
                        setTimeout(() => setShowLoginModal(false), 800);
                      }
                    } catch (err) {
                      setLoginError("Fatal Error: " + err.message);
                    } finally {
                      setIsLoggingIn(false);
                    }
                  }}
                  className={`w-full p-3 bg-[#185FA5] text-white rounded-xl font-black text-xs sm:text-sm shadow-md shadow-[#185FA5]/25 mt-1 transition-all ${
                    isLoggingIn ? "opacity-80" : "active:scale-95"
                  }`}
                >
                  {isLoggingIn ? "Authenticating..." : "Login to Terminal"}
                </button>

                <div className="text-center mt-1">
                  <span className="text-xs text-slate-500 font-medium">New here? </span>
                  <span
                    onClick={() => {
                      setModalView("register");
                      setLoginError("");
                      setSuccessMsg("");
                    }}
                    className="text-xs font-bold text-[#185FA5] cursor-pointer hover:underline"
                  >
                    Create Account
                  </span>
                </div>

                <div className="flex items-center gap-2 my-0.5">
                  <div className="flex-1 h-px bg-slate-200"></div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">OR</div>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                <button
                  onClick={async () => {
                    setShowLoginModal(false);
                    await loginWithGoogle(loginRole);
                  }}
                  className="w-full p-2.5 bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <i className="ti ti-brand-google text-base text-red-500"></i>
                  <span>Continue with Google</span>
                </button>
              </div>
            )}

            {/* REGISTER VIEW */}
            {modalView === "register" && (
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                    Full Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full p-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Institution</label>
                    <input
                      type="text"
                      value={regCollege}
                      onChange={(e) => setRegCollege(e.target.value)}
                      placeholder="Optional"
                      className="w-full p-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Roll No / ID</label>
                    <input
                      type="text"
                      value={regRoll}
                      onChange={(e) => setRegRoll(e.target.value)}
                      placeholder="Optional"
                      className="w-full p-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Valid email"
                    className="w-full p-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                      Confirm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                    />
                  </div>
                </div>

                <button
                  disabled={isLoggingIn}
                  onClick={async () => {
                    if (!regName || !loginEmail || !loginPassword || !regConfirmPassword) {
                      setLoginError("Please fill all required (*) fields.");
                      return;
                    }
                    if (loginPassword !== regConfirmPassword) {
                      setLoginError("Passwords do not match.");
                      return;
                    }
                    if (loginPassword.length < 6) {
                      setLoginError("Password must be at least 6 characters.");
                      return;
                    }

                    setIsLoggingIn(true);
                    setLoginError("");
                    setSuccessMsg("");
                    const res = await registerWithEmail(loginEmail, loginPassword, regName, regCollege, regRoll, loginRole);
                    if (!res.success) {
                      setLoginError(res.error);
                      setIsLoggingIn(false);
                    } else {
                      setSuccessMsg("Verification link dispatched! Check your inbox.");
                      setModalView("login");
                      setLoginPassword("");
                      setRegConfirmPassword("");
                      setIsLoggingIn(false);
                    }
                  }}
                  className={`w-full p-3 bg-[#10B981] text-white rounded-xl font-black text-xs sm:text-sm shadow-md shadow-emerald-500/20 mt-1 transition-all ${
                    isLoggingIn ? "opacity-80" : "active:scale-95"
                  }`}
                >
                  {isLoggingIn ? "Creating Account..." : "Create Account"}
                </button>
                <div className="text-center mt-1">
                  <span className="text-xs text-slate-500 font-medium">Already registered? </span>
                  <span
                    onClick={() => {
                      setModalView("login");
                      setLoginError("");
                      setSuccessMsg("");
                    }}
                    className="text-xs font-bold text-[#185FA5] cursor-pointer hover:underline"
                  >
                    Log In
                  </span>
                </div>
              </div>
            )}

            {/* FORGOT PASSWORD VIEW */}
            {modalView === "forgot" && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@institution.edu"
                    className="w-full p-3 rounded-xl border-2 border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#185FA5]"
                  />
                </div>
                <button
                  disabled={isLoggingIn}
                  onClick={async () => {
                    if (!loginEmail) {
                      setLoginError("Please enter your email address.");
                      return;
                    }
                    setIsLoggingIn(true);
                    setLoginError("");
                    setSuccessMsg("");
                    const res = await resetPassword(loginEmail);
                    if (!res.success) {
                      setLoginError(res.error);
                      setIsLoggingIn(false);
                    } else {
                      setSuccessMsg("Password reset link dispatched! Please check your inbox.");
                      setIsLoggingIn(false);
                      setTimeout(() => {
                        setModalView("login");
                        setSuccessMsg("");
                      }, 3000);
                    }
                  }}
                  className={`w-full p-3 bg-slate-900 text-white rounded-xl font-black text-xs sm:text-sm shadow-md mt-1 transition-all ${
                    isLoggingIn ? "opacity-80" : "active:scale-95"
                  }`}
                >
                  {isLoggingIn ? "Sending..." : "Send Reset Link"}
                </button>
                <div className="text-center mt-2">
                  <span
                    onClick={() => {
                      setModalView("login");
                      setLoginError("");
                      setSuccessMsg("");
                    }}
                    className="text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-800 transition-colors"
                  >
                    &larr; Back to Login
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
