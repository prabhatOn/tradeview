"use client"

import { useState, FormEvent, useEffect } from "react"
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { useAuth } from '@/hooks/use-auth'
import { useTrading } from '@/contexts/TradingContext'
import { apiClient } from '@/lib/api-client'
import { TradingSidebar } from "@/components/trading-sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DownloadCloud, UploadCloud, ArrowRight, Bell, CheckCircle, AlertTriangle, Clock, ArrowDown, ArrowUp, TrendingUp, TrendingDown, DollarSign, Wallet, CreditCard, Banknote } from "lucide-react"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

interface FundingMethod {
  type: string;
  name: string;
  depositLimits: { min: number; max: number };
  withdrawalLimits: { min: number; max: number };
  processingTime: string;
  fees: { deposit: string | number; withdrawal: string | number };
  available: boolean;
}

interface AccountStats {
  accountId: number;
  accountNumber: string;
  currentBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netDeposits: number;
  totalProfit: number;
  totalLoss: number;
  tradingPnL: number;
  totalReturn: number;
  profitFactor: number;
  // Real-time trading metrics
  balance: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  openPositions: number;
  unrealizedPnL: number;
  availableForTrading: number;
}

interface BalanceHistoryItem {
  id: number;
  change_amount: number;
  change_type: string;
  previous_balance: number;
  new_balance: number;
  notes: string;
  formatted_date: string;
}

interface PerformanceData {
  currentBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  netDeposits: number;
  totalProfit: number;
  totalLoss: number;
  tradingPnL: number;
  totalReturn: number;
  profitFactor: number;
  tradingMetrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageWin: number;
    averageLoss: number;
    bestTrade: number;
    worstTrade: number;
    riskRewardRatio: number;
  };
}

