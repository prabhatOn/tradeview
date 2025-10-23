/* eslint-disable @typescript-eslint/no-explicit-any */
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
  preferredLeverage?: number | string | null;
  preferred_leverage?: number | string | null;
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
  hasIb?: boolean | number | null;
  has_ib?: boolean | number | null;
  ibApplicationStatus?: string | null;
  ib_application_status?: string | null;
  ibApplicationUpdatedAt?: string | null;
  ib_application_updated_at?: string | null;
  ibApplicationCreatedAt?: string | null;
  ib_application_created_at?: string | null;
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
  hasIb?: boolean | number | null;
  ib_application_status?: string | null;
  ibApplicationStatus?: string | null;
  ib_application_updated_at?: string | null;
  ibApplicationUpdatedAt?: string | null;
  ib_application_created_at?: string | null;
  ibApplicationCreatedAt?: string | null;
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
  auto_square_percent?: number | null;
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
  systemHealth?: AdminDashboardSystemHealth;
  highlights?: AdminDashboardHighlights;
  alerts?: AdminDashboardAlert[];
  recentActivity?: AdminDashboardActivityItem[];
}

export type AdminDashboardAlertType = 'info' | 'warning' | 'critical' | 'success';

export interface AdminDashboardAlert {
  type: AdminDashboardAlertType;
  title: string;
  description?: string;
  value?: number;
  timestamp: string;
}

export interface AdminDashboardSystemHealth {
  serverStatus: string;
  databaseStatus: string;
  apiLatencyMs?: number;
  activeUsers: number;
  activeAccounts: number;
  openPositions: number;
  pendingTransactions: number;
  openSupportTickets: number;
  generatedAt: string;
  pendingDeposits?: number;
  pendingWithdrawals?: number;
  pendingIbApplications?: number;
  pendingUserVerifications?: number;
}

export interface AdminDashboardHighlights {
  timeframe: string;
  newRegistrations: number;
  completedTrades: number;
  withdrawalsProcessed: number;
  depositsProcessed: number;
}

