"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useDebounce } from "@/hooks/use-debounce"
import { useToast } from "@/components/ui/use-toast"
import { adminService } from "@/lib/services"
import {
  AdminFundsChartPoint,
  AdminFundsOverview,
  AdminFundsTransactionRow,
  PaginationInfo,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  ArrowUpCircle,
  Banknote,
  Check,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react"
import { Loader2 } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

const PAGE_SIZE = 20

type BatchAction = "approve" | "reject"

const statusOptions = [
  { value: "all", label: "All status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "on_hold", label: "On hold" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
]

const chartRangeOptions: Array<{ value: "7d" | "14d" | "30d" | "90d"; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
]

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("en-US")

const chartConfig = {
  withdrawals: {
    label: "Withdrawals",
    color: "hsl(var(--chart-2))",
  },
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  on_hold: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  processing: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
}

function parseAmount(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return currencyFormatter.format(0)
  const numberValue = typeof value === "string" ? Number(value) : value
  return currencyFormatter.format(Number.isFinite(numberValue) ? Number(numberValue) : 0)
}

function formatCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0"
  const numberValue = typeof value === "string" ? Number(value) : value
  return numberFormatter.format(Number.isFinite(numberValue) ? Number(numberValue) : 0)
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "N/A"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function sanitizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  const stringValue = String(value)
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n") || stringValue.includes("\r")) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

function getStatusBadge(status: string): string {
  return statusStyles[status?.toLowerCase().replace("_", "")] ?? "bg-muted text-muted-foreground"
}

export default function AdminWithdrawalsPage() {
  const { toast } = useToast()

  const [overview, setOverview] = useState<AdminFundsOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [chartRange, setChartRange] = useState<"7d" | "14d" | "30d" | "90d">("30d")
  const [chartData, setChartData] = useState<AdminFundsChartPoint[]>([])
  const [chartLoading, setChartLoading] = useState(true)
  const [yAxisWidth, setYAxisWidth] = useState(70)

  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearch = useDebounce(searchTerm, 400)
  const [page, setPage] = useState(1)
  const [transactions, setTransactions] = useState<AdminFundsTransactionRow[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [batchActionLoading, setBatchActionLoading] = useState<BatchAction | null>(null)
  const [rowActionLoading, setRowActionLoading] = useState<Record<number, BatchAction | null>>({})
  const [detailRow, setDetailRow] = useState<AdminFundsTransactionRow | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const isMountedRef = useRef(true)
  const overviewRequestIdRef = useRef(0)
  const chartRequestIdRef = useRef(0)
  const transactionsRequestIdRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadOverview = useCallback(async () => {
    const requestId = ++overviewRequestIdRef.current
    setOverviewLoading(true)
    try {
      const response = await adminService.getFundsOverview()
      if (!response.success || !response.data) {
        throw new Error(response.message || "Unable to load overview")
      }
      if (!isMountedRef.current || requestId !== overviewRequestIdRef.current) {
        return
      }
      setOverview(response.data)
    } catch (error) {
      if (!isMountedRef.current || requestId !== overviewRequestIdRef.current) {
        return
      }
      const message = error instanceof Error ? error.message : "Unable to load overview"
      toast({ variant: "destructive", title: "Overview unavailable", description: message })
    } finally {
      if (!isMountedRef.current || requestId !== overviewRequestIdRef.current) {
        return
      }
      setOverviewLoading(false)
    }
  }, [toast])

  const loadChart = useCallback(
    async (range: typeof chartRange) => {
      const requestId = ++chartRequestIdRef.current
      setChartLoading(true)
      try {
        const response = await adminService.getFundsChart(range)
        if (!response.success || !response.data) {
          throw new Error(response.message || "Unable to load cashflow chart")
        }
        if (!isMountedRef.current || requestId !== chartRequestIdRef.current) {
          return
        }
        setChartData(response.data)
      } catch (error) {
        if (!isMountedRef.current || requestId !== chartRequestIdRef.current) {
          return
        }
        const message = error instanceof Error ? error.message : "Unable to load cashflow chart"
        toast({ variant: "destructive", title: "Chart unavailable", description: message })
      } finally {
        if (!isMountedRef.current || requestId !== chartRequestIdRef.current) {
          return
        }
        setChartLoading(false)
      }
    },
    [toast],
  )

  const loadTransactions = useCallback(async () => {
    const requestId = ++transactionsRequestIdRef.current
    setTransactionsLoading(true)
    try {
      const response = await adminService.getFundsTransactions({
        type: "withdrawals",
        page,
        limit: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || "Unable to load transactions")
      }

      if (!isMountedRef.current || requestId !== transactionsRequestIdRef.current) {
        return
      }

      setTransactions(response.data.rows || [])
      setPagination(response.data.pagination)
      setSelectedIds([])
    } catch (error) {
      if (!isMountedRef.current || requestId !== transactionsRequestIdRef.current) {
        return
      }
      const message = error instanceof Error ? error.message : "Unable to load transactions"
      toast({ variant: "destructive", title: "Transactions unavailable", description: message })
    } finally {
      if (!isMountedRef.current || requestId !== transactionsRequestIdRef.current) {
        return
      }
      setTransactionsLoading(false)
    }
  }, [debouncedSearch, page, statusFilter, toast])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadChart(chartRange)
  }, [chartRange, loadChart])

  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return
      setYAxisWidth(window.innerWidth < 640 ? 48 : 70)
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const summaryCards = useMemo(() => {
    const summary = overview?.summary
    return [
      {
        key: "total-withdrawals",
        title: "Total withdrawals",
        value: formatCurrency(summary?.totalWithdrawals ?? 0),
        description: "Gross outbound volume processed",
        icon: ArrowUpCircle,
        accent: "text-red-600",
      },
      {
        key: "pending-withdrawals",
        title: "Pending withdrawals",
        value: formatCount(summary?.pendingWithdrawals ?? 0),
        description: "Awaiting finance approval",
        icon: Check,
        accent: "text-amber-500",
      },
      {
        key: "total-balances",
        title: "Managed balances",
        value: formatCurrency(summary?.totalBalances ?? 0),
        description: "Aggregate MT accounts balance",
        icon: Banknote,
        accent: "text-sky-500",
      },
      {
        key: "total-users",
        title: "Active fund clients",
        value: formatCount(summary?.totalUsers ?? 0),
        description: "Users with funded accounts",
        icon: Users,
        accent: "text-purple-500",
      },
    ]
  }, [overview])

  const normalizedChartData = useMemo(
    () =>
      chartData.map((point) => ({
        date: formatChartDate(point.activityDate),
        withdrawals: parseAmount(point.totalWithdrawals),
      })),
    [chartData],
  )

  const currentPage = pagination?.page ?? page
  const totalPages = pagination?.pages ?? 1
  const selectedCount = selectedIds.length
  const allSelected = transactions.length > 0 && selectedCount === transactions.length
  const partiallySelected = selectedCount > 0 && !allSelected

  const pendingCount = useMemo(() => {
    const summary = overview?.summary
    if (!summary) return { withdrawals: 0 }
    return {
      withdrawals: summary.pendingWithdrawals ?? 0,
    }
  }, [overview])

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setPage(1)
  }

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedIds(transactions.map((row) => row.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectRow = (transactionId: number, checked: boolean | "indeterminate") => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(transactionId)) return prev
        return [...prev, transactionId]
      }
      return prev.filter((id) => id !== transactionId)
    })
  }

  const handleBatchAction = async (action: BatchAction) => {
    if (selectedIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Select transactions",
        description: "Choose at least one row before processing a batch.",
      })
      return
    }

    setBatchActionLoading(action)
    try {
      const response = await adminService.batchProcessFunds({
        action,
        type: "withdrawals",
        ids: selectedIds,
      })

      if (!response.success) {
        throw new Error(response.message || "Batch action failed")
      }

      toast({
        title: `Batch ${action === "approve" ? "approval" : action === "reject" ? "rejection" : "hold"} queued`,
        description: `${selectedIds.length} withdrawal request${selectedIds.length === 1 ? "" : "s"} scheduled for processing.`,
      })

      setSelectedIds([])
      await Promise.all([loadTransactions(), loadOverview()])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Batch action failed"
      toast({ variant: "destructive", title: "Unable to process batch", description: message })
    } finally {
      setBatchActionLoading(null)
    }
  }

  const handleRowAction = async (row: AdminFundsTransactionRow, action: BatchAction) => {
    setRowActionLoading((prev) => ({ ...prev, [row.id]: action }))
    try {
  // Use the unified processWithdrawal endpoint which accepts 'approve' | 'reject'
  const response = await adminService.processWithdrawal(row.id, action)
      if (!response.success) {
        throw new Error(response.message || `Failed to ${action} transaction`)
      }

      toast({
        title: `Transaction ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "held"}`,
        description: `Reference ${row.transaction_id} updated successfully.`,
      })

      await Promise.all([loadTransactions(), loadOverview()])
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${action} transaction`
      toast({ variant: "destructive", title: "Unable to ${action} transaction", description: message })
    } finally {
      setRowActionLoading((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await adminService.exportFundsTransactions({
        type: "withdrawals",
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || "Unable to export data")
      }

      const rows = response.data.rows || []
      if (rows.length === 0) {
        toast({ title: "No rows to export", description: "Adjust your filters and try again." })
        return
      }

      const headers = Object.keys(rows[0])
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => sanitizeCsvValue((row as Record<string, unknown>)[header])).join(",")),
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `withdrawals-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export complete",
        description: `${rows.length} row${rows.length === 1 ? "" : "s"} downloaded successfully.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to export data"
      toast({ variant: "destructive", title: "Export failed", description: message })
    } finally {
      setIsExporting(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadOverview(), loadChart(chartRange), loadTransactions()])
      toast({ title: "Data refreshed" })
    } catch (error) {
      console.error(error)
    } finally {
      setRefreshing(false)
    }
  }

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
    setPage(nextPage)
  }

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Withdrawals</h1>
            <p className="text-muted-foreground mt-1">
              Review, approve, and manage withdrawal requests with bank details verification.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-background/70"
              disabled={isExporting}
              onClick={handleExport}
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                  disabled={batchActionLoading !== null || selectedIds.length === 0}
                >
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  {batchActionLoading ? "Processing" : "Process batch"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleBatchAction("approve")
                  }}
                  disabled={selectedIds.length === 0 || batchActionLoading !== null}
                >
                  <Check className="h-4 w-4" /> Approve selected
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(event) => {
                    event.preventDefault()
                    handleBatchAction("reject")
                  }}
                  disabled={selectedIds.length === 0 || batchActionLoading !== null}
                >
                  <X className="h-4 w-4" /> Reject selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="bg-background/70"
              disabled={refreshing}
              onClick={handleRefresh}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", { "animate-spin": refreshing })} />
              Refresh
            </Button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <Card key={`overview-skeleton-${index}`} className="border-border/30 bg-card/60">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="mt-2 h-4 w-40" />
                  </CardContent>
                </Card>
              ))
            : summaryCards.map(({ key, title, value, description, icon: Icon, accent }) => (
                <Card key={key} className="border-border/30 bg-card/70 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
                      </div>
                      <span className={cn("rounded-full bg-muted/60 p-2", accent)}>
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-foreground">{value}</p>
                  </CardContent>
                </Card>
              ))}
        </section>

        <section className="space-y-6">
          <Card className="border-border/30 bg-card/70">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Withdrawal trend</CardTitle>
                <p className="text-muted-foreground text-sm">Track outgoing withdrawals over time.</p>
              </div>
              <Select value={chartRange} onValueChange={(value) => setChartRange(value as typeof chartRange)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent align="end">
                  {chartRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <div className="flex h-[260px] items-center justify-center">
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[220px] sm:h-[280px] w-full aspect-auto max-w-full overflow-hidden">
                  <AreaChart data={normalizedChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => currencyFormatter.format(value).replace("$", "")}
                      width={yAxisWidth}
                    />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Area type="monotone" dataKey="withdrawals" name="Withdrawals" stroke="var(--color-withdrawals)" fill="var(--color-withdrawals)" fillOpacity={0.2} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/70">
            <CardHeader className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Withdrawal requests</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Latest withdrawal requests requiring attention.
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" />
                {formatCount(pendingCount.withdrawals)} pending
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={statusFilter} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search references or accounts"
                      className="pl-9 w-full"
                    />
                  </div>
                </div>
              </div>
              {/* Mobile cards: show stacked, compact view on xs */}
              <div className="sm:hidden space-y-3">
                {transactionsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`tx-mobile-loading-${i}`} className="rounded-lg border border-border/20 bg-background/40 p-3">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))
                ) : transactions.length === 0 ? (
                  <div className="rounded-lg border border-border/20 bg-background/40 p-3 text-sm text-muted-foreground">No withdrawal requests match the current filters.</div>
                ) : (
                  transactions.map((row) => {
                    const netAmount = parseAmount(row.net_amount || row.amount)
                    return (
                      <div key={`tx-mobile-${row.id}`} className="rounded-lg border border-border/30 bg-card/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)} />
                              <div className="text-sm font-medium text-foreground truncate">{row.transaction_id || `#${row.id}`}</div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 truncate">{row.user_name || row.email}</div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="font-semibold text-foreground">{formatCurrency(netAmount)}</div>
                            <div className="text-xs mt-1"><Badge className={cn("capitalize", getStatusBadge(row.status))}>{row.status.replace("_", " ")}</Badge></div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetailRow(row)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleRowAction(row, "approve")} disabled={rowActionLoading[row.id] !== undefined}>
                            {rowActionLoading[row.id] === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : (<span className="flex items-center gap-1"><Check className="h-4 w-4" />Approve</span>)}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleRowAction(row, "reject")} disabled={rowActionLoading[row.id] !== undefined}>
                            {rowActionLoading[row.id] === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : (<span className="flex items-center gap-1"><X className="h-4 w-4" />Reject</span>)}
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="rounded-lg border border-border/30 hidden sm:block">
                <div className="flex items-center justify-between border-b border-border/30 px-4 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelected ? true : partiallySelected ? "indeterminate" : false}
                      onCheckedChange={handleSelectAll}
                    />
                    <span>{selectedCount} selected</span>
                  </div>
                  <span>Withdrawal mode</span>
                </div>
                <ScrollArea className="h-[360px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                      <TableRow className="border-border/30 text-xs uppercase tracking-wider text-muted-foreground">
                        <TableHead className="w-10" />
                        <TableHead>Reference</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Timeline</TableHead>
                        <TableHead className="w-44" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionsLoading ? (
                        Array.from({ length: 6 }).map((_, index) => (
                          <TableRow key={`transactions-loading-${index}`} className="border-border/20">
                            <TableCell colSpan={8}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                            No withdrawal requests match the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((row) => {
                          const netAmount = parseAmount(row.net_amount || row.amount)

                          return (
                            <TableRow key={row.id} className="border-border/20">
                              <TableCell>
                                <Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)} />
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-foreground">{row.transaction_id || `#${row.id}`}</span>
                                  <span className="text-xs text-muted-foreground">{row.payment_method_name || "Bank transfer"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm text-foreground">{row.user_name || "Unknown user"}</span>
                                  <span className="text-xs text-muted-foreground">{row.email}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <p className="text-foreground font-semibold">{formatCurrency(netAmount)}</p>
                                  {row.fee && parseAmount(row.fee) > 0 && <p className="text-muted-foreground">Fee {formatCurrency(row.fee)}</p>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={cn("capitalize", getStatusBadge(row.status))}>{row.status.replace("_", " ")}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Created</span>
                                    <p className="text-foreground">{formatDateTime(row.created_at)}</p>
                                  </div>
                                  {row.processed_at && (
                                    <div>
                                      <span className="text-muted-foreground">Processed</span>
                                      <p className="text-foreground">{formatDateTime(row.processed_at)}</p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetailRow(row)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRowAction(row, "approve")}
                                    disabled={rowActionLoading[row.id] !== undefined}
                                  >
                                    {rowActionLoading[row.id] === "approve" ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <Check className="h-4 w-4" /> Approve
                                      </span>
                                    )}
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleRowAction(row, "reject")}
                                    disabled={rowActionLoading[row.id] !== undefined}
                                  >
                                    {rowActionLoading[row.id] === "reject" ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <X className="h-4 w-4" /> Reject
                                      </span>
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              <div className="p-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          handlePageChange(currentPage - 1)
                        }}
                        className={cn({ "pointer-events-none opacity-50": currentPage <= 1 })}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }).map((_, index) => {
                      const pageNumber = index + 1
                      const isActive = pageNumber === currentPage
                      return (
                        <PaginationItem key={`page-${pageNumber}`}>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault()
                              handlePageChange(pageNumber)
                            }}
                            isActive={isActive}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          handlePageChange(currentPage + 1)
                        }}
                        className={cn({ "pointer-events-none opacity-50": currentPage >= totalPages })}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </CardContent>
          </Card>
        </section>

        <Dialog open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
          {detailRow && (
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Withdrawal details</DialogTitle>
                <DialogDescription>
                  Review metadata, bank details, and audit trail for reference {detailRow.transaction_id || `#${detailRow.id}`}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <DetailRow label="Transaction ID" value={detailRow.transaction_id || `#${detailRow.id}`} />
                <DetailRow label="Account" value={detailRow.account_number} />
                <DetailRow label="User" value={`${detailRow.user_name || "Unknown"} · ${detailRow.email}`} />
                <DetailRow label="Amount" value={formatCurrency(detailRow.net_amount || detailRow.amount)} />
                <DetailRow label="Status" value={detailRow.status.replace("_", " ")} badgeClassName={cn("capitalize", getStatusBadge(detailRow.status))} />
                <DetailRow label="Created at" value={formatDateTime(detailRow.created_at)} />
                {detailRow.processed_at && <DetailRow label="Processed at" value={formatDateTime(detailRow.processed_at)} />}
                {detailRow.reviewed_at && <DetailRow label="Reviewed at" value={formatDateTime(detailRow.reviewed_at)} />}
                {detailRow.payment_reference && <DetailRow label="Payment reference" value={detailRow.payment_reference} />}
                {detailRow.batch_reference && <DetailRow label="Batch reference" value={detailRow.batch_reference} />}
                
                {/* Bank Details Section */}
                {(detailRow.bank_name || detailRow.bank_account_name || detailRow.bank_account_number) && (
                  <>
                    <div className="border-t border-border/30 pt-4 mt-2">
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3">Bank Details</h4>
                      <div className="grid gap-3">
                        {detailRow.bank_name && <DetailRow label="Bank Name" value={detailRow.bank_name} />}
                        {detailRow.bank_account_name && <DetailRow label="Account Name" value={detailRow.bank_account_name} />}
                        {detailRow.bank_account_number && <DetailRow label="Account Number" value={detailRow.bank_account_number} />}
                        {detailRow.account_type && <DetailRow label="Account Type" value={detailRow.account_type} />}
                        {detailRow.iban && <DetailRow label="IBAN" value={detailRow.iban} />}
                        {detailRow.swift_code && <DetailRow label="SWIFT Code" value={detailRow.swift_code} />}
                        {detailRow.routing_number && <DetailRow label="Routing Number" value={detailRow.routing_number} />}
                        {detailRow.branch_name && <DetailRow label="Branch Name" value={detailRow.branch_name} />}
                      </div>
                    </div>
                  </>
                )}
                
                {detailRow.user_notes && <DetailRow label="User notes" value={detailRow.user_notes} multiline />}
                {detailRow.admin_notes && <DetailRow label="Admin notes" value={detailRow.admin_notes} multiline />}
                {detailRow.review_notes && <DetailRow label="Review notes" value={detailRow.review_notes} multiline />}
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </AdminLayout>
  )
}

function formatChartDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function DetailRow({
  label,
  value,
  badgeClassName,
  multiline = false,
}: {
  label: string
  value: string
  badgeClassName?: string
  multiline?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/30 bg-muted/20 p-3">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {badgeClassName ? (
        <Badge className={badgeClassName}>{value}</Badge>
      ) : (
        <span className={cn("text-sm text-foreground", { "whitespace-pre-wrap": multiline })}>{value}</span>
      )}
    </div>
  )
}
