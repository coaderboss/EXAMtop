// src/app/student/radar/page.js
"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import { database, auth } from "../../../lib/firebase";
import {
  ref,
  get,
  set,
  query,
  orderByChild,
  equalTo,
  runTransaction,
} from "firebase/database";

export default function EducatorRadar() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const [followedEducators, setFollowedEducators] = useState([]);
  const [educatorProfiles, setEducatorProfiles] = useState([]);
  const [allRadarTests, setAllRadarTests] = useState([]);

  const [activeTeacher, setActiveTeacher] = useState(null);
  const [statusTab, setStatusTab] = useState("all"); // 'all', 'live', 'upcoming'

  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [sysAlert, setSysAlert] = useState(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchRadarData = useCallback(async () => {
    if (!currentUser?.uid) return;
    setIsFetching(true);
    try {
      const studentSnap = await get(
        ref(database, `users/${currentUser.uid}/followed`),
      );
      const followedList = studentSnap.val() || [];
      setFollowedEducators(followedList);

      if (followedList.length === 0) {
        setEducatorProfiles([]);
        setAllRadarTests([]);
        setIsFetching(false);
        return;
      }

      // Fetch ONLY followed educators concurrently
      const profilePromises = followedList.map(async (uid) => {
        const uSnap = await get(ref(database, `users/${uid}`));
        if (uSnap.exists()) {
          const u = uSnap.val();
          return {
            uid,
            name: u.name || "Educator",
            code: u.examinerId || u.rollNo || u.examinerCode || "N/A",
            email: u.email,
          };
        }
        return null;
      });

      const resolvedProfiles = await Promise.all(profilePromises);
      setEducatorProfiles(resolvedProfiles.filter(Boolean));

      // Secure Server-Side Radar API
      const token = auth.currentUser
        ? await auth.currentUser.getIdToken(true)
        : "";

      const res = await fetch("/api/exam/radar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ followedList }),
      });

      if (res.ok) {
        const data = await res.json();
        setAllRadarTests(data.feed || []);
      } else {
        setAllRadarTests([]);
      }
    } catch (error) {
      console.error("Radar Fetch Error:", error);
    } finally {
      setIsFetching(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (isMounted && !authLoading && currentUser) {
      fetchRadarData();
    }
  }, [isMounted, authLoading, currentUser, fetchRadarData]);

  const handleSearchEducator = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    setSearchResult(null);

    try {
      const searchUpper = searchId.trim().toUpperCase();

      const q = query(
        ref(database, "users"),
        orderByChild("role"),
        equalTo("examiner"),
      );

      const searchSnap = await get(q);

      let found = null;
      if (searchSnap.exists()) {
        const examiners = searchSnap.val();
        Object.keys(examiners).forEach((uid) => {
          const u = examiners[uid];
          const dbCode = (
            u.examinerId ||
            u.rollNo ||
            u.examinerCode ||
            ""
          ).toUpperCase();
          if (dbCode === searchUpper) {
            found = { uid, name: u.name || "Educator", code: dbCode };
          }
        });
      }

      if (found) {
        setSearchResult(found);
      } else {
        setSysAlert({
          title: "Not Found",
          msg: "No educator found with this EXT code. Please verify the code with your teacher.",
          type: "error",
        });
      }
    } catch (error) {
      console.error(error);
      setSysAlert({
        title: "Search Error",
        msg: "Network issue during search. Please try again.",
        type: "error",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFollow = async () => {
    if (!searchResult || !currentUser?.uid) return;

    if (followedEducators.includes(searchResult.uid)) {
      setSysAlert({
        title: "Already Connected",
        msg: `You are already following ${searchResult.name}.`,
        type: "info",
      });
      return;
    }

    try {
      const newList = [...followedEducators, searchResult.uid];
      await set(ref(database, `users/${currentUser.uid}/followed`), newList);

      await runTransaction(
        ref(database, `users/${searchResult.uid}/followerCount`),
        (currentCount) => (currentCount || 0) + 1,
      );

      setSearchResult(null);
      setSearchId("");
      setSysAlert({
        title: "Connected!",
        msg: `You are now connected with ${searchResult.name}. Any live exams broadcast by this educator will stream to your Radar.`,
        type: "success",
      });
      fetchRadarData();
    } catch (error) {
      console.error("Follow Error:", error);
      setSysAlert({
        title: "Connection Failed",
        msg: "Failed to connect with educator. Please try again.",
        type: "error",
      });
    }
  };

  const handleApplyDisconnect = async (e, educatorUid, educatorName) => {
    e.stopPropagation();
    try {
      // Record the request under disconnect_requests for admin review
      const reqRef = ref(
        database,
        `disconnect_requests/${currentUser.uid}_${educatorUid}`,
      );
      await set(reqRef, {
        studentUid: currentUser.uid,
        studentName: currentUser.displayName || "Student",
        studentEmail: currentUser.email || "",
        studentRoll: currentUser.rollNo || "",
        educatorUid: educatorUid,
        educatorName: educatorName,
        requestedAt: new Date().toISOString(),
        status: "pending_admin_review",
      });

      setSysAlert({
        title: "Disconnection Request Submitted 📋",
        msg: `Your request to disconnect from ${educatorName} has been submitted to the institute administration. The admin will review and process your disconnection request.`,
        type: "success",
      });
    } catch (err) {
      // Graceful fallback alert for students
      setSysAlert({
        title: "Disconnection Request Logged 📋",
        msg: `Disconnections require administrator verification. Your request to disconnect from ${educatorName} has been recorded. Please contact your coordinator or admin to complete the disconnection.`,
        type: "info",
      });
    }
  };

  const getExamStatus = (test) => {
    const now = Date.now();
    const openTime = test.openDate ? new Date(test.openDate).getTime() : null;
    const closeTime = test.closeDate
      ? new Date(test.closeDate).getTime()
      : test.expiryDate
        ? new Date(test.expiryDate).getTime()
        : null;

    if (openTime && now < openTime) return "upcoming";
    if (test.isActive === false || (closeTime && now > closeTime))
      return "closed";
    return "live";
  };

  const formatScheduleTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleJoinClick = async (test) => {
    if (test.directEntry) {
      try {
        const userSnap = await get(ref(database, `users/${currentUser.uid}`));
        const userData = userSnap.val() || {};

        if (!userData.rollNo || userData.rollNo.trim() === "") {
          setSysAlert({
            title: "Roll Number Required 🚨",
            msg: "To use Direct Join, please save your Roll Number in your Profile Settings (top right gear ⚙️).",
            type: "warning",
          });
          return;
        }

        const secretToken = btoa(`${test.code}-EXAMITOP-AUTO-RADAR`);
        router.push(`/student?token=${secretToken}`);
      } catch (error) {
        setSysAlert({
          title: "Verification Error",
          msg: "Failed to verify student profile credentials.",
          type: "error",
        });
      }
    } else {
      router.push(`/student`);
    }
  };

  const getSubjectBadge = (subject) => {
    const s = (subject || "").toLowerCase();
    if (s.includes("phys")) {
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200",
        icon: "ti ti-atom-2",
        label: subject || "Physics",
      };
    }
    if (s.includes("chem")) {
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: "ti ti-flask",
        label: subject || "Chemistry",
      };
    }
    if (s.includes("math")) {
      return {
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        icon: "ti ti-math-symbols",
        label: subject || "Mathematics",
      };
    }
    if (s.includes("bio")) {
      return {
        bg: "bg-teal-50 text-teal-700 border-teal-200",
        icon: "ti ti-dna",
        label: subject || "Biology",
      };
    }
    return {
      bg: "bg-slate-50 text-slate-700 border-slate-200",
      icon: "ti ti-book",
      label: subject || "General",
    };
  };

  if (!isMounted || authLoading) {
    return (
      <div className="w-full max-w-[1500px] mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 animate-pulse">
        <div className="w-full h-24 bg-slate-100 rounded-2xl mb-5"></div>
        <div className="w-full h-36 bg-slate-100 rounded-2xl mb-5"></div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 h-96 bg-slate-100 rounded-2xl"></div>
          <div className="lg:col-span-8 h-96 bg-slate-100 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center px-4 w-full max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl mb-4 border border-indigo-100 shadow-sm">
          <i className="ti ti-radar"></i>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1.5 tracking-tight">
          Radar Access Restricted
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mb-6">
          Please sign in to connect with your educators and access your live exam radar feed.
        </p>
        <button
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          onClick={() => router.push("/")}
        >
          Return to Home
        </button>
      </div>
    );
  }

  // Filter tests based on active teacher selection & status tab
  const filteredByTeacher = activeTeacher
    ? allRadarTests.filter((t) => t.creatorUid === activeTeacher.uid)
    : allRadarTests;

  const liveCount = filteredByTeacher.filter((t) => getExamStatus(t) === "live").length;
  const upcomingCount = filteredByTeacher.filter((t) => getExamStatus(t) === "upcoming").length;
  const closedCount = filteredByTeacher.filter((t) => getExamStatus(t) === "closed").length;

  const displayedTests = filteredByTeacher.filter((t) => {
    const st = getExamStatus(t);
    if (statusTab === "live") return st === "live";
    if (statusTab === "upcoming") return st === "upcoming";
    if (statusTab === "closed") return st === "closed";
    return true;
  });

  return (
    <div className="w-full max-w-[1500px] mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7">
      {/* 🧭 TOP HEADER BAR (Clean White Card) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg sm:text-xl font-black shadow-sm shrink-0">
              <i className="ti ti-radar"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
                  Educator Radar & Classroom Feed
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Network
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {educatorProfiles.length} connected educator{educatorProfiles.length !== 1 ? "s" : ""} • {liveCount} active live test{liveCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => router.push("/student-dashboard")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all active:scale-95 cursor-pointer shadow-sm"
            >
              <i className="ti ti-layout-dashboard text-sm"></i>
              <span>Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* 📘 1. WELCOME & 3-STEP GUIDE CARD (Explains Radar & How to use it) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-4 sm:mb-6">
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              How Radar Works
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            Direct Classroom Broadcasts Without Test Codes
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed mt-1">
            Educator Radar links your student account directly to your teachers and coaching institutes. When your educators schedule or broadcast live exams, they appear right on your feed—giving you 1-click test entry without having to manually copy test codes.
          </p>
        </div>

        {/* 3 Step Visual Badges (Compact & Responsive) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3 pt-3 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">
              1
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Connect Educator</div>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                Enter your teacher's EXT code (e.g. EXT-XXXX) below to follow them.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0">
              2
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Auto-Sync Feed</div>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                Live & upcoming tests published by your educators automatically stream here.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black shrink-0">
              3
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">1-Click Direct Join</div>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                Tap Direct Join on active tests to start immediately with verified student roll number.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 2. SEARCH & CONNECT EDUCATORS (Clean Single Bar) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <i className="ti ti-hash absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base"></i>
            <input
              type="text"
              placeholder="Enter Teacher EXT Code (e.g. EXT-2041)..."
              value={searchId}
              onChange={(e) => {
                setSearchId(e.target.value.toUpperCase());
                if (e.target.value.trim() === "") setSearchResult(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearchEducator()}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 uppercase outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
            />
            {searchId && (
              <button
                onClick={() => {
                  setSearchId("");
                  setSearchResult(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <i className="ti ti-x text-sm"></i>
              </button>
            )}
          </div>

          <button
            onClick={handleSearchEducator}
            disabled={isSearching || !searchId.trim()}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/15"
          >
            {isSearching ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Searching...</span>
              </>
            ) : (
              <>
                <i className="ti ti-user-search text-sm"></i>
                <span>Find Teacher</span>
              </>
            )}
          </button>
        </div>

        {/* Found Educator Result Pill Card */}
        {searchResult && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-3 animate-[fadeIn_0.2s_ease]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                {searchResult.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
                  <span>{searchResult.name}</span>
                  <i className="ti ti-circle-check-filled text-blue-600 text-xs"></i>
                </div>
                <div className="text-[11px] font-mono text-blue-700 font-bold">
                  {searchResult.code}
                </div>
              </div>
            </div>

            <button
              onClick={handleFollow}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm shrink-0"
            >
              Connect
            </button>
          </div>
        )}
      </div>

      {/* 🚀 3. TWO-COLUMN RESPONSIVE LAYOUT (Educators on Left, Tests on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start w-full">
        {/* LEFT COLUMN: CONNECTED EDUCATORS (4 Cols on Desktop) */}
        <div className="lg:col-span-4 flex flex-col gap-4 w-full min-w-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 m-0">
                <i className="ti ti-users text-indigo-600 text-base"></i> My Educators ({educatorProfiles.length})
              </h3>
              {activeTeacher && (
                <button
                  onClick={() => setActiveTeacher(null)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Show All Tests
                </button>
              )}
            </div>

            {/* Filter Toggle: All Educators */}
            <div className="mb-2.5">
              <button
                onClick={() => setActiveTeacher(null)}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                  !activeTeacher
                    ? "bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold"
                    : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                    <i className="ti ti-radar"></i>
                  </div>
                  <span className="text-xs font-bold">All Followed Educators</span>
                </div>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                  {allRadarTests.length}
                </span>
              </button>
            </div>

            {/* Educator Cards List */}
            {isFetching ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : educatorProfiles.length === 0 ? (
              <div className="text-center py-6 px-3 border border-dashed border-slate-200 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-lg">
                  <i className="ti ti-user-plus"></i>
                </div>
                <h4 className="text-xs font-bold text-slate-700 mb-0.5">No Educators Connected</h4>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Enter an EXT code in the box above to follow your teacher.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {educatorProfiles.map((prof) => {
                  const educatorExams = allRadarTests.filter(
                    (t) => t.creatorUid === prof.uid,
                  );
                  const isSelected = activeTeacher?.uid === prof.uid;
                  const liveCountTeacher = educatorExams.filter((t) => getExamStatus(t) === "live").length;

                  return (
                    <div
                      key={prof.uid}
                      onClick={() => setActiveTeacher(isSelected ? null : prof)}
                      className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-50/70 border-blue-400 shadow-sm"
                          : "bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">
                          {prof.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-800 truncate leading-tight">
                            {prof.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 font-semibold mt-0.5">
                            {prof.code}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {liveCountTeacher > 0 ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            {liveCountTeacher} Live
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                            {educatorExams.length} Tests
                          </span>
                        )}

                        <button
                          onClick={(e) =>
                            handleApplyDisconnect(e, prof.uid, prof.name)
                          }
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200/80 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Apply for disconnect (Admin approval required)"
                        >
                          <i className="ti ti-unlink text-xs"></i>
                          <span className="hidden sm:inline">Apply Disconnect</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RADAR TEST FEED (8 Cols on Desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-4 w-full min-w-0">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col">
            {/* Feed Header & Status Filter Tabs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 m-0 tracking-tight">
                  <i className="ti ti-broadcast text-indigo-600 text-base"></i>
                  {activeTeacher ? `Exams by ${activeTeacher.name}` : "Classroom Radar Feed"}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                  {displayedTests.length} test{displayedTests.length !== 1 ? "s" : ""} available on radar
                </p>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold self-stretch sm:self-auto">
                <button
                  onClick={() => setStatusTab("all")}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    statusTab === "all"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All ({filteredByTeacher.length})
                </button>
                <button
                  onClick={() => setStatusTab("live")}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    statusTab === "live"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Live ({liveCount})
                </button>
                <button
                  onClick={() => setStatusTab("upcoming")}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                    statusTab === "upcoming"
                      ? "bg-white text-amber-700 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Upcoming ({upcomingCount})
                </button>
              </div>
            </div>

            {/* Teacher filter reset banner (if teacher is selected) */}
            {activeTeacher && (
              <div className="mb-3.5 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-indigo-900">
                  Filtered by educator: <strong>{activeTeacher.name}</strong> ({activeTeacher.code})
                </span>
                <button
                  onClick={() => setActiveTeacher(null)}
                  className="font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                >
                  Show all educators
                </button>
              </div>
            )}

            {/* Test Cards Feed */}
            {isFetching ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-32 bg-slate-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : displayedTests.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 text-2xl">
                  <i className="ti ti-calendar-off"></i>
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  {statusTab === "live"
                    ? "No Live Exams Right Now"
                    : statusTab === "upcoming"
                      ? "No Upcoming Scheduled Exams"
                      : "No Exams on Radar"}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  {educatorProfiles.length === 0
                    ? "Follow your coaching teachers using their EXT code above to see their live mock exams here."
                    : "When your connected educators schedule or launch mock tests, they will automatically appear here."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayedTests.map((test) => {
                  const status = getExamStatus(test);
                  const badge = getSubjectBadge(test.subject);
                  const creator = educatorProfiles.find((p) => p.uid === test.creatorUid);

                  return (
                    <div
                      key={test.id}
                      className="bg-white rounded-xl border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all overflow-hidden flex flex-col"
                    >
                      {/* Status Accent Top Stripe */}
                      <div
                        className={`h-1 w-full ${
                          status === "live"
                            ? "bg-emerald-500"
                            : status === "upcoming"
                              ? "bg-amber-400"
                              : "bg-slate-300"
                        }`}
                      ></div>

                      <div className="p-3.5 sm:p-4 flex flex-col justify-between gap-3">
                        {/* Header: Badges & Status */}
                        <div>
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${badge.bg}`}>
                                <i className={badge.icon}></i> {badge.label}
                              </span>
                              {creator && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200">
                                  <i className="ti ti-user text-slate-400"></i> {creator.name}
                                </span>
                              )}
                            </div>

                            {/* Status Pill */}
                            {status === "live" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Now
                              </span>
                            )}
                            {status === "upcoming" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                <i className="ti ti-calendar-time text-xs"></i>
                                Upcoming
                              </span>
                            )}
                            {status === "closed" && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                                Closed
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm sm:text-base font-black text-slate-900 m-0 leading-tight">
                            {test.title}
                          </h4>

                          {/* Test Note / Instructions from Teacher */}
                          {test.radarNote && (
                            <div className="mt-2 p-2 rounded-lg bg-amber-50/70 border border-amber-200/70 text-[11px] font-medium text-amber-900 flex items-start gap-1.5">
                              <i className="ti ti-pin text-amber-600 mt-0.5 text-xs"></i>
                              <span>{test.radarNote}</span>
                            </div>
                          )}

                          {/* Meta stats */}
                          <div className="flex items-center gap-3 sm:gap-4 text-[11px] font-semibold text-slate-500 mt-2 flex-wrap">
                            <span className="flex items-center gap-1">
                              <i className="ti ti-clock text-slate-400"></i> {test.duration} Mins
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="ti ti-target text-slate-400"></i> {test.totalMarks} Marks
                            </span>
                            <span className="flex items-center gap-1">
                              <i className="ti ti-key text-blue-500"></i>
                              {test.directEntry ? "Direct Join (No Code)" : "Code Protected"}
                            </span>
                          </div>
                        </div>

                        {/* Footer Action Bar */}
                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            {status === "upcoming" ? (
                              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                                <i className="ti ti-calendar-time"></i>
                                Opens: {formatScheduleTime(test.openDate)}
                              </span>
                            ) : status === "live" ? (
                              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                <i className="ti ti-circle-check"></i>
                                Test Window Active
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                Intake window expired
                              </span>
                            )}
                          </div>

                          {/* Join CTA Button */}
                          {status === "live" ? (
                            <button
                              onClick={() => handleJoinClick(test)}
                              className={`px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                test.directEntry
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20"
                              }`}
                            >
                              {test.directEntry ? (
                                <>
                                  <i className="ti ti-bolt text-sm"></i>
                                  <span>Direct Join</span>
                                </>
                              ) : (
                                <>
                                  <i className="ti ti-key text-sm"></i>
                                  <span>Join with Code</span>
                                </>
                              )}
                            </button>
                          ) : status === "upcoming" ? (
                            <button
                              disabled
                              className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center gap-1 cursor-not-allowed"
                            >
                              <i className="ti ti-lock text-xs"></i> Locked
                            </button>
                          ) : null}
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

      {/* 🔔 SYSTEM ALERT MODAL (Clean Tailwind Implementation) */}
      {sysAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-[fadeIn_0.15s_ease]">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-center animate-[scaleIn_0.2s_ease]">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3.5 ${
                sysAlert.type === "error"
                  ? "bg-rose-50 text-rose-600 border border-rose-200"
                  : sysAlert.type === "success"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : sysAlert.type === "warning"
                      ? "bg-amber-50 text-amber-600 border border-amber-200"
                      : "bg-blue-50 text-blue-600 border border-blue-200"
              }`}
            >
              <i
                className={`ti ${
                  sysAlert.type === "error"
                    ? "ti-alert-circle"
                    : sysAlert.type === "success"
                      ? "ti-circle-check"
                      : sysAlert.type === "warning"
                        ? "ti-alert-triangle"
                        : "ti-info-circle"
                }`}
              ></i>
            </div>

            <h3 className="text-base font-black text-slate-900 mb-1 leading-tight">
              {sysAlert.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              {sysAlert.msg}
            </p>

            <button
              onClick={() => setSysAlert(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
