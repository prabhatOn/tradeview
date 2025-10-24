"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminLayout } from "@/components/admin/admin-layout"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  Users,
  TrendingUp,
  Search,
  Edit,
  Save,
  DollarSign,
  Calculator,
  Percent,
  BarChart3,
  Target,
  RefreshCw,
  Loader2,
  Settings,
  CheckCircle
} from "lucide-react"
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'
import { adminService } from '@/lib/services'
import {
  AdminSymbolChargeRow,
  AdminTradingChargesResponseData,
  AdminTradingUserLeverageRow,
  AdminTradingUserLeverageResponse,
  AdminBrokerageUpdatePayload,
  PaginationInfo
} from '@/lib/types'

// sidebar and topbar come from shared config

type EditingSymbolState = {
  commissionPerLot: string
  swapLong: string
  swapShort: string
  spreadMarkup: string
  marginRequirement: string
  status: "active" | "inactive"
}

const formatNumber = (value: number | string | null | undefined, fractionDigits = 2) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return (0).toFixed(fractionDigits)
  }
  return numeric.toFixed(fractionDigits)
}

const toNumber = (value: number | string | null | undefined, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "—"
  }

  return parsed.toLocaleString()
}

const defaultEditingState = (symbol: AdminSymbolChargeRow): EditingSymbolState => ({
  commissionPerLot: symbol.commissionPerLot.toString(),
  swapLong: symbol.swapLong.toString(),
  swapShort: symbol.swapShort.toString(),
  spreadMarkup: symbol.spreadMarkup.toString(),
  marginRequirement: symbol.marginRequirement.toString(),
  status: symbol.status === "inactive" ? "inactive" : "active"
})

type LoadMode = "initial" | "refresh"

const LEVERAGE_OPTIONS = ["100", "200", "500", "1000", "2000"] as const

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === "string" && error.length) {
    return error
  }

  if (error && typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === "string" && maybeMessage.length) {
      return maybeMessage
    }
  }

  return fallback
}

