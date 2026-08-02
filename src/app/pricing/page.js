// src/app/pricing/page.js
"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { database } from "../../lib/firebase";
import { ref, get, update } from "firebase/database";
import jsPDF from "jspdf";

export default function PricingPage() {
  const { currentUser, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [sysAlert, setSysAlert] = useState(null);

  const [canCloseModal, setCanCloseModal] = useState(false);

  // Popup aane par 1.5s ka timeout lagana
  useEffect(() => {
    if (sysAlert) {
      setCanCloseModal(false);
      const timer = setTimeout(() => setCanCloseModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [sysAlert]);

  useEffect(() => {
    if (
      !authLoading &&
      (!currentUser || (userRole !== "examiner" && userRole !== "admin"))
    ) {
      router.replace("/");
    }
  }, [currentUser, userRole, authLoading, router]);

  const loadRazorpayScript = (src) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // PDF Receipt Generator
  const downloadReceipt = (receiptData) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(24);
    doc.setTextColor(24, 95, 165); // ExamiTop Blue
    doc.text("ExamiTop", 20, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text("Payment Receipt", 20, 30);

    // Line separator
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);

    // Customer & Invoice Details
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text(`Date: ${receiptData.date}`, 20, 45);
    doc.text(`Transaction ID: ${receiptData.txId}`, 20, 52);
    doc.text(
      `Billed To: ${currentUser?.displayName || "ExamiTop User"}`,
      20,
      59,
    );
    doc.text(`Email: ${currentUser?.email || "N/A"}`, 20, 66);

    // Table Header
    doc.setFillColor(245, 245, 245);
    doc.rect(20, 75, 170, 10, "F");
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("Description", 25, 82);
    doc.text("Amount", 160, 82);

    // Table Content
    doc.setFont(undefined, "normal");
    doc.text(receiptData.planName, 25, 95);
    doc.text(`Rs. ${receiptData.amount}`, 160, 95);

    doc.line(20, 105, 190, 105);

    // Total
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("Total Paid:", 125, 115);
    doc.setTextColor(16, 185, 129); // Emerald Green
    doc.text(`Rs. ${receiptData.amount}`, 160, 115);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.setFont(undefined, "normal");
    doc.text("Thank you for choosing ExamiTop!", 20, 140);
    doc.text("For support, contact: support.examitop@gmail.com", 20, 146);

    // Save PDF
    doc.save(`ExamiTop_Receipt_${receiptData.txId}.pdf`);
  };

  const handlePayment = async (
    amount,
    tokensToAdd,
    makeUnlimited = false,
    planName = "",
  ) => {
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("isOfflineMode") === "true"
    ) {
      setSysAlert({
        title: "Offline Mode",
        msg: "Payments cannot be processed in offline mode.",
        type: "warning",
      });
      return;
    }

    setIsProcessingPayment(true);

    try {
      // 1. Backend se Secure Order ID generate karwana
      const orderRes = await fetch("/api/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok) throw new Error("Failed to create order");

      // 2. Razorpay Script Load karna
      const res = await loadRazorpayScript(
        "https://checkout.razorpay.com/v1/checkout.js",
      );
      if (!res) {
        setSysAlert({
          title: "Network Error",
          msg: "Failed to load payment gateway. Check your internet.",
          type: "error",
        });
        setIsProcessingPayment(false);
        return;
      }

      // 3. Payment Gateway Open karna
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: amount * 100,
        currency: "INR",
        name: "ExamiTop Engine",
        description: makeUnlimited
          ? "1 Year Unlimited Pro Access"
          : `${tokensToAdd} Premium Test Tokens`,
        image: "/logo.png",
        order_id: orderData.id,
        handler: async function (response) {
          try {
            // 🚨 THE SAFETY NET: Verify signature strictly in backend before DB update
            const verifyRes = await fetch("/api/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyData.success) {
              throw new Error("Security breach: Payment signature mismatch.");
            }

            // 4. Payment 100% Verify ho gayi! Ab Firebase update karo
            const userRef = ref(database, `users/${currentUser.uid}`);
            const snapshot = await get(userRef);
            const userData = snapshot.val() || {};

            let currentQuota = userData.available_quota || 0;
            const history = userData.billingHistory || [];
            const now = new Date().toISOString();

            const newRecord = {
              date: now,
              plan: planName,
              tokensAdded: tokensToAdd,
              type: makeUnlimited ? "Subscription" : "Tokens",
              source: "Razorpay Gateway",
              paymentId: response.razorpay_payment_id,
            };

            let updates = {
              billingHistory: [newRecord, ...history],
              last_upgrade_date: now,
              last_upgrade_plan: planName,
            };

            if (makeUnlimited) {
              updates.is_unlimited = true;
              const expiry = new Date();
              expiry.setFullYear(expiry.getFullYear() + 1);
              updates.unlimited_expiry_date = expiry.toISOString();
            } else {
              updates.available_quota = currentQuota + tokensToAdd;
            }

            await update(userRef, updates);

            // Yahan update karna hai (Line 135 ke aas-pass)
            setSysAlert({
              title: "Payment Successful! 🎉",
              msg: `Transaction ID: ${response.razorpay_payment_id}. Your account has been upgraded.`,
              type: "success",
              receiptData: {
                txId: response.razorpay_payment_id,
                amount: amount,
                planName: planName,
                date: new Date().toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
              },
              action: () => {
                window.location.href = "/tests";
              },
            });
          } catch (error) {
            setSysAlert({
              title: "Verification Error",
              msg: "Payment verification failed. If money was deducted, contact support.",
              type: "error",
            });
          }
        },
        prefill: {
          name: currentUser?.displayName || "Examiner",
          email: currentUser?.email || "",
        },
        theme: { color: "#185FA5" },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
          },
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error) {
      console.error(error);
      setSysAlert({
        title: "Server Error",
        msg: "Could not initialize secure payment. Try again later.",
        type: "error",
      });
      setIsProcessingPayment(false);
    }
  };

  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-[#185FA5] border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-[#185FA5]">
            <i className="ti ti-crown text-2xl"></i>
          </div>
        </div>
        <h3 className="text-lg font-black text-slate-700 tracking-wide">
          Loading Pro Plans...
        </h3>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 animate-[fadeIn_0.4s_ease]">
      <div className="bg-gradient-to-br from-[#185FA5] to-[#0A2E5C] pt-20 pb-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="w-96 h-96 bg-blue-400/20 rounded-full absolute -top-20 -right-20 blur-3xl"></div>
        <div className="w-72 h-72 bg-indigo-500/20 rounded-full absolute bottom-0 left-10 blur-3xl"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 flex items-center justify-center text-5xl text-[#FAC775] shadow-lg mx-auto mb-6">
            <i className="ti ti-crown"></i>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
            ExamiTop Pro Plans
          </h1>
          <p className="text-lg text-blue-100 font-medium max-w-2xl mx-auto">
            Elevate your assessment capabilities. Secure, scalable, and built
            for modern educators.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-20 relative z-20">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-1">
              Current Balance
            </h3>
            {currentUser?.is_unlimited ? (
              <div className="text-2xl font-black text-[#D4AF37] flex items-center gap-2 justify-center sm:justify-start">
                <i className="ti ti-infinity"></i> PRO UNLIMITED ACTIVE
              </div>
            ) : (
              <div className="text-2xl font-black text-slate-800 flex items-center gap-2 justify-center sm:justify-start">
                {currentUser?.available_quota || 0}{" "}
                <span className="text-base text-slate-500 font-bold">
                  Tokens Remaining
                </span>
              </div>
            )}
          </div>
          <button
            className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
            onClick={() => router.push("/tests")}
          >
            <i className="ti ti-arrow-left"></i> Go to Vault
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 flex flex-col transition-all duration-300 ease-out hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:border-blue-400 group cursor-pointer relative">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 text-2xl mb-4 group-hover:text-blue-500 transition-colors border border-slate-100">
              <i className="ti ti-rocket"></i>
            </div>
            <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">
              Starter Pack
            </div>
            <div className="flex items-end gap-1 mb-2">
              <div className="text-5xl font-black text-slate-800 leading-none">
                ₹49
              </div>
              <div className="text-sm font-bold text-slate-400 mb-1">
                / One-time
              </div>
            </div>
            <p className="text-slate-500 text-sm font-medium mb-6 h-10">
              Perfect for individual educators managing small batches.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
              <div className="text-lg font-black text-blue-600 mb-3 flex items-center gap-2">
                <i className="ti ti-coin"></i> +10 Test Tokens
              </div>
              <ul className="text-sm text-slate-600 font-medium space-y-3">
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-blue-500 font-black"></i>{" "}
                  Publish 10 Secure Exams
                </li>
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-blue-500 font-black"></i> Full
                  Anti-Cheat Proctoring
                </li>
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-blue-500 font-black"></i>{" "}
                  Access to all Analytics
                </li>
              </ul>
            </div>

            <button
              disabled={isProcessingPayment}
              onClick={() => handlePayment(49, 10, false, "Starter Pack")}
              className="w-full mt-auto py-4 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-black text-[15px] rounded-xl transition-colors disabled:opacity-50"
            >
              Select Starter
            </button>
          </div>

          <div className="bg-white border-2 border-[#185FA5] rounded-3xl p-8 flex flex-col relative transition-all duration-300 ease-out hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(24,95,165,0.15)] group cursor-pointer">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#185FA5] text-white text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
              Most Popular
            </div>
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-2xl mb-4 border border-blue-100">
              <i className="ti ti-flame"></i>
            </div>
            <div className="text-sm font-black text-blue-600 uppercase tracking-widest mb-2">
              Growth Pack
            </div>
            <div className="flex items-end gap-1 mb-2">
              <div className="text-5xl font-black text-[#185FA5] leading-none">
                ₹99
              </div>
              <div className="text-sm font-bold text-blue-400 mb-1">
                / One-time
              </div>
            </div>
            <p className="text-slate-500 text-sm font-medium mb-6 h-10">
              Best value for coaching centers and heavy test creators.
            </p>

            <div className="bg-blue-50/50 rounded-xl p-4 mb-6 border border-blue-100">
              <div className="text-lg font-black text-emerald-600 mb-3 flex items-center gap-2">
                <i className="ti ti-coins"></i> +30 Test Tokens
              </div>
              <ul className="text-sm text-slate-700 font-medium space-y-3">
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-[#185FA5] font-black"></i>{" "}
                  Publish 30 Secure Exams
                </li>
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-[#185FA5] font-black"></i>{" "}
                  Unlimited Student Joins
                </li>
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-[#185FA5] font-black"></i>{" "}
                  Never Expires
                </li>
              </ul>
            </div>

            <button
              disabled={isProcessingPayment}
              onClick={() => handlePayment(99, 30, false, "Growth Pack")}
              className="w-full mt-auto py-4 bg-[#185FA5] hover:bg-[#0A2E5C] text-white font-black text-[15px] rounded-xl shadow-lg shadow-blue-600/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Select Growth <i className="ti ti-arrow-right"></i>
            </button>
          </div>

          <div className="bg-gradient-to-b from-[#111827] to-[#020617] border-2 border-slate-800 rounded-3xl p-8 flex flex-col relative transition-all duration-300 ease-out hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(212,175,55,0.15)] hover:border-[#D4AF37] overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-[#D4AF37] text-2xl mb-4 border border-slate-700 group-hover:bg-[#D4AF37] group-hover:text-black transition-colors relative z-10">
              <i className="ti ti-infinity"></i>
            </div>
            <div className="text-sm font-black text-[#D4AF37] uppercase tracking-widest mb-2 relative z-10 flex items-center justify-between">
              <span>Unlimited VIP</span>
              <span className="bg-rose-500 text-white text-[9px] px-2 py-1 rounded-full animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.4)]">
                60% OFF - LAUNCH OFFER
              </span>
            </div>
            <div className="flex flex-col mb-2 relative z-10">
              <div className="text-lg font-bold text-slate-500 line-through mb-0.5">
                ₹499
              </div>
              <div className="flex items-end gap-1">
                <div className="text-5xl font-black text-white leading-none">
                  ₹199
                </div>
                <div className="text-sm font-bold text-slate-400 mb-1">
                  / Year
                </div>
              </div>
            </div>
            <p className="text-slate-400 text-sm font-medium mb-6 h-10 relative z-10">
              Freedom to create unrestricted tests for a whole year.
            </p>

            <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700 relative z-10">
              <div className="text-lg font-black text-[#D4AF37] mb-3 flex items-center gap-2">
                <i className="ti ti-calendar-star"></i> 365 Days Access
              </div>
              <ul className="text-sm text-slate-300 font-medium space-y-3">
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-[#D4AF37] font-black"></i>{" "}
                  Infinite Test Creation
                </li>
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-[#D4AF37] font-black"></i> Zero
                  Token Worries
                </li>
                <li className="flex items-center gap-2">
                  <i className="ti ti-check text-[#D4AF37] font-black"></i> Full
                  Platform Unlocked
                </li>
              </ul>
            </div>

            <button
              disabled={isProcessingPayment}
              onClick={() =>
                handlePayment(199, 0, true, "1 Year Unlimited PRO")
              }
              className="w-full mt-auto py-4 bg-slate-800 hover:bg-[#D4AF37] hover:text-black text-white font-black text-[15px] rounded-xl border border-slate-700 transition-colors disabled:opacity-50 relative z-10"
            >
              Go Unlimited
            </button>
          </div>
        </div>

        {/* PREMIUM COMPARISON TABLE */}
        <div className="mt-16 bg-white border border-slate-200 rounded-[32px] p-6 md:p-10 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#185FA5]/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="text-center mb-10 relative z-10">
            <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mb-3">
              Compare Plans & Limits
            </h3>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">
              See exactly what you get with each tier. Upgrade to remove the
              10-student limit and unlock unrestricted access.
            </p>
          </div>

          <div className="overflow-x-auto custom-scrollbar pb-4 relative z-10">
            <table className="w-full min-w-[800px] text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="p-5 font-extrabold text-slate-400 uppercase tracking-widest text-sm w-1/4">
                    Features
                  </th>
                  <th className="p-5 font-black text-slate-600 text-base text-center bg-slate-50 rounded-t-2xl border-x border-t border-slate-100">
                    Welcome (Free)
                  </th>
                  <th className="p-5 font-black text-blue-600 text-base text-center bg-blue-50/30 rounded-t-2xl border-x border-t border-blue-50">
                    Starter
                  </th>
                  <th className="p-5 font-black text-[#185FA5] text-base text-center bg-blue-50/50 rounded-t-2xl border-x border-t border-blue-100">
                    Growth
                  </th>
                  <th className="p-5 font-black text-[#D4AF37] text-base text-center bg-slate-900 rounded-t-2xl border-x border-t border-slate-800">
                    Unlimited VIP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[15px] font-bold text-slate-700">
                {/* Row 1: Tokens */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 flex items-center gap-2.5">
                    <i className="ti ti-coins text-xl text-slate-400"></i> Test
                    Tokens
                  </td>
                  <td className="p-5 text-center bg-slate-50 border-x border-slate-100">
                    3 Tokens
                  </td>
                  <td className="p-5 text-center bg-blue-50/30 text-blue-600 border-x border-blue-50">
                    10 Tokens
                  </td>
                  <td className="p-5 text-center bg-blue-50/50 text-[#185FA5] border-x border-blue-100">
                    30 Tokens
                  </td>
                  <td className="p-5 text-center bg-slate-900 text-[#D4AF37] border-x border-slate-800">
                    <i className="ti ti-infinity text-xl align-middle"></i>{" "}
                    Infinite
                  </td>
                </tr>

                {/* Row 2: Student Limit */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 flex items-center gap-2.5">
                    <i className="ti ti-users text-xl text-slate-400"></i>{" "}
                    Students per Exam
                  </td>
                  <td className="p-5 text-center bg-slate-50 border-x border-slate-100">
                    <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-rose-200">
                      Max 10
                    </span>
                  </td>
                  <td className="p-5 text-center bg-blue-50/30 text-emerald-600 border-x border-blue-50">
                    Unlimited
                  </td>
                  <td className="p-5 text-center bg-blue-50/50 text-emerald-600 border-x border-blue-100">
                    Unlimited
                  </td>
                  <td className="p-5 text-center bg-slate-900 text-emerald-400 border-x border-slate-800">
                    Unlimited
                  </td>
                </tr>

                {/* Row 3: Proctoring */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 flex items-center gap-2.5">
                    <i className="ti ti-shield-lock text-xl text-slate-400"></i>{" "}
                    Anti-Cheat AI
                  </td>
                  <td className="p-5 text-center bg-slate-50 border-x border-slate-100">
                    <i className="ti ti-check text-emerald-500 text-2xl align-middle"></i>
                  </td>
                  <td className="p-5 text-center bg-blue-50/30 border-x border-blue-50">
                    <i className="ti ti-check text-emerald-500 text-2xl align-middle"></i>
                  </td>
                  <td className="p-5 text-center bg-blue-50/50 border-x border-blue-100">
                    <i className="ti ti-check text-emerald-500 text-2xl align-middle"></i>
                  </td>
                  <td className="p-5 text-center bg-slate-900 border-x border-slate-800">
                    <i className="ti ti-check text-emerald-400 text-2xl align-middle"></i>
                  </td>
                </tr>

                {/* Row 4: Analytics */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 flex items-center gap-2.5">
                    <i className="ti ti-chart-pie text-xl text-slate-400"></i>{" "}
                    Advanced Analytics
                  </td>
                  <td className="p-5 text-center bg-slate-50 border-x border-slate-100">
                    <i className="ti ti-check text-emerald-500 text-2xl align-middle"></i>
                  </td>
                  <td className="p-5 text-center bg-blue-50/30 border-x border-blue-50">
                    <i className="ti ti-check text-emerald-500 text-2xl align-middle"></i>
                  </td>
                  <td className="p-5 text-center bg-blue-50/50 border-x border-blue-100">
                    <i className="ti ti-check text-emerald-500 text-2xl align-middle"></i>
                  </td>
                  <td className="p-5 text-center bg-slate-900 border-x border-slate-800">
                    <i className="ti ti-check text-emerald-400 text-2xl align-middle"></i>
                  </td>
                </tr>

                {/* Row 5: Validity */}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 flex items-center gap-2.5">
                    <i className="ti ti-calendar-star text-xl text-slate-400"></i>{" "}
                    Plan Validity
                  </td>
                  <td className="p-5 text-center bg-slate-50 rounded-b-2xl border-x border-b border-slate-100">
                    Lifetime
                  </td>
                  <td className="p-5 text-center bg-blue-50/30 rounded-b-2xl border-x border-b border-blue-50">
                    Lifetime
                  </td>
                  <td className="p-5 text-center bg-blue-50/50 rounded-b-2xl border-x border-b border-blue-100">
                    Lifetime
                  </td>
                  <td className="p-5 text-center bg-slate-900 text-white rounded-b-2xl border-x border-b border-slate-800">
                    365 Days
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 text-center border-t border-slate-200 pt-8 max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 mb-6 opacity-60 grayscale">
            <div className="flex items-center gap-2 font-black text-slate-800 text-lg">
              <i className="ti ti-shield-check text-2xl"></i> 256-bit Encryption
            </div>
            <div className="flex items-center gap-2 font-black text-slate-800 text-lg">
              <i className="ti ti-cloud-lock text-2xl"></i> Cloud Backups
            </div>
            <div className="flex items-center gap-2 font-black text-slate-800 text-lg">
              <i className="ti ti-headset text-2xl"></i> 24/7 Support
            </div>
          </div>
          <p className="text-sm font-bold text-slate-400 flex items-center justify-center gap-2">
            {isProcessingPayment ? (
              <>
                <i className="ti ti-loader animate-spin text-blue-500 text-lg"></i>{" "}
                Processing Secure Payment...
              </>
            ) : (
              <>
                <i className="ti ti-lock text-lg"></i> End-to-end encrypted by
                Razorpay
              </>
            )}
          </p>
        </div>
      </div>

      {/* Alert Modal */}
      {sysAlert && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-[99999] bg-slate-900/60 backdrop-blur-sm"
          onClick={(e) => {
            // Drag Prevention & Timeout Logic:
            // e.target === e.currentTarget check karta hai ki click sirf bahar (blank screen) hua hai, modal ke andar nahi
            if (canCloseModal && e.target === e.currentTarget) {
              if (sysAlert.action) sysAlert.action();
              setSysAlert(null);
            }
          }}
        >
          <div className="bg-white w-full max-w-md rounded-3xl p-8 text-center shadow-2xl animate-[popIn_0.3s_ease] border border-slate-100">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner ${sysAlert.type === "success" ? "bg-emerald-50 text-emerald-500 border border-emerald-100" : sysAlert.type === "error" ? "bg-rose-50 text-rose-500 border border-rose-100" : "bg-amber-50 text-amber-500 border border-amber-100"}`}
            >
              <i
                className={`ti ${sysAlert.type === "success" ? "ti-check" : sysAlert.type === "error" ? "ti-x" : "ti-alert-triangle"}`}
              ></i>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">
              {sysAlert.title}
            </h3>
            <p className="text-[15px] text-slate-500 mb-8 font-medium leading-relaxed">
              {sysAlert.msg}
            </p>

            {/* Modal Buttons (Receipt & Acknowledge) */}
            <div className="flex flex-col gap-3">
              {sysAlert.type === "success" && sysAlert.receiptData && (
                <button
                  className="w-full py-3.5 text-[#185FA5] font-black text-base rounded-xl border-2 border-[#185FA5] hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                  onClick={() => downloadReceipt(sysAlert.receiptData)}
                >
                  <i className="ti ti-file-download text-xl"></i> Download
                  Receipt
                </button>
              )}

              <button
                className={`w-full py-4 text-white font-black text-base rounded-xl transition-transform active:scale-95 shadow-md ${sysAlert.type === "success" ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" : sysAlert.type === "error" ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20" : "bg-[#185FA5] hover:bg-blue-700 shadow-blue-600/20"}`}
                onClick={() => {
                  if (sysAlert.action) sysAlert.action();
                  setSysAlert(null);
                }}
              >
                {sysAlert.type === "success"
                  ? "Continue to Vault"
                  : "Acknowledge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
