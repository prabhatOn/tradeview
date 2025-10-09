"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LayoutDashboard,
  Users,
  Building2,
  Receipt,
  TrendingUp,
  HeadphonesIcon,
  CreditCard,
  Wallet,
  Search,
  Plus,
  Eye,
  Edit,
  X,
  Trash2,
  RefreshCw,
  Activity,
  DollarSign,
  BarChart3,
  Target,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Calendar,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2
} from "lucide-react"

const adminSidebarItems = [
  { title: "Overview", icon: LayoutDashboard, href: "/admin", description: "Dashboard overview and analytics" },
  { title: "User Management", icon: Users, href: "/admin/users", description: "Manage users and accounts" },
  { title: "MAM/PAMM", icon: Building2, href: "/admin/mam-pamm", description: "Multi-account management" },
  { title: "Trades & Charges", icon: Receipt, href: "/admin/trades-charges", description: "Trading fees and charges" },
  { title: "Trades", icon: TrendingUp, href: "/admin/trades", description: "Trading activities monitoring" },
  { title: "Support Tickets", icon: HeadphonesIcon, href: "/admin/support", description: "Customer support management" },
  { title: "Deposits/Withdrawals", icon: CreditCard, href: "/admin/deposits-withdrawals", description: "Transaction management" },
  { title: "Payment Gateway", icon: Wallet, href: "/admin/payment-gateway", description: "Payment processing settings" },
]

const adminTopBarConfig = {
  title: "Admin Portal",
  showBalance: false,
  showNotifications: true,
  showDeposit: false,
  showUserMenu: true,
}

const openTrades = [
  {
    id: 1,
    user: "John Doe",
    userId: "101",
    symbol: "EURUSD",
    type: "BUY",
    lotSize: 0.1,
    openPrice: 1.085,
    currentPrice: 1.0875,
    pnl: 25.00,
    openTime: "2024-01-15 09:30:00",
    commission: 2.50
  },
  {
    id: 2,
    user: "Sarah Connor",
    userId: "102",
    symbol: "GBPUSD",
    type: "SELL",
    lotSize: 0.15,
    openPrice: 1.2650,
    currentPrice: 1.2625,
    pnl: 37.50,
    openTime: "2024-01-15 11:45:00",
    commission: 3.75
  },
  {
    id: 4,
    user: "David Wilson",
    userId: "104",
    symbol: "USDJPY",
    type: "BUY",
    lotSize: 0.2,
    openPrice: 148.50,
    currentPrice: 148.75,
    pnl: 33.56,
    openTime: "2024-01-15 14:20:00",
    commission: 5.00
  },
  {
    id: 5,
    user: "Emma Johnson",
    userId: "105",
    symbol: "AUDUSD",
    type: "SELL",
    lotSize: 0.12,
    openPrice: 0.6850,
    currentPrice: 0.6835,
    pnl: 18.00,
    openTime: "2024-01-15 16:10:00",
    commission: 3.00
  }
]

const closedTrades = [
  {
    id: 3,
    user: "Mike Johnson",
    userId: "103",
    symbol: "USDJPY",
    type: "BUY",
    lotSize: 0.2,
    openPrice: 148.5,
    closePrice: 149.25,
    pnl: 150.00,
    openTime: "2024-01-14 10:15:00",
    closeTime: "2024-01-15 08:30:00",
    commission: 5.00,
    duration: "22h 15m"
  },
  {
    id: 6,
    user: "Alex Thompson",
    userId: "106",
    symbol: "EURUSD",
    type: "SELL",
    lotSize: 0.08,
    openPrice: 1.0890,
    closePrice: 1.0870,
    pnl: 16.00,
    openTime: "2024-01-14 13:20:00",
    closeTime: "2024-01-14 18:45:00",
    commission: 2.00,
    duration: "5h 25m"
  },
  {
    id: 7,
    user: "Lisa Wang",
    userId: "107",
    symbol: "GBPUSD",
    type: "BUY",
    lotSize: 0.25,
    openPrice: 1.2680,
    closePrice: 1.2645,
    pnl: -87.50,
    openTime: "2024-01-13 09:00:00",
    closeTime: "2024-01-14 15:30:00",
    commission: 6.25,
    duration: "1d 6h 30m"
  }
]

