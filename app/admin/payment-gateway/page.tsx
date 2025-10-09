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
  Trash2,
  RefreshCw,
  Settings,
  DollarSign,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Globe,
  Smartphone,
  Banknote,
  Bitcoin,
  Shield,
  Zap,
  TrendingDown,
  ChevronDown,
  MoreHorizontal,
  Building,
  MapPin,
  Clock
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

const paymentGateways = [
  {
    id: 1,
    name: "Stripe",
    type: "credit card",
    provider: "Stripe Inc.",
    currencies: ["USD", "EUR", "GBP"],
    fees: {
      deposit: 2.9,
      withdrawal: 0
    },
    limits: {
      min: 10,
      max: 10000
    },
    status: "active",
    lastUsed: "2024-01-20",
    monthlyVolume: 150000,
    settings: {
      apiKey: "sk_live_***",
      webhookUrl: "https://api.tradepro.com/stripe/webhook"
    }
  },
  {
    id: 2,
    name: "PayPal",
    type: "ewallet",
    provider: "PayPal Holdings",
    currencies: ["USD", "EUR", "GBP", "CAD"],
    fees: {
      deposit: 3.4,
      withdrawal: 1.5
    },
    limits: {
      min: 5,
      max: 5000
    },
    status: "active",
    lastUsed: "2024-01-19",
    monthlyVolume: 85000,
    settings: {
      clientId: "AY***",
      sandboxMode: false
    }
  },
  {
    id: 3,
    name: "Coinbase",
    type: "crypto",
    provider: "Coinbase Inc.",
    currencies: ["BTC", "ETH", "USDC", "USDT"],
    fees: {
      deposit: 1.0,
      withdrawal: 0.5
    },
    limits: {
      min: 25,
      max: 25000
    },
    status: "maintenance",
    lastUsed: "2024-01-18",
    monthlyVolume: 320000,
    settings: {
      apiKey: "***",
      webhookSecret: "***"
    }
  }
]

const bankAccounts = [
  {
    id: 1,
    bank: "Chase Bank",
    code: "CHASUS33",
    accountName: "XTN Trade LLC",
    accountNumber: "****1234",
    currency: "USD",
    country: "United States",
    balance: 125000.50,
    status: "active",
    type: "business"
  },
  {
    id: 2,
    bank: "Bank of America",
    code: "BOFAUS3N",
    accountName: "XTN Trade LLC",
    accountNumber: "****5678",
    currency: "USD",
    country: "United States",
    balance: 89000.25,
    status: "active",
    type: "business"
  },
  {
    id: 3,
    bank: "HSBC",
    code: "HBUKGB4B",
    accountName: "XTN Trade Ltd",
    accountNumber: "****9012",
    currency: "GBP",
    country: "United Kingdom",
    balance: 45000.75,
    status: "inactive",
    type: "business"
  }
]

export default function PaymentGatewayPage() {
  const [activeTab, setActiveTab] = useState("gateways")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const totalGateways = paymentGateways.length
  const activeGateways = paymentGateways.filter(gw => gw.status === 'active').length
  const totalBankAccounts = bankAccounts.length
  const activeBankAccounts = bankAccounts.filter(acc => acc.status === 'active').length
  const totalBalance = bankAccounts.reduce((sum, acc) => sum + acc.balance, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      default: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'credit card': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'ewallet': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'crypto': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'credit card': return <CreditCard className="h-3 w-3" />
      case 'ewallet': return <Smartphone className="h-3 w-3" />
      case 'crypto': return <Bitcoin className="h-3 w-3" />
      default: return <Wallet className="h-3 w-3" />
    }
  }

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Payment Gateway & Bank Accounts
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage payment gateways and bank account configurations
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
              <Zap className="h-4 w-4 mr-2" />
              Test All Gateways
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg backdrop-blur-sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Balances
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Gateways</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalGateways}</div>
              <p className="text-xs text-muted-foreground">{activeGateways} active</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Gateways</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeGateways}</div>
              <p className="text-xs text-muted-foreground">Processing payments</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bank Accounts</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Building className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{totalBankAccounts}</div>
              <p className="text-xs text-muted-foreground">{activeBankAccounts} active</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${totalBalance.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all accounts</p>
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
                  placeholder="Search gateways and banks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background/60 backdrop-blur-sm border-border/20"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-background/60 backdrop-blur-sm border-border/20">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <Tabs defaultValue="gateways" className="w-full">
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-2 bg-muted/30 backdrop-blur-sm">
                <TabsTrigger value="gateways" className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4" />
                  <span>Payment Gateways ({paymentGateways.length})</span>
                </TabsTrigger>
                <TabsTrigger value="banks" className="flex items-center space-x-2">
                  <Building className="h-4 w-4" />
                  <span>Bank Accounts ({bankAccounts.length})</span>
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Payment Gateways Tab */}
              <TabsContent value="gateways" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Payment Gateways</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage payment processing integrations
                    </p>
                  </div>
                  <Button className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Gateway
                  </Button>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Gateway</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Provider</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Fees</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Limits</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Last Used</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentGateways.map((gateway) => (
                        <TableRow key={gateway.id} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div>
                              <div className="font-semibold text-foreground">{gateway.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {gateway.currencies.join(", ")}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium ${getTypeColor(gateway.type)}`}>
                              {getTypeIcon(gateway.type)}
                              <span className="ml-1 capitalize">{gateway.type}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground">{gateway.provider}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>Deposit: {gateway.fees.deposit}%</div>
                              <div>Withdrawal: {gateway.fees.withdrawal}%</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>Min: ${gateway.limits.min}</div>
                              <div>Max: ${gateway.limits.max.toLocaleString()}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium ${getStatusColor(gateway.status)}`}>
                              {gateway.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {gateway.status === 'maintenance' && <Settings className="h-3 w-3 mr-1" />}
                              {gateway.status === 'inactive' && <XCircle className="h-3 w-3 mr-1" />}
                              <span className="capitalize">{gateway.status}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{gateway.lastUsed}</span>
                            </div>
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
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                              <Select>
                                <SelectTrigger className="h-8 w-20 text-xs">
                                  <SelectValue placeholder="Active" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="inactive">Inactive</SelectItem>
                                  <SelectItem value="maintenance">Maintenance</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Bank Accounts Tab */}
              <TabsContent value="banks" className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">Bank Accounts</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage bank account configurations
                    </p>
                  </div>
                  <Button className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Bank Account
                  </Button>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Bank</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Account Name</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Account Number</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Currency</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Country</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Balance</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bankAccounts.map((account) => (
                        <TableRow key={account.id} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div>
                              <div className="font-semibold text-foreground">{account.bank}</div>
                              <div className="text-xs text-muted-foreground">{account.code}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground">{account.accountName}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{account.accountNumber}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {account.currency}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-foreground">{account.country}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              ${account.balance.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium ${getStatusColor(account.status)}`}>
                              {account.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {account.status === 'inactive' && <XCircle className="h-3 w-3 mr-1" />}
                              <span className="capitalize">{account.status}</span>
                            </Badge>
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