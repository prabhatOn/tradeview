"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import clsx from "clsx"
import { formatDistanceToNow } from "date-fns"

import { AdminLayout } from "@/components/admin/admin-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { adminService } from "@/lib/services"
import {
  AdminDashboardStats,
  AdminDashboardSystemHealth
} from "@/lib/types"
import {
  Users,
  TrendingUp,
  HeadphonesIcon,
  CreditCard,
  Wallet,
  Search,
  Plus,
  BarChart3,
  Activity,
  AlertTriangle,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Settings
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Severity = "success" | "warning" | "critical" | "info"

const normalizeNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const severityBadgeStyles: Record<Severity, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
}

const severityCircleStyles: Record<Severity, string> = {
  success: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300",
  warning: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300",
  critical: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300",
  info: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
}

const severityDotStyles: Record<Severity, string> = {
  success: "bg-green-500",
  warning: "bg-yellow-500",
  critical: "bg-red-500",
  info: "bg-blue-500"
}

const severityTextStyles: Record<Severity, string> = {
  success: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  critical: "text-red-600 dark:text-red-400",
  info: "text-muted-foreground"
}

const activityIconMap: Record<string, LucideIcon> = {
  user: Users,
  trade: TrendingUp,
  support: HeadphonesIcon,
  deposit: CreditCard,
  withdrawal: Wallet,
  ticket: HeadphonesIcon
}

const deriveSeverity = (value?: string | null): Severity => {
  const normalized = (value ?? "").toLowerCase()
  if (["online", "healthy", "success", "resolved", "completed", "approved"].includes(normalized)) {
    return "success"
  }
  if (["warning", "pending", "processing", "open", "info"].includes(normalized)) {
    return "warning"
  }
  if (["critical", "failed", "rejected", "error", "offline"].includes(normalized)) {
    return "critical"
  }
  return "info"
}

const formatRelativeTimestamp = (timestamp?: string): string | null => {
  if (!timestamp) return null
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  return formatDistanceToNow(date, { addSuffix: true })
}

