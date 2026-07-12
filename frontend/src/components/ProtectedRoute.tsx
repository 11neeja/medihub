'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/signup'];
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    // If not authenticated and trying to access protected route, but only after auth has finished hydrating.
    if (!loading && !isAuthenticated && !isPublicRoute) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, pathname, router, isPublicRoute]);

  // On public routes, no backend check needed (landing page)
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // While auth is hydrating, keep protected pages blank to avoid false redirects.
  if (loading) {
    return null;
  }

  // If not authenticated and on protected route, show nothing (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return <div className="app-shell min-h-screen">{children}</div>;
}
