"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"
import { useMarket } from "@/contexts/MarketContext"
import { useHistoricalData } from "@/hooks/use-trading"
import TradingViewChart from "./trading-view-chart"
import { Toaster } from "@/components/ui/toaster"

const DEFAULT_TIMEFRAME = '1h'

export default function TradingChart() {
  const { selectedSymbol, marketData, isLoading: marketLoading } = useMarket()

  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME)
  

  useEffect(() => {
    // simple debug logging
    // console.log('TradingChart - selectedSymbol:', selectedSymbol)
  }, [selectedSymbol, marketData, marketLoading])

  const currentSymbolData = marketData.find(item => item.symbol === selectedSymbol) || null

  const {
    error: historyError,
    refetch: refetchHistory
  } = useHistoricalData(selectedSymbol, timeframe)

  // Order UI removed — no on-chart buy/sell in this version

  return (
    <div className="h-full">
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
              <button className="px-3 py-1 border rounded text-sm" onClick={refetchHistory}>Retry</button>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
              <div className="h-full"><TradingViewChart symbol={selectedSymbol || 'EURUSD'} timeframe={timeframe} onBuy={()=>{}} onSell={()=>{}} onChangeTimeframe={setTimeframe} /></div>
          </div>
        )}
      <Toaster />
    </div>
  )
}