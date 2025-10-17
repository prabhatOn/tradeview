"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  Loader2
} from "lucide-react"
import { useMarket } from "@/contexts/MarketContext"
import { useTrading } from "@/contexts/TradingContext"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

const marketCategories = [
  { value: "all", label: "All Markets" },
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "commodities", label: "Commodities" },
  { value: "indices", label: "Indices" },
]

const marketData = [
  {
    symbol: "XAUUSD",
    name: "Gold",
    price: "3,776.58",
    change: "+0.41%",
    changeValue: "+15.42",
    isPositive: true,
    category: "commodities",
  },
  {
    symbol: "BTCUSD",
    name: "Bitcoin",
    price: "113,650",
    change: "-0.86%",
    changeValue: "-985.32",
    isPositive: false,
    category: "crypto",
  },
  {
    symbol: "ETHUSD",
    name: "Ethereum",
    price: "3,561.42",
    change: "+1.12%",
    changeValue: "+39.87",
    isPositive: true,
    category: "crypto",
  },
  {
    symbol: "EURUSD",
    name: "Euro / U.S. Dollar",
    price: "1.077",
    change: "+0.08%",
    changeValue: "+0.0009",
    isPositive: true,
    category: "forex",
  },
  {
    symbol: "US30",
    name: "Dow Jones",
    price: "39,985",
    change: "-0.12%",
    changeValue: "-48.23",
    isPositive: false,
    category: "indices",
  },
]

interface DashboardStats {
  totalPnL: number;
  todayPnL: number;
  winRate: number;
  totalTrades: number;
  openPositions: number;
  balance: number;
  equity: number;
  freeMargin: number;
  usedMargin: number;
  marginLevel: number;
}

