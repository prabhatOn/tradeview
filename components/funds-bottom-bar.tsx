"use client"

import { useEffect, useState } from 'react'
import { useTrading } from '@/contexts/TradingContext'
import { formatPnL } from '@/lib/utils-trading'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'

export default function FundsBottomBar() {
  const { activeAccount, accountSummary } = useTrading()
  const [sidebarCollapsed] = useSidebarCollapsed(false)

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
        totalPnl: accountSummary.totalPnl || 0
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
          totalPnl: accountSummary.totalPnl || 0
        }))
      }
    }

    window.addEventListener('balanceUpdate', handler)
    return () => window.removeEventListener('balanceUpdate', handler)
  }, [activeAccount, accountSummary])

  // Compute a display value for Today P&L with fallbacks:
  // 1) accountSummary.todayPnl (preferred, from API)
  // 2) stats.todayPnl (if set by API via accountSummary)
  // 3) stats.unrealizedPnl (equity - balance) as best-effort fallback
  const displayTodayPnl = accountSummary?.todayPnl ?? stats.todayPnl ?? stats.unrealizedPnl ?? 0

  return (
    <div className="fixed left-0 right-0 sm:bottom-0 bottom-16 bg-card/95 border-t z-[10] py-2">
      <div className={`max-w-screen-xl mx-auto transition-all duration-300 ${sidebarCollapsed ? 'sm:pl-20 pl-4 pr-4' : 'sm:pl-68 pl-4 pr-4'}`}>
        {/* Mobile layout - single row with key stats */}
        <div className="flex sm:hidden items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div>Balance: <span className="font-mono">{stats.balance.toFixed(2)}</span></div>
            <div>Free: <span className="font-mono">{stats.freeMargin.toFixed(2)}</span></div>
          </div>
            <div className="flex items-center gap-3">
            <div>Today P&L: <span className={`font-mono ${displayTodayPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPnL(displayTodayPnl)}</span></div>
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
            <div>Unrealized P&L: <span className={`font-mono ${stats.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPnL(stats.unrealizedPnl)}</span></div>
            <div>Today P&L: <span className={`font-mono ${displayTodayPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPnL(displayTodayPnl)}</span></div>
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
