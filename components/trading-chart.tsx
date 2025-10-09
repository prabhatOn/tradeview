"use client"

import { useEffect, useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, Activity, Loader2, RefreshCw } from "lucide-react"
import { useMarket } from "@/contexts/MarketContext"
import { useHistoricalData } from "@/hooks/use-trading"
import { MarketData } from "@/lib/types"
import TradingViewChart from "./trading-view-chart"
import { useAuth } from "@/hooks/use-auth"
import { tradingService } from "@/lib/services"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useTrading } from "@/contexts/TradingContext"

// ChartPoint interface removed - using TradingView widget instead

const TIMEFRAMES = [
  { value: '1m', label: '1 Minute' },
  { value: '5m', label: '5 Minutes' },
  { value: '15m', label: '15 Minutes' },
  { value: '30m', label: '30 Minutes' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' },
  { value: '1w', label: '1 Week' },
]

export default function TradingChart() {
  const { selectedSymbol, marketData, isLoading: marketLoading } = useMarket()
  const { user } = useAuth()
  const { toast } = useToast()
  const { activeAccount, accounts, isLoading: tradingLoading, error: tradingError, loadAccounts } = useTrading()
  const [timeframe, setTimeframe] = useState('1h')
  const [activeTab, setActiveTab] = useState('chart')
  const [quantity, setQuantity] = useState(1)
  const [showOrderDialog, setShowOrderDialog] = useState(false)
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [orderMode, setOrderMode] = useState<'market' | 'limit' | 'stop'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')

  // Debug logging
  useEffect(() => {
    console.log('TradingChart - selectedSymbol:', selectedSymbol)
    console.log('TradingChart - marketData count:', marketData.length)
    console.log('TradingChart - isLoading:', marketLoading)
  }, [selectedSymbol, marketData, marketLoading])
  
  // Get current market data for selected symbol
  const currentSymbolData = marketData.find(item => item.symbol === selectedSymbol) || 
    (selectedSymbol ? { symbol: selectedSymbol, bid: 0, ask: 0, change: 0, changePercent: 0 } as MarketData : null)
  
  // Get historical data for chart
  const { 
    data: historicalData, 
    isLoading: historyLoading, 
    error: historyError,
    refetch: refetchHistory 
  } = useHistoricalData(selectedSymbol, timeframe)

  // Chart data is now handled by TradingView widget instead of local data

  // Buy/Sell handlers - open modal
  const handleBuy = () => {
    setOrderType('buy')
    setShowOrderDialog(true)
  }

  const handleSell = () => {
    setOrderType('sell')
    setShowOrderDialog(true)
  }

  // Execute order after form submission
  const executeOrder = async () => {
    if (!selectedSymbol || !currentSymbolData || !user) {
      toast({
        title: "Error",
        description: "Please select a symbol and ensure you're logged in",
        variant: "destructive"
      })
      return
    }

    try {
      // Clean and validate input values
      const cleanStopLoss = stopLoss?.trim()
      const cleanTakeProfit = takeProfit?.trim()
      const cleanLimitPrice = limitPrice?.trim()
      
      console.log('Cleaning inputs:', { 
        stopLoss, cleanStopLoss, 
        takeProfit, cleanTakeProfit,
        limitPrice, cleanLimitPrice
      })
      
      // Debug trading accounts
      console.log('Trading accounts debug:', {
        activeAccount,
        accounts,
        activeAccountId: activeAccount?.id,
        firstAccountId: accounts?.[0]?.id,
        accountsLength: accounts?.length,
        tradingLoading,
        tradingError,
        user: user?.id
      });

      // If accounts are still loading, show message and return
      if (tradingLoading) {
        toast({
          title: "Loading",
          description: "Please wait while your trading account loads...",
          variant: "default"
        });
        return;
      }

      // If there's an error, try to reload accounts
      if (tradingError) {
        console.error('Trading error:', tradingError);
        toast({
          title: "Account Loading Error",
          description: "Retrying to load your trading account...",
          variant: "destructive"
        });
        await loadAccounts();
        return;
      }

      // Determine account ID to use
      const accountId = activeAccount?.id || accounts?.[0]?.id;
      
      console.log('Final account selection:', {
        selectedAccountId: accountId,
        activeAccountExists: !!activeAccount,
        accountsArrayExists: !!accounts,
        willUseActiveAccount: !!activeAccount?.id,
        willUseFirstAccount: !activeAccount?.id && !!accounts?.[0]?.id
      });

      if (!accountId) {
        toast({
          title: "No Trading Account Found",
          description: "Unable to find a trading account. Please contact support.",
          variant: "destructive"
        });
        return;
      }

      const orderData = {
        accountId: accountId,
        symbolId: currentSymbolData.symbolId,
        orderType: orderMode,
        side: orderType,
        lotSize: quantity,
        price: orderMode === 'market' ? null : (cleanLimitPrice && cleanLimitPrice !== '' ? parseFloat(cleanLimitPrice) : null),
        stopLoss: cleanStopLoss && cleanStopLoss !== '' ? parseFloat(cleanStopLoss) : null,
        takeProfit: cleanTakeProfit && cleanTakeProfit !== '' ? parseFloat(cleanTakeProfit) : null,
        comment: `${orderType.toUpperCase()} ${selectedSymbol} - ${orderMode} order`
      }

      console.log('Raw input values:', { stopLoss, takeProfit, limitPrice })
      console.log('Trimmed values:', { 
        stopLoss: stopLoss.trim(), 
        takeProfit: takeProfit.trim(), 
        limitPrice: limitPrice.trim() 
      })
      console.log('Executing order:', orderData)
      console.log('currentSymbolData:', currentSymbolData)
      console.log('currentSymbolData.symbolId:', currentSymbolData?.symbolId)
      
      // Prepare request data with proper null handling
      const requestData = {
        accountId: orderData.accountId,
        symbolId: orderData.symbolId,
        side: orderData.side,
        lotSize: orderData.lotSize,
        stopLoss: orderData.stopLoss,
        takeProfit: orderData.takeProfit,
        comment: orderData.comment
      }
      
      console.log('Request data being sent:', requestData)
      console.log('Request data types:', {
        accountId: typeof requestData.accountId,
        symbolId: typeof requestData.symbolId,
        side: typeof requestData.side,
        lotSize: typeof requestData.lotSize,
        stopLoss: typeof requestData.stopLoss,
        takeProfit: typeof requestData.takeProfit,
        comment: typeof requestData.comment
      })
      
      // Call trading service based on order type
      let response
      // Use the same request data for both order types
      response = await tradingService.openPosition(requestData)

      if (response.success) {
        toast({
          title: `${orderType.toUpperCase()} Order Executed`,
          description: `Successfully ${orderType === 'buy' ? 'bought' : 'sold'} ${quantity} lots of ${selectedSymbol}`
        })
        setShowOrderDialog(false)
        // Reset form
        setQuantity(1)
        setLimitPrice('')
        setStopLoss('')
        setTakeProfit('')
      } else {
        throw new Error(response.error?.message || 'Failed to execute order')
      }
    } catch (error: any) {
      console.error('Order failed:', error)
      toast({
        title: "Order Failed",
        description: error.message || 'Failed to execute order',
        variant: "destructive"
      })
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    }).format(price)
  }

  const formatChange = (change: number, changePercent: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(5)} (${sign}${changePercent.toFixed(2)}%)`
  }

  return (
    <Card className="h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-semibold text-lg">
                {selectedSymbol || 'Select Symbol'}
              </h3>
              {currentSymbolData && (
                <div className="flex items-center gap-4 mt-1">
                  <span className="font-mono text-sm">
                    Bid: {formatPrice(currentSymbolData.bid || 0)}
                  </span>
                  <span className="font-mono text-sm">
                    Ask: {formatPrice(currentSymbolData.ask || 0)}
                  </span>
                  <Badge variant={
                    currentSymbolData.change >= 0 ? 'default' : 'destructive'
                  }>
                    {currentSymbolData.change >= 0 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {formatChange(currentSymbolData.change, currentSymbolData.changePercent)}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Quantity:</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(parseFloat(e.target.value) || 1)}
                className="w-20 h-8"
              />
            </div>
            
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={refetchHistory}
              disabled={historyLoading}
            >
              {historyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="orderbook">Order Book</TabsTrigger>
            <TabsTrigger value="trades">Recent Trades</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-4 h-[calc(100%-120px)]">
        {!selectedSymbol ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Activity className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Select a trading symbol to view chart</p>
            </div>
          </div>
        ) : historyError && !currentSymbolData ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-red-500 mb-2">Error loading chart data</p>
              <Button variant="outline" size="sm" onClick={refetchHistory}>
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab}>
            <TabsContent value="chart" className="mt-0 h-full">
              <div className="h-[70vh]">
                <TradingViewChart
                  symbol={selectedSymbol || "EURUSD"}
                  timeframe={timeframe}
                  onBuy={handleBuy}
                  onSell={handleSell}
                  onChangeTimeframe={setTimeframe}
                />
              </div>
            </TabsContent>

            <TabsContent value="orderbook" className="mt-0 h-full">
              <div className="grid grid-cols-2 gap-4 h-full">
                <div>
                  <h4 className="font-semibold mb-2 text-green-600">Bids</h4>
                  <div className="space-y-1 font-mono text-sm">
                    {/* Mock order book data */}
                    {Array.from({ length: 10 }, (_, i) => {
                      const price = (currentSymbolData?.bid || 1.0000) - (i * 0.0001)
                      const volume = Math.floor(Math.random() * 1000000)
                      return (
                        <div key={i} className="flex justify-between text-green-600">
                          <span>{formatPrice(price)}</span>
                          <span>{volume.toLocaleString()}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-red-600">Asks</h4>
                  <div className="space-y-1 font-mono text-sm">
                    {/* Mock order book data */}
                    {Array.from({ length: 10 }, (_, i) => {
                      const price = (currentSymbolData?.ask || 1.0000) + (i * 0.0001)
                      const volume = Math.floor(Math.random() * 1000000)
                      return (
                        <div key={i} className="flex justify-between text-red-600">
                          <span>{formatPrice(price)}</span>
                          <span>{volume.toLocaleString()}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="trades" className="mt-0 h-full">
              <div className="space-y-2">
                <h4 className="font-semibold mb-2">Recent Trades</h4>
                <div className="space-y-1 font-mono text-sm max-h-[300px] overflow-y-auto">
                  {/* Mock recent trades */}
                  {Array.from({ length: 20 }, (_, i) => {
                    const isBuy = Math.random() > 0.5
                    const price = (currentSymbolData?.bid || 1.0000) + (Math.random() - 0.5) * 0.001
                    const volume = Math.floor(Math.random() * 100000)
                    const time = new Date(Date.now() - i * 60000)
                    
                    return (
                      <div key={i} className="flex justify-between items-center">
                        <span className={isBuy ? 'text-green-600' : 'text-red-600'}>
                          {formatPrice(price)}
                        </span>
                        <span>{volume.toLocaleString()}</span>
                        <span className="text-muted-foreground text-xs">
                          {time.toLocaleTimeString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
        
        {/* Buy/Sell Buttons Below Chart */}
        {selectedSymbol && (
          <div className="mt-4 flex justify-center gap-4">
            <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleBuy}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg font-semibold"
                  disabled={!selectedSymbol || marketLoading}
                >
                  <TrendingUp className="w-5 h-5 mr-2" />
                  BUY {selectedSymbol}
                </Button>
              </DialogTrigger>
              <DialogTrigger asChild>
                <Button
                  onClick={handleSell}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-lg font-semibold"
                  disabled={!selectedSymbol || marketLoading}
                >
                  <TrendingDown className="w-5 h-5 mr-2" />
                  SELL {selectedSymbol}
                </Button>
              </DialogTrigger>
              
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">
                    {orderType === 'buy' ? 'Buy' : 'Sell'} Order - {selectedSymbol}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Order Type Tabs */}
                  <div className="flex border-b">
                    <button
                      className={`px-4 py-2 font-medium ${orderMode === 'market' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                      onClick={() => setOrderMode('market')}
                    >
                      Market
                    </button>
                    <button
                      className={`px-4 py-2 font-medium ${orderMode === 'limit' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                      onClick={() => setOrderMode('limit')}
                    >
                      Limit
                    </button>
                    <button
                      className={`px-4 py-2 font-medium ${orderMode === 'stop' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                      onClick={() => setOrderMode('stop')}
                    >
                      Stop
                    </button>
                  </div>
                  
                  {/* Amount/Lots */}
                  <div className="space-y-2">
                    <Label>Amount / Lots</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={quantity}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(parseFloat(e.target.value) || 0.01)}
                      className="text-lg font-mono"
                    />
                  </div>
                  
                  {/* Price (for limit/stop orders) */}
                  {orderMode !== 'market' && (
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        placeholder={currentSymbolData ? (orderType === 'buy' ? currentSymbolData.ask?.toFixed(5) : currentSymbolData.bid?.toFixed(5)) : ''}
                        className="text-lg font-mono"
                      />
                    </div>
                  )}
                  
                  {/* Current Price Display */}
                  {currentSymbolData && (
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Current Price:</span>
                        <div className="flex gap-4">
                          <span className="text-sm">Bid: <strong className="font-mono">{currentSymbolData.bid?.toFixed(5)}</strong></span>
                          <span className="text-sm">Ask: <strong className="font-mono">{currentSymbolData.ask?.toFixed(5)}</strong></span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Stop Loss & Take Profit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SL (Stop Loss)</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        placeholder="Optional"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>TP (Take Profit)</Label>
                      <Input
                        type="number"
                        step="0.00001"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        placeholder="Optional"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={executeOrder}
                      className={orderType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                    >
                      {orderType === 'buy' ? 'BUY' : 'SELL'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
      <Toaster />
    </Card>
  )
}