"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LayoutDashboard,
  Users,
  Receipt,
  TrendingUp,
  HeadphonesIcon,
  CreditCard,
  Wallet,
  Search,
  Plus,
  Edit,
  Save,
  RefreshCw,
  Settings,
  DollarSign,
  Percent,
  Activity,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Calculator,
  Shield,
  Target
} from "lucide-react"

const adminSidebarItems = [
  { title: "Overview", icon: LayoutDashboard, href: "/admin", description: "Dashboard overview and analytics" },
  { title: "User Management", icon: Users, href: "/admin/users", description: "Manage users and accounts" },
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

const tradingSymbols = [
  {
    symbol: "EURUSD",
    swapLong: -2.5,
    swapShort: -1.8,
    spread: 1.2,
    commission: 0.5,
    leverage: "1:100",
    status: "Active"
  },
  {
    symbol: "GBPUSD", 
    swapLong: -3.2,
    swapShort: -2.1,
    spread: 1.5,
    commission: 0.7,
    leverage: "1:100",
    status: "Active"
  },
  {
    symbol: "USDJPY",
    swapLong: -1.8,
    swapShort: -2.3,
    spread: 1.8,
    commission: 0.6,
    leverage: "1:100", 
    status: "Active"
  },
  {
    symbol: "AUDUSD",
    swapLong: -2.1,
    swapShort: -1.5,
    spread: 2.0,
    commission: 0.8,
    leverage: "1:50",
    status: "Active"
  },
  {
    symbol: "USDCHF",
    swapLong: -1.9,
    swapShort: -2.0,
    spread: 1.9,
    commission: 0.6,
    leverage: "1:100",
    status: "Inactive"
  }
]

export default function TradesChargesPage() {
  const [standardCommission, setStandardCommission] = useState("0.5")
  const [standardSpread, setStandardSpread] = useState("1.5")
  const [vipCommission, setVipCommission] = useState("0.3")
  const [vipSpread, setVipSpread] = useState("1.0")
  const [demoLeverage, setDemoLeverage] = useState("1:100")
  const [liveLeverage, setLiveLeverage] = useState("1:100")

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Trades & Charges
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage trading charges, spreads, and commission rates
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white shadow-lg backdrop-blur-sm">
              <Save className="h-4 w-4 mr-2" />
              Save All
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Symbols</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">4/5</div>
              <p className="text-xs text-green-600">80% active rate</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Commission</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Percent className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">0.64%</div>
              <p className="text-xs text-muted-foreground">Across all symbols</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Spread</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">1.68</div>
              <p className="text-xs text-muted-foreground">Average pips</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Max Leverage</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Target className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">1:100</div>
              <p className="text-xs text-muted-foreground">Standard accounts</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <Tabs defaultValue="charges" className="w-full">
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-3 bg-muted/30 backdrop-blur-sm">
                <TabsTrigger value="charges" className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Charges</span>
                </TabsTrigger>
                <TabsTrigger value="brokerage" className="flex items-center space-x-2">
                  <Calculator className="h-4 w-4" />
                  <span>Brokerage</span>
                </TabsTrigger>
                <TabsTrigger value="leverage" className="flex items-center space-x-2">
                  <Shield className="h-4 w-4" />
                  <span>Leverage</span>
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Charges Tab */}
              <TabsContent value="charges" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground flex items-center">
                      <DollarSign className="h-5 w-5 mr-2" />
                      Trading Charges
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configure swap rates, spreads, and commissions for each symbol
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search symbols..."
                        className="pl-10 w-64 bg-background/60 backdrop-blur-sm border-border/20"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Symbol
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Symbol</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Swap Long</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Swap Short</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Spread</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Commission</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Leverage</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tradingSymbols.map((symbol) => (
                        <TableRow key={symbol.symbol} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-semibold text-foreground">{symbol.symbol}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono ${symbol.swapLong < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {symbol.swapLong}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono ${symbol.swapShort < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {symbol.swapShort}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{symbol.spread} pips</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{symbol.commission}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{symbol.leverage}</span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={symbol.status === 'Active' ? 'default' : 'secondary'}
                              className={`font-medium ${
                                symbol.status === 'Active'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                              }`}
                            >
                              {symbol.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                <Edit className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30">
                                <Settings className="h-4 w-4 text-green-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Brokerage Tab */}
              <TabsContent value="brokerage" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Brokerage Settings
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure brokerage rates and commission structures
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Standard Brokerage */}
                  <Card className="bg-background/50 border-border/20">
                    <CardHeader>
                      <CardTitle className="text-lg text-foreground">Standard Brokerage</CardTitle>
                      <p className="text-sm text-muted-foreground">Default rates for standard accounts</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="standard-commission" className="text-sm font-medium text-foreground">
                          Standard Commission (%)
                        </Label>
                        <Input
                          id="standard-commission"
                          value={standardCommission}
                          onChange={(e) => setStandardCommission(e.target.value)}
                          className="bg-background/60 border-border/20"
                          placeholder="0.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="standard-spread" className="text-sm font-medium text-foreground">
                          Standard Spread (pips)
                        </Label>
                        <Input
                          id="standard-spread"
                          value={standardSpread}
                          onChange={(e) => setStandardSpread(e.target.value)}
                          className="bg-background/60 border-border/20"
                          placeholder="1.5"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium text-foreground">Applied to 85% of accounts</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* VIP Brokerage */}
                  <Card className="bg-background/50 border-border/20">
                    <CardHeader>
                      <CardTitle className="text-lg text-foreground">VIP Brokerage</CardTitle>
                      <p className="text-sm text-muted-foreground">Premium rates for VIP accounts</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="vip-commission" className="text-sm font-medium text-foreground">
                          VIP Commission (%)
                        </Label>
                        <Input
                          id="vip-commission"
                          value={vipCommission}
                          onChange={(e) => setVipCommission(e.target.value)}
                          className="bg-background/60 border-border/20"
                          placeholder="0.3"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vip-spread" className="text-sm font-medium text-foreground">
                          VIP Spread (pips)
                        </Label>
                        <Input
                          id="vip-spread"
                          value={vipSpread}
                          onChange={(e) => setVipSpread(e.target.value)}
                          className="bg-background/60 border-border/20"
                          placeholder="1.0"
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-purple-600" />
                          <span className="text-sm font-medium text-foreground">Applied to 15% of accounts</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Leverage Tab */}
              <TabsContent value="leverage" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground flex items-center">
                    <Target className="h-5 w-5 mr-2" />
                    Leverage Settings
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure leverage limits and risk management
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-background/50 border-border/20">
                      <CardHeader>
                        <CardTitle className="text-lg text-foreground">Demo Account Leverage</CardTitle>
                        <p className="text-sm text-muted-foreground">Maximum leverage for demo accounts</p>
                      </CardHeader>
                      <CardContent>
                        <Select value={demoLeverage} onValueChange={setDemoLeverage}>
                          <SelectTrigger className="bg-background/60 border-border/20">
                            <SelectValue placeholder="Select leverage" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1:50">1:50</SelectItem>
                            <SelectItem value="1:100">1:100</SelectItem>
                            <SelectItem value="1:200">1:200</SelectItem>
                            <SelectItem value="1:500">1:500</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>

                    <Card className="bg-background/50 border-border/20">
                      <CardHeader>
                        <CardTitle className="text-lg text-foreground">Live Account Leverage</CardTitle>
                        <p className="text-sm text-muted-foreground">Maximum leverage for live accounts</p>
                      </CardHeader>
                      <CardContent>
                        <Select value={liveLeverage} onValueChange={setLiveLeverage}>
                          <SelectTrigger className="bg-background/60 border-border/20">
                            <SelectValue placeholder="Select leverage" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1:30">1:30</SelectItem>
                            <SelectItem value="1:50">1:50</SelectItem>
                            <SelectItem value="1:100">1:100</SelectItem>
                            <SelectItem value="1:200">1:200</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Risk Management */}
                  <Card className="bg-background/50 border-border/20">
                    <CardHeader>
                      <CardTitle className="text-lg text-foreground flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Risk Management
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">Leverage distribution and risk analysis</p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/20">
                          <div className="flex items-center space-x-3">
                            <div className="h-3 w-3 rounded-full bg-green-500"></div>
                            <span className="text-sm font-medium text-foreground">1:30 - 1:50</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">245 accounts</div>
                            <div className="text-xs text-green-600">Low Risk</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/20">
                          <div className="flex items-center space-x-3">
                            <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                            <span className="text-sm font-medium text-foreground">1:100</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">1,234 accounts</div>
                            <div className="text-xs text-yellow-600">Medium Risk</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/20">
                          <div className="flex items-center space-x-3">
                            <div className="h-3 w-3 rounded-full bg-red-500"></div>
                            <span className="text-sm font-medium text-foreground">1:200+</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-foreground">89 accounts</div>
                            <div className="text-xs text-red-600">High Risk</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </AdminLayout>
  )
}