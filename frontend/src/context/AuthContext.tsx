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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (name: string, email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const REMEMBER_ME_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_KEY = 'token';
const TOKEN_EXPIRY_KEY = 'token_expires_at';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [backendConnected, setBackendConnected] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getStoredToken = () => {
    if (typeof window === 'undefined') return null;

    const persistentToken = localStorage.getItem(TOKEN_KEY);
    if (persistentToken) {
      const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
      if (expiresAt && Date.now() > expiresAt) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        return null;
      }

      return persistentToken;
    }

    return sessionStorage.getItem(TOKEN_KEY);
  };

  const storeToken = (token: string, rememberMe: boolean) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + REMEMBER_ME_DURATION_MS));
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, token);
  };

  const clearStoredToken = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  };

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
        const token = getStoredToken();
        if (token) {
          try {
            const userData = await getMeAPI();
            setUser(userData);
            setIsAuthenticated(true);
          } catch {
            // Token invalid/expired
            clearStoredToken();
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

  const login = async (email: string, password: string, rememberMe = false) => {
    setError(null);
    try {
      const healthy = await checkHealth();
      if (!healthy) {
        throw new Error('Backend server or database is not connected. Please start the backend server first.');
      }
      const data = await loginAPI(email, password, rememberMe);
      storeToken(data.token, rememberMe);
      setUser({ _id: data._id, name: data.name, email: data.email });
      setIsAuthenticated(true);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const signup = async (name: string, email: string, password: string, rememberMe = false) => {
    setError(null);
    try {
      const healthy = await checkHealth();
      if (!healthy) {
        throw new Error('Backend server or database is not connected. Please start the backend server first.');
      }
      const data = await registerAPI(name, email, password, rememberMe);
      storeToken(data.token, rememberMe);
      setUser({ _id: data._id, name: data.name, email: data.email });
      setIsAuthenticated(true);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = () => {
    clearStoredToken();
    setIsAuthenticated(false);
    setUser(null);
  };

  const clearError = () => setError(null);

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
