'use client';

import React, { ReactNode } from 'react';
import { AuthProvider } from './AuthContext';
import { TradingProvider } from './TradingContext';
import { MarketProvider } from './MarketContext';
import { WebSocketProvider } from './WebSocketContext';

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      <TradingProvider>
        <MarketProvider>
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
        </MarketProvider>
      </TradingProvider>
    </AuthProvider>
  );
};