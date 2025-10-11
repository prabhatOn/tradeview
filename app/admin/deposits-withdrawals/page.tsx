"use client"

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useDebounce } from "@/hooks/use-debounce"
import { useToast } from "@/components/ui/use-toast"
import { adminService } from "@/lib/services"
import {
  AdminFundsChartPoint,
  AdminFundsOverview,
  AdminFundsTransactionRow,
  AdminUserAccountSummary,
  AdminUserDetail,
  AdminUserSummary,
  PaginationInfo,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  Filter,
  HeadphonesIcon,
  LayoutDashboard,
  MoreHorizontal,
  Receipt,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { Loader2 } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

const adminSidebarItems = [
  { title: "Overview", icon: LayoutDashboard, href: "/admin", description: "Dashboard overview and analytics" },
  { title: "User Management", icon: Users, href: "/admin/users", description: "Manage users and accounts" },
  { title: "Trades & Charges", icon: Receipt, href: "/admin/trades-charges", description: "Trading fees and charges" },
  { title: "Trades", icon: TrendingUp, href: "/admin/trades", description: "Trading activities monitoring" },
  { title: "Support Tickets", icon: HeadphonesIcon, href: "/admin/support", description: "Customer support management" },
  { title: "Deposits/Withdrawals", icon: Wallet, href: "/admin/deposits-withdrawals", description: "Transaction management" },
  { title: "Payment Gateway", icon: CreditCard, href: "/admin/payment-gateway", description: "Payment processing settings" },
]

const adminTopBarConfig = {
  title: "Admin Portal",
  showBalance: false,
  showNotifications: true,
  showDeposit: false,
  showUserMenu: true,
}

type TransactionType = "deposits" | "withdrawals"
type BatchAction = "approve" | "reject"

const PAGE_SIZE = 20
const USER_REASON_DEFAULT = "manual_adjustment"
const IB_REASON_DEFAULT = "ib_manual_adjustment"

const USER_REASON_OPTIONS = [
  { value: USER_REASON_DEFAULT, label: "Manual adjustment" },
  { value: "bonus_credit", label: "Bonus credit" },
  { value: "fee_reversal", label: "Fee reversal" },
  { value: "balance_correction", label: "Balance correction" },
]

const IB_REASON_OPTIONS = [
  { value: IB_REASON_DEFAULT, label: "IB manual adjustment" },
  { value: "commission_payout", label: "Commission payout" },
  { value: "commission_reversal", label: "Commission reversal" },
  { value: "rebate_adjustment", label: "Rebate adjustment" },
]

const statusOptions = [
  { value: "all", label: "All status" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
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
  deposits: {
    label: "Deposits",
    color: "hsl(var(--chart-1))",
  },
  withdrawals: {
    label: "Withdrawals",
    color: "hsl(var(--chart-2))",
  },
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
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
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/\"/g, "\"\"")}`
  }
  return stringValue
}

function getStatusBadge(status: string): string {
  return statusStyles[status?.toLowerCase()] ?? "bg-muted text-muted-foreground"
}

export default function AdminDepositsWithdrawalsPage() {
  const { toast } = useToast()

  const [overview, setOverview] = useState<AdminFundsOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [chartRange, setChartRange] = useState<"7d" | "14d" | "30d" | "90d">("30d")
  const [chartData, setChartData] = useState<AdminFundsChartPoint[]>([])
  const [chartLoading, setChartLoading] = useState(true)

  const [currentType, setCurrentType] = useState<TransactionType>("deposits")
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

  const [manualTab, setManualTab] = useState<"users" | "ib">("users")
  const [manualSearchTerm, setManualSearchTerm] = useState("")
  const debouncedManualSearch = useDebounce(manualSearchTerm, 300)
  const [manualSearch, setManualSearch] = useState("")
  const [manualSearchLoading, setManualSearchLoading] = useState(false)
  const [manualSearchResults, setManualSearchResults] = useState<AdminUserSummary[]>([])
  const [manualSelectedUserId, setManualSelectedUserId] = useState<number | null>(null)
  const [manualSelectedUserSummary, setManualSelectedUserSummary] = useState<AdminUserSummary | null>(null)
  const [manualSelectedUserDetail, setManualSelectedUserDetail] = useState<AdminUserDetail | null>(null)
  const [manualAccountsLoading, setManualAccountsLoading] = useState(false)
  const [manualUserAccounts, setManualUserAccounts] = useState<AdminUserAccountSummary[]>([])
  const [manualAdjustmentForm, setManualAdjustmentForm] = useState({
    accountId: "",
    amount: "",
    direction: "credit" as "credit" | "debit",
    reasonCode: USER_REASON_DEFAULT,
    notes: "",
  })
  const [manualSubmitting, setManualSubmitting] = useState(false)

  const manualSearchHasQuery = manualSearch.trim().length > 0
  const manualResultsEmpty = !manualSearchLoading && manualSearchResults.length === 0

  const manualSelectedAccount = useMemo(
    () => manualUserAccounts.find((account) => String(account.id) === manualAdjustmentForm.accountId) ?? null,
    [manualUserAccounts, manualAdjustmentForm.accountId],
  )

  const getDisplayName = useCallback((user?: AdminUserSummary | AdminUserDetail["user"] | null) => {
    if (!user) return "Unknown user"
    const firstName = (user as AdminUserSummary).firstName ?? (user as AdminUserDetail["user"]).firstName ?? user.first_name ?? ""
    const lastName = (user as AdminUserSummary).lastName ?? (user as AdminUserDetail["user"]).lastName ?? user.last_name ?? ""
    const fullName = `${firstName ?? ""} ${lastName ?? ""}`.trim()
    return fullName || user.email
  }, [])

  const userIsIb = useCallback((user?: AdminUserSummary | AdminUserDetail["user"] | null) => {
    if (!user) return false

    const rolesRaw =
      ("roles" in user && user.roles) ??
      ("role" in user && user.role) ??
      ("primary_role" in user && user.primary_role) ??
      undefined

    const rolesArray = Array.isArray(rolesRaw)
      ? rolesRaw
      : rolesRaw
        ? [String(rolesRaw)]
        : []

    if (rolesArray.some((role: string) => role.toLowerCase().includes("ib"))) return true

    const hasIbFlag =
      (("hasIb" in user ? user.hasIb : undefined) ?? ("has_ib" in user ? user.has_ib : undefined)) ?? null

    if (typeof hasIbFlag === "boolean") return hasIbFlag
    if (typeof hasIbFlag === "number") return hasIbFlag === 1

    const ibStatus =
      (("ibApplicationStatus" in user ? user.ibApplicationStatus : undefined) ??
        ("ib_application_status" in user ? user.ib_application_status : undefined)) || null

    if (typeof ibStatus === "string") {
      const normalized = ibStatus.toLowerCase()
      return !["rejected", "inactive"].includes(normalized)
    }

    return false
  }, [])

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    try {
      const response = await adminService.getFundsOverview()
      if (!response.success || !response.data) {
        throw new Error(response.message || "Unable to load overview")
      }
      setOverview(response.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load overview"
      toast({ variant: "destructive", title: "Overview unavailable", description: message })
    } finally {
      setOverviewLoading(false)
    }
  }, [toast])

  const loadChart = useCallback(
    async (range: typeof chartRange) => {
      setChartLoading(true)
      try {
        const response = await adminService.getFundsChart(range)
        if (!response.success || !response.data) {
          throw new Error(response.message || "Unable to load cashflow chart")
        }
        setChartData(response.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load cashflow chart"
        toast({ variant: "destructive", title: "Chart unavailable", description: message })
      } finally {
        setChartLoading(false)
      }
    },
    [toast],
  )

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true)
    try {
      const response = await adminService.getFundsTransactions({
        type: currentType,
        page,
        limit: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: debouncedSearch || undefined,
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || "Unable to load transactions")
      }

      setTransactions(response.data.rows || [])
      setPagination(response.data.pagination)
      setSelectedIds([])
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load transactions"
      toast({ variant: "destructive", title: "Transactions unavailable", description: message })
    } finally {
      setTransactionsLoading(false)
    }
  }, [currentType, debouncedSearch, page, statusFilter, toast])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    loadChart(chartRange)
  }, [chartRange, loadChart])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    setManualSearch(debouncedManualSearch.trim())
  }, [debouncedManualSearch])

  useEffect(() => {
    let cancelled = false

    const fetchUsers = async () => {
      setManualSearchLoading(true)
      try {
        const response = await adminService.getUsers({
          page: 1,
          limit: manualSearchHasQuery ? 25 : 50,
          search: manualSearchHasQuery ? manualSearch : undefined,
          includeAdmins: false,
        })

        if (!response.success || !response.data) {
          throw new Error(response.message || "Unable to fetch users")
        }

        let users = response.data.users ?? []
        if (manualTab === "ib") {
          users = users.filter((candidate) => userIsIb(candidate))
        }

        const sortedUsers = [...users].sort((a, b) => {
          const nameCompare = getDisplayName(a).localeCompare(getDisplayName(b), undefined, { sensitivity: "base" })
          if (nameCompare !== 0) return nameCompare
          return String(a.email || "").localeCompare(String(b.email || ""), undefined, { sensitivity: "base" })
        })

        if (!cancelled) {
          setManualSearchResults(sortedUsers)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load directory"
          toast({ variant: "destructive", title: "Directory lookup failed", description: message })
          setManualSearchResults([])
        }
      } finally {
        if (!cancelled) {
          setManualSearchLoading(false)
        }
      }
    }

    fetchUsers()

    return () => {
      cancelled = true
    }
  }, [getDisplayName, manualSearch, manualSearchHasQuery, manualTab, toast, userIsIb])

  const summaryCards = useMemo(() => {
    const summary = overview?.summary
    return [
      {
        key: "total-deposits",
        title: "Total deposits",
        value: formatCurrency(summary?.totalDeposits ?? 0),
        description: "Gross inbound volume processed",
        icon: ArrowDownCircle,
        accent: "text-emerald-600",
      },
      {
        key: "total-withdrawals",
        title: "Total withdrawals",
        value: formatCurrency(summary?.totalWithdrawals ?? 0),
        description: "Gross outbound volume released",
        icon: ArrowUpCircle,
        accent: "text-red-500",
      },
      {
        key: "pending-deposits",
        title: "Pending deposits",
        value: formatCount(summary?.pendingDeposits ?? 0),
        description: "Awaiting finance approval",
        icon: CheckCircle2,
        accent: "text-amber-500",
      },
      {
        key: "pending-withdrawals",
        title: "Pending withdrawals",
        value: formatCount(summary?.pendingWithdrawals ?? 0),
        description: "Awaiting treasury release",
        icon: AlertCircle,
        accent: "text-orange-500",
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
        deposits: parseAmount(point.totalDeposits),
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
    if (!summary) return { deposits: 0, withdrawals: 0 }
    return {
      deposits: summary.pendingDeposits ?? 0,
      withdrawals: summary.pendingWithdrawals ?? 0,
    }
  }, [overview])

  const manualSearchPlaceholder = manualTab === "ib" ? "Search introducing brokers" : "Search users"

  const handleTypeChange = (type: TransactionType) => {
    setCurrentType(type)
    setPage(1)
  }

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
        type: currentType,
        ids: selectedIds,
      })

      if (!response.success) {
        throw new Error(response.message || "Batch action failed")
      }

      toast({
        title: `Batch ${action === "approve" ? "approval" : "rejection"} queued`,
        description: `${selectedIds.length} ${currentType} request${selectedIds.length === 1 ? "" : "s"} scheduled for processing.`,
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
      const serviceCall =
        currentType === "deposits"
          ? action === "approve"
            ? adminService.approveFundsDeposit
            : adminService.rejectFundsDeposit
          : action === "approve"
            ? adminService.approveFundsWithdrawal
            : adminService.rejectFundsWithdrawal

      const response = await serviceCall(row.id)
      if (!response.success) {
        throw new Error(response.message || `Failed to ${action} transaction`)
      }

      toast({
        title: `Transaction ${action === "approve" ? "approved" : "rejected"}`,
        description: `Reference ${row.transaction_id} updated successfully.`,
      })

      await Promise.all([loadTransactions(), loadOverview()])
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${action} transaction`
      toast({ variant: "destructive", title: `Unable to ${action} transaction`, description: message })
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
        type: currentType,
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
      link.setAttribute("download", `funds-${currentType}-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`)
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

  const handleManualTabChange = (value: string) => {
    if (value !== "users" && value !== "ib") return
    setManualTab(value)
    setManualSearchTerm("")
    setManualSearch("")
    setManualAdjustmentForm((prev) => ({
      ...prev,
      reasonCode: value === "ib" ? IB_REASON_DEFAULT : USER_REASON_DEFAULT,
    }))
    setManualUserAccounts([])
    setManualSelectedUserId(null)
    setManualSelectedUserSummary(null)
    setManualSelectedUserDetail(null)
  }

  const resetManualSelection = useCallback(() => {
    setManualSelectedUserId(null)
    setManualSelectedUserSummary(null)
    setManualSelectedUserDetail(null)
    setManualUserAccounts([])
    setManualAdjustmentForm((prev) => ({
      ...prev,
      accountId: "",
      notes: "",
      reasonCode: manualTab === "ib" ? IB_REASON_DEFAULT : USER_REASON_DEFAULT,
    }))
  }, [manualTab])

  const handleManualSelectUser = useCallback(
    async (user: AdminUserSummary) => {
      setManualSelectedUserId(user.id)
      setManualSelectedUserSummary(user)
      setManualAccountsLoading(true)
      try {
        const response = await adminService.getUser(user.id)
        if (!response.success || !response.data) {
          throw new Error(response.message || "Unable to load user detail")
        }

        setManualSelectedUserDetail(response.data)
        const accounts = response.data.accounts ?? []
        setManualUserAccounts(accounts)
        setManualAdjustmentForm((prev) => ({
          ...prev,
          accountId: accounts.length > 0 ? String(accounts[0].id) : "",
          reasonCode: manualTab === "ib" ? IB_REASON_DEFAULT : prev.reasonCode || USER_REASON_DEFAULT,
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load user detail"
        toast({ variant: "destructive", title: "Failed to load user", description: message })
        resetManualSelection()
      } finally {
        setManualAccountsLoading(false)
      }
    },
    [manualTab, resetManualSelection, toast],
  )

  const handleManualFieldChange = (field: keyof typeof manualAdjustmentForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value
      setManualAdjustmentForm((prev) => ({ ...prev, [field]: value }))
    }

  const handleManualSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!manualSelectedUserId || !manualSelectedAccount) {
        toast({
          variant: "destructive",
          title: "Select a trading account",
          description: "Pick a user and account before applying adjustments.",
        })
        return
      }

      const parsedAmount = parseFloat(manualAdjustmentForm.amount)
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        toast({
          variant: "destructive",
          title: "Invalid amount",
          description: "Enter a positive amount to continue.",
        })
        return
      }

      setManualSubmitting(true)
      try {
        const payload = {
          accountId: Number(manualAdjustmentForm.accountId),
          amount: Math.abs(parsedAmount),
          direction: manualAdjustmentForm.direction,
          reasonCode:
            manualAdjustmentForm.reasonCode || (manualTab === "ib" ? IB_REASON_DEFAULT : USER_REASON_DEFAULT),
          notes: manualAdjustmentForm.notes?.trim() ? manualAdjustmentForm.notes.trim() : undefined,
          metadata: {
            manualTargetType: manualTab,
            userId: manualSelectedUserId,
            userEmail: manualSelectedUserSummary?.email ?? manualSelectedUserDetail?.user.email ?? null,
            initiatedAt: new Date().toISOString(),
          },
        }

        const response = await adminService.applyFundsManualAdjustment(payload)
        if (!response.success) {
          throw new Error(response.message || "Manual adjustment failed")
        }

        toast({
          title: `Manual ${manualAdjustmentForm.direction === "credit" ? "credit" : "debit"} applied`,
          description: `${formatCurrency(parsedAmount)} ${manualAdjustmentForm.direction === "credit" ? "added to" : "deducted from"} ${getDisplayName(manualSelectedUserSummary || manualSelectedUserDetail?.user)}.`,
        })

        setManualAdjustmentForm((prev) => ({
          ...prev,
          amount: "",
          notes: "",
        }))

        await Promise.allSettled([loadOverview(), loadTransactions()])
      } catch (error) {
        const message = error instanceof Error ? error.message : "Manual adjustment failed"
        toast({ variant: "destructive", title: "Unable to apply adjustment", description: message })
      } finally {
        setManualSubmitting(false)
      }
    },
    [
      getDisplayName,
      loadOverview,
      loadTransactions,
  manualAdjustmentForm.accountId,
      manualAdjustmentForm.amount,
      manualAdjustmentForm.direction,
      manualAdjustmentForm.notes,
      manualAdjustmentForm.reasonCode,
      manualSelectedAccount,
      manualSelectedUserDetail,
      manualSelectedUserId,
      manualSelectedUserSummary,
      manualTab,
      toast,
    ],
  )

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Deposits & Withdrawals</h1>
            <p className="text-muted-foreground mt-1">
              Review, approve, and reconcile funding requests across all accounts.
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overviewLoading
            ? Array.from({ length: 6 }).map((_, index) => (
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

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-border/30 bg-card/70 lg:col-span-2">
            <CardHeader className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Cashflow trend</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Track incoming deposits against outgoing withdrawals over time.
                </p>
              </div>
              <Select value={chartRange} onValueChange={(value) => setChartRange(value as typeof chartRange)}>
                <SelectTrigger className="w-40">
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
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <AreaChart data={normalizedChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => currencyFormatter.format(value).replace("$", "")}
                      width={70}
                    />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    <Area
                      type="monotone"
                      dataKey="deposits"
                      name="Deposits"
                      stroke="var(--color-deposits)"
                      fill="var(--color-deposits)"
                      fillOpacity={0.2}
                    />
                    <Area
                      type="monotone"
                      dataKey="withdrawals"
                      name="Withdrawals"
                      stroke="var(--color-withdrawals)"
                      fill="var(--color-withdrawals)"
                      fillOpacity={0.2}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/70">
            <CardHeader className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">Processing queue</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Latest deposits and withdrawals requiring attention.
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" />
                {currentType === "deposits"
                  ? formatCount(pendingCount.deposits)
                  : formatCount(pendingCount.withdrawals)}{" "}
                pending
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={currentType} onValueChange={(value) => handleTypeChange(value as TransactionType)}>
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="deposits" className="flex items-center gap-2">
                    Deposits{" "}
                    <Badge variant="secondary" className="ml-1">
                      {formatCount(pendingCount.deposits)}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="withdrawals" className="flex items-center gap-2">
                    Withdrawals{" "}
                    <Badge variant="secondary" className="ml-1">
                      {formatCount(pendingCount.withdrawals)}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select value={statusFilter} onValueChange={handleStatusChange}>
                    <SelectTrigger className="sm:w-48">
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
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border/30">
                <div className="flex items-center justify-between border-b border-border/30 px-4 py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelected ? true : partiallySelected ? "indeterminate" : false}
                      onCheckedChange={handleSelectAll}
                    />
                    <span>{selectedCount} selected</span>
                  </div>
                  <span className="capitalize">{currentType === "deposits" ? "Deposit" : "Withdrawal"} mode</span>
                </div>
                <ScrollArea className="h-[360px]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                      <TableRow className="border-border/30 text-xs uppercase tracking-wider text-muted-foreground">
                        <TableHead className="w-10" />
                        <TableHead>Reference</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Net amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Timeline</TableHead>
                        <TableHead className="w-44" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionsLoading ? (
                        Array.from({ length: 6 }).map((_, index) => (
                          <TableRow key={`transactions-loading-${index}`} className="border-border/20">
                            <TableCell colSpan={7}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                            No {currentType} requests match the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((row) => {
                          const netAmount = parseAmount(row.net_amount || row.amount)
                          const feeAmount = parseAmount(row.fee)
                          const selectionState = selectedIds.includes(row.id)

                          return (
                            <TableRow key={row.id} className="border-border/20">
                              <TableCell>
                                <Checkbox checked={selectionState} onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)} />
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-foreground">{row.transaction_id || `#${row.id}`}</span>
                                  <span className="text-xs text-muted-foreground">{row.payment_method_name || "Unknown method"}</span>
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
                                  <p className="text-foreground font-semibold">Gross {formatCurrency(row.amount)}</p>
                                  {feeAmount > 0 && <p className="text-muted-foreground">Fee {formatCurrency(row.fee)}</p>}
                                  <p className="text-emerald-500 font-medium">Net {formatCurrency(netAmount)}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={cn("capitalize", getStatusBadge(row.status))}>{row.status}</Badge>
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

        <Card id="manual-fund-adjustment" className="border-dashed border-border/40 bg-muted/10">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-foreground">Manual fund adjustment</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Credit or debit funds for users and introducing brokers. Search, select, and confirm below.
                </p>
              </div>
              {(manualSelectedUserSummary || manualSelectedUserDetail) && (
                <Badge variant="outline" className="flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-medium">
                  <Check className="h-3.5 w-3.5" />
                  {getDisplayName(manualSelectedUserSummary || manualSelectedUserDetail?.user)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={manualTab} onValueChange={handleManualTabChange} className="space-y-6">
              <div className="flex flex-col gap-6 xl:flex-row">
                <div className="space-y-4 xl:w-7/12">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <TabsList className="grid w-full grid-cols-2 lg:w-auto">
                      <TabsTrigger value="users">Users</TabsTrigger>
                      <TabsTrigger value="ib">Introducing Brokers</TabsTrigger>
                    </TabsList>
                    <div className="relative w-full lg:w-72">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={manualSearchTerm}
                        onChange={(event) => setManualSearchTerm(event.target.value)}
                        placeholder={manualSearchPlaceholder}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-background/60">
                    <div className="flex items-center justify-between border-b border-border/40 px-4 py-2 text-xs text-muted-foreground">
                      <span>
                        {manualSearchLoading ? (
                          "Loading results..."
                        ) : manualSearchResults.length ? (
                          `${formatCount(manualSearchResults.length)} ${manualTab === "ib" ? "brokers" : "users"} listed`
                        ) : manualSearchHasQuery ? (
                          <>No matches for &ldquo;{manualSearch}&rdquo;</>
                        ) : (
                          `No ${manualTab === "ib" ? "brokers" : "users"} found`
                        )}
                      </span>
                      <span className="capitalize text-muted-foreground">{manualTab === "ib" ? "IB mode" : "User mode"}</span>
                    </div>
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                          <TableRow className="border-border/30 text-xs uppercase tracking-wide text-muted-foreground">
                            <TableHead className="min-w-[180px]">Name</TableHead>
                            <TableHead className="min-w-[200px]">Email</TableHead>
                            <TableHead className="min-w-[80px] text-center">Accounts</TableHead>
                            <TableHead className="min-w-[110px] text-center">Status</TableHead>
                            <TableHead className="min-w-[120px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {manualSearchLoading ? (
                            Array.from({ length: 4 }).map((_, index) => (
                              <TableRow key={`manual-loading-${index}`} className="border-border/20">
                                <TableCell colSpan={5}>
                                  <Skeleton className="h-5 w-full" />
                                </TableCell>
                              </TableRow>
                            ))
                          ) : manualResultsEmpty ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                {manualSearchHasQuery ? (
                                  <>No {manualTab === "ib" ? "IBs" : "users"} match &ldquo;{manualSearch}&rdquo;. Try a different query.</>
                                ) : (
                                  `No ${manualTab === "ib" ? "IBs" : "users"} available.`
                                )}
                              </TableCell>
                            </TableRow>
                          ) : (
                            manualSearchResults.map((user) => {
                              const displayName = getDisplayName(user)
                              const accountCount = parseAmount(user.tradingAccountsCount ?? user.trading_accounts_count ?? 0)
                              const isSelected = manualSelectedUserId === user.id
                              const isIbCandidate = userIsIb(user)
                              const statusLabel = (user.status || "unknown").replace(/_/g, " ")
                              return (
                                <TableRow
                                  key={user.id}
                                  className={cn("border-border/20 transition", {
                                    "bg-primary/5": isSelected,
                                  })}
                                >
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium text-foreground">{displayName}</span>
                                      {user.phone && <span className="text-xs text-muted-foreground">{user.phone}</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-sm text-muted-foreground">{user.email}</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline">{formatCount(accountCount)}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col items-center gap-1">
                                      <Badge variant={isIbCandidate ? "default" : "secondary"} className="capitalize">
                                        {isIbCandidate ? "IB" : "User"}
                                      </Badge>
                                      <Badge variant="outline" className="capitalize">
                                        {statusLabel}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      size="sm"
                                      variant={isSelected ? "default" : "outline"}
                                      className={cn(
                                        "h-8 px-3 text-xs font-medium transition-colors",
                                        isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                                      )}
                                      onClick={() => {
                                        if (isSelected) {
                                          resetManualSelection()
                                          return
                                        }
                                        handleManualSelectUser(user)
                                      }}
                                      disabled={manualAccountsLoading && manualSelectedUserId !== user.id}
                                    >
                                      {manualAccountsLoading && manualSelectedUserId === user.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : isSelected ? (
                                        <span className="flex items-center gap-1">
                                          <Check className="h-3.5 w-3.5" />
                                          Selected
                                        </span>
                                      ) : (
                                        "Select"
                                      )}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>
                <div className="space-y-4 xl:flex-1 xl:overflow-hidden">
                  {!manualSelectedUserSummary && !manualSelectedUserDetail ? (
                    <Alert className="border-dashed">
                      <AlertTitle className="text-sm font-semibold">Select a {manualTab === "ib" ? "broker" : "user"}</AlertTitle>
                      <AlertDescription className="text-sm text-muted-foreground">
                        Search and choose a {manualTab === "ib" ? "broker" : "user"} from the table to load their trading accounts and enable adjustments.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <ScrollArea className="xl:h-[560px] xl:pr-4">
                      <div className="space-y-4">
                      <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {getDisplayName(manualSelectedUserSummary || manualSelectedUserDetail?.user)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {manualSelectedUserSummary?.email ?? manualSelectedUserDetail?.user.email}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="capitalize">
                              {(manualSelectedUserSummary?.status || manualSelectedUserDetail?.user.status || "active").replace(/_/g, " ")}
                            </Badge>
                            {userIsIb(manualSelectedUserSummary || manualSelectedUserDetail?.user) && <Badge variant="default">IB</Badge>}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                          <div>
                            <span className="text-muted-foreground">Trading accounts</span>
                            <p className="font-medium text-foreground">{formatCount(manualUserAccounts.length)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total balance</span>
                            <p className="font-medium text-foreground">
                              {formatCurrency(
                                manualSelectedUserSummary?.totalBalance ??
                                  manualSelectedUserSummary?.total_balance ??
                                  manualSelectedUserDetail?.accounts.reduce((sum, account) => sum + parseAmount(account.balance), 0) ??
                                  0,
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trading accounts</Label>
                        <div className="rounded-lg border border-border/40 bg-background/60">
                          {manualAccountsLoading ? (
                            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading accounts...
                            </div>
                          ) : manualUserAccounts.length === 0 ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">No trading accounts found for this profile.</div>
                          ) : (
                            <ScrollArea className="max-h-56">
                              <Table>
                                <TableHeader className="bg-muted/40">
                                  <TableRow className="border-border/30">
                                    <TableHead className="min-w-[160px]">Account</TableHead>
                                    <TableHead className="min-w-[110px]">Type</TableHead>
                                    <TableHead className="min-w-[110px] text-right">Balance</TableHead>
                                    <TableHead className="min-w-[110px] text-right">Equity</TableHead>
                                    <TableHead className="min-w-[100px] text-center">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {manualUserAccounts.map((account) => {
                                    const isActiveAccount = manualAdjustmentForm.accountId === String(account.id)
                                    return (
                                      <TableRow
                                        key={account.id}
                                        className={cn("cursor-pointer border-border/20 transition", {
                                          "bg-primary/5": isActiveAccount,
                                        })}
                                        onClick={() =>
                                          setManualAdjustmentForm((prev) => ({
                                            ...prev,
                                            accountId: String(account.id),
                                          }))
                                        }
                                      >
                                        <TableCell>
                                          <div className="flex flex-col">
                                            <span className="text-sm font-medium text-foreground">{account.account_number}</span>
                                            <span className="text-xs text-muted-foreground">Leverage 1:{account.leverage}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="capitalize">{account.account_type}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(account.balance)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(account.equity)}</TableCell>
                                        <TableCell className="text-center">
                                          <Badge variant="outline" className="capitalize">
                                            {account.status.replace(/_/g, " ")}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          )}
                        </div>
                      </div>

                      {manualSelectedAccount && (
                        <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                          <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wide">
                            <span className="font-semibold">Selected account</span>
                            <Badge variant="outline">{manualSelectedAccount.account_number}</Badge>
                          </div>
                          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                            <div>
                              <span className="text-emerald-600/80 dark:text-emerald-200/80">Balance</span>
                              <p className="font-semibold">{formatCurrency(manualSelectedAccount.balance)}</p>
                            </div>
                            <div>
                              <span className="text-emerald-600/80 dark:text-emerald-200/80">Equity</span>
                              <p className="font-semibold">{formatCurrency(manualSelectedAccount.equity)}</p>
                            </div>
                            <div>
                              <span className="text-emerald-600/80 dark:text-emerald-200/80">Free margin</span>
                              <p className="font-semibold">{formatCurrency(manualSelectedAccount.free_margin)}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleManualSubmit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adjustment type</Label>
                            <Select
                              value={manualAdjustmentForm.direction}
                              onValueChange={(value: "credit" | "debit") =>
                                setManualAdjustmentForm((prev) => ({
                                  ...prev,
                                  direction: value,
                                }))
                              }
                            >
                              <SelectTrigger className="capitalize">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="credit">Credit funds</SelectItem>
                                <SelectItem value="debit">Debit funds</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={manualAdjustmentForm.amount}
                              onChange={handleManualFieldChange("amount")}
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason</Label>
                          <Select
                            value={manualAdjustmentForm.reasonCode}
                            onValueChange={(value) =>
                              setManualAdjustmentForm((prev) => ({
                                ...prev,
                                reasonCode: value,
                              }))
                            }
                          >
                            <SelectTrigger className="capitalize">
                              <SelectValue placeholder="Choose reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {(manualTab === "ib" ? IB_REASON_OPTIONS : USER_REASON_OPTIONS).map((option) => (
                                <SelectItem key={option.value} value={option.value} className="capitalize">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal notes</Label>
                          <Textarea
                            rows={4}
                            placeholder="Add an optional note for the audit trail"
                            value={manualAdjustmentForm.notes}
                            onChange={handleManualFieldChange("notes")}
                          />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-muted-foreground">
                            Adjustment will be logged with an audit trail for {manualTab === "ib" ? "IB" : "user"}{" "}
                            {getDisplayName(manualSelectedUserSummary || manualSelectedUserDetail?.user)}.
                          </p>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="ghost" onClick={resetManualSelection} disabled={manualSubmitting}>
                              Clear selection
                            </Button>
                            <Button
                              type="submit"
                              disabled={manualSubmitting || manualAccountsLoading || !manualAdjustmentForm.accountId}
                            >
                              {manualSubmitting ? (
                                <span className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Processing...
                                </span>
                              ) : manualAdjustmentForm.direction === "credit" ? (
                                <span className="flex items-center gap-2">
                                  <ArrowDownCircle className="h-4 w-4" />
                                  Credit funds
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <ArrowUpCircle className="h-4 w-4" />
                                  Debit funds
                                </span>
                              )}
                            </Button>
                          </div>
                        </div>
                      </form>
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
          {detailRow && (
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Transaction details</DialogTitle>
                <DialogDescription>
                  Review metadata, notes, and audit trail for reference {detailRow.transaction_id || `#${detailRow.id}`}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <DetailRow label="Transaction ID" value={detailRow.transaction_id || `#${detailRow.id}`} />
                <DetailRow label="Account" value={detailRow.account_number} />
                <DetailRow label="User" value={`${detailRow.user_name || "Unknown"} · ${detailRow.email}`} />
                <DetailRow
                  label="Amounts"
                  value={`Gross ${formatCurrency(detailRow.amount)} | Fee ${formatCurrency(detailRow.fee)} | Net ${formatCurrency(detailRow.net_amount || detailRow.amount)}`}
                />
                <DetailRow label="Status" value={detailRow.status} badgeClassName={cn("capitalize", getStatusBadge(detailRow.status))} />
                <DetailRow label="Created at" value={formatDateTime(detailRow.created_at)} />
                {detailRow.processed_at && <DetailRow label="Processed at" value={formatDateTime(detailRow.processed_at)} />}
                {detailRow.reviewed_at && <DetailRow label="Reviewed at" value={formatDateTime(detailRow.reviewed_at)} />}
                {detailRow.payment_reference && <DetailRow label="Payment reference" value={detailRow.payment_reference} />}
                {detailRow.batch_reference && <DetailRow label="Batch reference" value={detailRow.batch_reference} />}
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