export function TopDashboardPanel() {
  const { 
    marketData: contextMarketData, 
    selectedSymbol, 
    setSelectedSymbol, 
    selectedCategory, 
    setCategory,
    searchQuery,
    setSearchQuery,
    categories,
    isLoading: marketLoading
  } = useMarket()

  const { activeAccount, accountSummary } = useTrading()
  const { toast } = useToast()
  
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [useBasicData, setUseBasicData] = useState(false)

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    if (!activeAccount) {
      console.log('No active account, skipping dashboard stats fetch')
      setIsLoadingStats(false)
      return
    }

    console.log(`Fetching dashboard stats for account ${activeAccount.id}`)
    setIsLoadingStats(true)

    try {
      const response = await apiClient.get(`/funds/dashboard/performance/${activeAccount.id}`)
      console.log('Dashboard stats API response:', response)
      
      if (response.success) {
        console.log('Setting dashboardStats with data:', response.data)
        console.log('  usedMargin from response:', response.data.usedMargin)
        console.log('  freeMargin from response:', response.data.freeMargin)
        setDashboardStats(response.data)
        console.log('Dashboard stats updated:', response.data)
      } else {
        console.error('API returned success=false:', response)
        toast({
          title: "Error",
          description: response.message || "Failed to load dashboard statistics",
          variant: "destructive"
        })
      }
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error)
      const errorMessage = error.response?.data?.message || error.message || "Failed to load dashboard statistics"
      console.error('Detailed error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      })
      
      // Fallback to basic data from trading context if available
      if (accountSummary) {
        console.log('Using fallback data from accountSummary:', accountSummary)
        setDashboardStats({
          totalPnL: accountSummary.totalPnl || 0,
          todayPnL: accountSummary.todayPnl || 0,
          winRate: 0, // Not available in basic data
          totalTrades: 0, // Not available in basic data
          openPositions: accountSummary.openPositions || 0,
          balance: accountSummary.balance || 0,
          equity: accountSummary.equity || 0,
          freeMargin: accountSummary.freeMargin || 0,
          usedMargin: accountSummary.margin || 0,
          marginLevel: accountSummary.marginLevel || 0
        })
        setUseBasicData(true)
      } else if (activeAccount) {
        // If no accountSummary, use activeAccount data directly
        console.log('Using fallback data from activeAccount:', activeAccount)
        setDashboardStats({
          totalPnL: 0,
          todayPnL: 0,
          winRate: 0,
          totalTrades: 0,
          openPositions: 0,
          balance: activeAccount.balance || 0,
          equity: activeAccount.equity || 0,
          freeMargin: activeAccount.freeMargin || 0,
          usedMargin: activeAccount.usedMargin || 0,
          marginLevel: activeAccount.marginLevel || 0
        })
        setUseBasicData(true)
      } else {
        toast({
          title: "Error",
          description: `Failed to load dashboard statistics: ${errorMessage}`,
          variant: "destructive"
        })
      }
    } finally {
      setIsLoadingStats(false)
    }
  }

  // Fetch data when component mounts or account changes
  useEffect(() => {
    fetchDashboardStats()
  }, [activeAccount])

  // Listen for balance updates to refresh stats
  useEffect(() => {
    const handleBalanceUpdate = () => {
      fetchDashboardStats()
    }

    window.addEventListener('balanceUpdate', handleBalanceUpdate)
    return () => {
      window.removeEventListener('balanceUpdate', handleBalanceUpdate)
    }
  }, [activeAccount])

  // Use context data if available, otherwise fallback to static data
  const displayData = contextMarketData.length > 0 ? contextMarketData.map(item => ({
    symbol: item.symbol,
    name: item.symbol, // Use symbol as name if name not available
    price: item.bid?.toFixed(2) || "0.00",
    change: `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`,
    changeValue: `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}`,
    isPositive: item.changePercent >= 0,
    category: "forex" // Default category
  })) : marketData

  const filteredData = displayData.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory
    const matchesSearch = item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-2 sm:p-3 h-full flex flex-col">
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
          
          {/* Market Overview */}
          <div className="w-full lg:w-[40%] h-[50vh] flex flex-col min-h-0 order-1">
            <Card className="flex-1 border-border/50 bg-background/50 flex flex-col min-h-0">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Market Overview
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedCategory} onValueChange={setCategory}>
                    <SelectTrigger className="flex-1 h-8 text-sm">
                      <SelectValue placeholder="Select market" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories.length > 0 ? categories : marketCategories).map((category) => (
                        <SelectItem key={category.value} value={category.value} className="text-sm">
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      className="pl-8 h-8 text-sm bg-background/50"
                      value={searchQuery}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="space-y-1 p-2">
                    {filteredData.map((item) => (
                      <div
                        key={item.symbol}
                        className={`flex items-center justify-between p-2 rounded-lg hover:bg-accent/30 cursor-pointer transition-colors ${
                          selectedSymbol === item.symbol ? 'bg-primary/10 border border-primary/20' : ''
                        }`}
                        onClick={() => setSelectedSymbol(item.symbol)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm truncate">{item.symbol}</h4>
                            <span className="font-mono text-sm font-semibold ml-2">{item.price}</span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                            <div className="flex items-center space-x-1 ml-2">
                              {item.isPositive ? (
                                <TrendingUp className="h-3.5 w-3.5 text-trading-success" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-trading-danger" />
                              )}
                              <span
                                className={`text-xs font-medium ${
                                  item.isPositive ? "text-trading-success" : "text-trading-danger"
                                }`}
                              >
                                {item.change}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Performance */}
          <div className="w-fit h-fit lg:w-[30%] order-2 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col border-border/50 bg-background/50 min-h-0">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-3 space-y-3">
                <div className="w-full rounded-xl  p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-trading-success" />
                    <div>
                      <div className="text-xs text-muted-foreground">Total P&L</div>
                      {isLoadingStats ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Loading...</span>
                        </div>
                      ) : (
                        <div className={`font-mono text-lg font-bold ${(dashboardStats?.totalPnL || 0) >= 0 ? 'text-trading-success' : 'text-trading-danger'}`}>
                          {(dashboardStats?.totalPnL || 0) >= 0 ? '+' : ''}${dashboardStats?.totalPnL?.toFixed(2) || '0.00'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-trading-info" />
                    <div>
                      <div className="text-xs text-muted-foreground">Today's P&L</div>
                      {isLoadingStats ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Loading...</span>
                        </div>
                      ) : (
                        <div className={`font-mono text-lg font-bold ${(dashboardStats?.todayPnL || 0) >= 0 ? 'text-trading-success' : 'text-trading-danger'}`}>
                          {(dashboardStats?.todayPnL || 0) >= 0 ? '+' : ''}${dashboardStats?.todayPnL?.toFixed(2) || '0.00'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border text-xs sm:text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Win Rate</span>
                    {isLoadingStats ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Badge variant="secondary">
                        {useBasicData ? 'N/A' : `${dashboardStats?.winRate?.toFixed(1) || '0.0'}%`}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Trades</span>
                    {isLoadingStats ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="font-mono font-semibold">
                        {useBasicData ? 'N/A' : (dashboardStats?.totalTrades || 0)}
                      </span>
                    )}
                  </div>
                  {useBasicData && (
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 pt-1">
                      ⚠️ Basic data only - some metrics unavailable
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account */}
          <div className="w-fit lg:w-[30%] max-h-[50vh] h-fit order-3 flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col border-border/50 bg-background/50 min-h-0">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-2 space-y-1">
                <div className="rounded-xl p-3">
                  <div className="text-xs text-muted-foreground">Account Equity</div>
                  {isLoadingStats ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <div className="font-mono text-lg font-bold">
                      ${dashboardStats?.equity?.toFixed(2) || '0.00'}
                    </div>
                  )}
                </div>

                <div className="rounded-xl p-3">
                  <div className="text-xs text-muted-foreground">Used Margin</div>
                  {isLoadingStats ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <div className="font-mono text-lg font-semibold">
                      ${dashboardStats?.usedMargin?.toFixed(2) || '0.00'}
                    </div>
                  )}
                </div>

                <div className="rounded-xl p-3">
                  <div className="text-xs text-muted-foreground">Free Margin</div>
                  {isLoadingStats ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <div className="font-mono text-lg font-semibold text-trading-success">
                      ${dashboardStats?.freeMargin?.toFixed(2) || '0.00'}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Active Trades</span>
                  {isLoadingStats ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Badge variant="outline">{dashboardStats?.openPositions || 0}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
