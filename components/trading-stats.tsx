"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Activity } from "lucide-react"

const mockStats = {
  totalProfit: "+2,847.65",
  todayProfit: "+317.65",
  winRate: "68.5%",
  totalTrades: "247",
  activeTrades: "3",
  equity: "$15,847.92",
  margin: "$2,450.00",
  freeMargin: "$13,397.92",
}

export function TradingStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Performance Overview */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-trading-success" />
                <span className="text-xs text-muted-foreground">Total P&L</span>
              </div>
              <div className="font-mono text-lg font-bold text-trading-success">{mockStats.totalProfit}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-trading-info" />
                <span className="text-xs text-muted-foreground">Today</span>
              </div>
              <div className="font-mono text-lg font-bold text-trading-success">{mockStats.todayProfit}</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">Win Rate</span>
            <Badge variant="secondary">
              {mockStats.winRate}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Equity</span>
              <span className="font-mono font-semibold">{mockStats.equity}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Margin</span>
              <span className="font-mono text-sm">{mockStats.margin}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Free Margin</span>
              <span className="font-mono text-sm text-trading-success">{mockStats.freeMargin}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">Active Trades</span>
            <Badge variant="outline">
              {mockStats.activeTrades}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
