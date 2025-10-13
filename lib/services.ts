/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiClient } from './api-client';
import {
  User,
  TradingAccount,
  Position,
  MarketData,
  Symbol,
  Transaction,
  PaymentMethod,
  Notification,
  PriceAlert,
  TradingStats,
  MarketStats,
  UserSettings,
  CreatePositionRequest,
  CreateTransactionRequest,
  PositionsFilter,
  TransactionsFilter,
  MarketDataFilter,
  PaginationResponse,
  ApiResponse,
  AdminUsersResponse,
  AdminDashboardStats,
  AdminCreateUserPayload,
  AdminUpdateVerificationPayload,
  AdminUserDetail,
  AdminFundsOverview,
  AdminFundsTransactionsResponse,
  AdminFundsChartPoint,
  AdminTradingOverview,
  AdminTradingPositionsResponse,
  AdminTradingHistoryResponse,
  AdminTradingAccountsResponse,
  AdminTradingPosition,
  AdminTradingChargesResponseData,
  AdminTradingBrokerageRates,
  AdminTradingLeverageSettings,
  AdminSymbolChargeRow,
  AdminUpdateSymbolChargePayload,
  AdminBrokerageUpdatePayload,
  AdminLeverageUpdatePayload,
  PaymentGateway,
  BankAccount,
  FundingMethodsPayload
} from './types';

type CreatePaymentGatewayPayload = {
  name: string;
  displayName: string;
  type: PaymentGateway['type'];
  provider?: string | null;
  minAmount?: number;
  maxAmount?: number;
  processingFeeType?: 'fixed' | 'percentage';
  processingFeeValue?: number;
  processingTimeHours?: number;
  supportedCurrencies?: string[];
  description?: string | null;
  iconUrl?: string | null;
  configuration?: Record<string, any>;
};

type UpdatePaymentGatewayPayload = Partial<Omit<CreatePaymentGatewayPayload, 'name' | 'type'>> & {
  isActive?: boolean;
  sortOrder?: number;
};

type CreateBankAccountPayload = {
  label: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType?: 'personal' | 'business';
  iban?: string | null;
  swiftCode?: string | null;
  routingNumber?: string | null;
  branchName?: string | null;
  branchAddress?: string | null;
  country?: string | null;
  currency?: string;
  instructions?: string | null;
  isActive?: boolean;
  paymentGatewayId?: number | null;
  currentBalance?: number;
  metadata?: Record<string, any>;
};

type UpdateBankAccountPayload = Partial<CreateBankAccountPayload> & {
  sortOrder?: number;
};

// Authentication Services
export const authService = {
  login: (credentials: { email: string; password: string }) =>
    apiClient.login(credentials),
  
  register: (userData: { email: string; password: string; firstName: string; lastName: string; phone?: string; referralCode?: string; acceptTerms: boolean }) =>
    apiClient.register(userData),
  
  logout: () => apiClient.logout(),
  
  getProfile: () => apiClient.getProfile(),
  
  updateProfile: (data: any) => apiClient.updateProfile(data),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.changePassword(currentPassword, newPassword),
};

// User Services
export const userService = {
  getProfile: (): Promise<ApiResponse<User>> =>
    apiClient.get('/users/profile'),
  
  updateProfile: (data: any): Promise<ApiResponse<User>> =>
    apiClient.put('/users/profile', data),
  
  getTradingAccounts: (): Promise<ApiResponse<TradingAccount[]>> =>
    apiClient.get('/trading/accounts'),
  
  createTradingAccount: (data: { accountType: string; currency: string; leverage: number }): Promise<ApiResponse<TradingAccount>> =>
    apiClient.post('/trading/accounts', data),
  
  getSettings: (): Promise<ApiResponse<UserSettings>> =>
    apiClient.get('/users/settings'),
  
  updateSettings: (settings: Partial<UserSettings>): Promise<ApiResponse<UserSettings>> =>
    apiClient.put('/users/settings', settings),
  
  getNotifications: (page = 1, limit = 20, unreadOnly = false): Promise<ApiResponse<PaginationResponse<Notification>>> =>
    apiClient.get('/users/notifications', { page, limit, unreadOnly }),
  
  markNotificationAsRead: (id: number): Promise<ApiResponse<void>> =>
    apiClient.patch(`/users/notifications/${id}/read`),
  
  markAllNotificationsAsRead: (): Promise<ApiResponse<void>> =>
    apiClient.patch('/users/notifications/read-all'),
  
  getPriceAlerts: (): Promise<ApiResponse<PriceAlert[]>> =>
    apiClient.get('/users/price-alerts'),
  
  createPriceAlert: (data: { symbolId: number; targetPrice: number; alertType: 'above' | 'below' }): Promise<ApiResponse<PriceAlert>> =>
    apiClient.post('/users/price-alerts', data),
  
  deletePriceAlert: (id: number): Promise<ApiResponse<void>> =>
    apiClient.delete(`/users/price-alerts/${id}`),
};

