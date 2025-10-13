"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminLayout } from "@/components/admin/admin-layout"
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
  LayoutDashboard,
  Users,
  Receipt,
  TrendingUp,
  HeadphonesIcon,
  CreditCard,
  Wallet,
  Search,
  Plus,
  Edit,
  Save,
  RefreshCw,
  Settings,
  DollarSign,
  Percent,
  BarChart3,
  Calculator,
  Shield,
  Target,
  CheckCircle,
  Loader2
} from "lucide-react"
import { adminService } from "@/lib/services"
import {
  AdminBrokerageUpdatePayload,
  AdminSymbolChargeRow,
  AdminTradingChargesResponseData
} from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

const adminSidebarItems = [
  { title: "Overview", icon: LayoutDashboard, href: "/admin", description: "Dashboard overview and analytics" },
  { title: "User Management", icon: Users, href: "/admin/users", description: "Manage users and accounts" },
  { title: "Trades & Charges", icon: Receipt, href: "/admin/trades-charges", description: "Trading fees and charges" },
  { title: "Trades", icon: TrendingUp, href: "/admin/trades", description: "Trading activities monitoring" },
  { title: "Support Tickets", icon: HeadphonesIcon, href: "/admin/support", description: "Customer support management" },
  { title: "Deposits/Withdrawals", icon: CreditCard, href: "/admin/deposits-withdrawals", description: "Transaction management" },
  { title: "Payment Gateway", icon: Wallet, href: "/admin/payment-gateway", description: "Payment processing settings" }
]

const adminTopBarConfig = {
  title: "Admin Portal",
  showBalance: false,
  showNotifications: true,
  showDeposit: false,
  showUserMenu: true
}

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

const defaultEditingState = (symbol: AdminSymbolChargeRow): EditingSymbolState => ({
  commissionPerLot: symbol.commissionPerLot.toString(),
  swapLong: symbol.swapLong.toString(),
  swapShort: symbol.swapShort.toString(),
  spreadMarkup: symbol.spreadMarkup.toString(),
  marginRequirement: symbol.marginRequirement.toString(),
  status: symbol.status === "inactive" ? "inactive" : "active"
})