export interface AdminDashboardActivityItem {
  type: string;
  action: string;
  subject: string;
  status: 'success' | 'warning' | 'info' | 'critical';
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AdminFundsSummary {
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalBalances: number;
  totalUsers: number;
}

export interface AdminFundsActivityItem {
  id: number;
  type: 'deposit' | 'withdrawal';
  transaction_id: string;
  email: string;
  account_number: string;
  amount: number | string;
  net_amount: number | string;
  status: string;
  created_at: string;
}

export interface AdminFundsOverview {
  summary: AdminFundsSummary;
  recentActivity: AdminFundsActivityItem[];
}

export type AdminFundsTransactionStatus =
  | 'pending'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'failed'
  | string;

export interface AdminFundsTransactionRow {
  id: number;
  transaction_id: string;
  amount: number | string;
  fee: number | string;
  net_amount: number | string;
  status: AdminFundsTransactionStatus;
  payment_reference?: string | null;
  user_notes?: string | null;
  admin_notes?: string | null;
  review_notes?: string | null;
  created_at: string;
  processed_at?: string | null;
  reviewed_at?: string | null;
  processed_by?: number | null;
  reviewed_by?: number | null;
  batch_reference?: string | null;
  payment_method_name?: string | null;
  payment_method_type?: string | null;
  email: string;
  user_name?: string | null;
  account_number: string;
  // Bank details (for withdrawals)
  bank_name?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  account_type?: string | null;
  iban?: string | null;
  swift_code?: string | null;
  routing_number?: string | null;
  branch_name?: string | null;
}

export interface AdminFundsTransactionsResponse {
  rows: AdminFundsTransactionRow[];
  pagination: PaginationInfo;
}

export interface AdminFundsChartPoint {
  activityDate: string;
  totalDeposits: number | string;
  totalWithdrawals: number | string;
}

export interface AdminSymbolChargeRow {
  id: number;
  symbol: string;
  name: string;
  commissionPerLot: number;
  swapLong: number;
  swapShort: number;
  spreadMarkup: number;
  contractSize: number;
  pipSize: number;
  marginRequirement: number;
  status: string;
}

export interface AdminTradingBrokerageTier {
  commission: number;
  spreadMarkup: number;
  unit?: string;
}

export interface AdminTradingBrokerageRates {
  standard: AdminTradingBrokerageTier;
  vip: AdminTradingBrokerageTier;
}

export interface AdminTradingLeverageSettings {
  defaultLeverage: number;
  maxLeverage: number;
}

export interface AdminTradingChargesResponseData {
  symbols: AdminSymbolChargeRow[];
  brokerage: AdminTradingBrokerageRates;
  leverage: AdminTradingLeverageSettings;
}

export interface AdminTradingUserAccountSummary {
  accountId: number;
  accountNumber: string;
  accountType: string;
  leverage: number;
  status: string;
  updatedAt?: string | null;
}

export interface AdminTradingUserLeverageRow {
  userId: number;
  email: string;
  name: string;
  preferredLeverage: number;
  updatedAt?: string | null;
  accounts: AdminTradingUserAccountSummary[];
}

export interface AdminTradingUserLeverageResponse {
  rows: AdminTradingUserLeverageRow[];
  pagination: PaginationInfo;
}

export interface AdminUpdateSymbolChargePayload {
  commissionPerLot?: number;
  swapLong?: number;
  swapShort?: number;
  spreadMarkup?: number;
  marginRequirement?: number;
  status?: 'active' | 'inactive';
}

export interface AdminBrokerageUpdateTierPayload {
  commission: number;
  spreadMarkup: number;
  commissionUnit?: 'per_lot' | 'percentage' | 'fixed';
  spreadUnit?: 'pips' | 'per_lot' | 'fixed' | 'percentage';
}

export interface AdminBrokerageUpdatePayload {
  accountType?: string;
  standard?: AdminBrokerageUpdateTierPayload;
  vip?: AdminBrokerageUpdateTierPayload;
}

export interface AdminLeverageUpdatePayload {
  defaultLeverage?: number;
  maxLeverage?: number;
}

export interface AdminUpdateUserLeveragePayload {
  preferredLeverage: number;
}

export interface AdminTradingOverview {
  openPositions: number;
  openPnL: number;
  openVolume: number;
  closedPositions: number;
  closedPnL: number;
  closedVolume: number;
  totalVolume: number;
  totalCommission: number;
  totalSwap: number;
  netPnL: number;
}

export interface AdminTradingPosition {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  user?: {
    id: number;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  accountId: number;
  accountNumber: string;
  symbolId: number;
  symbol: string;
  symbolName: string;
  side: 'buy' | 'sell';
  lotSize: number;
  openPrice: number;
  currentPrice: number | null;
  closePrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  commission: number;
  swap: number;
  profit: number;
  netProfit: number;
  unrealizedPnl: number;
  grossProfit: number;
  grossLoss: number;
  status: 'open' | 'closed' | 'pending';
  comment?: string | null;
  openedAt: string;
  updatedAt?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
}

export interface AdminTradingPositionsResponse {
  rows: AdminTradingPosition[];
  pagination: PaginationInfo;
  summary: {
    totalVolume: number;
    totalProfit: number;
    totalCommission: number;
    netProfit: number;
  };
}

export interface AdminTradingHistoryItem {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  accountId: number;
  accountNumber: string;
  symbolId: number;
  symbol: string;
  symbolName: string;
  side: 'buy' | 'sell';
  lotSize: number;
  openPrice: number;
  closePrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  commission: number;
  swap: number;
  profit: number;
  netProfit: number;
  closeReason: string | null;
  openedAt: string;
  closedAt: string;
  durationMinutes: number | null;
}

export interface AdminTradingHistoryResponse {
  rows: AdminTradingHistoryItem[];
  pagination: PaginationInfo;
  summary: {
    totalVolume: number;
    totalProfit: number;
    totalCommission: number;
    totalSwap: number;
    netProfit: number;
  };
}

export interface AdminTradingAccount {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  accountNumber: string;
  accountType: string;
  status: string;
  currency: string;
  leverage: number;
  balance: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTradingAccountsResponse {
  rows: AdminTradingAccount[];
  pagination: PaginationInfo;
}

// Payment Gateway & Funding Types
export interface PaymentGateway {
  id: number;
  name: string;
  displayName?: string;
  display_name?: string;
  type: 'bank_transfer' | 'credit_card' | 'debit_card' | 'crypto' | 'e_wallet' | 'wire_transfer' | string;
  provider?: string | null;
  isActive?: boolean | number;
  is_active?: boolean | number;
  minAmount?: number | string;
  min_amount?: number | string;
  maxAmount?: number | string;
  max_amount?: number | string;
  processingFeeType?: 'fixed' | 'percentage' | string;
  processing_fee_type?: 'fixed' | 'percentage' | string;
  processingFeeValue?: number | string;
  processing_fee_value?: number | string;
  processingTimeHours?: number | string;
  processing_time_hours?: number | string;
  supportedCurrencies?: string[];
  supported_currencies?: string;
  description?: string | null;
  iconUrl?: string | null;
  icon_url?: string | null;
  configuration?: Record<string, any> | string;
  sortOrder?: number | string;
  sort_order?: number | string;
  total_deposits?: number | string;
  total_withdrawals?: number | string;
  total_deposit_volume?: number | string;
  total_withdrawal_volume?: number | string;
  created_at?: string;
  updated_at?: string;
}

export interface BankAccount {
  id: number;
  paymentGatewayId?: number | null;
  payment_gateway_id?: number | null;
  label: string;
  bankName: string;
  bank_name?: string;
  accountName: string;
  account_name?: string;
  accountNumber: string;
  account_number?: string;
  accountType?: 'personal' | 'business' | string | null;
  account_type?: 'personal' | 'business' | string | null;
  iban?: string | null;
  swiftCode?: string | null;
  swift_code?: string | null;
  routingNumber?: string | null;
  routing_number?: string | null;
  branchName?: string | null;
  branch_name?: string | null;
  branchAddress?: string | null;
  branch_address?: string | null;
  country?: string | null;
  currency: string;
  instructions?: string | null;
  currentBalance?: number | string;
  current_balance?: number | string;
  metadata?: Record<string, any> | string;
  isActive?: boolean | number;
  is_active?: boolean | number;
  sortOrder?: number | string;
  sort_order?: number | string;
  gatewayDisplayName?: string | null;
  gateway_display_name?: string | null;
  gatewayType?: string | null;
  gateway_type?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FundingMethod {
  id: number;
  type: string;
  name: string;
  provider?: string | null;
  depositLimits: { min: number; max: number };
  withdrawalLimits: { min: number; max: number };
  processingTime: string;
  processingTimeHours?: number | null;
  fees: { deposit: string | number; withdrawal: string | number };
  supportedCurrencies: string[];
  configuration?: Record<string, any>;
  description?: string | null;
  iconUrl?: string | null;
  available: boolean;
}

export interface FundingMethodsPayload {
  methods: FundingMethod[];
  bankAccounts: BankAccount[];
}

export interface AdminTradingSymbol {
  id: number;
  symbol: string;
  name: string;
}

export interface AdminTradingSymbolsResponse {
  rows: AdminTradingSymbol[];
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
  referralCode?: string;
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
  usedMargin: number;
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
  // Order related (limit/pending)
  orderType?: 'market' | 'limit' | 'stop';
  triggerPrice?: number | null;
  
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
export interface IbCommissionMessageData {
  commissionId: number;
  tradeId: number;
  positionId: number;
  clientUserId: number;
  commissionAmount: number;
  commissionRate: number;
  tradeVolume: number;
  profit: number;
  symbol: string;
  side: 'buy' | 'sell';
  lotSize: number;
  closedAt: string;
}

export interface WebSocketMessage {
  type:
    | 'market_update'
    | 'positions_update'
  | 'realtime_positions_update'
    | 'notification'
    | 'price_alert'
    | 'error'
    | 'balance_update'
  | 'ib_commission_recorded'
  | 'market_prices_update';
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