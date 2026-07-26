import React from 'react';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 sm:px-6 lg:px-8 animate-[fadeIn_0.4s_ease]">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-6">Refund & Cancellation Policy</h1>
        <p className="text-slate-500 font-semibold mb-8">Last updated: {new Date().toLocaleDateString('en-IN')}</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Digital Goods Concept</h2>
            <p>ExamiTop provides digital services in the form of Assessment Tokens and Annual Subscriptions. Due to the immediate availability and digital nature of these services, all sales are considered final.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Refund Eligibility</h2>
            <p>Refunds will <strong>only</strong> be considered under the following exceptional circumstances:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>Duplicate payments due to a technical error.</li>
              <li>Failure of the system to credit tokens to your account after a successful transaction (if reported within 48 hours).</li>
            </ul>
            <p className="mt-3">We do not offer refunds for "change of mind" or unused tokens. Once tokens are purchased, they cannot be exchanged for cash.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Cancellations</h2>
            <p>If you have purchased an Unlimited Annual Subscription, you may cancel it at any time. However, cancellation does not initiate a refund. You will continue to have unlimited access to the platform until the end of your current billing cycle.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. How to Request a Refund</h2>
            <p>If you believe you are eligible for a refund due to a technical error, please contact our support team immediately with your Razorpay Transaction ID and account details. Approved refunds will be processed within 5-7 business days to the original method of payment.</p>
          </section>
        </div>
      </div>
    </div>
  );
}