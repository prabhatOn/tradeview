"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { formatDistanceToNow } from "date-fns"
import { AdminLayout } from "@/components/admin/admin-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
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
  Shield,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
  Loader2,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  Lock,
  Unlock,
  Trash2
} from "lucide-react"
import { adminService } from "@/lib/services"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  AdminCreateUserPayload,
  AdminDashboardStats,
  AdminUserSummary,
  AdminUserDetail,
  AdminUserAccountSummary,
  AdminUserActivityItem,
} from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"

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

const ADMIN_ACCOUNT_STATUSES = ["active", "suspended", "inactive", "pending_verification"] as const
type AdminAccountStatus = (typeof ADMIN_ACCOUNT_STATUSES)[number]
type StatusFilter = "all" | AdminAccountStatus
type SortKey = "created_at" | "email" | "status" | "last_login_at" | "first_name" | "trading_accounts_count" | "total_balance"

interface AdminUserRow {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  status: AdminAccountStatus
  role: string | null
  isVerified: boolean
  createdAt: string | null
  lastLoginAt: string | null
  tradingAccountsCount: number
  totalBalance: number
  kycStatus: string | null
}

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: "All statuses", value: "all" },
  ...ADMIN_ACCOUNT_STATUSES.map((status) => ({
    value: status,
    label: status
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" "),
  })),
]

const sortOptions: { label: string; value: SortKey }[] = [
  { label: "Newest", value: "created_at" },
  { label: "Last login", value: "last_login_at" },
  { label: "Email", value: "email" },
  { label: "Status", value: "status" },
  { label: "First name", value: "first_name" },
  { label: "Account count", value: "trading_accounts_count" },
  { label: "Total balance", value: "total_balance" },
]

const PAGE_SIZE = 15
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
})

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return currencyFormatter.format(0)
  return currencyFormatter.format(value)
}

const formatStatus = (value: string) =>
  value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

