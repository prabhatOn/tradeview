"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import { useAuth } from '@/contexts/AuthContext'
import { AdminLayout } from "@/components/admin/admin-layout"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
// Alert components intentionally removed from this file to reduce unused imports
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// Chart UI removed for deposit requests table
import { useDebounce } from "@/hooks/use-debounce"
import { useToast } from "@/components/ui/use-toast"
import { adminService } from "@/lib/services"
import {
  AdminFundsOverview,
  AdminFundsTransactionRow,
  AdminUserAccountSummary,
  AdminUserDetail,
  AdminUserSummary,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Check,
  CheckCircle2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react"
import { Loader2 } from "lucide-react"
// recharts removed

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

// chart range options were used by the removed chart UI

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("en-US")

// chart config removed

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



function getStatusBadge(status: string): string {
  return statusStyles[status?.toLowerCase()] ?? "bg-muted text-muted-foreground"
}

function summarizeAccounts(accounts: AdminUserAccountSummary[]) {
  const totalBalance = accounts.reduce((sum, account) => sum + parseAmount(account.balance), 0)
  return {
    totalBalance,
    accountCount: accounts.length,
  }
}

export default function AdminDepositsPage() {
  const { toast } = useToast()

  const [overview, setOverview] = useState<AdminFundsOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  // charting removed for deposit requests table

  // Deposit requests (admin review)
  const [depositRequests, setDepositRequests] = useState<AdminFundsTransactionRow[]>([])
  const [depositRequestsLoading, setDepositRequestsLoading] = useState(true)
  const [depositPage] = useState(1)
  const [depositLimit] = useState(50)

  const [detailRow, setDetailRow] = useState<AdminFundsTransactionRow | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [manualModalOpen, setManualModalOpen] = useState(false)

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

  const isMountedRef = useRef(true)
  const overviewRequestIdRef = useRef(0)

  const manualSearchHasQuery = manualSearch.trim().length > 0
  const manualResultsEmpty = !manualSearchLoading && manualSearchResults.length === 0

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const manualSelectedAccount = useMemo(
    () => manualUserAccounts.find((account) => String(account.id) === manualAdjustmentForm.accountId) ?? null,
    [manualUserAccounts, manualAdjustmentForm.accountId],
  )

  const refreshManualUserDetail = useCallback(
    async (
      userId: number,
      {
        preserveAccountSelection = false,
        summarySeed = null,
        suppressToastOnError = false,
      }: {
        preserveAccountSelection?: boolean
        summarySeed?: AdminUserSummary | null
        suppressToastOnError?: boolean
      } = {},
    ) => {
      setManualAccountsLoading(true)
      try {
        const response = await adminService.getUser(userId)
        if (!response.success || !response.data) {
          throw new Error(response.message || "Unable to load user detail")
        }

        const detail = response.data
        const accounts = detail.accounts ?? []
        const { totalBalance, accountCount } = summarizeAccounts(accounts)

        setManualSelectedUserDetail(detail)
        setManualUserAccounts(accounts)

        setManualAdjustmentForm((prev) => {
          const hasExistingSelection =
            preserveAccountSelection && prev.accountId && accounts.some((account) => String(account.id) === prev.accountId)
          const fallbackAccountId = accounts.length > 0 ? String(accounts[0].id) : ""
          return {
            ...prev,
            accountId: hasExistingSelection ? prev.accountId : fallbackAccountId,
            reasonCode: prev.reasonCode || (manualTab === "ib" ? IB_REASON_DEFAULT : USER_REASON_DEFAULT),
          }
        })

        const applySummaryEnhancements = (candidate: AdminUserSummary | null | undefined) => {
          if (!candidate || candidate.id !== detail.user.id) {
            return candidate || null
          }
          return {
            ...candidate,
            totalBalance,
            total_balance: totalBalance,
            tradingAccountsCount: accountCount,
            trading_accounts_count: accountCount,
          }
        }

        setManualSelectedUserSummary((prev) => {
          if (prev && prev.id === detail.user.id) {
            return applySummaryEnhancements(prev)
          }
          if (summarySeed && summarySeed.id === detail.user.id) {
            return applySummaryEnhancements(summarySeed)
          }
          return prev
        })

        setManualSearchResults((prev) =>
          prev.map((candidate) => (candidate.id === detail.user.id ? (applySummaryEnhancements(candidate) as AdminUserSummary) : candidate)),
        )

        return detail
      } catch (error) {
        if (!suppressToastOnError) {
          const message = error instanceof Error ? error.message : "Unable to load user detail"
          toast({ variant: "destructive", title: "Failed to load user", description: message })
        }
        if (!preserveAccountSelection) {
          setManualAdjustmentForm((prev) => ({
            ...prev,
            accountId: "",
          }))
        }
        throw error
      } finally {
        setManualAccountsLoading(false)
      }
    },
    [manualTab, toast],
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

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

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
        key: "pending-deposits",
        title: "Pending deposits",
        value: formatCount(summary?.pendingDeposits ?? 0),
        description: "Awaiting finance approval",
        icon: CheckCircle2,
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

  // normalizedChartData removed (charting removed)



  const manualSearchPlaceholder = manualTab === "ib" ? "Search introducing brokers" : "Search users"



  const loadDepositRequests = useCallback(async (page = 1) => {
    setDepositRequestsLoading(true)
    try {
      const resp = await adminService.getFundsTransactions({ type: 'deposits', page, limit: depositLimit, status: 'pending' })
      if (!resp.success || !resp.data) throw new Error(resp.message || 'Unable to load deposit requests')
      setDepositRequests(Array.isArray(resp.data.rows) ? resp.data.rows : (resp.data.transactions ?? []))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load deposit requests'
      toast({ variant: 'destructive', title: 'Failed to load deposits', description: message })
    } finally {
      setDepositRequestsLoading(false)
    }
  }, [depositLimit, toast])

  // Load deposit requests on mount and when page changes — wait for auth to be initialized
  const { isLoading: authLoading, isAuthenticated, user: authUser } = useAuth()

  useEffect(() => {
    // don't attempt fetch while auth is initializing
    if (authLoading) return

    // require authenticated admin to auto-load deposit requests
    const hasAdminRole = !!(
      authUser && (
        (Array.isArray(authUser.roles) && authUser.roles.includes('admin')) ||
        (typeof authUser.role === 'string' && authUser.role.toLowerCase() === 'admin')
      )
    )

    if (!isAuthenticated || !hasAdminRole) {
      // clear any stale state
      setDepositRequests([])
      setDepositRequestsLoading(false)
      return
    }

    loadDepositRequests(depositPage)
  }, [authLoading, isAuthenticated, authUser, loadDepositRequests, depositPage])

  const processDepositAction = useCallback(
    async (id: number, action: 'approve' | 'reject') => {
      setDepositRequestsLoading(true)
      try {
        const resp = await adminService.processDeposit(id, action)
        if (!resp.success) throw new Error(resp.message || 'Failed to process deposit')
        toast({ title: `Deposit ${action}d`, description: `Deposit ${action} action completed` })
        // refresh list and overview
        await Promise.all([loadDepositRequests(depositPage), loadOverview()])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to process deposit'
        toast({ variant: 'destructive', title: 'Action failed', description: message })
      } finally {
        setDepositRequestsLoading(false)
      }
    },
    [depositPage, loadDepositRequests, loadOverview, toast],
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([loadOverview(), loadDepositRequests(depositPage)])
      toast({ title: 'Data refreshed' })
    } catch (error) {
      console.error(error)
    } finally {
      setRefreshing(false)
    }
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
    setManualModalOpen(false)
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
      setManualModalOpen(true)
      try {
        await refreshManualUserDetail(user.id, { summarySeed: user, suppressToastOnError: true })
      } catch (error) {
        resetManualSelection()
        setManualModalOpen(false)
        const message = error instanceof Error ? error.message : "Unable to load user detail"
        toast({ variant: "destructive", title: "Failed to load user", description: message })
      }
    },
    [refreshManualUserDetail, resetManualSelection, toast],
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

        const refreshTasks: Array<Promise<unknown>> = [loadOverview()]
        if (manualSelectedUserId) {
          refreshTasks.push(
            refreshManualUserDetail(manualSelectedUserId, {
              preserveAccountSelection: true,
              suppressToastOnError: true,
            }),
          )
        }

        await Promise.allSettled(refreshTasks)
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
      refreshManualUserDetail,
      toast,
    ],
  )

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Deposits</h1>
            <p className="text-muted-foreground mt-1">
              Review, approve, and manage deposit requests and manual fund adjustments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-border/30 bg-card/70 lg:col-span-3">
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Deposit Requests</CardTitle>
                <p className="text-muted-foreground text-sm">Pending deposit requests awaiting admin review.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => loadDepositRequests()}>Refresh</Button>
              </div>
            </CardHeader>
            <CardContent>
              {depositRequestsLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Skeleton className="h-6 w-64" />
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Txn</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Fee</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {depositRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-6">No pending deposit requests</TableCell>
                        </TableRow>
                      ) : (
                        depositRequests.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.transaction_id || `#${row.id}`}</TableCell>
                            <TableCell>{row.account_number}</TableCell>
                            <TableCell>{row.user_name ? `${row.user_name} · ${row.email}` : row.email}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.fee)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.net_amount ?? row.amount)}</TableCell>
                            <TableCell><span className={cn("px-2 py-1 rounded-full text-xs", getStatusBadge(row.status))}>{row.status}</span></TableCell>
                            <TableCell>{formatDateTime(row.created_at)}</TableCell>
                            <TableCell className="pr-2">
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setDetailRow(row)}>View</Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => processDepositAction(row.id, 'approve')}
                                  disabled={row.status !== 'pending' || depositRequestsLoading}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => processDepositAction(row.id, 'reject')}
                                  disabled={row.status !== 'pending' || depositRequestsLoading}
                                >
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Card id="manual-fund-adjustment" className="border-dashed border-border/40 bg-muted/10">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-foreground">Manual fund management</CardTitle>
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
              {/* Header: tabs + search */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="grid w-full grid-cols-2 sm:w-full gap-2">
                  <TabsTrigger value="users">Users</TabsTrigger>
                  <TabsTrigger  value="ib">Brokers</TabsTrigger>
                </TabsList>
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={manualSearchTerm}
                    onChange={(event) => setManualSearchTerm(event.target.value)}
                    placeholder={manualSearchPlaceholder}
                    className="pl-9 w-full"
                  />
                </div>
              </div>

              {/* Results container (shared for both tabs) */}
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

                {/* Mobile cards (stacked) */}
                <div className="sm:hidden space-y-3">
                  {manualSearchLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={`mobile-loading-${i}`} className="rounded-lg border border-border/20 bg-background/40 p-3">
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    ))
                  ) : manualResultsEmpty ? (
                    <div className="rounded-lg border border-border/20 bg-background/40 p-3 text-sm text-muted-foreground">
                      {manualSearchHasQuery ? `No matches for "${manualSearch}"` : `No ${manualTab === 'ib' ? 'IBs' : 'users'} available.`}
                    </div>
                  ) : (
                    manualSearchResults.map((user) => {
                      const displayName = getDisplayName(user)
                      const accountCount = parseAmount(user.tradingAccountsCount ?? user.trading_accounts_count ?? 0)
                      const isSelected = manualSelectedUserId === user.id
                      const isIbCandidate = userIsIb(user)
                      const statusLabel = (user.status || 'unknown').replace(/_/g, ' ')
                      return (
                        <div key={`mobile-user-${user.id}`} className={cn('rounded-lg border border-border/20 bg-background/40 p-3 flex flex-col gap-2', { 'bg-primary/5': isSelected })}>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-foreground">{displayName}</div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm"><Badge variant="outline">{formatCount(accountCount)}</Badge></div>
                              <div className="text-xs mt-1">
                                <Badge variant={isIbCandidate ? 'default' : 'secondary'} className="capitalize mr-1">{isIbCandidate ? 'IB' : 'User'}</Badge>
                                <Badge variant="outline" className="capitalize">{statusLabel}</Badge>
                              </div>
                            </div>
                          </div>
                          <div>
                            <Button
                              size="sm"
                              variant={isSelected ? 'default' : 'outline'}
                              className="w-full mt-2"
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
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isSelected ? (
                                <span className="flex items-center gap-2 justify-center"><Check className="h-4 w-4" /> Selected</span>
                              ) : (
                                'Select'
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur">
                        <TableRow className="border-border/30 text-xs uppercase tracking-wide text-muted-foreground">
                          <TableHead className="min-w-[140px]">Name</TableHead>
                          <TableHead className="min-w-[160px]">Email</TableHead>
                          <TableHead className="min-w-[64px] text-center">Accounts</TableHead>
                          <TableHead className="min-w-[84px] text-center">Status</TableHead>
                          <TableHead className="min-w-[80px]" />
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
                                      "h-8 px-3 text-xs font-medium transition-colors w-full sm:w-auto",
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
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={manualModalOpen} onOpenChange={(open) => !open && resetManualSelection()}>
          <DialogContent className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-3xl max-h-[90vh] overflow-hidden mx-3 sm:mx-0 sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Manual fund adjustment</DialogTitle>
              <DialogDescription>
                Review account details and make fund adjustments for {manualTab === "ib" ? "introducing broker" : "user"} {manualSelectedUserSummary ? getDisplayName(manualSelectedUserSummary) : ""}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4 min-w-0">
                {/* User summary */}
                <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{getDisplayName(manualSelectedUserSummary || manualSelectedUserDetail?.user)}</p>
                      <p className="text-xs text-muted-foreground">{manualSelectedUserSummary?.email ?? manualSelectedUserDetail?.user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{(manualSelectedUserSummary?.status || manualSelectedUserDetail?.user.status || "active").replace(/_/g, " ")}</Badge>
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
                      <p className="font-medium text-foreground">{formatCurrency(manualSelectedUserSummary?.totalBalance ?? manualSelectedUserSummary?.total_balance ?? manualSelectedUserDetail?.accounts.reduce((sum, account) => sum + parseAmount(account.balance), 0) ?? 0)}</p>
                    </div>
                  </div>
                </div>

                {/* Accounts list */}
                <div className="space-y-2">
                  {/* Mobile: render accounts as stacked cards to avoid horizontal table overflow */}
                  <div className="sm:hidden space-y-2">
                    {manualAccountsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={`acct-mobile-loading-${i}`} className="rounded-lg border border-border/20 bg-background/40 p-3">
                          <Skeleton className="h-4 w-3/4 mb-2" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      ))
                    ) : manualUserAccounts.length === 0 ? (
                      <div className="rounded-lg border border-border/20 bg-background/40 p-3 text-sm text-muted-foreground">No trading accounts found for this profile.</div>
                    ) : (
                      manualUserAccounts.map((account) => (
                        <div key={`mobile-account-${account.id}`} className="rounded-lg border border-border/20 bg-background/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{account.account_number}</div>
                              <div className="text-xs text-muted-foreground">Leverage {account.leverage ? `1:${account.leverage}` : "-"}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm text-muted-foreground">{account.account_type}</div>
                              <Button size="sm" variant={manualAdjustmentForm.accountId === String(account.id) ? "default" : "outline"} className="mt-2 w-full" onClick={() => setManualAdjustmentForm((prev) => ({ ...prev, accountId: String(account.id) }))}>
                                {manualAdjustmentForm.accountId === String(account.id) ? "Selected" : "Select"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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
                      // Desktop table: show on sm+
                      <div className="hidden sm:block overflow-x-auto">
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
                                    className={cn("cursor-pointer border-border/20 transition", { "bg-primary/5": isActiveAccount })}
                                    onClick={() => setManualAdjustmentForm((prev) => ({ ...prev, accountId: String(account.id) }))}
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
                                      <Badge variant="outline" className="capitalize">{account.status.replace(/_/g, " ")}</Badge>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected account summary */}
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

                {/* Adjustment form */}
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adjustment type</Label>
                      <Select value={manualAdjustmentForm.direction} onValueChange={(value: "credit" | "debit") => setManualAdjustmentForm((prev) => ({ ...prev, direction: value }))}>
                        <SelectTrigger className="w-full sm:w-auto capitalize">
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
                      <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={manualAdjustmentForm.amount} onChange={handleManualFieldChange("amount")} required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason</Label>
                    <Select value={manualAdjustmentForm.reasonCode} onValueChange={(value) => setManualAdjustmentForm((prev) => ({ ...prev, reasonCode: value }))}>
                      <SelectTrigger className="w-full sm:w-auto capitalize">
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
                    <Textarea rows={4} placeholder="Add an optional note for the audit trail" value={manualAdjustmentForm.notes} onChange={handleManualFieldChange("notes")} />
                  </div>

                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">Adjustment will be logged with an audit trail for {manualTab === "ib" ? "IB" : "user"} {getDisplayName(manualSelectedUserSummary || manualSelectedUserDetail?.user)}.</p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Button type="button" variant="ghost" onClick={resetManualSelection} disabled={manualSubmitting} className="w-full sm:w-auto">Cancel</Button>
                      <Button type="submit" disabled={manualSubmitting || manualAccountsLoading || !manualAdjustmentForm.accountId} className="w-full sm:w-auto">
                        {manualSubmitting ? (
                          <span className="flex items-center gap-2 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </span>
                        ) : manualAdjustmentForm.direction === "credit" ? (
                          <span className="flex items-center gap-2 justify-center"><ArrowDownCircle className="h-4 w-4" />Credit funds</span>
                        ) : (
                          <span className="flex items-center gap-2 justify-center"><ArrowUpCircle className="h-4 w-4" />Debit funds</span>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
          {detailRow && (
            <DialogContent className="max-w-2xl" style={{ width: '1382.4px', maxWidth: 'calc(100% - 2rem)' }}>
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

// formatChartDate removed (charting removed)

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