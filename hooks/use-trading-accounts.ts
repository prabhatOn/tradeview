'use client';

import { useState, useEffect } from 'react';
import { TradingAccount } from '@/lib/types';
import { userService } from '@/lib/services';

export function useTradingAccounts() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await userService.getTradingAccounts();
      
      if (response.success && response.data) {
        setAccounts(response.data);
      } else {
        setError(response.error?.message || 'Failed to fetch trading accounts');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trading accounts');
      console.error('Error fetching trading accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const refreshAccounts = () => {
    fetchAccounts();
  };

  return {
    accounts,
    isLoading,
    error,
    refreshAccounts
  };
}