export default function TradesPage() {
  const [activeTab, setActiveTab] = useState("open")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [symbolFilter, setSymbolFilter] = useState("all")

  const totalOpenPnL = openTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  const totalClosedPnL = closedTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  const totalVolume = [...openTrades, ...closedTrades].reduce((sum, trade) => sum + trade.lotSize, 0)
  const totalCommission = [...openTrades, ...closedTrades].reduce((sum, trade) => sum + trade.commission, 0)

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Trades Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor and manage all trading positions
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg backdrop-blur-sm">
              <Plus className="h-4 w-4 mr-2" />
              New Trade
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open Trades</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{openTrades.length}</div>
              <p className="text-xs text-green-600">${totalOpenPnL.toFixed(2)} P&L</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Closed Trades</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{closedTrades.length}</div>
              <p className="text-xs text-blue-600">${totalClosedPnL.toFixed(2)} P&L</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Volume</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{totalVolume.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Lots</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Commission</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${totalCommission.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Earned</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search trades..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background/60 backdrop-blur-sm border-border/20"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-background/60 backdrop-blur-sm border-border/20">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="profitable">Profitable</SelectItem>
                    <SelectItem value="loss">Loss</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={symbolFilter} onValueChange={setSymbolFilter}>
                  <SelectTrigger className="w-40 bg-background/60 backdrop-blur-sm border-border/20">
                    <SelectValue placeholder="Filter by symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Symbols</SelectItem>
                    <SelectItem value="EURUSD">EURUSD</SelectItem>
                    <SelectItem value="GBPUSD">GBPUSD</SelectItem>
                    <SelectItem value="USDJPY">USDJPY</SelectItem>
                    <SelectItem value="AUDUSD">AUDUSD</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trades Tabs */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <Tabs defaultValue="open" className="w-full">
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-2 bg-muted/30 backdrop-blur-sm">
                <TabsTrigger value="open" className="flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span>Open Trades ({openTrades.length})</span>
                </TabsTrigger>
                <TabsTrigger value="closed" className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Closed Trades ({closedTrades.length})</span>
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Open Trades Tab */}
              <TabsContent value="open" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Open Positions</h3>
                  <p className="text-sm text-muted-foreground">Currently active trading positions</p>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Trade ID</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Symbol</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Lot Size</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Open Price</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Current Price</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">P&L</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openTrades.map((trade) => (
                        <TableRow key={trade.id} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Activity className="h-4 w-4 text-green-600" />
                              </div>
                              <span className="font-semibold text-foreground">{trade.id}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-foreground">{trade.user}</div>
                              <div className="text-xs text-muted-foreground">ID: {trade.userId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-foreground">{trade.symbol}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={`font-medium ${
                                trade.type === 'BUY'
                                  ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                  : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                              }`}
                            >
                              {trade.type === 'BUY' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                              {trade.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{trade.lotSize}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{trade.openPrice}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{trade.currentPrice}</span>
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono font-semibold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${trade.pnl.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30">
                                <Edit className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30">
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Closed Trades Tab */}
              <TabsContent value="closed" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Closed Positions</h3>
                  <p className="text-sm text-muted-foreground">Recently closed trading positions</p>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Trade ID</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Symbol</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Lot Size</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Open Price</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Close Price</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">P&L</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Duration</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closedTrades.map((trade) => (
                        <TableRow key={trade.id} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                              </div>
                              <span className="font-semibold text-foreground">{trade.id}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-foreground">{trade.user}</div>
                              <div className="text-xs text-muted-foreground">ID: {trade.userId}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <TrendingUp className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-foreground">{trade.symbol}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline"
                              className={`font-medium ${
                                trade.type === 'BUY'
                                  ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                  : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
                              }`}
                            >
                              {trade.type === 'BUY' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                              {trade.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{trade.lotSize}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{trade.openPrice}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{trade.closePrice}</span>
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono font-semibold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${trade.pnl.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{trade.duration}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30">
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </AdminLayout>
  )
}