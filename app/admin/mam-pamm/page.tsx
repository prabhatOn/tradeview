"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  Edit,
  Trash2,
  MoreHorizontal,
  Activity,
  DollarSign,
  UserCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  Filter,
  Download,
  Eye,
  Copy
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

const mockMamPammAccounts = [
  {
    id: "MAM001",
    name: "Alpha Strategy",
    type: "MAM",
    manager: "John Smith",
    equity: "$1,250,000",
    investors: 45,
    profit: "$125,000",
    profitPercent: "+11.11%",
    risk: "Medium",
    status: "Active",
    riskColor: "yellow",
    profitColor: "green"
  },
  {
    id: "PAMM002", 
    name: "Beta Portfolio",
    type: "PAMM",
    manager: "Sarah Johnson",
    equity: "$850,000",
    investors: 32,
    profit: "-$15,000",
    profitPercent: "-1.73%",
    risk: "High",
    status: "Active",
    riskColor: "red",
    profitColor: "red"
  },
  {
    id: "MAM003",
    name: "Gamma Fund",
    type: "MAM", 
    manager: "Michael Chen",
    equity: "$2,100,000",
    investors: 78,
    profit: "$310,000",
    profitPercent: "+17.32%",
    risk: "Low",
    status: "Active",
    riskColor: "green",
    profitColor: "green"
  },
  {
    id: "PAMM004",
    name: "Delta Strategy",
    type: "PAMM",
    manager: "Emma Williams",
    equity: "$650,000",
    investors: 24,
    profit: "$45,000",
    profitPercent: "+7.43%",
    risk: "Medium",
    status: "Paused",
    riskColor: "yellow",
    profitColor: "green"
  }
]

export default function MamPammPage() {
  const totalEquity = "$4,850,000"
  const totalInvestors = 179
  const totalProfit = "$465,000"
  const totalProfitPercent = "+10.61%"

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              MAM/PAMM Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage copy trading accounts and strategies
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white shadow-lg backdrop-blur-sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Account
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Equity</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalEquity}</div>
              <div className="flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                <p className="text-xs text-green-600">+8.5% from last month</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Investors</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalInvestors}</div>
              <div className="flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                <p className="text-xs text-green-600">+12 new this week</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Profit</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalProfit}</div>
              <div className="flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                <p className="text-xs text-green-600">{totalProfitPercent} return</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">3/4</div>
              <div className="flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                <p className="text-xs text-green-600">75% active rate</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Account Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-medium">MAM Accounts</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">2 accounts</div>
                  <div className="text-xs text-muted-foreground">$3,350,000 equity</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm font-medium">PAMM Accounts</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">2 accounts</div>
                  <div className="text-xs text-muted-foreground">$1,500,000 equity</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Risk Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium">Low Risk</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">1 account</div>
                  <div className="text-xs text-muted-foreground">$2,100,000 equity</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm font-medium">Medium Risk</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">2 accounts</div>
                  <div className="text-xs text-muted-foreground">$1,900,000 equity</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium">High Risk</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">1 account</div>
                  <div className="text-xs text-muted-foreground">$850,000 equity</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MAM/PAMM Accounts Table */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-foreground">MAM/PAMM Accounts</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search accounts..."
                    className="pl-10 w-64 bg-background/60 backdrop-blur-sm border-border/20"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Manage copy trading accounts and their settings
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/20">
                  <TableHead className="text-muted-foreground font-semibold">Account</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Manager</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Equity</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Investors</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Profit</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Risk</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockMamPammAccounts.map((account) => (
                  <TableRow key={account.id} className="hover:bg-muted/30 transition-colors border-border/20">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{account.name}</div>
                          <div className="text-xs text-muted-foreground">{account.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`font-medium ${
                          account.type === 'MAM' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                        }`}
                      >
                        {account.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{account.manager}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-foreground">
                      {account.equity}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{account.investors}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className={`font-mono font-semibold ${account.profitColor === 'green' ? 'text-green-600' : 'text-red-600'}`}>
                        <div>{account.profit}</div>
                        <div className="text-xs">{account.profitPercent}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline"
                        className={`font-medium ${
                          account.riskColor === 'green' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : account.riskColor === 'yellow'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {account.risk}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={account.status === 'Active' ? 'default' : 'secondary'}
                        className={`font-medium ${
                          account.status === 'Active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}
                      >
                        {account.status}
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
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-orange-100 dark:hover:bg-orange-900/30">
                          <Copy className="h-4 w-4 text-orange-600" />
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
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}