function TradesChargesContent() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updatingSymbolId, setUpdatingSymbolId] = useState<number | null>(null)
  const [symbols, setSymbols] = useState<AdminSymbolChargeRow[]>([])
  const [demoLeverage, setDemoLeverage] = useState("100")
  const [liveLeverage, setLiveLeverage] = useState("100")
  const [standardCommission, setStandardCommission] = useState("0")
  const [standardSpread, setStandardSpread] = useState("0")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editingSymbolId, setEditingSymbolId] = useState<number | null>(null)
  const [editedSymbolValues, setEditedSymbolValues] = useState<EditingSymbolState | null>(null)
  const [userLeverageRows, setUserLeverageRows] = useState<AdminTradingUserLeverageRow[]>([])
  const [userLeverageLoading, setUserLeverageLoading] = useState(false)
  const [userLeverageFilter, setUserLeverageFilter] = useState<string>("all")
  const [userLeverageSearchInput, setUserLeverageSearchInput] = useState("")
  const [userLeverageSearch, setUserLeverageSearch] = useState("")
  const [userLeveragePagination, setUserLeveragePagination] = useState<PaginationInfo | null>(null)
  const [userLeveragePage, setUserLeveragePage] = useState(1)
  const [editingUserLeverageId, setEditingUserLeverageId] = useState<number | null>(null)
  const [editingUserLeverageValue, setEditingUserLeverageValue] = useState<string>("100")
  const [updatingUserLeverageId, setUpdatingUserLeverageId] = useState<number | null>(null)
  const [userLeverageError, setUserLeverageError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  const loadData = useCallback(async (mode: LoadMode = "initial") => {
    if (mode === "initial") {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setErrorMessage(null)

    try {
      const response = await adminService.getTradingCharges()
      if (!response?.success || !response.data) {
        throw new Error(response?.message || "Failed to fetch trading charges")
      }

      const data: AdminTradingChargesResponseData = response.data
      setSymbols(data.symbols ?? [])

      const standardCommissionValue = data.brokerage?.standard?.commission ?? 0
      const standardSpreadValue = data.brokerage?.standard?.spreadMarkup ?? 0
  setStandardCommission(formatNumber(standardCommissionValue, 2))
  setStandardSpread(formatNumber(standardSpreadValue, 2))
      setDemoLeverage(formatNumber(data.leverage?.defaultLeverage ?? 100, 0))
      setLiveLeverage(formatNumber(data.leverage?.maxLeverage ?? 100, 0))
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to load trading charges")
      setErrorMessage(message)
      toast({
        title: "Failed to load trading charges",
        description: message,
        variant: "destructive"
      })
    } finally {
      if (mode === "initial") {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }, [toast])

  const loadUserLeverage = useCallback(
    async (page = 1) => {
      setUserLeverageLoading(true)
      if (page === 1) {
        setUserLeverageError(null)
      }

      try {
        const response = await adminService.getTradingUsersByLeverage({
          leverage: userLeverageFilter === "all" ? undefined : Number(userLeverageFilter),
          search: userLeverageSearch.trim() ? userLeverageSearch.trim() : undefined,
          page,
          limit: 25
        })

        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to fetch user leverage data")
        }

        const data: AdminTradingUserLeverageResponse = response.data
        setUserLeverageRows(Array.isArray(data.rows) ? data.rows : [])
        setUserLeveragePagination(data.pagination ?? null)
        setUserLeveragePage(page)
      } catch (error: unknown) {
        const message = getErrorMessage(error, "Unable to load user leverage data")
        setUserLeverageError(message)
        toast({
          title: "Failed to load user leverage",
          description: message,
          variant: "destructive"
        })
      } finally {
        setUserLeverageLoading(false)
      }
    },
    [toast, userLeverageFilter, userLeverageSearch]
  )

  useEffect(() => {
    loadData("initial")
  }, [loadData])

  useEffect(() => {
    loadUserLeverage(1)
  }, [loadUserLeverage])

  const handleUserLeverageFilterChange = (value: string) => {
    setUserLeverageFilter(value)
    setUserLeveragePage(1)
  }

  const handleApplyUserLeverageSearch = () => {
    setUserLeverageSearch(userLeverageSearchInput.trim())
    setUserLeveragePage(1)
  }

  const handleResetUserLeverageFilters = () => {
    setUserLeverageFilter("all")
    setUserLeverageSearch("")
    setUserLeverageSearchInput("")
    setUserLeveragePage(1)
  }

  const handleUserLeveragePageChange = (newPage: number) => {
    loadUserLeverage(newPage)
  }

  const startEditingUserLeverage = (row: AdminTradingUserLeverageRow) => {
    setEditingUserLeverageId(row.userId)
    setEditingUserLeverageValue(String(row.preferredLeverage || 100))
  }

  const cancelEditingUserLeverage = () => {
    setEditingUserLeverageId(null)
    setEditingUserLeverageValue("100")
  }

  const handleSaveUserLeverage = async (userId: number) => {
    const numericLeverage = Number(editingUserLeverageValue)
    if (!Number.isFinite(numericLeverage)) {
      toast({
        title: "Invalid leverage value",
        description: "Please choose a valid leverage option before saving.",
        variant: "destructive"
      })
      return
    }

    setUpdatingUserLeverageId(userId)

    try {
      const response = await adminService.updateTradingUserLeverage(userId, {
        preferredLeverage: numericLeverage
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to update user leverage")
      }

      const updatedRow = response.data as AdminTradingUserLeverageRow
      setUserLeverageRows((previous) =>
        previous.map((row) => (row.userId === userId ? updatedRow : row))
      )

      toast({
        title: "Leverage updated",
        description: "User leverage preferences were saved successfully."
      })

      cancelEditingUserLeverage()
    } catch (error: unknown) {
      toast({
        title: "Failed to update leverage",
        description: getErrorMessage(error, "Unable to update the user's leverage."),
        variant: "destructive"
      })
    } finally {
      setUpdatingUserLeverageId(null)
    }
  }

  const filteredSymbols = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return symbols
    }
    const query = debouncedSearchTerm.trim().toLowerCase()
    return symbols.filter((symbol) =>
      symbol.symbol.toLowerCase().includes(query) ||
      symbol.name.toLowerCase().includes(query)
    )
  }, [symbols, debouncedSearchTerm])

  const stats = useMemo(() => {
    const symbolsToUse = filteredSymbols.length > 0 ? filteredSymbols : symbols
    if (!symbolsToUse.length) {
      return {
        total: 0,
        active: 0,
        activeRate: 0,
        avgCommission: 0,
        avgSpread: 0
      }
    }

    const total = symbolsToUse.length
    const active = symbolsToUse.filter((symbol) => (symbol.status || "").toLowerCase() === "active").length
    const commissionSum = symbolsToUse.reduce((acc, symbol) => acc + toNumber(symbol.commissionPerLot), 0)
    const spreadSum = symbolsToUse.reduce((acc, symbol) => acc + toNumber(symbol.spreadMarkup), 0)

    return {
      total,
      active,
      activeRate: total ? (active / total) * 100 : 0,
      avgCommission: total ? commissionSum / total : 0,
      avgSpread: total ? spreadSum / total : 0
    }
  }, [symbols, filteredSymbols])

  const handleRefresh = async () => {
    await loadData("refresh")
  }

  const parseInputValue = (value: string) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }

  const handleSaveAll = async () => {
    const standardCommissionValue = parseInputValue(standardCommission)
    const standardSpreadValue = parseInputValue(standardSpread)
  
    const defaultLeverageValue = parseInputValue(demoLeverage)
    const maxLeverageValue = parseInputValue(liveLeverage)

    if (
      standardCommissionValue === null ||
      standardSpreadValue === null ||
      defaultLeverageValue === null ||
      maxLeverageValue === null
    ) {
      toast({
        title: "Invalid values",
        description: "Please ensure all brokerage and leverage fields contain valid numbers.",
        variant: "destructive"
      })
      return
    }

    const payload: AdminBrokerageUpdatePayload = {
      accountType: "live",
      standard: {
        commission: standardCommissionValue,
        spreadMarkup: standardSpreadValue,
        commissionUnit: "per_lot",
        spreadUnit: "pips"
      },
      // VIP brokerage removed from frontend; keep payload minimal
    }

    setSaving(true)
    try {
      const [brokerageResponse, leverageResponse] = await Promise.all([
        adminService.updateTradingBrokerageRates(payload),
        adminService.updateTradingLeverageSettings({
          defaultLeverage: defaultLeverageValue,
          maxLeverage: maxLeverageValue
        })
      ])

      if (!brokerageResponse.success || !brokerageResponse.data) {
        throw new Error(brokerageResponse.message || "Failed to save brokerage rates")
      }
      if (!leverageResponse.success || !leverageResponse.data) {
        throw new Error(leverageResponse.message || "Failed to save leverage settings")
      }

      setDemoLeverage(formatNumber(leverageResponse.data.defaultLeverage, 0))
      setLiveLeverage(formatNumber(leverageResponse.data.maxLeverage, 0))

      toast({
        title: "Settings saved",
        description: "Brokerage rates and leverage settings updated successfully.",
        variant: "default"
      })

      await loadData("refresh")
    } catch (error: unknown) {
      toast({
        title: "Failed to save settings",
        description: getErrorMessage(error, "Unable to update brokerage and leverage settings."),
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const startEditingSymbol = (symbol: AdminSymbolChargeRow) => {
    setEditingSymbolId(symbol.id)
    setEditedSymbolValues(defaultEditingState(symbol))
  }

  const cancelEditingSymbol = () => {
    setEditingSymbolId(null)
    setEditedSymbolValues(null)
  }

  const handleSymbolFieldChange = (field: keyof EditingSymbolState, value: string) => {
    setEditedSymbolValues((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSaveSymbol = async (symbolId: number) => {
    if (!editedSymbolValues) return

    const commissionValue = parseInputValue(editedSymbolValues.commissionPerLot)
    const swapLongValue = parseInputValue(editedSymbolValues.swapLong)
    const swapShortValue = parseInputValue(editedSymbolValues.swapShort)
    const spreadValue = parseInputValue(editedSymbolValues.spreadMarkup)
    const marginRequirementValue = parseInputValue(editedSymbolValues.marginRequirement)

    if (
      commissionValue === null ||
      swapLongValue === null ||
      swapShortValue === null ||
      spreadValue === null ||
      marginRequirementValue === null
    ) {
      toast({
        title: "Invalid symbol values",
        description: "Please ensure all symbol fields contain valid numbers.",
        variant: "destructive"
      })
      return
    }

    setUpdatingSymbolId(symbolId)
    try {
      // Debug: log save attempt and payload
      // This helps confirm the frontend is initiating the request
      console.log('[admin-ui] Saving symbol', symbolId, editedSymbolValues)
      const response = await adminService.updateTradingSymbolCharges(symbolId, {
        commissionPerLot: commissionValue,
        swapLong: swapLongValue,
        swapShort: swapShortValue,
        spreadMarkup: spreadValue,
        marginRequirement: marginRequirementValue,
        status: editedSymbolValues.status
      })

      console.log('[admin-ui] updateTradingSymbolCharges response:', response)

      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to update symbol")
      }

      const updatedSymbol = response.data
      setSymbols((prev) => prev.map((symbol) => (symbol.id === symbolId ? updatedSymbol : symbol)))
      toast({
        title: "Symbol updated",
        description: `${response.data.symbol} charges saved successfully.`
      })
      cancelEditingSymbol()
    } catch (error: unknown) {
      toast({
        title: "Failed to update symbol",
        description: getErrorMessage(error, "Unable to update symbol charges."),
        variant: "destructive"
      })
    } finally {
      setUpdatingSymbolId(null)
    }
  }

  const handleToggleSymbolStatus = async (symbol: AdminSymbolChargeRow) => {
    const newStatus = (symbol.status || "").toLowerCase() === "active" ? "inactive" : "active"
    setUpdatingSymbolId(symbol.id)

    try {
      const response = await adminService.updateTradingSymbolCharges(symbol.id, {
        status: newStatus
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to update symbol status")
      }

      const updatedSymbol = response.data
      setSymbols((prev) => prev.map((row) => (row.id === symbol.id ? updatedSymbol : row)))
      toast({
        title: "Symbol status updated",
        description: `${symbol.symbol} is now ${newStatus}.`
      })
    } catch (error: unknown) {
      toast({
        title: "Failed to update status",
        description: getErrorMessage(error, "Unable to update symbol status."),
        variant: "destructive"
      })
    } finally {
      setUpdatingSymbolId(null)
    }
  }

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="hidden sm:block text-3xl font-bold text-foreground">Trades & Charges</h1>
            <p className="hidden sm:block text-muted-foreground mt-2 max-w-md break-words">
              Manage real trading charges, spreads, commissions, and leverage policies
            </p>
            {errorMessage ? (
              <p className="mt-2 text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row sm:items-center sm:space-x-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto bg-background/60 backdrop-blur-sm border-border/20"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
            <Button
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-lg backdrop-blur-sm"
              onClick={handleSaveAll}
              disabled={saving || loading || refreshing}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save All
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center space-y-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span>Loading trading charges…</span>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Active Symbols</CardTitle>
                    <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {stats.active}/{stats.total}
                  </div>
                  <p className="text-xs text-green-600">{formatNumber(stats.activeRate, 1)}% active rate</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Commission</CardTitle>
                    <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Percent className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatNumber(stats.avgCommission, 2)}</div>
                  <p className="text-xs text-muted-foreground">Average commission per lot</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Avg Spread</CardTitle>
                    <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-purple-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{formatNumber(stats.avgSpread, 2)}</div>
                  <p className="text-xs text-muted-foreground">Average markup (pips)</p>
                </CardContent>
              </Card>

              <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Max Leverage</CardTitle>
                    <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Target className="h-4 w-4 text-orange-600" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">1:{formatNumber(liveLeverage, 0)}</div>
                  <p className="text-xs text-muted-foreground">Configured maximum leverage</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
              <Tabs defaultValue="charges" className="w-full">
                <CardHeader className="pb-0">
                  {/* Tabs: horizontal scroll on xs, grid on sm+ */}
                  <div className="relative">
                    <TabsList className="flex gap-2 overflow-x-auto whitespace-nowrap py-1 px-1 rounded-md bg-muted/30 backdrop-blur-sm sm:grid sm:grid-cols-3 sm:gap-0 sm:overflow-visible">
                      <TabsTrigger value="charges" className="flex items-center gap-2 px-2 py-1 text-xs sm:text-base rounded-md flex-shrink-0">
                        <DollarSign className="h-4 w-4 sm:h-4 sm:w-4" />
                        <span className="hidden xs:hidden sm:inline truncate">Charges</span>
                      </TabsTrigger>
                      <TabsTrigger value="brokerage" className="flex items-center gap-2 px-2 py-1 text-xs sm:text-base rounded-md flex-shrink-0">
                        <Calculator className="h-4 w-4 sm:h-4 sm:w-4" />
                        <span className="hidden xs:hidden sm:inline truncate">Brokerage</span>
                      </TabsTrigger>
                      <TabsTrigger value="leverage" className="flex items-center gap-2 px-2 py-1 text-xs sm:text-base rounded-md flex-shrink-0">
                        <Users className="h-4 w-4 sm:h-4 sm:w-4" />
                        <span className="hidden xs:hidden sm:inline truncate">User Leverage</span>
                      </TabsTrigger>
                    </TabsList>
                    {/* right fade to indicate more tabs on overflow */}
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background/90 to-transparent"></div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <TabsContent value="charges" className="space-y-6">
                      <div>
                        <div className="flex w-full items-center justify-end">
                          <div className="flex w-full sm:w-auto items-center sm:justify-end gap-2 flex-col sm:flex-row">
                            <div className="relative w-full sm:w-auto">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                  placeholder="Search symbols..."
                                  className="pl-10 w-full sm:w-64 md:w-64 lg:w-64 bg-background/60 backdrop-blur-sm border-border/20"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                          </div>
                        </div>
                      </div>

                    <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow className="border-border/20">
                            <TableHead className="text-muted-foreground font-semibold">Symbol</TableHead>
                            <TableHead className="text-muted-foreground font-semibold">Swap Long</TableHead>
                            <TableHead className="text-muted-foreground font-semibold">Swap Short</TableHead>
                            <TableHead className="text-muted-foreground font-semibold">Spread</TableHead>
                            <TableHead className="text-muted-foreground font-semibold">Commission</TableHead>
                            <TableHead className="text-muted-foreground font-semibold">Margin Req.</TableHead>
                            <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                            <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSymbols.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                {debouncedSearchTerm.trim() ? "No symbols found matching your search." : "No symbols configured yet."}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredSymbols.map((symbol) => {
                              const isEditing = editingSymbolId === symbol.id
                              const isBusy = updatingSymbolId === symbol.id

                              return (
                                <TableRow key={symbol.id} className="hover:bg-muted/30 transition-colors border-border/20">
                                  <TableCell>
                                    <div className="flex items-center space-x-3">
                                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <TrendingUp className="h-4 w-4 text-primary" />
                                      </div>
                                      <div>
                                        <span className="font-semibold text-foreground block">{symbol.symbol}</span>
                                        <span className="text-xs text-muted-foreground">{symbol.name}</span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input
                                        value={editedSymbolValues?.swapLong ?? ""}
                                        onChange={(event) => handleSymbolFieldChange("swapLong", event.target.value)}
                                      />
                                    ) : (
                                      <span className={`font-mono ${symbol.swapLong < 0 ? "text-red-600" : "text-green-600"}`}>
                                        {formatNumber(symbol.swapLong, 2)}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input
                                        value={editedSymbolValues?.swapShort ?? ""}
                                        onChange={(event) => handleSymbolFieldChange("swapShort", event.target.value)}
                                      />
                                    ) : (
                                      <span className={`font-mono ${symbol.swapShort < 0 ? "text-red-600" : "text-green-600"}`}>
                                        {formatNumber(symbol.swapShort, 2)}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input
                                        value={editedSymbolValues?.spreadMarkup ?? ""}
                                        onChange={(event) => handleSymbolFieldChange("spreadMarkup", event.target.value)}
                                      />
                                    ) : (
                                      <span className="font-mono text-foreground">{formatNumber(symbol.spreadMarkup, 2)} pips</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input
                                        value={editedSymbolValues?.commissionPerLot ?? ""}
                                        onChange={(event) => handleSymbolFieldChange("commissionPerLot", event.target.value)}
                                      />
                                    ) : (
                                      <span className="font-mono text-foreground">{formatNumber(symbol.commissionPerLot, 2)}</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input
                                        value={editedSymbolValues?.marginRequirement ?? ""}
                                        onChange={(event) => handleSymbolFieldChange("marginRequirement", event.target.value)}
                                      />
                                    ) : (
                                      <span className="font-mono text-foreground">{formatNumber(symbol.marginRequirement, 2)}</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Select
                                        value={editedSymbolValues?.status ?? "active"}
                                        onValueChange={(value) => handleSymbolFieldChange("status", value)}
                                      >
                                        <SelectTrigger className="bg-background/80">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="active">Active</SelectItem>
                                          <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Badge
                                        variant={symbol.status === "active" ? "default" : "secondary"}
                                        className={`font-medium ${
                                          symbol.status === "active"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                                        }`}
                                      >
                                        {symbol.status === "active" ? "Active" : "Inactive"}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center space-x-2">
                                      {isEditing ? (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-2"
                                            onClick={cancelEditingSymbol}
                                            disabled={isBusy}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="h-8 px-3"
                                            onClick={() => handleSaveSymbol(symbol.id)}
                                            disabled={isBusy}
                                          >
                                            {isBusy ? (
                                              <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                              <Save className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                            onClick={() => startEditingSymbol(symbol)}
                                            disabled={isBusy}
                                          >
                                            <Edit className="h-4 w-4 text-blue-600" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                                            onClick={() => handleToggleSymbolStatus(symbol)}
                                            disabled={isBusy}
                                          >
                                            {isBusy ? (
                                              <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                                            ) : (
                                              <Settings className="h-4 w-4 text-green-600" />
                                            )}
                                          </Button>
                                        </>
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
                  </TabsContent>

                  <TabsContent value="brokerage" className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground flex items-center">
                        <Settings className="h-5 w-5 mr-2" />
                        Brokerage Settings
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Configure brokerage rates and commission structures for each account tier
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="lg:col-span-2">
                        <Card className="bg-background/50 border-border/20">
                        <CardHeader>
                          <CardTitle className="text-lg text-foreground">Standard Brokerage</CardTitle>
                          <p className="text-sm text-muted-foreground">Default rates for standard accounts</p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="standard-commission" className="text-sm font-medium text-foreground">
                              Standard Commission (per lot)
                            </Label>
                            <Input
                              id="standard-commission"
                              value={standardCommission}
                              onChange={(event) => setStandardCommission(event.target.value)}
                              className="bg-background/60 border-border/20"
                              placeholder="0.50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="standard-spread" className="text-sm font-medium text-foreground">
                              Standard Spread (pips)
                            </Label>
                            <Input
                              id="standard-spread"
                              value={standardSpread}
                              onChange={(event) => setStandardSpread(event.target.value)}
                              className="bg-background/60 border-border/20"
                              placeholder="1.50"
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20">
                            <div className="flex items-center space-x-3">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-sm font-medium text-foreground">Applied to standard trading accounts</span>
                            </div>
                          </div>
                        </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="leverage" className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground flex items-center">
                        <Users className="h-5 w-5 mr-2" />
                        User Leverage Management
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Review leverage preferences and adjust individual users when required.
                      </p>
                    </div>

                    <Card className="bg-background/50 border-border/20">
                      <CardContent className="space-y-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="sm:w-48">
                              <Label className="text-sm font-medium text-foreground">Leverage filter</Label>
                              <Select value={userLeverageFilter} onValueChange={handleUserLeverageFilterChange}>
                                <SelectTrigger className="bg-background/60 border-border/20">
                                  <SelectValue placeholder="All leverage" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All leverage</SelectItem>
                                  {LEVERAGE_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {`1:${option}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="sm:w-64">
                              <Label className="text-sm font-medium text-foreground">Search</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={userLeverageSearchInput}
                                  onChange={(event) => setUserLeverageSearchInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault()
                                      handleApplyUserLeverageSearch()
                                    }
                                  }}
                                  placeholder="Search by name or email"
                                  className="bg-background/60 border-border/20"
                                />
                                <Button onClick={handleApplyUserLeverageSearch} variant="secondary">
                                  <Search className="mr-2 h-4 w-4" />
                                  Apply
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              onClick={handleResetUserLeverageFilters}
                              className="text-muted-foreground"
                            >
                              Reset
                            </Button>
                            <Button variant="outline" onClick={() => loadUserLeverage(userLeveragePage)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Refresh
                            </Button>
                          </div>
                        </div>

                        {userLeverageError ? (
                          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                            {userLeverageError}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="overflow-x-auto rounded-lg border border-border/20">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/40">
                                    <TableHead className="min-w-[180px] text-foreground">User</TableHead>
                                    <TableHead className="min-w-[140px] text-foreground">Preferred leverage</TableHead>
                                    <TableHead className="min-w-[240px] text-foreground">Trading accounts</TableHead>
                                    <TableHead className="min-w-[160px] text-foreground">Last updated</TableHead>
                                    <TableHead className="min-w-[140px]" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {userLeverageLoading ? (
                                    <TableRow>
                                      <TableCell colSpan={5}>
                                        <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          Loading user leverage…
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ) : userLeverageRows.length === 0 ? (
                                    <TableRow>
                                      <TableCell colSpan={5}>
                                        <div className="p-6 text-center text-sm text-muted-foreground">
                                          No users matched the current filters.
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ) : (
                                    userLeverageRows.map((row) => {
                                      const isEditing = editingUserLeverageId === row.userId
                                      const currentLeverage = String(row.preferredLeverage ?? "100")
                                      const accounts = Array.isArray(row.accounts) ? row.accounts : []

                                      return (
                                        <TableRow key={row.userId} className="hover:bg-muted/30">
                                          <TableCell>
                                            <div className="flex flex-col">
                                              <span className="font-medium text-foreground">{row.name || row.email}</span>
                                              <span className="text-xs text-muted-foreground">{row.email}</span>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            {isEditing ? (
                                              <Select
                                                value={editingUserLeverageValue}
                                                onValueChange={setEditingUserLeverageValue}
                                              >
                                                <SelectTrigger className="bg-background/60 border-border/20">
                                                  <SelectValue placeholder="Select leverage" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {LEVERAGE_OPTIONS.map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                      {`1:${option}`}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <Badge variant="secondary" className="px-2 py-1 text-xs font-semibold">
                                                {`1:${currentLeverage}`}
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            {accounts.length ? (
                                              <div className="flex flex-wrap gap-2">
                                                {accounts.map((account) => (
                                                  <Badge key={account.accountId} variant="outline" className="text-xs font-medium">
                                                    {account.accountNumber} · 1:{account.leverage}
                                                  </Badge>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">No linked accounts</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground">
                                            {formatDateTime(row.updatedAt)}
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex items-center justify-end gap-2">
                                              {isEditing ? (
                                                <>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={cancelEditingUserLeverage}
                                                    disabled={updatingUserLeverageId === row.userId}
                                                  >
                                                    Cancel
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    onClick={() => handleSaveUserLeverage(row.userId)}
                                                    disabled={updatingUserLeverageId === row.userId}
                                                  >
                                                    {updatingUserLeverageId === row.userId ? (
                                                      <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Saving
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Save className="mr-2 h-4 w-4" />
                                                        Save
                                                      </>
                                                    )}
                                                  </Button>
                                                </>
                                              ) : (
                                                <Button variant="outline" size="sm" onClick={() => startEditingUserLeverage(row)}>
                                                  <Edit className="mr-2 h-4 w-4" />
                                                  Edit
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

                            {userLeveragePagination && userLeveragePagination.pages > 1 ? (
                              <div className="flex items-center justify-between border-t border-border/20 pt-4 text-sm text-muted-foreground">
                                <span>
                                  Page {userLeveragePagination.page} of {userLeveragePagination.pages}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleUserLeveragePageChange(
                                        Math.max(1, (userLeveragePagination?.page || 1) - 1)
                                      )
                                    }
                                    disabled={(userLeveragePagination?.page || 1) <= 1 || userLeverageLoading}
                                  >
                                    Previous
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleUserLeveragePageChange(
                                        Math.min(
                                          userLeveragePagination.pages,
                                          (userLeveragePagination?.page || 1) + 1
                                        )
                                      )
                                    }
                                    disabled={
                                      (userLeveragePagination?.page || 1) >= userLeveragePagination.pages || userLeverageLoading
                                    }
                                  >
                                    Next
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

export default function TradesChargesPage() {
  return (
    <ProtectedRoute requireAdmin>
      <TradesChargesContent />
    </ProtectedRoute>
  )
}