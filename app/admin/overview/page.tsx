"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  LayoutDashboard,
  Users,
  Receipt,
  TrendingUp,
  HeadphonesIcon,
  CreditCard,
  Wallet,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  BarChart3
} from "lucide-react"

const adminSidebarItems = [
  { title: "Overview", icon: LayoutDashboard, href: "/admin/overview", description: "Dashboard overview and analytics" },
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

export default function OverviewPage() {
  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            System Overview
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor your platform&apos;s performance and key metrics
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200/50 dark:border-emerald-800/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">$2,847,392</div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">+18.2% from last month</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200/50 dark:border-blue-800/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Active Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">12,847</div>
              <p className="text-xs text-blue-600 dark:text-blue-400">+12.5% from last week</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200/50 dark:border-purple-800/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Daily Trades</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">8,429</div>
              <p className="text-xs text-purple-600 dark:text-purple-400">+7.8% from yesterday</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200/50 dark:border-orange-800/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">System Health</CardTitle>
              <Activity className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-800 dark:text-orange-200">98.9%</div>
              <p className="text-xs text-green-600 dark:text-green-400">All systems operational</p>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/60 backdrop-blur-sm border border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trading Engine</span>
                  <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    Online
                  </Badge>
                </div>
                <Progress value={99} className="h-2" />
                <p className="text-xs text-muted-foreground">99.8% uptime</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database</span>
                  <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    Healthy
                  </Badge>
                </div>
                <Progress value={95} className="h-2" />
                <p className="text-xs text-muted-foreground">95.2% performance</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Payment Gateway</span>
                  <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                    Active
                  </Badge>
                </div>
                <Progress value={97} className="h-2" />
                <p className="text-xs text-muted-foreground">97.5% success rate</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">API Services</span>
                  <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-400">
                    Degraded
                  </Badge>
                </div>
                <Progress value={78} className="h-2" />
                <p className="text-xs text-muted-foreground">High latency detected</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <span>Recent Alerts</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">High CPU Usage</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Server load exceeded 85% threshold</p>
                    <p className="text-xs text-muted-foreground mt-1">2 minutes ago</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30">
                  <Clock className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">API Rate Limit</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">Several clients approaching rate limits</p>
                    <p className="text-xs text-muted-foreground mt-1">15 minutes ago</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">Maintenance Complete</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Database optimization finished successfully</p>
                    <p className="text-xs text-muted-foreground mt-1">1 hour ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-card/60 backdrop-blur-sm border border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <span>Platform Analytics</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">47.2M</p>
                <p className="text-sm text-muted-foreground">Total Trades</p>
                <p className="text-xs text-green-600 mt-1">+12.3% this month</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">$892.5M</p>
                <p className="text-sm text-muted-foreground">Total Volume</p>
                <p className="text-xs text-green-600 mt-1">+18.7% this month</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">15,847</p>
                <p className="text-sm text-muted-foreground">Registered Users</p>
                <p className="text-xs text-green-600 mt-1">+8.9% this month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}