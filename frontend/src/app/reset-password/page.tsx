'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { resetPasswordAPI } from '@/lib/api';

const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordIsStrong = useMemo(() => strongPassword.test(password), [password]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setToken(searchParams.get('token') || '');
    setEmail(searchParams.get('email') || '');
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token || !email) {
      setError('This reset link is missing required information. Please request a new one.');
      return;
    }

    if (!strongPassword.test(password)) {
      setError('Use a strong password with 8+ characters, uppercase, lowercase, number, and special character');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordAPI(email, token, password);
      setSuccess(res.message || 'Password updated successfully. Redirecting to login...');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-ivory)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-white rounded-[28px] border border-[var(--color-border-light)] shadow-[0_24px_80px_rgba(11,25,77,0.08)] p-8">
        <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-blue-primary)] transition-smooth mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to login
        </Link>

        <p className="label mb-3">Reset password</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-navy)] mb-3">Choose a new password</h1>
        <p className="body-md mb-6">This link works for {email || 'your account'} and expires after one hour.</p>

        {error && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-emerald-700 text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="block label mb-2">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                className="input w-full pl-11 pr-4"
                required
                minLength={8}
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block label mb-2">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                className="input w-full pl-11 pr-4"
                required
                minLength={8}
              />
            </div>
          </div>

          <div className={`rounded-xl border p-4 text-sm ${passwordIsStrong ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[var(--color-border-light)] bg-white text-[var(--color-text-secondary)]'}`}>
            <div className="flex items-center gap-2 font-semibold text-[var(--color-navy)] mb-2">
              <ShieldCheck className="w-4 h-4 text-[var(--color-blue-primary)]" />
              Password policy
            </div>
            <p>8+ characters, uppercase, lowercase, number, and special character.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary !rounded-lg w-full py-4 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Updating password…
              </>
            ) : (
              <>
                Reset password
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}