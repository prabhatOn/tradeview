import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTrading } from '@/contexts/TradingContext';
import { useMarket } from '@/contexts/MarketContext';
import { useApi, usePagination, useDebouncedApi } from './use-api';
import {
  tradingService,
  marketService,
  transactionService,
  userService,
} from '@/lib/services';
import {
  Position,
  MarketData,
  Transaction,
  Symbol,
  TradingAccount,
  Notification,
} from '@/lib/types';

// Trading Hooks
export function usePositions(accountId?: number, status?: 'open' | 'closed' | 'all') {
  const { activeAccount } = useTrading();
  
  return useApi(
    () => tradingService.getPositions({ 
      accountId: accountId || activeAccount?.id,
      status 
    }),
    [accountId || activeAccount?.id, status],
    {
      immediate: true,
      cacheKey: `positions-${accountId || activeAccount?.id}-${status}`,
      cacheDuration: 30000, // 30 seconds
    }
  );
}

export function useOpenPosition() {
  const { openPosition, clearError } = useTrading();
  
  return useCallback(async (positionData: any) => {
    try {
      clearError();
      await openPosition(positionData);
    } catch (error) {
      throw error;
    }
  }, [openPosition, clearError]);
}

export function useClosePosition() {
  const { closePosition, clearError } = useTrading();
  
  return useCallback(async (positionId: number) => {
    try {
      clearError();
      await closePosition(positionId);
    } catch (error) {
      throw error;
    }
  }, [closePosition, clearError]);
}

export function useTradingStats(accountId?: number) {
  const { activeAccount } = useTrading();
  
  return useApi(
    () => tradingService.getTradingStats(accountId || activeAccount?.id),
    [accountId || activeAccount?.id],
    {
      cacheKey: `trading-stats-${accountId || activeAccount?.id}`,
      cacheDuration: 60000, // 1 minute
    }
  );
}

export function useAccountSummary(accountId?: number) {
  const { activeAccount } = useTrading();
  
  return useApi(
    () => tradingService.getAccountSummary(accountId || activeAccount?.id!),
    [accountId || activeAccount?.id],
    {
      cacheKey: `account-summary-${accountId || activeAccount?.id}`,
      cacheDuration: 30000, // 30 seconds
    }
  );
}

// Market Data Hooks
export function useMarketOverview(category?: string) {
  return useApi(
    () => marketService.getMarketOverview({ category }),
    [category],
    {
      cacheKey: `market-overview-${category || 'all'}`,
      cacheDuration: 30000, // 30 seconds
    }
  );
}

export function useSymbolSearch() {
  return useDebouncedApi(
    (query: string) => marketService.searchSymbols(query),
    300
  );
}

export function useSymbol(id: number) {
  return useApi(
    () => marketService.getSymbol(id),
    [id],
    {
      cacheKey: `symbol-${id}`,
      cacheDuration: 300000, // 5 minutes
    }
  );
}

export function useSymbolHistory(id: number, timeframe = '1D', limit = 100) {
  return useApi(
    () => marketService.getSymbolHistory(id, timeframe, limit),
    [id, timeframe, limit],
    {
      cacheKey: `symbol-history-${id}-${timeframe}-${limit}`,
      cacheDuration: 60000, // 1 minute
    }
  );
}

export function useMarketCategories() {
  return useApi(
    () => marketService.getMarketCategories(),
    [],
    {
      cacheKey: 'market-categories',
      cacheDuration: 600000, // 10 minutes
    }
  );
}

// Transaction Hooks
export function useTransactionHistory(type?: 'deposit' | 'withdrawal') {
  return usePagination(
    (page: number, limit: number) => 
      transactionService.getTransactionHistory({ type, page, limit }),
    20
  );
}

export function usePaymentMethods() {
  return useApi(
    () => transactionService.getPaymentMethods(),
    [],
    {
      cacheKey: 'payment-methods',
      cacheDuration: 300000, // 5 minutes
    }
  );
}

export function useCreateDeposit() {
  return useCallback(async (depositData: any) => {
    const response = await transactionService.createDeposit(depositData);
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create deposit');
    }
    return response.data;
  }, []);
}

export function useCreateWithdrawal() {
  return useCallback(async (withdrawalData: any) => {
    const response = await transactionService.createWithdrawal(withdrawalData);
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create withdrawal');
    }
    return response.data;
  }, []);
}

