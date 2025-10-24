"use client"

import React, { useEffect, useState } from 'react'
import { useTrading } from '@/contexts/TradingContext'
import { usePositions } from '@/hooks/use-trading'
import { normalizePositions, formatPnL, getPnLColor } from '@/lib/utils-trading'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import type { Position } from '@/lib/types'

export default function PositionBottomBar() {
  const { activeAccount } = useTrading()
  const { data: openData } = usePositions(activeAccount?.id, 'open')
  const { data: closedData } = usePositions(activeAccount?.id, 'closed')

  const [sidebarCollapsed] = useSidebarCollapsed(false)

  const [stats, setStats] = useState({
    openCount: 0,
    closedCount: 0,
    realized: 0,
    unrealized: 0,
  })

  useEffect(() => {
    const rawOpen: Position[] = Array.isArray(openData)
      ? (openData as Position[])
      : (((openData as unknown) as { data?: Position[] } | null)?.data || [])

    const rawClosed: Position[] = Array.isArray(closedData)
      ? (closedData as Position[])
      : (((closedData as unknown) as { data?: Position[] } | null)?.data || [])

    const openPositions = normalizePositions(rawOpen)
    const closedPositions = normalizePositions(rawClosed)

    const openCount = openPositions.length
    const closedCount = closedPositions.length

    const unrealized = openPositions.reduce((s, p: Position) => s + (p.unrealizedPnl ?? p.profit ?? 0), 0)
    const realized = closedPositions.reduce((s, p: Position) => s + ((p.netProfit ?? p.profit) || 0), 0)

    setStats({ openCount, closedCount, realized, unrealized })
  }, [openData, closedData])

  return (
    <div className="fixed left-0 right-0 bottom-16 sm:bottom-0 bg-card/95 border-t z-[2] py-2">
  <div className={`max-w-screen-xl mx-auto transition-all duration-300 ${sidebarCollapsed ? 'sm:pl-20 pl-4 pr-4' : 'sm:pl-68 pl-4 pr-4'}`}>
        {/* Mobile: single-row compact */}
        <div className="flex sm:hidden items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <div>Open: <span className="font-mono">{stats.openCount}</span></div>
            <div>Closed: <span className="font-mono">{stats.closedCount}</span></div>
          </div>
          <div className="flex items-center gap-3">
            <div className={getPnLColor(stats.realized) + " font-mono"}>R: {formatPnL(stats.realized)}</div>
            <div className={getPnLColor(stats.unrealized) + " font-mono"}>U: {formatPnL(stats.unrealized)}</div>
          </div>
        </div>

        {/* Desktop: four columns */}
        <div className="hidden sm:flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <div>Open: <span className="font-mono">{stats.openCount}</span></div>
            <div>Closed: <span className="font-mono">{stats.closedCount}</span></div>
            <div>Realized: <span className={getPnLColor(stats.realized) + " font-mono"}>{formatPnL(stats.realized)}</span></div>
            <div>Unrealized: <span className={getPnLColor(stats.unrealized) + " font-mono"}>{formatPnL(stats.unrealized)}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
