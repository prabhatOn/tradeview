'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { TradingAccount, Position, TradingStats, AccountSummary } from '@/lib/types';
import { tradingService, userService } from '@/lib/services';
import { useAuth } from './AuthContext';

interface TradingState {
  accounts: TradingAccount[];
  activeAccount: TradingAccount | null;
  positions: Position[];
  openPositions: Position[];
  closedPositions: Position[];
  stats: TradingStats | null;
  accountSummary: AccountSummary | null;
  isLoading: boolean;
  error: string | null;
}

type TradingAction =
  | { type: 'TRADING_START' }
  | { type: 'TRADING_ERROR'; payload: string }
  | { type: 'SET_ACCOUNTS'; payload: TradingAccount[] }
  | { type: 'SET_ACTIVE_ACCOUNT'; payload: TradingAccount }
  | { type: 'SET_POSITIONS'; payload: Position[] }
  | { type: 'ADD_POSITION'; payload: Position }
  | { type: 'UPDATE_POSITION'; payload: Position }
  | { type: 'REMOVE_POSITION'; payload: number }
  | { type: 'SET_STATS'; payload: TradingStats }
  | { type: 'SET_ACCOUNT_SUMMARY'; payload: AccountSummary }
  | { type: 'UPDATE_POSITIONS_REALTIME'; payload: Position[] }
  | { type: 'CLEAR_ERROR' };

const initialState: TradingState = {
  accounts: [],
  activeAccount: null,
  positions: [],
  openPositions: [],
  closedPositions: [],
  stats: null,
  accountSummary: null,
  isLoading: false,
  error: null,
};

