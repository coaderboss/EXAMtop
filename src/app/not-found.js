// src/app/not-found.js
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] bg-slate-50 px-6 text-center overflow-hidden">
      
      {/* 🔥 CUSTOM FUNNY ANIMATIONS 🔥 */}
      <style>{`
        @keyframes floatUFO {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-15px) rotate(5deg); }
          50% { transform: translateY(-25px) rotate(0deg); }
          75% { transform: translateY(-15px) rotate(-5deg); }
        }
        @keyframes shadowMove {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(0.5); opacity: 0.05; }
        }
        @keyframes ringSpin {
          0% { transform: translate(-50%, -50%) rotateX(65deg) rotateZ(0deg); }
          100% { transform: translate(-50%, -50%) rotateX(65deg) rotateZ(360deg); }
        }
      `}</style>

      {/* Floating 404 UFO Element */}
      <div className="relative mb-2 animate-[floatUFO_4s_ease-in-out_infinite]">
        
        {/* The Pod */}
        <div className="relative z-10 w-36 h-36 bg-white rounded-full border-[6px] border-slate-100 shadow-[0_15px_35px_rgba(0,0,0,0.1)] flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute top-0 w-full h-1/2 bg-blue-50/50"></div>
            <span className="text-5xl font-black text-slate-800 drop-shadow-sm relative z-10 tracking-tighter">404</span>
            <i className="ti ti-alien text-3xl text-emerald-500 mt-1 relative z-10 animate-pulse"></i>
        </div>
        
        {/* Spinning Rings (UFO Effect) */}
        <div className="absolute top-1/2 left-1/2 w-[220px] h-[220px] border-4 border-blue-400 rounded-full opacity-40 animate-[ringSpin_3s_linear_infinite]" style={{ transformStyle: 'preserve-3d' }}></div>
        <div className="absolute top-1/2 left-1/2 w-[240px] h-[240px] border-[3px] border-dashed border-indigo-400 rounded-full opacity-30 animate-[ringSpin_6s_linear_infinite_reverse]" style={{ transformStyle: 'preserve-3d' }}></div>
      </div>

      {/* Dynamic Floor Shadow */}
      <div className="w-24 h-3 bg-slate-500 rounded-[50%] animate-[shadowMove_4s_ease-in-out_infinite] mb-10 blur-[2px]"></div>

      {/* Funny Copy (The "Out of Syllabus" joke!) */}
      <h1 className="text-3xl sm:text-4xl font-black text-slate-800 mb-3 tracking-tight">
         Out of Syllabus! 🛸
      </h1>
      
      <p className="text-slate-500 text-sm sm:text-[15px] font-medium max-w-md mb-8 leading-relaxed">
        Houston, we have a problem. You've wandered into the Bermuda Triangle of this portal. This page either evaporated or the dog ate its source code.
      </p>
      
      {/* Action Button */}
      <Link href="/" className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[15px] rounded-xl shadow-[0_8px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_12px_25px_rgba(37,99,235,0.4)] hover:-translate-y-1 transition-all flex items-center gap-2 group">
        <i className="ti ti-rocket text-xl group-hover:-translate-y-1 transition-transform"></i> Abort Mission (Go Home)
      </Link>
      
    </div>
  );
}