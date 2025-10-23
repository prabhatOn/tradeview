"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Eye,
  Filter,
  HeadphonesIcon,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Receipt,
  Search,
  TrendingUp,
  User as UserIcon,
  Users,
  Wallet,
  XCircle,
} from "lucide-react"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminLayout } from "@/components/admin/admin-layout"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"
import { adminService, marketService } from "@/lib/services"
import { cn } from "@/lib/utils"
import type {
  AdminTradingAccount,
  AdminTradingOverview,
  AdminTradingPosition,
  AdminTradingPositionsResponse,
  PaginationInfo,
  Symbol,
} from "@/lib/types"

const POSITIONS_PAGE_SIZE = 20

const CLOSE_REASON_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "stop_loss", label: "Stopped out (SL)" },
  { value: "take_profit", label: "Target hit (TP)" },
  { value: "system", label: "System" },
  { value: "margin_call", label: "Margin call" },
] as const

type PositionsSummary = AdminTradingPositionsResponse["summary"]
type PositionsTab = "open" | "closed"
type CloseReason = typeof CLOSE_REASON_OPTIONS[number]["value"]

const DEFAULT_PAGINATION: PaginationInfo = {
  page: 1,
  limit: POSITIONS_PAGE_SIZE,
  total: 0,
  pages: 1,
}

const DEFAULT_SUMMARY: PositionsSummary = {
  totalVolume: 0,
  totalProfit: 0,
  totalCommission: 0,
  netProfit: 0,
}

interface NewTradeFormState {
  selectedAccountId: string
  selectedAccountLabel: string
  selectedSymbolId: string
  selectedSymbolLabel: string
  side: "buy" | "sell"
  lotSize: string
  stopLoss: string
  takeProfit: string
  comment: string
}

const NEW_TRADE_DEFAULT: NewTradeFormState = {
  selectedAccountId: "",
  selectedAccountLabel: "",
  selectedSymbolId: "",
  selectedSymbolLabel: "",
  side: "buy",
  lotSize: "",
  stopLoss: "",
  takeProfit: "",
  comment: "",
}