type LoadMode = "initial" | "refresh"

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
  const [vipCommission, setVipCommission] = useState("0")
  const [vipSpread, setVipSpread] = useState("0")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editingSymbolId, setEditingSymbolId] = useState<number | null>(null)
  const [editedSymbolValues, setEditedSymbolValues] = useState<EditingSymbolState | null>(null)

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
      const vipCommissionValue = data.brokerage?.vip?.commission ?? 0
      const vipSpreadValue = data.brokerage?.vip?.spreadMarkup ?? 0

      setStandardCommission(formatNumber(standardCommissionValue, 2))
      setStandardSpread(formatNumber(standardSpreadValue, 2))
      setVipCommission(formatNumber(vipCommissionValue, 2))
      setVipSpread(formatNumber(vipSpreadValue, 2))
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

  useEffect(() => {
    loadData("initial")
  }, [loadData])

  const stats = useMemo(() => {
    if (!symbols.length) {
      return {
        total: 0,
        active: 0,
        activeRate: 0,
        avgCommission: 0,
        avgSpread: 0
      }
    }

    const total = symbols.length
    const active = symbols.filter((symbol) => (symbol.status || "").toLowerCase() === "active").length
    const commissionSum = symbols.reduce((acc, symbol) => acc + toNumber(symbol.commissionPerLot), 0)
    const spreadSum = symbols.reduce((acc, symbol) => acc + toNumber(symbol.spreadMarkup), 0)

    return {
      total,
      active,
      activeRate: total ? (active / total) * 100 : 0,
      avgCommission: total ? commissionSum / total : 0,
      avgSpread: total ? spreadSum / total : 0
    }
  }, [symbols])

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
    const vipCommissionValue = parseInputValue(vipCommission)
    const vipSpreadValue = parseInputValue(vipSpread)
    const defaultLeverageValue = parseInputValue(demoLeverage)
    const maxLeverageValue = parseInputValue(liveLeverage)

    if (
      standardCommissionValue === null ||
      standardSpreadValue === null ||
      vipCommissionValue === null ||
      vipSpreadValue === null ||
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
      vip: {
        commission: vipCommissionValue,
        spreadMarkup: vipSpreadValue,
        commissionUnit: "per_lot",
        spreadUnit: "pips"
      }
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
      const response = await adminService.updateTradingSymbolCharges(symbolId, {
        commissionPerLot: commissionValue,
        swapLong: swapLongValue,
        swapShort: swapShortValue,
        spreadMarkup: spreadValue,
        marginRequirement: marginRequirementValue,
        status: editedSymbolValues.status
      })

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trades & Charges</h1>
            <p className="text-muted-foreground mt-2">
              Manage real trading charges, spreads, commissions, and leverage policies
            </p>
            {errorMessage ? (
              <p className="mt-2 text-sm text-destructive">{errorMessage}</p>
            ) : null}
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              className="bg-background/60 backdrop-blur-sm border-border/20"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg backdrop-blur-sm"
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
                  <TabsList className="grid w-full grid-cols-3 bg-muted/30 backdrop-blur-sm">
                    <TabsTrigger value="charges" className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4" />
                      <span>Charges</span>
                    </TabsTrigger>
                    <TabsTrigger value="brokerage" className="flex items-center space-x-2">
                      <Calculator className="h-4 w-4" />
                      <span>Brokerage</span>
                    </TabsTrigger>
                    <TabsTrigger value="leverage" className="flex items-center space-x-2">
                      <Shield className="h-4 w-4" />
                      <span>Leverage</span>
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="pt-6">
                  <TabsContent value="charges" className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-foreground flex items-center">
                          <DollarSign className="h-5 w-5 mr-2" />
                          Trading Charges
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Configure swap rates, spreads, and commissions for each symbol
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search symbols..."
                            className="pl-10 w-64 bg-background/60 backdrop-blur-sm border-border/20"
                            disabled
                          />
                        </div>
                        <Button variant="outline" size="sm" disabled>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Symbol
                        </Button>
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
                          {symbols.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                                No symbols configured yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            symbols.map((symbol) => {
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

                      <Card className="bg-background/50 border-border/20">
                        <CardHeader>
                          <CardTitle className="text-lg text-foreground">VIP Brokerage</CardTitle>
                          <p className="text-sm text-muted-foreground">Preferred rates for VIP accounts</p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="vip-commission" className="text-sm font-medium text-foreground">
                              VIP Commission (per lot)
                            </Label>
                            <Input
                              id="vip-commission"
                              value={vipCommission}
                              onChange={(event) => setVipCommission(event.target.value)}
                              className="bg-background/60 border-border/20"
                              placeholder="0.30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="vip-spread" className="text-sm font-medium text-foreground">
                              VIP Spread (pips)
                            </Label>
                            <Input
                              id="vip-spread"
                              value={vipSpread}
                              onChange={(event) => setVipSpread(event.target.value)}
                              className="bg-background/60 border-border/20"
                              placeholder="1.00"
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20">
                            <div className="flex items-center space-x-3">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-sm font-medium text-foreground">Used for VIP trading accounts</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="leverage" className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground flex items-center">
                        <Shield className="h-5 w-5 mr-2" />
                        Leverage Policies
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Set default and maximum leverage limits for newly created trading accounts
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <Card className="bg-background/50 border-border/20">
                        <CardHeader>
                          <CardTitle className="text-lg text-foreground">Default Leverage</CardTitle>
                          <p className="text-sm text-muted-foreground">Applied when new accounts are created</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="demo-leverage" className="text-sm font-medium text-foreground">
                              Default leverage ratio
                            </Label>
                            <Input
                              id="demo-leverage"
                              value={demoLeverage}
                              onChange={(event) => setDemoLeverage(event.target.value)}
                              className="bg-background/60 border-border/20"
                              placeholder="100"
                            />
                            <p className="text-xs text-muted-foreground">Displayed to users as 1:{demoLeverage || "100"}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-background/50 border-border/20">
                        <CardHeader>
                          <CardTitle className="text-lg text-foreground">Maximum Leverage</CardTitle>
                          <p className="text-sm text-muted-foreground">Upper limit enforced on account creation</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="live-leverage" className="text-sm font-medium text-foreground">
                              Maximum leverage ratio
                            </Label>
                            <Input
                              id="live-leverage"
                              value={liveLeverage}
                              onChange={(event) => setLiveLeverage(event.target.value)}
                              className="bg-background/60 border-border/20"
                              placeholder="500"
                            />
                            <p className="text-xs text-muted-foreground">Displayed to users as 1:{liveLeverage || "500"}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
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