"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  X, 
  Clock, 
  Loader2, 
  RefreshCw, 
  Edit2, 
  Check, 
  XCircle, 
  TrendingUp,
  Info,
  Scissors
} from "lucide-react"
import { useTrading } from "@/contexts/TradingContext"
import { usePositions, useClosePosition } from "@/hooks/use-trading"
import { Position } from "@/lib/types"
import { normalizePositions, formatPrice, formatPnL, getPnLColor } from "@/lib/utils-trading"
import { enhancedTradingService } from "@/lib/services"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function PositionsTable() {
  const { activeAccount, isLoading: _tradingLoading } = useTrading()
  const { data: positionsData, isLoading, error, refetch } = usePositions(activeAccount?.id)
  const closePosition = useClosePosition()
  const [closingPositions, setClosingPositions] = useState<Set<number>>(new Set())
  const [lastUpdate, setLastUpdate] = useState<string>('')
  
  // Phase 5 Enhancements
  const { toast } = useToast()
  const [editingSL, setEditingSL] = useState<number | null>(null)
  const [editingTP, setEditingTP] = useState<number | null>(null)
  const [newSL, setNewSL] = useState<string>('')
  const [newTP, setNewTP] = useState<string>('')
  const [updatingPosition, setUpdatingPosition] = useState<number | null>(null)
  const [detailsModalPosition, setDetailsModalPosition] = useState<Position | null>(null)
  const [partialCloseModal, setPartialCloseModal] = useState<Position | null>(null)
  const [partialCloseLots, setPartialCloseLots] = useState<string>('0.01')

  // Update SL/TP handlers
  const handleUpdateStopLoss = async (positionId: number) => {
    setUpdatingPosition(positionId)
    try {
      // Parse the value - if empty or invalid, send null to clear it
      let stopLossValue: number | null = null;
      
      if (newSL && newSL.trim() !== '') {
        const parsed = parseFloat(newSL.trim());
        if (!isNaN(parsed) && parsed > 0) {
          stopLossValue = parsed;
        }
      }
      
      console.log('Stop Loss Input:', newSL);
      console.log('Parsed Stop Loss Value:', stopLossValue);
      console.log('Sending to API:', { positionId, stopLossValue });
      
      await enhancedTradingService.updateStopLoss(positionId, stopLossValue)
      toast({
        title: "Stop Loss Updated",
        description: stopLossValue ? `Stop loss updated to ${stopLossValue}` : "Stop loss cleared",
      })
      setEditingSL(null)
      setNewSL('')
      refetch()
    } catch (error) {
      console.error('Stop loss update error:', error)
      toast({
        title: "Update Failed",
        description: "Failed to update stop loss",
        variant: "destructive"
      })
    } finally {
      setUpdatingPosition(null)
    }
  }

  const handleUpdateTakeProfit = async (positionId: number) => {
    setUpdatingPosition(positionId)
    try {
      // Parse the value - if empty or invalid, send null to clear it
      let takeProfitValue: number | null = null;
      
      if (newTP && newTP.trim() !== '') {
        const parsed = parseFloat(newTP.trim());
        if (!isNaN(parsed) && parsed > 0) {
          takeProfitValue = parsed;
        }
      }
      
      console.log('Take Profit Input:', newTP);
      console.log('Parsed Take Profit Value:', takeProfitValue);
      console.log('Sending to API:', { positionId, takeProfitValue });
      
      await enhancedTradingService.updateTakeProfit(positionId, takeProfitValue)
      toast({
        title: "Take Profit Updated",
        description: takeProfitValue ? `Take profit updated to ${takeProfitValue}` : "Take profit cleared",
      })
      setEditingTP(null)
      setNewTP('')
      refetch()
    } catch (error) {
      console.error('Take profit update error:', error)
      toast({
        title: "Update Failed",
        description: "Failed to update take profit",
        variant: "destructive"
      })
    } finally {
      setUpdatingPosition(null)
    }
  }

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
  const rawPositions = Array.isArray(positionsData) ? positionsData : ((positionsData as unknown as any)?.data || [])
  const positions = normalizePositions(rawPositions)
  const openPositions = positions.filter((p: Position) => p.status === 'open')
  const pendingPositions = positions.filter((p: Position) => p.status === 'pending')
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
    const isEditingSL = editingSL === position.id
    const isEditingTP = editingTP === position.id
    const isUpdating = updatingPosition === position.id
    
    // Use enhanced backend fields with proper fallbacks
    const pnl = position.status === 'open' 
      ? (position.unrealizedPnl ?? position.profit ?? 0)
      : (position.profit ?? 0)
    const netPnL = position.netProfit ?? (pnl - (position.commission || 0) - (position.swap || 0))
    const positionType = position.side
    const volume = position.volume ?? position.lotSize ?? 0
    const openTime = position.openTime ?? position.openedAt
    const currentPrice = position.currentPrice ?? position.openPrice
    
    // Phase 5: Calculate margin usage
    const marginUsed = (position as any).marginRequired ?? 0
    const marginPercent = (activeAccount as any)?.marginUsed 
      ? ((marginUsed / (activeAccount as any).marginUsed) * 100).toFixed(1)
      : '0'
    
    return (
      <TableRow key={position.id} className="group hover:bg-muted/50">
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
        
        {/* Phase 5: Enhanced SL with inline editing */}
        <TableCell className="font-mono text-sm">
          {position.status === 'open' ? (
            <div className="flex items-center gap-1">
              {isEditingSL ? (
                <>
                  <Input
                    type="number"
                    step="0.00001"
                    value={newSL}
                    onChange={(e) => setNewSL(e.target.value)}
                    className="h-7 w-24 text-xs"
                    placeholder="SL Price"
                    disabled={isUpdating}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateStopLoss(position.id)
                      } else if (e.key === 'Escape') {
                        setEditingSL(null)
                        setNewSL('')
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => handleUpdateStopLoss(position.id)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-500" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setEditingSL(null)
                      setNewSL('')
                    }}
                    disabled={isUpdating}
                  >
                    <XCircle className="h-3 w-3 text-red-500" />
                  </Button>
                </>
              ) : (
                <>
                  <span>{position.stopLoss ? formatPrice(position.stopLoss) : '-'}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      setEditingSL(position.id)
                      setNewSL(position.stopLoss?.toString() || '')
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <span>{position.stopLoss ? formatPrice(position.stopLoss) : '-'}</span>
          )}
        </TableCell>
        
        {/* Phase 5: Enhanced TP with inline editing */}
        <TableCell className="font-mono text-sm">
          {position.status === 'open' ? (
            <div className="flex items-center gap-1">
              {isEditingTP ? (
                <>
                  <Input
                    type="number"
                    step="0.00001"
                    value={newTP}
                    onChange={(e) => setNewTP(e.target.value)}
                    className="h-7 w-24 text-xs"
                    placeholder="TP Price"
                    disabled={isUpdating}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateTakeProfit(position.id)
                      } else if (e.key === 'Escape') {
                        setEditingTP(null)
                        setNewTP('')
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => handleUpdateTakeProfit(position.id)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-500" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setEditingTP(null)
                      setNewTP('')
                    }}
                    disabled={isUpdating}
                  >
                    <XCircle className="h-3 w-3 text-red-500" />
                  </Button>
                </>
              ) : (
                <>
                  <span>{position.takeProfit ? formatPrice(position.takeProfit) : '-'}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                    onClick={() => {
                      setEditingTP(position.id)
                      setNewTP(position.takeProfit?.toString() || '')
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <span>{position.takeProfit ? formatPrice(position.takeProfit) : '-'}</span>
          )}
        </TableCell>
        
        {/* Phase 5: Enhanced Swap with daily charge info */}
        <TableCell className="font-mono text-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1">
                  {formatPnL(position.swap)}
                  {(position as {daysHeld?: number}).daysHeld && (position as {daysHeld?: number}).daysHeld! > 0 && (
                    <span className="text-xs text-muted-foreground">({(position as {daysHeld?: number}).daysHeld}d)</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div>Total Swap: {formatPnL(position.swap)}</div>
                  {(position as {dailySwapCharge?: number}).dailySwapCharge && (
                    <div>Daily: {formatPnL((position as {dailySwapCharge?: number}).dailySwapCharge!)}</div>
                  )}
                  {(position as {daysHeld?: number}).daysHeld && <div>Days: {(position as {daysHeld?: number}).daysHeld}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        
        {/* Phase 5: Enhanced Profit with margin info */}
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
            {position.status === 'open' && marginUsed > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {marginPercent}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      Margin Used: ${marginUsed.toFixed(2)}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>
        
        <TableCell>
          {position.status === 'open' && (
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPartialCloseModal(position)}
                    >
                      <Scissors className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Partial Close</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setDetailsModalPosition(position)}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Position Details</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
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
            </div>
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
            <TabsList className="grid w-full max-w-[500px] grid-cols-3">
              <TabsTrigger value="open">Open ({openPositions.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingPositions.length})</TabsTrigger>
              <TabsTrigger value="history">History ({closedPositions.length})</TabsTrigger>
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

          <TabsContent value="pending" className="mt-0">
            {isLoading && positions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading positions...</span>
              </div>
            ) : pendingPositions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No pending positions</p>
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
                      <TableHead>Trigger Price</TableHead>
                      <TableHead>Profit</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPositions.map((position: Position) => (
                      <TableRow key={position.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{position.id}</span>
                            <Badge variant="secondary">pending</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">{position.openTime ? new Date(position.openTime).toLocaleTimeString() : '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{position.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={position.side === 'buy' ? 'default' : 'destructive'}>
                            {position.side?.toUpperCase() || 'UNKNOWN'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{position.volume ?? position.lotSize}</TableCell>
                        <TableCell className="font-mono text-sm">{position.triggerPrice ? position.triggerPrice : '-'}</TableCell>
                        <TableCell className={`font-mono text-sm font-semibold ${getPnLColor(position.profit || 0)}`}>
                          {formatPnL(position.profit || 0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={refetch} className="h-8 w-8 p-0" title="Refresh">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
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
      
      {/* Phase 5: Position Details Modal */}
      <Dialog open={!!detailsModalPosition} onOpenChange={(open) => !open && setDetailsModalPosition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Position #{detailsModalPosition?.id} Details</DialogTitle>
            <DialogDescription>
              Complete information for {detailsModalPosition?.symbol}
            </DialogDescription>
          </DialogHeader>
          {detailsModalPosition && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Symbol</p>
                  <p className="font-semibold">{detailsModalPosition.symbol}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <Badge variant={detailsModalPosition.side === 'buy' ? 'default' : 'destructive'}>
                    {detailsModalPosition.side?.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Volume</p>
                  <p className="font-mono">{detailsModalPosition.lotSize} lots</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Open Price</p>
                  <p className="font-mono">{formatPrice(detailsModalPosition.openPrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Price</p>
                  <p className="font-mono">{formatPrice(detailsModalPosition.currentPrice ?? detailsModalPosition.openPrice)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Profit/Loss</p>
                  <p className={`font-mono font-semibold ${getPnLColor(detailsModalPosition.profit ?? 0)}`}>
                    {formatPnL(detailsModalPosition.profit ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Commission</p>
                  <p className="font-mono">{formatPnL(detailsModalPosition.commission || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Swap Charges</p>
                  <p className="font-mono">{formatPnL(detailsModalPosition.swap || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Profit</p>
                  <p className={`font-mono font-semibold ${getPnLColor(detailsModalPosition.netProfit ?? 0)}`}>
                    {formatPnL(detailsModalPosition.netProfit ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Margin Used</p>
                  <p className="font-mono">${((detailsModalPosition as {marginRequired?: number}).marginRequired || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stop Loss</p>
                  <p className="font-mono">{detailsModalPosition.stopLoss ? formatPrice(detailsModalPosition.stopLoss) : 'None'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Take Profit</p>
                  <p className="font-mono">{detailsModalPosition.takeProfit ? formatPrice(detailsModalPosition.takeProfit) : 'None'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Opened At</p>
                  <p className="text-sm">
                    {detailsModalPosition.openedAt ? new Date(detailsModalPosition.openedAt).toLocaleString() : '-'}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsModalPosition(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Phase 5: Partial Close Modal */}
      <Dialog open={!!partialCloseModal} onOpenChange={(open) => !open && setPartialCloseModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partial Close Position</DialogTitle>
            <DialogDescription>
              Close part of position #{partialCloseModal?.id}
            </DialogDescription>
          </DialogHeader>
          {partialCloseModal && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="partialLots">Lots to Close</Label>
                <Input
                  id="partialLots"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={partialCloseModal.lotSize}
                  value={partialCloseLots}
                  onChange={(e) => setPartialCloseLots(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Available: {partialCloseModal.lotSize} lots
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current P&L</p>
                    <p className={`font-mono font-semibold ${getPnLColor(partialCloseModal.profit ?? 0)}`}>
                      {formatPnL(partialCloseModal.profit ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Estimated Partial P&L</p>
                    <p className="font-mono font-semibold">
                      {formatPnL(((partialCloseModal.profit ?? 0) * parseFloat(partialCloseLots || '0')) / partialCloseModal.lotSize)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialCloseModal(null)}>Cancel</Button>
            <Button 
              onClick={async () => {
                // Placeholder for partial close functionality
                toast({
                  title: "Feature Coming Soon",
                  description: "Partial close functionality will be available in the next update",
                })
                setPartialCloseModal(null)
              }}
            >
              Close {partialCloseLots} Lots
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// Export both as named and default
export { PositionsTable }
export default PositionsTable