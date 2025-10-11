'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { IbCommissionMessageData, WebSocketMessage } from '@/lib/types';
import { useAuth } from './AuthContext';
import { useTrading } from './TradingContext';
import { useMarket } from './MarketContext';

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
}

interface WebSocketContextType extends WebSocketState {
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

const resolveWebSocketUrl = () => {
  if (process.env.NEXT_PUBLIC_WS_URL && process.env.NEXT_PUBLIC_WS_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';
    const port = process.env.NEXT_PUBLIC_WS_PORT || '3001';
    return `${wsProtocol}://${hostname}:${port}`;
  }

  return 'ws://localhost:3001';
};

const WS_URL = resolveWebSocketUrl();

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const { isAuthenticated, user } = useAuth();
  const tradingContext = useTrading();
  const marketContext = useMarket();

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN || state.isConnecting) {
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));
        reconnectAttempts.current = 0;

        // Subscribe to user-specific events if authenticated
        if (isAuthenticated && user) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: ['market_data', 'positions', 'notifications'],
            userId: user.id,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setState(prev => ({ ...prev, lastMessage: message }));
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));
        wsRef.current = null;

        // Attempt to reconnect if not a manual disconnect
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'Connection failed',
          isConnecting: false,
        }));
      };
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isConnecting: false,
      }));
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000); // Normal closure
      wsRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'market_update':
        // Update market data in MarketContext
        if (message.data && marketContext) {
          // marketContext.updatePrices(message.data);
        }
        break;

      case 'positions_update':
        // Update positions in TradingContext
        if (message.data && tradingContext) {
          // tradingContext.updatePositionsRealtime(message.data);
        }
        break;

      case 'balance_update':
        // Handle balance updates from position closures, deposits, withdrawals
        if (message.data && message.userId === user?.id) {
          console.log('Balance update received:', message.data);
          
          // Dispatch custom event for balance updates
          const event = new CustomEvent('balanceUpdate', {
            detail: message.data
          });
          window.dispatchEvent(event);
          
          // Update trading context if available
          if (tradingContext && tradingContext.refreshData) {
            tradingContext.refreshData();
          }
        }
        break;

      case 'ib_commission_recorded':
        if (message.userId === user?.id) {
          const event = new CustomEvent<IbCommissionMessageData>('ibCommissionRecorded', {
            detail: (message.data || {}) as IbCommissionMessageData,
          });
          window.dispatchEvent(event);
        }
        break;

      case 'notification':
        // Handle notifications
        if (message.data) {
          console.log('New notification:', message.data);
          // You can dispatch to a notification context or show a toast
        }
        break;

      case 'price_alert':
        // Handle price alerts
        if (message.data) {
          console.log('Price alert triggered:', message.data);
          // Show alert notification
        }
        break;

      case 'market_prices_update': {
        const event = new CustomEvent('marketPricesUpdate', { detail: message.data });
        window.dispatchEvent(event);
        break;
      }

      case 'positions_update':
      case 'realtime_positions_update': {
        const event = new CustomEvent('positionsUpdate', { detail: message.data });
        window.dispatchEvent(event);
        break;
      }

      case 'error':
        console.error('WebSocket error message:', message.data);
        {
          const errorMessage = (message.data as { message?: string } | undefined)?.message;
          setState(prev => ({ ...prev, error: errorMessage || 'Unknown error' }));
        }
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const value: WebSocketContextType = {
    ...state,
    connect,
    disconnect,
    sendMessage,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};