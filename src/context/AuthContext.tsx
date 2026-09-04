import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SafeMerchant } from '../types';
import { authService } from '../services/auth.service';

export interface AuthContextType {
  merchant: SafeMerchant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, storeName?: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [merchant, setMerchant] = useState<SafeMerchant | null>(null);
  const [token, setToken] = useState<string | null>(() => authService.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async () => {
    const currentToken = authService.getToken();
    if (!currentToken) {
      setMerchant(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await authService.getMe(currentToken);
      setMerchant(data);
      setToken(currentToken);
    } catch (err) {
      console.warn('Invalid or expired merchant session token, clearing auth state', err);
      authService.removeToken();
      setMerchant(null);
      setToken(null);
      try {
        localStorage.removeItem('opticommerce_merchant_id');
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string): Promise<void> => {
    const result = await authService.login(email, password);
    setMerchant(result.merchant);
    setToken(result.token);
  };

  const register = async (name: string, email: string, password: string, storeName?: string): Promise<void> => {
    const result = await authService.register(name, email, password, storeName);
    setMerchant(result.merchant);
    setToken(result.token);
  };

  const logout = (): void => {
    authService.logout();
    setMerchant(null);
    setToken(null);
    try {
      localStorage.removeItem('opticommerce_merchant_id');
    } catch {
      // ignore
    }
  };

  const value: AuthContextType = {
    merchant,
    token,
    isAuthenticated: !!merchant && !!token,
    isLoading,
    login,
    register,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