const formatDate = (value: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

const formatLastLogin = (value: string | null) => {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Never"
  return formatDistanceToNow(date, { addSuffix: true })
}

const formatDateTime = (value: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

const buildFullName = (firstName: string | null, lastName: string | null, email: string) => {
  const parts = [firstName, lastName].filter((part): part is string => Boolean(part && part.trim()))
  if (parts.length === 0) {
    return email
  }
  return parts.join(" ")
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "?"

const normalizeAdminUser = (user: AdminUserSummary): AdminUserRow => {
  const firstName = user.firstName ?? user.first_name ?? null
  const lastName = user.lastName ?? user.last_name ?? null
  const createdAt = user.createdAt ?? user.created_at ?? null
  const lastLoginAt = user.lastLoginAt ?? user.last_login_at ?? null
  const tradingAccountsCount = Number(user.tradingAccountsCount ?? user.trading_accounts_count ?? 0) || 0
  const totalBalance = Number(user.totalBalance ?? user.total_balance ?? 0) || 0
  const rawStatus = (user.status ?? "active").toLowerCase()
  const normalizedStatus = ADMIN_ACCOUNT_STATUSES.includes(rawStatus as AdminAccountStatus)
    ? (rawStatus as AdminAccountStatus)
    : "active"

  const isVerifiedRaw = user.isVerified ?? user.is_verified
  const isVerified = typeof isVerifiedRaw === "number" ? isVerifiedRaw === 1 : Boolean(isVerifiedRaw)
  const kycStatus = (user.kycStatus ?? user.kyc_status ?? null) as string | null

  return {
    id: user.id,
    email: user.email,
    firstName,
    lastName,
    phone: user.phone ?? null,
    status: normalizedStatus,
    role: user.role ?? null,
    isVerified,
    createdAt,
    lastLoginAt,
    tradingAccountsCount,
    totalBalance,
    kycStatus,
  }
}

const mapDetailUserToRow = (
  user: AdminUserDetailUser,
  accounts: AdminUserAccountSummary[] | undefined,
  fallback?: AdminUserRow
): AdminUserRow => {
  const firstName = user.firstName ?? user.first_name ?? fallback?.firstName ?? null
  const lastName = user.lastName ?? user.last_name ?? fallback?.lastName ?? null
  const createdAt = user.createdAt ?? user.created_at ?? fallback?.createdAt ?? null
  const lastLoginAt = user.lastLogin ?? user.last_login ?? fallback?.lastLoginAt ?? null
  const statusRaw = (user.status ?? fallback?.status ?? 'active').toLowerCase()
  const normalizedStatus = ADMIN_ACCOUNT_STATUSES.includes(statusRaw as AdminAccountStatus)
    ? (statusRaw as AdminAccountStatus)
    : fallback?.status ?? 'active'
  const isVerifiedRaw =
    user.emailVerified ?? user.email_verified ?? fallback?.isVerified ?? false
  const isVerified = typeof isVerifiedRaw === 'number' ? isVerifiedRaw === 1 : Boolean(isVerifiedRaw)
  const tradingAccounts = accounts?.length ?? fallback?.tradingAccountsCount ?? 0
  const totalBalance = accounts
    ? accounts.reduce((sum, account) => sum + Number(account.balance ?? 0), 0)
    : fallback?.totalBalance ?? 0

  return {
    id: user.id,
    email: user.email,
    firstName,
    lastName,
    phone: user.phone ?? fallback?.phone ?? null,
    status: normalizedStatus,
    role: (user.primary_role ?? fallback?.role ?? null)?.toLowerCase?.() ?? fallback?.role ?? null,
    isVerified,
    createdAt,
    lastLoginAt,
    tradingAccountsCount: tradingAccounts,
    totalBalance,
    kycStatus: user.kycStatus ?? user.kyc_status ?? fallback?.kycStatus ?? null,
  }
}

export default function UsersPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortBy, setSortBy] = useState<SortKey>("created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null)
  const [verifyingUserId, setVerifyingUserId] = useState<number | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedUserPreview, setSelectedUserPreview] = useState<AdminUserRow | null>(null)
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null)
  const [isLoadingUserDetail, setIsLoadingUserDetail] = useState(false)
  const [userDetailError, setUserDetailError] = useState<string | null>(null)
  const [isDetailStatusUpdating, setIsDetailStatusUpdating] = useState(false)
  const [isDetailVerifying, setIsDetailVerifying] = useState(false)
  const [isUpdatingIb, setIsUpdatingIb] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeletingUser, setIsDeletingUser] = useState(false)

  const debouncedSearch = useDebounce(searchTerm, 400)
  const { toast } = useToast()
  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: ADD_USER_DEFAULT_VALUES,
  })

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true)
    setStatsError(null)
    try {
      const response = await adminService.getDashboardStats()
      if (response.success && response.data) {
        setStats(response.data)
      } else {
        throw new Error(response.error?.message ?? "Failed to load admin stats")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load admin stats"
      setStatsError(message)
      toast({
        variant: "destructive",
        title: "Dashboard data unavailable",
        description: message,
      })
    } finally {
      setIsLoadingStats(false)
    }
  }, [toast])

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    setError(null)
    try {
      const response = await adminService.getUsers({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        status: statusFilter === "all" ? undefined : statusFilter,
        sortBy,
        sortOrder,
      })

      if (response.success && response.data) {
        const normalized = response.data.users.map((user) => normalizeAdminUser(user))
        setUsers(normalized)
        setTotalUsers(response.data.pagination.total)
        setTotalPages(response.data.pagination.pages || 1)
      } else {
        throw new Error(response.error?.message ?? "Failed to load users")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users"
      setError(message)
      toast({
        variant: "destructive",
        title: "Unable to fetch users",
        description: message,
      })
    } finally {
      setIsLoadingUsers(false)
    }
  }, [page, debouncedSearch, statusFilter, sortBy, sortOrder, toast])

  const fetchUserDetail = useCallback(
    async (userId: number) => {
      setIsLoadingUserDetail(true)
      setUserDetailError(null)
      try {
        const response = await adminService.getUser(userId)
        if (response.success && response.data) {
          setSelectedUserDetail(response.data)
        } else {
          throw new Error(response.error?.message ?? "Failed to load user details")
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load user details"
        setUserDetailError(message)
        toast({
          variant: "destructive",
          title: "Unable to load user details",
          description: message,
        })
      } finally {
        setIsLoadingUserDetail(false)
      }
    },
    [toast]
  )

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter, sortBy, sortOrder])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    if (isUserDetailOpen && selectedUserId) {
      fetchUserDetail(selectedUserId)
    }
  }, [isUserDetailOpen, selectedUserId, fetchUserDetail])

  const handleStatusToggle = useCallback(
    async (user: AdminUserRow) => {
      const nextStatus: AdminAccountStatus = user.status === "active" ? "suspended" : "active"
      try {
        setUpdatingUserId(user.id)
        const response = await adminService.updateUserStatus(user.id, nextStatus)
        if (!response.success) {
          throw new Error(response.error?.message ?? "Failed to update status")
        }
        toast({
          title: "Status updated",
          description: `${buildFullName(user.firstName, user.lastName, user.email)} is now ${formatStatus(nextStatus)}.`,
        })
        await Promise.all([fetchUsers(), fetchStats()])
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update user status"
        toast({
          variant: "destructive",
          title: "Status update failed",
          description: message,
        })
      } finally {
        setUpdatingUserId(null)
      }
    },
    [fetchStats, fetchUsers, toast]
  )

  const handleVerificationToggle = useCallback(
    async (user: AdminUserRow) => {
      const nextVerified = !user.isVerified
      try {
        setVerifyingUserId(user.id)
        const response = await adminService.updateUserVerification(user.id, {
          verified: nextVerified,
        })
        if (!response.success) {
          throw new Error(response.error?.message ?? "Failed to update verification status")
        }
        toast({
          title: nextVerified ? "User verified" : "Verification removed",
          description: `${buildFullName(user.firstName, user.lastName, user.email)} is now ${
            nextVerified ? "verified" : "unverified"
          }.`,
        })
        await Promise.all([fetchUsers(), fetchStats()])
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update verification status"
        toast({
          variant: "destructive",
          title: "Verification update failed",
          description: message,
        })
      } finally {
        setVerifyingUserId(null)
      }
    },
    [fetchUsers, fetchStats, toast]
  )

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsCreateDialogOpen(open)
      if (!open) {
        form.reset(ADD_USER_DEFAULT_VALUES)
      }
    },
    [form]
  )

  const handleOpenAddUserDialog = useCallback(() => {
    form.reset(ADD_USER_DEFAULT_VALUES)
    setIsCreateDialogOpen(true)
  }, [form])

  const handleCreateUser = useCallback(
    async (values: AddUserFormValues) => {
      try {
        setIsCreatingUser(true)
        const payload: AdminCreateUserPayload = {
          email: values.email,
          password: values.password,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone ?? null,
          role: values.role,
          status: values.status,
          emailVerified: values.emailVerified,
          kycStatus: values.kycStatus,
        }

        const response = await adminService.createUser(payload)
        if (!response.success || !response.data?.user) {
          throw new Error(response.error?.message ?? "Failed to create user")
        }

        const createdUser = response.data.user
        const successName = buildFullName(
          createdUser.firstName ?? createdUser.first_name ?? null,
          createdUser.lastName ?? createdUser.last_name ?? null,
          createdUser.email
        )

        toast({
          title: "User created",
          description: `${successName} has been added to the platform.`,
        })

        form.reset(ADD_USER_DEFAULT_VALUES)
        setIsCreateDialogOpen(false)

        await Promise.all([fetchUsers(), fetchStats()])
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create user"
        toast({
          variant: "destructive",
          title: "User creation failed",
          description: message,
        })
      } finally {
        setIsCreatingUser(false)
      }
    },
    [fetchUsers, fetchStats, form, toast]
  )

  const handleUserRowClick = useCallback((user: AdminUserRow) => {
    setSelectedUserPreview(user)
    setSelectedUserId(user.id)
    setSelectedUserDetail(null)
    setUserDetailError(null)
    setIsUserDetailOpen(true)
  }, [])

  const handleUserDetailDialogChange = useCallback((open: boolean) => {
    setIsUserDetailOpen(open)
    if (!open) {
      setSelectedUserId(null)
      setSelectedUserPreview(null)
      setSelectedUserDetail(null)
      setUserDetailError(null)
      setIsLoadingUserDetail(false)
      setIsDetailStatusUpdating(false)
      setIsDetailVerifying(false)
      setIsDeleteDialogOpen(false)
      setIsDeletingUser(false)
    }
  }, [])

  const handleSortChange = (value: SortKey) => {
    if (sortBy === value) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(value)
      setSortOrder("desc")
    }
  }

  const detailSnapshot = useMemo<UserDetailSnapshot | null>(() => {
    if (!selectedUserPreview && !selectedUserDetail) {
      return null
    }

    const detail = selectedUserDetail?.user
    const preview = selectedUserPreview

    const email = detail?.email ?? preview?.email ?? ""
    const firstName = detail?.first_name ?? detail?.firstName ?? preview?.firstName ?? null
    const lastName = detail?.last_name ?? detail?.lastName ?? preview?.lastName ?? null
    const role = detail?.role ?? preview?.role ?? null

    const rawStatus = (detail?.status ?? preview?.status ?? "active").toLowerCase()
    const normalizedStatus = ADMIN_ACCOUNT_STATUSES.includes(rawStatus as AdminAccountStatus)
      ? (rawStatus as AdminAccountStatus)
      : "active"

    const isVerifiedRaw = detail?.email_verified ?? detail?.emailVerified ?? preview?.isVerified ?? false
    const isVerified = typeof isVerifiedRaw === "number" ? isVerifiedRaw === 1 : Boolean(isVerifiedRaw)

    const kycStatus = (detail?.kyc_status ?? detail?.kycStatus ?? preview?.kycStatus ?? null) as string | null
    const createdAt = detail?.created_at ?? detail?.createdAt ?? preview?.createdAt ?? null
    const lastLoginAt = detail?.last_login ?? detail?.lastLogin ?? preview?.lastLoginAt ?? null
    const phone = detail?.phone ?? preview?.phone ?? null

    const address = {
      line1: detail?.address_line_1 ?? null,
      line2: detail?.address_line_2 ?? null,
      city: detail?.city ?? null,
      state: detail?.state ?? null,
      postalCode: detail?.postal_code ?? null,
      country: detail?.country ?? null,
    }

    const accounts = selectedUserDetail?.accounts ?? []
    const activity = selectedUserDetail?.activity ?? []

    const totalBalance = preview?.totalBalance ?? accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)
    const tradingAccountsCount = preview?.tradingAccountsCount ?? accounts.length

    const fullName = buildFullName(firstName, lastName, email)

    return {
      id: detail?.id ?? preview?.id ?? null,
      email,
      firstName,
      lastName,
      fullName,
      status: normalizedStatus,
      role,
      isVerified,
      kycStatus,
      createdAt,
      lastLoginAt,
      phone,
      address,
      accounts,
      activity,
      tradingAccountsCount,
      totalBalance,
    }
  }, [selectedUserDetail, selectedUserPreview])

  const handleDetailStatusChange = useCallback(async () => {
    if (!detailSnapshot?.id) {
      return
    }

    const currentStatus = detailSnapshot.status
    const nextStatus: AdminAccountStatus = currentStatus === "active" ? "suspended" : "active"
    const displayName = detailSnapshot.fullName

    try {
      setIsDetailStatusUpdating(true)
      const response = await adminService.updateUserStatus(detailSnapshot.id, nextStatus)
      if (!response.success) {
        throw new Error(response.error?.message ?? "Failed to update user status")
      }

      toast({
        title: nextStatus === "active" ? "User unlocked" : "User locked",
        description: `${displayName} is now ${formatStatus(nextStatus)}.`,
      })

      setSelectedUserDetail((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                status: nextStatus,
              },
            }
          : prev
      )
      setSelectedUserPreview((prev) =>
        prev && prev.id === detailSnapshot.id
          ? {
              ...prev,
              status: nextStatus,
            }
          : prev
      )

      await Promise.all([fetchUsers(), fetchStats()])
      await fetchUserDetail(detailSnapshot.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update user status"
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: message,
      })
    } finally {
      setIsDetailStatusUpdating(false)
    }
  }, [detailSnapshot, fetchStats, fetchUserDetail, fetchUsers, toast])

  const handleDetailVerificationToggle = useCallback(async () => {
    if (!detailSnapshot?.id) {
      return
    }

    const nextVerified = !detailSnapshot.isVerified
    const displayName = detailSnapshot.fullName

    try {
      setIsDetailVerifying(true)
      const response = await adminService.updateUserVerification(detailSnapshot.id, {
        verified: nextVerified,
      })
      if (!response.success) {
        throw new Error(response.error?.message ?? "Failed to update verification status")
      }

      toast({
        title: nextVerified ? "User verified" : "Verification removed",
        description: `${displayName} is now ${nextVerified ? "verified" : "unverified"}.`,
      })

      setSelectedUserDetail((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                email_verified: nextVerified ? 1 : 0,
                emailVerified: nextVerified,
              },
            }
          : prev
      )
      setSelectedUserPreview((prev) =>
        prev && prev.id === detailSnapshot.id
          ? {
              ...prev,
              isVerified: nextVerified,
            }
          : prev
      )

      await Promise.all([fetchUsers(), fetchStats()])
      await fetchUserDetail(detailSnapshot.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update verification status"
      toast({
        variant: "destructive",
        title: "Verification update failed",
        description: message,
      })
    } finally {
      setIsDetailVerifying(false)
    }
  }, [detailSnapshot, fetchStats, fetchUserDetail, fetchUsers, toast])

  const handleDeleteUser = useCallback(async () => {
    if (!detailSnapshot?.id) {
      return
    }

    try {
      setIsDeletingUser(true)
      const response = await adminService.deleteUser(detailSnapshot.id)
      if (!response.success) {
        throw new Error(response.error?.message ?? "Failed to delete user")
      }

      toast({
        title: "User deleted",
        description: `${detailSnapshot.fullName} has been removed.`,
      })

      setIsDeleteDialogOpen(false)
      handleUserDetailDialogChange(false)

      await Promise.all([fetchUsers(), fetchStats()])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user"
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: message,
      })
    } finally {
      setIsDeletingUser(false)
    }
  }, [detailSnapshot, fetchStats, fetchUsers, handleUserDetailDialogChange, toast])

  const statsCards = useMemo(
    () => [
      {
        title: "Total Users",
        value: stats?.users?.total_users ?? 0,
        helper: stats?.users ? `+${stats.users.new_users_30d ?? 0} in the last 30 days` : "",
        accent: "text-foreground",
      },
      {
        title: "Active Users",
        value: stats?.users?.active_users ?? 0,
        helper: stats?.users ? `${stats.users.total_users ? Math.round(((stats.users.active_users ?? 0) / (stats.users.total_users || 1)) * 100) : 0}% of total users` : "",
        accent: "text-green-600",
      },
      {
        title: "Verified Traders",
        value: stats?.users?.verified_users ?? 0,
        helper: stats?.users ? `${stats.users.verified_users ?? 0} accounts verified` : "",
        accent: "text-blue-600",
      },
      {
        title: "New Accounts (30d)",
        value: stats?.users?.new_users_30d ?? 0,
        helper: stats?.trading ? `${stats.trading.new_accounts_30d ?? 0} new trading accounts` : "",
        accent: "text-purple-600",
      },
    ],
    [stats]
  )

  const from = totalUsers === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = totalUsers === 0 ? 0 : Math.min(page * PAGE_SIZE, totalUsers)

  const showEmptyState = !isLoadingUsers && users.length === 0 && !error

  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">User Management</h1>
              <p className="text-muted-foreground mt-2">Manage user accounts, permissions, and lifecycle actions.</p>
            </div>
            <Button
              onClick={handleOpenAddUserDialog}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg backdrop-blur-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add New User
            </Button>
          </div>

          {statsError && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/40">
              <AlertTitle>Dashboard metrics unavailable</AlertTitle>
              <AlertDescription>{statsError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {statsCards.map((card) => (
              <Card key={card.title} className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingStats ? (
                    <div className="space-y-2">
                      <div className="h-6 w-24 animate-pulse rounded bg-muted/60" />
                      <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
                    </div>
                  ) : (
                    <>
                      <div className={`text-2xl font-bold ${card.accent}`}>{card.value.toLocaleString()}</div>
                      {card.helper && <p className="text-xs text-muted-foreground">{card.helper}</p>}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="text-xl text-foreground">User Accounts</CardTitle>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by name or email"
                      className="w-full bg-background/60 pl-10 backdrop-blur-sm"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(value) => handleSortChange(value as SortKey)}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Sort results" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                    className="h-9 w-9"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/40">
                  <AlertTitle>Something went wrong</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-lg border border-border/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Accounts</TableHead>
                      <TableHead>Total Balance</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingUsers && users.length === 0 &&
                      Array.from({ length: 5 }).map((_, index) => (
                        <TableRow key={`skeleton-${index}`}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="h-10 w-10 animate-pulse rounded-full bg-muted/40" />
                              <div className="space-y-2">
                                <div className="h-4 w-24 animate-pulse rounded bg-muted/40" />
                                <div className="h-3 w-32 animate-pulse rounded bg-muted/30" />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="h-5 w-16 animate-pulse rounded bg-muted/40" />
                          </TableCell>
                          <TableCell>
                            <div className="h-5 w-20 animate-pulse rounded bg-muted/40" />
                          </TableCell>
                          <TableCell>
                            <div className="h-5 w-12 animate-pulse rounded bg-muted/40" />
                          </TableCell>
                          <TableCell>
                            <div className="h-5 w-24 animate-pulse rounded bg-muted/40" />
                          </TableCell>
                          <TableCell>
                            <div className="h-5 w-24 animate-pulse rounded bg-muted/40" />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="h-8 w-24 animate-pulse rounded bg-muted/40" />
                          </TableCell>
                        </TableRow>
                      ))}

                    {!isLoadingUsers && showEmptyState && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          No users match your filters yet.
                        </TableCell>
                      </TableRow>
                    )}

                    {users.map((user) => {
                      const fullName = buildFullName(user.firstName, user.lastName, user.email)
                      const initials = getInitials(fullName)
                      const statusVariant: "default" | "destructive" | "outline" =
                        user.status === "active"
                          ? "default"
                          : user.status === "suspended"
                            ? "destructive"
                            : "outline"

                      return (
                        <TableRow
                          key={user.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleUserRowClick(user)}
                        >
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/20 bg-foreground/10 text-sm font-semibold text-foreground">
                                {initials}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2 font-medium">
                                  <span>{fullName}</span>
                                  {user.isVerified && <Shield className="h-4 w-4 text-green-500" />}
                                </div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                                <div className="text-xs text-muted-foreground">Joined {formatDate(user.createdAt)}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant} className="capitalize">
                              {formatStatus(user.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.role ? (
                              <Badge variant="outline" className="capitalize">
                                {formatStatus(user.role)}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{user.tradingAccountsCount}</TableCell>
                          <TableCell className="font-mono font-semibold text-green-600">
                            {formatCurrency(user.totalBalance)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatLastLogin(user.lastLoginAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleVerificationToggle(user)
                                }}
                                disabled={verifyingUserId === user.id}
                                title={user.isVerified ? "Revoke verification" : "Verify user"}
                              >
                                {verifyingUserId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : user.isVerified ? (
                                  <ShieldOff className="h-4 w-4" />
                                ) : (
                                  <ShieldCheck className="h-4 w-4" />
                                )}
                                <span className="sr-only">
                                  {user.isVerified ? "Revoke verification" : "Verify user"}
                                </span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleStatusToggle(user)
                                }}
                                disabled={updatingUserId === user.id}
                              >
                                {updatingUserId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : user.status === "active" ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-4 border-t border-border/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {from.toLocaleString()} – {to.toLocaleString()} of {totalUsers.toLocaleString()} users
                </p>
                <div className="flex items-center justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1 || isLoadingUsers}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((prev) => (prev < totalPages ? prev + 1 : prev))}
                    disabled={page >= totalPages || isLoadingUsers}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add a new user</DialogTitle>
              <DialogDescription>
                Create a new client or teammate. You can adjust their profile and notify them after the account is ready.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateUser)} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" placeholder="jane.doe@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Temporary password</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" placeholder="Min. 8 characters" {...field} />
                        </FormControl>
                        <FormDescription>
                          Ask the user to change their password after first sign-in.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Phone (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+1 555 123 4567"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roleOptionsForCreation.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {onboardingStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="kycStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>KYC status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select KYC status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {kycStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emailVerified"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/40 p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Email verified</FormLabel>
                          <FormDescription>
                            {field.value ? "User can sign in immediately." : "Requires email confirmation to trade."}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDialogOpenChange(false)}
                    disabled={isCreatingUser}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreatingUser} className="bg-green-600 text-white hover:bg-green-700">
                    {isCreatingUser ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Create user
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isUserDetailOpen} onOpenChange={handleUserDetailDialogChange}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>User details</DialogTitle>
              <DialogDescription>
                {detailSnapshot ? `Review and manage ${detailSnapshot.fullName}.` : "Select a user to view their profile."}
              </DialogDescription>
            </DialogHeader>

            {detailSnapshot ? (
              <div className="space-y-6">
                {isLoadingUserDetail && (
                  <div className="flex items-center space-x-2 rounded-md border border-dashed border-border/40 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Refreshing latest profile data…</span>
                  </div>
                )}

                {userDetailError && (
                  <Alert variant="destructive">
                    <AlertTitle>Some information may be missing</AlertTitle>
                    <AlertDescription>{userDetailError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{detailSnapshot.fullName}</h3>
                    <p className="text-sm text-muted-foreground">{detailSnapshot.email}</p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(detailSnapshot.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        detailSnapshot.status === "active"
                          ? "default"
                          : detailSnapshot.status === "suspended"
                            ? "destructive"
                            : "outline"
                      }
                      className="capitalize"
                    >
                      {formatStatus(detailSnapshot.status)}
                    </Badge>
                    {detailSnapshot.role && (
                      <Badge variant="outline" className="capitalize">
                        {formatStatus(detailSnapshot.role)}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={detailSnapshot.isVerified ? "border-green-500/60 text-green-600" : "border-yellow-500/60 text-yellow-600"}
                    >
                      {detailSnapshot.isVerified ? "Verified" : "Unverified"}
                    </Badge>
                    {detailSnapshot.kycStatus && (
                      <Badge variant="outline" className="capitalize">
                        KYC: {formatStatus(detailSnapshot.kycStatus)}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={detailSnapshot.status === "suspended" ? "secondary" : "outline"}
                    onClick={handleDetailStatusChange}
                    disabled={isDetailStatusUpdating}
                  >
                    {isDetailStatusUpdating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : detailSnapshot.status === "suspended" ? (
                      <Unlock className="mr-2 h-4 w-4" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    {detailSnapshot.status === "suspended" ? "Unlock user" : "Lock user"}
                  </Button>
                  <Button variant="outline" onClick={handleDetailVerificationToggle} disabled={isDetailVerifying}>
                    {isDetailVerifying ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : detailSnapshot.isVerified ? (
                      <ShieldOff className="mr-2 h-4 w-4" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {detailSnapshot.isVerified ? "Mark as unverified" : "Verify user"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isDeletingUser}
                  >
                    {isDeletingUser ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete user
                  </Button>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contact</h4>
                    <div className="rounded-md border border-border/40 p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium">{detailSnapshot.email}</span>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium">{detailSnapshot.phone || "—"}</span>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <span className="text-muted-foreground">Last login</span>
                        <span className="font-medium">{formatLastLogin(detailSnapshot.lastLoginAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Address</h4>
                    <div className="rounded-md border border-border/40 p-3 text-sm">
                      <p className="font-medium">
                        {detailSnapshot.address.line1 || "No address on file"}
                      </p>
                      {detailSnapshot.address.line2 && <p className="font-medium">{detailSnapshot.address.line2}</p>}
                      {(detailSnapshot.address.city || detailSnapshot.address.state || detailSnapshot.address.postalCode) && (
                        <p className="font-medium text-muted-foreground">
                          {[detailSnapshot.address.city, detailSnapshot.address.state, detailSnapshot.address.postalCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                      {detailSnapshot.address.country && (
                        <p className="font-medium text-muted-foreground">{detailSnapshot.address.country}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Trading accounts</h4>
                    <span className="text-sm text-muted-foreground">
                      {detailSnapshot.tradingAccountsCount} total • {formatCurrency(detailSnapshot.totalBalance)}
                    </span>
                  </div>
                  {isLoadingUserDetail && detailSnapshot.accounts.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                      Loading accounts…
                    </div>
                  ) : detailSnapshot.accounts.length ? (
                    <div className="space-y-2">
                      {detailSnapshot.accounts.map((account) => (
                        <div key={account.id} className="rounded-md border border-border/40 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold">{account.account_number}</div>
                            <Badge variant="outline" className="capitalize">
                              {formatStatus(account.status)}
                            </Badge>
                          </div>
                          <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                            <span>Type: {formatStatus(account.account_type)}</span>
                            <span>Balance: {formatCurrency(Number(account.balance) || 0)}</span>
                            <span>Equity: {formatCurrency(Number(account.equity) || 0)}</span>
                            <span>Free margin: {formatCurrency(Number(account.free_margin) || 0)}</span>
                            <span>Leverage: {Number(account.leverage) || 0}x</span>
                            <span>Opened: {formatDate(account.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                      No trading accounts yet.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</h4>
                  {isLoadingUserDetail && detailSnapshot.activity.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                      Gathering recent activity…
                    </div>
                  ) : detailSnapshot.activity.length ? (
                    <div className="space-y-2 text-sm">
                      {detailSnapshot.activity.map((item, index) => (
                        <div
                          key={`${item.type}-${item.created_at}-${index}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 p-3"
                        >
                          <div>
                            <p className="font-medium capitalize">{item.action}</p>
                            <p className="text-xs text-muted-foreground">{item.symbol ?? "—"}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
                      No recent activity recorded.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Select a user from the table to view their profile.
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
              <AlertDialogDescription>
                This action permanently removes the user and all associated trading records. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingUser}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingUser ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Confirm delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}

const ROLE_VALUES = ["user", "admin", "manager", "support"] as const
const roleOptionsForCreation = ROLE_VALUES.map((value) => ({
  value,
  label:
    value === "user"
      ? "Standard User"
      : value === "admin"
        ? "Administrator"
        : value === "manager"
          ? "Manager"
          : "Support",
}))

const KYC_STATUS_VALUES = ["pending", "submitted", "approved", "rejected"] as const
const kycStatusOptions = KYC_STATUS_VALUES.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}))

const onboardingStatusOptions = ADMIN_ACCOUNT_STATUSES.map((value) => ({
  value,
  label:
    value
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" "),
}))

const addUserFormSchema = z.object({
  email: z.string().email("Provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z
    .string()
    .max(30, "Phone number is too long")
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value : undefined)),
  role: z.enum(ROLE_VALUES),
  status: z.enum(ADMIN_ACCOUNT_STATUSES),
  emailVerified: z.boolean().default(false),
  kycStatus: z.enum(KYC_STATUS_VALUES),
})

type AddUserFormValues = z.infer<typeof addUserFormSchema>

const ADD_USER_DEFAULT_VALUES: AddUserFormValues = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: undefined,
  role: "user",
  status: "active",
  emailVerified: false,
  kycStatus: "pending",
}