// Trading Services
export const tradingService = {
  // Get trading accounts
  getTradingAccounts: (): Promise<ApiResponse<TradingAccount[]>> =>
    apiClient.get('/trading/accounts'),
  
  // Get specific account details
  getAccountDetails: (accountId: number): Promise<ApiResponse<any>> =>
    apiClient.get(`/trading/accounts/${accountId}`),
  
  // Get positions
  getPositions: (filter: PositionsFilter = {}): Promise<ApiResponse<Position[]>> =>
    apiClient.get('/trading/positions', filter),
  
  // Get specific position
  getPosition: (id: number): Promise<ApiResponse<Position>> =>
    apiClient.get(`/trading/positions/${id}`),
  
  // Open new position
  openPosition: (data: CreatePositionRequest): Promise<ApiResponse<Position>> =>
    apiClient.post('/trading/positions', data),
  
  // Update position (modify SL/TP)
  updatePosition: (id: number, data: { stopLoss?: number | null; takeProfit?: number | null }): Promise<ApiResponse<Position>> =>
    apiClient.patch(`/trading/positions/${id}`, data),
  
  // Close position
  closePosition: (id: number, closeReason: string = 'manual'): Promise<ApiResponse<{ positionId: number; closePrice: number; finalProfit: number; closeReason: string }>> =>
    apiClient.delete(`/trading/positions/${id}`, { closeReason }),
  
  // Get trading history
  getTradingHistory: (accountId?: number, page = 1, limit = 50): Promise<ApiResponse<any>> =>
    apiClient.get('/trading/history', { accountId, page, limit }),
  
  // Get trading performance/statistics
  getTradingStats: (accountId?: number, period?: string): Promise<ApiResponse<TradingStats>> =>
    apiClient.get('/trading/performance', { accountId, period }),
  
  // Get account summary (alias for getAccountDetails)
  getAccountSummary: (accountId: number): Promise<ApiResponse<any>> =>
    apiClient.get(`/trading/accounts/${accountId}`),
};

// Market Data Services
export const marketService = {
  getMarketOverview: (filter: MarketDataFilter = {}): Promise<ApiResponse<MarketData[]>> =>
    apiClient.get('/market/overview', filter),
  
  getMarketCategories: (): Promise<ApiResponse<Array<{ value: string; label: string; count: number }>>> =>
    apiClient.get('/market/categories'),
  
  getSymbol: (id: number): Promise<ApiResponse<Symbol>> =>
    apiClient.get(`/market/symbols/${id}`),
  
  getSymbolByName: (symbol: string): Promise<ApiResponse<Symbol>> =>
    apiClient.get(`/market/symbols/by-name/${symbol}`),
  
  getSymbolHistory: (id: number, timeframe = '1D', limit = 100): Promise<ApiResponse<MarketData[]>> =>
    apiClient.get(`/market/symbols/${id}/history`, { timeframe, limit }),
  
  getRealTimePrices: (symbolIds: number[]): Promise<ApiResponse<MarketData[]>> =>
    apiClient.get('/market/prices', { symbols: symbolIds.join(',') }),
  
  getTradingSessions: (symbolId: number): Promise<ApiResponse<any[]>> =>
    apiClient.get(`/market/symbols/${symbolId}/sessions`),
  
  getMarketStats: (): Promise<ApiResponse<MarketStats>> =>
    apiClient.get('/market/stats'),
  
  searchSymbols: (query: string): Promise<ApiResponse<Symbol[]>> =>
    apiClient.get('/market/search', { q: query }),
};

