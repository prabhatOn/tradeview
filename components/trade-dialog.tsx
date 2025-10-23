"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import { useTrading } from "@/contexts/TradingContext"
import { useToast } from "@/hooks/use-toast"
import { enhancedTradingService } from "@/lib/services"

interface TradeDialogProps {
  symbol: string
  symbolId: number
  price: string
  type: "buy" | "sell"
  children: React.ReactNode
}

export function TradeDialog({ symbol, symbolId, price, type, children }: TradeDialogProps) {
  const [volume, setVolume] = useState("0.01")
  const [stopLoss, setStopLoss] = useState("")
  const [takeProfit, setTakeProfit] = useState("")
  const [orderType, setOrderType] = useState("market")
  const [limitPrice, setLimitPrice] = useState("")
  const [tabValue, setTabValue] = useState<'market' | 'pending'>('market')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  
  // Phase 5 Enhancements removed: leverage selection simplified
  const [marginInfo, setMarginInfo] = useState<{
    balance?: number
    equity?: number
    marginUsed?: number
    freeMargin?: number
    marginLevel?: number
  } | null>(null)
  // risk amount removed; quick position-from-risk UI removed

  const { activeAccount, accounts, openPosition } = useTrading()
  const { toast } = useToast()

  const isBuy = type === "buy"
  const currentPrice = parseFloat(price)
  const lotSize = parseFloat(volume) || 0
  const slPrice = parseFloat(stopLoss) || 0
  const tpPrice = parseFloat(takeProfit) || 0

  // Load margin info when dialog opens
  useEffect(() => {
    if (isOpen && activeAccount?.id) {
      loadMarginInfo()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeAccount?.id])

  // leverage options removed; no-op function

  const loadMarginInfo = async () => {
    if (!activeAccount?.id) return
    try {
      const response = await enhancedTradingService.getMarginInfo(activeAccount.id)
      setMarginInfo(response.data)
    } catch (error) {
      console.error('Failed to load margin info:', error)
    }
  }

  // Calculate required margin for this trade (use account leverage or default)
  const requiredMargin = useMemo(() => {
    if (!lotSize || !currentPrice) return 0
    const leverage = activeAccount?.leverage || 100
    const contractSize = 100000 // Standard lot
    const positionValue = lotSize * contractSize * currentPrice
    return positionValue / leverage
  }, [lotSize, currentPrice, activeAccount?.leverage])

  // Calculate SL/TP in pips and risk amount
  const slCalculation = useMemo(() => {
    if (!slPrice || !currentPrice || !lotSize) return null
    const pipValue = 10 // $10 per pip for 1 lot (standard)
    const priceDiff = Math.abs(slPrice - currentPrice)
    const pips = priceDiff * 10000 // For 4-digit pairs
    const riskDollar = pips * pipValue * lotSize
    return { pips: pips.toFixed(1), risk: riskDollar.toFixed(2) }
  }, [slPrice, currentPrice, lotSize])

  const tpCalculation = useMemo(() => {
    if (!tpPrice || !currentPrice || !lotSize) return null
    const pipValue = 10
    const priceDiff = Math.abs(tpPrice - currentPrice)
    const pips = priceDiff * 10000
    const rewardDollar = pips * pipValue * lotSize
    return { pips: pips.toFixed(1), reward: rewardDollar.toFixed(2) }
  }, [tpPrice, currentPrice, lotSize])

  // calculatePositionFromRisk removed

  // Estimate commission (simplified - should come from backend)
  const estimatedCommission = useMemo(() => {
    if (!lotSize) return 0
    return lotSize * 7 // $7 per lot (example)
  }, [lotSize])

  // Estimate swap (simplified - should come from backend)
  const estimatedSwap = useMemo(() => {
    if (!lotSize) return 0
    return lotSize * 0.5 // $0.50 per lot per day (example)
  }, [lotSize])

  // Check margin level after trade
  const marginLevelAfterTrade = useMemo(() => {
    if (!marginInfo || !requiredMargin) return null
    const newMarginUsed = (marginInfo.marginUsed || 0) + requiredMargin
    const equity = marginInfo.equity || marginInfo.balance || 0
    if (newMarginUsed === 0) return 100
    return (equity / newMarginUsed) * 100
  }, [marginInfo, requiredMargin])

  const handlePlaceOrder = async () => {
    if (!activeAccount && (!accounts || accounts.length === 0)) {
      toast({
        title: "No Trading Account",
        description: "Please wait for your trading account to load.",
        variant: "destructive"
      })
      return
    }

    // Validate inputs
    const lotSizeNum = parseFloat(volume)
    if (isNaN(lotSizeNum) || lotSizeNum <= 0) {
      toast({
        title: "Invalid Volume",
        description: "Please enter a valid lot size greater than 0",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const orderData = {
        accountId: activeAccount?.id || accounts[0]?.id,
        symbolId: symbolId,
        side: type,
        lotSize: lotSizeNum,
        stopLoss: stopLoss && stopLoss.trim() ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit && takeProfit.trim() ? parseFloat(takeProfit) : null,
        comment: `${type.toUpperCase()} ${symbol} - ${orderType} order via Trade Dialog`
      }

      const trigger = orderType === 'limit'
        ? (limitPrice && limitPrice.trim() ? parseFloat(limitPrice) : null)
        : null

      const requestData = {
        ...orderData,
        orderType: orderType || 'market',
        triggerPrice: trigger
      }

      console.log('Placing order with data:', requestData)
      await openPosition(requestData)
      
      toast({
        title: `${type.toUpperCase()} Order Executed`,
        description: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${volume} lots of ${symbol}`,
      })
      
      setIsOpen(false)
      // Reset form
      setVolume("0.01")
      setStopLoss("")
      setTakeProfit("")
      setLimitPrice("")
    } catch (error: unknown) {
      console.error('Order failed:', error)
      let message = 'Failed to place order. Please try again.'
      if (error instanceof Error) message = error.message
      else if (typeof error === 'string') message = error
      toast({
        title: "Order Failed",
        description: message,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[70vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {isBuy ? (
              <TrendingUp className="h-5 w-5 text-trading-success" />
            ) : (
              <TrendingDown className="h-5 w-5 text-trading-danger" />
            )}
            {isBuy ? "Buy" : "Sell"} {symbol}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Current Price</p>
              <p className="text-2xl font-mono font-bold">{price}</p>
            </div>
            <Badge variant={isBuy ? "default" : "destructive"} className="text-sm px-3 py-1">
              {isBuy ? "BUY" : "SELL"}
            </Badge>
          </div>

          <Tabs value={tabValue} onValueChange={(v) => { setTabValue(v as 'market'|'pending'); setOrderType(v === 'pending' ? 'limit' : 'market') }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="market">Market Order</TabsTrigger>
              <TabsTrigger value="pending">Pending Order</TabsTrigger>
            </TabsList>

            <TabsContent value="market" className="space-y-4 mt-4">
              {/* Phase 5: Leverage Selector */}
              {/* Leverage selector removed for simplified dialog */}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="volume">Volume (Lots)</Label>
                  <Input id="volume" value={volume} onChange={(e) => setVolume(e.target.value)} className="font-mono" />
                  {lotSize > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Contract value: ${(lotSize * 100000 * currentPrice).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Order Type</Label>
                  <Select value={orderType} onValueChange={(v) => { setOrderType(v); if (v === 'limit') setTabValue('pending'); else setTabValue('market'); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="market">Market</SelectItem>
                      <SelectItem value="limit">Limit</SelectItem>
                      <SelectItem value="stop">Stop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Phase 5: Margin Calculator Card */}
              {lotSize > 0 && (
                <Card className="p-3 bg-muted/30 border-muted">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">Margin Calculation</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Required Margin</p>
                      <p className="font-mono font-semibold">${requiredMargin.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Available Margin</p>
                      <p className="font-mono font-semibold">
                        ${marginInfo?.freeMargin?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    {marginLevelAfterTrade && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Margin Level After</p>
                          <p className="font-mono font-semibold text-green-500">
                            {marginLevelAfterTrade.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Current Margin Level</p>
                          <p className="font-mono font-semibold">
                            {marginInfo?.marginLevel?.toFixed(1) || '0.0'}%
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </Card>
              )}

              {/* Phase 5: Position Size from Risk Calculator */}
              {/* Position-from-risk calculator removed */}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stopLoss">Stop Loss</Label>
                  <Input
                    id="stopLoss"
                    placeholder="Optional"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    className="font-mono"
                  />
                  {slCalculation && (
                    <div className="text-xs space-y-0.5">
                      <p className="text-muted-foreground">
                        Distance: <span className="font-mono">{slCalculation.pips} pips</span>
                      </p>
                      <p className="text-red-500 font-medium">
                        Risk: <span className="font-mono">${slCalculation.risk}</span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="takeProfit">Take Profit</Label>
                  <Input
                    id="takeProfit"
                    placeholder="Optional"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    className="font-mono"
                  />
                  {tpCalculation && (
                    <div className="text-xs space-y-0.5">
                      <p className="text-muted-foreground">
                        Distance: <span className="font-mono">{tpCalculation.pips} pips</span>
                      </p>
                      <p className="text-green-500 font-medium">
                        Reward: <span className="font-mono">${tpCalculation.reward}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Phase 5: Commission & Swap Preview */}
              {lotSize > 0 && (
                <Card className="p-3 bg-muted/20 border-muted">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Commission:</span>
                      <span className="font-mono">${estimatedCommission.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Swap (per day):</span>
                      <span className="font-mono">${estimatedSwap.toFixed(2)}</span>
                    </div>
                    {slCalculation && tpCalculation && (
                      <div className="flex justify-between pt-2 border-t border-muted mt-2">
                        <span className="text-muted-foreground">Risk:Reward Ratio:</span>
                        <span className="font-mono font-semibold text-primary">
                          1:{(parseFloat(tpCalculation.reward) / parseFloat(slCalculation.risk)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="pending" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="limitPrice">Limit / Trigger Price</Label>
                  <Input
                    id="limitPrice"
                    placeholder="Enter trigger price"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="text-center py-2 text-muted-foreground">
                  <p className="text-sm">When the market reaches the trigger price the order will be filled.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handlePlaceOrder}
              disabled={isLoading}
              className={`flex-1 ${isBuy ? "bg-trading-success hover:bg-trading-success/90" : "bg-trading-danger hover:bg-trading-danger/90"} text-white`}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
              ) : (
                isBuy ? "Place Buy Order" : "Place Sell Order"
              )}
            </Button>
            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
