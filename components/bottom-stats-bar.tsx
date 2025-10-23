"use client"

import { useEffect, useState } from "react"
import { useTrading } from "@/contexts/TradingContext"

export default function BottomStatsBar() {
  const { activeAccount, accountSummary } = useTrading()
  const [stats, setStats] = useState({
    balance: 0,
    equity: 0,
    usedMargin: 0,
    freeMargin: 0,
    marginLevel: 0,
    unrealizedPnl: 0,
    todayPnl: 0,
    totalPnl: 0
  })

  // update logic inlined in useEffect to satisfy hook dependency rules

  useEffect(() => {
    if (activeAccount) {
      const balance = activeAccount.balance || 0
      const equity = activeAccount.equity || 0
      const unrealizedPnl = parseFloat((equity - balance).toFixed(2))
      setStats(prev => ({
        ...prev,
        balance,
        equity,
        usedMargin: activeAccount.usedMargin || 0,
        freeMargin: activeAccount.freeMargin || 0,
        marginLevel: activeAccount.marginLevel || 0,
        unrealizedPnl
      }))
    }

    if (accountSummary) {
      setStats(prev => ({
        ...prev,
        todayPnl: accountSummary.todayPnl || 0,
        totalPnl: accountSummary.totalPnl || 0,
      }))
    }
  }, [activeAccount, accountSummary])

  useEffect(() => {
    const handler = () => {
      if (activeAccount) {
        const balance = activeAccount.balance || 0
        const equity = activeAccount.equity || 0
        const unrealizedPnl = parseFloat((equity - balance).toFixed(2))
        setStats(prev => ({
          ...prev,
          balance,
          equity,
          usedMargin: activeAccount.usedMargin || 0,
          freeMargin: activeAccount.freeMargin || 0,
          marginLevel: activeAccount.marginLevel || 0,
          unrealizedPnl
        }))
      }

      if (accountSummary) {
        setStats(prev => ({
          ...prev,
          todayPnl: accountSummary.todayPnl || 0,
          totalPnl: accountSummary.totalPnl || 0,
        }))
      }
    }
    window.addEventListener('balanceUpdate', handler)
    return () => window.removeEventListener('balanceUpdate', handler)
  }, [activeAccount, accountSummary])

  return (
    <div className="fixed left-0 right-0 sm:bottom-0 bottom-16 z-[10001] bg-background/80 backdrop-blur-sm border-t py-2">
      <div className="max-w-screen-xl mx-auto px-4">
        {/* Mobile layout - single row with key stats */}
        <div className="flex sm:hidden items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div>Balance: <span className="font-mono">{stats.balance.toFixed(2)}</span></div>
            <div>Free: <span className="font-mono">{stats.freeMargin.toFixed(2)}</span></div>
          </div>
          <div className="flex items-center gap-3">
            <div>Today P&L: <span className="font-mono">{stats.todayPnl.toFixed(2)}</span></div>
            {stats.marginLevel > 0 && (
              <div>Margin: <span className="font-mono">{stats.marginLevel.toFixed(1)}%</span></div>
            )}
          </div>
        </div>

        {/* Desktop layout - two columns */}
        <div className="hidden sm:flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div>Balance: <span className="font-mono">{stats.balance.toFixed(2)}</span></div>
            {Number(stats.equity.toFixed(2)) !== Number(stats.balance.toFixed(2)) && (
              <div>Equity: <span className="font-mono">{stats.equity.toFixed(2)}</span></div>
            )}
            <div>Unrealized P&L: <span className="font-mono">{stats.unrealizedPnl.toFixed(2)}</span></div>
            <div>Today P&L: <span className="font-mono">{stats.todayPnl.toFixed(2)}</span></div>
          </div>
          <div className="flex items-center gap-4">
            <div>Used: <span className="font-mono">{stats.usedMargin.toFixed(2)}</span></div>
            <div>Free: <span className="font-mono">{stats.freeMargin.toFixed(2)}</span></div>
            <div>Margin Level: <span className="font-mono">{stats.marginLevel.toFixed(1)}%</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
