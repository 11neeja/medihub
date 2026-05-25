'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ServerCrash, RefreshCw } from 'lucide-react';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, backendConnected, dbConnected } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup'];
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    // If not authenticated and trying to access protected route
    if (!isAuthenticated && !isPublicRoute) {
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router, isPublicRoute]);

  // On public routes, no backend check needed (landing page)
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Backend not connected - show error screen for protected routes
  if (!backendConnected || !dbConnected) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center px-4">
        <div className="bg-[var(--color-surface-white)] rounded-[24px] p-10 max-w-md w-full text-center" style={{ boxShadow: 'var(--shadow-modal)' }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(254,242,242,0.6)' }}>
            <ServerCrash className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
            {!backendConnected ? 'Server Not Connected' : 'Database Not Connected'}
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
            {!backendConnected
              ? 'The MediHub backend server is not running. All features require a working backend connection.'
              : 'The database is not connected. Please check your database configuration.'}
          </p>
          <div className="bg-[var(--color-surface-muted)] rounded-[12px] p-4 mb-6 text-left">
            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">To start the backend:</p>
            <code className="text-sm text-[var(--color-blue-primary)] bg-[var(--color-accent-soft)] px-3 py-1.5 rounded-lg block">
              cd backend && npm run dev
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 btn-primary"
            style={{ padding: '12px 24px' }}
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated and on protected route, show nothing (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return <div className="app-shell min-h-screen">{children}</div>;
}
