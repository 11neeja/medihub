'use client';

import { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button when opened & handle Escape key
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const Icon = variant === 'danger' ? Trash2 : AlertTriangle;
  const iconBg = variant === 'danger' ? 'bg-red-50' : 'bg-amber-50';
  const iconColor = variant === 'danger' ? 'text-red-500' : 'text-amber-500';
  const confirmBg = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600'
    : 'bg-amber-500 hover:bg-amber-600';

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] animate-section"
      onClick={onCancel}
    >
      <div
        className="relative bg-[var(--color-surface-white)] rounded-3xl p-6 max-w-sm w-full mx-4"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon + Text */}
        <div className="text-center mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`} style={{ background: variant === 'danger' ? 'rgba(254, 242, 242, 0.6)' : 'rgba(255, 249, 230, 0.6)' }}>
            <Icon className={`w-8 h-8 ${variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{title}</h2>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 btn-primary"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
