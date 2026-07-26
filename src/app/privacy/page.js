import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-6">Privacy Policy</h1>
        <p className="text-slate-500 font-semibold mb-8">Last updated: {new Date().toLocaleDateString('en-IN')}</p>

        <div className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Information We Collect</h2>
            <p>At ExamiTop, we collect minimal data required to provide our secure assessment services. This includes:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li><strong>Personal Information:</strong> Name, email address, and role (Student/Examiner) provided during Google Authentication.</li>
              <li><strong>Assessment Data:</strong> Questions created by examiners, exam configurations, and student submissions/scores.</li>
              <li><strong>Proctoring Data:</strong> System logs tracking tab-switches and browser focus events to ensure exam integrity. We <strong>do not</strong> record video, audio, or screen captures.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. How We Use Your Information</h2>
            <p>We use the collected information solely for platform functionality:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>To authenticate users and manage access to exam vaults.</li>
              <li>To evaluate exams and generate performance analytics.</li>
              <li>To process secure payments via our payment gateway partner (Razorpay).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Data Sharing & Security</h2>
            <p>Your data is stored securely using Google Firebase databases with strict security rules. We <strong>never</strong> sell your personal data to third parties. Data is only shared with trusted partners (like Razorpay) strictly for payment processing.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy or your data, please contact the platform administrator or support team.</p>
          </section>
        </div>
      </div>
    </div>
  );
}