// Transaction Services
export const transactionService = {
  getTransactionHistory: (filter: TransactionsFilter = {}): Promise<ApiResponse<PaginationResponse<Transaction>>> =>
    apiClient.get('/transactions/history', filter),
  
  getPaymentMethods: (): Promise<ApiResponse<{ paymentMethods: PaymentMethod[] }>> =>
    apiClient.get('/transactions/payment-methods'),
  
  createDeposit: (data: CreateTransactionRequest): Promise<ApiResponse<{ deposit: any }>> =>
    apiClient.post('/transactions/deposits', data),
  
  createWithdrawal: (data: CreateTransactionRequest): Promise<ApiResponse<{ withdrawal: any }>> =>
    apiClient.post('/transactions/withdrawals', data),
  
  getTransaction: (type: 'deposits' | 'withdrawals', id: number): Promise<ApiResponse<{ transaction: Transaction }>> =>
    apiClient.get(`/transactions/${type}/${id}`),
  
  cancelTransaction: (type: 'deposits' | 'withdrawals', id: number): Promise<ApiResponse<void>> =>
    apiClient.delete(`/transactions/${type}/${id}`),
  
  getTransactionSummary: (): Promise<ApiResponse<{
    deposits: any;
    withdrawals: any;
    recent: any;
  }>> =>
    apiClient.get('/transactions/summary'),
};

export const fundsService = {
  getFundingMethods: (): Promise<ApiResponse<FundingMethodsPayload>> =>
    apiClient.get('/funds/methods'),
};

