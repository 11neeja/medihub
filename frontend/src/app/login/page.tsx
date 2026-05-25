'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Mail, Lock, ArrowRight, ArrowLeft, AlertCircle, ServerCrash } from 'lucide-react';

const LOGIN_HERO_IMAGE =
  'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=1200&h=1600&fit=crop&q=80';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, backendConnected, dbConnected } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push('/home');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-stretch bg-[var(--color-bg-ivory)] overflow-hidden">
      {/* ── Form side — LEFT ────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col px-6 sm:px-10 lg:px-16 py-8 lg:py-10 relative slide-in-left">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-blue-primary)] transition-smooth w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            {(!backendConnected || !dbConnected) && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3">
                <ServerCrash className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 font-semibold text-sm">Backend Not Connected</p>
                  <p className="text-red-600 text-xs mt-1 leading-relaxed">
                    {!backendConnected
                      ? 'Cannot reach the backend server. Please start it with: cd backend && npm run dev'
                      : 'Database is not connected. Check your database configuration.'}
                  </p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="mb-8">
              <p className="label mb-3">Welcome back</p>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[var(--color-navy)] mb-3">
                Sign in to MediHub
              </h1>
              <p className="body-md">
                Pick up right where you left off — your notes, conversations, and study materials are waiting.
              </p>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block label mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
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
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input w-full pl-11 pr-4"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !backendConnected || !dbConnected}
                className="btn-primary !rounded-lg w-full py-4 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-[var(--color-border-light)] text-center">
              <p className="body-md">
                New to MediHub?{' '}
                <Link
                  href="/signup"
                  className="text-[var(--color-blue-primary)] font-semibold hover:text-[var(--color-navy-hover)] transition-smooth"
                >
                  Create an account →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Image side — RIGHT ──────────────────────────────── */}
      <div className="hidden lg:block lg:w-1/2 relative slide-in-right overflow-hidden">
        <div className="absolute inset-0 zoom-reveal">
          <img
            src={LOGIN_HERO_IMAGE}
            alt="A medical professional starting their day"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Gradient overlay for brand color */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(11,25,77,0.85) 0%, rgba(11,59,145,0.55) 50%, rgba(11,25,77,0.85) 100%)',
          }}
        />

        {/* Decorative floating orbs */}
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-40"
          style={{ background: 'radial-gradient(circle, #BFD7FF 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 w-80 h-80 rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, #7BA3E8 0%, transparent 70%)' }}
        />

        {/* Content overlay */}
        <div className="relative z-10 h-full flex flex-col justify-between p-10 lg:p-14 text-white">
          <div className="fade-in-delay-1">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-white/80">MediHub</p>
          </div>

          <div className="fade-in-delay-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-4">
              Today on MediHub
            </p>
            <blockquote className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight mb-6">
              &ldquo;One calm space for our updates, discussions, and study resources — without switching between apps.&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center font-bold text-sm">
                MH
              </div>
              <div>
                <p className="text-sm font-semibold">MediHub Community Member</p>
                <p className="text-xs text-white/60">Resident Physician</p>
              </div>
            </div>
          </div>

          <div className="fade-in-delay-3 flex items-center gap-6 text-xs text-white/70">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>3.5K+ active members</span>
            </div>
            <div>24/7 AI assistance</div>
          </div>
        </div>
      </div>
    </div>
  );
}
