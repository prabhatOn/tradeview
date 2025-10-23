"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TradingAccount } from '@/lib/types';
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Activity,
  Eye,
} from 'lucide-react';

interface TradingAccountCardProps {
  account: TradingAccount;
  onViewDetails?: (account: TradingAccount) => void;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const getAccountTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'demo':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'live':
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'islamic':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-500/10 text-green-400 border-green-500/20';
    case 'inactive':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'frozen':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'closed':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
};

export function TradingAccountCard({ account, onViewDetails }: TradingAccountCardProps) {
  const marginLevel = account.marginLevel || 100;

  return (
    <Card className="p-6 bg-card/60 border border-border hover:bg-card/80 transition-colors">
      <div className="w-full flex flex-col items-center justify-center text-center sm:text-left">

        {/* Header */}
        <div className="w-full flex flex-col sm:flex-row items-center sm:items-start sm:justify-between justify-center gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold break-words">#{account.accountNumber}</h3>
              <p className="text-sm text-muted-foreground break-words">
                {account.currency} Account • {account.leverage}:1 Leverage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0 justify-center sm:justify-start">
            <Badge className={getAccountTypeColor(account.accountType)}>
              {account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1)}
            </Badge>
            <Badge className={getStatusColor(account.status)}>
              {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center sm:justify-start">
              <DollarSign className="w-4 h-4" />
              Balance
            </div>
            <div className="text-base font-semibold min-w-0 break-words">{currencyFormatter.format(account.balance)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center sm:justify-start">
              <TrendingUp className="w-4 h-4" />
              Equity
            </div>
            <div className="text-base font-semibold min-w-0 break-words">{currencyFormatter.format(account.equity)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center sm:justify-start">
              <Activity className="w-4 h-4" />
              Free Margin
            </div>
            <div className="text-base font-semibold text-green-400 min-w-0 break-words">{currencyFormatter.format(account.freeMargin)}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center sm:justify-start">
              <Activity className="w-4 h-4" />
              Margin Level
            </div>
            <div className={`text-base font-semibold ${
              marginLevel >= 100 ? 'text-green-400' : marginLevel >= 50 ? 'text-yellow-400' : 'text-red-400'
            } min-w-0 break-words`}>{marginLevel.toFixed(2)}%</div>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground min-w-0 truncate">Created: {new Date(account.createdAt).toLocaleDateString()}</div>
            <div className="flex items-center gap-2">
              {onViewDetails && (
                <Button size="sm" variant="ghost" onClick={() => onViewDetails(account)} className="text-xs flex-shrink-0">
                  <Eye className="w-3 h-3 mr-1" />
                  View Details
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}