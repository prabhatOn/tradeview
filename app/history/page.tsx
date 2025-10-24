"use client"

import { useState, useEffect } from "react"
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { useTrading } from '@/contexts/TradingContext'
import { usePositions } from '@/hooks/use-trading'
import { TradingSidebar } from "@/components/trading-sidebar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Loader2, RefreshCw } from "lucide-react"
import { Position } from "@/lib/types"
import { normalizePositions, formatPrice, formatPnL, getPnLColor } from "@/lib/utils-trading"


export default function HistoryPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)
  const { activeAccount } = useTrading()
  const { data: positionsData, isLoading, error, refetch } = usePositions(activeAccount?.id, 'closed')

  // State management
  // setLastUpdate is reserved for WebSocket-driven realtime updates
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastUpdate, setLastUpdate] = useState<string>('')

  // Filter states
  const [sideFilter, setSideFilter] = useState('all')
  // date range filter: ISO date strings (yyyy-mm-dd)
  const [preset, setPreset] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState<string | null>(null)
  const [toDate, setToDate] = useState<string | null>(null)

  // Process positions data - only closed positions for history
  const rawPositions = Array.isArray(positionsData) ? positionsData as unknown[] : ((positionsData as unknown as { data?: unknown[] })?.data || [])
  const typedRawPositions = rawPositions as Position[]
  const positions = normalizePositions(typedRawPositions)
  const closedPositions = positions.filter((p: Position) => p.status === 'closed')

  // Helper to parse position close time
  const getPositionCloseTime = (position: Position) => {
    return new Date(position.closeTime || position.closedAt || 0)
  }

  // date preset helpers
  const applyPresetDays = (days: number) => {
    setPreset(`${days}`)
    const now = new Date()
    const to = new Date(now)
    const from = new Date(now)
    from.setDate(now.getDate() - (days - 1)) // include today as last day
    // store as yyyy-mm-dd
    const toIso = to.toISOString().slice(0, 10)
    const fromIso = from.toISOString().slice(0, 10)
    setFromDate(fromIso)
    setToDate(toIso)
  }

  const applyCustomRange = () => {
    // custom range already stored in fromDate/toDate inputs
    setPreset(null)
  }

  // Filter positions by side and selected date range (if any)
  const filteredPositions = closedPositions.filter((position: Position) => {
    const matchesSide = sideFilter === 'all' || position.side === sideFilter

    // If no date filter set, include all
    if (!fromDate && !toDate) return matchesSide

    const closeTime = getPositionCloseTime(position)
    if (isNaN(closeTime.getTime())) return false

    // compare using start of day for fromDate and end of day for toDate
    const parseIsoToLocalStart = (iso: string) => {
      const parts = iso.split('-').map(Number)
      if (parts.length !== 3) return null
      const [y, m, d] = parts
      return new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    const parseIsoToLocalEnd = (iso: string) => {
      const parts = iso.split('-').map(Number)
      if (parts.length !== 3) return null
      const [y, m, d] = parts
      return new Date(y, m - 1, d, 23, 59, 59, 999)
    }

    const from = fromDate ? parseIsoToLocalStart(fromDate) : null
    const to = toDate ? parseIsoToLocalEnd(toDate) : null

    if (from && to) return matchesSide && closeTime >= from && closeTime <= to
    if (from) return matchesSide && closeTime >= from
    if (to) return matchesSide && closeTime <= to

    return matchesSide
  })

  // statistics removed — not shown on this page anymore

  // Handle real-time updates
  useEffect(() => {
    // TODO: Connect to WebSocket for real-time updates
    // const handleWebSocketMessage = (event: MessageEvent) => { ... }
    // const ws = new WebSocket('ws://localhost:3001')
    // ws.onmessage = handleWebSocketMessage

    return () => {
      // ws?.close()
    }
  }, [refetch])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

        <main className={`flex-1 flex flex-col gap-6 overflow-auto transition-all duration-300 w-full px-4 sm:px-6 lg:px-8 ${
          sidebarCollapsed ? "lg:ml-16 ml-0 pr-0 pt-6 pb-28 sm:pb-6 lg:max-w-[calc(100%-80px)]" : "lg:ml-64 ml-0 pr-0 pt-6 pb-28 sm:pb-6 lg:max-w-[calc(100%-272px)]"
        }`}>
          <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between w-full gap-3">
            <div className="w-full text-center sm:text-left">
              <h1 className="text-3xl font-bold">Trading History</h1>
              <p className="text-muted-foreground">View your complete trading history and performance</p>
            </div>
            <div className="flex items-center gap-2 self-center sm:self-auto">
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Updated: {lastUpdate}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Statistics removed - replaced by date-range filter below */}

          {/* Date filter (presets + custom range) */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={preset === '1' ? 'default' : 'ghost'} onClick={() => applyPresetDays(1)}>1 day</Button>
                  <Button size="sm" variant={preset === '7' ? 'default' : 'ghost'} onClick={() => applyPresetDays(7)}>7 days</Button>
                  <Button size="sm" variant={preset === '15' ? 'default' : 'ghost'} onClick={() => applyPresetDays(15)}>15 days</Button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={fromDate ?? ''}
                    onChange={(e) => setFromDate(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyCustomRange() }}
                    className="rounded border px-2 py-1 text-sm"
                  />
                  <span className="text-sm">to</span>
                  <input
                    type="date"
                    value={toDate ?? ''}
                    onChange={(e) => setToDate(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyCustomRange() }}
                    className="rounded border px-2 py-1 text-sm"
                  />
                  <Button size="sm" onClick={applyCustomRange}>Apply</Button>
                </div>

                <div>
                  <Select value={sideFilter} onValueChange={setSideFilter}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Side" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sides</SelectItem>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trading History Table */}
          <Card className="flex-1">
            <CardContent className="p-0">
              {error && (
                <div className="p-4 text-center text-destructive">
                  <p>Error loading trading history: {error}</p>
                  <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
                    Retry
                  </Button>
                </div>
              )}

              {isLoading && positions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading trading history...</span>
                </div>
              ) : filteredPositions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No trading history found</p>
                </div>
              ) : (
                <>
                  {/* Mobile: stacked cards */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    {filteredPositions.map((position: Position) => {
                      const openTime = position.openTime || position.openedAt
                      const closeTime = position.closeTime || position.closedAt
                      const duration = closeTime && openTime
                        ? new Date(closeTime).getTime() - new Date(openTime).getTime()
                        : 0
                      const durationText = duration > 0 ? `${Math.floor(duration / (1000 * 60))}m` : '-'
                      const pnl = position.profit ?? 0

                      return (
                        <Card key={position.id} className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono">#{position.id}</span>
                                <Badge variant="secondary" className="text-xs">closed</Badge>
                              </div>
                              <div className="text-sm font-semibold mt-1">{position.symbol}</div>
                              <div className="text-xs text-muted-foreground mt-1">{openTime ? new Date(openTime).toLocaleString() : '-'}</div>
                              <div className="text-xs text-muted-foreground mt-1">Duration: {durationText} • Lots: {position.volume || position.lotSize}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`font-mono font-semibold ${getPnLColor(pnl)}`}>{formatPnL(pnl)}</div>
                              <div className="text-xs text-muted-foreground">Close: {position.closePrice ? formatPrice(position.closePrice) : '-'}</div>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Desktop/tablet: regular table */}
                  <div className="hidden sm:block overflow-auto">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trade</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Lots</TableHead>
                        <TableHead>Open Price</TableHead>
                        <TableHead>Close Price</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>P&L</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPositions.map((position: Position) => {
                        const openTime = position.openTime || position.openedAt
                        const closeTime = position.closeTime || position.closedAt
                        const duration = closeTime && openTime
                          ? new Date(closeTime).getTime() - new Date(openTime).getTime()
                          : 0
                        const durationText = duration > 0
                          ? `${Math.floor(duration / (1000 * 60))}m`
                          : '-'
                        const pnl = position.profit ?? 0

                        return (
                          <TableRow key={position.id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-mono">#{position.id}</span>
                                <Badge variant="secondary" className="text-xs">closed</Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {openTime ? new Date(openTime).toLocaleTimeString() : '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{position.symbol}</TableCell>
                            <TableCell>
                              <Badge variant={position.side === 'buy' ? 'default' : 'destructive'} className="text-xs">
                                {position.side?.toUpperCase() || 'UNKNOWN'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{position.volume || position.lotSize}</TableCell>
                            <TableCell className="font-mono text-sm">{formatPrice(position.openPrice)}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {position.closePrice ? formatPrice(position.closePrice) : '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {durationText}
                            </TableCell>
                            <TableCell className={`font-mono text-sm font-semibold ${getPnLColor(pnl)}`}>
                              {formatPnL(pnl)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                  </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
