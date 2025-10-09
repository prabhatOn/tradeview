// API Configuration and Types
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

export interface PaginationResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Auth Types
export interface User {
  id: number;
  uuid?: string;
  email: string;
  /** Preferred camelCase fields returned by the API */
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  emailVerified?: boolean;
  kycStatus?: 'pending' | 'submitted' | 'approved' | 'rejected';
  avatarUrl?: string;

  /** Legacy snake_case fields kept for backward compatibility */
  first_name?: string;
  last_name?: string;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  email_verified?: boolean;
  kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected';
  avatar_url?: string;

  phone?: string;
  bio?: string;
  status: 'active' | 'suspended' | 'inactive' | 'pending_verification';
  role?: string; // Single role from backend
  roles?: string[]; // Array of roles (for compatibility)
}

export interface AdminUserSummary {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  status: string;
  role?: string | null;
  isVerified?: boolean;
  is_verified?: boolean | number | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  created_at?: string | null;
  last_login_at?: string | null;
  tradingAccountsCount?: number;
  trading_accounts_count?: number | string | null;
  totalBalance?: number;
  total_balance?: number | string | null;
  emailVerified?: boolean | number | null;
  email_verified?: boolean | number | null;
  kycStatus?: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
  kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
  pagination: PaginationInfo;
}

export interface AdminUserDetailUser {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  role?: string | null;
  emailVerified?: boolean | number | null;
  email_verified?: boolean | number | null;
  kycStatus?: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
  kyc_status?: 'pending' | 'submitted' | 'approved' | 'rejected' | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  lastLogin?: string | null;
  last_login?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postal_code?: string | null;
  phone_verified?: boolean | number | null;
  date_of_birth?: string | null;
  roles?: string[] | string | null;
  primary_role?: string | null;
  has_ib?: number | boolean | null;
}

export interface AdminUserAccountSummary {
  id: number;
  account_number: string;
  account_type: string;
  balance: number | string;
  equity: number | string;
  margin: number | string;
  free_margin: number | string;
  leverage: number | string;
  currency: string;
  status: string;
  created_at: string;
}

export interface AdminUserActivityItem {
  type: string;
  action: string;
  symbol: string | null;
  created_at: string;
}

export interface AdminUserDetail {
  user: AdminUserDetailUser;
  accounts: AdminUserAccountSummary[];
  activity: AdminUserActivityItem[];
}

export interface AdminCreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  role: 'user' | 'admin' | 'manager' | 'support';
  emailVerified: boolean;
  kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected';
}

export interface AdminUpdateVerificationPayload {
  verified: boolean;
  reason?: string | null;
}

export interface AdminDashboardStats {
  users: {
    total_users: number;
    new_users_30d: number;
    active_users: number;
    verified_users: number;
  };
  trading: {
    total_accounts: number;
    total_balance: number;
    total_equity: number;
    new_accounts_30d: number;
  };
  transactions: {
    total_deposits: number;
    total_withdrawals: number;
    pending_deposits: number;
    pending_withdrawals: number;
  };
  positions: {
    total_positions: number;
    open_positions: number;
    total_profits: number;
    total_losses: number;
  };
  support: {
    total_tickets: number;
    open_tickets: number;
    pending_tickets: number;
    new_tickets_7d: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptTerms: boolean;
}

// Trading Types
export interface TradingAccount {
  id: number;
  userId: number;
  accountNumber: string;
  accountType: 'demo' | 'live' | 'islamic';
  balance: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  currency: string;
  status: 'active' | 'inactive' | 'frozen' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: number;
  accountId: number;
  symbolId: number;
  symbol: string;
  symbolName: string;
  
  // Position type (backend and frontend compatibility)
  side: 'buy' | 'sell'; // Backend uses 'side'
  positionType?: 'buy' | 'sell'; // For backward compatibility
  
  // Volume/Lot size (backend and frontend compatibility)
  lotSize: number; // Backend uses 'lotSize'
  volume?: number; // For backward compatibility
  
  // Pricing
  openPrice: number;
  currentPrice?: number;
  closePrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  
  // Costs and P&L
  commission: number;
  swap: number;
  profit: number; // Backend uses 'profit' - gross profit
  profitLoss?: number; // For backward compatibility
  unrealizedPnl?: number; // For open positions
  netProfit?: number; // After commission and swap
  
