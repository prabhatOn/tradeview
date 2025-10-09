"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, Clock, Loader2, RefreshCw } from "lucide-react"
import { useTrading } from "@/contexts/TradingContext"
import { usePositions, useClosePosition } from "@/hooks/use-trading"
import { Position } from "@/lib/types"
import { normalizePositions, formatPrice, formatPnL, getPnLColor } from "@/lib/utils-trading"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

function PositionsTable() {
  const { activeAccount, isLoading: tradingLoading } = useTrading()
  const { data: positionsData, isLoading, error, refetch } = usePositions(activeAccount?.id)
  const closePosition = useClosePosition()
  const [closingPositions, setClosingPositions] = useState<Set<number>>(new Set())
  const [lastUpdate, setLastUpdate] = useState<string>('')

  // Handle real-time position updates via WebSocket
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'positions_update' || data.type === 'realtime_positions_update') {
          // Refresh positions when real-time updates are received
          refetch()
          setLastUpdate(new Date().toLocaleTimeString())
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    // Connect to WebSocket if available
    if (typeof window !== 'undefined' && window.WebSocket) {
      try {
        const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002')
        ws.addEventListener('message', handleWebSocketMessage)
        
        ws.onopen = () => {
          console.log('WebSocket connected for positions updates')
        }

        return () => {
          ws.removeEventListener('message', handleWebSocketMessage)
          ws.close()
        }
      } catch (error) {
        console.error('WebSocket connection failed:', error)
      }
    }
  }, [refetch])

  // Normalize positions data from backend
  const rawPositions = Array.isArray(positionsData) ? positionsData : ((positionsData as any)?.data || [])
  const positions = normalizePositions(rawPositions)
  const openPositions = positions.filter((p: Position) => p.status === 'open')
  const closedPositions = positions.filter((p: Position) => p.status === 'closed')

  const handleClosePosition = async (positionId: number) => {
    setClosingPositions(prev => new Set([...prev, positionId]))
    try {
      await closePosition(positionId)
      // Position is automatically removed from the list by the context
    } catch (error) {
      console.error('Failed to close position:', error)
    } finally {
      setClosingPositions(prev => {
        const newSet = new Set(prev)
        newSet.delete(positionId)
        return newSet
      })
    }
  }

  const PositionRow = ({ position }: { position: Position }) => {
    const isClosing = closingPositions.has(position.id)
    
    // Use enhanced backend fields with proper fallbacks
    const pnl = position.status === 'open' 
      ? (position.unrealizedPnl ?? position.profit ?? 0)
      : (position.profit ?? 0)
    const netPnL = position.netProfit ?? (pnl - (position.commission || 0) - (position.swap || 0))
    const positionType = position.side
    const volume = position.volume ?? position.lotSize ?? 0
    const openTime = position.openTime ?? position.openedAt
    const closeTime = position.closeTime ?? position.closedAt
    const currentPrice = position.currentPrice ?? position.openPrice
    
    return (
      <TableRow key={position.id}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <span>{position.id}</span>
            <Badge variant={position.status === 'open' ? 'default' : 'secondary'}>
              {position.status}
            </Badge>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">
              {openTime ? new Date(openTime).toLocaleTimeString() : '-'}
            </span>
          </div>
        </TableCell>
        <TableCell className="font-semibold">{position.symbol}</TableCell>
        <TableCell>
          <Badge variant={positionType === 'buy' ? 'default' : 'destructive'}>
            {positionType?.toUpperCase() || 'UNKNOWN'}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-sm">{volume}</TableCell>
        <TableCell className="font-mono text-sm">{formatPrice(position.openPrice)}</TableCell>
        <TableCell className="font-mono text-sm">
          {currentPrice ? formatPrice(currentPrice) : '-'}
        </TableCell>
        <TableCell className="font-mono text-sm">
          {position.status === 'closed' && position.closePrice 
            ? formatPrice(position.closePrice) 
            : '-'
          }
        </TableCell>
        <TableCell className="font-mono text-sm">
          {position.stopLoss ? formatPrice(position.stopLoss) : '-'}
        </TableCell>
        <TableCell className="font-mono text-sm">
          {position.takeProfit ? formatPrice(position.takeProfit) : '-'}
        </TableCell>
        <TableCell className="font-mono text-sm">
          {formatPnL(position.swap)}
        </TableCell>
        <TableCell className="font-mono text-sm">
          <div className="flex flex-col gap-1">
            <span className={`font-semibold ${getPnLColor(pnl)}`}>
              {formatPnL(pnl)}
            </span>
            {position.status === 'open' && Math.abs(netPnL - pnl) > 0.01 && (
              <span className={`text-xs ${getPnLColor(netPnL)}`}>
                Net: {formatPnL(netPnL)}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {position.status === 'open' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  disabled={isClosing}
                  className="h-8 w-8 p-0"
                >
                  {isClosing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close Position</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to close position #{position.id} for {position.symbol}?
                    Current P&L: <span className={getPnLColor(pnl)}>{formatPnL(pnl)}</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleClosePosition(position.id)}>
                    Close Position
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </TableCell>
      </TableRow>
    )
  }

  if (!activeAccount) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">No trading account selected</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardContent className="p-0">
        <Tabs defaultValue="open" className="h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <TabsList className="grid w-full max-w-[300px] grid-cols-2">
              <TabsTrigger value="open">
                Open Positions ({openPositions.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                History ({closedPositions.length})
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Updated: {lastUpdate}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={refetch}
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

          {error && (
            <div className="p-4 text-center text-red-500">
              <p>Error loading positions: {error}</p>
              <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
                Retry
              </Button>
            </div>
          )}

          <TabsContent value="open" className="mt-0">
            {isLoading && positions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading positions...</span>
              </div>
            ) : openPositions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No open positions</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Lots</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Close Price</TableHead>
                      <TableHead>S/L</TableHead>
                      <TableHead>T/P</TableHead>
                      <TableHead>Swap</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openPositions.map((position: Position) => (
                      <PositionRow key={position.id} position={position} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            {isLoading && positions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading history...</span>
              </div>
            ) : closedPositions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No trading history</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Lots</TableHead>
                      <TableHead>Open Price</TableHead>
                      <TableHead>Close Price</TableHead>
                      <TableHead>S/L</TableHead>
                      <TableHead>T/P</TableHead>
                      <TableHead>Swap</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedPositions.map((position: Position) => {
                      const openTime = position.openTime || position.openedAt
                      const closeTime = position.closeTime || position.closedAt
                      const positionType = position.positionType || position.side
                      const volume = position.volume || position.lotSize
                      const pnl = position.profitLoss || position.profit
                      
                      const duration = closeTime && openTime
                        ? new Date(closeTime).getTime() - new Date(openTime).getTime()
                        : 0
                      const durationText = duration > 0 
                        ? `${Math.floor(duration / (1000 * 60))}m`
                        : '-'
                      
                      return (
                        <TableRow key={position.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{position.id}</span>
                              <Badge variant="secondary">closed</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">
                                {openTime ? new Date(openTime).toLocaleTimeString() : '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">{position.symbol}</TableCell>
                          <TableCell>
                            <Badge variant={positionType === 'buy' ? 'default' : 'destructive'}>
                              {positionType?.toUpperCase() || 'UNKNOWN'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{volume}</TableCell>
                          <TableCell className="font-mono text-sm">{formatPrice(position.openPrice)}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {position.closePrice ? formatPrice(position.closePrice) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {position.stopLoss ? formatPrice(position.stopLoss) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {position.takeProfit ? formatPrice(position.takeProfit) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPnL(position.swap)}
                          </TableCell>
                          <TableCell className={`font-mono text-sm font-semibold ${getPnLColor(pnl)}`}>
                            {formatPnL(pnl)}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {durationText}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Export both as named and default
export { PositionsTable }
export default PositionsTable