export default function FundsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)
  const { user } = useAuth()
  const { activeAccount, positions, accountSummary } = useTrading()
  const { toast } = useToast()
  
  // State management
  const [accountStats, setAccountStats] = useState<AccountStats | null>(null)
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([])
  const [fundingMethods, setFundingMethods] = useState<FundingMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Form states
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState('bank_transfer')
  const [withdrawMethod, setWithdrawMethod] = useState('bank_transfer')
  const [withdrawNotes, setWithdrawNotes] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [cryptoAddress, setCryptoAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Modal states
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)

  const fetchData = async () => {
    console.log('fetchData called - user:', user?.id, 'activeAccount:', activeAccount?.id)
    
    // Set default data from activeAccount and accountSummary first
    if (activeAccount) {
      const defaultStats = {
        accountId: activeAccount.id,
        accountNumber: activeAccount.accountNumber,
        currentBalance: activeAccount.balance || 0,
        balance: activeAccount.balance || 0,
        equity: activeAccount.equity || activeAccount.balance || 0,
        freeMargin: activeAccount.freeMargin || activeAccount.balance || 0,
        marginLevel: activeAccount.marginLevel || 0,
        availableForTrading: activeAccount.freeMargin || activeAccount.balance || 0,
        openPositions: 0,
        unrealizedPnL: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        netDeposits: 0,
        totalProfit: 0,
        totalLoss: 0,
        tradingPnL: 0,
        totalReturn: 0,
        profitFactor: 0
      }
      setAccountStats(defaultStats)
      console.log('Set default account stats:', defaultStats)
      
      const defaultPerformance = {
        currentBalance: activeAccount.balance || 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        netDeposits: 0,
        totalProfit: 0,
        totalLoss: 0,
        tradingPnL: 0,
        totalReturn: 0,
        profitFactor: 0,
        tradingMetrics: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          averageWin: 0,
          averageLoss: 0,
          bestTrade: 0,
          worstTrade: 0,
          riskRewardRatio: 0
        }
      }
      setPerformanceData(defaultPerformance)
      console.log('Set default performance data:', defaultPerformance)
    }
    
    // Set default funding methods
    const defaultMethods = [
      { type: 'bank_transfer', name: 'Bank Transfer', minAmount: 10, maxAmount: 100000, fee: 0, processingTime: '1-3 business days' },
      { type: 'credit_card', name: 'Credit Card', minAmount: 10, maxAmount: 50000, fee: 2.9, processingTime: 'Instant' },
      { type: 'debit_card', name: 'Debit Card', minAmount: 10, maxAmount: 50000, fee: 1.5, processingTime: 'Instant' },
      { type: 'crypto', name: 'Cryptocurrency', minAmount: 10, maxAmount: 100000, fee: 0, processingTime: '10-60 minutes' },
      { type: 'e_wallet', name: 'E-Wallet', minAmount: 10, maxAmount: 25000, fee: 0, processingTime: 'Instant' }
    ]
    setFundingMethods(defaultMethods)
    
    if (!user || !activeAccount) {
      console.log('Missing user or activeAccount - using default data')
      setBalanceHistory([])
      const defaultMethods = [
        { type: 'bank_transfer', name: 'Bank Transfer', minAmount: 10, maxAmount: 100000, fee: 0, processingTime: '1-3 business days' },
        { type: 'credit_card', name: 'Credit Card', minAmount: 10, maxAmount: 50000, fee: 2.9, processingTime: 'Instant' },
        { type: 'debit_card', name: 'Debit Card', minAmount: 10, maxAmount: 50000, fee: 1.5, processingTime: 'Instant' },
        { type: 'crypto', name: 'Cryptocurrency', minAmount: 10, maxAmount: 100000, fee: 0, processingTime: '10-60 minutes' },
        { type: 'e_wallet', name: 'E-Wallet', minAmount: 10, maxAmount: 25000, fee: 0, processingTime: 'Instant' }
      ]
      setFundingMethods(defaultMethods)
      setIsLoading(false)
      return
    }

    let timeoutId: NodeJS.Timeout | null = null;
    try {
      setIsLoading(true)
      console.log('Making API calls for account:', activeAccount.id)
      
      // Set a timeout to ensure loading doesn't hang forever
      timeoutId = setTimeout(() => {
        console.log('API calls timed out, setting loading to false')
        setIsLoading(false)
      }, 10000) // 10 second timeout
      
      // Fetch account balance and statistics with individual error handling
      let statsData = null;
      let historyData = null;
      let methodsData = null;
      let performanceDataResult = null;
      
      try {
        const statsResponse = await apiClient.get(`/funds/account/${activeAccount.id}/balance`)
        console.log('Stats Response:', statsResponse)
        if (statsResponse.success) {
          statsData = statsResponse.data
          setAccountStats(statsData)
          console.log('Set account stats:', statsData)
        }
      } catch (error) {
        console.error('Error fetching account stats, keeping default data:', error)
        // Keep the default data that was already set
      }
      
      try {
        const historyResponse = await apiClient.get(`/funds/account/${activeAccount.id}/history?limit=10`)
        console.log('History Response:', historyResponse)
        if (historyResponse.success) {
          historyData = historyResponse.data.history
          setBalanceHistory(historyData)
          console.log('Set balance history:', historyData)
        }
      } catch (error) {
        console.error('Error fetching balance history:', error)
        setBalanceHistory([])
      }
      
      try {
        const methodsResponse = await apiClient.get('/funds/methods')
        console.log('Methods Response:', methodsResponse)
        if (methodsResponse.success) {
          methodsData = methodsResponse.data
          setFundingMethods(methodsData)
        }
      } catch (error) {
        console.error('Error fetching funding methods:', error)
        // Keep the default methods that were already set
      }
      
      try {
        const performanceResponse = await apiClient.get(`/funds/account/${activeAccount.id}/performance`)
        console.log('Performance Response:', performanceResponse)
        if (performanceResponse.success) {
          performanceDataResult = performanceResponse.data
          setPerformanceData(performanceDataResult)
          console.log('Set performance data:', performanceDataResult)
        }
      } catch (error) {
        console.error('Error fetching performance data, keeping default data:', error)
        // Keep the default data that was already set
      }
      
      // Log final state values
      console.log('Final state values:', {
        accountStats: statsData,
        performanceData: performanceDataResult,
        balanceHistoryLength: historyData?.length || 0
      })
    } catch (error) {
      console.error('Error in fetchData:', error)
      toast({
        title: "Error",
        description: "Failed to load account information",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  useEffect(() => {
    console.log('Funds page useEffect triggered - user:', user, 'activeAccount:', activeAccount)
    fetchData()
  }, [user, activeAccount])

  // Refresh funds data when trading context changes (e.g., positions closed)
  useEffect(() => {
    // Listen for position changes and refresh balance
    if (activeAccount) {
      fetchData()
    }
  }, [positions, accountSummary]) // Re-fetch when positions or account summary changes

  // Listen for real-time balance updates via WebSocket
  useEffect(() => {
    const handleBalanceUpdate = (event: CustomEvent) => {
      const updateData = event.detail;
      console.log('Real-time balance update received in funds page:', updateData);
      
      // Check if the update is for the current active account
      if (activeAccount && updateData.accountId === activeAccount.id) {
        // Update the account stats immediately for real-time feel
        setAccountStats(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            currentBalance: updateData.newBalance,
            totalProfit: updateData.changeType === 'profit' ? prev.totalProfit + updateData.change : prev.totalProfit,
            totalLoss: updateData.changeType === 'loss' ? prev.totalLoss + Math.abs(updateData.change) : prev.totalLoss,
            tradingPnL: prev.tradingPnL + (updateData.reason === 'position_close' ? updateData.change : 0),
            netDeposits: updateData.changeType === 'deposit' ? prev.netDeposits + updateData.change :
                        updateData.changeType === 'withdrawal' ? prev.netDeposits + updateData.change : prev.netDeposits,
            totalDeposits: updateData.changeType === 'deposit' ? prev.totalDeposits + updateData.change : prev.totalDeposits,
            totalWithdrawals: updateData.changeType === 'withdrawal' ? prev.totalWithdrawals + Math.abs(updateData.change) : prev.totalWithdrawals
          };
        });

        // Add to balance history immediately
        const newHistoryItem: BalanceHistoryItem = {
          id: Date.now(), // Temporary ID
          change_amount: updateData.change,
          change_type: updateData.changeType,
          previous_balance: updateData.previousBalance,
          new_balance: updateData.newBalance,
          notes: updateData.reason === 'position_close' 
            ? `Position ${updateData.changeType}: ${updateData.symbol} ${updateData.side} ${updateData.lotSize} lots - ${updateData.change >= 0 ? '+' : ''}$${updateData.change.toFixed(2)}`
            : `${updateData.changeType}: ${updateData.change >= 0 ? '+' : ''}$${updateData.change.toFixed(2)}`,
          formatted_date: new Date(updateData.timestamp).toLocaleString()
        };

        setBalanceHistory(prev => [newHistoryItem, ...prev.slice(0, 9)]); // Keep only latest 10 items

        // Show toast notification
        toast({
          title: updateData.changeType === 'profit' ? "Profit Realized" : 
                 updateData.changeType === 'loss' ? "Loss Realized" :
                 updateData.changeType === 'deposit' ? "Deposit Processed" : "Withdrawal Processed",
          description: updateData.reason === 'position_close' 
            ? `${updateData.symbol} position closed with ${updateData.change >= 0 ? 'profit' : 'loss'}: ${updateData.change >= 0 ? '+' : ''}$${updateData.change.toFixed(2)}`
            : `${updateData.changeType} of $${Math.abs(updateData.change).toFixed(2)} processed`,
          variant: updateData.change >= 0 ? "default" : "destructive"
        });
      }
    };

    // Add event listener for balance updates
    window.addEventListener('balanceUpdate', handleBalanceUpdate as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('balanceUpdate', handleBalanceUpdate as EventListener);
    };
  }, [activeAccount, toast]);

  const handleDeposit = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeAccount || isSubmitting) return

    const amount = parseFloat(depositAmount)
    if (!amount || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid deposit amount",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await apiClient.post('/funds/deposit', {
        accountId: activeAccount.id,
        amount: amount,
        method: depositMethod
      })

      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        })
        setIsDepositModalOpen(false)
        setDepositAmount('')
        // Refresh data
        await fetchData()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to process deposit",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWithdrawal = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeAccount || isSubmitting) return

    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid withdrawal amount",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await apiClient.post('/funds/withdrawal', {
        accountId: activeAccount.id,
        amount: amount,
        method: withdrawMethod,
        bankAccount: withdrawMethod === 'bank_transfer' ? bankAccount : undefined,
        cryptoAddress: withdrawMethod === 'crypto' ? cryptoAddress : undefined,
        notes: withdrawNotes
      })

      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        })
        setIsWithdrawModalOpen(false)
        setWithdrawAmount('')
        setBankAccount('')
        setCryptoAddress('')
        setWithdrawNotes('')
        // Refresh data
        await fetchData()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to process withdrawal",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusIcon = (changeType: string) => {
    switch (changeType) {
      case 'deposit':
        return <DownloadCloud className="h-4 w-4 text-green-600" />
      case 'withdrawal':
        return <UploadCloud className="h-4 w-4 text-red-600" />
      case 'trade_profit':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'trade_loss':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <DollarSign className="h-4 w-4 text-blue-600" />
    }
  }

  const getStatusColor = (changeType: string) => {
    switch (changeType) {
      case 'deposit':
      case 'trade_profit':
        return 'text-green-600 dark:text-green-400'
      case 'withdrawal':
      case 'trade_loss':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-blue-600 dark:text-blue-400'
    }
  }

  // Debug: Log current state values during render
  console.log('RENDER - Current state values:', {
    accountStats,
    performanceData,
    isLoading,
    balanceHistoryLength: balanceHistory.length,
    currentBalance: accountStats?.currentBalance,
    tradingPnL: performanceData?.tradingPnL
  })

  console.log('FundsPage rendering - isLoading:', isLoading, 'accountStats:', accountStats, 'activeAccount:', activeAccount)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex flex-1 overflow-hidden">
          <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <main className={`flex-1 flex items-center justify-center transition-all duration-300 ${
            sidebarCollapsed ? "pl-20 pr-6" : "pl-68 pr-6"
          }`}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading account information...</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!activeAccount) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex flex-1 overflow-hidden">
          <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <main className={`flex-1 flex items-center justify-center transition-all duration-300 ${
            sidebarCollapsed ? "pl-20 pr-6" : "pl-68 pr-6"
          }`}>
            <div className="text-center">
              <div className="p-4 rounded-full bg-muted/20 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Wallet className="h-8 w-8 opacity-50" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Trading Account</h2>
              <p className="text-muted-foreground mb-4">You need a trading account to manage funds</p>
              <Button onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        
        <main className={`flex-1 flex flex-col gap-6 overflow-auto transition-all duration-300 w-full ${
          sidebarCollapsed ? "pl-20 pr-6 pt-6 pb-6" : "pl-68 pr-6 pt-6 pb-6"
        }`}>
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Fund Management</h1>
              <p className="text-muted-foreground">Manage deposits, withdrawals and track your account performance</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                Account #{activeAccount?.accountNumber}
              </Badge>
            </div>
          </div>

          {/* Account Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/50 border border-border/50 hover:bg-card/70 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Account Balance</CardTitle>
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">${accountStats?.balance?.toFixed(2) || accountStats?.currentBalance?.toFixed(2) || '0.00'}</div>
                <p className="text-xs text-muted-foreground mt-1">Deposited + Realized P&L</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border border-border/50 hover:bg-card/70 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available for Trading</CardTitle>
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/20">
                  <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">${accountStats?.availableForTrading?.toFixed(2) || accountStats?.freeMargin?.toFixed(2) || '0.00'}</div>
                <p className="text-xs text-muted-foreground mt-1">Free margin for trades</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border border-border/50 hover:bg-card/70 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Account Equity</CardTitle>
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/20">
                  <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">${accountStats?.equity?.toFixed(2) || accountStats?.balance?.toFixed(2) || '0.00'}</div>
                <p className="text-xs text-muted-foreground mt-1">Balance + Unrealized P&L</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border border-border/50 hover:bg-card/70 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Trading P&L</CardTitle>
                <div className={`p-2 rounded-full ${(performanceData?.tradingPnL || 0) >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                  {(performanceData?.tradingPnL || 0) >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tracking-tight ${(performanceData?.tradingPnL || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {(performanceData?.tradingPnL || 0) >= 0 ? '+' : ''}${performanceData?.tradingPnL?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total from trading</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border border-border/50 hover:bg-card/70 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Return</CardTitle>
                <div className={`p-2 rounded-full ${(performanceData?.totalReturn || 0) >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                  <DollarSign className={`h-4 w-4 ${(performanceData?.totalReturn || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tracking-tight ${(performanceData?.totalReturn || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {(performanceData?.totalReturn || 0) >= 0 ? '+' : ''}{performanceData?.totalReturn?.toFixed(2) || '0.00'}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Return on investment</p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border border-border/50 hover:bg-card/70 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/20">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                  {performanceData?.tradingMetrics?.winRate?.toFixed(1) || '0.0'}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {performanceData?.tradingMetrics?.winningTrades || 0}/{performanceData?.tradingMetrics?.totalTrades || 0} trades
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trading Status Info */}
          {accountStats && (accountStats.openPositions > 0 || accountStats.unrealizedPnL !== 0) && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Active Trading Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Open Positions</div>
                    <div className="text-xl font-bold">{accountStats.openPositions || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Unrealized P&L</div>
                    <div className={`text-xl font-bold ${(accountStats.unrealizedPnL || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(accountStats.unrealizedPnL || 0) >= 0 ? '+' : ''}${accountStats.unrealizedPnL?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Margin Level</div>
                    <div className={`text-xl font-bold ${(accountStats.marginLevel || 0) > 200 ? 'text-green-600' : (accountStats.marginLevel || 0) > 100 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {accountStats.marginLevel?.toFixed(1) || '0.0'}%
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> Your account balance shows deposited funds and realized profits. 
                    Available for trading shows free margin (${accountStats?.availableForTrading?.toFixed(2) || '0.00'}) 
                    which accounts for open positions and margin requirements.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Dialog open={isDepositModalOpen} onOpenChange={setIsDepositModalOpen}>
              <DialogTrigger asChild>
                <Button className="h-14 text-base font-medium bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200">
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-1 bg-white/10 dark:bg-white/20 rounded-full">
                      <DownloadCloud className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Deposit Funds</div>
                      <div className="text-xs opacity-80">Add money to your account</div>
                    </div>
                  </div>
                </Button>
              </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader className="text-center pb-2">
                    <div className="mx-auto mb-2 p-3 bg-primary/10 rounded-full w-fit">
                      <DownloadCloud className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-xl">Deposit Funds</DialogTitle>
                    <DialogDescription className="text-sm">
                      Add funds to your trading account securely
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleDeposit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="deposit-amount" className="text-sm font-medium">Amount (USD)</Label>
                      <Input
                        id="deposit-amount"
                        type="number"
                        step="0.01"
                        min="10"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="h-11 text-lg font-medium"
                        required
                      />
                      <p className="text-xs text-muted-foreground">Minimum deposit: $10.00</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deposit-method" className="text-sm font-medium">Payment Method</Label>
                      <Select value={depositMethod} onValueChange={setDepositMethod}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          {fundingMethods.map((method) => (
                            <SelectItem key={method.type} value={method.type}>
                              <div className="flex items-center gap-2">
                                <span>{method.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {method.processingTime}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter className="gap-3 pt-4">
                      <DialogClose asChild>
                        <Button type="button" variant="outline" className="flex-1">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="flex-1"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            Processing...
                          </div>
                        ) : (
                          'Confirm Deposit'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

            <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-14 text-base font-medium border-2 hover:bg-muted/50 shadow-md hover:shadow-lg transition-all duration-200">
                  <div className="flex items-center justify-center gap-3">
                    <div className="p-1 bg-muted/60 rounded-full">
                      <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Withdraw Funds</div>
                      <div className="text-xs text-muted-foreground">Transfer money out</div>
                    </div>
                  </div>
                </Button>
              </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader className="text-center pb-2">
                    <div className="mx-auto mb-2 p-3 bg-muted/40 rounded-full w-fit">
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <DialogTitle className="text-xl">Withdraw Funds</DialogTitle>
                    <DialogDescription className="text-sm">
                      Transfer funds from your trading account
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleWithdrawal} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount</Label>
                      <Input
                        id="withdraw-amount"
                        type="number"
                        step="0.01"
                        min="10"
                        max={accountStats?.balance || accountStats?.currentBalance || 0}
                        placeholder="Enter amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Available for withdrawal: ${accountStats?.balance?.toFixed(2) || accountStats?.currentBalance?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-method">Withdrawal Method</Label>
                      <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fundingMethods.map((method) => (
                            <SelectItem key={method.type} value={method.type}>
                              {method.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {withdrawMethod === 'bank_transfer' && (
                      <div className="space-y-2">
                        <Label htmlFor="bank-account">Bank Account</Label>
                        <Input
                          id="bank-account"
                          placeholder="Account number or IBAN"
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    {withdrawMethod === 'crypto' && (
                      <div className="space-y-2">
                        <Label htmlFor="crypto-address">Wallet Address</Label>
                        <Input
                          id="crypto-address"
                          placeholder="Crypto wallet address"
                          value={cryptoAddress}
                          onChange={(e) => setCryptoAddress(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-notes">Notes (Optional)</Label>
                      <Textarea
                        id="withdraw-notes"
                        placeholder="Additional notes"
                        value={withdrawNotes}
                        onChange={(e) => setWithdrawNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <DialogFooter className="gap-3 pt-4">
                      <DialogClose asChild>
                        <Button type="button" variant="outline" className="flex-1">
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button 
                        type="submit" 
                        disabled={isSubmitting} 
                        className="flex-1"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            Processing...
                          </div>
                        ) : (
                          'Confirm Withdrawal'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

          {/* Recent Transactions */}
          <Card className="bg-card/50 border border-border/50">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Recent Transactions</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {balanceHistory.length} transactions
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {balanceHistory.length > 0 ? (
                  balanceHistory.map((transaction, index) => (
                    <div key={transaction.id} className={`flex items-center justify-between p-4 hover:bg-muted/30 transition-colors ${index === 0 ? 'bg-muted/20' : ''}`}>
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${
                          transaction.change_type === 'deposit' ? 'bg-green-100 dark:bg-green-900/20' :
                          transaction.change_type === 'withdrawal' ? 'bg-red-100 dark:bg-red-900/20' :
                          transaction.change_type === 'trade_profit' ? 'bg-blue-100 dark:bg-blue-900/20' :
                          transaction.change_type === 'trade_loss' ? 'bg-orange-100 dark:bg-orange-900/20' :
                          'bg-gray-100 dark:bg-gray-900/20'
                        }`}>
                          {getStatusIcon(transaction.change_type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">
                            {transaction.notes || 'Transaction'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.formatted_date}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className={`font-semibold text-sm ${getStatusColor(transaction.change_type)}`}>
                          {transaction.change_amount >= 0 ? '+' : ''}${Math.abs(transaction.change_amount).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Balance: ${transaction.new_balance.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="p-4 rounded-full bg-muted/20 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Wallet className="h-8 w-8 opacity-50" />
                    </div>
                    <p className="font-medium mb-1">No transactions yet</p>
                    <p className="text-sm">Start by making a deposit to see your transaction history</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  )
}