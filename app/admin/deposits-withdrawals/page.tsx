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
  Eye,
  Check,
  X,
  Clock,
  RefreshCw,
  Download,
  Upload,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Filter,
  MoreHorizontal,
  FileText,
  ChevronDown,
  Banknote,
  Smartphone,
  Globe
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

const depositTransactions = [
  {
    id: "DEP-2024-001",
    user: "John Doe",
    email: "john@example.com",
    amount: 5000,
    fee: 0,
    method: "bank transfer",
    status: "pending",
    created: "2024-01-20",
    processedBy: null,
    notes: "Bank transfer verification pending"
  },
  {
    id: "DEP-2024-003",
    user: "Mike Johnson",
    email: "mike@example.com",
    amount: 1000,
    fee: 30,
    method: "credit card",
    status: "completed",
    created: "2024-01-18",
    processedBy: "Admin",
    notes: "Successfully processed via Stripe"
  },
  {
    id: "DEP-2024-005",
    user: "Sarah Wilson",
    email: "sarah@example.com",
    amount: 2500,
    fee: 0,
    method: "crypto",
    status: "completed",
    created: "2024-01-17",
    processedBy: "System",
    notes: "Bitcoin deposit confirmed"
  },
  {
    id: "DEP-2024-007",
    user: "David Brown",
    email: "david@example.com",
    amount: 750,
    fee: 15,
    method: "paypal",
    status: "rejected",
    created: "2024-01-16",
    processedBy: "Admin",
    notes: "Insufficient PayPal balance"
  }
]

const withdrawalTransactions = [
  {
    id: "WTH-2024-002",
    user: "Jane Smith",
    email: "jane@example.com",
    amount: 1500,
    fee: 25,
    method: "bank transfer",
    status: "completed",
    created: "2024-01-19",
    processedBy: "Finance Team",
    notes: "Wire transfer completed successfully"
  },
  {
    id: "WTH-2024-004",
    user: "Alex Thompson",
    email: "alex@example.com",
    amount: 500,
    fee: 10,
    method: "paypal",
    status: "pending",
    created: "2024-01-17",
    processedBy: null,
    notes: "Awaiting PayPal processing"
  },
  {
    id: "WTH-2024-006",
    user: "Lisa Wang",
    email: "lisa@example.com",
    amount: 3000,
    fee: 0,
    method: "crypto",
    status: "completed",
    created: "2024-01-15",
    processedBy: "System",
    notes: "Ethereum withdrawal processed"
  },
  {
    id: "WTH-2024-008",
    user: "Robert Garcia",
    email: "robert@example.com",
    amount: 1200,
    fee: 20,
    method: "credit card",
    status: "rejected",
    created: "2024-01-14",
    processedBy: "Admin",
    notes: "Credit card refund failed"
  }
]

export default function DepositsWithdrawalsPage() {
  const [activeTab, setActiveTab] = useState("deposits")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const totalDeposits = depositTransactions.reduce((sum, tx) => sum + tx.amount, 0)
  const totalWithdrawals = withdrawalTransactions.reduce((sum, tx) => sum + tx.amount, 0)
  const pendingDeposits = depositTransactions.filter(tx => tx.status === 'pending').length
  const pendingWithdrawals = withdrawalTransactions.filter(tx => tx.status === 'pending').length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'bank transfer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'credit card': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'paypal': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
      case 'crypto': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'bank transfer': return <Banknote className="h-3 w-3" />
      case 'credit card': return <CreditCard className="h-3 w-3" />
      case 'paypal': return <Smartphone className="h-3 w-3" />
      case 'crypto': return <Globe className="h-3 w-3" />
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
              Deposit & Withdrawal
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage user deposits and withdrawal requests
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white shadow-lg backdrop-blur-sm">
              <Upload className="h-4 w-4 mr-2" />
              Process Batch
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Deposits</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <ArrowDownCircle className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalDeposits.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{pendingDeposits} pending</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Withdrawals</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <ArrowUpCircle className="h-4 w-4 text-red-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">${totalWithdrawals.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{pendingWithdrawals} pending</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Deposits</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingDeposits}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Withdrawals</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingWithdrawals}</div>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
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
                  placeholder="Search transactions..."
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Tabs */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <Tabs defaultValue="deposits" className="w-full">
            <CardHeader className="pb-0">
              <TabsList className="grid w-full grid-cols-2 bg-muted/30 backdrop-blur-sm">
                <TabsTrigger value="deposits" className="flex items-center space-x-2">
                  <ArrowDownCircle className="h-4 w-4" />
                  <span>Deposits ({depositTransactions.length})</span>
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="flex items-center space-x-2">
                  <ArrowUpCircle className="h-4 w-4" />
                  <span>Withdrawals ({withdrawalTransactions.length})</span>
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Deposits Tab */}
              <TabsContent value="deposits" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Deposit Transactions</h3>
                  <p className="text-sm text-muted-foreground">Manage user deposit requests</p>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Reference</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Amount</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Method</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Created</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depositTransactions.map((transaction) => (
                        <TableRow key={transaction.id} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <ArrowDownCircle className="h-4 w-4 text-green-600" />
                              </div>
                              <span className="font-mono text-sm text-foreground">{transaction.id}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-foreground">{transaction.user}</div>
                              <div className="text-xs text-muted-foreground">{transaction.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-green-600">+${transaction.amount.toLocaleString()}</div>
                              {transaction.fee > 0 && (
                                <div className="text-xs text-muted-foreground">Fee: ${transaction.fee}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium ${getMethodColor(transaction.method)}`}>
                              {getMethodIcon(transaction.method)}
                              <span className="ml-1 capitalize">{transaction.method}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium ${getStatusColor(transaction.status)}`}>
                              {transaction.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                              {transaction.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {transaction.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                              <span className="capitalize">{transaction.status}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{transaction.created}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              {transaction.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30">
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30">
                                    <X className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-900/30">
                                <MoreHorizontal className="h-4 w-4 text-gray-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Withdrawals Tab */}
              <TabsContent value="withdrawals" className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">Withdrawal Transactions</h3>
                  <p className="text-sm text-muted-foreground">Manage user withdrawal requests</p>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Reference</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Amount</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Method</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Created</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawalTransactions.map((transaction) => (
                        <TableRow key={transaction.id} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <ArrowUpCircle className="h-4 w-4 text-red-600" />
                              </div>
                              <span className="font-mono text-sm text-foreground">{transaction.id}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-foreground">{transaction.user}</div>
                              <div className="text-xs text-muted-foreground">{transaction.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-semibold text-red-600">-${transaction.amount.toLocaleString()}</div>
                              {transaction.fee > 0 && (
                                <div className="text-xs text-muted-foreground">Fee: ${transaction.fee}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium ${getMethodColor(transaction.method)}`}>
                              {getMethodIcon(transaction.method)}
                              <span className="ml-1 capitalize">{transaction.method}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium ${getStatusColor(transaction.status)}`}>
                              {transaction.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                              {transaction.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {transaction.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                              <span className="capitalize">{transaction.status}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{transaction.created}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Button>
                              {transaction.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30">
                                    <Check className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30">
                                    <X className="h-4 w-4 text-red-600" />
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-900/30">
                                <MoreHorizontal className="h-4 w-4 text-gray-600" />
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