const formatStatusLabel = (value?: string | null): string => {
  if (!value) return "Unknown"
  return value
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const getSystemHealthRows = (
  health: AdminDashboardSystemHealth | undefined,
  numberFormatter: Intl.NumberFormat
): Array<{ label: string; value: string; severity: Severity; isBadge: boolean }> => {
  if (!health) {
    return [
      { label: "Server Status", value: "Loading…", severity: "info", isBadge: true },
      { label: "Database", value: "Loading…", severity: "info", isBadge: true },
      { label: "Pending Transactions", value: "0", severity: "info", isBadge: true },
      { label: "API Latency", value: "—", severity: "info", isBadge: true }
    ]
  }

  const pendingDeposits = normalizeNumber(health.pendingDeposits ?? 0)
  const pendingWithdrawals = normalizeNumber(health.pendingWithdrawals ?? 0)
  const pendingIbApplications = normalizeNumber(health.pendingIbApplications ?? 0)
  const pendingTransactions = normalizeNumber(health.pendingTransactions)
  const latency = health.apiLatencyMs ?? null
  const activeUsers = normalizeNumber(health.activeUsers)
  const activeAccounts = normalizeNumber(health.activeAccounts)
  const openSupportTickets = normalizeNumber(health.openSupportTickets)
  const openPositions = normalizeNumber(health.openPositions)

  const rows: Array<{ label: string; value: string; severity: Severity; isBadge: boolean }> = []

  rows.push(
    {
      label: "Pending Deposits",
      value: numberFormatter.format(pendingDeposits),
      severity: pendingDeposits > 25 ? "critical" : pendingDeposits > 0 ? "warning" : "success",
      isBadge: false
    },
    {
      label: "Pending Withdrawals",
      value: numberFormatter.format(pendingWithdrawals),
      severity: pendingWithdrawals > 25 ? "critical" : pendingWithdrawals > 0 ? "warning" : "success",
      isBadge: false
    },
    {
      label: "Pending IB Approvals",
      value: numberFormatter.format(pendingIbApplications),
      severity: pendingIbApplications > 15 ? "critical" : pendingIbApplications > 0 ? "warning" : "success",
      isBadge: false
    }
  )

  rows.push(
    {
      label: "Pending Transactions",
      value: numberFormatter.format(pendingTransactions),
      severity: pendingTransactions > 0 ? "warning" : "success",
      isBadge: false
    },
    {
      label: "Open Support Tickets",
      value: numberFormatter.format(openSupportTickets),
      severity: openSupportTickets > 0 ? "warning" : "success",
      isBadge: false
    }
  )

  rows.push(
    {
      label: "Active Users",
      value: numberFormatter.format(activeUsers),
      severity: "info",
      isBadge: false
    },
    {
      label: "Active Accounts",
      value: numberFormatter.format(activeAccounts),
      severity: "info",
      isBadge: false
    },
    {
      label: "Open Positions",
      value: numberFormatter.format(openPositions),
      severity: "info",
      isBadge: false
    }
  )

  return rows
}

interface DashboardCardConfig {
  key: string
  title: string
  icon: LucideIcon
  value: string
  delta?: string
  trend: "positive" | "negative" | "neutral"
  accentClass: string
  context?: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), [])
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    []
  )

  const fetchDashboard = useCallback(async (withSpinner = false) => {
    setError(null)
    if (withSpinner) {
      setIsLoading(true)
    }
    setIsRefreshing(true)
    try {
      const response = await adminService.getDashboardStats()
      if (response.success && response.data) {
        setStats(response.data)
      } else {
        throw new Error(response.error?.message ?? "Failed to load dashboard data")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard data"
      setError(message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard(true)
  }, [fetchDashboard])

  const systemHealth = stats?.systemHealth

  const statsCardData = useMemo<DashboardCardConfig[]>(() => {
    const baseCards: DashboardCardConfig[] = [
      { key: "users", title: "Total Users", icon: Users, value: "—", delta: undefined, trend: "neutral", accentClass: "text-muted-foreground" },
      { key: "positions", title: "Open Positions", icon: TrendingUp, value: "—", delta: undefined, trend: "neutral", accentClass: "text-muted-foreground" },
      { key: "tickets", title: "Open Support Tickets", icon: HeadphonesIcon, value: "—", delta: undefined, trend: "neutral", accentClass: "text-muted-foreground" },
      { key: "revenue", title: "Net Deposits", icon: DollarSign, value: "—", delta: undefined, trend: "neutral", accentClass: "text-muted-foreground" }
    ]

    if (!stats) {
      return baseCards
    }

    const totalUsers = normalizeNumber(stats.users?.total_users)
    const newUsers30d = normalizeNumber(stats.users?.new_users_30d)
    const activeUsers = normalizeNumber(stats.users?.active_users)
    const totalAccounts = normalizeNumber(stats.trading?.total_accounts)
    const openPositions = normalizeNumber(stats.positions?.open_positions)
    const totalPositions = normalizeNumber(stats.positions?.total_positions)
    const openTickets = normalizeNumber(stats.support?.open_tickets)
    const totalTickets = normalizeNumber(stats.support?.total_tickets)
    const pendingTickets = normalizeNumber(stats.support?.pending_tickets)
    const totalDeposits = normalizeNumber(stats.transactions?.total_deposits)
    const totalWithdrawals = normalizeNumber(stats.transactions?.total_withdrawals)
    const netDeposits = totalDeposits - totalWithdrawals

    return [
      {
        ...baseCards[0],
        value: numberFormatter.format(totalUsers),
        delta: `+${numberFormatter.format(newUsers30d)} in last 30 days`,
        trend: newUsers30d >= 0 ? "positive" : "negative",
        accentClass: "text-foreground",
        context: `${numberFormatter.format(activeUsers)} active • ${numberFormatter.format(totalAccounts)} accounts`
      },
      {
        ...baseCards[1],
        value: numberFormatter.format(openPositions),
        delta:
          totalPositions > 0
            ? `${Math.round((openPositions / totalPositions) * 100)}% of ${numberFormatter.format(totalPositions)} positions`
            : undefined,
        trend: openPositions >= 0 ? "positive" : "neutral",
        accentClass: "text-green-600",
        context: undefined
      },
      {
        ...baseCards[2],
        value: numberFormatter.format(openTickets),
        delta: `${numberFormatter.format(totalTickets)} total • ${numberFormatter.format(pendingTickets)} pending`,
        trend: openTickets > 0 ? "negative" : "positive",
        accentClass: "text-foreground",
        context: undefined
      },
      {
        ...baseCards[3],
        value: currencyFormatter.format(netDeposits),
        delta: `${currencyFormatter.format(totalDeposits)} in • ${currencyFormatter.format(totalWithdrawals)} out`,
        trend: netDeposits >= 0 ? "positive" : "negative",
        accentClass: netDeposits >= 0 ? "text-emerald-600" : "text-red-600",
        context: undefined
      }
    ]
  }, [currencyFormatter, numberFormatter, stats])

  const highlightItems = useMemo(() => {
    const highlights = stats?.highlights
    const timeframeLabel = highlights?.timeframe ? highlights.timeframe.toUpperCase() : "24H"
    return [
      {
        label: `New registrations (${timeframeLabel})`,
        value: numberFormatter.format(normalizeNumber(highlights?.newRegistrations)),
        className: "text-foreground"
      },
      {
        label: `Trades closed (${timeframeLabel})`,
        value: numberFormatter.format(normalizeNumber(highlights?.completedTrades)),
        className: "text-green-600"
      },
      {
        label: `Deposits processed (${timeframeLabel})`,
        value: numberFormatter.format(normalizeNumber(highlights?.depositsProcessed)),
        className: "text-blue-600"
      },
      {
        label: `Withdrawals processed (${timeframeLabel})`,
        value: numberFormatter.format(normalizeNumber(highlights?.withdrawalsProcessed)),
        className: "text-purple-600"
      }
    ]
  }, [numberFormatter, stats?.highlights])

  const filteredActivity = useMemo(() => {
    const items = stats?.recentActivity ?? []
    if (!searchTerm.trim()) return items
    const query = searchTerm.trim().toLowerCase()
    return items.filter((item) =>
      [item.action, item.subject, item.type].some((field) =>
        field?.toLowerCase().includes(query)
      )
    )
  }, [searchTerm, stats?.recentActivity])

  const healthUpdatedLabel = useMemo(() => {
    if (!systemHealth?.generatedAt) return null
    const date = new Date(systemHealth.generatedAt)
    if (Number.isNaN(date.getTime())) return null
    return formatDistanceToNow(date, { addSuffix: true })
  }, [systemHealth?.generatedAt])

  const handleRefresh = () => {
    if (!isRefreshing) {
      fetchDashboard(false)
    }
  }

  const alerts = stats?.alerts ?? []

  return (
    <ProtectedRoute requireAdmin={true}>
      <AdminLayout
        sidebarItems={adminSidebarItems}
        topBarConfig={adminTopBarConfig}
      >
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-3 sm:mb-0">
              <h1 className="text-3xl font-bold text-foreground">
                Dashboard Overview
              </h1>
              <p className="text-muted-foreground mt-2">
                Monitor and manage your trading platform performance
              </p>
            </div>
            <div className="flex items-center space-x-3 flex-wrap">
              {healthUpdatedLabel && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Updated {healthUpdatedLabel}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-background/60 backdrop-blur-sm border-border/20"
              >
                <RefreshCw className={clsx("h-4 w-4 mr-2", isRefreshing && "animate-spin")}
                />
                {isRefreshing ? "Refreshing" : "Refresh"}
              </Button>
              <Button
                onClick={() => router.push("/admin/users")}
                className="bg-green-600 hover:bg-green-700 text-white shadow-lg backdrop-blur-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Manage Users
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Dashboard data unavailable</AlertTitle>
              <AlertDescription>
                {error}
              </AlertDescription>
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => fetchDashboard(true)}>
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <Card key={`stats-skeleton-${index}`} className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-4 w-40" />
                    </CardContent>
                  </Card>
                ))
              : statsCardData.map((card) => {
                  const TrendIcon = card.trend === "negative" ? ArrowDownRight : ArrowUpRight
                  const trendClass =
                    card.trend === "positive"
                      ? "text-green-600"
                      : card.trend === "negative"
                        ? "text-red-600"
                        : "text-muted-foreground"
                  return (
                    <Card key={card.key} className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            {card.title}
                          </CardTitle>
                          <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center">
                            <card.icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className={clsx("text-2xl font-bold", card.accentClass)}>
                          {card.value}
                        </div>
                        {card.delta && (
                          <div className="flex items-center mt-2">
                            {card.trend !== "neutral" && (
                              <TrendIcon className={clsx("h-3 w-3 mr-1", trendClass)} />
                            )}
                            <p className={clsx("text-xs", trendClass)}>{card.delta}</p>
                          </div>
                        )}
                        {card.context && (
                          <p className="text-xs text-muted-foreground mt-1">{card.context}</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    Insights
                  </CardTitle>
                  {healthUpdatedLabel && (
                    <span className="text-xs text-muted-foreground mt-2 sm:mt-0">
                      {healthUpdatedLabel}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {getSystemHealthRows(systemHealth, numberFormatter).map((row) => (
                  <div className="flex items-center justify-between" key={row.label}>
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    {row.isBadge ? (
                      <Badge
                        variant="outline"
                        className={clsx("capitalize", severityBadgeStyles[row.severity])}
                      >
                        {row.value}
                      </Badge>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{row.value}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Recent Highlights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {highlightItems.map((item) => (
                  <div className="flex items-center justify-between" key={item.label}>
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={clsx("text-sm font-semibold", item.className)}>
                      {item.value}
                    </span>
                  </div>
                ))}
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
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div className="flex items-center justify-between" key={`alert-skeleton-${index}`}>
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))
                ) : alerts.length ? (
                  alerts.slice(0, 5).map((alert, index) => {
                    const severity = deriveSeverity(alert.type)
                    const timestampLabel = formatRelativeTimestamp(alert.timestamp)
                    return (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2" key={`${alert.title}-${index}`}>
                          <div className="flex items-start sm:items-center space-x-2 min-w-0">
                            <div className={clsx("h-2 w-2 rounded-full mt-1 sm:mt-0", severityDotStyles[severity])} />
                            <div className="min-w-0">
                              <p className="text-sm text-foreground">{alert.title}</p>
                              {alert.description && (
                                <p className="text-xs text-muted-foreground">{alert.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-0 text-right flex-shrink-0">
                            {alert.value !== undefined && (
                              <p className="text-sm font-semibold text-foreground">
                                {numberFormatter.format(alert.value)}
                              </p>
                            )}
                            {timestampLabel && (
                              <p className="text-xs text-muted-foreground">{timestampLabel}</p>
                            )}
                          </div>
                        </div>
                    )
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No active alerts</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-xl text-foreground">Recent System Activity</CardTitle>
                <div className="flex items-center space-x-2 mt-3 sm:mt-0">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search activities..."
                      className="pl-10 w-full sm:w-64 bg-background/60 backdrop-blur-sm border-border/20"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="flex-shrink-0">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div className="flex items-center justify-between" key={`activity-skeleton-${index}`}>
                      <div className="flex items-center space-x-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))}
                </div>
              ) : filteredActivity.length ? (
                <div className="space-y-4">
                  {filteredActivity.slice(0, 15).map((activity, index) => {
                    const IconComponent = activityIconMap[activity.type] ?? Activity
                    const severity = deriveSeverity(activity.status)
                    const circleClass = severityCircleStyles[severity]
                    const badgeClass = severityBadgeStyles[severity]
                    const relativeTime = formatRelativeTimestamp(activity.timestamp)
                    return (
                      <div
                        key={`${activity.type}-${index}-${activity.timestamp}`}
                        className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-border/20"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full">
                          <div className="flex items-start sm:items-center space-x-4 min-w-0">
                            <div className={clsx("h-10 w-10 rounded-full flex items-center justify-center", circleClass)}>
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{activity.action}</p>
                              <p className="text-sm text-muted-foreground">{activity.subject}</p>
                            </div>
                          </div>
                          <div className="mt-2 sm:mt-0 text-right flex-shrink-0">
                            {relativeTime && (
                              <p className="text-sm text-muted-foreground">{relativeTime}</p>
                            )}
                            <Badge variant="outline" className={clsx("mt-1 capitalize", badgeClass)}>
                              {activity.type}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No activity found for your filters.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}