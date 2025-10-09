"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import { useTrading } from "@/contexts/TradingContext"
import { useToast } from "@/hooks/use-toast"

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
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const { activeAccount, accounts, openPosition } = useTrading()
  const { toast } = useToast()

  const isBuy = type === "buy"

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

      console.log('Placing order with data:', orderData)
      await openPosition(orderData)
      
      toast({
        title: `${type.toUpperCase()} Order Executed`,
        description: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${volume} lots of ${symbol}`,
      })
      
      setIsOpen(false)
      // Reset form
      setVolume("0.01")
      setStopLoss("")
      setTakeProfit("")
    } catch (error: any) {
      console.error('Order failed:', error)
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
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

          <Tabs defaultValue="market" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="market">Market Order</TabsTrigger>
              <TabsTrigger value="pending">Pending Order</TabsTrigger>
            </TabsList>

            <TabsContent value="market" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="volume">Volume (Lots)</Label>
                  <Input id="volume" value={volume} onChange={(e) => setVolume(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Order Type</Label>
                  <Select value={orderType} onValueChange={setOrderType}>
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
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pending" className="space-y-4 mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <p>Pending order functionality</p>
                <p className="text-sm">Set price levels for future execution</p>
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
