/* eslint-disable @typescript-eslint/no-explicit-any */
// Utility functions to normalize data between frontend and backend

import { Position } from './types';

// Normalize position data from backend to frontend format
export function normalizePosition(backendPosition: any): Position {
  const status = backendPosition.status ?? backendPosition.position_status;
  const openPrice = backendPosition.openPrice ?? backendPosition.open_price ?? 0;
  const currentPrice =
    backendPosition.currentPrice ??
    backendPosition.current_price ??
    backendPosition.lastPrice ??
    backendPosition.last_price ??
    openPrice;
  const rawClosePrice = backendPosition.closePrice ?? backendPosition.close_price;
  const resolvedClosePrice =
    rawClosePrice !== undefined && rawClosePrice !== null && rawClosePrice !== ''
      ? Number(rawClosePrice)
      : status === 'closed'
        ? currentPrice ?? openPrice
        : null;

  return {
    ...backendPosition,
    // Core identification
    id: backendPosition.id,
    accountId: backendPosition.accountId,
    symbolId: backendPosition.symbolId,
    symbol: backendPosition.symbol,
    symbolName: backendPosition.symbolName || backendPosition.symbol_name,
    
    // Position type with compatibility
    side: backendPosition.side,
    positionType: backendPosition.side, // Frontend compatibility
    
    // Volume/lotSize mapping with compatibility
    lotSize: backendPosition.lotSize ?? backendPosition.lot_size ?? backendPosition.volume ?? 0,
    volume: backendPosition.volume ?? backendPosition.lotSize ?? backendPosition.lot_size ?? 0,
    
    // Price fields
  openPrice,
  currentPrice,
  closePrice: resolvedClosePrice,
    stopLoss: backendPosition.stopLoss ?? backendPosition.stop_loss,
    takeProfit: backendPosition.takeProfit ?? backendPosition.take_profit,
    
    // P&L fields with enhanced mapping
    profit: backendPosition.profit ?? 0,
    profitLoss: backendPosition.profit ?? 0, // Legacy compatibility
    unrealizedPnl: backendPosition.unrealizedPnl ?? backendPosition.profit ?? 0,
    netProfit: backendPosition.netProfit ?? backendPosition.net_profit ?? backendPosition.profit ?? 0,
    grossProfit: backendPosition.grossProfit ?? backendPosition.gross_profit ?? 0,
    grossLoss: backendPosition.grossLoss ?? backendPosition.gross_loss ?? 0,
    
    // Costs
    commission: backendPosition.commission ?? 0,
    swap: backendPosition.swap ?? 0,
    
    // Status and metadata
    status: backendPosition.status,
    comment: backendPosition.comment,
    magicNumber: backendPosition.magicNumber ?? backendPosition.magic_number,
    accountNumber: backendPosition.accountNumber ?? backendPosition.account_number,
    
    // Timestamps with compatibility
    openedAt: backendPosition.openedAt ?? backendPosition.opened_at,
    updatedAt: backendPosition.updatedAt ?? backendPosition.updated_at,
    closedAt: backendPosition.closedAt ?? backendPosition.closed_at,
    openTime: backendPosition.openTime ?? backendPosition.openedAt ?? backendPosition.opened_at,
    closeTime: backendPosition.closeTime ?? backendPosition.closedAt ?? backendPosition.closed_at,
  };
}

// Normalize position data array
export function normalizePositions(backendPositions: any[]): Position[] {
  if (!Array.isArray(backendPositions)) {
    console.warn('normalizePositions: expected array, got:', typeof backendPositions);
    return [];
  }
  return backendPositions.map(normalizePosition);
}

// Convert frontend position data to backend format
export function denormalizePositionRequest(frontendData: any) {
  return {
    accountId: frontendData.accountId,
    symbolId: frontendData.symbolId,
    side: frontendData.side || frontendData.positionType,
    lotSize: frontendData.lotSize || frontendData.volume,
    stopLoss: frontendData.stopLoss || null,
    takeProfit: frontendData.takeProfit || null,
    comment: frontendData.comment || null,
  };
}

// Format price for display
export function formatPrice(price: number, decimals: number = 5): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  }).format(price);
}

// Format profit/loss for display
export function formatPnL(pnl: number | undefined): string {
  if (pnl === undefined || pnl === null) return "0.00";
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always'
  }).format(pnl);
}

// Get P&L color class
export function getPnLColor(pnl: number | undefined): string {
  if (!pnl) return "text-muted-foreground";
  return pnl >= 0 ? "text-green-500" : "text-red-500";
}