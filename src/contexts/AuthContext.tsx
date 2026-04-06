import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { initOneSignal, logoutOneSignal } from '../services/onesignal';

export interface LoginHistoryEntry {
  id: string;
  email: string;
  timestamp: number;
  device: string;
  browser: string;
  os?: string;
  location: string;
  ipAddress: string;
  status: 'success' | 'failed';
  failureReason?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loginHistory: LoginHistoryEntry[];
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  signup: (name: string, email: string, password: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  setError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser]               = useState<User | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // ── Init OneSignal whenever a user is set
  useEffect(() => {
    if (user?.id) {
      initOneSignal(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    const initAuth = async () => {
      const token     = localStorage.getItem('taskly_token');
      const savedUser = localStorage.getItem('taskly_user');

      if (token && savedUser) {
        try {
          await api.auth.verify(token);
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          await loadHistory();
        } catch {
          localStorage.removeItem('taskly_token');
          localStorage.removeItem('taskly_user');
        }
      }
    };

    initAuth();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.history.getHistory(50, 1);

      if (res.success && res.data?.history) {
        const formattedHistory = res.data.history.map((entry: any) => ({
          id:            entry.id,
          email:         entry.email,
          timestamp:     new Date(entry.timestamp).getTime(),
          device:        entry.device,
          browser:       entry.browser,
          os:            entry.os || 'Unknown',
          location:      entry.location,
          ipAddress:     entry.ipAddress,
          status:        entry.status,
          failureReason: entry.failureReason,
        }));
        setLoginHistory(formattedHistory);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const login = async (email: string, password: string, _rememberMe = false) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.auth.login(email, password);

      if (res.success && res.data) {
        const { user: userData, token } = res.data;

        const newUser: User = {
          id:     userData.id,
          email:  userData.email,
          name:   userData.name,
          avatar: userData.avatar,
        };

        setUser(newUser); // ← triggers useEffect → initOneSignal(newUser.id)
        localStorage.setItem('taskly_token', token);
        localStorage.setItem('taskly_user', JSON.stringify(newUser));
        await loadHistory();
      } else {
        throw new Error(res.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.auth.signup(name, email, password);

      if (res.success && res.data) {
        const { user: userData, token } = res.data;

        const newUser: User = {
          id:     userData.id,
          email:  userData.email,
          name:   userData.name,
          avatar: userData.avatar,
        };

        setUser(newUser); // ← triggers useEffect → initOneSignal(newUser.id)
        localStorage.setItem('taskly_token', token);
        localStorage.setItem('taskly_user', JSON.stringify(newUser));
        await loadHistory();
      } else {
        throw new Error(res.message || 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (token: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.auth.verify(token);

      if (res.success && res.data?.user) {
        const userData = res.data.user;

        const newUser: User = {
          id:     userData.id,
          email:  userData.email,
          name:   userData.name,
          avatar: userData.avatar,
        };

        setUser(newUser); // ← triggers useEffect → initOneSignal(newUser.id)
        localStorage.setItem('taskly_token', token);
        localStorage.setItem('taskly_user', JSON.stringify(newUser));
        await loadHistory();
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    logoutOneSignal(); // ← unlink OneSignal on logout
    setUser(null);
    setLoginHistory([]);
    localStorage.removeItem('taskly_token');
    localStorage.removeItem('taskly_user');
  };

  const clearHistory = async () => {
    await api.history.clearHistory();
    setLoginHistory([]);
  };

  const refreshHistory = async () => {
    await loadHistory();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginHistory,
        loading,
        error,
        login,
        logout,
        signup,
        googleLogin,
        clearHistory,
        refreshHistory,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};