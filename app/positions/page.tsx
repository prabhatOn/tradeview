"use client"

import { useState, useEffect } from "react"
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { useTrading } from '@/contexts/TradingContext'
import { usePositions, useClosePosition } from '@/hooks/use-trading'
import { useToast } from "@/hooks/use-toast"
import { TradingSidebar } from "@/components/trading-sidebar"
import { ProtectedRoute } from "@/components/auth/protected-route"
// Trade dialog not used on this page
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
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
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Target, 
  Clock,
  X,
  Edit,
  Loader2,
  RefreshCw,
  Search,
  Edit2
} from "lucide-react"
import { Position } from "@/lib/types"
import { normalizePositions, formatPrice, formatPnL, getPnLColor } from "@/lib/utils-trading"

interface PositionStats {
  totalPositions: number;
  openPositions: number;
  closedPositions: number;
  totalPnL: number;
  totalProfit: number;
  totalLoss: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  currentExposure: number;
  unrealizedPnL: number;
}

export default function PositionsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)
  const { activeAccount } = useTrading()
  const { data: positionsData, isLoading, error, refetch } = usePositions(activeAccount?.id)
  const closePositionMutation = useClosePosition()
  const { toast } = useToast()
  
  // State management
  const [closingPositions, setClosingPositions] = useState<Set<number>>(new Set())
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editStopLoss, setEditStopLoss] = useState('')
  const [editTakeProfit, setEditTakeProfit] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>('')
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sideFilter, setSideFilter] = useState('all')

  // Process positions data
  const rawPositions: Position[] = Array.isArray(positionsData)
    ? (positionsData as Position[])
    : (((positionsData as unknown) as { data?: Position[] } | null)?.data || [])
  const positions = normalizePositions(rawPositions)
  
  // Filter positions
  const filteredPositions = positions.filter((position: Position) => {
    const matchesSearch = !searchTerm || 
      position.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      position.id.toString().includes(searchTerm)
    const matchesStatus = statusFilter === 'all' || position.status === statusFilter
    const matchesSide = sideFilter === 'all' || position.side === sideFilter
    
    return matchesSearch && matchesStatus && matchesSide
  })
  
  const openPositions = filteredPositions.filter((p: Position) => p.status === 'open')
  const pendingPositions = filteredPositions.filter((p: Position) => p.status === 'pending')
  const closedPositions = filteredPositions.filter((p: Position) => p.status === 'closed')

  // Calculate statistics
  const calculateStats = (positions: Position[]): PositionStats => {
    const allPos = positions
    const openPos = allPos.filter(p => p.status === 'open')
    const closedPos = allPos.filter(p => p.status === 'closed')
    const winningTrades = closedPos.filter(p => (p.profit || 0) > 0)
    const losingTrades = closedPos.filter(p => (p.profit || 0) <= 0)
    
    const totalPnL = allPos.reduce((sum, p) => sum + (p.profit || 0), 0)
    const totalProfit = winningTrades.reduce((sum, p) => sum + (p.profit || 0), 0)
    const totalLoss = Math.abs(losingTrades.reduce((sum, p) => sum + (p.profit || 0), 0))
    const currentExposure = openPos.reduce((sum, p) => sum + ((p.volume || p.lotSize || 0) * (p.openPrice || 0)), 0)
    const unrealizedPnL = openPos.reduce((sum, p) => sum + (p.unrealizedPnl || p.profit || 0), 0)
    
    return {
      totalPositions: allPos.length,
      openPositions: openPos.length,
      closedPositions: closedPos.length,
      totalPnL,
      totalProfit,
      totalLoss,
      winRate: closedPos.length > 0 ? (winningTrades.length / closedPos.length) * 100 : 0,
      avgWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0,
      currentExposure,
      unrealizedPnL
    }
  }

  const stats = calculateStats(positions)

  // Handle real-time updates
  useEffect(() => {
    const handleWebSocketMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'positions_update' || data.type === 'realtime_positions_update') {
          refetch()
          setLastUpdate(new Date().toLocaleTimeString())
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

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

  // Handle position actions
  const handleClosePosition = async (positionId: number) => {
    console.log(`🔄 Attempting to close position ${positionId}`)
    setClosingPositions(prev => new Set([...prev, positionId]))
    try {
      const result = await closePositionMutation(positionId)
      console.log(`✅ Position ${positionId} closed successfully:`, result)
      toast({
        title: "Position Closed",
        description: `Position #${positionId} has been closed successfully.`,
      })
      refetch()
    } catch (error) {
      console.error(`❌ Error closing position ${positionId}:`, error)
      toast({
        title: "Error Closing Position",
        description: error instanceof Error ? error.message : "Failed to close position",
        variant: "destructive"
      })
    } finally {
      setClosingPositions(prev => {
        const newSet = new Set(prev)
        newSet.delete(positionId)
        return newSet
      })
    }
  }

  const handleEditPosition = (position: Position) => {
    setSelectedPosition(position)
    setEditStopLoss(position.stopLoss?.toString() || '')
    setEditTakeProfit(position.takeProfit?.toString() || '')
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedPosition) return
    
    setIsUpdating(true)
    try {
      // This would call an update API
      const updateData = {
        stopLoss: editStopLoss ? parseFloat(editStopLoss) : null,
        takeProfit: editTakeProfit ? parseFloat(editTakeProfit) : null,
      }
      
      // TODO: Implement position update API call
      console.log('Updating position:', selectedPosition.id, updateData)
      
      toast({
        title: "Position Updated",
        description: `Position #${selectedPosition.id} has been updated successfully.`,
      })
      
      setIsEditDialogOpen(false)
      refetch()
    } catch (error) {
      toast({
        title: "Error Updating Position",
        description: error instanceof Error ? error.message : "Failed to update position",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const PositionRow = ({ position }: { position: Position }) => {
    const isClosing = closingPositions.has(position.id)
    const pnl = position.status === 'open' 
      ? (position.unrealizedPnl ?? position.profit ?? 0)
      : (position.profit ?? 0)
    const volume = position.volume ?? position.lotSize ?? 0
    const openTime = position.openTime ?? position.openedAt
    const currentPrice = position.currentPrice ?? position.openPrice
    
    return (
      <TableRow key={position.id} className="hover:bg-muted/50">
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">#{position.id}</span>
            <Badge variant={position.status === 'open' ? 'default' : 'secondary'} className="text-xs">
              {position.status}
            </Badge>
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
        <TableCell className="font-mono text-sm">{volume}</TableCell>
        <TableCell className="font-mono text-sm">{formatPrice(position.openPrice)}</TableCell>
        <TableCell className="font-mono text-sm">
          {currentPrice ? formatPrice(currentPrice) : '-'}
        </TableCell>
        <TableCell className="font-mono text-sm">
          {position.stopLoss ? formatPrice(position.stopLoss) : '-'}
        </TableCell>
        <TableCell className="font-mono text-sm">
          {position.takeProfit ? formatPrice(position.takeProfit) : '-'}
        </TableCell>
        <TableCell className={`font-mono text-sm font-semibold ${getPnLColor(pnl)}`}>
          {formatPnL(pnl)}
        </TableCell>
        <TableCell>
          {position.status === 'open' && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditPosition(position)}
                className="h-8 w-8 p-0"
                title="Edit Position"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={isClosing}
                    className="h-8 w-8 p-0"
                    title="Close Position"
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
                      <br />Current P&L: <span className={getPnLColor(pnl)}>{formatPnL(pnl)}</span>
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
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex flex-col">
          <div className="flex flex-1 overflow-hidden">
            <TradingSidebar
              collapsed={sidebarCollapsed}
              onCollapsedChange={setSidebarCollapsed}
            />
            <main className={`flex-1 flex items-center justify-center transition-all duration-300 ${
              sidebarCollapsed ? "sm:pl-20 pl-4" : "sm:pl-68 pl-4"
            }`}>
              <Card className="p-8">
                <CardContent>
                  <p className="text-muted-foreground">No trading account selected</p>
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
        
        {/* Header */}

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <TradingSidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />

          {/* Main Content */}
          <main
            className={`flex-1 flex flex-col gap-6 overflow-auto transition-all duration-300 w-full px-4 sm:px-6 lg:px-8 ${
              sidebarCollapsed
                ? "lg:ml-16 ml-0 pr-0 pt-4 sm:pt-6 sm:pb-6 pb-28 lg:max-w-[calc(100%-80px)]"
                : "lg:ml-64 ml-0 pr-0 pt-4 sm:pt-6 sm:pb-6 pb-28 lg:max-w-[calc(100%-272px)]"
            }`}
          >
            {/* Header with Actions */}
            <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between w-full gap-3">
              <div className="w-full text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Positions</h1>
                <p className="text-muted-foreground">
                  Manage your trading positions and track performance
                </p>
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

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Positions</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalPositions}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.openPositions} open, {stats.closedPositions} closed
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Success rate from closed positions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getPnLColor(stats.totalPnL)}`}>
                    {formatPnL(stats.totalPnL)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All-time profit/loss
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getPnLColor(stats.unrealizedPnL)}`}>
                    {formatPnL(stats.unrealizedPnL)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Open positions P&L
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filters and Search */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search positions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
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
              </CardContent>
            </Card>

            {/* Positions Table */}
            <Card className="flex-1">
              <CardContent className="p-0">
                <Tabs defaultValue="open" className="h-full">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <TabsList className="grid w-full max-w-[500px] grid-cols-3">
                      <TabsTrigger value="open">Open ({openPositions.length})</TabsTrigger>
                      <TabsTrigger value="pending">Pending ({pendingPositions.length})</TabsTrigger>
                      <TabsTrigger value="history">Closed ({closedPositions.length})</TabsTrigger>
                    </TabsList>
                  </div>

                  {error && (
                    <div className="p-4 text-center text-destructive">
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
                        {/* New position action removed as requested */}
                      </div>
                    ) : (
                      <>
                        {/* Mobile card list: visible on small screens */}
                        <div className="sm:hidden p-2 space-y-3 max-h-[60vh] overflow-auto">
                          {openPositions.map((position: Position) => {
                            const pnl = position.unrealizedPnl ?? position.profit ?? 0
                            const volume = position.volume ?? position.lotSize ?? 0
                            const currentPrice = position.currentPrice ?? position.openPrice
                            return (
                              <Card key={position.id} className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="font-semibold">{position.symbol}</div>
                                      <Badge variant={position.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                                        {position.status}
                                      </Badge>
                                      <Badge variant={position.side === 'buy' ? 'default' : 'destructive'} className="text-xs">
                                        {position.side?.toUpperCase() || 'UNKNOWN'}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Position:</span>
                                        <div className="font-mono">#{position.id}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Lots:</span>
                                        <div className="font-mono">{volume}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Open Price:</span>
                                        <div className="font-mono">{formatPrice(position.openPrice)}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Current:</span>
                                        <div className="font-mono">{currentPrice ? formatPrice(currentPrice) : '-'}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">S/L:</span>
                                        <div className="font-mono">{position.stopLoss ? formatPrice(position.stopLoss) : '-'}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">T/P:</span>
                                        <div className="font-mono">{position.takeProfit ? formatPrice(position.takeProfit) : '-'}</div>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                      <div className={`font-mono text-lg font-semibold ${getPnLColor(pnl)}`}>
                                        {formatPnL(pnl)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditPosition(position)}
                                          className="h-8 w-8 p-0"
                                          title="Edit Position"
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              disabled={closingPositions.has(position.id)}
                                              className="h-8 w-8 p-0"
                                              title="Close Position"
                                            >
                                              {closingPositions.has(position.id) ? (
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
                                                <br />Current P&L: <span className={getPnLColor(pnl)}>{formatPnL(pnl)}</span>
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
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            )
                          })}
                        </div>

                        {/* Desktop table: hidden on small screens */}
                        <div className="hidden sm:block overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Position</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead>Symbol</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Lots</TableHead>
                              <TableHead>Open Price</TableHead>
                              <TableHead>Current Price</TableHead>
                              <TableHead>S/L</TableHead>
                              <TableHead>T/P</TableHead>
                              <TableHead>P&L</TableHead>
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
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="pending" className="mt-0">
                    {isLoading && positions.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading pending positions...</span>
                      </div>
                    ) : pendingPositions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No pending positions</p>
                      </div>
                    ) : (
                      <>
                        {/* Mobile card list: visible on small screens */}
                        <div className="sm:hidden p-2 space-y-3 max-h-[50vh] overflow-auto">
                          {pendingPositions.map((position: Position) => {
                            const pnl = position.profit || 0
                            const volume = position.volume ?? position.lotSize ?? 0
                            const openTime = position.openTime ?? position.openedAt
                            return (
                              <Card key={position.id} className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="font-semibold">{position.symbol}</div>
                                      <Badge variant="secondary" className="text-xs">
                                        {position.status}
                                      </Badge>
                                      <Badge variant={position.side === 'buy' ? 'default' : 'destructive'} className="text-xs">
                                        {position.side?.toUpperCase() || 'UNKNOWN'}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Position:</span>
                                        <div className="font-mono">#{position.id}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Lots:</span>
                                        <div className="font-mono">{volume}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Trigger Price:</span>
                                        <div className="font-mono">{position.triggerPrice ? formatPrice(position.triggerPrice) : '-'}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Time:</span>
                                        <div className="text-xs text-muted-foreground">
                                          {openTime ? new Date(openTime).toLocaleTimeString() : '-'}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                      <div className={`font-mono text-lg font-semibold ${getPnLColor(pnl)}`}>
                                        {formatPnL(pnl)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0" title="Refresh">
                                          <RefreshCw className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            )
                          })}
                        </div>

                        {/* Desktop table: hidden on small screens */}
                        <div className="hidden sm:block overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Position</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead>Symbol</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Lots</TableHead>
                              <TableHead>Trigger Price</TableHead>
                              <TableHead>P&L</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pendingPositions.map((position: Position) => (
                              <TableRow key={position.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium">#{position.id}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {position.openTime ? new Date(position.openTime).toLocaleTimeString() : '-'}
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
                                <TableCell className="font-mono text-sm">{position.triggerPrice ? formatPrice(position.triggerPrice) : '-'}</TableCell>
                                <TableCell className={`font-mono text-sm font-semibold ${getPnLColor(position.profit || 0)}`}>
                                  {formatPnL(position.profit || 0)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 w-8 p-0" title="Refresh">
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      </>
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
                      <>
                        {/* Mobile card list: visible on small screens */}
                        <div className="sm:hidden p-2 space-y-3 max-h-[50vh] overflow-auto">
                          {closedPositions.map((position: Position) => {
                            const openTime = position.openTime || position.openedAt
                            const closeTime = position.closeTime || position.closedAt
                            const duration = closeTime && openTime
                              ? new Date(closeTime).getTime() - new Date(openTime).getTime()
                              : 0
                            const durationText = duration > 0 
                              ? `${Math.floor(duration / (1000 * 60))}m`
                              : '-'
                            const pnl = position.profit ?? 0
                            const volume = position.volume ?? position.lotSize ?? 0
                            const closePriceValue = position.closePrice ?? position.currentPrice ?? null
                            return (
                              <Card key={position.id} className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="font-semibold">{position.symbol}</div>
                                      <Badge variant="outline" className="text-xs">
                                        {position.status}
                                      </Badge>
                                      <Badge variant={position.side === 'buy' ? 'default' : 'destructive'} className="text-xs">
                                        {position.side?.toUpperCase() || 'UNKNOWN'}
                                      </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Position:</span>
                                        <div className="font-mono">#{position.id}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Lots:</span>
                                        <div className="font-mono">{volume}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Open:</span>
                                        <div className="font-mono">{formatPrice(position.openPrice)}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Close:</span>
                                        <div className="font-mono">{closePriceValue ? formatPrice(closePriceValue) : '-'}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Duration:</span>
                                        <div className="font-mono">{durationText}</div>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Time:</span>
                                        <div className="text-xs text-muted-foreground">
                                          {closeTime ? new Date(closeTime).toLocaleTimeString() : '-'}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-2">
                                      <div className={`font-mono text-lg font-semibold ${getPnLColor(pnl)}`}>
                                        {formatPnL(pnl)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            )
                          })}
                        </div>

                        {/* Desktop table: hidden on small screens */}
                        <div className="hidden sm:block overflow-auto">
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
                              <TableHead>Duration</TableHead>
                              <TableHead>P&L</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {closedPositions.map((position: Position) => {
                              const openTime = position.openTime || position.openedAt
                              const closeTime = position.closeTime || position.closedAt
                              const duration = closeTime && openTime
                                ? new Date(closeTime).getTime() - new Date(openTime).getTime()
                                : 0
                              const durationText = duration > 0 
                                ? `${Math.floor(duration / (1000 * 60))}m`
                                : '-'
                              const pnl = position.profit ?? 0
                              const closePriceValue = position.closePrice ?? position.currentPrice ?? null
                              
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
                                    {closePriceValue !== null && closePriceValue !== undefined
                                      ? formatPrice(closePriceValue)
                                      : '-'}
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
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </main>
        </div>

        {/* New Position dialog has been removed along with header button */}

        {/* Edit Position Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Position #{selectedPosition?.id}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="stop-loss" className="text-right">
                  Stop Loss
                </Label>
                <Input
                  id="stop-loss"
                  type="number"
                  step="0.00001"
                  value={editStopLoss}
                  onChange={(e) => setEditStopLoss(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter stop loss price"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="take-profit" className="text-right">
                  Take Profit
                </Label>
                <Input
                  id="take-profit"
                  type="number"
                  step="0.00001"
                  value={editTakeProfit}
                  onChange={(e) => setEditTakeProfit(e.target.value)}
                  className="col-span-3"
                  placeholder="Enter take profit price"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSaveEdit} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  )
}