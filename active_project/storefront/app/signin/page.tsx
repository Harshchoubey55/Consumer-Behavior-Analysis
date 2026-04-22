'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from 'components/auth/AuthProvider';
import { tracker } from 'lib/tracking/tracker';

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Strict Sanitization Checks
    if (mode === 'signup' && !/^[a-zA-Z\s]{2,50}$/.test(name)) {
      setError('Name must contain only letters and spaces (2-50 chars).');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    let success = false;
    if (mode === 'signup') {
      success = signUp(name, email, password);
      if (!success) setError('Account already exists with this email.');
    } else {
      success = signIn(email, password);
      if (!success) setError('Invalid email or password.');
    }

    if (success) {
      const userId = JSON.parse(localStorage.getItem('_ze_user') || '{}')?.userId;
      if (userId) {
        tracker.setUserId(userId);
      }
      setRedirecting(true);
      setTimeout(() => router.back(), 800);
    }
  };

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-xl overflow-hidden">
        
        {/* Tabs */}
        <div className="flex border-b border-stone-200">
          <button
            onClick={() => { setMode('signin'); setError(''); }}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${mode === 'signin' ? 'border-b-2 border-stone-900 text-stone-900 bg-stone-50' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-4 text-sm font-semibold transition-colors ${mode === 'signup' ? 'border-b-2 border-stone-900 text-stone-900 bg-stone-50' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Create Account
          </button>
        </div>

        <div className="p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              {mode === 'signin' ? 'Welcome Back' : 'Join ZeroError'}
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Securely authenticate to access your custom profile.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-600 font-medium text-center border border-red-100">
              {error}
            </div>
          )}

          {redirecting ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-stone-900"></div>
              <p className="mt-4 text-sm font-medium text-stone-600">Authenticating securely...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-stone-700">Full Name</label>
                  <input
                    type="text"
                    required
                    maxLength={50}
                    pattern="[A-Za-z\s]{2,50}"
                    title="Letters and spaces only."
                    value={name}
                    onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                    placeholder="Jane Doe"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Email Address</label>
                <input
                  type="email"
                  required
                  maxLength={100}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  maxLength={100}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-500"
                  placeholder="••••••••"
                />
              </div>
              
              <button
                type="submit"
                className="btn-press mt-6 w-full rounded-xl bg-stone-900 py-3.5 text-sm font-semibold text-white hover:bg-stone-800 transition-colors cursor-pointer"
              >
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
