'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AdminGate() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    // Validate password (in a real app, this would be an API call)
    // For this demo, we check against an env variable or default back door
    const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'zeroerror_admin';
    
    if (password === adminPass) {
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPassword('');
    }
  };

  if (authenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-stone-900 text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Admin Control Center</h1>
              <p className="text-sm text-stone-500">System status and analytics access</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-stone-200 p-6 bg-stone-50">
              <h2 className="text-lg font-semibold text-stone-900 mb-2">Analytics Dashboard</h2>
              <p className="text-sm text-stone-600 mb-6">
                Access the Cognitive Adaptive Framework command center. View conversion uplift, risk scoring, and intervention tracking.
              </p>
              <a 
                href="http://localhost:3002" 
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 w-full cursor-pointer"
              >
                Open Dashboard ↗
              </a>
            </div>

            <div className="rounded-xl border border-stone-200 p-6 bg-stone-50">
              <h2 className="text-lg font-semibold text-stone-900 mb-2">System Status</h2>
              <ul className="space-y-3 mt-4 text-sm text-stone-600">
                <li className="flex justify-between items-center">
                  <span>Analytics API</span>
                  <span className="flex items-center gap-1.5 font-medium text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span> Online
                  </span>
                </li>
                <li className="flex justify-between items-center border-t border-stone-200 pt-3">
                  <span>Storefront Tracker</span>
                  <span className="flex items-center gap-1.5 font-medium text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span> Active
                  </span>
                </li>
                <li className="flex justify-between items-center border-t border-stone-200 pt-3">
                  <span>PostgreSQL DB</span>
                  <span className="flex items-center gap-1.5 font-medium text-green-700">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span> Connected
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12 bg-stone-50">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="h-12 w-12 flex items-center justify-center rounded-full bg-stone-100 text-stone-600 mb-4">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
             </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Admin Access</h1>
          <p className="mt-2 text-sm text-stone-500">
            Enter the master password to access system controls.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="sr-only">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-xl border ${error ? 'border-red-300 ring-1 ring-red-300 bg-red-50' : 'border-stone-200 bg-stone-50'} px-4 py-3 text-sm focus:border-stone-500 focus:outline-none`}
              placeholder="••••••••"
            />
            {error && <p className="text-xs text-red-500 mt-2">Incorrect password.</p>}
          </div>
          
          <button
            type="submit"
            className="btn-press w-full rounded-xl bg-stone-900 py-3.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Authenticate
          </button>
        </form>
        <div className="mt-6 text-center">
           <Link href="/" className="text-xs font-semibold text-stone-500 hover:text-stone-900 underline underline-offset-2">
             Return to Store
           </Link>
        </div>
      </div>
    </div>
  );
}
