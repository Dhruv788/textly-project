import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

// Types
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
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  clearHistory: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage and verify token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('taskly_token');
      const savedUser = localStorage.getItem('taskly_user');

      if (token && savedUser) {
        try {
          // Verify token is still valid
          const response = await api.auth.verify(token);
          setUser(JSON.parse(savedUser));
          
          // Load login history
          await loadHistory();
        } catch (error) {
          // Token invalid, clear storage
          console.error('Token verification failed:', error);
          localStorage.removeItem('taskly_token');
          localStorage.removeItem('taskly_user');
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // Load login history from backend
  const loadHistory = async () => {
    try {
      const response = await api.history.getHistory(50, 1);
      
      if (response.success && response.data.history) {
        // Convert timestamp strings to numbers and format data
        const formattedHistory = response.data.history.map((entry: any) => ({
          id: entry.id,
          email: entry.email,
          timestamp: new Date(entry.timestamp).getTime(),
          device: entry.device,
          browser: entry.browser,
          os: entry.os || 'Unknown',
          location: entry.location,
          ipAddress: entry.ipAddress,
          status: entry.status,
          failureReason: entry.failureReason,
        }));

        setLoginHistory(formattedHistory);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean = false): Promise<boolean> => {
    try {
      // Call backend API
      const response = await api.auth.login(email, password);

      if (response.success && response.data) {
        const { user: userData, token } = response.data;

        // Create user object
        const newUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          avatar: userData.avatar,
        };

        setUser(newUser);

        // Store token
        localStorage.setItem('taskly_token', token);

        if (rememberMe) {
          localStorage.setItem('taskly_user', JSON.stringify(newUser));
        }

        // Load login history
        await loadHistory();

        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      // Call backend API
      const response = await api.auth.signup(name, email, password);

      if (response.success && response.data) {
        const { user: userData, token } = response.data;

        // Create user object
        const newUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          avatar: userData.avatar,
        };

        setUser(newUser);

        // Store token and user
        localStorage.setItem('taskly_token', token);
        localStorage.setItem('taskly_user', JSON.stringify(newUser));

        // Load login history
        await loadHistory();

        return true;
      }

      return false;
    } catch (error: any) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setLoginHistory([]);
    localStorage.removeItem('taskly_token');
    localStorage.removeItem('taskly_user');
  };

  const clearHistory = async () => {
    try {
      await api.history.clearHistory();
      setLoginHistory([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  };

  const refreshHistory = async () => {
    await loadHistory();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loginHistory, 
      loading,
      login, 
      logout, 
      signup, 
      clearHistory,
      refreshHistory
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};