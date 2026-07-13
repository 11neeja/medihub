'use client';

import { useState, InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>;

/**
 * Password field with the standard lock icon and a show/hide toggle.
 * Accepts all regular <input> props (id, value, onChange, placeholder, …).
 */
export default function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
      <input {...props} type={visible ? 'text' : 'password'} className="input w-full pl-11 pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-navy)] transition-colors"
      >
        {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );
}
