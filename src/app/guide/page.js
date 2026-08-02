"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";

function GuideContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userRole, loading } = useAuth();
  
  const [activeTopic, setActiveTopic] = useState("create");

  // Determine which sidebar items to show based on Role
  const examinerModules = [
    { id: "create", label: "Create Test", icon: "ti-pencil-code", color: "blue" },
    { id: "tests", label: "My Vault", icon: "ti-list-check", color: "indigo" },
    { id: "results", label: "Global Results", icon: "ti-world", color: "emerald" }
  ];

  const studentModules = [
    { id: "student", label: "Join Test", icon: "ti-school", color: "blue" },
    { id: "student-dashboard", label: "Dashboard", icon: "ti-chart-pie", color: "indigo" },
    { id: "radar", label: "Educator Radar", icon: "ti-radar", color: "emerald" },
    { id: "arena", label: "Practice Arena", icon: "ti-swords", color: "amber" }
  ];

  // Set initial topic from URL
  useEffect(() => {
    const topic = searchParams.get("topic");
    if (topic) {
      const cleanTopic = topic.split('/').pop(); 
      setActiveTopic(cleanTopic);
    }
  }, [searchParams]);

  // Loading state while checking role
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="spinner"></div></div>;
  }

  const sidebarModules = (userRole === "examiner" || userRole === "admin") ? examinerModules : studentModules;

  // --- CONTENT DIRECTORY ---
  const guideData = {
    create: {
      title: "Test Creator Masterclass",
      subtitle: "Learn how to build, secure, and publish professional-grade assessments.",
      icon: "ti-pencil-code",
      sections: [
        {
          title: "1. Exam Logic & Smart Shuffle",
          desc: "Set up your exam structure effortlessly. Divide the test into logical Sections (e.g., Physics, Maths) by simply typing them separated by commas. Set precise Negative Marking for incorrect answers. When you enable 'Smart Shuffle', questions are randomized strictly within their own sections, and our AI detects fixed options like 'All of the above' or 'None of these' and automatically locks them at the bottom so the question logic never breaks.",
          mockup: (
            <div className="flex flex-col gap-4 w-full">
               {/* Config Card */}
               <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-[20px] shadow-[0_4px_15px_rgba(0,0,0,0.03)] w-full">
                  <div className="text-[12px] font-extrabold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                      <i className="ti ti-settings text-blue-500 text-lg"></i> Basic Configuration
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                     <div>
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Sections</label>
                        <div className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 truncate shadow-inner">Physics, Maths</div>
                     </div>
                     <div>
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Negative Marking</label>
                        <div className="w-full px-3 py-2.5 bg-rose-50/50 border border-rose-100 rounded-xl text-[13px] font-black text-rose-600 flex items-center gap-1 shadow-inner"><i className="ti ti-minus text-rose-500"></i> 1.00</div>
                     </div>
                  </div>
               </div>
               
               {/* Smart Shuffle Toggles */}
               <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-[20px] shadow-inner w-full flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                     <div>
                       <div className="font-bold text-[13px] text-slate-800">Shuffle Questions</div>
                       <div className="text-[11px] font-medium text-slate-500">Randomize, but keep within sections</div>
                     </div>
                     <div className="w-11 h-6 rounded-full bg-blue-600 relative shadow-inner cursor-not-allowed shrink-0">
                       <div className="absolute top-[2px] right-[2px] w-5 h-5 bg-white rounded-full shadow-sm"></div>
                     </div>
                  </div>
                  <div className="w-full h-[1px] bg-slate-200/60"></div>
                  <div className="flex items-center justify-between">
                     <div>
                       <div className="font-bold text-[13px] text-slate-800 flex items-center gap-1.5"><i className="ti ti-brain text-amber-500"></i> Smart Option Shuffle</div>
                       <div className="text-[11px] font-medium text-slate-500">Auto-locks "All of the above" at bottom</div>
                     </div>
                     <div className="w-11 h-6 rounded-full bg-blue-600 relative shadow-inner cursor-not-allowed shrink-0">
                       <div className="absolute top-[2px] right-[2px] w-5 h-5 bg-white rounded-full shadow-sm"></div>
                     </div>
                  </div>
               </div>
            </div>
          )
        },
        {  
          title: "2. Security & Anti-Cheat Toggles",
          desc: "Protect your exam integrity with a single click. The Anti-Cheat Engine actively monitors student behavior, tracks tab-switching, and logs off-screen activity. Enforcing Full-Screen ensures students cannot access other applications during the test.",
          mockup: (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center justify-between p-3.5 bg-rose-50/80 border border-rose-100 rounded-xl">
                <div>
                  <div className="font-bold text-[13px] text-rose-700 flex items-center gap-1.5"><i className="ti ti-shield-half-filled"></i> Anti-Cheat Engine</div>
                  <div className="text-[11px] font-medium text-rose-600/80 mt-0.5">Block tab switching and copy-paste</div>
                </div>
                <div className="w-11 h-6 rounded-full bg-rose-500 relative shadow-inner cursor-not-allowed">
                  <div className="absolute top-[2px] right-[2px] w-5 h-5 bg-white rounded-full shadow-sm"></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-rose-50/80 border border-rose-100 rounded-xl opacity-60">
                <div>
                  <div className="font-bold text-[13px] text-rose-700 flex items-center gap-1.5"><i className="ti ti-maximize"></i> Enforce Full-Screen</div>
                  <div className="text-[11px] font-medium text-rose-600/80 mt-0.5">Warn if full-screen is exited</div>
                </div>
                <div className="w-11 h-6 rounded-full bg-slate-300 relative shadow-inner cursor-not-allowed">
                  <div className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow-sm"></div>
                </div>
              </div>
            </div>
          )
        },
        {
          title: "3. Bulk JSON Import",
          desc: "Don't type questions one by one! Download our Universal JSON Template, fill it out using Excel or any text editor, and import hundreds of questions instantly. You can even paste the raw JSON code directly into the browser.",
          mockup: (
            <div className="flex flex-wrap gap-3 w-full bg-slate-50 p-5 rounded-2xl border border-slate-200 items-center justify-center">
               <button className="px-4 py-2.5 bg-white border border-slate-200 text-blue-600 font-bold text-[13px] rounded-xl shadow-sm flex items-center gap-2 pointer-events-none"><i className="ti ti-download text-lg"></i> JSON Template</button>
               <button className="px-4 py-2.5 bg-white border border-slate-200 text-indigo-600 font-bold text-[13px] rounded-xl shadow-sm flex items-center gap-2 pointer-events-none"><i className="ti ti-clipboard text-lg"></i> Paste JSON</button>
               <button className="px-4 py-2.5 bg-white border border-slate-200 text-emerald-600 font-bold text-[13px] rounded-xl shadow-sm flex items-center gap-2 pointer-events-none"><i className="ti ti-upload text-lg"></i> Import JSON</button>
            </div>
          )
        },
        {
          title: "4. Hybrid Figures (TikZ & SMILES)",
          desc: "Forget uploading heavy images. Our engine natively renders Chemistry structures and Math geometry directly from code. Select 'SMILES' for molecular bonds, or 'TikZ' for precise mathematical graphs.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                   <label className="text-[12px] font-extrabold text-slate-700 flex items-center gap-1.5"><i className="ti ti-vector text-indigo-500"></i> Figure / Diagram</label>
                   <span className="bg-white border border-slate-200 text-slate-700 font-bold text-[11px] rounded-md px-3 py-1 shadow-sm">Math (TikZ)</span>
                </div>
                <div className="w-full p-3 bg-slate-900 text-emerald-400 border border-slate-800 rounded-lg text-[11px] font-mono mb-3">
                   \begin{'{'}tikzpicture{'}'}<br/>
                   \draw[thick, blue] (0,0) parabola (3,2.5);<br/>
                   \end{'{'}tikzpicture{'}'}
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg h-24 flex items-center justify-center relative overflow-hidden">
                    {/* Simulated Parabola */}
                    <div className="w-16 h-16 border-b-2 border-r-2 border-blue-500 rounded-br-full absolute bottom-4 left-1/2 -translate-x-1/2"></div>
                </div>
            </div>
          )
        },
        {
          title: "5. MathJax Support",
          desc: "Write complex mathematical formulas inline with your text. Simply wrap your LaTeX code inside double dollar signs ( $$ ) and our engine will convert it into crisp, vector-based equations automatically.",
          mockup: (
            <div className="w-full">
               <div className="bg-slate-50 p-3 rounded-t-xl text-slate-700 font-mono text-[12px] border border-slate-200 border-b-0">
                    Find the root of {"$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$"}
                </div>
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-b-xl text-[14px] text-slate-800 flex items-center gap-2">
                    <i className="ti ti-math-symbols text-xl text-blue-500"></i>
                    <span>Find the root of <strong className="font-serif text-[15px]">x = (-b ± √(b² - 4ac)) / 2a</strong></span>
                </div>
            </div>
          )
        },
        {
          title: "6. Optional Questions (JEE Style)",
          desc: "Create flexible exam patterns by allowing students to attempt a specific number of questions per section. If you set 'Attempt Any 5' for Physics, the system will only grade their best 5 attempts.",
          mockup: (
            <div className="w-full flex items-center justify-between p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <span className="text-[14px] font-bold text-indigo-900"><i className="ti ti-folder text-indigo-400 mr-1.5"></i> Physics Section</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase">Attempt Any:</span>
                  <div className="w-14 py-1.5 bg-white border border-indigo-200 rounded-lg text-[14px] font-black text-indigo-700 text-center shadow-sm">5</div>
                </div>
            </div>
          )
        },
        {
          title: "7. Publishing & Result Visibility",
          desc: "Control when your students see their scores. Choose 'Instant' for immediate feedback, 'Scheduled' to auto-publish at a future date, or 'Manual Release' to hold scores until you verify them in the Vault.",
          mockup: (
            <div className="w-full space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                     <div className="text-[11px] font-bold text-slate-500 mb-1">Result Visibility</div>
                     <div className="text-[13px] font-black text-slate-800 flex justify-between items-center">Scheduled (Auto-Publish) <i className="ti ti-chevron-down text-slate-400"></i></div>
                  </div>
                </div>
                
                {/* Save & Publish Mockup */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center mt-4">
                   <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-4 mb-4 max-w-[200px] mx-auto">
                      <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Secure Code</div>
                      <div className="text-3xl font-black text-blue-600 tracking-[0.2em] font-mono">X9L2Q</div>
                   </div>
                   <button className="px-6 py-2.5 bg-blue-600 text-white font-bold text-[13px] rounded-xl shadow-md shadow-blue-600/20 pointer-events-none w-full max-w-[200px]"><i className="ti ti-device-floppy"></i> Save & Publish</button>
                </div>
            </div>
          )
        }
      ]
    },
   // VAULT OPERATIONS (tests/page.js)
    tests: { 
      title: "Examiner Vault Operations", 
      subtitle: "Your Command Center. Manage live intakes, edit settings on the fly, auto-regrade papers, and analyze deep student metrics.", 
      icon: "ti-list-check", 
      color: "indigo",
      sections: [
        {
          title: "1. The Live Dashboard & Presence Tracker",
          desc: "Your dashboard shows the real-time status of every test. The Status Badge indicates if a test is 'ACTIVE' (accepting students), 'SCHEDULED', or 'CLOSED'. The 'IN EXAM' counter is a live presence tracker—it shows exactly how many students are currently connected and writing the exam at this very second.",
          mockup: (
            <div className="w-full bg-[#0f172a] rounded-2xl p-5 shadow-lg border border-slate-800 relative overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
               <div className="flex justify-between items-center z-10 relative">
                  <div>
                    <h3 className="text-xl font-black text-white m-0 leading-none mb-3">N: Test 13</h3>
                    <span className="bg-slate-800 px-2 py-1 rounded text-[11px] font-bold text-slate-300 border border-slate-700"><i className="ti ti-hash opacity-60"></i> BC3ACY</span>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                     <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Active</div>
                     <div className="bg-slate-800/80 border border-slate-700 px-3 py-1 rounded text-slate-300 font-bold text-[10px] flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span> 42 IN EXAM</div>
                  </div>
               </div>
            </div>
          )
        },
        {
          title: "2. Exam Intake Control (Lock/Unlock)",
          desc: "Need to stop latecomers from joining? Use the 'Lock Exam Intake' button. This instantly blocks any new entries while allowing students who are already inside to finish their exam peacefully.",
          mockup: (
            <div className="w-full bg-rose-50 border-2 border-rose-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
               <div className="flex flex-col">
                  <span className="text-[13px] font-black text-rose-800 uppercase tracking-widest flex items-center gap-1.5"><i className="ti ti-lock"></i> Lock Exam Intake</span>
                  <span className="text-[11px] font-semibold text-rose-600 mt-1">Block new students instantly</span>
               </div>
               <div className="w-10 h-10 bg-rose-600 text-white rounded-lg flex items-center justify-center shadow-md"><i className="ti ti-hand-stop text-xl"></i></div>
            </div>
          )
        },
        {
          title: "3. Dynamic Exam Configuration",
          desc: "Made a mistake in the time limit? Click 'Edit Settings' on any exam to modify its Duration, Negative Marking, or Auto-Publish schedule on the fly. You don't need to delete and recreate the test; changes apply instantly.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-4 rounded-xl shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-[13px] font-bold text-slate-500 uppercase tracking-widest"><i className="ti ti-adjustments"></i> Exam Settings</span>
                    <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded shadow-sm cursor-pointer">Edit Settings</span>
                </div>
                <div className="bg-slate-50 rounded-lg border border-slate-100 p-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center px-3 py-1.5 border-b border-slate-200/50"><span className="text-[12px] font-bold text-slate-500">Duration</span><span className="text-[13px] font-black text-slate-800">180 Mins</span></div>
                    <div className="flex justify-between items-center px-3 py-1.5"><span className="text-[12px] font-bold text-slate-500">Neg. Marking</span><span className="text-[13px] font-black text-rose-600">-1</span></div>
                </div>
            </div>
          )
        },
        {
          title: "4. Student Radar Visibility",
          desc: "Toggling 'Show on Student Radar' determines if the test appears on your students' dashboard. If kept OFF, the test acts as a hidden draft that only you can see.",
          mockup: (
            <div className="w-full border border-indigo-100 bg-indigo-50/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                   <div className="font-bold text-[14px] text-indigo-900 flex items-center gap-1.5"><i className="ti ti-radar text-xl"></i> Show on Student Radar</div>
                   {/* FIX: Escaped apostrophe here */}
                   <div className="text-[12px] font-medium text-indigo-700/70 mt-1">If OFF, students won&apos;t see this test.</div>
                </div>
                <div className="w-12 h-6 rounded-full bg-indigo-500 relative shadow-inner"><div className="absolute top-[2px] right-[2px] w-5 h-5 bg-white rounded-full shadow-sm"></div></div>
            </div>
          )
        },
        {
          title: "5. Custom Radar Notes",
          desc: "When a test is visible on the radar, you can append a custom instruction note. For example, reminding students to bring calculators, or specifying which chapters are included.",
          mockup: (
            <div className="w-full">
                <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 pl-1">Note for Students</div>
                <div className="w-full border border-slate-200 rounded-lg p-4 text-[14px] font-medium text-slate-700 bg-white shadow-sm">
                   {/* FIX: Escaped quotes here */}
                   &quot;Please join 5 minutes early. Calculators are allowed for this session.&quot;
                </div>
            </div>
          )
        },
        {
          title: "6. Direct Entry Mode",
          desc: "Tired of students asking for the 6-digit exam code? Enable 'Direct Entry'. This generates a special link that lets students bypass the code screen and jump straight into the exam instructions.",
          mockup: (
            <div className="w-full border border-emerald-100 bg-emerald-50/50 rounded-xl p-4 flex items-center justify-between">
                <div>
                   <div className="font-bold text-[14px] text-emerald-900 flex items-center gap-1.5"><i className="ti ti-bolt text-xl"></i> Enable Direct Entry</div>
                   <div className="text-[12px] font-medium text-emerald-700/70 mt-1">Join instantly without exam code.</div>
                </div>
                <div className="w-12 h-6 rounded-full bg-emerald-500 relative shadow-inner"><div className="absolute top-[2px] right-[2px] w-5 h-5 bg-white rounded-full shadow-sm"></div></div>
            </div>
          )
        },
        {
          title: "7. Publishing & Scheduling Results",
          desc: "Control when your students see their scores. Choose 'Instant' for immediate feedback, 'Scheduled' to automatically release scores at a specific date/time, or 'Manual' to hold scores until you verify them.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
               <div className="text-[11px] font-bold text-slate-500 mb-1.5">Results Visibility</div>
               <div className="text-[14px] font-black text-slate-800 flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                  Scheduled (Auto-Publish) <i className="ti ti-chevron-down text-slate-400"></i>
               </div>
               <div className="mt-3 flex items-center gap-2 text-[12px] font-bold text-blue-600 bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                  <i className="ti ti-clock-play"></i> Releases on: 07/27/2026 10:45 PM
               </div>
            </div>
          )
        },
        {
          title: "8. Quick Sharing (WhatsApp & Telegram)",
          desc: "Once your test is ready, use the Quick Share buttons. It automatically generates a formatted message with the Test Title, Time, Marks, Code, and the direct joining link, ready to be pasted into your class groups.",
          mockup: (
            <div className="w-full flex gap-3">
               <div className="flex-1 p-3 rounded-xl bg-[#25d366]/10 text-[#075e54] flex items-center justify-center gap-2 border border-[#25d366]/20 font-bold text-[13px]"><i className="ti ti-brand-whatsapp text-xl"></i> WhatsApp</div>
               <div className="flex-1 p-3 rounded-xl bg-[#0088cc]/10 text-[#0088cc] flex items-center justify-center gap-2 border border-[#0088cc]/20 font-bold text-[13px]"><i className="ti ti-brand-telegram text-xl"></i> Telegram</div>
            </div>
          )
        },
        {
          title: "9. The Submissions Ledger",
          desc: "Switch to the 'Subs' tab to view a real-time list of all submitted exams. You can instantly search for a specific student by Name or Roll Number. The ledger shows their total score and whether their paper is 'Pending', 'Evaluated', or 'Published'.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="relative mb-3">
                    <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <div className="w-full pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] text-slate-400">Search by Name or Roll No...</div>
                </div>
                <div className="border border-slate-100 rounded-xl p-3 flex justify-between items-center shadow-sm bg-slate-50/50">
                   <div className="flex flex-col"><span className="text-[14px] font-bold text-slate-800">Aman Kumar</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Roll: 21045</span></div>
                   <div className="text-right flex flex-col items-end"><span className="text-[16px] font-black text-blue-700 leading-none mb-1">284 <span className="text-[11px] text-slate-400">/300</span></span><span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-extrabold"><i className="ti ti-check"></i> Published</span></div>
                </div>
            </div>
          )
        },
        {
          title: "10. Leaderboard (Publish Ranks)",
          desc: "Want to spark healthy competition? Use the 'Publish Ranks' button in the Ledger. This reveals a global leaderboard to the students, allowing them to see their rank against their peers.",
          mockup: (
            <div className="w-full bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
               <div className="flex flex-col">
                  <span className="text-[14px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">Publish Ranks</span>
                  <span className="text-[11px] font-semibold text-indigo-700 mt-1">Show leaderboard to students</span>
               </div>
               <div className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold shadow-sm border border-indigo-100 flex items-center gap-1.5"><i className="ti ti-medal text-lg"></i> Ranks Hidden</div>
            </div>
          )
        },
        {
          title: "11. CSV Ledger Export",
          desc: "Generate a comprehensive spreadsheet of your entire batch in one click. The CSV export includes every student's Name, Roll No, Total Score, Accuracy Percentage, Submission Time, and detailed counts of Correct/Wrong questions.",
          mockup: (
            <div className="w-full bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
               <div className="flex flex-col">
                  <span className="text-[14px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-1.5">Export Data</span>
                  <span className="text-[11px] font-semibold text-emerald-700 mt-1">Download batch results</span>
               </div>
               <div className="bg-white text-emerald-600 px-4 py-2 rounded-lg font-bold shadow-sm border border-emerald-100 flex items-center gap-1.5"><i className="ti ti-file-spreadsheet text-lg"></i> Export CSV</div>
            </div>
          )
        },
        {
          title: "12. Magic Re-keying (Auto-Regrade)",
          desc: "Realized you marked the wrong option as correct while creating the test? Click 'Edit Answer Key', fix the correct option, and hit save. Our engine will instantly recalculate the scores of all students who have already submitted, saving you hours of manual work.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-3 text-amber-600 font-bold text-[14px]"><i className="ti ti-key text-lg"></i> Smart Key Update</div>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg mb-3">
                    <div className="text-[12px] font-bold text-slate-800 mb-2">Q3: Which gas is most abundant?</div>
                    <div className="flex gap-2 text-[11px] font-bold">
                        <span className="bg-white border border-slate-200 px-2 py-1.5 rounded flex items-center gap-1.5 text-slate-500"><div className="w-3 h-3 rounded-full border border-slate-300"></div> Oxygen</span>
                        <span className="bg-emerald-50 border border-emerald-400 px-2 py-1.5 rounded flex items-center gap-1.5 text-emerald-800 shadow-[0_0_0_1px_#34d399]"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Nitrogen</span>
                    </div>
                </div>
                <div className="w-full py-2.5 bg-amber-600 text-white text-[12px] font-bold rounded-lg shadow-sm flex justify-center items-center gap-1.5"><i className="ti ti-refresh text-base"></i> Update & Auto-Grade All</div>
            </div>
          )
        },
        {
          title: "13. Deep Evaluation, Analytics & Audits",
          desc: "Click 'Evaluate' on a student to enter the Pro Dashboard. The Performance Bar visualizes Correct/Wrong/Skipped ratios, while Section-Wise Scores reveal subject weaknesses. The Anti-Cheat Accordion logs tab-switches and warnings.\n\nUse 'Grade Override' to manually assign marks for subjective questions. Any change requires an 'Audit Reason', creating a transparent, immutable log visible to the student.",
          mockup: (
            <div className="w-full flex flex-col gap-3">
               {/* Analytics */}
               <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                     <div className="flex justify-between items-center mb-2"><span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Performance</span></div>
                     <div className="flex h-2 rounded-full overflow-hidden bg-slate-100"><div className="w-[20%] bg-emerald-500"></div><div className="w-[65%] bg-rose-500"></div><div className="w-[15%] bg-slate-300"></div></div>
                  </div>
                  <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                     <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Sections</div>
                     {/* FIX: Escaped slashes safely inside curly braces just to be robust */}
                     <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-700">Chemistry</span><span className="text-[11px] font-black">{"12/200"}</span></div>
                  </div>
               </div>
               
               {/* Override & Audit */}
               <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><i className="ti ti-wand text-lg"></i></div>
                     <div className="flex flex-col"><span className="text-[12px] font-bold text-blue-900 leading-none mb-1">Grade Override</span></div>
                  </div>
                  <div className="bg-white border border-blue-200 px-2 py-1 rounded flex items-center gap-1 shadow-inner"><span className="text-[14px] font-black text-blue-700">-1</span><span className="text-[10px] font-bold text-slate-400">{"/ 4"}</span></div>
               </div>
               
               <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                  <div className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1.5 flex items-center gap-1 pl-1"><i className="ti ti-history"></i> Audit Log</div>
                  <div className="bg-white border border-amber-100 p-2 rounded-lg flex justify-between items-center shadow-sm ml-1">
                     {/* FIX: Escaped quotes here */}
                     <div className="flex items-center gap-1.5"><span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-black">2.5 Mk</span> <span className="text-[11px] text-amber-800/80 italic">&quot;Partial formula correct&quot;</span></div>
                  </div>
               </div>
            </div>
          )
        }
      ]
    },
   // STUDENT PORTAL (student/page.js)
    student: { 
      title: "Student Exam Portal", 
      subtitle: "The ultimate, failure-proof environment for students to attempt exams securely.", 
      icon: "ti-school", 
      color: "blue",
      sections: [
        {
          title: "1. The Secure Join Form & Direct Links",
          desc: "To start an assessment, students must enter their Full Name, Roll No, and the 6-digit Secure Test Code provided by the examiner. Alternatively, if the examiner shares a 'Direct Entry' link, students bypass the code entirely and jump straight to the instructions.",
          mockup: (
            <div className="w-full max-w-sm mx-auto bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl flex items-center justify-center text-xl font-black shadow-sm mx-auto mb-3">E</div>
                <h3 className="text-center text-[16px] font-black text-slate-800 mb-4">Join a Test</h3>
                <div className="space-y-3">
                   <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] font-bold text-slate-400">Aman Kumar</div>
                   <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] font-bold text-slate-400">21045</div>
                   <div className="w-full bg-slate-50 border border-blue-300 ring-2 ring-blue-100 rounded-lg p-2.5 text-[14px] font-black text-center text-slate-800 tracking-[0.2em]">X9L2Q</div>
                   <div className="w-full bg-blue-600 text-white rounded-lg p-2.5 text-[13px] font-bold text-center shadow-md shadow-blue-600/20">Start Assessment <i className="ti ti-arrow-right"></i></div>
                </div>
            </div>
          )
        },
        {
          title: "2. Pre-Exam Instructions & Session Restore",
          desc: "Before the timer starts, students see the exam rules (Duration, Max Marks, Negative Marking). If a student accidentally closed their browser during a previous attempt, our engine detects the incomplete session and shows a 'Session Restored' banner, allowing them to resume exactly from where they left off.",
          mockup: (
            <div className="w-full flex flex-col gap-3">
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex gap-2">
                   <i className="ti ti-history text-amber-600 text-lg"></i>
                   <div className="flex flex-col"><span className="text-[12px] font-bold text-amber-900">Session Restored</span><span className="text-[10px] text-amber-700/80">Resume from where you left off.</span></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Duration</span><span className="text-[12px] font-black text-blue-600">180 Mins</span></div>
                   <div className="bg-slate-50 border border-slate-100 p-2 rounded-lg flex flex-col"><span className="text-[9px] font-bold text-slate-400 uppercase">Marking</span><span className="text-[12px] font-black text-emerald-600">300 Max <span className="text-[9px] text-rose-500 bg-rose-100 px-1 rounded">-1 Neg</span></span></div>
                </div>
            </div>
          )
        },
        {
          title: "3. Active Security Protocols",
          desc: "If the examiner enabled proctoring, students are strictly warned before starting. The 'Anti-Cheat Engine' tracks if they switch tabs to search for answers, while 'Full-Screen Lock' ensures they stay immersed in the exam window.",
          mockup: (
            <div className="w-full flex flex-col gap-2">
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Security Protocols Active</div>
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex gap-2.5 items-start">
                   <div className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shrink-0"><i className="ti ti-shield-lock text-sm"></i></div>
                   <div className="flex flex-col"><span className="text-[12px] font-bold text-rose-800">Proctoring Enabled</span><span className="text-[10px] font-medium text-rose-700/80 leading-tight">Tab-switching will trigger warnings and auto-submit.</span></div>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl flex gap-2.5 items-start">
                   <div className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0"><i className="ti ti-maximize text-sm"></i></div>
                   <div className="flex flex-col"><span className="text-[12px] font-bold text-amber-800">Full-Screen Lock</span><span className="text-[10px] font-medium text-amber-700/80 leading-tight">Exiting full-screen is recorded as a violation.</span></div>
                </div>
            </div>
          )
        },
        {
          title: "4. The Zero-Connectivity Vault (Offline Safety)",
          desc: "We built ExamiTop for real-world Indian internet conditions. If the student's Wi-Fi drops mid-exam, the test DOES NOT crash. Answers are encrypted and saved locally on their device. When the internet returns, it automatically syncs with the server.",
          mockup: (
            <div className="w-full bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-inner flex gap-3 items-start">
                <i className="ti ti-wifi-off text-blue-400 text-xl"></i>
                <div className="flex flex-col">
                   <span className="text-[12px] font-bold text-white mb-1">Critical Note: Offline Sync</span>
                   <span className="text-[11px] font-medium text-slate-300 leading-snug">In case of an internet drop, your answers will be securely cached offline and synced automatically when connection returns. Do not refresh.</span>
                </div>
            </div>
          )
        },
        {
          title: "5. Live Exam Engine Dashboard",
          desc: "Once the exam starts, the UI shifts into a distraction-free mode. The Top Bar displays the exact Time Left. Just below it, a Live Stats Bar gives a quick summary: How many questions are Attempted, Marked for Review, and Pending.",
          mockup: (
            <div className="w-full flex flex-col gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex justify-between items-center">
                   <div className="flex flex-col"><span className="text-[14px] font-black text-slate-800 leading-none">Mid-Term Exam</span><span className="text-[10px] text-slate-500 font-bold mt-1">Aman Kumar • Q 4 / 75</span></div>
                   <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold text-[12px] flex items-center gap-1.5"><i className="ti ti-clock"></i> 02:45:10</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex justify-between items-center text-[10px] font-bold shadow-inner">
                   <span className="text-blue-700 flex items-center gap-1"><div className="w-2 h-2 bg-blue-600 rounded-full"></div> Attempted: 4</span>
                   <span className="text-amber-700 flex items-center gap-1"><div className="w-2 h-2 bg-amber-400 rounded-full"></div> Marked: 1</span>
                   <span className="text-rose-700 flex items-center gap-1"><div className="w-2 h-2 bg-transparent border border-rose-500 rounded-full"></div> Pending: 70</span>
                </div>
            </div>
          )
        },
        {
          title: "6. Section Navigation Tabs",
          desc: "If the test has multiple subjects, students see sticky Section Tabs at the top. Clicking a tab instantly jumps the user to the first question of that specific section (e.g., jumping from Physics directly to Chemistry).",
          mockup: (
            <div className="w-full flex gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[11px] font-bold shadow-sm">Physics</div>
                <div className="bg-white text-slate-500 border border-slate-200 px-4 py-1.5 rounded-lg text-[11px] font-bold">Chemistry</div>
                <div className="bg-white text-slate-500 border border-slate-200 px-4 py-1.5 rounded-lg text-[11px] font-bold">Maths</div>
            </div>
          )
        },
        {
          title: "7. Rich Question Presentation",
          desc: "The core question area handles everything seamlessly. It automatically renders MathJax equations, complex SMILES chemistry structures, or TikZ geometry diagrams. Question badges indicate the type (e.g., Single Correct) and marks awarded.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-3">
                   <div className="flex gap-2 items-center">
                      <div className="w-7 h-7 bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center font-black text-slate-600 text-[12px]">4</div>
                      <span className="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide">Single Correct</span>
                   </div>
                   <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-black">4 Marks</span>
                </div>
                <div className="text-[13px] font-semibold text-slate-800 leading-relaxed mb-3">
                   Find the equivalent resistance of the given circuit:
                </div>
                <div className="w-full h-16 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-400">
                   [ Diagram Renders Here ]
                </div>
            </div>
          )
        },
        {
          title: "8. Intuitive Answering Mechanisms",
          desc: "Depending on the question type, the UI adapts. MCQs show selectable blocks, MSQs show checkboxes, Integer questions provide a focused number pad, and Subjective questions offer a large text area for descriptive answers.",
          mockup: (
            <div className="w-full flex flex-col gap-2">
                <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-center gap-2 hover:border-blue-300 transition-colors">
                   <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-[10px]">A</div>
                   <span className="text-[12px] font-semibold text-slate-700">10 Ohms</span>
                </div>
                <div className="bg-blue-50 border border-blue-500 p-2.5 rounded-xl flex items-center gap-2 shadow-[0_2px_10px_rgba(59,130,246,0.1)]">
                   <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-[10px] shadow-sm"><i className="ti ti-check"></i></div>
                   <span className="text-[12px] font-bold text-blue-900">15 Ohms</span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-xl flex items-center gap-2">
                   <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-[10px]">C</div>
                   <span className="text-[12px] font-semibold text-slate-700">20 Ohms</span>
                </div>
            </div>
          )
        },
        {
          title: "9. Mark for Review & Clear Selection",
          desc: "Below every question, students have utility buttons. 'Mark for Review' flags the question in yellow on the palette so they can revisit it later. 'Clear Selection' allows them to erase their answer entirely, which is crucial for avoiding negative marks.",
          mockup: (
            <div className="w-full flex gap-2">
               <div className="bg-[#FAEEDA] border border-[#FAC775] text-[#854F0B] px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shadow-sm"><i className="ti ti-bookmark"></i> Unmark</div>
               <div className="bg-rose-50 border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-rose-100 cursor-pointer"><i className="ti ti-eraser"></i> Clear Selection</div>
            </div>
          )
        },
        {
          title: "10. The Smart Question Palette",
          desc: "Located on the right side (or as a bottom-sheet on mobile), the Palette gives a complete map of the exam. It uses clear color-coding: White (Unvisited), Blue (Answered), and Yellow (Marked for review). Clicking any number jumps directly to that question.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center">
                <div className="flex gap-2 mb-3 w-full justify-center">
                   <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500"><div className="w-2.5 h-2.5 border border-slate-300 rounded-sm"></div> Unvisited</div>
                   <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500"><div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div> Answered</div>
                   <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500"><div className="w-2.5 h-2.5 bg-amber-400 rounded-sm"></div> Marked</div>
                </div>
                <div className="grid grid-cols-4 gap-2 w-fit">
                   <div className="w-8 h-8 bg-blue-600 text-white rounded-md flex items-center justify-center font-bold text-[12px] shadow-sm">1</div>
                   <div className="w-8 h-8 bg-amber-400 text-amber-900 rounded-md flex items-center justify-center font-bold text-[12px] shadow-sm">2</div>
                   <div className="w-8 h-8 bg-white border-2 border-blue-600 text-slate-700 rounded-md flex items-center justify-center font-bold text-[12px]">3</div>
                   <div className="w-8 h-8 bg-white border border-slate-200 text-slate-500 rounded-md flex items-center justify-center font-bold text-[12px]">4</div>
                </div>
            </div>
          )
        },
        {
          title: "11. Virtual Rough Pad",
          desc: "A floating 'Pencil' icon is always available. Clicking it opens a digital notepad overlay. Students can scribble rough calculations or logic steps here, saving the need to look away from the screen to find physical paper.",
          mockup: (
            <div className="w-full relative h-32">
                <div className="absolute right-2 bottom-2 w-10 h-10 bg-blue-600 rounded-full shadow-[0_4px_15px_rgba(37,99,235,0.4)] flex items-center justify-center text-white z-10"><i className="ti ti-pencil text-lg"></i></div>
                <div className="absolute right-6 bottom-8 w-[200px] h-24 bg-white border border-slate-200 shadow-xl rounded-xl flex flex-col overflow-hidden">
                   <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 flex justify-between items-center"><span className="flex items-center gap-1"><i className="ti ti-pencil"></i> Rough Pad</span><i className="ti ti-x"></i></div>
                   <div className="p-2 text-[10px] font-mono text-slate-500">2x + 4 = 10<br/>2x = 6<br/>x = 3</div>
                </div>
            </div>
          )
        },
        {
          title: "12. Anti-Cheat Warning System",
          desc: "If a student attempts to cheat by minimizing the browser or switching tabs, the exam screen locks instantly with a severe red warning. It explicitly counts the 'Strikes'. Reaching 3 strikes triggers an immediate, unpreventable auto-submission.",
          mockup: (
            <div className="w-full bg-[#1e293b] p-4 rounded-xl border-2 border-rose-900 shadow-xl flex flex-col items-center text-center">
                <i className="ti ti-shield-x text-3xl text-rose-500 mb-2 animate-pulse"></i>
                <h4 className="text-[14px] font-black text-rose-500 mb-1">SECURITY WARNING</h4>
                <p className="text-[10px] text-slate-300 font-medium leading-tight mb-3">Tab switching / App change detected! Please do not leave the exam screen.</p>
                <div className="bg-rose-900/50 text-rose-400 border border-rose-800 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase mb-3">Strike 1 of 3</div>
                <div className="w-full bg-rose-600 text-white py-2 rounded-lg text-[11px] font-bold">I Understand, Resume Exam</div>
            </div>
          )
        },
        {
          title: "13. Secure Submission & Data Encryption",
          desc: "When the timer ends, or the student clicks submit, a confirmation modal ensures it wasn't accidental. Upon final submission, answers are heavily encrypted and sent to the cloud. If the examiner set Result Visibility to 'Manual', the student sees a success message instead of instant scores.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-5 rounded-2xl shadow-sm text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center text-2xl mb-3"><i className="ti ti-check"></i></div>
                <h4 className="text-[15px] font-black text-slate-800 mb-1">Test Submitted Successfully!</h4>
                <p className="text-[11px] text-slate-500 font-medium leading-tight mb-4">Your answers have been saved securely. Examiner will declare results later.</p>
                <div className="w-full bg-slate-100 text-slate-600 py-2 rounded-lg text-[11px] font-bold flex justify-center items-center gap-1.5"><i className="ti ti-arrow-right"></i> Go to Dashboard</div>
            </div>
          )
        }
      ]
    },
    // STUDENT DASHBOARD OVERVIEW
    "student-dashboard": { 
      title: "Student Dashboard", 
      subtitle: "Your personal academic hub. Track performance, view active tasks, and manage educators.", 
      icon: "ti-chart-pie", 
      color: "indigo",
      sections: [
        {
          title: "1. The Academic Overview",
          desc: "The Dashboard acts as your central hub. It provides a quick summary of your total exams taken, average accuracy, and upcoming scheduled tests. It's designed to give you a complete picture of your academic progress at a single glance.",
          mockup: (
            <div className="w-full flex gap-3">
               <div className="flex-1 bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2"><i className="ti ti-school text-lg"></i></div>
                  <span className="text-[16px] font-black text-slate-800">12</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Exams Taken</span>
               </div>
               <div className="flex-1 bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-2"><i className="ti ti-target text-lg"></i></div>
                  <span className="text-[16px] font-black text-slate-800">84%</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Avg Accuracy</span>
               </div>
            </div>
          )
        }
      ]
    },
    arena: { 
      title: "Practice Arena", 
      subtitle: "Sharpen your problem-solving skills using our Global Trivia database or generate custom mock questions powered by Google Gemini AI.", 
      icon: "ti-swords", 
      color: "amber", 
      sections: [
        {
          title: "1. Choose Your Battleground",
          desc: "The Arena is divided into two distinct zones. 'Global Trivia' fetches random, challenging questions from a worldwide database. 'Gemini AI Mock' lets you generate highly specific engineering or medical questions tailored to your exact syllabus.",
          mockup: (
            <div className="w-full flex justify-center gap-3 flex-wrap">
               <div className="px-6 py-3 rounded-full font-bold text-[14px] bg-white text-slate-500 border-2 border-slate-200 shadow-sm flex items-center gap-2"><i className="ti ti-world text-lg"></i> Global Trivia</div>
               <div className="px-6 py-3 rounded-full font-bold text-[14px] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.3)] flex items-center gap-2"><i className="ti ti-sparkles text-lg"></i> Gemini AI Mock</div>
            </div>
          )
        },
        {
          title: "2. Global Trivia Mode",
          desc: "In this mode, clicking 'Fetch a Question' retrieves a random multiple-choice question. The UI automatically displays the Category and Difficulty level (Easy, Medium, Hard) as badges. \n\nOnce you click an option, it instantly evaluates your answer—turning green for correct, or red for wrong (while revealing the correct one).",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                   <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5"><i className="ti ti-category"></i> Science & Computers</span>
                   <span className="bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider">Hard</span>
                </div>
                <h3 className="text-[15px] font-black text-slate-800 mb-4 leading-relaxed">What is the time complexity of the QuickSort algorithm in the worst-case scenario?</h3>
                <div className="flex flex-col gap-2">
                   <div className="border-2 border-rose-500 bg-rose-50 text-rose-900 p-3 rounded-xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3"><div className="w-7 h-7 rounded-full border-2 border-rose-500 flex items-center justify-center font-black text-xs">A</div> <span className="font-semibold text-[13px]">O(n log n)</span></div>
                      <i className="ti ti-x text-rose-600 text-xl"></i>
                   </div>
                   <div className="border-2 border-emerald-600 bg-emerald-50 text-emerald-900 p-3 rounded-xl flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3"><div className="w-7 h-7 rounded-full border-2 border-emerald-600 flex items-center justify-center font-black text-xs">B</div> <span className="font-semibold text-[13px]">O(n^2)</span></div>
                      <i className="ti ti-check text-emerald-600 text-xl"></i>
                   </div>
                </div>
            </div>
          )
        },
        {
          title: "3. Custom AI Generator (Gemini)",
          desc: "Switching to the Gemini AI tab unlocks a powerful custom generator. You start by selecting your Target Exam (e.g., JEE Mains, NEET, College CSE) and the Subject. Then, type any specific chapter, topic, or concept in the search bar. \n\nThe AI will then craft a unique, syllabus-aligned question just for you.",
          mockup: (
            <div className="w-full bg-gradient-to-b from-emerald-50 to-white border border-emerald-400 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
                <div className="bg-emerald-100 text-emerald-800 w-fit px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mx-auto mb-2">Powered by Google Gemini</div>
                <div className="flex gap-3">
                   <div className="flex-1 bg-white border-2 border-slate-200 p-3 rounded-xl text-[12px] font-bold text-slate-700 flex justify-between items-center">JEE Mains <i className="ti ti-chevron-down text-slate-400"></i></div>
                   <div className="flex-1 bg-white border-2 border-slate-200 p-3 rounded-xl text-[12px] font-bold text-slate-700 flex justify-between items-center">Physics <i className="ti ti-chevron-down text-slate-400"></i></div>
                </div>
                <div className="relative">
                   <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 text-lg"></i>
                   <div className="w-full pl-12 py-3.5 bg-white border-2 border-emerald-400 rounded-xl text-[13px] font-bold text-emerald-900 shadow-[0_4px_15px_rgba(16,185,129,0.1)]">Thermodynamics and Entropy</div>
                </div>
                <div className="w-full bg-emerald-500 text-white font-black text-[13px] py-3.5 rounded-xl text-center shadow-md flex justify-center items-center gap-2 pointer-events-none"><i className="ti ti-bolt text-lg"></i> Generate Practice Test</div>
            </div>
          )
        },
        {
          title: "4. AI Question & Detailed Solutions",
          desc: "Once generated, the AI question appears with proper MathJax rendering for complex formulas. \n\nAfter you attempt the question, the AI doesn't just tell you if you are right or wrong. It reveals a highly detailed 'AI Solution Explanation' box, breaking down the exact formula, logic, and step-by-step methodology needed to solve the problem.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                <div className="flex gap-2 mb-4">
                   <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1"><i className="ti ti-wand"></i> AI Generated</span>
                   <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-[10px] font-bold">JEE Mains • Physics</span>
                </div>
                <h3 className="text-[14px] font-semibold text-emerald-900 mb-4">A Carnot engine operating between temperatures T1 and T2 has efficiency 1/6. When T2 is lowered by 62K, its efficiency increases to 1/3. What are T1 and T2?</h3>
                
                <div className="border-2 border-emerald-500 bg-emerald-50 p-3 rounded-xl flex items-center justify-between mb-5 shadow-sm">
                    <div className="flex items-center gap-3"><div className="w-7 h-7 rounded-full border-2 border-emerald-500 flex items-center justify-center font-black text-xs text-emerald-700">C</div> <span className="font-bold text-[13px] text-emerald-900">372K and 310K</span></div>
                    <i className="ti ti-check text-emerald-600 text-xl"></i>
                </div>

                {/* AI Explanation Box */}
                <div className="bg-[#EEEDFE] border-l-4 border-[#534AB7] p-4 rounded-r-xl">
                   <h4 className="text-[13px] font-black text-[#3C3489] flex items-center gap-1.5 mb-2"><i className="ti ti-bulb text-lg"></i> AI Solution Explanation</h4>
                   <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                      Efficiency η = 1 - (T2/T1).<br/>
                      Case 1: 1/6 = 1 - (T2/T1) =&gt; T2/T1 = 5/6<br/>
                      Case 2: 1/3 = 1 - ((T2 - 62)/T1) =&gt; (T2 - 62)/T1 = 2/3<br/>
                      Solving these two equations yields T1 = 372K and T2 = 310K.
                   </p>
                </div>
            </div>
          )
        }
      ]
    },
    radar: { 
      title: "Educator Radar", 
      subtitle: "Connect with your teachers using their EXT codes to get their exams directly on your feed.", 
      icon: "ti-radar", 
      color: "emerald", 
      sections: [
        {
          title: "1. Finding & Connecting with Educators",
          desc: "To get started, you need to connect with your teacher. Enter their unique 'EXT Code' (e.g., EXT-XYZ) in the search bar. Once their profile pops up, click 'Connect'. From then on, any public test they create will automatically appear on your Radar.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col p-4 gap-4">
                <div className="bg-slate-50 p-2.5 rounded-lg flex items-center justify-between border border-slate-200 shadow-inner">
                    <div className="flex items-center gap-2 text-slate-400 font-bold text-[12px]"><i className="ti ti-hash text-blue-600"></i> EXT-KNP45</div>
                    <button className="bg-blue-600 text-white px-4 py-1.5 rounded-md font-bold text-[11px] shadow-sm pointer-events-none">Find</button>
                </div>
                <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center text-lg font-black shadow-sm">A</div>
                        <div className="flex flex-col"><span className="text-[14px] font-black text-slate-800 flex items-center gap-1">Aman Sir <i className="ti ti-circle-check-filled text-blue-500"></i></span><span className="text-[10px] font-mono text-blue-600">EXT-KNP45</span></div>
                    </div>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-[11px] shadow-sm pointer-events-none">Connect</button>
                </div>
            </div>
          )
        },
        {
          title: "2. Decoding the Exam Feed",
          desc: "Once connected, your feed populates with exams. Each exam card displays crucial information: the Subject, Duration, and Total Marks. If your teacher has pinned a specific note (like 'Bring calculators'), it will appear highlighted at the top of the card.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                <div className="bg-amber-50 text-amber-800 px-3 py-2 rounded-lg text-[11px] font-bold flex items-start gap-1.5"><i className="ti ti-pin mt-0.5 text-amber-600"></i> Please join 5 minutes early. Calculators allowed.</div>
                <div>
                   <h4 className="text-[15px] font-black text-slate-800 mb-1.5">Mid-Term Physics Exam</h4>
                   <div className="flex gap-3 text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1"><i className="ti ti-book"></i> Physics</span>
                      <span className="flex items-center gap-1"><i className="ti ti-clock"></i> 180 Mins</span>
                      <span className="flex items-center gap-1"><i className="ti ti-target"></i> 300 Marks</span>
                   </div>
                </div>
            </div>
          )
        },
        {
          title: "3. Exam Status Badges",
          desc: "Not every test on your Radar is ready to be attempted. \n\n• LIVE (Green): The exam is currently accepting submissions.\n• UPCOMING (Orange): The exam is scheduled for a future time and is currently locked.\n• CLOSED (Gray): The time window has expired or the teacher has manually locked the intake.",
          mockup: (
            <div className="w-full flex flex-col gap-3">
               <div className="bg-white border-b-4 border-emerald-500 p-4 rounded-t-xl border-x border-slate-200 shadow-sm flex justify-between items-center">
                  <span className="text-[13px] font-bold text-slate-800">Weekly Test 1</span>
                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Live</span>
               </div>
               <div className="bg-white border-b-4 border-amber-500 p-4 border-x border-slate-200 shadow-sm flex justify-between items-center">
                  <span className="text-[13px] font-bold text-slate-800">Monthly Mock</span>
                  <span className="bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5"><i className="ti ti-calendar"></i> Upcoming</span>
               </div>
               <div className="bg-white border-b-4 border-slate-400 p-4 rounded-b-xl border-x border-slate-200 shadow-sm flex justify-between items-center">
                  <span className="text-[13px] font-bold text-slate-800">Past Exam</span>
                  <span className="bg-slate-50 text-slate-500 border border-slate-200 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Closed</span>
               </div>
            </div>
          )
        },
        {
          title: "4. Joining the Exam (Direct vs Code)",
          desc: "When a test is 'LIVE', you can join it. \n\nIf the teacher requires a code, click 'Enter Code' to be taken to the Join form where you must manually type the 6-digit secure code. \n\nHowever, if the teacher has enabled 'Direct Entry', the button turns green. Clicking 'Direct Join' instantly verifies your profile and takes you straight into the exam instructions, bypassing the code entirely!",
          mockup: (
            <div className="w-full flex flex-col gap-4">
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex justify-between items-center">
                   <div className="flex flex-col"><span className="text-[11px] font-bold text-slate-800 flex items-center gap-1"><i className="ti ti-key text-blue-500"></i> Code Required</span></div>
                   <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-[11px] shadow-sm pointer-events-none">Enter Code</div>
                </div>
                
                <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex justify-between items-center">
                   <div className="flex flex-col"><span className="text-[11px] font-bold text-slate-800 flex items-center gap-1"><i className="ti ti-bolt text-emerald-500"></i> No Code Required</span></div>
                   <div className="bg-gradient-to-r from-emerald-500 to-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 pointer-events-none"><i className="ti ti-bolt"></i> Direct Join</div>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-inner flex justify-between items-center opacity-70">
                   <div className="flex flex-col"><span className="text-[11px] font-bold text-amber-700 flex items-center gap-1"><i className="ti ti-calendar-time"></i> Opens: Oct 12, 10:00 AM</span></div>
                   <div className="bg-slate-200 text-slate-500 px-4 py-2 rounded-lg font-bold text-[11px] flex items-center gap-1 pointer-events-none"><i className="ti ti-lock"></i> Locked</div>
                </div>
            </div>
          )
        }
      ]
    },

    "student-results": { 
      title: "My Results & Deep Analytics", 
      subtitle: "Review your performance, analyze your strengths and weaknesses, and claim your certificates.", 
      icon: "ti-history", 
      color: "emerald",
      sections: [
        {
          title: "1. The Academic Trajectory Vault",
          desc: "Your Results Vault displays every exam you've ever taken. The top banner gives you a quick snapshot of your total exams taken versus how many have been evaluated and published. It's your personal academic timeline.",
          mockup: (
            <div className="w-full bg-white/70 border border-slate-200 rounded-[24px] p-6 shadow-sm flex items-center justify-between">
               <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-3">Performance Analytics</div>
                  <h3 className="text-2xl font-black text-slate-800 m-0">Your Academic <span className="text-blue-600">Trajectory.</span></h3>
               </div>
               <div className="flex gap-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="text-center"><div className="text-2xl font-black text-slate-800">12</div><div className="text-[9px] font-bold text-slate-400 uppercase">Exams Taken</div></div>
                  <div className="w-px bg-slate-200"></div>
                  <div className="text-center"><div className="text-2xl font-black text-emerald-500">9</div><div className="text-[9px] font-bold text-emerald-600/60 uppercase">Evaluated</div></div>
               </div>
            </div>
          )
        },
        {
          title: "2. Exam Status Indicators",
          desc: "Every exam card clearly shows its current status. If the examiner enabled 'Instant Results' or manually published it, you will see your SCORE and a 'Report' button. If the results are Scheduled, it shows the exact countdown time. If it's under Manual Review, it shows as 'Locked'.",
          mockup: (
            <div className="w-full flex flex-col gap-3">
               <div className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center shadow-sm">
                  <div className="flex flex-col"><span className="text-[14px] font-black text-slate-800">Mid-Term Physics</span><span className="text-[11px] font-bold text-slate-400">Score: 240/300</span></div>
                  <button className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-[11px] shadow-sm pointer-events-none flex items-center gap-1.5">Report <i className="ti ti-arrow-right"></i></button>
               </div>
               <div className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center shadow-sm opacity-80">
                  <div className="flex flex-col"><span className="text-[14px] font-black text-slate-800">Chemistry Weekly</span><span className="text-[10px] font-bold text-blue-500 uppercase mt-1">Publishing At: Oct 24, 10:00 AM</span></div>
                  <button className="bg-blue-50 text-blue-600 border border-blue-200 px-5 py-2 rounded-lg font-bold text-[11px] shadow-sm pointer-events-none flex items-center gap-1.5"><i className="ti ti-clock-play"></i> Waiting</button>
               </div>
            </div>
          )
        },
        {
          title: "3. Certificate of Excellence",
          desc: "If you score 75% or above on any evaluated exam, the platform automatically generates a verifiable 'Certificate of Excellence'. You can download and print this certificate directly from the top banner of your detailed report.",
          mockup: (
            <div className="w-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-5 rounded-2xl flex justify-between items-center shadow-sm">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xl shadow-inner"><i className="ti ti-activity"></i></div>
                  <div className="flex flex-col"><span className="text-[14px] font-black text-emerald-900">85% • Great Job</span><span className="text-[11px] font-bold text-emerald-700/70">You qualify for a certificate</span></div>
               </div>
               <button className="bg-white text-blue-600 border border-slate-200 shadow-sm px-4 py-2 rounded-lg font-bold text-[11px] flex items-center gap-1.5 pointer-events-none"><i className="ti ti-medal text-amber-500 text-sm"></i> Claim Certificate</button>
            </div>
          )
        },
        {
          title: "4. Horizontal Metric Cards",
          desc: "Once you open a report, the top section provides horizontally scrollable quick metrics. This includes your Total Score, Class Rank (if published by the examiner), Overall Percentage, Attempt Rate, Accuracy, and Negative Marks deducted.",
          mockup: (
            <div className="w-full flex gap-3 overflow-hidden">
               <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-xl shadow-md min-w-[140px]">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-80 flex items-center gap-1"><i className="ti ti-trophy"></i> Total Score</div>
                  <div className="text-2xl font-black">240 <span className="text-[12px] opacity-70">/ 300</span></div>
               </div>
               <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm min-w-[130px]">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500 flex items-center gap-1"><i className="ti ti-target text-indigo-500"></i> Accuracy</div>
                  <div className="text-2xl font-black text-slate-800">84%</div>
               </div>
               <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm min-w-[130px]">
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1 text-slate-500 flex items-center gap-1"><i className="ti ti-minus text-rose-500"></i> Negative</div>
                  <div className="text-2xl font-black text-rose-600">-2.5</div>
               </div>
            </div>
          )
        },
        {
          title: "5. Smart AI Strength Detection",
          desc: "If your exam had multiple sections (e.g., Physics, Chemistry, Maths), our engine automatically calculates which subject is your 'Strongest' and which one 'Needs Work' based on your accuracy and marks scored in each section.",
          mockup: (
            <div className="w-full flex gap-3">
               <div className="flex-1 bg-emerald-50/50 border border-emerald-200 p-4 rounded-xl shadow-sm flex flex-col">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1 flex items-center gap-1.5"><i className="ti ti-trending-up bg-emerald-100 p-1 rounded"></i> Strongest</div>
                  <div className="text-[15px] font-black text-slate-800">Physics</div>
               </div>
               <div className="flex-1 bg-rose-50/50 border border-rose-200 p-4 rounded-xl shadow-sm flex flex-col">
                  <div className="text-[10px] font-bold text-rose-700 uppercase tracking-widest mb-1 flex items-center gap-1.5"><i className="ti ti-trending-down bg-rose-100 p-1 rounded"></i> Needs Work</div>
                  <div className="text-[15px] font-black text-slate-800">Chemistry</div>
               </div>
            </div>
          )
        },
        {
          title: "6. Question Distribution Bar",
          desc: "A sleek, stacked progress bar visualizes your attempt behavior. Green shows the proportion of Correct answers, Red for Wrong, and Gray for questions you Skipped. It provides an instant visual summary of your risk-taking behavior.",
          mockup: (
            <div className="w-full bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-2"><span>Distribution</span><span>Attempted: 65 / 75</span></div>
                <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 mb-3"><div className="w-[60%] bg-emerald-400"></div><div className="w-[25%] bg-rose-400"></div><div className="w-[15%] bg-slate-300"></div></div>
                <div className="flex justify-between text-[11px] font-bold"><span className="text-emerald-600 flex items-center gap-1"><i className="ti ti-circle-check-filled"></i> 45 Correct</span><span className="text-rose-600 flex items-center gap-1"><i className="ti ti-circle-x-filled"></i> 20 Wrong</span><span className="text-slate-500 flex items-center gap-1"><i className="ti ti-minus-circle"></i> 10 Skipped</span></div>
            </div>
          )
        },
        {
          title: "7. Section-Wise Breakdown",
          desc: "Swipe horizontally to see exactly how much time you spent and how many marks you secured in each specific section. The percentage badge automatically changes color (Green/Yellow/Red) based on your performance in that specific subject.",
          mockup: (
            <div className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm flex justify-between items-center">
                <div className="flex flex-col">
                   <div className="text-[14px] font-bold text-slate-800 flex items-center gap-1.5 mb-1"><i className="ti ti-folder text-blue-600"></i> Physics</div>
                   <div className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded w-fit flex items-center gap-1"><i className="ti ti-stopwatch"></i> 45m 12s</div>
                </div>
                <div className="text-right">
                   <div className="text-[16px] font-black text-slate-800">85 <span className="text-[11px] text-slate-400 font-bold">/ 100</span></div>
                   <div className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full inline-block mt-1">85%</div>
                </div>
            </div>
          )
        },
        {
          title: "8. Advanced Review Filters",
          desc: "Don't waste time scrolling through questions you already know! Use the Review Filters to instantly sort the paper. You can view only 'Wrong' questions to learn from your mistakes, or filter by a specific 'Section' like Chemistry.",
          mockup: (
            <div className="w-full border-b border-slate-200 pb-2">
                <div className="flex gap-2 flex-wrap mb-2">
                   <div className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1">All <span className="bg-slate-200 px-1 rounded text-[10px]">75</span></div>
                   <div className="bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1 ring-1 ring-rose-100">Wrong <span className="bg-rose-100 px-1 rounded text-[10px]">20</span></div>
                   <div className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1">Skipped <span className="bg-slate-200 px-1 rounded text-[10px]">10</span></div>
                </div>
                <div className="flex gap-2">
                   <div className="bg-slate-800 text-white px-3 py-1 rounded-full text-[11px] font-bold">All Sections</div>
                   <div className="bg-white border border-slate-200 text-slate-500 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm">Physics</div>
                </div>
            </div>
          )
        },
        {
          title: "9. Deep Question Review & Time Tracking",
          desc: "Each question card reveals everything. You'll see the exact time (in seconds/minutes) you spent on that specific question. It renders complex MathJax and Hybrid Figures natively, so you see the question exactly as it was during the exam.",
          mockup: (
            <div className="w-full bg-white border border-rose-200 p-4 rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-400 to-red-500"></div>
                <div className="flex justify-between items-center mb-3 mt-1">
                   <div className="text-[14px] font-black text-rose-700 flex items-center gap-1.5"><i className="ti ti-circle-x text-lg"></i> Q4</div>
                   <div className="flex gap-2">
                      <span className="border border-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm"><i className="ti ti-stopwatch"></i> 1m 15s</span>
                      <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">Wrong</span>
                   </div>
                </div>
                <div className="text-[13px] font-semibold text-slate-800 leading-snug">Calculate the flux passing through the closed surface.</div>
            </div>
          )
        },
        {
          title: "10. Answer Comparison (Your Answer vs Correct Key)",
          desc: "For MCQs, your chosen option is marked as 'Picked', and the correct one is marked as 'Key'. For Integer and Subjective questions, the UI splits into two distinct blocks showing exactly what you wrote versus what the Examiner's Model Answer was.",
          mockup: (
            <div className="w-full flex gap-3">
               <div className="flex-1 bg-rose-50 border border-rose-200 p-3 rounded-xl flex flex-col justify-center">
                  <span className="text-[9px] font-extrabold text-rose-700 uppercase tracking-widest mb-1 opacity-70">Your Answer</span>
                  <span className="text-[18px] font-black text-rose-900">45</span>
               </div>
               <div className="flex-1 bg-white border border-emerald-400 p-3 rounded-xl flex flex-col justify-center shadow-sm relative overflow-hidden">
                  <i className="ti ti-key absolute -right-2 -bottom-2 text-4xl text-emerald-50"></i>
                  <span className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-widest mb-1 opacity-70 relative z-10">Correct Key</span>
                  <span className="text-[18px] font-black text-emerald-900 relative z-10">90</span>
               </div>
            </div>
          )
        },
        {
          title: "11. Solutions & Logic Accordion",
          desc: "If the examiner provided an explanation or step-by-step mathematical logic for a question, a 'View Solution / Logic' accordion appears at the bottom of the card. Clicking it reveals the detailed methodology to solve the problem.",
          mockup: (
            <div className="w-full bg-slate-50 border border-indigo-100 rounded-xl p-3 shadow-sm flex justify-between items-center">
               <div className="text-[12px] font-bold text-indigo-700 flex items-center gap-1.5"><i className="ti ti-bulb text-lg"></i> View Solution / Logic</div>
               <div className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-500"><i className="ti ti-chevron-down text-xs"></i></div>
            </div>
          )
        },
        {
          title: "12. Proctoring & Cheat Logs Transparency",
          desc: "If you received warnings during the exam, they are permanently logged. A dropdown at the top of your report shows the exact timestamps and reasons (e.g., 'Tab Switching'). If you were auto-kicked, the box turns red, indicating your exam was terminated early due to violations.",
          mockup: (
            <div className="w-full bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-sm flex justify-between items-center">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center"><i className="ti ti-shield-x"></i></div>
                  <div className="flex flex-col"><span className="text-[13px] font-black text-rose-900">Exam Terminated Early</span><span className="text-[10px] font-bold text-rose-700 mt-0.5">System recorded suspicious activities.</span></div>
               </div>
               <i className="ti ti-chevron-down text-rose-500"></i>
            </div>
          )
        },
        {
          title: "13. Immutable Evaluation Audit Trail",
          desc: "If the examiner manually overrides your grade (e.g., giving you partial marks for a subjective question), an 'Evaluation Audit Trail' appears on that question. It shows the exact marks awarded, the examiner's name, the date, and the justification reasoning they provided. Absolute transparency.",
          mockup: (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-2">
               <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><i className="ti ti-history"></i> Evaluation Audit Trail</div>
               <div className="bg-white border border-slate-200 p-2.5 rounded-lg flex flex-col shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                     <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-black border border-emerald-200">2.5 Mks</span>
                     <span className="text-[9px] font-bold text-slate-400">EXAMINER • OCT 24</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 italic border-l-2 border-slate-200 pl-2 ml-1">
                     &quot;Awarded partial marks for correct formula approach despite calculation error.&quot;
                  </div>
               </div>
            </div>
          )
        }
      ]
    }
  };

  const currentGuide = guideData[activeTopic] || guideData.create;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-200">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
            <i className="ti ti-arrow-left text-xl"></i>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xl shadow-md shadow-blue-600/20">
              <i className="ti ti-book-2"></i>
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight m-0 hidden sm:block">ExamiTop Docs</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-full border border-slate-200 uppercase tracking-widest">
            {userRole === "examiner" ? "Examiner View" : "Student View"}
          </span>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-73px)]">
        
        {/* Left Sidebar (Navigation) */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-5 gap-2 shrink-0 overflow-y-auto custom-scrollbar hidden md:flex z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pl-2">Modules</div>
          {sidebarModules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveTopic(mod.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[14px] transition-all text-left ${activeTopic === mod.id ? `bg-${mod.color}-50 text-${mod.color}-700 shadow-sm border border-${mod.color}-100` : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent"}`}
            >
              <i className={`ti ${mod.icon} text-lg ${activeTopic === mod.id ? `text-${mod.color}-600` : "text-slate-400"}`}></i>
              {mod.label}
            </button>
          ))}
        </aside>

        {/* Right Content Area (Single Scroll) */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 p-6 md:p-10 relative scroll-smooth">
           <div className="max-w-4xl mx-auto pb-20">
              
              {/* Hero Section */}
              <div className="mb-12 text-center md:text-left flex flex-col md:flex-row md:items-center gap-6 animate-[fadeIn_0.4s_ease]">
                 <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center text-4xl shadow-xl shadow-slate-200/50 shrink-0 mx-auto md:mx-0">
                    <i className={`ti ${currentGuide.icon}`}></i>
                 </div>
                 <div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight m-0">{currentGuide.title}</h2>
                    <p className="text-slate-500 font-medium mt-2 text-[16px] max-w-2xl">{currentGuide.subtitle}</p>
                 </div>
              </div>

              {/* Sections (One continuous scroll) */}
              <div className="space-y-12">
                {currentGuide.sections.length > 0 ? (
                  currentGuide.sections.map((sec, idx) => (
                    <div key={idx} className="flex flex-col lg:flex-row gap-8 items-start animate-[slideUp_0.4s_ease] border-b border-slate-200/60 pb-12 last:border-0 last:pb-0">
                       
                       {/* Left Side: Text */}
                       <div className="lg:w-1/2 shrink-0">
                          <h3 className="text-xl font-black text-slate-800 mb-3 tracking-tight">{sec.title}</h3>
                          <p className="text-slate-600 font-medium leading-relaxed text-[15px]">{sec.desc}</p>
                       </div>

                       {/* Right Side: Mockup UI */}
                       <div className="lg:w-1/2 w-full flex items-center justify-center bg-white p-6 md:p-8 rounded-[24px] border border-slate-200 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)]">
                          {sec.mockup}
                       </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 bg-white rounded-[24px] border border-slate-200 text-slate-400 font-bold flex flex-col items-center">
                    <i className="ti ti-hammer text-5xl mb-3 opacity-30"></i>
                    Documentation for this module is currently being written.
                  </div>
                )}
              </div>

              {/* PREMIUM SUPPORT CTA (FIXED AT END OF GUIDE) */}
              <div className="mt-20 relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0B0F19] to-[#1e293b] border border-slate-700 shadow-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 animate-[slideUp_0.5s_ease_forwards]">
                 {/* Glowing Background Effects */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                 <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none translate-y-1/2 -translate-x-1/4"></div>

                 <div className="relative z-10 text-center sm:text-left">
                    <h3 className="text-2xl md:text-3xl font-black text-white mb-2 flex items-center justify-center sm:justify-start gap-2.5">
                       <i className="ti ti-headset text-blue-400"></i> Need Further Information?
                    </h3>
                    <p className="text-slate-400 font-medium text-[15px] max-w-md">
                       Still have doubts about the platform or need custom features? Our engineering team is available 24/7 to assist you.
                    </p>
                 </div>

                 <div className="relative z-10 shrink-0 flex flex-col items-center sm:items-end">
                    <a
                       href="mailto:support.examitop@gmail.com?subject=Platform%20Support%20Request"
                       className="group flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-[15px] rounded-2xl shadow-[0_10px_25px_rgba(37,99,235,0.3)] hover:shadow-[0_15px_35px_rgba(37,99,235,0.4)] transition-all active:scale-95"
                    >
                       <i className="ti ti-mail text-xl group-hover:-translate-y-1 group-hover:scale-110 transition-transform duration-300"></i>
                       Contact Support
                    </a>
                    <div className="text-[11px] font-bold text-slate-500 mt-3 text-center sm:text-right uppercase tracking-widest flex items-center gap-1.5">
                       <i className="ti ti-send"></i> support.examitop@gmail.com
                    </div>
                 </div>
              </div>

           </div>
        </main>
      </div>
    </div>
  );
}

// Wrap in Suspense for Next.js build
export default function GuidePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="spinner"></div></div>}>
       <GuideContent />
    </Suspense>
  );
}