function classForPnL(value: number) {
  if (value > 0) return "text-emerald-600"
  if (value < 0) return "text-red-500"
  return "text-muted-foreground"
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "$0.00"
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatNumber(value: number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "–"
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "–"
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "–"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "–"
  return format(date, "dd MMM yyyy • HH:mm")
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return formatDistanceToNow(date, { addSuffix: true })
}

function renderSideBadge(side: "buy" | "sell") {
  if (side === "buy") {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Buy</Badge>
  }

  return <Badge className="bg-red-100 text-red-600 border-red-200">Sell</Badge>
}

function renderStatusBadge(status: AdminTradingPosition["status"]) {
  switch (status) {
    case "open":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Open</Badge>
    case "closed":
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Closed</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function renderPnL(value: number) {
  const positive = value >= 0

  return (
    <span
      className={cn(
        "flex items-center justify-end gap-1 font-medium",
        positive ? "text-emerald-600" : "text-red-500",
      )}
    >
      {positive ? (
        <ArrowUpRight className="h-3.5 w-3.5" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" />
      )}
      {formatCurrency(value)}
    </span>
  )
}

function getPaginationNumbers(pagination: PaginationInfo): Array<number | string> {
  const pages = Math.max(1, pagination.pages || 1)
  const current = Math.min(Math.max(1, pagination.page || 1), pages)

  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => index + 1)
  }

  const numbers: Array<number | string> = [1]

  if (current > 4) {
    numbers.push("…")
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(pages - 1, current + 1)

  for (let value = start; value <= end; value += 1) {
    numbers.push(value)
  }

  if (current < pages - 2) {
    numbers.push("…")
  }

  numbers.push(pages)
  return numbers
}

export default function AdminTradesPage() {
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<PositionsTab>("open")
  const [overview, setOverview] = useState<AdminTradingOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true)

  const [positions, setPositions] = useState<AdminTradingPosition[]>([])
  const [positionsSummary, setPositionsSummary] = useState<PositionsSummary>(DEFAULT_SUMMARY)
  const [positionsPagination, setPositionsPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION)
  const [positionsLoading, setPositionsLoading] = useState<boolean>(true)
  const [positionsError, setPositionsError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState<string>("")
  const debouncedSearch = useDebounce(searchTerm, 400)
  const [symbolFilter, setSymbolFilter] = useState<string>("all")
  const [sideFilter, setSideFilter] = useState<"all" | "buy" | "sell">("all")

  const [openPage, setOpenPage] = useState<number>(1)
  const [closedPage, setClosedPage] = useState<number>(1)
  const currentPage = activeTab === "open" ? openPage : closedPage

  const [refreshCounter, setRefreshCounter] = useState<number>(0)

  const [selectedPosition, setSelectedPosition] = useState<AdminTradingPosition | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState<boolean>(false)
  const [viewLoading, setViewLoading] = useState<boolean>(false)

  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false)
  const [editForm, setEditForm] = useState({ lotSize: "", stopLoss: "", takeProfit: "", comment: "" })
  const [editSubmitting, setEditSubmitting] = useState<boolean>(false)

  const [closeDialogOpen, setCloseDialogOpen] = useState<boolean>(false)
  const [closeForm, setCloseForm] = useState<{ closePrice: string; closeReason: CloseReason }>({
    closePrice: "",
    closeReason: CLOSE_REASON_OPTIONS[0].value,
  })
  const [closeSubmitting, setCloseSubmitting] = useState<boolean>(false)
  const [closingPositionIds, setClosingPositionIds] = useState<number[]>([])

  const [newTradeDialogOpen, setNewTradeDialogOpen] = useState<boolean>(false)
  const [newTradeForm, setNewTradeForm] = useState<NewTradeFormState>(NEW_TRADE_DEFAULT)
  const [newTradeSubmitting, setNewTradeSubmitting] = useState<boolean>(false)

  const [accountSearchTerm, setAccountSearchTerm] = useState<string>("")
  const [symbolSearchTerm, setSymbolSearchTerm] = useState<string>("")
  const debouncedAccountSearch = useDebounce(accountSearchTerm, 400)
  const debouncedSymbolSearch = useDebounce(symbolSearchTerm, 400)

  const [accountResults, setAccountResults] = useState<AdminTradingAccount[]>([])
  const [accountLoading, setAccountLoading] = useState<boolean>(false)
  const [symbolResults, setSymbolResults] = useState<Symbol[]>([])
  const [symbolLoading, setSymbolLoading] = useState<boolean>(false)

  const showError = useCallback(
    (title: string, description?: string) => {
      toast({
        variant: "destructive",
        title,
        description,
      })
    },
    [toast],
  )

  const showSuccess = useCallback(
    (title: string, description?: string) => {
      toast({
        title,
        description,
      })
    },
    [toast],
  )

  useEffect(() => {
    let isCancelled = false

    async function loadOverview() {
      try {
        setOverviewLoading(true)
        const response = await adminService.getTradingOverview()
        if (!isCancelled) {
          if (response.success && response.data) {
            setOverview(response.data)
          } else {
            throw new Error(response.message || "Failed to load trading overview")
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error(error)
          showError("Failed to load trading overview", error instanceof Error ? error.message : undefined)
        }
      } finally {
        if (!isCancelled) {
          setOverviewLoading(false)
        }
      }
    }

    loadOverview()

    return () => {
      isCancelled = true
    }
  }, [refreshCounter, showError])

  useEffect(() => {
    let isCancelled = false

    async function loadPositions() {
      try {
        setPositionsLoading(true)
        setPositionsError(null)

        const statusParam: "open" | "closed" = activeTab === "open" ? "open" : "closed"
        const page = Math.max(1, currentPage)
        const params: Parameters<typeof adminService.getTradingPositions>[0] = {
          status: statusParam,
          page,
          limit: POSITIONS_PAGE_SIZE,
        }

        const trimmedSearch = debouncedSearch.trim()
        if (trimmedSearch) {
          params.search = trimmedSearch
        }
        if (symbolFilter !== "all") {
          params.symbol = symbolFilter
        }
        if (sideFilter !== "all") {
          params.side = sideFilter
        }

        const response = await adminService.getTradingPositions(params)
        if (isCancelled) {
          return
        }

        if (response.success && response.data) {
          setPositions(response.data.rows ?? [])
          const pagination = response.data.pagination
          setPositionsPagination(
            pagination
              ? { ...pagination }
              : { ...DEFAULT_PAGINATION, page, limit: POSITIONS_PAGE_SIZE },
          )
          const summary = response.data.summary
          setPositionsSummary(summary ? { ...DEFAULT_SUMMARY, ...summary } : DEFAULT_SUMMARY)
        } else {
          throw new Error(response.message || "Failed to load positions")
        }
      } catch (error) {
        if (!isCancelled) {
          console.error(error)
          setPositions([])
          setPositionsSummary(DEFAULT_SUMMARY)
          setPositionsPagination({ ...DEFAULT_PAGINATION, page: 1 })
          const message = error instanceof Error ? error.message : "Unable to load positions"
          setPositionsError(message)
          showError("Failed to load positions", message)
        }
      } finally {
        if (!isCancelled) {
          setPositionsLoading(false)
        }
      }
    }

    loadPositions()

    return () => {
      isCancelled = true
    }
  }, [activeTab, currentPage, debouncedSearch, symbolFilter, sideFilter, refreshCounter, showError])

  useEffect(() => {
    if (!newTradeDialogOpen) {
      return
    }

    let isCancelled = false

    async function loadAccounts() {
      try {
        setAccountLoading(true)
        const response = await adminService.getTradingAccounts({
          search: debouncedAccountSearch.trim() || undefined,
          page: 1,
          limit: 8,
        })

        if (!isCancelled) {
          if (response.success && response.data) {
            setAccountResults(response.data.rows ?? [])
          } else {
            throw new Error(response.message || "Failed to load accounts")
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error(error)
          showError("Failed to load trading accounts", error instanceof Error ? error.message : undefined)
        }
      } finally {
        if (!isCancelled) {
          setAccountLoading(false)
        }
      }
    }

    loadAccounts()

    return () => {
      isCancelled = true
    }
  }, [debouncedAccountSearch, newTradeDialogOpen, showError])

  useEffect(() => {
    if (!newTradeDialogOpen) {
      return
    }

    const query = debouncedSymbolSearch.trim()
    if (!query) {
      setSymbolResults([])
      return
    }

    let isCancelled = false

    async function loadSymbols() {
      try {
        setSymbolLoading(true)
        const response = await marketService.searchSymbols(query)
        if (!isCancelled) {
          if (response.success && response.data) {
            setSymbolResults(response.data)
          } else {
            throw new Error(response.message || "Failed to load symbols")
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error(error)
          showError("Failed to search symbols", error instanceof Error ? error.message : undefined)
        }
      } finally {
        if (!isCancelled) {
          setSymbolLoading(false)
        }
      }
    }

    loadSymbols()

    return () => {
      isCancelled = true
    }
  }, [debouncedSymbolSearch, newTradeDialogOpen, showError])

  useEffect(() => {
    if (!newTradeDialogOpen) {
      setNewTradeForm(NEW_TRADE_DEFAULT)
      setAccountSearchTerm("")
      setSymbolSearchTerm("")
      setAccountResults([])
      setSymbolResults([])
      setNewTradeSubmitting(false)
    }
  }, [newTradeDialogOpen])

  useEffect(() => {
    if (!editDialogOpen) {
      setEditForm({ lotSize: "", stopLoss: "", takeProfit: "", comment: "" })
      setEditSubmitting(false)
    }
  }, [editDialogOpen])

  useEffect(() => {
    if (!closeDialogOpen) {
      setCloseForm({ closePrice: "", closeReason: CLOSE_REASON_OPTIONS[0].value })
      setCloseSubmitting(false)
    }
  }, [closeDialogOpen])

  useEffect(() => {
    if (!viewDialogOpen && !editDialogOpen && !closeDialogOpen) {
      setSelectedPosition(null)
    }
  }, [viewDialogOpen, editDialogOpen, closeDialogOpen])

  useEffect(() => {
    const handlePositionsUpdate = () => {
      setRefreshCounter((value) => value + 1)
    }

    window.addEventListener("positionsUpdate", handlePositionsUpdate)

    return () => {
      window.removeEventListener("positionsUpdate", handlePositionsUpdate)
    }
  }, [])

  const symbolOptions = useMemo(() => {
    const values = new Set<string>()
    positions.forEach((position) => {
      if (position.symbol) {
        values.add(position.symbol)
      }
    })
    if (symbolFilter !== "all") {
      values.add(symbolFilter)
    }
    return Array.from(values).sort()
  }, [positions, symbolFilter])

  const paginationNumbers = useMemo(
    () =>
      getPaginationNumbers({
        ...positionsPagination,
        page: positionsPagination.page || currentPage,
        pages: positionsPagination.pages || 1,
      }),
    [positionsPagination, currentPage],
  )

  const totalPages = Math.max(1, positionsPagination.pages || 1)
  const rowsPerPage = positionsPagination.limit || POSITIONS_PAGE_SIZE
  const totalRows = positionsPagination.total || 0
  const rangeStart = totalRows === 0 ? 0 : (Math.max(1, positionsPagination.page || currentPage) - 1) * rowsPerPage + 1
  const rangeEnd = totalRows === 0 ? 0 : Math.min(rangeStart + positions.length - 1, totalRows)

  const totalOpenPnL = overview?.openPnL ?? 0
  const totalClosedPnL = overview?.closedPnL ?? 0
  const totalVolume = overview?.totalVolume ?? positionsSummary.totalVolume
  const totalCommission = overview?.totalCommission ?? positionsSummary.totalCommission

  const canSubmitNewTrade =
    Boolean(
      newTradeForm.selectedAccountId &&
        newTradeForm.selectedSymbolId &&
        newTradeForm.lotSize.trim() !== "",
    ) && !newTradeSubmitting

  const handleRefresh = () => {
    setRefreshCounter((value) => value + 1)
  }

  const handleResetFilters = () => {
    setSearchTerm("")
    setSymbolFilter("all")
    setSideFilter("all")
    if (activeTab === "open") {
      setOpenPage(1)
    } else {
      setClosedPage(1)
    }
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) {
      return
    }

    if (activeTab === "open") {
      setOpenPage(page)
    } else {
      setClosedPage(page)
    }
  }

  const parseNumberInput = (value: string, allowEmpty = false): number | null | undefined => {
    const trimmed = value.trim()
    if (!trimmed) return allowEmpty ? null : undefined
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed)) return undefined
    return parsed
  }

  const handleViewPosition = async (position: AdminTradingPosition) => {
    setSelectedPosition(position)
    setViewDialogOpen(true)
    setViewLoading(true)

    try {
      const response = await adminService.getTradingPosition(position.id)
      if (response.success && response.data) {
        setSelectedPosition(response.data)
      } else {
        throw new Error(response.message || "Failed to load position details")
      }
    } catch (error) {
      console.error(error)
      showError("Failed to load position details", error instanceof Error ? error.message : undefined)
    } finally {
      setViewLoading(false)
    }
  }

  const handleEditPosition = (position: AdminTradingPosition) => {
    setSelectedPosition(position)
    setEditForm({
      lotSize: position.lotSize?.toString() ?? "",
      stopLoss: position.stopLoss?.toString() ?? "",
      takeProfit: position.takeProfit?.toString() ?? "",
      comment: position.comment ?? "",
    })
    setEditDialogOpen(true)
  }

  const handleClosePosition = (position: AdminTradingPosition) => {
    setSelectedPosition(position)
    const defaultClosePrice =
      typeof position.currentPrice === "number"
        ? position.currentPrice
        : typeof position.closePrice === "number"
          ? position.closePrice
          : position.openPrice

    setCloseForm({
      closePrice: defaultClosePrice ? defaultClosePrice.toFixed(5) : "",
      closeReason: CLOSE_REASON_OPTIONS[0].value,
    })
    setCloseDialogOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!selectedPosition) return

    const lotSizeValue = parseNumberInput(editForm.lotSize, false)
    if (lotSizeValue === undefined || lotSizeValue === null || lotSizeValue <= 0) {
      showError("Invalid lot size", "Enter a positive number for lot size.")
      return
    }

    const stopLossValue = parseNumberInput(editForm.stopLoss, true)
    if (stopLossValue === undefined) {
      showError("Invalid stop loss", "Enter a valid stop loss or leave the field blank.")
      return
    }

    const takeProfitValue = parseNumberInput(editForm.takeProfit, true)
    if (takeProfitValue === undefined) {
      showError("Invalid take profit", "Enter a valid take profit or leave the field blank.")
      return
    }

    setEditSubmitting(true)
    try {
      const response = await adminService.updateTradingPosition(selectedPosition.id, {
        lotSize: lotSizeValue,
        stopLoss: stopLossValue ?? null,
        takeProfit: takeProfitValue ?? null,
        comment: editForm.comment.trim() ? editForm.comment.trim() : null,
      })

      if (!response.success) {
        throw new Error(response.message || "Failed to update position")
      }

      showSuccess("Position updated", "The position was updated successfully.")
      setEditDialogOpen(false)
      setRefreshCounter((value) => value + 1)
    } catch (error) {
      console.error(error)
      showError("Failed to update position", error instanceof Error ? error.message : undefined)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleCloseSubmit = async () => {
    if (!selectedPosition) return

    const closePriceValue = parseNumberInput(closeForm.closePrice, true)
    if (closePriceValue === undefined) {
      showError("Invalid close price", "Enter a valid close price or leave the field blank.")
      return
    }

    setClosingPositionIds((prev) =>
      prev.includes(selectedPosition.id) ? prev : [...prev, selectedPosition.id],
    )
    setCloseSubmitting(true)
    try {
      const payload: { closePrice?: number; closeReason: CloseReason } = {
        closeReason: closeForm.closeReason,
      }
      if (closePriceValue !== null && closePriceValue !== undefined) {
        payload.closePrice = closePriceValue
      }

      const response = await adminService.closeTradingPosition(selectedPosition.id, payload)
      if (!response.success) {
        throw new Error(response.message || "Failed to close position")
      }

      showSuccess("Position closed", "The position has been closed successfully.")
      setPositions((previous) => {
        const updated = previous.map((position) => {
          if (position.id !== selectedPosition.id) {
            return position
          }

          const timestamp = new Date().toISOString()
          return {
            ...position,
            status: "closed" as AdminTradingPosition["status"],
            closedAt: timestamp,
            updatedAt: timestamp,
          }
        })

        return activeTab === "open"
          ? updated.filter((position) => position.id !== selectedPosition.id)
          : updated
      })
      setCloseDialogOpen(false)
      setRefreshCounter((value) => value + 1)
    } catch (error) {
      console.error(error)
      if (error instanceof Error && error.message.toLowerCase().includes("not open")) {
        showError("Position already closed", "This trade has already been closed.")
        setCloseDialogOpen(false)
        setRefreshCounter((value) => value + 1)
      } else {
        showError("Failed to close position", error instanceof Error ? error.message : undefined)
      }
    } finally {
      setCloseSubmitting(false)
      setClosingPositionIds((prev) => prev.filter((id) => id !== selectedPosition.id))
    }
  }

  const handleSelectAccount = (account: AdminTradingAccount) => {
    setNewTradeForm((prev) => ({
      ...prev,
      selectedAccountId: String(account.id),
      selectedAccountLabel: `${account.accountNumber} • ${account.userName || account.userEmail}`,
    }))
  }

  const handleSelectSymbol = (symbol: Symbol) => {
    setNewTradeForm((prev) => ({
      ...prev,
      selectedSymbolId: String(symbol.id),
      selectedSymbolLabel: `${symbol.symbol} • ${symbol.name}`,
    }))
  }

  const handleNewTradeSubmit = async () => {
    if (!newTradeForm.selectedAccountId) {
      showError("Select an account", "Choose a trading account to proceed.")
      return
    }

    if (!newTradeForm.selectedSymbolId) {
      showError("Select a symbol", "Choose a trading symbol to proceed.")
      return
    }

    const lotSizeValue = parseNumberInput(newTradeForm.lotSize, false)
    if (lotSizeValue === undefined || lotSizeValue === null || lotSizeValue <= 0) {
      showError("Invalid lot size", "Enter a positive number for lot size.")
      return
    }

    const stopLossValue = parseNumberInput(newTradeForm.stopLoss, true)
    if (stopLossValue === undefined) {
      showError("Invalid stop loss", "Enter a valid stop loss or leave blank.")
      return
    }

    const takeProfitValue = parseNumberInput(newTradeForm.takeProfit, true)
    if (takeProfitValue === undefined) {
      showError("Invalid take profit", "Enter a valid take profit or leave blank.")
      return
    }

    setNewTradeSubmitting(true)
    try {
      const response = await adminService.openTradingPosition({
        accountId: Number(newTradeForm.selectedAccountId),
        symbolId: Number(newTradeForm.selectedSymbolId),
        side: newTradeForm.side,
        lotSize: lotSizeValue,
        stopLoss: stopLossValue ?? null,
        takeProfit: takeProfitValue ?? null,
        comment: newTradeForm.comment.trim() ? newTradeForm.comment.trim() : null,
      })

      if (!response.success) {
        throw new Error(response.message || "Failed to open trade")
      }

      showSuccess("Trade opened", "The new trade has been created successfully.")
      setNewTradeDialogOpen(false)
      setRefreshCounter((value) => value + 1)
    } catch (error) {
      console.error(error)
      showError("Failed to open trade", error instanceof Error ? error.message : undefined)
    } finally {
      setNewTradeSubmitting(false)
    }
  }

  const renderPositionsTable = () => {
    const pnlLabel = activeTab === "open" ? "Unrealized P&L" : "Net P&L"
    const priceLabel = activeTab === "open" ? "Current Price" : "Close Price"

    return (
      <div className="space-y-4">
        {positionsError && (
          <Alert variant="destructive">
            <AlertTitle>Unable to retrieve positions</AlertTitle>
            <AlertDescription>{positionsError}</AlertDescription>
          </Alert>
        )}

        <div className="hidden sm:block">
          <div className="w-full overflow-x-auto rounded-lg border border-border/60">
            <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Trade</TableHead>
                <TableHead className="min-w-[180px]">User</TableHead>
                <TableHead className="min-w-[160px]">Account</TableHead>
                <TableHead className="min-w-[140px]">Symbol</TableHead>
                <TableHead className="min-w-[80px]">Side</TableHead>
                <TableHead className="min-w-[90px]">Lot Size</TableHead>
                <TableHead className="min-w-[110px]">Open Price</TableHead>
                <TableHead className="min-w-[110px]">{priceLabel}</TableHead>
                <TableHead className="min-w-[120px] text-right">{pnlLabel}</TableHead>
                <TableHead className="min-w-[110px] text-right">Commission</TableHead>
                <TableHead className="min-w-[150px]">Opened</TableHead>
                <TableHead className="min-w-[150px]">{activeTab === "open" ? "Updated" : "Closed"}</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positionsLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      {Array.from({ length: 13 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : positions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13}>
                        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                          No positions found for the current filters.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    positions.map((position) => {
                      const pnlValue = activeTab === "open" ? position.unrealizedPnl ?? 0 : position.netProfit ?? 0
                      const priceValue =
                        activeTab === "open"
                          ? position.currentPrice
                          : position.closePrice ?? position.currentPrice ?? position.openPrice

                      return (
                        <TableRow key={position.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="font-semibold">#{position.id}</div>
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(position.openedAt) || "Opened"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{position.userName || position.user?.firstName || position.userEmail}</div>
                            <p className="text-xs text-muted-foreground">{position.userEmail}</p>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{position.accountNumber}</div>
                            <p className="text-xs text-muted-foreground">Account #{position.accountId}</p>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{position.symbol}</div>
                            <p className="text-xs text-muted-foreground">{position.symbolName}</p>
                          </TableCell>
                          <TableCell>{renderSideBadge(position.side)}</TableCell>
                          <TableCell>{formatNumber(position.lotSize, 2)}</TableCell>
                          <TableCell>{formatPrice(position.openPrice)}</TableCell>
                          <TableCell>{formatPrice(priceValue)}</TableCell>
                          <TableCell className="text-right">{renderPnL(pnlValue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(position.commission)}</TableCell>
                          <TableCell>
                            <div>{formatDateTime(position.openedAt)}</div>
                          </TableCell>
                          <TableCell>
                            <div>{formatDateTime(activeTab === "open" ? position.updatedAt ?? position.openedAt : position.closedAt)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewPosition(position)}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View</span>
                              </Button>
                              {position.status === "open" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditPosition(position)}
                                  title="Modify position"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                              )}
                              {position.status === "open" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleClosePosition(position)}
                                  title="Close position"
                                  disabled={closingPositionIds.includes(position.id)}
                                >
                                  <XCircle className="h-4 w-4 text-red-500" />
                                  <span className="sr-only">Close</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
            </TableBody>
            </Table>
          </div>
        </div>

        {/* Mobile list (xs only) */}
        <div className="space-y-3 sm:hidden">
          {positionsLoading ? (
            Array.from({ length: 6 }).map((_, idx) => (
              <div key={`pos-skel-${idx}`} className="animate-pulse bg-card/20 rounded-lg p-3">
                <div className="h-4 w-24 mb-2 bg-muted/40 rounded" />
                <div className="h-3 w-32 mb-1 bg-muted/30 rounded" />
                <div className="h-3 w-20 bg-muted/30 rounded" />
              </div>
            ))
          ) : positions.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">No positions found for the current filters.</div>
          ) : (
            positions.map((position) => {
              const pnlValue = activeTab === "open" ? position.unrealizedPnl ?? 0 : position.netProfit ?? 0
              const priceValue = activeTab === "open" ? position.currentPrice : position.closePrice ?? position.currentPrice ?? position.openPrice
              return (
                <div key={`pos-${position.id}`} className="bg-card/40 border border-border/10 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 font-semibold">
                        <span className="truncate">#{position.id}</span>
                        <span className="text-xs text-muted-foreground">{position.userName ?? position.userEmail}</span>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{position.symbol} • {position.symbolName}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className={cn("text-sm font-mono font-semibold", classForPnL(pnlValue))}>{formatCurrency(pnlValue)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                      <div>{renderSideBadge(position.side)}</div>
                      <div>{formatNumber(position.lotSize, 2)} lots</div>
                      <div>Price: {formatPrice(priceValue)}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => handleViewPosition(position)} title="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {position.status === "open" && (
                        <Button variant="ghost" size="icon" onClick={() => handleEditPosition(position)} title="Modify position">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {position.status === "open" && (
                        <Button variant="ghost" size="icon" onClick={() => handleClosePosition(position)} title="Close position" disabled={closingPositionIds.includes(position.id)}>
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {totalRows} {activeTab === "open" ? "open" : "closed"} positions
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePageChange((positionsPagination.page || currentPage) - 1)} disabled={currentPage <= 1 || positionsLoading}>
              Previous
            </Button>
            {paginationNumbers.map((entry, index) =>
              typeof entry === "number" ? (
                <Button
                  key={`page-${entry}-${index}`}
                  variant={entry === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(entry)}
                  disabled={positionsLoading}
                >
                  {entry}
                </Button>
              ) : (
                <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                  {entry}
                </span>
              ),
            )}
            <Button variant="outline" size="sm" onClick={() => handlePageChange((positionsPagination.page || currentPage) + 1)} disabled={currentPage >= totalPages || positionsLoading}>
              Next
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
    <div className="space-y-8 pb-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Trades Management</h1>
              <p className="text-muted-foreground">Monitor, open, modify, and close user positions in real time.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={positionsLoading || overviewLoading}
                className="bg-background/60 backdrop-blur"
              >
                {positionsLoading || overviewLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
              <Button
                className="bg-blue-600 text-white shadow-lg hover:bg-blue-700"
                onClick={() => setNewTradeDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Open Trade
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Open Positions</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Activity className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {overviewLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : overview?.openPositions ?? 0}
                </div>
                <p className={cn("text-xs", classForPnL(totalOpenPnL))}>{formatCurrency(totalOpenPnL)} P&L</p>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Closed Positions</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {overviewLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : overview?.closedPositions ?? 0}
                </div>
                <p className={cn("text-xs", classForPnL(totalClosedPnL))}>{formatCurrency(totalClosedPnL)} P&L</p>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Volume</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{formatNumber(totalVolume, 2)}</div>
                <p className="text-xs text-muted-foreground">Lots traded</p>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Commission</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <DollarSign className="h-4 w-4 text-orange-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalCommission)}</div>
                <p className="text-xs text-muted-foreground">Collected</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1 lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value)
                      if (activeTab === "open") setOpenPage(1)
                      else setClosedPage(1)
                    }}
                    placeholder="Search by user, account, trade ID or symbol"
                    className="pl-9"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={symbolFilter}
                    onValueChange={(value) => {
                      setSymbolFilter(value)
                      if (activeTab === "open") setOpenPage(1)
                      else setClosedPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Symbol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All symbols</SelectItem>
                      {symbolOptions.map((symbol) => (
                        <SelectItem key={symbol} value={symbol}>
                          {symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={sideFilter}
                    onValueChange={(value) => {
                      setSideFilter(value as "all" | "buy" | "sell")
                      if (activeTab === "open") setOpenPage(1)
                      else setClosedPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Side" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sides</SelectItem>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleResetFilters} className="gap-2">
                    <Filter className="h-4 w-4" /> Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PositionsTab)} className="w-full">
              <CardHeader className="pb-0">
                <TabsList className="grid w-full grid-cols-2 bg-muted/30 backdrop-blur-sm text-sm">
                  <TabsTrigger value="open" className="flex items-center justify-center gap-2 px-2 py-1 text-sm sm:text-base">
                    
                    <span>Open Positions</span>
                  </TabsTrigger>
                  <TabsTrigger value="closed" className="flex items-center justify-center gap-2 px-2 py-1 text-sm sm:text-base">
                    
                    <span>Closed Positions</span>
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-6">
                <TabsContent value="open" className="mt-0 space-y-4">
                  {renderPositionsTable()}
                </TabsContent>
                <TabsContent value="closed" className="mt-0 space-y-4">
                  {renderPositionsTable()}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
    <DialogContent className="w-full max-w-full sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Position details</DialogTitle>
              <DialogDescription>Review the full lifecycle of this trade.</DialogDescription>
            </DialogHeader>
            {viewLoading || !selectedPosition ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Trade ID</Label>
                    <div className="text-sm font-semibold">#{selectedPosition.id}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1 flex items-center gap-2">{renderStatusBadge(selectedPosition.status)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Side</Label>
                    <div className="mt-1 flex items-center gap-2">{renderSideBadge(selectedPosition.side)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Lot size</Label>
                    <div className="text-sm font-medium">{formatNumber(selectedPosition.lotSize, 2)} lots</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Open price</Label>
                    <div className="text-sm font-medium">{formatPrice(selectedPosition.openPrice)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Current/Close price</Label>
                    <div className="text-sm font-medium">{formatPrice(selectedPosition.closePrice ?? selectedPosition.currentPrice)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Stop loss</Label>
                    <div className="text-sm">{formatPrice(selectedPosition.stopLoss)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Take profit</Label>
                    <div className="text-sm">{formatPrice(selectedPosition.takeProfit)}</div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">User</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{selectedPosition.userName || selectedPosition.userEmail}</div>
                        <p className="text-xs text-muted-foreground">{selectedPosition.userEmail}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Account</Label>
                    <div className="font-medium">{selectedPosition.accountNumber}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Opened at</Label>
                    <div className="text-sm">{formatDateTime(selectedPosition.openedAt)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Closed at</Label>
                    <div className="text-sm">{formatDateTime(selectedPosition.closedAt)}</div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Commission</Label>
                    <div className="text-sm font-medium">{formatCurrency(selectedPosition.commission)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Swap</Label>
                    <div className="text-sm">{formatCurrency(selectedPosition.swap)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Gross profit</Label>
                    <div className={cn("text-sm font-medium", classForPnL(selectedPosition.grossProfit))}>{formatCurrency(selectedPosition.grossProfit)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Net profit</Label>
                    <div className={cn("text-sm font-medium", classForPnL(selectedPosition.netProfit))}>{formatCurrency(selectedPosition.netProfit)}</div>
                  </div>
                </div>

                {selectedPosition.comment && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Comment</Label>
                    <p className="mt-1 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">{selectedPosition.comment}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
    <DialogContent className="w-full max-w-full sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modify position</DialogTitle>
              <DialogDescription>Update trade parameters for this position.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-lotSize">Lot size</Label>
                  <Input
                    id="edit-lotSize"
                    value={editForm.lotSize}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, lotSize: event.target.value }))}
                    placeholder="e.g. 0.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stopLoss">Stop loss</Label>
                  <Input
                    id="edit-stopLoss"
                    value={editForm.stopLoss}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, stopLoss: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-takeProfit">Take profit</Label>
                  <Input
                    id="edit-takeProfit"
                    value={editForm.takeProfit}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, takeProfit: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-comment">Comment</Label>
                  <Textarea
                    id="edit-comment"
                    value={editForm.comment}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, comment: event.target.value }))}
                    placeholder="Internal note (optional)"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={editSubmitting}>
                {editSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
          <DialogContent className="w-full max-w-full sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Close position</DialogTitle>
              <DialogDescription>Set an optional close price and reason before confirming.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="close-price">Close price</Label>
                <Input
                  id="close-price"
                  value={closeForm.closePrice}
                  onChange={(event) => setCloseForm((prev) => ({ ...prev, closePrice: event.target.value }))}
                  placeholder="Leave empty to use current price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close-reason">Reason</Label>
                <Select
                  value={closeForm.closeReason}
                  onValueChange={(value) =>
                    setCloseForm((prev) => ({ ...prev, closeReason: value as CloseReason }))
                  }
                >
                  <SelectTrigger id="close-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLOSE_REASON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCloseDialogOpen(false)} disabled={closeSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleCloseSubmit} className="bg-red-600 hover:bg-red-700" disabled={closeSubmitting}>
                {closeSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Close position
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={newTradeDialogOpen} onOpenChange={setNewTradeDialogOpen}>
          <DialogContent className="w-full max-w-full sm:max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Open new trade</DialogTitle>
              <DialogDescription>Create a new position on behalf of a user.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Trading account</Label>
                    <Input
                      value={accountSearchTerm}
                      onChange={(event) => setAccountSearchTerm(event.target.value)}
                      placeholder="Search by user, email or account number"
                    />
                    <ScrollArea className="max-h-56 rounded-md border border-border/40">
                      <div className="divide-y divide-border/60">
                        {accountLoading ? (
                          <div className="space-y-2 p-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                              <Skeleton key={index} className="h-10 w-full" />
                            ))}
                          </div>
                        ) : accountResults.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground">No accounts found.</div>
                        ) : (
                          accountResults.map((account) => {
                            const isSelected = newTradeForm.selectedAccountId === String(account.id)
                            return (
                              <button
                                key={account.id}
                                type="button"
                                onClick={() => handleSelectAccount(account)}
                                className={cn(
                                  "flex w-full flex-col items-start gap-1 p-3 text-left transition-colors",
                                  isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                                )}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium">{account.accountNumber}</span>
                                  {isSelected && <Badge variant="outline">Selected</Badge>}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {account.userName || account.userEmail}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Balance: {formatCurrency(account.balance)} • Equity: {formatCurrency(account.equity)}
                                </span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                    {newTradeForm.selectedAccountLabel && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {newTradeForm.selectedAccountLabel}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Symbol</Label>
                    <Input
                      value={symbolSearchTerm}
                      onChange={(event) => setSymbolSearchTerm(event.target.value)}
                      placeholder="Search trading symbols (min. 1 character)"
                    />
                    <ScrollArea className="max-h-56 rounded-md border border-border/40">
                      <div className="divide-y divide-border/60">
                        {symbolLoading ? (
                          <div className="space-y-2 p-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                              <Skeleton key={index} className="h-10 w-full" />
                            ))}
                          </div>
                        ) : symbolResults.length === 0 ? (
                          <div className="p-4 text-sm text-muted-foreground">Start typing to search for symbols.</div>
                        ) : (
                          symbolResults.map((symbol) => {
                            const isSelected = newTradeForm.selectedSymbolId === String(symbol.id)
                            return (
                              <button
                                key={symbol.id}
                                type="button"
                                onClick={() => handleSelectSymbol(symbol)}
                                className={cn(
                                  "flex w-full flex-col items-start gap-1 p-3 text-left transition-colors",
                                  isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                                )}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <span className="font-medium">{symbol.symbol}</span>
                                  {isSelected && <Badge variant="outline">Selected</Badge>}
                                </div>
                                <span className="text-xs text-muted-foreground">{symbol.name}</span>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </ScrollArea>
                    {newTradeForm.selectedSymbolLabel && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {newTradeForm.selectedSymbolLabel}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <RadioGroup
                    value={newTradeForm.side}
                    onValueChange={(value: "buy" | "sell") => setNewTradeForm((prev) => ({ ...prev, side: value }))}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <Label
                      className={cn(
                        "flex cursor-pointer flex-col gap-2 rounded-lg border border-border/60 p-3",
                        newTradeForm.side === "buy" ? "ring-2 ring-emerald-400" : "hover:bg-muted/40",
                      )}
                    >
                      <RadioGroupItem value="buy" className="sr-only" />
                      <span className="font-semibold text-emerald-600">Buy</span>
                      <span className="text-xs text-muted-foreground">
                        Open a long position on the selected symbol.
                      </span>
                    </Label>
                    <Label
                      className={cn(
                        "flex cursor-pointer flex-col gap-2 rounded-lg border border-border/60 p-3",
                        newTradeForm.side === "sell" ? "ring-2 ring-red-400" : "hover:bg-muted/40",
                      )}
                    >
                      <RadioGroupItem value="sell" className="sr-only" />
                      <span className="font-semibold text-red-600">Sell</span>
                      <span className="text-xs text-muted-foreground">
                        Open a short position on the selected symbol.
                      </span>
                    </Label>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-lots">Lot size</Label>
                  <Input
                    id="new-lots"
                    value={newTradeForm.lotSize}
                    onChange={(event) => setNewTradeForm((prev) => ({ ...prev, lotSize: event.target.value }))}
                    placeholder="e.g. 0.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-stop-loss">Stop loss</Label>
                  <Input
                    id="new-stop-loss"
                    value={newTradeForm.stopLoss}
                    onChange={(event) => setNewTradeForm((prev) => ({ ...prev, stopLoss: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-take-profit">Take profit</Label>
                  <Input
                    id="new-take-profit"
                    value={newTradeForm.takeProfit}
                    onChange={(event) => setNewTradeForm((prev) => ({ ...prev, takeProfit: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="new-comment">Comment</Label>
                  <Textarea
                    id="new-comment"
                    value={newTradeForm.comment}
                    onChange={(event) => setNewTradeForm((prev) => ({ ...prev, comment: event.target.value }))}
                    placeholder="Internal note (optional)"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewTradeDialogOpen(false)} disabled={newTradeSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleNewTradeSubmit} disabled={!canSubmitNewTrade}>
                {newTradeSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Open trade
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}