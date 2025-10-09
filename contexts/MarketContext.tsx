'use client';

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { MarketData, Symbol, MarketStats } from '@/lib/types';
import { marketService } from '@/lib/services';

interface MarketState {
  marketData: MarketData[];
  symbols: Symbol[];
  categories: Array<{ value: string; label: string; count: number }>;
  stats: MarketStats | null;
  selectedCategory: string;
  selectedSymbol: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

type MarketAction =
  | { type: 'MARKET_START' }
  | { type: 'MARKET_ERROR'; payload: string }
  | { type: 'SET_MARKET_DATA'; payload: MarketData[] }
  | { type: 'SET_SYMBOLS'; payload: Symbol[] }
  | { type: 'SET_CATEGORIES'; payload: Array<{ value: string; label: string; count: number }> }
  | { type: 'SET_STATS'; payload: MarketStats }
  | { type: 'SET_CATEGORY'; payload: string }
  | { type: 'SET_SELECTED_SYMBOL'; payload: string | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'UPDATE_PRICES'; payload: MarketData[] }
  | { type: 'CLEAR_ERROR' };

const initialState: MarketState = {
  marketData: [],
  symbols: [],
  categories: [],
  stats: null,
  selectedCategory: 'all',
  selectedSymbol: null,
  searchQuery: '',
  isLoading: false,
  error: null,
  lastUpdate: null,
};

const marketReducer = (state: MarketState, action: MarketAction): MarketState => {
  switch (action.type) {
    case 'MARKET_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'MARKET_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'SET_MARKET_DATA':
      return {
        ...state,
        marketData: action.payload,
        isLoading: false,
        lastUpdate: new Date(),
      };
    case 'SET_SYMBOLS':
      return {
        ...state,
        symbols: action.payload,
        isLoading: false,
      };
    case 'SET_CATEGORIES':
      return {
        ...state,
        categories: action.payload,
        isLoading: false,
      };
    case 'SET_STATS':
      return {
        ...state,
        stats: action.payload,
        isLoading: false,
      };
    case 'SET_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
      };
    case 'SET_SELECTED_SYMBOL':
      return {
        ...state,
        selectedSymbol: action.payload,
      };
    case 'SET_SEARCH_QUERY':
      return {
        ...state,
        searchQuery: action.payload,
      };
    case 'UPDATE_PRICES':
      // Update existing market data with new prices
      const updatedMarketData = state.marketData.map(item => {
        const update = action.payload.find(u => u.symbolId === item.symbolId);
        return update ? { ...item, ...update } : item;
      });
      return {
        ...state,
        marketData: updatedMarketData,
        lastUpdate: new Date(),
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

interface MarketContextType extends MarketState {
  loadMarketData: (category?: string, search?: string) => Promise<void>;
  loadCategories: () => Promise<void>;
  loadStats: () => Promise<void>;
  searchSymbols: (query: string) => Promise<Symbol[]>;
  getSymbol: (id: number) => Promise<Symbol | null>;
  getSymbolHistory: (id: number, timeframe?: string, limit?: number) => Promise<MarketData[]>;
  setCategory: (category: string) => void;
  setSelectedSymbol: (symbol: string | null) => void;
  setSearchQuery: (query: string) => void;
  refreshPrices: () => Promise<void>;
  clearError: () => void;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

interface MarketProviderProps {
  children: ReactNode;
}

export const MarketProvider: React.FC<MarketProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(marketReducer, initialState);

  useEffect(() => {
    // Load initial data
    loadMarketData();
    loadCategories();
    loadStats();
  }, []);

  // Auto-refresh market data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshPrices();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadMarketData = async (category?: string, search?: string) => {
    try {
      dispatch({ type: 'MARKET_START' });
      const response = await marketService.getMarketOverview({
        category: category || state.selectedCategory,
        search: search || state.searchQuery,
      });
      
      if (response.success && response.data) {
        dispatch({ type: 'SET_MARKET_DATA', payload: response.data });
        
        // Set default symbol if none selected and data is available
        if (!state.selectedSymbol && response.data.length > 0) {
          // Try to find EURUSD first, or use the first available symbol
          const defaultSymbol = response.data.find(item => item.symbol === 'EURUSD') || response.data[0];
          if (defaultSymbol) {
            dispatch({ type: 'SET_SELECTED_SYMBOL', payload: defaultSymbol.symbol });
          }
        }
      } else {
        throw new Error(response.error?.message || 'Failed to load market data');
      }
    } catch (error: any) {
      console.error('Market data API failed, using fallback data:', error);
      
      // Fallback to mock data if API fails
      const fallbackData = [
        { id: 1, symbolId: 1, symbol: 'EURUSD', name: 'Euro/US Dollar', category: 'forex', currentPrice: 1.0846, openPrice: 1.0834, highPrice: 1.0851, lowPrice: 1.0831, closePrice: 1.0846, volume: 125000, change: 0.0012, changePercent: 0.11, bid: 1.0845, ask: 1.0847, spread: 0.0002, date: new Date().toISOString() },
        { id: 2, symbolId: 2, symbol: 'GBPUSD', name: 'British Pound/US Dollar', category: 'forex', currentPrice: 1.2635, openPrice: 1.2658, highPrice: 1.2665, lowPrice: 1.2628, closePrice: 1.2635, volume: 98000, change: -0.0023, changePercent: -0.18, bid: 1.2634, ask: 1.2636, spread: 0.0002, date: new Date().toISOString() },
        { id: 3, symbolId: 3, symbol: 'USDJPY', name: 'US Dollar/Japanese Yen', category: 'forex', currentPrice: 149.86, openPrice: 149.41, highPrice: 149.92, lowPrice: 149.35, closePrice: 149.86, volume: 87000, change: 0.45, changePercent: 0.30, bid: 149.85, ask: 149.87, spread: 0.02, date: new Date().toISOString() },
        { id: 4, symbolId: 4, symbol: 'XAUUSD', name: 'Gold/US Dollar', category: 'commodities', currentPrice: 2685.67, openPrice: 2670.47, highPrice: 2687.20, lowPrice: 2668.30, closePrice: 2685.67, volume: 45000, change: 15.20, changePercent: 0.57, bid: 2685.42, ask: 2685.92, spread: 0.50, date: new Date().toISOString() },
        { id: 5, symbolId: 5, symbol: 'BTCUSD', name: 'Bitcoin/US Dollar', category: 'crypto', currentPrice: 67035.20, openPrice: 68235.50, highPrice: 68450.80, lowPrice: 66800.40, closePrice: 67035.20, volume: 12500, change: -1200.30, changePercent: -1.75, bid: 67234.50, ask: 67245.80, spread: 11.30, date: new Date().toISOString() }
      ];
      
      dispatch({ type: 'SET_MARKET_DATA', payload: fallbackData });
      
      // Set default symbol
      if (!state.selectedSymbol) {
        dispatch({ type: 'SET_SELECTED_SYMBOL', payload: 'EURUSD' });
      }
      
      dispatch({ type: 'MARKET_ERROR', payload: error.message });
    }
  };

  const loadCategories = async () => {
    try {
      const response = await marketService.getMarketCategories();
      if (response.success && response.data) {
        dispatch({ type: 'SET_CATEGORIES', payload: response.data });
      }
    } catch (error: any) {
      console.error('Failed to load categories, using fallback:', error);
      // Fallback categories
      const fallbackCategories = [
        { value: "all", label: "All Markets", count: 5 },
        { value: "forex", label: "Forex", count: 3 },
        { value: "commodities", label: "Commodities", count: 1 },
        { value: "crypto", label: "Cryptocurrency", count: 1 },
      ];
      dispatch({ type: 'SET_CATEGORIES', payload: fallbackCategories });
    }
  };

  const loadStats = async () => {
    try {
      const response = await marketService.getMarketStats();
      if (response.success && response.data) {
        dispatch({ type: 'SET_STATS', payload: response.data });
      }
    } catch (error: any) {
      console.error('Failed to load market stats:', error);
    }
  };

  const searchSymbols = async (query: string): Promise<Symbol[]> => {
    try {
      const response = await marketService.searchSymbols(query);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error: any) {
      console.error('Symbol search failed:', error);
      return [];
    }
  };

  const getSymbol = async (id: number): Promise<Symbol | null> => {
    try {
      const response = await marketService.getSymbol(id);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (error: any) {
      console.error('Failed to get symbol:', error);
      return null;
    }
  };

  const getSymbolHistory = async (
    id: number, 
    timeframe = '1D', 
    limit = 100
  ): Promise<MarketData[]> => {
    try {
      const response = await marketService.getSymbolHistory(id, timeframe, limit);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error: any) {
      console.error('Failed to get symbol history:', error);
      return [];
    }
  };

  const setCategory = (category: string) => {
    dispatch({ type: 'SET_CATEGORY', payload: category });
    loadMarketData(category);
  };

  const setSearchQuery = (query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
    if (query.length >= 2 || query.length === 0) {
      loadMarketData(undefined, query);
    }
  };

  const refreshPrices = async () => {
    try {
      if (state.marketData.length > 0) {
        const symbolIds = state.marketData.map(item => item.symbolId);
        const response = await marketService.getRealTimePrices(symbolIds);
        
        if (response.success && response.data) {
          dispatch({ type: 'UPDATE_PRICES', payload: response.data });
        }
      }
    } catch (error: any) {
      console.error('Failed to refresh prices:', error);
    }
  };

  const setSelectedSymbol = (symbol: string | null) => {
    dispatch({ type: 'SET_SELECTED_SYMBOL', payload: symbol });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: MarketContextType = {
    ...state,
    loadMarketData,
    loadCategories,
    loadStats,
    searchSymbols,
    getSymbol,
    getSymbolHistory,
    setCategory,
    setSelectedSymbol,
    setSearchQuery,
    refreshPrices,
    clearError,
  };

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
};

export const useMarket = (): MarketContextType => {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
};