// Admin Services (for admin users)
export const adminService = {
  getDashboardStats: (): Promise<ApiResponse<AdminDashboardStats>> =>
    apiClient.get('/admin/dashboard'),

  getFundsOverview: (): Promise<ApiResponse<AdminFundsOverview>> =>
    apiClient.get('/admin/funds/overview'),

  getFundsChart: (range: '7d' | '14d' | '30d' | '90d' = '30d'): Promise<ApiResponse<AdminFundsChartPoint[]>> =>
    apiClient.get('/admin/funds/chart', { range }),

  getFundsTransactions: (params: {
    type?: 'deposits' | 'withdrawals';
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<AdminFundsTransactionsResponse>> =>
    apiClient.get('/admin/funds/transactions', params),

  approveFundsDeposit: (
    id: number,
    payload: { notes?: string; adminNotes?: string } = {}
  ): Promise<ApiResponse<any>> => apiClient.post(`/admin/funds/deposits/${id}/approve`, payload),

  rejectFundsDeposit: (
    id: number,
    payload: { notes?: string; adminNotes?: string } = {}
  ): Promise<ApiResponse<any>> => apiClient.post(`/admin/funds/deposits/${id}/reject`, payload),

  approveFundsWithdrawal: (
    id: number,
    payload: { notes?: string; adminNotes?: string } = {}
  ): Promise<ApiResponse<any>> => apiClient.post(`/admin/funds/withdrawals/${id}/approve`, payload),

  rejectFundsWithdrawal: (
    id: number,
    payload: { notes?: string; adminNotes?: string } = {}
  ): Promise<ApiResponse<any>> => apiClient.post(`/admin/funds/withdrawals/${id}/reject`, payload),

  batchProcessFunds: (
    payload: {
      action: 'approve' | 'reject';
      type: 'deposits' | 'withdrawals';
      ids: number[];
      notes?: string;
    }
  ): Promise<ApiResponse<any>> => apiClient.post('/admin/funds/batch', payload),

  applyFundsManualAdjustment: (
    payload: {
      accountId: number;
      amount: number;
      direction?: 'credit' | 'debit';
      reasonCode?: string;
      notes?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ApiResponse<any>> => apiClient.post('/admin/funds/adjustments', payload),

  exportFundsTransactions: (params: {
    type?: 'deposits' | 'withdrawals';
    status?: string;
    search?: string;
  } = {}): Promise<ApiResponse<{ rows: any[]; generatedAt: string }>> =>
    apiClient.get('/admin/funds/export', params),
  
  getUsers: (params: Record<string, unknown> = {}): Promise<ApiResponse<AdminUsersResponse>> =>
    apiClient.get('/admin/users', params),
  
  getUser: (id: number): Promise<ApiResponse<AdminUserDetail>> =>
    apiClient.get(`/admin/users/${id}`),
  
  updateUserStatus: (id: number, status: string, reason?: string): Promise<ApiResponse<void>> =>
    apiClient.patch(`/admin/users/${id}/status`, { status, reason }),

  updateUserVerification: (id: number, payload: AdminUpdateVerificationPayload): Promise<ApiResponse<void>> =>
    apiClient.patch(`/admin/users/${id}/verification`, payload),

  createUser: (payload: AdminCreateUserPayload): Promise<ApiResponse<{ user: User }>> =>
    apiClient.post('/admin/users', payload),

  deleteUser: (id: number, reason?: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/admin/users/${id}`, reason ? { reason } : undefined),
  
  getPendingTransactions: (type?: string): Promise<ApiResponse<{ transactions: Transaction[] }>> =>
    apiClient.get('/admin/transactions/pending', type ? { type } : {}),
  
  processDeposit: (id: number, action: 'approve' | 'reject', adminNotes?: string): Promise<ApiResponse<void>> =>
    apiClient.patch(`/admin/deposits/${id}/process`, { action, adminNotes }),
  
  processWithdrawal: (id: number, action: 'approve' | 'reject', adminNotes?: string): Promise<ApiResponse<void>> =>
    apiClient.patch(`/admin/withdrawals/${id}/process`, { action, adminNotes }),
  
  getSupportTickets: (params: any = {}): Promise<ApiResponse<PaginationResponse<any>>> =>
    apiClient.get('/admin/support', params),
  
  assignTicket: (id: number, adminId?: number): Promise<ApiResponse<void>> =>
    apiClient.patch(`/admin/support/${id}/assign`, { adminId }),
  
  updateTicketStatus: (id: number, status: string): Promise<ApiResponse<void>> =>
    apiClient.patch(`/admin/support/${id}/status`, { status }),
  
  getTradingStats: (range = '30'): Promise<ApiResponse<any>> =>
    apiClient.get('/admin/trading/stats', { range }),

  getTradingOverview: (): Promise<ApiResponse<AdminTradingOverview>> =>
  apiClient.get('/admin/trading/overview'),

  getTradingCharges: (): Promise<ApiResponse<AdminTradingChargesResponseData>> =>
    apiClient.get('/admin/trading/charges'),

  updateTradingSymbolCharges: (symbolId: number, payload: AdminUpdateSymbolChargePayload): Promise<ApiResponse<AdminSymbolChargeRow>> =>
    apiClient.patch(`/admin/trading/charges/symbols/${symbolId}`, payload),

  updateTradingBrokerageRates: (payload: AdminBrokerageUpdatePayload): Promise<ApiResponse<AdminTradingBrokerageRates>> =>
    apiClient.put('/admin/trading/charges/brokerage', payload),

  updateTradingLeverageSettings: (payload: AdminLeverageUpdatePayload): Promise<ApiResponse<AdminTradingLeverageSettings>> =>
    apiClient.patch('/admin/trading/charges/leverage', payload),

  getTradingPositions: (params: {
    status?: 'open' | 'closed' | 'all';
    search?: string;
    symbol?: string;
    side?: 'buy' | 'sell';
    page?: number;
    limit?: number;
    sortBy?: 'opened_at' | 'closed_at' | 'profit' | 'lot_size' | 'symbol' | 'user' | 'account' | 'status';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<AdminTradingPositionsResponse>> =>
    apiClient.get('/admin/trading/positions', params),

  getTradingPosition: (id: number): Promise<ApiResponse<AdminTradingPosition>> =>
    apiClient.get(`/admin/trading/positions/${id}`),

  updateTradingPosition: (id: number, payload: {
    lotSize?: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    comment?: string | null;
  }): Promise<ApiResponse<AdminTradingPosition>> =>
    apiClient.patch(`/admin/trading/positions/${id}`, payload),

  closeTradingPosition: (id: number, payload: {
    closePrice?: number;
    closeReason?: 'manual' | 'stop_loss' | 'take_profit' | 'system' | 'margin_call';
  } = {}): Promise<ApiResponse<{ positionId: number; finalProfit: number; closePrice: number; closeReason?: string }>> =>
    apiClient.post(`/admin/trading/positions/${id}/close`, payload),

  openTradingPosition: (payload: {
    accountId: number;
    symbolId: number;
    side: 'buy' | 'sell';
    lotSize: number;
    stopLoss?: number | null;
    takeProfit?: number | null;
    comment?: string | null;
  }): Promise<ApiResponse<AdminTradingPosition>> =>
    apiClient.post('/admin/trading/positions', payload),

  getTradingHistory: (params: {
    search?: string;
    symbol?: string;
    side?: 'buy' | 'sell';
    accountId?: number;
    userId?: number;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'closed_at' | 'profit' | 'lot_size' | 'symbol' | 'user' | 'account';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<AdminTradingHistoryResponse>> =>
    apiClient.get('/admin/trading/history', params),

  getTradingAccounts: (params: {
    search?: string;
    status?: 'active' | 'inactive' | 'frozen' | 'closed';
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<AdminTradingAccountsResponse>> =>
    apiClient.get('/admin/trading/accounts', params),

  getPaymentGateways: (): Promise<ApiResponse<PaymentGateway[]>> =>
    apiClient.get('/payment-gateways/admin'),

  createPaymentGateway: (payload: CreatePaymentGatewayPayload): Promise<ApiResponse<{ id: number; message?: string }>> =>
    apiClient.post('/payment-gateways/admin', payload),

  updatePaymentGateway: (id: number, payload: UpdatePaymentGatewayPayload): Promise<ApiResponse<any>> =>
    apiClient.put(`/payment-gateways/admin/${id}`, payload),

  deletePaymentGateway: (id: number): Promise<ApiResponse<void>> =>
    apiClient.delete(`/payment-gateways/admin/${id}`),

  togglePaymentGateway: (id: number): Promise<ApiResponse<any>> =>
    apiClient.patch(`/payment-gateways/admin/${id}/toggle`),

  reorderPaymentGateways: (gatewayIds: number[]): Promise<ApiResponse<void>> =>
    apiClient.post('/payment-gateways/admin/reorder', { gatewayIds }),

  getBankAccounts: (): Promise<ApiResponse<BankAccount[]>> =>
    apiClient.get('/payment-gateways/admin/banks'),

  createBankAccount: (payload: CreateBankAccountPayload): Promise<ApiResponse<{ id: number }>> =>
    apiClient.post('/payment-gateways/admin/banks', payload),

  updateBankAccount: (id: number, payload: UpdateBankAccountPayload): Promise<ApiResponse<void>> =>
    apiClient.put(`/payment-gateways/admin/banks/${id}`, payload),

  deleteBankAccount: (id: number): Promise<ApiResponse<void>> =>
    apiClient.delete(`/payment-gateways/admin/banks/${id}`),

  toggleBankAccount: (id: number): Promise<ApiResponse<any>> =>
    apiClient.patch(`/payment-gateways/admin/banks/${id}/toggle`),

  reorderBankAccounts: (bankIds: number[]): Promise<ApiResponse<void>> =>
    apiClient.post('/payment-gateways/admin/banks/reorder', { bankIds }),
  
  getSystemSettings: (): Promise<ApiResponse<{ settings: any }>> =>
    apiClient.get('/admin/settings'),
  
  updateSystemSettings: (settings: any): Promise<ApiResponse<void>> =>
    apiClient.patch('/admin/settings', { settings }),
};

// API Keys Management Services (One API key per user)
export const apiKeysService = {
  // Get user's personal API key
  getApiKey: (): Promise<ApiResponse<any>> =>
    apiClient.get('/api-keys'),
    
  // Create user's personal API key
  createApiKey: (data: {
    ipWhitelist?: string[];
  }): Promise<ApiResponse<any>> =>
    apiClient.post('/api-keys', data),
    
  // Update user's personal API key
  updateApiKey: (data: {
    isActive?: boolean;
    ipWhitelist?: string[];
  }): Promise<ApiResponse<void>> =>
    apiClient.put('/api-keys', data),
    
  // Delete user's personal API key
  deleteApiKey: (): Promise<ApiResponse<void>> =>
    apiClient.delete('/api-keys'),

  // Get API key usage statistics
  getApiKeyUsage: (): Promise<ApiResponse<any>> =>
    apiClient.get('/api-keys/usage'),
    
  getUsageStats: (keyId: number): Promise<ApiResponse<any>> =>
    apiClient.get(`/api-keys/${keyId}/usage`),
    
  regenerateSecret: (keyId: number): Promise<ApiResponse<any>> =>
    apiClient.post(`/api-keys/${keyId}/regenerate`),
};

// Introducing Broker Services
export const introducingBrokerService = {
  getDashboard: (): Promise<ApiResponse<any>> =>
    apiClient.get('/introducing-broker/dashboard'),
  getStatus: (): Promise<ApiResponse<any>> =>
    apiClient.get('/introducing-broker/status'),
  applyToBeIb: (): Promise<ApiResponse<any>> =>
    apiClient.post('/introducing-broker/apply', {}),
    
  getReferralCodes: (): Promise<ApiResponse<any[]>> =>
    apiClient.get('/introducing-broker/referral-codes'),
    
  createReferralCode: (data: {
    code?: string;
    maxUsage?: number;
    expiresAt?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.post('/introducing-broker/referral-codes', data),
    
  toggleReferralCode: (codeId: number): Promise<ApiResponse<void>> =>
    apiClient.patch(`/introducing-broker/referral-codes/${codeId}/toggle`),
    
  getClients: (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  } = {}): Promise<ApiResponse<any>> =>
    apiClient.get('/introducing-broker/clients', params),
    
  getClientTrades: (clientId: number, params: {
    page?: number;
    limit?: number;
  } = {}): Promise<ApiResponse<any>> =>
    apiClient.get(`/introducing-broker/clients/${clientId}/trades`, params),
    
  getCommissions: (params: {
    page?: number;
    limit?: number;
    status?: string;
    clientId?: number;
  } = {}): Promise<ApiResponse<any>> =>
    apiClient.get('/introducing-broker/commissions', params),
    
  requestPayout: (data: {
    amount: number;
    currency?: string;
    notes?: string;
  }): Promise<ApiResponse<any>> =>
    apiClient.post('/introducing-broker/commissions/request-payout', data),

  // Admin
  approveIb: (userId: number): Promise<ApiResponse<any>> =>
    apiClient.post('/introducing-broker/admin/approve', { userId }),
  revokeIb: (userId: number): Promise<ApiResponse<any>> =>
    apiClient.post('/introducing-broker/admin/revoke', { userId }),
};

// Payment Gateway Services
export const paymentGatewayService = {
  getGateways: (currency?: string): Promise<ApiResponse<any[]>> =>
    apiClient.get('/payment-gateways', currency ? { currency } : {}),
    
  // Admin endpoints
  getAllGateways: (): Promise<ApiResponse<any[]>> =>
    apiClient.get('/payment-gateways/admin'),
    
  createGateway: (data: {
    name: string;
    displayName: string;
    type: string;
    provider?: string;
    minAmount?: number;
    maxAmount?: number;
    processingFeeType?: string;
    processingFeeValue?: number;
    processingTimeHours?: number;
    supportedCurrencies?: string[];
    description?: string;
    iconUrl?: string;
    configuration?: any;
  }): Promise<ApiResponse<any>> =>
    apiClient.post('/payment-gateways/admin', data),
    
  updateGateway: (gatewayId: number, data: any): Promise<ApiResponse<void>> =>
    apiClient.put(`/payment-gateways/admin/${gatewayId}`, data),
    
  deleteGateway: (gatewayId: number): Promise<ApiResponse<void>> =>
    apiClient.delete(`/payment-gateways/admin/${gatewayId}`),
    
  toggleGateway: (gatewayId: number): Promise<ApiResponse<any>> =>
    apiClient.patch(`/payment-gateways/admin/${gatewayId}/toggle`),
    
  reorderGateways: (gatewayIds: number[]): Promise<ApiResponse<void>> =>
    apiClient.post('/payment-gateways/admin/reorder', { gatewayIds }),
    
  getGatewayStats: (gatewayId: number, period = '30d'): Promise<ApiResponse<any>> =>
    apiClient.get(`/payment-gateways/admin/${gatewayId}/stats`, { period }),
};

// Utility function to handle API errors
export const handleApiError = (error: any): string => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};