// User Management Hooks
export function useUserProfile() {
  const { user, updateUser } = useAuth();
  
  const { data, isLoading, error, refetch } = useApi(
    () => userService.getProfile(),
    [],
    {
      immediate: !!user,
      cacheKey: `user-profile-${user?.id}`,
      cacheDuration: 300000, // 5 minutes
    }
  );

  const updateProfile = useCallback(async (profileData: any) => {
    await updateUser(profileData);
    refetch(); // Refresh cached data
  }, [updateUser, refetch]);

  return {
    profile: data,
    isLoading,
    error,
    updateProfile,
    refetch,
  };
}

export function useNotifications() {
  return usePagination(
    (page: number, limit: number) => 
      userService.getNotifications(page, limit),
    20
  );
}

export function useMarkNotificationAsRead() {
  return useCallback(async (notificationId: number) => {
    const response = await userService.markNotificationAsRead(notificationId);
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to mark notification as read');
    }
  }, []);
}

export function usePriceAlerts() {
  return useApi(
    () => userService.getPriceAlerts(),
    [],
    {
      cacheKey: 'price-alerts',
      cacheDuration: 60000, // 1 minute
    }
  );
}

export function useCreatePriceAlert() {
  return useCallback(async (alertData: {
    symbolId: number;
    targetPrice: number;
    alertType: 'above' | 'below';
  }) => {
    const response = await userService.createPriceAlert(alertData);
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create price alert');
    }
    return response.data;
  }, []);
}

// Real-time Data Hooks
export function useRealTimePositions() {
  const { openPositions, refreshData } = useTrading();
  
  // Auto-refresh every 30 seconds
  useApi(
    () => Promise.resolve({ success: true, data: null }),
    [],
    {
      immediate: false,
      cacheKey: 'realtime-positions-refresh',
      cacheDuration: 30000,
    }
  );

  return {
    positions: openPositions,
    refresh: refreshData,
  };
}

export function useRealTimeMarket() {
  const { marketData, refreshPrices, lastUpdate } = useMarket();
  
  return {
    marketData,
    lastUpdate,
    refresh: refreshPrices,
  };
}

// Combined Dashboard Hook
export function useDashboardData(accountId?: number) {
  const { activeAccount } = useTrading();
  const currentAccountId = accountId || activeAccount?.id;

  const positions = usePositions(currentAccountId, 'open');
  const stats = useTradingStats(currentAccountId);
  const accountSummary = useAccountSummary(currentAccountId);
  const marketOverview = useMarketOverview();

  const isLoading = positions.isLoading || stats.isLoading || 
                   accountSummary.isLoading || marketOverview.isLoading;

  const error = positions.error || stats.error || 
               accountSummary.error || marketOverview.error;

  const refetchAll = useCallback(() => {
    positions.refetch();
    stats.refetch();
    accountSummary.refetch();
    marketOverview.refetch();
  }, [positions.refetch, stats.refetch, accountSummary.refetch, marketOverview.refetch]);

  return {
    positions: positions.data?.data || [],
    stats: stats.data,
    accountSummary: accountSummary.data,
    marketData: marketOverview.data || [],
    isLoading,
    error,
    refetchAll,
  };
}

// Form Management Hook
export function useFormSubmit<T = any>(
  onSubmit: (data: T) => Promise<void>,
  onSuccess?: () => void,
  onError?: (error: string) => void
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (data: T) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(data);
      onSuccess?.();
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit, onSuccess, onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    handleSubmit,
    isSubmitting,
    error,
    clearError,
  };
}

// Historical data hook
export const useHistoricalData = (symbol: string | null, timeframe: string = '1h') => {
  const queryFn = useCallback(async () => {
    if (!symbol) return { success: false, data: [] }
    
    // For now, return mock historical data since the API expects a numeric ID
    // but we're using string symbols like "EURUSD"
    const mockHistoricalData = {
      success: true,
      data: [] // Empty for now, chart will use generated mock data
    }
    
    return mockHistoricalData
  }, [symbol, timeframe])

  return useApi(
    queryFn,
    [symbol, timeframe],
    {
      immediate: !!symbol,
      cacheKey: symbol ? `historical-${symbol}-${timeframe}` : undefined,
      cacheDuration: 300000 // 5 minutes
    }
  )
}