import React from "react";
import Link from "next/link";

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 sm:px-6 lg:px-8 animate-[fadeIn_0.4s_ease]">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-3xl shadow-inner border border-blue-100">
            <i className="ti ti-headset"></i>
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 m-0">
              Contact Us
            </h1>
            <p className="text-slate-500 font-semibold mt-1">
              We're here to help you.
            </p>
          </div>
        </div>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <p className="text-lg font-medium text-slate-600 mb-6">
              Have questions about your account, exams, or payments? Reach out
              to our support team using the details below. To ensure all queries
              are tracked and resolved efficiently, we currently offer{" "}
              <strong>email-only support</strong>. We typically respond within
              24 hours.
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-start gap-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 text-2xl shrink-0">
                <i className="ti ti-mail"></i>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                  Email Support
                </h3>
                {/* YAHAN APNA NAYA GMAIL DAAL DENA */}
                <a
                  href="mailto:support.examitop@gmail.com"
                  className="text-lg font-black text-slate-800 hover:text-blue-600 transition-colors"
                >
                  support.examitop@gmail.com
                </a>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-start gap-4">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 text-2xl shrink-0">
                <i className="ti ti-clock"></i>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-1">
                  Working Hours
                </h3>
                <div className="text-lg font-black text-slate-800">
                  Mon - Fri, 10 AM - 6 PM
                </div>
              </div>
            </div>
          </div>

          <section className="mt-8 pt-8 border-t border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-3">
              Registered Address
            </h2>
            <p className="text-slate-600 font-medium">
              <strong>ExamiTop</strong>
              <br />
              {/* Apna Mainpuri ka Pincode daal dena */}
              Mainpuri, Uttar Pradesh
              <br />
              India - 205001
            </p>
            <p className="text-xs text-slate-400 mt-4">
              * Please note that we operate entirely online and do not offer
              walk-in support at this location.
            </p>
          </section>

          <div className="pt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
            >
              <i className="ti ti-arrow-left text-lg"></i> Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
