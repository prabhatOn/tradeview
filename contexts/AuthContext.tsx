'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthTokens } from '@/lib/types';
import { authService } from '@/lib/services';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const normalizeUser = (user: User): User => {
  const rawRolesSource = user.roles as unknown;
  const rawRoles: string[] = Array.isArray(rawRolesSource)
    ? rawRolesSource.map((role) => String(role))
    : typeof rawRolesSource === 'string' && rawRolesSource.trim().length > 0
      ? rawRolesSource.split(',')
      : [];
  const normalizedRoles = rawRoles
    .map((role: string) => role.trim().toLowerCase())
    .filter((role) => role.length > 0);
  const normalizedRole = (user.role ?? normalizedRoles[0] ?? 'user')
    ?.toString()
    .trim()
    .toLowerCase();

  const firstName = user.firstName ?? user.first_name;
  const lastName = user.lastName ?? user.last_name;
  const createdAt = user.createdAt ?? user.created_at;
  const updatedAt = user.updatedAt ?? user.updated_at;
  const lastLogin = user.lastLogin ?? user.last_login;
  const emailVerified = user.emailVerified ?? user.email_verified;
  const kycStatus = user.kycStatus ?? user.kyc_status;
  // Normalize server-side variants to our canonical UI values
  let normalizedKyc = (kycStatus ?? '') as string | undefined;
  if (typeof normalizedKyc === 'string') {
    const lk = normalizedKyc.toLowerCase().trim();
    if (lk === 'verified') normalizedKyc = 'approved';
    if (lk === 'pending_verification') normalizedKyc = 'pending';
  }
  const avatarUrl = user.avatarUrl ?? user.avatar_url;
  const preferredLeverageRaw = user.preferredLeverage ?? user.preferred_leverage;
  const preferredLeverage =
    preferredLeverageRaw === null || preferredLeverageRaw === undefined
      ? undefined
      : Number(preferredLeverageRaw);

  return {
    ...user,
    firstName,
    lastName,
    createdAt,
    updatedAt,
    lastLogin,
    emailVerified,
  kycStatus: (normalizedKyc as 'pending' | 'submitted' | 'approved' | 'rejected' | undefined),
    avatarUrl,
  preferredLeverage: Number.isFinite(preferredLeverage) ? preferredLeverage : undefined,
    roles: normalizedRoles,
    role: normalizedRole,
    first_name: user.first_name ?? firstName,
    last_name: user.last_name ?? lastName,
    created_at: user.created_at ?? createdAt,
    updated_at: user.updated_at ?? updatedAt,
    last_login: user.last_login ?? lastLogin,
    email_verified: user.email_verified ?? emailVerified,
  kyc_status: (user.kyc_status ?? (normalizedKyc as 'pending' | 'submitted' | 'approved' | 'rejected' | undefined)),
    avatar_url: user.avatar_url ?? avatarUrl,
    preferred_leverage:
      user.preferred_leverage ??
      (Number.isFinite(preferredLeverage) ? preferredLeverage : user.preferred_leverage),
  } as User;
};

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: User }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_UPDATE_USER'; payload: User }
  | { type: 'AUTH_CLEAR_ERROR' };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'AUTH_UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ user: User; tokens: AuthTokens }>;
  register: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    referralCode?: string;
    acceptTerms: boolean;
    preferredLeverage: number;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('accessToken');
      console.log('AuthContext - Token found:', !!token);
      
      if (token) {
        try {
          dispatch({ type: 'AUTH_START' });
          console.log('AuthContext - Calling getProfile...');
          const response = await authService.getProfile();
          console.log('AuthContext - Profile response:', response);
          
          if (response.success && response.data) {
            console.log('AuthContext - Setting user data:', response.data);
            dispatch({ type: 'AUTH_SUCCESS', payload: normalizeUser(response.data) });
          } else {
            throw new Error('Failed to get user profile');
          }
        } catch (error) {
          console.error('Auth initialization failed:', error);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          dispatch({ type: 'AUTH_ERROR', payload: 'Session expired' });
        }
      } else {
        console.log('AuthContext - No token found, logging out');
        dispatch({ type: 'AUTH_LOGOUT' });
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await authService.login({ email, password });
      
      if (response.success && response.data) {
        const normalized = normalizeUser(response.data.user);
        dispatch({ type: 'AUTH_SUCCESS', payload: normalized });
        return { ...response.data, user: normalized }; // Return the response data including normalized user info
      } else {
        throw new Error(response.error?.message || 'Login failed');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'AUTH_ERROR', payload: message });
      throw error;
    }
  };

  const register = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    referralCode?: string;
    acceptTerms: boolean;
    preferredLeverage: number;
  }) => {
    try {
      dispatch({ type: 'AUTH_START' });
      const response = await authService.register(userData);
      
      if (response.success && response.data) {
        const normalized = normalizeUser(response.data.user);
        dispatch({ type: 'AUTH_SUCCESS', payload: normalized });
      } else {
        throw new Error(response.error?.message || 'Registration failed');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      dispatch({ type: 'AUTH_ERROR', payload: message });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    try {
      const response = await authService.updateProfile(userData);
      if (response.success && response.data) {
        dispatch({ type: 'AUTH_UPDATE_USER', payload: normalizeUser(response.data) });
      } else {
        throw new Error(response.error?.message || 'Update failed');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Update failed';
      throw new Error(message);
    }
  };

  const clearError = () => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};