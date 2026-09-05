import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SafeCustomer, CustomerAuthResult } from '../types';
import { customerAuthService } from '../services/customer-auth.service';

export interface CustomerAuthContextType {
  customer: SafeCustomer | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, storeId: string) => Promise<CustomerAuthResult>;
  register: (email: string, password: string, storeId: string, name?: string) => Promise<CustomerAuthResult>;
  logout: () => void;
  refreshCustomer: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export const CustomerAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<SafeCustomer | null>(null);
  const [token, setToken] = useState<string | null>(() => customerAuthService.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshCustomer = useCallback(async () => {
    const currentToken = customerAuthService.getToken();
    if (!currentToken) {
      setCustomer(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await customerAuthService.getMe(currentToken);
      setCustomer(data);
      setToken(currentToken);
    } catch (err) {
      console.warn('Invalid or expired customer session token, clearing customer auth state', err);
      customerAuthService.removeToken();
      setCustomer(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCustomer();
  }, [refreshCustomer]);

  const login = async (email: string, password: string, storeId: string): Promise<CustomerAuthResult> => {
    const result = await customerAuthService.login(email, password, storeId);
    setCustomer(result.customer);
    setToken(result.token);
    return result;
  };

  const register = async (
    email: string,
    password: string,
    storeId: string,
    name?: string
  ): Promise<CustomerAuthResult> => {
    const result = await customerAuthService.register(email, password, storeId, name);
    setCustomer(result.customer);
    setToken(result.token);
    return result;
  };

  const logout = (): void => {
    customerAuthService.logout();
    setCustomer(null);
    setToken(null);
  };

  const value: CustomerAuthContextType = {
    customer,
    token,
    isAuthenticated: !!customer && !!token,
    isLoading,
    login,
    register,
    logout,
    refreshCustomer,
  };

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
};

export const useCustomerAuth = (): CustomerAuthContextType => {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
};