const tradingReducer = (state: TradingState, action: TradingAction): TradingState => {
  switch (action.type) {
    case 'TRADING_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'TRADING_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'SET_ACCOUNTS':
      // Try to preserve the current active account if it exists in the new accounts
      const currentActiveId = state.activeAccount?.id;
      const preservedActiveAccount = currentActiveId 
        ? action.payload.find(acc => acc.id === currentActiveId) 
        : null;
      
      return {
        ...state,
        accounts: action.payload,
        activeAccount: preservedActiveAccount || action.payload[0] || null,
        isLoading: false,
      };
    case 'SET_ACTIVE_ACCOUNT':
      return {
        ...state,
        activeAccount: action.payload,
      };
    case 'SET_POSITIONS':
      const openPositions = action.payload.filter(p => p.status === 'open');
      const closedPositions = action.payload.filter(p => p.status === 'closed');
      return {
        ...state,
        positions: action.payload,
        openPositions,
        closedPositions,
        isLoading: false,
      };
    case 'ADD_POSITION':
      const newPositions = [...state.positions, action.payload];
      return {
        ...state,
        positions: newPositions,
        openPositions: action.payload.status === 'open' 
          ? [...state.openPositions, action.payload]
          : state.openPositions,
      };
    case 'UPDATE_POSITION':
      const updatedPositions = state.positions.map(p =>
        p.id === action.payload.id ? action.payload : p
      );
      return {
        ...state,
        positions: updatedPositions,
        openPositions: updatedPositions.filter(p => p.status === 'open'),
        closedPositions: updatedPositions.filter(p => p.status === 'closed'),
      };
    case 'REMOVE_POSITION':
      const filteredPositions = state.positions.filter(p => p.id !== action.payload);
      return {
        ...state,
        positions: filteredPositions,
        openPositions: filteredPositions.filter(p => p.status === 'open'),
        closedPositions: filteredPositions.filter(p => p.status === 'closed'),
      };
    case 'SET_STATS':
      return {
        ...state,
        stats: action.payload,
        isLoading: false,
      };
    case 'SET_ACCOUNT_SUMMARY':
      return {
        ...state,
        accountSummary: action.payload,
        isLoading: false,
      };
    case 'UPDATE_POSITIONS_REALTIME':
      // Update positions with real-time data
      const realtimeUpdatedPositions = state.positions.map(position => {
        const update = action.payload.find(p => p.id === position.id);
        return update ? { ...position, ...update } : position;
      });
      return {
        ...state,
        positions: realtimeUpdatedPositions,
        openPositions: realtimeUpdatedPositions.filter(p => p.status === 'open'),
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

interface TradingContextType extends TradingState {
  loadAccounts: () => Promise<void>;
  setActiveAccount: (account: TradingAccount) => void;
  loadPositions: (accountId?: number) => Promise<void>;
  openPosition: (data: any) => Promise<void>;
  closePosition: (id: number) => Promise<void>;
  updatePosition: (id: number, data: any) => Promise<void>;
  loadStats: (accountId?: number) => Promise<void>;
  loadAccountSummary: (accountId: number) => Promise<void>;
  refreshData: () => Promise<void>;
  clearError: () => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

interface TradingProviderProps {
  children: ReactNode;
}

export const TradingProvider: React.FC<TradingProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(tradingReducer, initialState);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      loadAccounts();
    }
  }, [isAuthenticated, user]);

  const loadAccounts = async () => {
    try {
      dispatch({ type: 'TRADING_START' });
      console.log('🔄 Loading trading accounts...');
      const response = await tradingService.getTradingAccounts();
      console.log('📦 Accounts API response:', response);
      
      if (response.success && response.data && Array.isArray(response.data)) {
        console.log('✅ Setting accounts:', response.data.length, 'accounts found');
        console.log('📊 Account details:', response.data.map(acc => ({ id: acc.id, accountNumber: acc.accountNumber, balance: acc.balance })));
        dispatch({ type: 'SET_ACCOUNTS', payload: response.data });
      } else {
        console.error('❌ Invalid accounts response:', response);
        dispatch({ type: 'TRADING_ERROR', payload: 'Invalid accounts response from server' });
      }
    } catch (error: any) {
      console.error('❌ Failed to load accounts:', error);
      dispatch({ type: 'TRADING_ERROR', payload: error.message || 'Failed to load trading accounts' });
    }
  };

  const setActiveAccount = (account: TradingAccount) => {
    dispatch({ type: 'SET_ACTIVE_ACCOUNT', payload: account });
    loadPositions(account.id);
    loadAccountSummary(account.id);
  };

  const loadPositions = async (accountId?: number) => {
    try {
      // Don't dispatch TRADING_START to avoid clearing the loading state unnecessarily
      const response = await tradingService.getPositions({ 
        accountId: accountId || state.activeAccount?.id 
      });
      if (response.success && response.data) {
        // Handle both paginated and direct array responses
        const positions = Array.isArray(response.data) ? response.data : (response.data as any)?.data || [];
        dispatch({ type: 'SET_POSITIONS', payload: positions });
      }
    } catch (error: any) {
      dispatch({ type: 'TRADING_ERROR', payload: error.message });
    }
  };

  const openPosition = async (data: any) => {
    try {
      const response = await tradingService.openPosition({
        ...data,
        accountId: data.accountId || state.activeAccount?.id,
      });
      
      if (response.success) {
        // Reload positions to get the new position
        await loadPositions();
        await loadAccountSummary(state.activeAccount?.id || data.accountId);
      } else {
        throw new Error(response.error?.message || 'Failed to open position');
      }
    } catch (error: any) {
      dispatch({ type: 'TRADING_ERROR', payload: error.message });
      throw error;
    }
  };

  const closePosition = async (id: number) => {
    try {
      const response = await tradingService.closePosition(id);
      if (response.success) {
        // Remove the position from open positions since it's now closed
        dispatch({ type: 'REMOVE_POSITION', payload: id });
        
        // Refresh account balance to show the updated balance (like real trading)
        if (state.activeAccount) {
          loadAccountSummary(state.activeAccount.id);
        }
      } else {
        throw new Error(response.error?.message || 'Failed to close position');
      }
    } catch (error: any) {
      dispatch({ type: 'TRADING_ERROR', payload: error.message });
      throw error;
    }
  };

  const updatePosition = async (id: number, data: any) => {
    try {
      const response = await tradingService.updatePosition(id, data);
      if (response.success && response.data) {
        dispatch({ type: 'UPDATE_POSITION', payload: response.data });
      } else {
        throw new Error(response.error?.message || 'Failed to update position');
      }
    } catch (error: any) {
      dispatch({ type: 'TRADING_ERROR', payload: error.message });
      throw error;
    }
  };

  const loadStats = async (accountId?: number) => {
    try {
      const response = await tradingService.getTradingStats(accountId || state.activeAccount?.id);
      if (response.success && response.data) {
        dispatch({ type: 'SET_STATS', payload: response.data });
      }
    } catch (error: any) {
      dispatch({ type: 'TRADING_ERROR', payload: error.message });
    }
  };

  const loadAccountSummary = async (accountId: number) => {
    try {
      const response = await tradingService.getAccountSummary(accountId);
      if (response.success && response.data) {
        dispatch({ type: 'SET_ACCOUNT_SUMMARY', payload: response.data });
      }
    } catch (error: any) {
      dispatch({ type: 'TRADING_ERROR', payload: error.message });
    }
  };

  const refreshData = async () => {
    if (state.activeAccount) {
      await Promise.all([
        loadPositions(state.activeAccount.id),
        loadAccountSummary(state.activeAccount.id),
        loadStats(state.activeAccount.id),
      ]);
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: TradingContextType = {
    ...state,
    loadAccounts,
    setActiveAccount,
    loadPositions,
    openPosition,
    closePosition,
    updatePosition,
    loadStats,
    loadAccountSummary,
    refreshData,
    clearError,
  };

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
};

export const useTrading = (): TradingContextType => {
  const context = useContext(TradingContext);
  if (context === undefined) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
};