'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Heart, User, Mail, Lock, ArrowRight, ArrowLeft, AlertCircle, ServerCrash } from 'lucide-react';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signup, backendConnected, dbConnected } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(name, email, password);
      router.push('/home');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--gradient-bg)' }}>
      <div
        className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-60 pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--color-accent-hover) 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full opacity-50 pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%)' }}
      />

      <Link
        href="/"
        className="absolute top-6 left-6 z-20 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-blue-primary)] transition-smooth"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to home
      </Link>

      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-screen px-4 py-12 relative z-10">
        {(!backendConnected || !dbConnected) && (
          <div className="mb-4 w-full bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 fade-in-up">
            <ServerCrash className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-medium text-sm">Backend Not Connected</p>
              <p className="text-red-600 text-xs mt-1">
                {!backendConnected
                  ? 'Cannot reach the backend server. Please start it with: cd backend && npm run dev'
                  : 'Database is not connected. Check your database configuration.'}
              </p>
            </div>
          </div>
        )}

        <div className="auth-card fade-in-up">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-btn)' }}
            >
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="heading-2 mb-2">Create Account</h1>
            <p className="body-sm">Join MediHub and start your medical journey</p>
          </div>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block label mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="input w-full pl-11 pr-4"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block label mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="input w-full pl-11 pr-4"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block label mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password (min 6 chars)"
                  className="input w-full pl-11 pr-4"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !backendConnected || !dbConnected}
              className="btn-primary w-full py-4 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-[var(--color-border-light)]" />
            <span className="px-4 text-sm text-[var(--color-text-muted)]">or continue with</span>
            <div className="flex-1 border-t border-[var(--color-border-light)]" />
          </div>

          <div className="text-center">
            <p className="body-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-[var(--color-blue-primary)] font-semibold hover:text-[var(--color-navy-hover)] transition-smooth">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
