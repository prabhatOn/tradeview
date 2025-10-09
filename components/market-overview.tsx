"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Search, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import { useMarket } from "@/contexts/MarketContext"
import { useMarketCategories } from "@/hooks/use-trading"
import { MarketData } from "@/lib/types"

export default function MarketOverview() {
  const {
    marketData,
    selectedCategory,
    searchQuery,
    isLoading,
    error,
    lastUpdate,
    setCategory,
    setSearchQuery,
    refreshPrices,
  } = useMarket()
  
  const { data: categoriesData, isLoading: categoriesLoading } = useMarketCategories()
  const [localSearch, setLocalSearch] = useState("")

  // Update search query with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, setSearchQuery])

  const filteredData = marketData.filter((item: MarketData) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch = !searchQuery || 
      item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(price)
  }

  const formatChange = (change: number) => {
    return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2)
  }

  const formatChangePercent = (changePercent: number) => {
    return `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Market Overview</CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                Updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshPrices}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex gap-4 mt-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search symbols..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              {categoriesData?.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label} ({category.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <div className="p-4 text-center text-red-500">
            <p>Error loading market data: {error}</p>
            <Button variant="outline" size="sm" onClick={refreshPrices} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {isLoading && marketData.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading market data...</span>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1 p-4">
              {filteredData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No symbols found matching your search." : "No market data available."}
                </div>
              ) : (
                filteredData.map((item: MarketData) => {
                  const isPositive = item.change >= 0
                  const changeColor = isPositive ? "text-green-500" : "text-red-500"
                  
                  return (
                    <div
                      key={`${item.symbol}-${item.symbolId}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{item.symbol}</p>
                          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.name}</p>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold">
                          {formatPrice(item.currentPrice)}
                        </p>
                        <div className="flex items-center gap-1 justify-end mt-1">
                          {isPositive ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          )}
                          <span className={`text-xs font-medium ${changeColor}`}>
                            {formatChange(item.change)} ({formatChangePercent(item.changePercent)})
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}