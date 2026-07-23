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
  const [isMounted, setIsMounted] = useState(false);

  // 🛡️ THE BULLETPROOF INTERCEPTOR
  useEffect(() => {
    const handleGlobalLoginClick = (e) => {
      const target = e.target.closest('button, a, .btn, [role="button"]');
      if (target && target.textContent && target.textContent.includes('Login') && !target.closest('#portals')) {
        e.preventDefault();
        e.stopPropagation(); 
        
        const portalsSection = document.getElementById('portals');
        if (portalsSection) {
            portalsSection.scrollIntoView({ behavior: 'smooth' }); 
        }
      }
    };
    
    document.addEventListener('click', handleGlobalLoginClick, true);
    return () => document.removeEventListener('click', handleGlobalLoginClick, true);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    if (currentUser) {
      if (userRole === 'student' || userRole === 'guest') router.push('/student-dashboard');
      else if (userRole === 'examiner' || userRole === 'admin') router.push('/tests');
    }
  }, [currentUser, userRole, router]);

  if (!isMounted || currentUser) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-12 h-12 border-[3px] border-[#185FA5] border-t-transparent rounded-full"></motion.div>
    </div>
  );

 // 🌟 ULTRA-PREMIUM 3D & SPRING ANIMATIONS (SMOOTH & CINEMATIC)
  const heroReveal = { 
      hidden: { opacity: 0, y: 60, filter: 'blur(10px)' }, 
      visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } } 
  };
  const fadeUp = { 
      hidden: { opacity: 0, y: 50 }, 
      visible: { opacity: 1, y: 0, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } } 
  };
  const fadeScale = { 
      hidden: { opacity: 0, scale: 0.96 }, 
      visible: { opacity: 1, scale: 1, transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] } } 
  };
  const cardPop = { 
      hidden: { opacity: 0, y: 50, scale: 0.95 }, 
      visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 45, damping: 18 } } 
  };
  const flipUp = { 
      hidden: { opacity: 0, y: 80, rotateX: -12 }, 
      visible: { opacity: 1, y: 0, rotateX: 0, transition: { type: "spring", stiffness: 40, damping: 20 } } 
  };
  const staggerContainer = { 
      hidden: { opacity: 0 }, 
      visible: { opacity: 1, transition: { staggerChildren: 0.25, delayChildren: 0.1 } } 
  };
  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans overflow-x-clip selection:bg-[#185FA5] selection:text-white">
      
     {/* ========================================= */}
      {/* 1. HERO SECTION (Real 3D Floating UI)     */}
      {/* ========================================= */}
      <section className="relative min-h-[95vh] flex flex-col justify-center items-center text-center px-4 md:px-6 overflow-hidden bg-slate-50">
        
        {/* 🌟 Background Glowing Orbs (Visible & Bright) */}
        <motion.div animate={{ x: [0, 50, 0], y: [0, -40, 0] }} transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }} className="absolute top-[10%] left-[15%] w-[400px] h-[400px] md:w-[500px] md:h-[500px] bg-[#185FA5] rounded-full mix-blend-multiply filter blur-[90px] opacity-[0.15] pointer-events-none z-0"></motion.div>
        
        <motion.div animate={{ x: [0, -50, 0], y: [0, 60, 0] }} transition={{ repeat: Infinity, duration: 15, ease: "easeInOut" }} className="absolute bottom-[10%] right-[15%] w-[350px] h-[350px] md:w-[450px] md:h-[450px] bg-[#8B0000] rounded-full mix-blend-multiply filter blur-[90px] opacity-[0.12] pointer-events-none z-0"></motion.div>

        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none z-0"></div>

        {/* 🚀 THE WOW FACTOR: 3D FLOATING GLASS CARDS (NOW 100% VISIBLE) */}
        <div className="absolute inset-0 pointer-events-none z-20 flex justify-center items-center perspective-[1200px] overflow-hidden">
            
            {/* Card 1: MathJax Engine (Top Left) */}
            <motion.div 
                animate={{ y: [0, -35, 0], rotateX: [15, -10, 15], rotateY: [25, 5, 25] }} 
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[8%] left-[2%] md:top-[15%] md:left-[8%] w-[180px] md:w-[250px] bg-white/80 backdrop-blur-xl border-2 border-white/90 p-4 md:p-5 rounded-3xl shadow-[0_30px_60px_rgba(24,95,165,0.25)] flex flex-col"
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-200"><i className="ti ti-math-function text-xl"></i></div>
                    <div className="text-[10px] md:text-xs font-black text-slate-800 uppercase tracking-widest">Math Engine</div>
                </div>
                <div className="space-y-2.5">
                    <div className="h-1.5 md:h-2 w-full bg-slate-200 rounded-full"></div>
                    <div className="h-1.5 md:h-2 w-3/4 bg-[#185FA5] rounded-full shadow-[0_0_12px_#185FA5]"></div>
                </div>
            </motion.div>

            {/* Card 2: Proctor Sentinel (Bottom Right) */}
            <motion.div 
                animate={{ y: [0, 35, 0], rotateX: [-15, 10, -15], rotateY: [-25, -5, -25] }} 
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute bottom-[10%] right-[2%] md:bottom-[15%] md:right-[8%] w-[190px] md:w-[260px] bg-white/80 backdrop-blur-xl border-2 border-white/90 p-4 md:p-5 rounded-3xl shadow-[0_30px_60px_rgba(139,0,0,0.25)] flex flex-col"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shadow-sm border border-red-200"><i className="ti ti-shield-lock text-xl"></i></div>
                    <div className="text-[10px] md:text-xs font-black text-slate-800 uppercase tracking-widest">Proctor AI</div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
                    <div className="w-3 h-3 rounded-full bg-[#10B981] animate-ping relative">
                       <div className="absolute inset-0 rounded-full bg-[#10B981]"></div>
                    </div>
                    <div className="text-[9px] md:text-[10px] font-black text-slate-600 uppercase tracking-widest">Monitoring Sync</div>
                </div>
            </motion.div>

            {/* Card 3: Analytics Graph (Top Right) */}
            <motion.div 
                animate={{ y: [-15, 15, -15], rotateX: [10, 20, 10], rotateY: [-30, -20, -30] }} 
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute top-[20%] right-[2%] md:right-[5%] lg:right-[6%] w-[200px] bg-white/70 backdrop-blur-xl border border-white p-4 rounded-2xl shadow-[0_20px_40px_rgba(212,175,55,0.15)] hidden lg:block"
            >
                <div className="flex items-end justify-between gap-2 h-16 border-b border-slate-200/80 pb-2">
                    <div className="w-5 bg-blue-200 rounded-t-sm h-[40%]"></div>
                    <div className="w-5 bg-[#185FA5] rounded-t-sm h-[75%] shadow-sm"></div>
                    <div className="w-5 bg-[#D4AF37] rounded-t-sm h-[100%] shadow-sm"></div>
                    <div className="w-5 bg-blue-100 rounded-t-sm h-[60%]"></div>
                </div>
                <div className="text-[10px] font-black text-slate-500 mt-3 uppercase text-center tracking-widest">O(1) Evaluation</div>
            </motion.div>

            {/* Card 4: Terminal Code (Bottom Left) */}
            <motion.div 
                animate={{ y: [20, -20, 20], rotateX: [-20, -10, -20], rotateY: [30, 20, 30] }} 
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                className="absolute bottom-[25%] left-[2%] md:left-[5%] lg:left-[6%] w-[220px] bg-[#0f172a]/85 backdrop-blur-xl border border-slate-700 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] hidden lg:block"
            >
                <div className="flex gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                </div>
                <div className="space-y-2.5">
                    <div className="h-1.5 w-full bg-slate-600 rounded-full"></div>
                    <div className="h-1.5 w-4/5 bg-[#4CC9F0] rounded-full shadow-[0_0_8px_#4CC9F0]"></div>
                    <div className="h-1.5 w-2/3 bg-slate-600 rounded-full"></div>
                </div>
            </motion.div>
        </div>

        {/* 📝 Main Hero Content (Clean & Center) */}
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="max-w-5xl z-20 pt-16 relative">
          <motion.div variants={heroReveal} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 bg-white/90 backdrop-blur-md text-[#185FA5] font-black text-[11px] tracking-widest uppercase mb-10 shadow-[0_8px_20px_rgba(24,95,165,0.08)]">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#185FA5] opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-[#185FA5]"></span></span>
            The Next-Gen Assessment Engine
          </motion.div>
          
          <motion.h1 variants={heroReveal} className="text-5xl md:text-8xl lg:text-[90px] font-black tracking-tight text-[#0f172a] mb-8 leading-[1.05]">
            Intelligence, <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#185FA5] via-[#0C447C] to-[#8B0000]">
              Quantified.
            </span>
          </motion.h1>
          
          <motion.p variants={heroReveal} className="text-lg md:text-xl text-slate-500 mb-12 max-w-3xl mx-auto font-medium leading-relaxed px-2">
            A military-grade evaluation framework built for scale. Featuring synchronous MathJax rendering, absolute scoring precision, and a pure offline operational mode.
          </motion.p>
          
          <motion.div variants={heroReveal} className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto relative z-30">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => document.getElementById('portals').scrollIntoView({behavior: 'smooth'})} className="w-full sm:w-auto px-10 py-4 md:py-5 bg-[#185FA5] hover:bg-[#0C447C] text-white rounded-2xl font-black text-[15px] transition-all flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(24,95,165,0.25)]">
              Mount Terminals <i className="ti ti-rocket text-xl"></i>
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowOfflineModal(true)} className="w-full sm:w-auto px-10 py-4 md:py-5 bg-white/95 backdrop-blur-md text-[#854F0B] border-2 border-[#FAC775] hover:bg-[#fffcf7] rounded-2xl font-black text-[15px] transition-all flex items-center justify-center gap-3 shadow-[0_8px_25px_rgba(0,0,0,0.04)]">
              <i className="ti ti-wifi-off text-xl"></i> Initialize Local Vault
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* ========================================= */}
      {/* 2. THE VISION (Bento Grid)                */}
      {/* ========================================= */}
      <section className="py-24 md:py-32 px-6 border-y border-slate-200 bg-white relative z-10">
        <div className="max-w-7xl mx-auto">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={heroReveal} className="text-center mb-16 md:mb-24">
                <h2 className="text-[#8B0000] text-xs font-black tracking-[0.2em] uppercase mb-4">Core Infrastructure</h2>
                <h3 className="text-4xl md:text-5xl font-black text-[#0f172a] tracking-tight mb-6">Engineered for Reliability.</h3>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">We discarded legacy frameworks to build a platform that respects both the examiner's intent and the student's focus.</p>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-8 perspective-[1000px]">
                
                {[
                    { title: 'Zero-Flicker MathJax', icon: 'ti-math-function', color: 'text-[#185FA5]', bg: 'bg-blue-50', border: 'border-blue-100', desc: 'Synchronous rendering pipeline ensures complex LaTeX and AsciiMath load instantly without layout shifts or DOM flashing.' },
                    { title: 'Proctor Sentinel', icon: 'ti-shield-lock', color: 'text-[#8B0000]', bg: 'bg-red-50', border: 'border-red-100', desc: 'Background security daemon actively tracks tab-switches, blur events, and full-screen evasion with cryptographic logging.' },
                    { title: 'Absolute Scoring', icon: 'ti-calculator', color: 'text-[#854F0B]', bg: 'bg-amber-50', border: 'border-amber-100', desc: 'Advanced O(n) evaluation logic calculates MSQ partial marks flawlessly and prevents notorious double-negative bugs.' }
                ].map((feature, i) => (
                    <motion.div key={i} variants={cardPop} whileHover={{ y: -10, rotateY: 2, rotateX: 2 }} className="bg-slate-50 border border-slate-200 p-10 rounded-[32px] shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col items-start text-left">
                        <div className={`w-16 h-16 rounded-2xl ${feature.bg} ${feature.border} border flex items-center justify-center text-3xl mb-8 ${feature.color} shadow-sm`}>
                            <i className={`ti ${feature.icon}`}></i>
                        </div>
                        <h3 className="text-2xl font-black text-[#0f172a] mb-4">{feature.title}</h3>
                        <p className="text-slate-500 leading-relaxed font-semibold">{feature.desc}</p>
                    </motion.div>
                ))}

            </motion.div>
        </div>
      </section>

      {/* ========================================= */}
      {/* 3. EXAMINER SUITE (Detailed Features)     */}
      {/* ========================================= */}
      <section className="py-24 md:py-32 px-6 bg-slate-50 border-b border-slate-200 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16 lg:gap-24">
            
           {/* Real Feature UI Representation (Targeted Radar Ops + Student Sync) */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={flipUp} className="flex-1 w-full relative perspective-[1200px] flex flex-col gap-4 md:gap-6 z-10">
                
                {/* 1. EXAMINER VIEW (Top Card) */}
                <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.06)] transform-gpu rotate-y-[-2deg] rotate-x-[2deg] relative z-20">
                    
                    {/* Header Panel */}
                    <div className="bg-slate-100 px-5 md:px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <div className="font-black text-slate-800 flex items-center gap-2 text-sm md:text-base">
                            <i className="ti ti-folder-star text-[#8B0000] text-xl"></i> My Test Vault
                        </div>
                        <div className="text-[10px] md:text-[11px] font-black text-[#185FA5] bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
                            <i className="ti ti-users"></i> 248 Followers
                        </div>
                    </div>

                    <div className="p-5 md:p-6 space-y-4 bg-white">
                        {/* Exam 1: Active on Radar */}
                        <div className="p-4 md:p-4.5 rounded-2xl border-2 border-[#10B981]/30 bg-[#10B981]/5 flex justify-between items-center transition-all hover:shadow-md">
                            <div>
                                <div className="font-black text-slate-900 text-[14px] md:text-[15px] mb-1">JEE Advanced Physics - Mock 1</div>
                                <div className="text-[10px] md:text-[11px] font-bold font-mono text-slate-500">
                                    CODE: <span className="text-[#8B0000] tracking-widest">PHY-X9</span> &bull; 75 Marks
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {/* Toggle Switch ON */}
                                <div className="w-9 md:w-10 h-5 bg-[#10B981] rounded-full relative shadow-inner cursor-pointer">
                                    <div className="absolute right-1 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                </div>
                                <span className="text-[8px] md:text-[9px] font-black text-[#10B981] uppercase tracking-widest">Radar On</span>
                            </div>
                        </div>

                        {/* Exam 2: Hidden from Radar */}
                        <div className="p-4 md:p-4.5 rounded-2xl border-2 border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div>
                                <div className="font-black text-slate-900 text-[14px] md:text-[15px] mb-1">Organic Chemistry Assessment</div>
                                <div className="text-[10px] md:text-[11px] font-bold font-mono text-slate-500">
                                    CODE: <span className="text-[#8B0000] tracking-widest">CHM-B2</span> &bull; 50 Marks
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                {/* Toggle Switch OFF */}
                                <div className="w-9 md:w-10 h-5 bg-slate-300 rounded-full relative shadow-inner cursor-pointer">
                                    <div className="absolute left-1 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                                </div>
                                <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Hidden</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ANIMATED CONNECTION LINE (Data Sync Visual) */}
                <div className="hidden md:flex absolute top-[30%] left-10 w-1 h-[45%] border-l-2 border-dashed border-[#185FA5]/30 z-10 flex-col items-center justify-end pb-4">
                    <div className="w-4 h-4 rounded-full bg-[#185FA5]/20 flex items-center justify-center relative translate-y-3 -translate-x-0.5">
                       <div className="w-2 h-2 rounded-full bg-[#185FA5] animate-ping"></div>
                    </div>
                </div>

                {/* 2. STUDENT VIEW (Bottom Card) */}
                <div className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(24,95,165,0.12)] transform-gpu rotate-y-[2deg] rotate-x-[2deg] ml-0 md:ml-12 border-t-4 border-t-[#185FA5] relative z-20">
                    
                    <div className="bg-[#f0f7ff] px-5 md:px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                        <div className="font-black text-slate-800 flex items-center gap-2 text-sm">
                            <i className="ti ti-radar text-[#185FA5] text-lg animate-pulse"></i> Student Radar
                        </div>
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                        </div>
                    </div>

                    <div className="p-5 md:p-6 bg-white">
                        {/* Educator Info */}
                        <div className="flex items-center gap-3.5 mb-5">
                             <div className="w-10 h-10 bg-[#fff8e7] border border-[#D4AF37] text-[#854F0B] rounded-xl flex items-center justify-center font-black text-[15px] shadow-sm">
                                S
                             </div>
                             <div>
                                <div className="font-black text-slate-900 text-[14px]">Dr. Sharma</div>
                                <div className="text-[10px] font-bold text-slate-500 font-mono tracking-widest uppercase">Targeted Radar</div>
                             </div>
                        </div>
                        
                        {/* Received Exam */}
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-[#185FA5]/30">
                            <div>
                                <div className="font-black text-slate-900 text-[14px] md:text-[15px] mb-1">JEE Advanced Physics - Mock 1</div>
                                <div className="flex items-center gap-3 text-[10px] md:text-[11px] font-bold font-mono text-slate-500">
                                   <span className="text-[#10B981] flex items-center gap-1.5 border border-[#10B981]/20 bg-[#10B981]/10 px-2 py-0.5 rounded">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span> LIVE
                                   </span>
                                   <span>75 Marks</span>
                                </div>
                            </div>
                            <button className="w-full sm:w-auto px-5 py-2.5 bg-[#185FA5] text-white font-black rounded-lg text-xs shadow-md shadow-[#185FA5]/20 flex items-center justify-center gap-2 hover:bg-[#0C447C] transition-colors active:scale-95 shrink-0">
                                <i className="ti ti-login text-sm"></i> Join Test
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp} className="flex-1">
                <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-[#8B0000] text-3xl mb-6 shadow-sm">
                    <i className="ti ti-briefcase"></i>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-[#0f172a] tracking-tight mb-6 leading-tight">Command your <br/>assessment ecosystem.</h2>
                <p className="text-lg text-slate-500 mb-8 leading-relaxed font-semibold">Designed for educators who demand absolute control. Build precision tests and manage distribution directly to your following.</p>
                
                <div className="space-y-4">
                    {/* Detail 1 */}
                    <div className="flex gap-4 p-4 rounded-2xl hover:bg-white border border-transparent hover:border-slate-200 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-[#185FA5]/10 flex items-center justify-center text-[#185FA5] shrink-0 font-black"><i className="ti ti-math-symbols"></i></div>
                        <div>
                            <h4 className="font-black text-slate-900 text-lg mb-1">Dynamic Test Forging</h4>
                            <p className="text-[14px] text-slate-500 font-medium leading-relaxed">Create rigorous exams supporting MCQ, MSQ, and custom negative marking logic, fully compatible with LaTeX inputs.</p>
                        </div>
                    </div>
                    
                    {/* Detail 2 */}
                    <div className="flex gap-4 p-4 rounded-2xl hover:bg-white border border-transparent hover:border-slate-200 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-[#185FA5]/10 flex items-center justify-center text-[#185FA5] shrink-0 font-black"><i className="ti ti-radar"></i></div>
                        <div>
                            <h4 className="font-black text-slate-900 text-lg mb-1">Targeted Radar Deployment</h4>
                            <p className="text-[14px] text-slate-500 font-medium leading-relaxed">Instantly push active assessments to your followers' dashboards with a single toggle, or keep them strictly private via unique codes.</p>
                        </div>
                    </div>

                    {/* Detail 3 */}
                    <div className="flex gap-4 p-4 rounded-2xl hover:bg-white border border-transparent hover:border-slate-200 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-[#185FA5]/10 flex items-center justify-center text-[#185FA5] shrink-0 font-black"><i className="ti ti-shield-check"></i></div>
                        <div>
                            <h4 className="font-black text-slate-900 text-lg mb-1">Actionable Proctor Audits</h4>
                            <p className="text-[14px] text-slate-500 font-medium leading-relaxed">Review cryptographically signed cheat logs detailing exact timestamps of tab-switches and window blur events.</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
      </section>

      {/* ========================================= */}
      {/* 4. STUDENT EXPERIENCE (Distraction Free)  */}
      {/* ========================================= */}
      <section className="py-24 md:py-32 px-6 bg-white relative">
        <div className="max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center gap-16 lg:gap-24">
            
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp} className="flex-1">
                <div className="w-14 h-14 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center text-[#185FA5] text-3xl mb-6 shadow-sm">
                    <i className="ti ti-school"></i>
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-[#0f172a] tracking-tight mb-6 leading-tight">Distraction-free.<br/>Highly responsive.</h2>
                <p className="text-lg text-slate-500 mb-8 leading-relaxed font-semibold">Built to mimic high-stakes national-level competitive testing environments. Zero distractions, 100% focus.</p>
                
                <div className="space-y-6">
                    <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] shrink-0 font-black"><i className="ti ti-check"></i></div>
                        <div>
                            <h4 className="font-black text-slate-900 text-lg mb-1">Independent Split-Pane</h4>
                            <p className="text-[15px] text-slate-500 font-medium">Long questions and the navigation palette scroll independently, ensuring UI stability during intense calculations.</p>
                        </div>
                    </div>
                    <div className="flex gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] shrink-0 font-black"><i className="ti ti-check"></i></div>
                        <div>
                            <h4 className="font-black text-slate-900 text-lg mb-1">Auto-Save Protocol</h4>
                            <p className="text-[15px] text-slate-500 font-medium">Browser crash? Network drop? Answers are continuously encrypted in local memory and auto-synced upon reconnection.</p>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Abstract Real-World UI Demo */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={flipUp} className="flex-1 w-full relative perspective-[1200px]">
                <div className="bg-slate-50 border border-slate-200 rounded-3xl overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.08)] h-[480px] flex flex-col transform-gpu rotate-y-[5deg] rotate-x-[5deg]">
                    <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center shrink-0">
                        <div className="w-40 h-5 bg-slate-200 rounded-md"></div>
                        <div className="w-20 h-8 bg-red-50 border border-red-200 rounded-lg"></div>
                    </div>
                    <div className="flex flex-1 overflow-hidden">
                        <div className="flex-1 p-8 border-r border-slate-200 flex flex-col relative bg-white">
                            <div className="w-full h-4 bg-slate-100 rounded-md mb-4"></div>
                            <div className="w-2/3 h-4 bg-slate-100 rounded-md mb-10"></div>
                            <div className="space-y-4">
                                {[1,2,3,4].map(n => (
                                    <div key={n} className={`w-full h-14 border rounded-xl flex items-center px-5 gap-4 ${n===2 ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 bg-slate-50'}`}>
                                        <div className={`w-6 h-6 rounded-md border-2 ${n===2 ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}></div>
                                        <div className="w-1/2 h-3 bg-slate-200 rounded-md"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-48 bg-slate-50 p-5 shrink-0 flex flex-col">
                            <div className="w-24 h-4 bg-slate-200 rounded-md mb-8"></div>
                            <div className="grid grid-cols-4 gap-2">
                                {[...Array(16)].map((_, i) => (
                                    <div key={i} className={`aspect-square rounded-md border-2 flex items-center justify-center text-[11px] font-black ${i===3 ? 'bg-[#185FA5] text-white border-[#185FA5] shadow-md' : i===7 ? 'bg-[#FAC775] border-[#FAC775] text-[#633806]' : 'bg-white border-slate-200 text-slate-400'}`}>{i+1}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
      </section>

      {/* ========================================= */}
      {/* 5. INTERACTIVE PLATFORM DEMO (Upgraded)   */}
      {/* ========================================= */}
      <section className="py-20 md:py-32 px-4 md:px-6 bg-slate-50 border-y border-slate-200 relative overflow-hidden z-0">
        
        {/* 🌟 Light Glassmorphism Background */}
        <motion.div animate={{ x: [0, -30, 0], y: [0, 40, 0] }} transition={{ repeat: Infinity, duration: 15, ease: "easeInOut" }} className="absolute top-[10%] right-[10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[#185FA5] rounded-full mix-blend-multiply filter blur-[100px] md:blur-[140px] opacity-[0.06] pointer-events-none -z-20"></motion.div>
        <motion.div animate={{ x: [0, 30, 0], y: [0, -40, 0] }} transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }} className="absolute bottom-[5%] left-[5%] w-[400px] md:w-[700px] h-[400px] md:h-[700px] bg-[#D4AF37] rounded-full mix-blend-multiply filter blur-[100px] md:blur-[150px] opacity-[0.05] pointer-events-none -z-20"></motion.div>
        
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[40px] pointer-events-none -z-10"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none -z-10"></div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}>
                <h2 className="text-[#185FA5] text-[11px] md:text-xs font-black tracking-[0.2em] uppercase mb-3 md:mb-4 bg-[#185FA5]/10 text-[#185FA5] inline-block px-4 py-1.5 rounded-full border border-[#185FA5]/20 shadow-sm">Live Interface</h2>
                <h3 className="text-3xl md:text-5xl font-black text-[#0f172a] tracking-tight mb-5 md:mb-6">Experience the Sandbox.</h3>
                <p className="text-base md:text-lg text-slate-500 mb-12 md:mb-16 font-medium max-w-2xl mx-auto px-2">A functional replica of the evaluation screen. Clean separation of active questions and navigation palette.</p>
            </motion.div>

            {/* The Actual Demo Window (Responsive & Glassy) */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={flipUp} className="bg-white/95 backdrop-blur-xl rounded-[20px] md:rounded-[32px] overflow-hidden shadow-[0_20px_60px_rgba(24,95,165,0.12)] border border-white text-left mx-auto max-w-[1000px] flex flex-col h-[500px] md:h-[550px] ring-1 ring-slate-900/5">
                
                {/* Brand Header */}
                <div className="bg-[#185FA5] border-b border-[#0C447C] text-white px-5 md:px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="min-w-0">
                        <div className="font-black text-base md:text-lg leading-tight tracking-wide truncate">National Assessment Module</div>
                        <div className="text-[10px] md:text-[11px] text-blue-200 font-mono mt-0.5 font-bold truncate">UID: EXM-9921 &bull; Q 4 / 75</div>
                    </div>
                    <div className="bg-[#0C447C] border border-[#1a6ebd] px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-mono font-black text-xs md:text-sm flex items-center gap-2 shadow-inner text-white shrink-0">
                        <i className="ti ti-clock text-base"></i> <span className="hidden sm:inline">02:45:10</span>
                    </div>
                </div>
                
                {/* Body Split */}
                <div className="flex flex-1 overflow-hidden bg-white">
                    
                    {/* Q-Area */}
                    <div className="flex-1 p-5 md:p-8 flex flex-col border-r border-slate-100 relative bg-white">
                        <div className="flex justify-between items-start mb-6 md:mb-8 border-b border-slate-100 pb-4 md:pb-5">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 text-[#185FA5] rounded-xl flex items-center justify-center font-black text-lg md:text-xl border border-slate-200 shadow-sm">4</div>
                                <span className="bg-blue-50 text-[#185FA5] border border-blue-100 text-[10px] md:text-xs font-black px-2.5 md:px-3 py-1 md:py-1.5 rounded-md uppercase tracking-widest">Single Correct</span>
                            </div>
                            <span className="text-xs md:text-sm font-black text-slate-500 bg-slate-50 border border-slate-200 px-3 md:px-4 py-1.5 md:py-2 rounded-lg shrink-0">4 Marks</span>
                        </div>
                        
                        <div className="text-slate-800 font-bold mb-8 md:mb-10 text-[15px] md:text-lg leading-relaxed">
                            Evaluate the integral and select the correct physical interpretation of the resulting matrix transformation in a 3D coordinate space.
                        </div>
                        
                        <div className="space-y-3 md:space-y-4 max-h-full overflow-y-auto custom-scrollbar pb-16">
                            {['A. Orthogonal Projection', 'B. Identity Matrix Scaling', 'C. Non-linear Rotation', 'D. Zero Determinant Collapse'].map((opt, i) => (
                                <div key={i} className={`p-3.5 md:p-4 rounded-xl md:rounded-2xl flex items-center gap-4 md:gap-5 cursor-pointer transition-all border-2 ${i === 1 ? 'border-[#185FA5] bg-[#185FA5]/5 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs md:text-sm font-black shrink-0 ${i === 1 ? 'bg-[#185FA5] text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                                        {i === 1 ? <i className="ti ti-check text-base"></i> : String.fromCharCode(65+i)}
                                    </div>
                                    <div className={`font-black text-[13px] md:text-[15px] ${i===1 ? 'text-[#0f172a]' : 'text-slate-600'}`}>{opt}</div>
                                </div>
                            ))}
                        </div>

                        {/* Sticky Footer */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 border-t border-slate-100 bg-white/95 backdrop-blur-md flex justify-between items-center px-5 md:px-8">
                            <button className="px-5 md:px-6 py-2.5 md:py-3 bg-slate-100 text-slate-600 font-black rounded-xl flex items-center gap-2 hover:bg-slate-200 transition-colors text-xs md:text-sm"><i className="ti ti-arrow-left"></i> Prev</button>
                            <button className="px-6 md:px-8 py-2.5 md:py-3 bg-[#185FA5] text-white font-black rounded-xl flex items-center gap-2 shadow-lg shadow-[#185FA5]/20 hover:bg-[#0C447C] transition-colors text-xs md:text-sm">Next <i className="ti ti-arrow-right"></i></button>
                        </div>
                    </div>

                    {/* Desktop Palette */}
                    <div className="w-[300px] md:w-[340px] bg-slate-50 p-6 md:p-8 shrink-0 hidden lg:flex flex-col">
                        <div className="text-[12px] md:text-[13px] font-black text-slate-500 mb-5 md:mb-6 uppercase tracking-widest border-b border-slate-200 pb-3 md:pb-4">Question Palette</div>
                        
                        <div className="flex flex-wrap gap-2 md:gap-2.5 mb-6 md:mb-8 bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-200 justify-center shadow-sm">
                            <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-black text-slate-700 uppercase tracking-wide"><div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded bg-white border-2 border-slate-300"></div>Unvisited</div>
                            <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-black text-slate-700 uppercase tracking-wide"><div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded bg-[#185FA5] shadow-sm"></div>Answered</div>
                            <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-black text-slate-700 uppercase tracking-wide"><div className="w-3 h-3 md:w-3.5 md:h-3.5 rounded bg-[#FAC775] shadow-sm"></div>Marked</div>
                        </div>

                        <div className="grid grid-cols-5 gap-2 md:gap-3 mb-auto">
                            {[...Array(25)].map((_, i) => {
                                let n = i+1;
                                let bg = 'bg-white border-slate-200 text-slate-600 hover:border-slate-300';
                                if (n===4) bg = 'bg-white border-[#8B0000] text-[#8B0000] ring-4 ring-[#8B0000]/10 z-10 relative'; // Current
                                else if (n===1||n===2) bg = 'bg-[#185FA5] border-[#185FA5] text-white shadow-sm'; // Answered
                                else if (n===3||n===12) bg = 'bg-[#FAC775] border-[#FAC775] text-[#633806] shadow-sm'; // Marked
                                
                                return (
                                    <div key={n} className={`aspect-square rounded-lg md:rounded-xl border-2 flex items-center justify-center text-[13px] md:text-[14px] font-black cursor-pointer transition-all ${bg}`}>
                                        {n}
                                    </div>
                                )
                            })}
                        </div>
                        <button className="w-full py-4 md:py-5 bg-[#10B981] hover:bg-[#059669] text-white font-black rounded-xl md:rounded-2xl mt-6 md:mt-8 shadow-lg shadow-[#10B981]/20 flex justify-center items-center gap-2 md:gap-3 transition-colors text-sm md:text-[15px]">
                            <i className="ti ti-send text-lg md:text-xl"></i> Submit Exam
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
      </section>

      {/* ========================================= */}
      {/* 6. COMMAND PORTALS (Ultra Premium CTA)    */}
      {/* ========================================= */}
      <section id="portals" className="py-24 md:py-32 px-6 bg-slate-50 relative overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp} className="text-center mb-16 md:mb-24">
            <h2 className="text-[#185FA5] text-xs font-black tracking-[0.2em] uppercase mb-4">Authentication</h2>
            <h3 className="text-4xl md:text-6xl font-black text-[#0f172a] tracking-tight mb-6">Mount the Terminal.</h3>
            <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">Select your designated operational clearance below to initialize the system.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            
            {/* EXAMINER PORTAL CARD */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={cardPop} whileHover={{ y: -10 }} className="bg-white border-2 border-slate-100 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.04)] hover:shadow-[0_30px_80px_rgba(139,0,0,0.1)] transition-all duration-500 overflow-hidden flex flex-col relative group">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#278b00]"></div>
              <div className="p-10 md:p-12 flex flex-col h-full items-center text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-[#278b00] to-[#00575c] text-[#ffffff] rounded-3xl flex items-center justify-center text-5xl mb-8 shadow-xl shadow-[#8B0000]/20 group-hover:scale-110 transition-transform duration-500">
                    <i className="ti ti-briefcase"></i>
                  </div>
                  <h3 className="text-3xl font-black text-[#0f172a] mb-4 tracking-tight">Examiner Vault</h3>
                  <p className="text-slate-500 mb-12 text-base md:text-lg font-medium leading-relaxed">
                    Access the command matrix. Design multi-format assessments, configure penalty algorithms, and audit cryptographic cheat logs.
                  </p>
                  <button onClick={() => { localStorage.setItem('isOfflineMode', 'false'); loginWithGoogle('examiner'); }} className="mt-auto w-full py-5 bg-white border-2 border-slate-200 text-slate-800 hover:bg-[#008b13] hover:border-[#008b13] hover:text-white rounded-2xl font-black text-[16px] transition-all flex justify-center items-center gap-3 active:scale-95 shadow-sm group-hover:shadow-md">
                    Examinor Access <i className="ti ti-arrow-right text-xl"></i>
                  </button>
              </div>
            </motion.div>

            {/* STUDENT PORTAL CARD */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={cardPop} whileHover={{ y: -10 }} className="bg-white border-2 border-slate-100 rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.04)] hover:shadow-[0_30px_80px_rgba(24,95,165,0.1)] transition-all duration-500 overflow-hidden flex flex-col relative group">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#0797df]"></div>
              <div className="p-10 md:p-12 flex flex-col h-full items-center text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-[#0797df] to-[#0C447C] text-white rounded-3xl flex items-center justify-center text-5xl mb-8 shadow-xl shadow-[#185FA5]/20 group-hover:scale-110 transition-transform duration-500">
                    <i className="ti ti-school"></i>
                  </div>
                  <h3 className="text-3xl font-black text-[#0f172a] mb-4 tracking-tight">Student Terminal</h3>
                  <p className="text-slate-500 mb-12 text-base md:text-lg font-medium leading-relaxed">
                    Enter the secure execution sandbox. Engage with live radar assessments, utilize flawless formula rendering, and track performance.
                  </p>
                  <div className="mt-auto w-full flex flex-col sm:flex-row gap-4">
                    <button onClick={() => { localStorage.setItem('isOfflineMode', 'false'); loginWithGoogle('student'); }} className="flex-1 py-5 bg-[#1487c1] text-white rounded-2xl font-black text-[16px] hover:bg-[#0C447C] transition-all flex justify-center items-center gap-3 shadow-lg shadow-[#185FA5]/20 active:scale-95">
                      Student Login
                    </button>
                    <button onClick={loginAsGuest} className="w-full sm:w-auto px-10 py-5 bg-slate-50 border-2 border-slate-200 hover:bg-slate-100 text-slate-700 rounded-2xl font-black text-[16px] transition-all active:scale-95 shadow-sm">
                      Guest
                    </button>
                  </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ========================================= */}
      {/* 7. PREMIUM FOOTER (Animated & Compact)    */}
      {/* ========================================= */}
      <motion.footer 
        initial="hidden" 
        whileInView="visible" 
        viewport={{ once: true, margin: "-50px" }} 
        variants={staggerContainer} 
        className="bg-[#0f172a] pt-16 md:pt-20 pb-8 md:pb-10 px-6 border-t border-slate-800"
      >
        <div className="max-w-7xl mx-auto">
          {/* Mobile me grid-cols-2 kiya hai taaki links aamne-saamne aayein aur space bache */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-12 md:mb-16">
            
            {/* Brand & Desc (Takes full width on mobile, 1 col on PC) */}
            <motion.div variants={fadeUp} className="col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-5 md:mb-6">
                <div className="w-10 h-10 bg-[#185FA5] text-white rounded-xl flex items-center justify-center text-xl font-black shadow-lg shadow-[#185FA5]/20">E</div>
                <span className="text-2xl font-black text-white tracking-tight">ExamiTop</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">
                The next-generation assessment engine built for scale, precision, and absolute integrity. Engineered to handle high-stakes evaluations flawlessly.
              </p>
            </motion.div>

            {/* Links 1 (Takes half width on mobile) */}
            <motion.div variants={fadeUp} className="col-span-1">
              <h4 className="text-white font-black uppercase tracking-widest text-[11px] md:text-xs mb-5 md:mb-6">Ecosystem</h4>
              <ul className="space-y-3 md:space-y-4">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"><i className="ti ti-chevron-right text-[10px] text-[#185FA5]"></i> Examiner Vault</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"><i className="ti ti-chevron-right text-[10px] text-[#185FA5]"></i> Student Terminal</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"><i className="ti ti-chevron-right text-[10px] text-[#185FA5]"></i> Offline Sandbox</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"><i className="ti ti-chevron-right text-[10px] text-[#185FA5]"></i> Proctoring AI</a></li>
              </ul>
            </motion.div>

            {/* Links 2 (Takes half width on mobile) */}
            <motion.div variants={fadeUp} className="col-span-1">
              <h4 className="text-white font-black uppercase tracking-widest text-[11px] md:text-xs mb-5 md:mb-6">Legal & Support</h4>
              <ul className="space-y-3 md:space-y-4">
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"><i className="ti ti-chevron-right text-[10px] text-[#185FA5]"></i> Privacy Policy</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"><i className="ti ti-chevron-right text-[10px] text-[#185FA5]"></i> Terms of Service</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"><i className="ti ti-chevron-right text-[10px] text-[#185FA5]"></i> Documentation</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"><i className="ti ti-chevron-right text-[10px] text-[#185FA5]"></i> Help Center</a></li>
              </ul>
            </motion.div>

            {/* Contact (Takes full width on mobile) */}
            <motion.div variants={fadeUp} className="col-span-2 lg:col-span-1">
              <h4 className="text-white font-black uppercase tracking-widest text-[11px] md:text-xs mb-5 md:mb-6">Contact Matrix</h4>
              <ul className="space-y-4 md:space-y-5">
                <li className="flex items-start gap-3 group cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[#185FA5] shrink-0 group-hover:bg-[#185FA5] group-hover:text-white transition-colors"><i className="ti ti-mail text-lg"></i></div>
                  <span className="text-slate-400 text-sm font-medium group-hover:text-slate-300 transition-colors">hello@examitop.app<br/>support@examitop.app</span>
                </li>
                <li className="flex items-start gap-3 group cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[#185FA5] shrink-0 group-hover:bg-[#185FA5] group-hover:text-white transition-colors"><i className="ti ti-map-pin text-lg"></i></div>
                  <span className="text-slate-400 text-sm font-medium group-hover:text-slate-300 transition-colors">ExamiTop Global HQ<br/>Cyber City, Bangalore</span>
                </li>
              </ul>
            </motion.div>
          </div>

          {/* Bottom Copyright & Socials */}
          <motion.div variants={fadeUp} className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-5 text-center md:text-left">
            <p className="text-slate-500 text-xs font-bold tracking-wide">
              &copy; {new Date().getFullYear()} EXAMITOP ENGINE. ALL RIGHTS RESERVED.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#185FA5] hover:text-white hover:-translate-y-1 transition-all"><i className="ti ti-brand-twitter text-lg"></i></a>
              <a href="#" className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#185FA5] hover:text-white hover:-translate-y-1 transition-all"><i className="ti ti-brand-github text-lg"></i></a>
              <a href="#" className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#185FA5] hover:text-white hover:-translate-y-1 transition-all"><i className="ti ti-brand-linkedin text-lg"></i></a>
            </div>
          </motion.div>
        </div>
      </motion.footer>

      {/* ========================================= */}
      {/* 8. OFFLINE MODAL (Enterprise Style)       */}
      {/* ========================================= */}
      <AnimatePresence>
        {showOfflineModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-slate-900/70 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20, rotateX: 10 }} animate={{ scale: 1, y: 0, rotateX: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: "spring", stiffness: 100, damping: 20 }} className="bg-white border-2 border-slate-200 rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden perspective-[1000px]">
              
              <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                 <div className="text-xs font-black text-slate-500 flex items-center gap-2 uppercase tracking-widest">
                    <i className="ti ti-server-off text-[#854F0B] text-lg"></i> Local Execution
                 </div>
                 <button onClick={() => setShowOfflineModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-800 transition-colors"><i className="ti ti-x text-lg"></i></button>
              </div>

              <div className="p-8">
                <h3 className="text-2xl font-black text-slate-900 mb-3">Initialize Offline Protocol</h3>
                <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-900">
                    Data will be cryptographically written to this device's IndexedDB. <strong className="font-black">No external internet connection required.</strong>
                </p>
                
                <div className="space-y-4">
                    <button onClick={() => { localStorage.setItem('isOfflineMode', 'true'); router.push('/create'); }} className="w-full p-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-100 hover:border-[#185FA5] text-left transition-all flex items-center gap-5 group shadow-sm hover:shadow-md">
                        <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-[#185FA5] text-2xl group-hover:scale-110 transition-transform"><i className="ti ti-pencil"></i></div>
                        <span className="font-black text-[16px] text-slate-800 group-hover:text-[#185FA5]">Create Offline Exam</span>
                    </button>
                    
                    <button onClick={() => { localStorage.setItem('isOfflineMode', 'true'); router.push('/student'); }} className="w-full p-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-100 hover:border-[#3B6D11] text-left transition-all flex items-center gap-5 group shadow-sm hover:shadow-md">
                        <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center text-[#3B6D11] text-2xl group-hover:scale-110 transition-transform"><i className="ti ti-school"></i></div>
                        <span className="font-black text-[16px] text-slate-800 group-hover:text-[#3B6D11]">Mount Test Terminal</span>
                    </button>
                    
                    <button onClick={() => { localStorage.setItem('isOfflineMode', 'true'); router.push('/tests'); }} className="w-full p-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-100 hover:border-[#854F0B] text-left transition-all flex items-center gap-5 group shadow-sm hover:shadow-md">
                        <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center text-[#854F0B] text-2xl group-hover:scale-110 transition-transform"><i className="ti ti-database"></i></div>
                        <span className="font-black text-[16px] text-slate-800 group-hover:text-[#854F0B]">Access Local Vault</span>
                    </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #94a3b8; }
      `}</style>
    </div>
  );
}