  // Calculated fields for statistics
  grossProfit?: number; // Positive profit only
  grossLoss?: number; // Absolute value of negative profit
  
  // Status and metadata
  status: 'open' | 'closed' | 'pending';
  comment?: string;
  magicNumber?: number;
  accountNumber?: string;
  
  // Timestamps (backend and frontend compatibility)
  openedAt: string; // Backend uses 'openedAt'
  updatedAt?: string;
  closedAt?: string; // Backend uses 'closedAt'
  openTime?: string; // For backward compatibility
  closeTime?: string; // For backward compatibility
}

export interface MarketData {
  id: number;
  symbolId: number;
  symbol: string;
  name: string;
  category: string;
  currentPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
  change: number;
  changePercent: number;
  bid?: number;
  ask?: number;
  spread?: number;
  date: string;
}

export interface Symbol {
  id: number;
  symbol: string;
  name: string;
  category: string;
  description?: string;
  minVolume: number;
  maxVolume: number;
  stepVolume: number;
  contractSize: number;
  tickSize: number;
  tickValue: number;
  swapLong: number;
  swapShort: number;
  commission: number;
  marginRate: number;
  isActive: boolean;
}

// Transaction Types
export interface Transaction {
  id: number;
  transactionId: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  status: 'pending' | 'completed' | 'rejected' | 'cancelled';
  paymentMethod: string;
  paymentReference?: string;
  userNotes?: string;
  adminNotes?: string;
  createdAt: string;
  processedAt?: string;
  accountNumber: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  type: string;
  provider: string;
  supportedCurrencies: string[];
  minAmount: number;
  maxAmount?: number;
  depositFeeType: 'fixed' | 'percentage';
  depositFeeValue: number;
  withdrawalFeeType: 'fixed' | 'percentage';
  withdrawalFeeValue: number;
  processingTimeHours: number;
}

// Notification Types
export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'trading' | 'transaction' | 'price_alert';
  data?: unknown;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface PriceAlert {
  id: number;
  symbolId: number;
  symbol: string;
  targetPrice: number;
  alertType: 'above' | 'below';
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'market_update' | 'positions_update' | 'notification' | 'price_alert' | 'error' | 'balance_update';
  data?: unknown;
  timestamp: string;
  userId?: number;
  accountId?: number;
}

// Error Types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

// Request/Response Interfaces
export interface CreatePositionRequest {
  accountId: number;
  symbolId: number;
  side: 'buy' | 'sell';
  lotSize: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  comment?: string;
}

export interface CreateTransactionRequest {
  accountId: number;
  paymentMethodId: number;
  amount: number;
  currency: string;
  paymentReference?: string;
  userNotes?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: {
    country?: string;
    state?: string;
    city?: string;
    addressLine1?: string;
    addressLine2?: string;
    postalCode?: string;
  };
}

// Filter/Query Types
export interface PositionsFilter {
  status?: 'open' | 'closed' | 'all';
  symbol?: string;
  accountId?: number;
  page?: number;
  limit?: number;
}

export interface TransactionsFilter {
  type?: 'deposit' | 'withdrawal';
  status?: string;
  page?: number;
  limit?: number;
}

export interface MarketDataFilter {
  category?: string;
  search?: string;
  sortBy?: 'symbol' | 'price' | 'change' | 'volume';
  sortOrder?: 'asc' | 'desc';
}

// Dashboard Stats Types
export interface TradingStats {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgPnl: number;
  totalVolume: number;
  winRate: number;
}

export interface AccountSummary {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  totalPositions: number;
  openPositions: number;
  todayPnl: number;
  totalPnl: number;
}

export interface MarketStats {
  totalSymbols: number;
  gainers: number;
  losers: number;
  unchanged: number;
  totalVolume: number;
  avgVolume: number;
}

// Settings Types
export interface UserSettings {
  notifications: {
    email: boolean;
    push: boolean;
    trading: boolean;
    priceAlerts: boolean;
    marketing: boolean;
  };
  trading: {
    defaultLeverage: number;
    autoCloseMarginCall: boolean;
    confirmOrders: boolean;
    showUnrealizedPnl: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    timezone: string;
    currency: string;
  };
}