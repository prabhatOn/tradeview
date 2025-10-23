"use client"

import { useCallback, useEffect, useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { adminSymbolService, marketService } from "@/lib/services"
import {
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Loader2,
  Power,
  PowerOff,
  AlertTriangle,
  Coins,
  TrendingUp,
} from "lucide-react"

interface SymbolRow {
  id: number
  symbol: string
  name: string
  category_id: number
  category_name: string
  base_currency: string | null
  quote_currency: string | null
  pip_size: number
  lot_size: number
  min_lot: number
  max_lot: number
  lot_step: number
  contract_size: number
  margin_requirement: number
  spread_type: 'fixed' | 'floating'
  spread_markup: number
  commission_type: 'per_lot' | 'percentage' | 'fixed'
  commission_value: number
  swap_long: number
  swap_short: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Category {
  id: number
  name: string
  description: string
}

type CreateSymbolPayload = {
  symbol: string
  name: string
  category_id: number
  base_currency?: string
  quote_currency?: string
  pip_size?: number
  lot_size?: number
  min_lot?: number
  max_lot?: number
  lot_step?: number
  contract_size?: number
  margin_requirement?: number
  spread_type?: 'fixed' | 'floating'
  spread_markup?: number
  commission_type?: 'per_lot' | 'percentage' | 'fixed'
  commission_value?: number
  swap_long?: number
  swap_short?: number
  is_active?: boolean
}

function getErrorMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error === 'object') {
    try {
      const e = error as Record<string, unknown>
      if (typeof e.message === 'string') return e.message
      if (e.response && typeof e.response === 'object') {
        const resp = e.response as Record<string, unknown>
    if (resp.data && typeof (resp.data as Record<string, unknown>).message === 'string') return (resp.data as Record<string, unknown>).message as string
      }
      return JSON.stringify(e)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

export default function SymbolManagementPage() {
  const { toast } = useToast()
  const [symbols, setSymbols] = useState<SymbolRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolRow | null>(null)
  const [formData, setFormData] = useState<Partial<CreateSymbolPayload>>({})
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      console.log('🔄 Loading symbols...', { selectedCategory, searchTerm, statusFilter })
      
      const [symbolsRes, categoriesRes] = await Promise.all([
        adminSymbolService.getAllSymbols({
          category: selectedCategory,
          search: searchTerm,
          status: statusFilter,
          limit: 100
        }),
        marketService.getCategories()
      ])

      console.log('📊 Symbols response:', symbolsRes)
      console.log('📁 Categories response:', categoriesRes)

      if (symbolsRes && symbolsRes.success && symbolsRes.data) {
        console.log('✅ Setting symbols:', symbolsRes.data.symbols?.length || 0, 'symbols')
        console.log('📦 Symbols data:', symbolsRes.data.symbols)
        setSymbols(symbolsRes.data.symbols || [])
      } else {
        console.error('❌ Failed to load symbols - Invalid response:', symbolsRes)
        toast({
          title: "Error",
          description: "Failed to load symbols - invalid response format",
          variant: "destructive"
        })
      }

      if (categoriesRes.categories) {
        console.log('✅ Setting categories:', categoriesRes.categories.length, 'categories')
        setCategories(categoriesRes.categories)
      } else if (Array.isArray(categoriesRes)) {
        console.log('✅ Setting categories (array):', categoriesRes.length, 'categories')
        setCategories(categoriesRes)
      } else {
        console.error('❌ Failed to load categories:', categoriesRes)
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      console.error('💥 Error in loadData:', msg, { error })
      toast({
        title: "Error",
        description: msg || "Failed to load symbols",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, searchTerm, statusFilter, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateSymbol = async () => {
    try {
      setSubmitting(true)
      const payload: CreateSymbolPayload = {
        symbol: String(formData.symbol || ''),
        name: String(formData.name || ''),
        category_id: Number(formData.category_id ?? categories[0]?.id ?? 1),
        base_currency: formData.base_currency ? String(formData.base_currency) : undefined,
        quote_currency: formData.quote_currency ? String(formData.quote_currency) : undefined,
        pip_size: Number(formData.pip_size ?? 0.0001),
        lot_size: Number(formData.lot_size ?? 100000),
        min_lot: Number(formData.min_lot ?? 0.01),
        max_lot: Number(formData.max_lot ?? 100),
        lot_step: Number(formData.lot_step ?? 0.01),
        contract_size: Number(formData.contract_size ?? 100000),
        margin_requirement: Number(formData.margin_requirement ?? 1.0),
        spread_type: (formData.spread_type as 'fixed' | 'floating') ?? 'floating',
        spread_markup: Number(formData.spread_markup ?? 0),
        commission_type: (formData.commission_type as CreateSymbolPayload['commission_type']) ?? 'per_lot',
        commission_value: Number(formData.commission_value ?? 0),
        swap_long: Number(formData.swap_long ?? 0),
        swap_short: Number(formData.swap_short ?? 0),
        is_active: Boolean(formData.is_active ?? true),
      }
      const res = await adminSymbolService.createSymbol(payload)
      
      if (res.success) {
        toast({
          title: "Success",
          description: "Symbol created successfully"
        })
        setShowCreateDialog(false)
        setFormData({})
        loadData()
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      toast({
        title: "Error",
        description: msg || "Failed to create symbol",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateSymbol = async () => {
    if (!selectedSymbol) return
    
    try {
      setSubmitting(true)
      const payload: CreateSymbolPayload = {
        symbol: String(formData.symbol || selectedSymbol.name || ''),
        name: String(formData.name || selectedSymbol.name || ''),
        category_id: Number(formData.category_id ?? selectedSymbol.category_id ?? categories[0]?.id ?? 1),
        base_currency: formData.base_currency ? String(formData.base_currency) : undefined,
        quote_currency: formData.quote_currency ? String(formData.quote_currency) : undefined,
        pip_size: Number(formData.pip_size ?? selectedSymbol.pip_size ?? 0),
        lot_size: Number(formData.lot_size ?? selectedSymbol.lot_size ?? 0),
        min_lot: Number(formData.min_lot ?? selectedSymbol.min_lot ?? 0),
        max_lot: Number(formData.max_lot ?? selectedSymbol.max_lot ?? 0),
        lot_step: Number(formData.lot_step ?? selectedSymbol.lot_step ?? 0),
        contract_size: Number(formData.contract_size ?? selectedSymbol.contract_size ?? 0),
        margin_requirement: Number(formData.margin_requirement ?? selectedSymbol.margin_requirement ?? 1.0),
        spread_type: (formData.spread_type as 'fixed' | 'floating') ?? (selectedSymbol.spread_type ?? 'floating'),
        spread_markup: Number(formData.spread_markup ?? selectedSymbol.spread_markup ?? 0),
  commission_type: (formData.commission_type as CreateSymbolPayload['commission_type']) ?? (selectedSymbol.commission_type as CreateSymbolPayload['commission_type']) ?? 'per_lot',
        commission_value: Number(formData.commission_value ?? selectedSymbol.commission_value ?? 0),
        swap_long: Number(formData.swap_long ?? selectedSymbol.swap_long ?? 0),
        swap_short: Number(formData.swap_short ?? selectedSymbol.swap_short ?? 0),
        is_active: Boolean(formData.is_active ?? selectedSymbol.is_active ?? true),
      }
      const res = await adminSymbolService.updateSymbol(selectedSymbol.id, payload)
      
      if (res.success) {
        toast({
          title: "Success",
          description: "Symbol updated successfully"
        })
        setShowEditDialog(false)
        setSelectedSymbol(null)
        setFormData({})
        loadData()
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      toast({
        title: "Error",
        description: msg || "Failed to update symbol",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSymbol = async () => {
    if (!selectedSymbol) return
    
    try {
      setSubmitting(true)
      const res = await adminSymbolService.deleteSymbol(selectedSymbol.id)
      
      if (res.success) {
        toast({
          title: "Success",
          description: "Symbol deactivated successfully"
        })
        setShowDeleteDialog(false)
        setSelectedSymbol(null)
        loadData()
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      toast({
        title: "Error",
        description: msg || "Failed to delete symbol",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (symbol: SymbolRow) => {
    try {
      const res = await adminSymbolService.toggleSymbolStatus(symbol.id)
      
      if (res.success) {
        toast({
          title: "Success",
          description: `Symbol ${symbol.is_active ? 'deactivated' : 'activated'} successfully`
        })
        loadData()
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      toast({
        title: "Error",
        description: msg || "Failed to toggle symbol status",
        variant: "destructive"
      })
    }
  }

  const openCreateDialog = () => {
    setFormData({
      symbol: '',
      name: '',
      category_id: categories[0]?.id || 1,
      base_currency: '',
      quote_currency: '',
      pip_size: 0.0001,
      lot_size: 100000,
      min_lot: 0.01,
      max_lot: 100,
      lot_step: 0.01,
      contract_size: 100000,
      margin_requirement: 1.0,
      spread_type: 'floating',
      spread_markup: 0,
      commission_type: 'per_lot',
      commission_value: 0,
      swap_long: 0,
      swap_short: 0,
      is_active: true
    })
    setShowCreateDialog(true)
  }

  const openEditDialog = (symbol: SymbolRow) => {
    setSelectedSymbol(symbol)
    setFormData({
      symbol: symbol.symbol,
      name: symbol.name,
      category_id: symbol.category_id,
      base_currency: symbol.base_currency || '',
      quote_currency: symbol.quote_currency || '',
      pip_size: symbol.pip_size,
      lot_size: symbol.lot_size,
      min_lot: symbol.min_lot,
      max_lot: symbol.max_lot,
      lot_step: symbol.lot_step,
      contract_size: symbol.contract_size,
      margin_requirement: symbol.margin_requirement,
      spread_type: symbol.spread_type,
      spread_markup: symbol.spread_markup,
      commission_type: symbol.commission_type,
      commission_value: symbol.commission_value,
      swap_long: symbol.swap_long,
      swap_short: symbol.swap_short,
      is_active: symbol.is_active
    })
    setShowEditDialog(true)
  }

  const openDeleteDialog = (symbol: SymbolRow) => {
    setSelectedSymbol(symbol)
    setShowDeleteDialog(true)
  }

  const filteredSymbols = symbols

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight leading-tight">Symbol Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage trading symbols and currency pairs
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <Button onClick={openCreateDialog} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Symbol
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Symbols</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{symbols.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Power className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {symbols.filter(s => s.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <PowerOff className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {symbols.filter(s => !s.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search symbols..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Symbols Table */}
        <Card>
          <CardHeader>
            <CardTitle>Symbols</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSymbols.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No symbols found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Base/Quote</TableHead>
                    <TableHead>Pip Size</TableHead>
                    <TableHead>Lot Size</TableHead>
                    <TableHead>Spread</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSymbols.map((symbol) => (
                    <TableRow key={symbol.id}>
                      <TableCell className="font-medium">{symbol.symbol}</TableCell>
                      <TableCell>{symbol.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{symbol.category_name}</Badge>
                      </TableCell>
                      <TableCell>
                        {symbol.base_currency && symbol.quote_currency
                          ? `${symbol.base_currency}/${symbol.quote_currency}`
                          : '-'}
                      </TableCell>
                      <TableCell>{symbol.pip_size}</TableCell>
                      <TableCell>{symbol.lot_size.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={symbol.spread_type === 'fixed' ? 'default' : 'secondary'}>
                          {symbol.spread_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={symbol.is_active ? 'default' : 'secondary'}>
                          {symbol.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(symbol)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(symbol)}
                          >
                            {symbol.is_active ? (
                              <PowerOff className="h-4 w-4" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(symbol)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Symbol</DialogTitle>
              <DialogDescription>
                Add a new trading symbol to the platform
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Symbol *</Label>
                  <Input
                    value={formData.symbol || ''}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    placeholder="EURUSD"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Euro vs US Dollar"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={formData.category_id?.toString() || ''}
                    onValueChange={(value) => setFormData({ ...formData, category_id: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Spread Type</Label>
                  <Select
                    value={formData.spread_type || 'floating'}
                    onValueChange={(value) => setFormData({ ...formData, spread_type: value as 'fixed' | 'floating' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="floating">Floating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Base Currency</Label>
                  <Input
                    value={formData.base_currency || ''}
                    onChange={(e) => setFormData({ ...formData, base_currency: e.target.value.toUpperCase() })}
                    placeholder="EUR"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quote Currency</Label>
                  <Input
                    value={formData.quote_currency || ''}
                    onChange={(e) => setFormData({ ...formData, quote_currency: e.target.value.toUpperCase() })}
                    placeholder="USD"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Pip Size</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    value={formData.pip_size || 0.0001}
                    onChange={(e) => setFormData({ ...formData, pip_size: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lot Size</Label>
                  <Input
                    type="number"
                    value={formData.lot_size || 100000}
                    onChange={(e) => setFormData({ ...formData, lot_size: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contract Size</Label>
                  <Input
                    type="number"
                    value={formData.contract_size || 100000}
                    onChange={(e) => setFormData({ ...formData, contract_size: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Min Lot</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.min_lot || 0.01}
                    onChange={(e) => setFormData({ ...formData, min_lot: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Lot</Label>
                  <Input
                    type="number"
                    value={formData.max_lot || 100}
                    onChange={(e) => setFormData({ ...formData, max_lot: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lot Step</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.lot_step || 0.01}
                    onChange={(e) => setFormData({ ...formData, lot_step: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Swap Long</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.swap_long || 0}
                    onChange={(e) => setFormData({ ...formData, swap_long: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Swap Short</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.swap_short || 0}
                    onChange={(e) => setFormData({ ...formData, swap_short: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleCreateSymbol} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Symbol
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Symbol</DialogTitle>
              <DialogDescription>
                Update symbol configuration
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    value={formData.symbol || ''}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pip Size</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    value={formData.pip_size || 0}
                    onChange={(e) => setFormData({ ...formData, pip_size: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Spread Type</Label>
                  <Select
                    value={formData.spread_type || 'floating'}
                    onValueChange={(value) => setFormData({ ...formData, spread_type: value as 'fixed' | 'floating' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="floating">Floating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Swap Long</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.swap_long || 0}
                    onChange={(e) => setFormData({ ...formData, swap_long: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Swap Short</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.swap_short || 0}
                    onChange={(e) => setFormData({ ...formData, swap_short: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSymbol} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Symbol
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deactivate Symbol</DialogTitle>
              <DialogDescription>
                Are you sure you want to deactivate this symbol?
              </DialogDescription>
            </DialogHeader>
            {selectedSymbol && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedSymbol.symbol}</strong> - {selectedSymbol.name}
                  <br />
                  This will deactivate the symbol but preserve all historical data.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteSymbol} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
