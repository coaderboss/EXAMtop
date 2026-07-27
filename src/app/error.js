// src/app/error.js
"use client";
import { useEffect } from "react";
import Link from "next/link";
import { database } from "../lib/firebase"; 
import { ref, push, set } from "firebase/database";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // 1. Console me dikhane ke liye
    console.error("ExamiTop Global Error Caught:", error);

    // 2. Secretly Firebase me log karne ke liye
    const logErrorToDB = async () => {
      try {
        const errorRef = ref(database, "system_errors");
        const newErrorLog = push(errorRef);
        
        await set(newErrorLog, {
          message: error.message || "Unknown Error",
          stack: error.stack || "No stack trace",
          url: typeof window !== "undefined" ? window.location.href : "Server/Unknown",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
          timestamp: new Date().toISOString(),
          status: "unresolved" // Admin panel me mark as resolved karne ke kaam aayega
        });
      } catch (dbError) {
        // Agar logging me hi error aa jaye toh kam se kam console me dikhe
        console.error("Failed to log error to Firebase:", dbError);
      }
    };

    logErrorToDB();
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center animate-[fadeIn_0.4s_ease]">
      {/* Premium Animated Alert Icon */}
      <div className="w-24 h-24 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-5xl mb-6 shadow-lg shadow-rose-500/10 border-2 border-rose-100 relative">
        <div className="absolute inset-0 rounded-full border-4 border-rose-100 animate-[ping_2s_ease-in-out_infinite]"></div>
        <i className="ti ti-alert-triangle relative z-10"></i>
      </div>
      
      <h1 className="text-3xl sm:text-4xl font-black text-slate-800 mb-4 tracking-tight">
        Oops! Something went wrong.
      </h1>
      
      <p className="text-[15px] text-slate-500 mb-8 max-w-md font-medium leading-relaxed">
        We hit a small snag in the system, but don't worry—your data is completely safe. Our engineering team has been automatically notified.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-md mx-auto justify-center">
        <button
          onClick={() => reset()}
          className="px-6 py-3.5 bg-[#185FA5] hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <i className="ti ti-refresh text-lg"></i> Try Again
        </button>
        
        <Link
          href="/"
          className="px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <i className="ti ti-home text-lg"></i> Go Home
        </Link>
      </div>

      <div className="mt-12 text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
        <i className="ti ti-shield-check text-base"></i> ExamiTop Secure Environment
      </div>
    </div>
  );
}