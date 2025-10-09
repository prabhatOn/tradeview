"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Settings
} from "lucide-react"

// Admin configuration
const adminSidebarItems = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    href: "/admin",
    description: "Dashboard overview and analytics"
  },
  {
    title: "User Management",
    icon: Users,
    href: "/admin/users",
    description: "Manage users and accounts"
  },
  {
    title: "MAM/PAMM",
    icon: Building2,
    href: "/admin/mam-pamm",
    description: "Multi-account management"
  },
  {
    title: "Trades & Charges",
    icon: Receipt,
    href: "/admin/trades-charges",
    description: "Trading fees and charges"
  },
  {
    title: "Trades",
    icon: TrendingUp,
    href: "/admin/trades",
    description: "Trading activities monitoring"
  },
  {
    title: "Support Tickets",
    icon: HeadphonesIcon,
    href: "/admin/support",
    description: "Customer support management"
  },
  {
    title: "Deposits/Withdrawals",
    icon: CreditCard,
    href: "/admin/deposits-withdrawals",
    description: "Transaction management"
  },
  {
    title: "Payment Gateway",
    icon: Wallet,
    href: "/admin/payment-gateway",
    description: "Payment processing settings"
  },
]

const adminTopBarConfig = {
  title: "Admin Portal",
  showBalance: false,
  showNotifications: true,
  showDeposit: false,
  showUserMenu: true,
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute requireAdmin={true}>
      <AdminLayout
        sidebarItems={adminSidebarItems}
        topBarConfig={adminTopBarConfig}
      >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Dashboard Overview
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor and manage your trading platform performance
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white shadow-lg backdrop-blur-sm">
              <Plus className="h-4 w-4 mr-2" />
              Quick Action
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">15,847</div>
              <div className="flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                <p className="text-xs text-green-600">+12.5% from last month</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Trades</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">3,429</div>
              <div className="flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                <p className="text-xs text-green-600">+8.3% from yesterday</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Support Tickets</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <HeadphonesIcon className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">127</div>
              <div className="flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-red-600 mr-1" />
                <p className="text-xs text-red-600">+5 new today</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">$284.7K</div>
              <div className="flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
                <p className="text-xs text-green-600">+15.8% from last week</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Overview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Activity className="h-4 w-4 mr-2" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Server Status</span>
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Database</span>
                <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Healthy
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API Response</span>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  <Clock className="h-3 w-3 mr-1" />
                  142ms
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <BarChart3 className="h-4 w-4 mr-2" />
                Today's Highlights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">New Registrations</span>
                <span className="text-sm font-semibold text-foreground">+47</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Completed Trades</span>
                <span className="text-sm font-semibold text-green-600">1,234</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Withdrawals Processed</span>
                <span className="text-sm font-semibold text-blue-600">89</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <span className="text-sm text-muted-foreground">High Volume Alert</span>
                </div>
                <span className="text-xs text-muted-foreground">2m ago</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-muted-foreground">Server Load Warning</span>
                </div>
                <span className="text-xs text-muted-foreground">15m ago</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-muted-foreground">Backup Completed</span>
                </div>
                <span className="text-xs text-muted-foreground">1h ago</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-foreground">Recent System Activity</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search activities..."
                    className="pl-10 w-64 bg-background/60 backdrop-blur-sm border-border/20"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "New user registration", user: "john.doe@example.com", time: "2 minutes ago", type: "success", icon: Users },
                { action: "Large trade executed", user: "Premium Account #1847", time: "5 minutes ago", type: "info", icon: TrendingUp },
                { action: "Support ticket resolved", user: "Ticket #ST-9847", time: "12 minutes ago", type: "success", icon: CheckCircle },
                { action: "System maintenance completed", user: "System Admin", time: "1 hour ago", type: "info", icon: Settings },
                { action: "Payment gateway updated", user: "Finance Team", time: "2 hours ago", type: "warning", icon: CreditCard },
              ].map((activity, index) => {
                const IconComponent = activity.icon
                return (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-all duration-200 cursor-pointer border border-transparent hover:border-border/20">
                    <div className="flex items-center space-x-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        activity.type === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
                        activity.type === 'info' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        activity.type === 'warning' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                      }`}>
                        <IconComponent className={`h-4 w-4 ${
                          activity.type === 'success' ? 'text-green-600' :
                          activity.type === 'info' ? 'text-blue-600' :
                          activity.type === 'warning' ? 'text-orange-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">{activity.user}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{activity.time}</p>
                      <Badge 
                        variant={activity.type === 'success' ? 'default' : activity.type === 'warning' ? 'destructive' : 'secondary'} 
                        className="text-xs mt-1"
                      >
                        {activity.type}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
    </ProtectedRoute>
  )
}