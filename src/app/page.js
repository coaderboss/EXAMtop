// src/app/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, userRole, loginWithGoogle, loginAsGuest } = useAuth();
  
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [activeTab, setActiveTab] = useState('mathjax');
  const [isMounted, setIsMounted] = useState(false);

  // 🛡️ THE BULLETPROOF INTERCEPTOR: Mobile + Laptop dono ke liye
  useEffect(() => {
    const handleGlobalLoginClick = (e) => {
      // FIX: Mobile par kabhi-kabhi button ki jagah <a> ya <div> (.btn) render hota hai
      const target = e.target.closest('button, a, .btn, [role="button"]');
      
      // FIX: innerText ki jagah textContent use kiya (zyada reliable), aur safe check lagaya
      if (target && target.textContent && target.textContent.includes('Login') && !target.closest('#portals')) {
        e.preventDefault();
        e.stopPropagation(); // React/Next.js ke default action ko roko
        
        const portalsSection = document.getElementById('portals');
        if (portalsSection) {
            portalsSection.scrollIntoView({ behavior: 'smooth' }); 
        }
      }
    };
    
    // Capture phase me click pakdenge (Mobile tap bhi native 'click' event trigger karta hai)
    document.addEventListener('click', handleGlobalLoginClick, true);
    return () => document.removeEventListener('click', handleGlobalLoginClick, true);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    // Auto-redirect if already logged in with a valid role
    if (currentUser) {
      if (userRole === 'student' || userRole === 'guest') router.push('/student-dashboard');
      else if (userRole === 'examiner' || userRole === 'admin') router.push('/tests');
    }
  }, [currentUser, userRole, router]);

  if (!isMounted || currentUser) return (
    <div className="min-h-[80vh] flex items-center justify-center bg-white">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-12 h-12 border-4 border-[#185FA5] border-t-transparent rounded-full"></motion.div>
    </div>
  );

  // 🔥 ANIMATION VARIANTS
  const slideUp = { hidden: { opacity: 0, y: 50 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4, duration: 0.8 } } };
  const popIn = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1, transition: { type: "spring", bounce: 0.5, duration: 0.8 } } };
  const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15 } } };

  // 🧠 DEEP TECH DATA
  const engineFeatures = {
    mathjax: { 
      id: '01', title: 'Flicker-Free MathJax Architecture', icon: 'ti-math', color: '#185FA5', bg: '#E6F1FB',
      desc: 'Most platforms struggle with raw LaTeX flashing on screen. We completely re-engineered the rendering pipeline. By injecting smart React references and utilizing MathJax Promise Queues, complex equations render synchronously and flawlessly.',
      tags: ['Zero-Flicker DOM', 'Synchronous Queue', 'Latex & AsciiMath']
    },
    proctoring: { 
      id: '02', title: 'Military-Grade Proctoring Daemon', icon: 'ti-shield-lock', color: '#3B6D11', bg: '#EAF3DE',
      desc: 'Our background anti-cheat sentinel actively monitors window focus, tab-switching, and full-screen evasion. Every violation is cryptographically timestamped and instantly relayed to the Examiner Vault.',
      tags: ['Visibility API', 'Blur Events', 'Audit Logs']
    },
    scoring: { 
      id: '03', title: 'Double-Negative Safe Engine', icon: 'ti-calculator', color: '#854F0B', bg: '#FAEEDA',
      desc: 'Our scoring algorithm uses absolute-value sanitization to prevent the notorious double-negative integer bug. It evaluates MSQ partial marking, skipped arrays, and MCQ penalties with perfect mathematical precision.',
      tags: ['Absolute Sanitization', 'O(n) Evaluation', 'Partial Logic']
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans overflow-x-hidden selection:bg-[#185FA5] selection:text-white">
      
      {/* 🌟 1. HERO SECTION (Mobile Optimized) */}
      <section className="relative pt-16 pb-20 md:pt-20 md:pb-32 px-4 md:px-6 flex flex-col items-center text-center overflow-hidden min-h-[70vh] md:min-h-[85vh] justify-center">
        <motion.div animate={{ y: [0, -20, 0], x: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="absolute top-[5%] left-[5%] w-48 md:w-64 h-48 md:h-64 bg-[#E6F1FB] rounded-full blur-[60px] md:blur-[80px] -z-10"></motion.div>
        <motion.div animate={{ y: [0, 30, 0], x: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }} className="absolute bottom-[10%] right-[5%] w-64 md:w-80 h-64 md:h-80 bg-[#EAF3DE] rounded-full blur-[80px] md:blur-[100px] -z-10"></motion.div>

        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="max-w-5xl relative z-10 w-full">
          <motion.div variants={slideUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#cbd5e1] text-[#185FA5] font-bold text-xs md:text-sm mb-6 md:mb-8 shadow-sm">
            <span className="relative flex h-2 md:h-3 w-2 md:w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#185FA5] opacity-75"></span><span className="relative inline-flex rounded-full h-2 md:h-3 w-2 md:w-3 bg-[#185FA5]"></span></span>
            ExamiTop Core 
          </motion.div>
          
          <motion.h1 variants={slideUp} className="text-4xl md:text-7xl lg:text-8xl font-black tracking-tight text-[#0f172a] mb-4 md:mb-6 leading-tight">
            Secure. Smart. <br className="hidden md:block"/>
            <span className="text-[#185FA5]">Unbreakable.</span>
          </motion.h1>
          
          <motion.p variants={slideUp} className="text-base md:text-xl text-[#475569] mb-8 md:mb-12 max-w-2xl mx-auto font-medium leading-relaxed px-2">
            The ultimate assessment engine. Engineered with flawless MathJax rendering, zero-tolerance anti-cheat tracking, and pure offline vault capabilities.
          </motion.p>
          
          <motion.div variants={slideUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto px-4">
            <button onClick={() => document.getElementById('portals').scrollIntoView({behavior: 'smooth'})} className="w-full sm:w-auto px-8 py-4 bg-[#185FA5] hover:bg-[#0C447C] text-white rounded-xl font-bold text-base md:text-lg shadow-[0_8px_20px_rgba(24,95,165,0.3)] transition-all hover:-translate-y-1 flex items-center justify-center gap-2">
              Launch Portals <i className="ti ti-arrow-down"></i>
            </button>
            <button onClick={() => setShowOfflineModal(true)} className="w-full sm:w-auto px-8 py-4 bg-white text-[#854F0B] border-2 border-[#FAC775] hover:bg-[#FEF5E5] rounded-xl font-bold text-base md:text-lg shadow-sm transition-all flex items-center justify-center gap-2">
              <i className="ti ti-wifi-off text-xl md:text-2xl"></i> Local Mode
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* 📊 2. METRICS & BENTO GRID (Mobile Responsive padding) */}
      <section className="py-12 md:py-24 bg-white border-y border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} className="grid md:grid-cols-3 gap-6 md:gap-8">
            
            <motion.div variants={popIn} className="col-span-1 md:col-span-2 bg-gradient-to-br from-[#ffffff] to-[#E6F1FB] border border-[#b9d7f4] rounded-[24px] md:rounded-[32px] p-6 md:p-10 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden group">
              <i className="ti ti-server-off absolute -right-10 -bottom-10 text-[120px] md:text-[200px] text-[#185FA5] opacity-5 group-hover:scale-110 transition-transform duration-700"></i>
              <div className="w-12 md:w-14 h-12 md:h-14 rounded-xl md:rounded-2xl bg-[#185FA5] text-white flex items-center justify-center text-2xl md:text-3xl mb-4 md:mb-6 shadow-md"><i className="ti ti-wifi-off"></i></div>
              <h3 className="text-2xl md:text-3xl font-bold text-[#0f172a] mb-3 md:mb-4">True Offline Vault</h3>
              <p className="text-[#475569] text-base md:text-lg max-w-md leading-relaxed">
                Network failure during exams is no longer a catastrophe. ExamiTop utilizes browser-level IndexedDB memory to create, conduct, and evaluate entirely locally.
              </p>
            </motion.div>

            <motion.div variants={popIn} className="col-span-1 bg-[#ffffff] border border-[#e2e8f0] rounded-[24px] md:rounded-[32px] p-6 md:p-10 shadow-lg hover:shadow-xl transition-shadow flex flex-col justify-center items-center text-center">
              <div className="text-[#3B6D11] text-5xl md:text-6xl font-black mb-4"><i className="ti ti-chart-radar"></i></div>
              <h3 className="text-xl md:text-2xl font-bold text-[#0f172a] mb-2">Deep Analytics</h3>
              <p className="text-[#475569] text-sm md:text-base">Subject-wise breakdown, accurate time tracking, and cheat-event plotting.</p>
            </motion.div>

          </motion.div>
        </div>
      </section>

      {/* ⚙️ 3. INTERACTIVE ARCHITECTURE (Mobile Horizontal Scroll Fix) */}
      <section className="py-16 md:py-32 px-4 md:px-6 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={slideUp} className="mb-10 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#0f172a] mb-4 md:mb-6">Engineered for Perfection.</h2>
            <p className="text-base md:text-xl text-[#475569] max-w-2xl">A deep dive into the custom architecture that makes ExamiTop the most stable assessment platform.</p>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-8 md:gap-12">
            
            {/* 🔥 FIX: Mobile par ye lambe list ki jagah Horizontal swipable tabs banenge */}
            <div className="lg:w-1/3 flex flex-row lg:flex-col gap-3 md:gap-4 overflow-x-auto pb-4 lg:pb-0 snap-x hide-scrollbar scroll-smooth">
              {Object.keys(engineFeatures).map((key) => (
                <motion.button key={key} onClick={() => setActiveTab(key)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`min-w-[80vw] sm:min-w-[300px] lg:min-w-full snap-center p-4 md:p-6 rounded-2xl text-left border-2 transition-all duration-300 flex-shrink-0 ${activeTab === key ? `bg-white shadow-xl lg:border-l-8 lg:border-t-2 border-t-8` : `bg-transparent border-transparent hover:bg-white hover:border-[#e2e8f0] hover:shadow-sm`}`} style={{ borderColor: activeTab === key ? engineFeatures[key].color : 'transparent' }}>
                  <div className="text-xs md:text-sm font-bold opacity-70 mb-1 md:mb-2" style={{ color: engineFeatures[key].color }}>MODULE {engineFeatures[key].id}</div>
                  <h3 className={`text-lg md:text-xl font-bold ${activeTab === key ? 'text-[#0f172a]' : 'text-[#475569]'}`}>
                    {engineFeatures[key].title}
                  </h3>
                </motion.button>
              ))}
            </div>

            {/* Display Panel */}
            <div className="lg:w-2/3">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: "spring", bounce: 0.3 }} className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-14 shadow-[0_20px_40px_rgba(0,0,0,0.04)] border border-[#e2e8f0] relative overflow-hidden min-h-[400px] md:min-h-[450px] flex flex-col justify-center">
                  
                  <i className={`ti ${engineFeatures[activeTab].icon} absolute -right-10 top-10 text-[150px] md:text-[250px] opacity-[0.03]`} style={{ color: engineFeatures[activeTab].color }}></i>
                  
                  <div className="relative z-10">
                    <div className="w-16 md:w-20 h-16 md:h-20 rounded-2xl flex items-center justify-center text-3xl md:text-4xl mb-6 md:mb-8 shadow-sm" style={{ backgroundColor: engineFeatures[activeTab].bg, color: engineFeatures[activeTab].color }}>
                      <i className={`ti ${engineFeatures[activeTab].icon}`}></i>
                    </div>
                    
                    <h3 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] mb-4 md:mb-6">{engineFeatures[activeTab].title}</h3>
                    <p className="text-base md:text-lg text-[#475569] leading-relaxed mb-8 md:mb-10 max-w-xl font-medium">
                      {engineFeatures[activeTab].desc}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      {engineFeatures[activeTab].tags.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1.5 md:px-4 md:py-2 rounded-full border bg-[#f8fafc] text-xs md:text-sm font-bold" style={{ borderColor: engineFeatures[activeTab].color, color: engineFeatures[activeTab].color }}>
                          ✓ {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* 🚀 4. THE PORTALS (Mobile padded) */}
      <section id="portals" className="py-16 md:py-32 px-4 md:px-6 bg-white border-t border-[#e2e8f0]">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={slideUp} className="text-center mb-12 md:mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-[#0f172a] mb-4 md:mb-6">Select Your Workspace</h2>
            <p className="text-base md:text-xl text-[#475569]">Mount the system according to your clearance level.</p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8 md:gap-10">
            
            {/* EXAMINER PORTAL */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={popIn} whileHover={{ y: -8 }} className="bg-gradient-to-br from-[#ffffff] to-[#EAF3DE] rounded-[32px] md:rounded-[40px] p-8 md:p-14 border border-[#C0DD97] shadow-[0_15px_40px_rgba(59,109,17,0.1)] text-center flex flex-col items-center group">
              <div className="w-20 md:w-24 h-20 md:h-24 bg-[#3B6D11] text-white rounded-[20px] md:rounded-[24px] shadow-lg flex items-center justify-center text-4xl md:text-5xl mb-6 md:mb-8 group-hover:scale-110 transition-transform duration-300 group-hover:rotate-3">
                <i className="ti ti-briefcase"></i>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-[#0f172a] mb-3 md:mb-4">Examiner Vault</h3>
              <p className="text-[#475569] mb-8 md:mb-10 text-base md:text-lg leading-relaxed font-medium">
                The control center for educators. Design papers with integrated MathJax, set precision negative marking, and evaluate cryptographically logged test reports.
              </p>
              <button onClick={() => { localStorage.setItem('isOfflineMode', 'false'); loginWithGoogle('examiner'); }} className="mt-auto w-full py-4 bg-[#3B6D11] hover:bg-[#27500A] text-white rounded-xl font-bold text-base md:text-lg shadow-md transition-colors flex justify-center items-center gap-2 md:gap-3">
                <i className="ti ti-brand-google text-lg md:text-xl"></i> Login as Examiner
              </button>
            </motion.div>

            {/* STUDENT PORTAL */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={popIn} whileHover={{ y: -8 }} className="bg-gradient-to-br from-[#ffffff] to-[#E6F1FB] rounded-[32px] md:rounded-[40px] p-8 md:p-14 border border-[#b9d7f4] shadow-[0_15px_40px_rgba(24,95,165,0.1)] text-center flex flex-col items-center group">
              <div className="w-20 md:w-24 h-20 md:h-24 bg-[#185FA5] text-white rounded-[20px] md:rounded-[24px] shadow-lg flex items-center justify-center text-4xl md:text-5xl mb-6 md:mb-8 group-hover:scale-110 transition-transform duration-300 group-hover:-rotate-3">
                <i className="ti ti-school"></i>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-[#0f172a] mb-3 md:mb-4">Student Terminal</h3>
              <p className="text-[#475569] mb-8 md:mb-10 text-base md:text-lg leading-relaxed font-medium">
                Enter the secure sandbox. Attempt live assessments with distraction-free UI, instant formula rendering, and highly responsive evaluation grids.
              </p>
              <div className="mt-auto w-full flex flex-col sm:flex-row gap-3 md:gap-4">
                <button onClick={() => { localStorage.setItem('isOfflineMode', 'false'); loginWithGoogle('student'); }} className="flex-1 py-4 bg-[#185FA5] hover:bg-[#0C447C] text-white rounded-xl font-bold text-base md:text-lg shadow-md transition-colors flex justify-center items-center gap-2 md:gap-3">
                  <i className="ti ti-brand-google text-lg md:text-xl"></i> Login
                </button>
                <button onClick={loginAsGuest} className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-[#f1f5f9] text-[#0f172a] border border-[#cbd5e1] rounded-xl font-bold text-base md:text-lg shadow-sm transition-colors">
                  Guest
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ⚠️ 5. THE WARNING/OFFLINE MODAL */}
      <AnimatePresence>
        {showOfflineModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", bounce: 0.4 }} className="bg-white rounded-[24px] md:rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl relative overflow-hidden border-t-8 border-[#854F0B]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl md:text-2xl font-black text-[#854F0B] flex items-center gap-2"><i className="ti ti-wifi-off"></i> Local Vault</h3>
                <button onClick={() => setShowOfflineModal(false)} className="w-8 h-8 flex items-center justify-center bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a] rounded-full transition-colors"><i className="ti ti-x"></i></button>
              </div>
              
              <p className="text-[#475569] text-sm md:text-base mb-6 md:mb-8 font-medium">
                You are mounting the <strong className="text-[#854F0B]">Offline Sandbox</strong>. Test data will be saved directly to this device's memory. No internet connection is required.
              </p>
              
              <div className="space-y-3">
                <button onClick={() => { localStorage.setItem('isOfflineMode', 'true'); router.push('/create'); }} className="group w-full p-4 rounded-xl bg-[#f8fafc] hover:bg-[#E6F1FB] border border-[#cbd5e1] hover:border-[#185FA5] text-left transition-colors flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-[#185FA5] text-xl group-hover:scale-110 transition-transform"><i className="ti ti-pencil"></i></div>
                  <span className="font-bold text-sm md:text-base text-[#0f172a]">Create Offline Exam</span>
                </button>
                <button onClick={() => { localStorage.setItem('isOfflineMode', 'true'); router.push('/student'); }} className="group w-full p-4 rounded-xl bg-[#f8fafc] hover:bg-[#EAF3DE] border border-[#cbd5e1] hover:border-[#3B6D11] text-left transition-colors flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-[#3B6D11] text-xl group-hover:scale-110 transition-transform"><i className="ti ti-school"></i></div>
                  <span className="font-bold text-sm md:text-base text-[#0f172a]">Enter Exam Sandbox</span>
                </button>
                <button onClick={() => { localStorage.setItem('isOfflineMode', 'true'); router.push('/tests'); }} className="group w-full p-4 rounded-xl bg-[#f8fafc] hover:bg-[#FAEEDA] border border-[#cbd5e1] hover:border-[#854F0B] text-left transition-colors flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-[#854F0B] text-xl group-hover:scale-110 transition-transform"><i className="ti ti-chart-bar"></i></div>
                  <span className="font-bold text-sm md:text-base text-[#0f172a]">Access Local Database</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ek choti si styling class scrollbar chhupane ke liye */}
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}