import React from 'react';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 sm:px-6 lg:px-8 animate-[fadeIn_0.4s_ease]">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-6">Terms & Conditions</h1>
        <p className="text-slate-500 font-semibold mb-8">Last updated: {new Date().toLocaleDateString('en-IN')}</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using ExamiTop, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. User Responsibilities</h2>
            <p>As an Examiner or Student on this platform, you agree to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Provide accurate information during registration.</li>
              <li>Maintain the confidentiality of your account credentials.</li>
              <li>Not use the platform for any illegal activities or to distribute malicious software.</li>
              <li>Ensure you have the right to distribute any content (questions, images) uploaded to the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Payments and Subscriptions</h2>
            <p>ExamiTop offers premium features via token-based and subscription-based plans. All payments are processed securely through our trusted payment gateway partner (Razorpay). By purchasing a plan, you agree to the pricing and billing terms presented at the time of purchase.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Account Termination</h2>
            <p>We reserve the right to suspend or terminate your account at our sole discretion, without prior notice, for conduct that we believe violates these Terms & Conditions or is harmful to other users of the platform.</p>
          </section>
        </div>
      </div>
    </div>
  );
}