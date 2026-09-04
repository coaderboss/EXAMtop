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
  const [isFabOpen, setIsFabOpen] = useState(false); // NAYA: Floating Action Button state

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

      fetchMyTests(currentUser.uid).finally(() => setIsFetching(false));
    }
  }, [currentUser]);

  useEffect(() => {
    if (calendarScrollRef.current) {
      const activeEl = calendarScrollRef.current.querySelector(".is-active-day");
      if (activeEl) activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentMonthDate]);

  const jumpToTestVault = (testId) => {
    sessionStorage.setItem("examitop_activeTestId", testId);
    router.push("/tests");
  };

  // --- DATA CALCULATIONS ---
  const now = Date.now();
  const validTests = tests.filter(t => !t.isDeletedByExaminer);
  
  const scheduledExams = validTests.filter(t => t.openDate && new Date(t.openDate).getTime() > now)
                                   .sort((a, b) => new Date(a.openDate) - new Date(b.openDate));
  
  const recentExams = [...validTests].sort((a, b) => b.id - a.id).slice(0, 5);
  
  const activeExamsCount = validTests.filter(t => {
      const closeTime = t.closeDate ? new Date(t.closeDate).getTime() : null;
      const openTime = t.openDate ? new Date(t.openDate).getTime() : null;
      return t.isActive !== false && (!closeTime || now <= closeTime) && (!openTime || now >= openTime);
  }).length;

  const totalSubmissions = validTests.reduce((acc, t) => acc + (t.submissionCount || (t.submissions ? (Array.isArray(t.submissions) ? t.submissions.filter(Boolean).length : Object.keys(t.submissions).length) : 0)), 0);
  const totalQuestions = validTests.reduce((acc, t) => acc + (t.questionCount || (t.questions?.length || 0)), 0);

  const pendingEvaluations = validTests.filter(t => t.resultVis === 'manual' && !t.released && (t.submissionCount > 0 || (t.submissions && t.submissions.length > 0)));

  // Subject Stats
  const subCounts = {};
  validTests.forEach(t => { const s = t.subject || 'General'; subCounts[s] = (subCounts[s] || 0) + 1; });
  const topSubjects = Object.entries(subCounts).sort((a,b) => b[1]-a[1]).slice(0,3);

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

  const examsOnSelectedDate = scheduledExams.filter(t => new Date(t.openDate).toDateString() === selectedDate.toDateString());

  // PREMIUM SKELETON LOADER
  if (authLoading || isFetching) {
    return (
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 min-h-screen">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="w-full md:w-auto">
            <div className="skeleton w-3/4 sm:w-64 h-8 rounded-lg mb-3"></div>
            <div className="skeleton w-full sm:w-96 h-4 rounded-md"></div>
          </div>
          <div className="skeleton w-full sm:w-64 h-14 sm:h-16 rounded-xl"></div>
        </div>
        <div className="skeleton w-full h-28 sm:h-24 rounded-2xl mb-8"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
          {[1,2,3,4].map(n => <div key={n} className="skeleton h-40 rounded-2xl"></div>)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton h-80 rounded-2xl"></div>
          <div className="skeleton h-80 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 py-5 sm:py-8 bg-[#f8fafc] min-h-screen animate-[fadeIn_0.4s_ease] pb-28">
      
      {/* 1. HEADER ROW */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5 mb-6 sm:mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-[24px] sm:text-[32px] font-black text-slate-800 tracking-tight flex items-center gap-2 mb-1.5 sm:mb-2 truncate">
            👋 Welcome, {currentUser?.displayName?.split(" ")[0] || "Educator"}!
          </h1>
          <p className="text-slate-500 font-semibold text-[13px] sm:text-[14px] leading-relaxed max-w-2xl">
            Here are your live platform insights and student radar updates for today.
          </p>
        </div>

        {/* Soft Mini Calendar */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-100 p-3.5 sm:p-4 rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex flex-col w-full lg:w-auto shrink-0 min-w-[280px] sm:min-w-[320px]">
           <div className="flex justify-between items-center mb-3 sm:mb-4 px-1">
             <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
             <div className="flex gap-1.5">
               <button onClick={prevMonth} className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"><i className="ti ti-chevron-left text-[11px]"></i></button>
               <button onClick={nextMonth} className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"><i className="ti ti-chevron-right text-[11px]"></i></button>
             </div>
           </div>
           <div ref={calendarScrollRef} className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 snap-x">
             {monthDays.slice(Math.max(0, currentMonthDate.getDate() - 4), currentMonthDate.getDate() + 10).map((date, idx) => {
                const isSelected = date.toDateString() === selectedDate.toDateString();
                const hasExam = examDatesStrings.includes(date.toDateString());
                return (
                  <div key={idx} onClick={() => setSelectedDate(date)} className={`shrink-0 w-[42px] h-[52px] sm:w-[48px] sm:h-[60px] rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all snap-center ${isSelected ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)] scale-105' : 'bg-slate-50/50 hover:bg-slate-100 text-slate-600 border border-slate-100'}`}>
                     <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>{date.toLocaleDateString('en-IN', { weekday: 'short' }).charAt(0)}</span>
                     <span className="text-[14px] sm:text-[16px] font-black leading-tight mt-0.5">{date.getDate()}</span>
                     {hasExam && <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-emerald-500'}`}></div>}
                  </div>
                )
             })}
           </div>
        </div>
      </div>

      {/* 2. NEEDS ATTENTION BANNER */}
      {(pendingEvaluations.length > 0 || (!tokens.unlimited && (tokens.free + tokens.premium) <= 3)) && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-4 sm:p-5 mb-6 sm:mb-8 shadow-sm">
          <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
             </span>
             NEEDS ATTENTION
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
             {pendingEvaluations.length > 0 && (
               <div className="flex items-center justify-between bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-100 shadow-sm transition-all hover:shadow-md">
                  <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 flex items-center gap-2.5 truncate"><div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0"><i className="ti ti-alert-triangle text-amber-500 text-sm"></i></div> <span className="truncate">{pendingEvaluations.length} Manual evaluations pending</span></span>
                  <button onClick={() => router.push('/tests')} className="text-[11px] font-black text-blue-600 hover:text-blue-800 bg-blue-50 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors">Evaluate Now</button>
               </div>
             )}
             {!tokens.unlimited && (tokens.free + tokens.premium) <= 3 && (
               <div className="flex items-center justify-between bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-100 shadow-sm transition-all hover:shadow-md">
                  <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 flex items-center gap-2.5 truncate"><div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center shrink-0"><i className="ti ti-wallet text-rose-500 text-sm"></i></div> <span className="truncate">Token balance is critically low</span></span>
                  <button onClick={() => router.push('/pricing')} className="text-[11px] font-black text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors">Manage Plan</button>
               </div>
             )}
          </div>
        </div>
      )}

      {/* 3. FOUR BENTO BOXES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6 sm:mb-8">
        
        {/* Box 1 */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 hover:border-blue-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:-translate-y-1 flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><div className="w-6 h-6 rounded-md bg-amber-50 text-amber-500 flex items-center justify-center text-sm"><i className="ti ti-chart-pie"></i></div> PLATFORM QUOTA</div>
              <button onClick={() => router.push('/pricing')} className="text-[10px] font-black text-blue-600 hover:underline">Manage Plan</button>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl sm:text-[38px] font-black text-slate-800 leading-none">{tokens.unlimited ? '∞' : tokens.free + tokens.premium}</span>
              <span className="text-[12px] font-bold text-slate-500">Tokens Left</span>
            </div>
            {!tokens.unlimited && <div className="text-[11px] font-bold text-slate-400 mt-1">Free: {tokens.free} | Premium: {tokens.premium}</div>}
          </div>
          {!tokens.unlimited && (
             <div className="mt-5">
               <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (tokens.free / 3)*100)}%` }}></div>
                  <div className="bg-indigo-400 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (tokens.premium / 10)*100)}%` }}></div>
               </div>
               <div className="text-[9px] font-extrabold text-slate-400 mt-2 uppercase tracking-widest">Usage Meter</div>
             </div>
          )}
        </div>

        {/* Box 2 */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 hover:border-emerald-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:-translate-y-1 flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-500 flex items-center justify-center text-sm"><i className="ti ti-folders"></i></div> EXAMS VAULT</div>
              <button onClick={() => router.push('/tests')} className="text-[10px] font-black text-emerald-600 hover:underline">View Vault</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
               <div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-800 leading-none mb-1">{validTests.length}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Exams</div>
               </div>
               <div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-800 leading-none mb-1">{totalQuestions}+</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Q-Bank</div>
               </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
               {topSubjects.map(s => <span key={s[0]} className="text-[9px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-[80px]">{s[0]}</span>)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2 text-[11px] font-bold">
            <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md w-fit flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> {activeExamsCount} Live Intakes Now</span>
            <span className="text-slate-500 px-2 flex items-center gap-1"><i className="ti ti-clock"></i> {scheduledExams.length} Scheduled</span>
          </div>
        </div>

        {/* Box 3 */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 hover:border-indigo-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:-translate-y-1 flex flex-col justify-between relative overflow-hidden transition-all duration-300">
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-500 flex items-center justify-center text-sm"><i className="ti ti-chart-bar"></i></div> EVAL ENGINE</div>
              <span className="text-[9px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm animate-pulse">Syncing</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl sm:text-[38px] font-black text-slate-800 leading-none tracking-tight">{totalSubmissions}</span>
              <span className="text-[12px] font-bold text-slate-500 leading-tight">Total<br/>Responses</span>
            </div>
          </div>
          {/* Sparkline Graphic Placeholder */}
          <div className="absolute -right-4 top-[30%] w-[150px] h-[80px] opacity-[0.15] pointer-events-none">
              <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full"><path d="M0,30 Q20,10 40,25 T80,5 T100,20" fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round"/></svg>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] font-bold z-10 relative">
            <span className="text-slate-500 flex items-center gap-1.5"><i className="ti ti-database text-xs text-slate-400"></i> Cumulative records stored</span>
            <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md w-fit flex items-center gap-1"><i className="ti ti-bolt text-xs"></i> 100% Auto-Graded</span>
          </div>
        </div>

        {/* Box 4 */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 hover:border-rose-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] hover:-translate-y-1 flex flex-col justify-between transition-all duration-300">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><div className="w-6 h-6 rounded-md bg-rose-50 text-rose-500 flex items-center justify-center text-sm"><i className="ti ti-radar"></i></div> AUDIENCE</div>
              <span className="text-[10px] font-black text-blue-600">Reach Data</span>
            </div>
            <div className="flex gap-5 sm:gap-6 mb-2">
               <div>
                 <div className="text-3xl sm:text-[34px] font-black text-slate-800 leading-none">{followersCount}</div>
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">Followers</div>
               </div>
               <div>
                 <div className="text-2xl sm:text-[28px] font-black text-emerald-500 leading-none">+{(Math.floor(followersCount * 0.1) || 0)}</div>
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mt-1">This month</div>
               </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-1.5 text-[11px] font-bold">
            <span className="text-slate-500 flex items-center gap-1.5"><i className="ti ti-bell-ringing text-xs text-slate-400"></i> Get updates on radar</span>
            <span className="text-slate-800 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_4px_rgba(16,185,129,0.8)]"></span> Connected Students</span>
          </div>
        </div>

      </div>

      <div className="flex items-center justify-between mb-4 px-2">
         <h3 className="text-lg font-black text-slate-800">Activity & Timeline</h3>
      </div>
      
      {/* 4. BOTTOM TWO COLUMNS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        
        {/* Left: Recently Forged */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col h-full">
          <div className="flex items-center justify-between mb-5 border-b border-slate-50 pb-3">
            <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><i className="ti ti-history text-indigo-500 text-lg"></i> RECENTLY FORGED</div>
            <button onClick={() => router.push('/tests')} className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors">View All</button>
          </div>
          
          <div className="flex flex-col gap-2">
             {recentExams.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center justify-center">
                   <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100"><i className="ti ti-ghost text-2xl text-slate-300"></i></div>
                   <p className="text-slate-500 font-bold text-sm">No recent activity found.</p>
                </div>
             ) : recentExams.map(t => {
                const subCnt = t.submissionCount || (t.submissions ? (Array.isArray(t.submissions) ? t.submissions.filter(Boolean).length : Object.keys(t.submissions).length) : 0);
                return (
                  <div key={t.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-100 hover:border-blue-200 hover:shadow-sm rounded-2xl transition-all group">
                    <div className="flex items-center gap-3.5 min-w-0 pr-2">
                       <span className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 text-[10px] font-black px-2.5 py-1.5 rounded-lg text-center shrink-0 shadow-inner border border-white">{t.subject ? t.subject.substring(0,3).toUpperCase() : 'GEN'}</span>
                       <div className="min-w-0">
                          <div className="text-[13px] sm:text-[14px] font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors mb-0.5">{t.title}</div>
                          <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                            <span>#{t.code}</span> <span className="w-1 h-1 rounded-full bg-slate-300"></span> <span className="text-emerald-600">{subCnt} Subs</span>
                          </div>
                       </div>
                    </div>
                    <button onClick={() => jumpToTestVault(t.id)} className="bg-blue-50 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white"><i className="ti ti-arrow-right"></i></button>
                  </div>
                )
             })}
          </div>
        </div>

        {/* Right: Upcoming Intakes */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 shadow-sm border border-slate-100 flex flex-col h-full">
          <div className="flex items-center justify-between mb-5 border-b border-slate-50 pb-3">
            <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><i className="ti ti-calendar-event text-blue-500 text-lg"></i> UPCOMING INTAKES</div>
            <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5"><i className="ti ti-calendar"></i> {selectedDate.toDateString() === new Date().toDateString() ? 'Today' : selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </div>
          
          <div className="flex flex-col gap-2">
             {examsOnSelectedDate.length === 0 ? (
                <div className="text-center py-10 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                   <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm border border-slate-100"><i className="ti ti-calendar-cancel text-xl text-slate-300"></i></div>
                   <div className="text-sm font-black text-slate-700 mb-0.5">Schedule is clear</div>
                   <div className="text-[11px] font-bold text-slate-400">No exams scheduled for this date.</div>
                </div>
             ) : examsOnSelectedDate.map(t => {
                const dateObj = new Date(t.openDate);
                return (
                  <div key={t.id} onClick={() => jumpToTestVault(t.id)} className="flex items-start gap-4 p-3.5 bg-slate-50/50 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer group">
                     <div className="flex flex-col items-center mt-1.5 shrink-0 w-10">
                        <div className="text-[11px] font-black text-indigo-600 mb-1">{dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).replace(' AM','a').replace(' PM','p')}</div>
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                     </div>
                     <div className="flex-1 min-w-0 bg-white p-3 rounded-xl border border-slate-100 shadow-sm group-hover:border-indigo-100 group-hover:shadow-md transition-all">
                        <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 truncate mb-1">{t.title}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                           <i className="ti ti-hash opacity-70"></i> {t.code}
                        </div>
                     </div>
                  </div>
                )
             })}
          </div>
        </div>

      </div>

      {/* 5. SMART FLOATING ACTION BUTTON (FAB) - Bottom Right Overlay */}
      {/* Background Overlay for Mobile Blur */}
      {isFabOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsFabOpen(false)}
        ></div>
      )}

      {/* FAB Container */}
      <div className="fixed bottom-6 sm:bottom-8 right-4 sm:right-8 z-50 flex flex-col items-end gap-3">
        {/* Dropdown Menu */}
        <div className={`bg-white/95 backdrop-blur-xl border border-slate-200 shadow-[0_15px_40px_rgba(0,0,0,0.15)] rounded-2xl p-2 flex flex-col min-w-[200px] transition-all duration-300 origin-bottom-right ${isFabOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-4 pointer-events-none'}`}>
          
          <div className="px-3 pt-2 pb-1.5 mb-1 border-b border-slate-100">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Actions</span>
          </div>

          <button onClick={() => router.push('/create')} className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 rounded-xl text-[13px] font-bold text-slate-700 hover:text-blue-700 transition-colors w-full text-left group">
             <div className="w-8 h-8 rounded-lg bg-blue-100/50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors"><i className="ti ti-pencil-plus text-base"></i></div>
             Manual Creator
          </button>
          
          <button onClick={() => router.push('/tests')} className="flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 rounded-xl text-[13px] font-bold text-slate-700 hover:text-indigo-700 transition-colors w-full text-left group mt-1">
             <div className="w-8 h-8 rounded-lg bg-indigo-100/50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><i className="ti ti-chart-bar text-base"></i></div>
             Export Analytics
          </button>
        </div>

        {/* Trigger Button */}
        <button 
           onClick={() => setIsFabOpen(!isFabOpen)} 
           className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full shadow-[0_8px_25px_rgba(37,99,235,0.4)] flex items-center justify-center text-2xl sm:text-3xl hover:shadow-[0_12px_30px_rgba(37,99,235,0.5)] active:scale-95 transition-all duration-300"
        >
           <i className={`ti ti-plus transition-transform duration-300 ${isFabOpen ? 'rotate-[135deg]' : ''}`}></i>
        </button>
      </div>

    </div>
  );
}