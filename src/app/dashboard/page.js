// src/app/dashboard/page.js
"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useData } from "../../context/DataContext";
import { useRouter } from "next/navigation";
import { database } from "../../lib/firebase";
import { ref, get } from "firebase/database";

export default function ExaminerDashboard() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const { fetchMyTests, tests } = useData();
  const router = useRouter();

  const [tokens, setTokens] = useState({ free: 0, premium: 0, unlimited: false });
  const [followersCount, setFollowersCount] = useState(0);
  const [isFetching, setIsFetching] = useState(true);

  // Calendar States
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarScrollRef = useRef(null);

  // Security Bouncer
  useEffect(() => {
    if (!authLoading && (!currentUser || (userRole !== "examiner" && userRole !== "admin"))) {
      router.replace("/");
    }
  }, [currentUser, userRole, authLoading, router]);

  // Fetch Data (Tokens, Followers & Tests)
  useEffect(() => {
    if (currentUser) {
      // 1. Fetch Tokens & Quota
      get(ref(database, `users/${currentUser.uid}`)).then((snap) => {
        if (snap.exists()) {
          const data = snap.val();
          setTokens({
            free: data.free_tokens !== undefined ? data.free_tokens : Math.min(3, data.available_quota || 0),
            premium: data.premium_tokens || 0,
            unlimited: data.is_unlimited || data.plan === "unlimited"
          });
        }
      });

      // 2. Fetch Total Followers
      get(ref(database, "users")).then((snap) => {
        if (snap.exists()) {
          const allUsers = snap.val() || {};
          let count = 0;
          Object.values(allUsers).forEach((u) => {
            if (u.followed) {
              if (Array.isArray(u.followed) && (u.followed.includes(currentUser.uid) || (currentUser.examinerId && u.followed.includes(currentUser.examinerId)))) {
                count++;
              } else if (typeof u.followed === "object" && (u.followed[currentUser.uid] || (currentUser.examinerId && u.followed[currentUser.examinerId]))) {
                count++;
              }
            }
          });
          setFollowersCount(count);
        }
      });

      // 3. Fetch My Tests
      fetchMyTests(currentUser.uid).finally(() => setIsFetching(false));
    }
  }, [currentUser]);

  // Auto-scroll Calendar to Selected Date
  useEffect(() => {
    if (calendarScrollRef.current) {
      const activeEl = calendarScrollRef.current.querySelector(".is-active-day");
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [currentMonthDate]);

  const jumpToTestVault = (testId) => {
    sessionStorage.setItem("examitop_activeTestId", testId);
    router.push("/tests");
  };

  if (authLoading || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      </div>
    );
  }

  // --- DATA CALCULATIONS ---
  const now = Date.now();
  const validTests = tests.filter(t => !t.isDeletedByExaminer);
  
  const scheduledExams = validTests.filter(t => t.openDate && new Date(t.openDate).getTime() > now)
                                   .sort((a, b) => new Date(a.openDate) - new Date(b.openDate));
  
  const recentExams = [...validTests].sort((a, b) => b.id - a.id).slice(0, 3);
  
  const activeExamsCount = validTests.filter(t => {
      const closeTime = t.closeDate ? new Date(t.closeDate).getTime() : null;
      const openTime = t.openDate ? new Date(t.openDate).getTime() : null;
      return t.isActive !== false && (!closeTime || now <= closeTime) && (!openTime || now >= openTime);
  }).length;

  const totalSubmissions = validTests.reduce((acc, t) => acc + (t.submissions ? (Array.isArray(t.submissions) ? t.submissions.filter(Boolean).length : Object.keys(t.submissions).length) : 0), 0);

  // --- CALENDAR LOGIC ---
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  };
  const monthDays = getDaysInMonth(currentMonthDate);
  const examDatesStrings = scheduledExams.map(t => new Date(t.openDate).toDateString());

  const prevMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));

  // Filter Upcoming Intakes based on Selected Date
  const examsOnSelectedDate = scheduledExams.filter(t => new Date(t.openDate).toDateString() === selectedDate.toDateString());

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 bg-slate-50/30 min-h-screen animate-[fadeIn_0.4s_ease]">
      
      {/* 🚀 HEADER GREETING */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-black text-slate-800 tracking-tight mb-1 flex items-center gap-2">
            Overview <span className="opacity-25 mx-1">/</span> {currentUser?.displayName?.split(" ")[0] || "Educator"} <span className="animate-pulse">👋</span>
          </h1>
          <p className="text-slate-500 font-semibold text-[13px] sm:text-[14px]">
            Here is your live platform metrics, audience reach, and exam timeline.
          </p>
        </div>
        <button 
          onClick={() => router.push('/create')}
          className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm rounded-2xl shadow-[0_8px_20px_rgba(37,99,235,0.22)] hover:shadow-[0_12px_28px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 shrink-0"
        >
          <i className="ti ti-pencil-plus text-lg"></i> Forge New Exam
        </button>
      </div>

      {/* 📅 ROW 1: HORIZONTAL SOFT CALENDAR */}
      <div className="bg-white rounded-[28px] p-4 sm:p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 mb-6 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base font-black shadow-sm">
              <i className="ti ti-calendar-event"></i>
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-800 leading-none">
                {currentMonthDate.toLocaleString('default', { month: 'long' })} {currentMonthDate.getFullYear()}
              </h2>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">Timeline Schedule</p>
            </div>
          </div>
          <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm transition-all"><i className="ti ti-chevron-left text-sm"></i></button>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm transition-all"><i className="ti ti-chevron-right text-sm"></i></button>
          </div>
        </div>

        {/* Horizontal Dates Scroller */}
        <div ref={calendarScrollRef} className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar snap-x">
          {monthDays.map((date, idx) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            const hasExam = examDatesStrings.includes(date.toDateString());
            const dayName = date.toLocaleDateString('en-IN', { weekday: 'short' });

            return (
              <div 
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`snap-center shrink-0 w-[58px] h-[76px] rounded-[20px] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative border ${isSelected ? 'is-active-day bg-blue-600 text-white shadow-[0_6px_18px_rgba(37,99,235,0.3)] border-blue-600 -translate-y-0.5' : isToday ? 'is-today bg-blue-50/80 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-slate-50/60 text-slate-600 border-slate-100 hover:border-slate-300 hover:bg-white'}`}
              >
                <span className={`text-[9px] font-extrabold uppercase tracking-widest mb-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{dayName}</span>
                <span className="text-[19px] font-black leading-none">{date.getDate()}</span>
                
                {hasExam && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${isSelected ? 'bg-white' : 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]'}`}></span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 ROW 2: 4-CARD HIGH-DENSITY BENTO MATRIX */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        
        {/* CARD 1: PLATFORM QUOTA */}
        <div className="bg-white rounded-[26px] p-5 shadow-[0_8px_25px_rgb(0,0,0,0.03)] hover:shadow-[0_14px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 border border-slate-100 flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center text-sm shadow-sm"><i className="ti ti-wallet"></i></div>
                Platform Quota
              </div>
              <button 
                onClick={() => router.push('/pricing')}
                className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 border border-amber-200/60"
              >
                Manage <i className="ti ti-arrow-right text-[10px]"></i>
              </button>
            </div>

            <div className="my-2">
              {tokens.unlimited ? (
                <div className="text-[22px] font-black text-[#D4AF37] flex items-center gap-2">
                  <i className="ti ti-infinity text-2xl"></i> UNLIMITED PRO
                </div>
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-[34px] font-black text-slate-800 leading-none tracking-tight">{tokens.free + tokens.premium}</span>
                  <span className="text-[12px] font-bold text-slate-400">Tokens Left</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
            <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/80">Free: {tokens.free}</span>
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200/80 flex items-center gap-1">
              <i className="ti ti-diamond text-[10px]"></i> Pro: {tokens.premium}
            </span>
          </div>
        </div>

        {/* CARD 2: VAULT & ACTIVE INTAKES */}
        <div className="bg-white rounded-[26px] p-5 shadow-[0_8px_25px_rgb(0,0,0,0.03)] hover:shadow-[0_14px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 border border-slate-100 flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm shadow-sm"><i className="ti ti-files"></i></div>
                Exams Vault
              </div>
              <button 
                onClick={() => router.push('/tests')}
                className="text-slate-400 hover:text-blue-600 text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1"
              >
                Vault <i className="ti ti-arrow-right text-[10px]"></i>
              </button>
            </div>

            <div className="my-2 flex items-baseline gap-2">
              <span className="text-[34px] font-black text-slate-800 leading-none tracking-tight">{validTests.length}</span>
              <span className="text-[12px] font-bold text-slate-400">Total Exams</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> {activeExamsCount} Live Intakes
            </span>
            <span className="text-slate-400 text-[10px]">{scheduledExams.length} Scheduled</span>
          </div>
        </div>

        {/* CARD 3: TOTAL SUBMISSIONS */}
        <div className="bg-white rounded-[26px] p-5 shadow-[0_8px_25px_rgb(0,0,0,0.03)] hover:shadow-[0_14px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 border border-slate-100 flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm shadow-sm"><i className="ti ti-checkbox"></i></div>
                Evaluations
              </div>
              <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">Live Sync</span>
            </div>

            <div className="my-2 flex items-baseline gap-2">
              <span className="text-[34px] font-black text-slate-800 leading-none tracking-tight">{totalSubmissions}</span>
              <span className="text-[12px] font-bold text-slate-400">Responses</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1 text-emerald-600 font-bold">
              <i className="ti ti-bolt text-xs"></i> 100% Auto-Graded
            </span>
            <span className="text-slate-400 text-[10px]">All Papers</span>
          </div>
        </div>

        {/* CARD 4: EDUCATOR RADAR & FOLLOWERS (NEW) */}
        <div className="bg-white rounded-[26px] p-5 shadow-[0_8px_25px_rgb(0,0,0,0.03)] hover:shadow-[0_14px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 border border-slate-100 flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center text-sm shadow-sm"><i className="ti ti-radar"></i></div>
                Radar Reach
              </div>
              <span className="bg-rose-50 text-rose-600 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">Audience</span>
            </div>

            <div className="my-2 flex items-baseline gap-2">
              <span className="text-[34px] font-black text-slate-800 leading-none tracking-tight">{followersCount}</span>
              <span className="text-[12px] font-bold text-slate-400">Followers</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <span className="text-slate-500 flex items-center gap-1 font-semibold">
              <i className="ti ti-users text-xs text-rose-500"></i> Connected Students
            </span>
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-black">Active</span>
          </div>
        </div>

      </div>

      {/* 🚀 ROW 3: RECENT HISTORY & DATE INTAKES (50/50 SPLIT) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        
        {/* Left Column: Recent History */}
        <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-[0_8px_25px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[12px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="ti ti-history text-indigo-500 text-base"></i> Recent Forged Exams
              </h3>
              <button onClick={() => router.push('/tests')} className="text-slate-400 hover:text-blue-600 text-[11px] font-bold uppercase transition-colors">
                View All
              </button>
            </div>
            
            {recentExams.length === 0 ? (
              <div className="text-center py-8">
                <i className="ti ti-ghost text-3xl text-slate-200 mb-2 block"></i>
                <p className="text-slate-400 font-bold text-xs">No recent exams found.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recentExams.map((t) => (
                  <div key={t.id} onClick={() => jumpToTestVault(t.id)} className="bg-slate-50/60 rounded-2xl p-3.5 border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 transition-all cursor-pointer group flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors shrink-0 shadow-sm">
                        <i className="ti ti-file-text text-base"></i>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[13.5px] font-bold text-slate-800 group-hover:text-blue-700 transition-colors m-0 leading-tight truncate">{t.title}</h4>
                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider flex items-center gap-2">
                          <span>#{t.code}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="text-emerald-600 font-black">{t.submissions ? t.submissions.length : 0} Subs</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0 transition-all flex items-center gap-1 shrink-0">
                      Open <i className="ti ti-arrow-right"></i>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Date Intakes */}
        <div className="bg-white rounded-[28px] p-5 sm:p-6 shadow-[0_8px_25px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[12px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="ti ti-clock-play text-blue-500 text-base"></i> Scheduled For Selected Date
              </h3>
              <span className="bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider">
                {selectedDate.toDateString() === new Date().toDateString() ? 'Today' : selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            
            {examsOnSelectedDate.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm border border-slate-200">
                  <i className="ti ti-calendar-cancel text-lg text-slate-300"></i>
                </div>
                <div className="text-xs font-black text-slate-700">Schedule is Clear</div>
                <div className="text-[10px] font-semibold text-slate-400 mt-0.5">No exams scheduled for this date.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {examsOnSelectedDate.map((t) => {
                  const dateObj = new Date(t.openDate);
                  return (
                    <div key={t.id} onClick={() => jumpToTestVault(t.id)} className="bg-slate-50/60 rounded-2xl p-3.5 border border-slate-100 hover:bg-indigo-50/50 hover:border-indigo-200 transition-all cursor-pointer group flex items-start gap-3">
                      <div className="flex flex-col items-center mt-1 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]"></div>
                        <div className="w-px h-full bg-blue-200 mt-1.5"></div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-0.5">
                          {dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[13.5px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors leading-tight truncate mb-1">{t.title}</div>
                        <div className="text-[10px] font-semibold text-slate-400">
                          Code: #{t.code}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}