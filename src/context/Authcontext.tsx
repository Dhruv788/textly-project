import React, { createContext, useState, useContext, useCallback, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginHistory: any[];
  formattedHistory: any[];
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [formattedHistory, setFormattedHistory] = useState<any[]>([]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await api.auth.login(email, password);
      
      if (response.success && response.data) {
        localStorage.setItem('taskly_token', response.data.token);
        localStorage.setItem('taskly_user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        return { success: true };
      }
      
      return { success: false, message: response.message || 'Login failed' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Login failed' };
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('taskly_token');
    const userData = localStorage.getItem('taskly_user');

    if (!token || !userData) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Verify token
      await api.auth.verify(token);

      // Get login history
      const response = await api.history.getHistory(50, 1);

      if (response.success && response.data?.history) {
        setLoginHistory(response.data.history);
        const formattedHistory = response.data?.history.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp).toLocaleString()
        }));
        setFormattedHistory(formattedHistory);
      }

      setUser(JSON.parse(userData));
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    try {
      const response = await api.auth.signup(name, email, password);
      
      if (response.success && response.data) {
        localStorage.setItem('taskly_token', response.data.token);
        localStorage.setItem('taskly_user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        return { success: true };
      }
      
      return { success: false, message: response.message || 'Signup failed' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Signup failed' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('taskly_token');
    localStorage.removeItem('taskly_user');
    setUser(null);
    setLoginHistory([]);
    setFormattedHistory([]);
  }, []);

  /*const googleLogin = useCallback(async (credential: string) => {
    try {
      const response = await api.auth.googleLogin(credential);
      
      if (response.success && response.data) {
        localStorage.setItem('taskly_token', response.data.token);
        localStorage.setItem('taskly_user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        return { success: true };
      }
      
      return { success: false, message: response.message || 'Google login failed' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Google login failed' };
    }
  }, []);*/

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      loginHistory, 
      formattedHistory, 
      login, 
      signup, 
      logout, 
      /*googleLogin*/
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};