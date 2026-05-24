'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { loginAPI, registerAPI, getMeAPI, checkBackendHealth } from '@/lib/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  backendConnected: boolean;
  dbConnected: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check backend health
  const checkHealth = useCallback(async () => {
    try {
      const health = await checkBackendHealth();
      setBackendConnected(health.server === true);
      setDbConnected(health.database === 'connected');
      return health.status === 'ok';
    } catch {
      setBackendConnected(false);
      setDbConnected(false);
      return false;
    }
  }, []);

  // On mount: check backend health + restore session from token
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const healthy = await checkHealth();

      if (healthy) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const userData = await getMeAPI();
            setUser(userData);
            setIsAuthenticated(true);
          } catch {
            // Token invalid/expired
            localStorage.removeItem('token');
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      }
      setLoading(false);
    };

    init();

    // Periodically check backend health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const healthy = await checkHealth();
      if (!healthy) {
        throw new Error('Backend server or database is not connected. Please start the backend server first.');
      }
      const data = await loginAPI(email, password);
      localStorage.setItem('token', data.token);
      setUser({ _id: data._id, name: data.name, email: data.email });
      setIsAuthenticated(true);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setError(null);
    try {
      const healthy = await checkHealth();
      if (!healthy) {
        throw new Error('Backend server or database is not connected. Please start the backend server first.');
      }
      const data = await registerAPI(name, email, password);
      localStorage.setItem('token', data.token);
      setUser({ _id: data._id, name: data.name, email: data.email });
      setIsAuthenticated(true);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUser(null);
  };

  const clearError = () => setError(null);

  // Show nothing while checking initial auth status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-ivory)]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--color-blue-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Connecting to MediHub...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        backendConnected,
        dbConnected,
        loading,
        error,
        login,
        signup,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
