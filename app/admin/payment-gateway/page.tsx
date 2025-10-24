"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table" 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { adminService } from "@/lib/services"
import type { BankAccount, PaymentGateway } from "@/lib/types"
import {
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
  Trash2,
  RefreshCw,
  Settings,
  DollarSign,
  CheckCircle2,
  XCircle,
  Calendar,
  Zap,
  Building,
  MapPin,
  Loader2
} from "lucide-react"

type GatewayRow = {
  id: number;
  name: string;
  displayName: string;
  type: string;
  provider?: string | null;
  minAmount: number;
  maxAmount: number;
  processingFeeType: 'fixed' | 'percentage';
  processingFeeValue: number;
  processingTimeHours: number;
  supportedCurrencies: string[];
  description?: string | null;
  iconUrl?: string | null;
  configuration: Record<string, unknown>;
  isActive: boolean;
  status: 'active' | 'inactive' | 'maintenance';
  totalDeposits?: number;
  totalWithdrawals?: number;
  totalDepositVolume?: number;
  totalWithdrawalVolume?: number;
  updatedAt?: string;
  createdAt?: string;
};

type BankAccountRow = {
  id: number;
  label: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType?: string | null;
  currency: string;
  country?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
  routingNumber?: string | null;
  branchName?: string | null;
  branchAddress?: string | null;
  instructions?: string | null;
  currentBalance?: number;
  isActive: boolean;
  paymentGatewayId?: number | null;
  gatewayDisplayName?: string | null;
  metadata: Record<string, unknown>;
  updatedAt?: string;
  createdAt?: string;
};

type GatewayFormState = {
  name: string;
  displayName: string;
  type: string;
  provider: string;
  minAmount: string;
  maxAmount: string;
  processingFeeType: 'fixed' | 'percentage';
  processingFeeValue: string;
  processingTimeHours: string;
  supportedCurrencies: string;
  description: string;
  iconUrl: string;
  configuration: string;
  isActive: boolean;
};

type BankFormState = {
  label: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  accountType: 'personal' | 'business';
  currency: string;
  country: string;
  iban: string;
  swiftCode: string;
  routingNumber: string;
  branchName: string;
  branchAddress: string;
  instructions: string;
  metadata: string;
  paymentGatewayId: string;
  currentBalance: string;
  isActive: boolean;
};

const gatewayFormDefaults: GatewayFormState = {
  name: '',
  displayName: '',
  type: 'credit_card',
  provider: '',
  minAmount: '0',
  maxAmount: '0',
  processingFeeType: 'percentage',
  processingFeeValue: '0',
  processingTimeHours: '24',
  supportedCurrencies: 'USD',
  description: '',
  iconUrl: '',
  configuration: '{}',
  isActive: true,
};

const bankFormDefaults: BankFormState = {
  label: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  accountType: 'business',
  currency: 'USD',
  country: '',
  iban: '',
  swiftCode: '',
  routingNumber: '',
  branchName: '',
  branchAddress: '',
  instructions: '',
  metadata: '{}',
  paymentGatewayId: '',
  currentBalance: '0',
  isActive: true,
};

export default function PaymentGatewayPage() {
  const [activeTab, setActiveTab] = useState("gateways")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentGateways, setPaymentGateways] = useState<GatewayRow[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmittingGateway, setIsSubmittingGateway] = useState(false)
  const [isSubmittingBank, setIsSubmittingBank] = useState(false)
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false)
  const [bankDialogOpen, setBankDialogOpen] = useState(false)
  const [editingGateway, setEditingGateway] = useState<GatewayRow | null>(null)
  const [editingBank, setEditingBank] = useState<BankAccountRow | null>(null)
  const [gatewayForm, setGatewayForm] = useState<GatewayFormState>(gatewayFormDefaults)
  const [bankForm, setBankForm] = useState<BankFormState>(bankFormDefaults)
  const [gatewayFormErrors, setGatewayFormErrors] = useState<string[]>([])
  const { toast } = useToast()

  const parseJSON = useCallback(<T,>(value: unknown, fallback: T): T => {
    if (typeof value === "string" && value.trim() !== "") {
      try {
        return JSON.parse(value) as T
      } catch (error) {
        console.error("Failed to parse JSON value", error)
        return fallback
      }
    }
    if (typeof value === "object" && value !== null) {
      return value as T
    }
    return fallback
  }, [])

  const mapGatewayData = useCallback((gateway: PaymentGateway): GatewayRow => {
    const supportedCurrencies = Array.isArray(gateway.supportedCurrencies)
      ? gateway.supportedCurrencies
      : parseJSON<string[]>(gateway.supported_currencies, [])

    const configuration = parseJSON<Record<string, unknown>>(gateway.configuration, {})
    const isActive = Boolean(gateway.isActive ?? gateway.is_active ?? true)
    const configStatus = (configuration as { status?: unknown }).status
    const status: 'active' | 'inactive' | 'maintenance' =
      typeof configStatus === 'string' && configStatus.toLowerCase() === 'maintenance'
        ? 'maintenance'
        : isActive
          ? 'active'
          : 'inactive'

    const processingFeeType = (gateway.processingFeeType ?? gateway.processing_fee_type ?? 'percentage') as 'fixed' | 'percentage'

    return {
      id: gateway.id,
      name: gateway.name,
      displayName: gateway.displayName || gateway.display_name || gateway.name,
      type: gateway.type,
      provider: gateway.provider ?? null,
      minAmount: Number(gateway.minAmount ?? gateway.min_amount ?? 0),
      maxAmount: Number(gateway.maxAmount ?? gateway.max_amount ?? 0),
      processingFeeType,
      processingFeeValue: Number(gateway.processingFeeValue ?? gateway.processing_fee_value ?? 0),
      processingTimeHours: Number(gateway.processingTimeHours ?? gateway.processing_time_hours ?? 0),
      supportedCurrencies,
      description: gateway.description ?? null,
      iconUrl: gateway.iconUrl ?? gateway.icon_url ?? null,
      configuration,
      isActive,
      status,
      totalDeposits: gateway.total_deposits ? Number(gateway.total_deposits) : undefined,
      totalWithdrawals: gateway.total_withdrawals ? Number(gateway.total_withdrawals) : undefined,
      totalDepositVolume: gateway.total_deposit_volume ? Number(gateway.total_deposit_volume) : undefined,
      totalWithdrawalVolume: gateway.total_withdrawal_volume ? Number(gateway.total_withdrawal_volume) : undefined,
      updatedAt: gateway.updated_at,
      createdAt: gateway.created_at,
    }
  }, [parseJSON])

  const mapBankData = useCallback((account: BankAccount): BankAccountRow => {
    const metadata = parseJSON<Record<string, unknown>>(account.metadata ?? account.metadata, {})

    const currentBalance = account.currentBalance !== undefined
      ? Number(account.currentBalance)
      : account.current_balance !== undefined
        ? Number(account.current_balance)
        : undefined

    return {
      id: account.id,
      label: account.label,
      bankName: account.bankName || account.bank_name || '',
      accountName: account.accountName || account.account_name || '',
      accountNumber: account.accountNumber || account.account_number || '',
      accountType: account.accountType || account.account_type || null,
      currency: account.currency,
      country: account.country ?? '',
      iban: account.iban ?? '',
      swiftCode: account.swiftCode ?? account.swift_code ?? '',
      routingNumber: account.routingNumber ?? account.routing_number ?? '',
      branchName: account.branchName ?? account.branch_name ?? '',
      branchAddress: account.branchAddress ?? account.branch_address ?? '',
      instructions: account.instructions ?? '',
      currentBalance,
      isActive: Boolean(account.isActive ?? account.is_active ?? true),
      paymentGatewayId: account.paymentGatewayId ?? account.payment_gateway_id ?? null,
      gatewayDisplayName: account.gatewayDisplayName ?? account.gateway_display_name ?? null,
      metadata,
      updatedAt: account.updated_at,
      createdAt: account.created_at,
    }
  }, [parseJSON])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [gatewaysResponse, banksResponse] = await Promise.all([
        adminService.getPaymentGateways(),
        adminService.getBankAccounts()
      ])

      if (gatewaysResponse.success && gatewaysResponse.data) {
        setPaymentGateways(gatewaysResponse.data.map(mapGatewayData))
      }

      if (banksResponse.success && banksResponse.data) {
        setBankAccounts(banksResponse.data.map(mapBankData))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load payment configuration data'
      toast({ title: 'Error loading data', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }, [mapGatewayData, mapBankData, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalGateways = paymentGateways.length
  const activeGateways = paymentGateways.filter(gw => gw.status === 'active').length
  const totalBankAccounts = bankAccounts.length
  const activeBankAccounts = bankAccounts.filter(acc => acc.isActive).length
  const totalBalance = bankAccounts.reduce((sum, acc) => sum + (acc.currentBalance ?? 0), 0)

  const filteredGateways = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return paymentGateways.filter((gateway) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'maintenance'
            ? gateway.status === 'maintenance'
            : statusFilter === 'active'
              ? gateway.status === 'active'
              : gateway.status === 'inactive'

      if (!matchesStatus) return false

      if (search.length === 0) return true

      const haystack = [
        gateway.displayName,
        gateway.name,
        gateway.provider ?? '',
        gateway.type,
        gateway.supportedCurrencies.join(' ')
      ]

      return haystack.some((value) => value?.toLowerCase().includes(search))
    })
  }, [paymentGateways, searchTerm, statusFilter])

  const filteredBankAccounts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return bankAccounts.filter((account) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? account.isActive
            : statusFilter === 'inactive'
              ? !account.isActive
              : true

      if (!matchesStatus) return false

      if (search.length === 0) return true

      const haystack = [
        account.label,
        account.bankName,
        account.accountName,
        account.currency,
        account.country ?? '',
        account.gatewayDisplayName ?? ''
      ]

      return haystack.some((value) => value?.toLowerCase().includes(search))
    })
  }, [bankAccounts, searchTerm, statusFilter])

  const openGatewayDialog = (gateway?: GatewayRow) => {
    if (gateway) {
      setEditingGateway(gateway)
      setGatewayForm({
        name: gateway.name,
        displayName: gateway.displayName,
        type: gateway.type,
        provider: gateway.provider ?? '',
        minAmount: gateway.minAmount.toString(),
        maxAmount: gateway.maxAmount.toString(),
        processingFeeType: gateway.processingFeeType,
        processingFeeValue: gateway.processingFeeValue.toString(),
        processingTimeHours: gateway.processingTimeHours.toString(),
        supportedCurrencies: gateway.supportedCurrencies.join(', '),
        description: gateway.description ?? '',
        iconUrl: gateway.iconUrl ?? '',
        configuration: JSON.stringify(gateway.configuration, null, 2),
        isActive: gateway.isActive,
      })
    } else {
      setEditingGateway(null)
      setGatewayForm(gatewayFormDefaults)
      setGatewayFormErrors([])
    }
    setGatewayDialogOpen(true)
  }

  const closeGatewayDialog = () => {
    setGatewayDialogOpen(false)
    setEditingGateway(null)
    setGatewayForm(gatewayFormDefaults)
    setGatewayFormErrors([])
  }

  const openBankDialog = (account?: BankAccountRow) => {
    if (account) {
      setEditingBank(account)
      setBankForm({
        label: account.label,
        bankName: account.bankName,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        accountType: (account.accountType as 'personal' | 'business') ?? 'business',
        currency: account.currency,
        country: account.country ?? '',
        iban: account.iban ?? '',
        swiftCode: account.swiftCode ?? '',
        routingNumber: account.routingNumber ?? '',
        branchName: account.branchName ?? '',
        branchAddress: account.branchAddress ?? '',
        instructions: account.instructions ?? '',
        metadata: JSON.stringify(account.metadata, null, 2),
        paymentGatewayId: account.paymentGatewayId ? String(account.paymentGatewayId) : '',
        currentBalance: account.currentBalance !== undefined ? String(account.currentBalance) : '0',
        isActive: account.isActive,
      })
    } else {
      setEditingBank(null)
      setBankForm(bankFormDefaults)
    }
    setBankDialogOpen(true)
  }

  const closeBankDialog = () => {
    setBankDialogOpen(false)
    setEditingBank(null)
    setBankForm(bankFormDefaults)
  }

  const handleGatewayFormChange = (field: keyof GatewayFormState, value: string | boolean) => {
    setGatewayForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleBankFormChange = (field: keyof BankFormState, value: string | boolean) => {
    setBankForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const formatFeeDisplay = (type: 'fixed' | 'percentage', value: number) => {
    if (type === 'percentage') {
      return `${value.toFixed(2)}%`
    }
    return `$${value.toFixed(2)}`
  }

  const formatAmount = (value: number | undefined) => {
    if (value === undefined || Number.isNaN(value)) return '—'
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const formatGatewayTypeLabel = (type: string) => {
    switch (type) {
      case 'credit_card':
        return 'credit card'
      case 'debit_card':
        return 'debit card'
      case 'e_wallet':
        return 'ewallet'
      case 'bank_transfer':
        return 'bank transfer'
      case 'wire_transfer':
        return 'wire transfer'
      default:
        return type.replace(/_/g, ' ')
    }
  }

  const handleGatewaySubmit = async () => {
    if (!gatewayForm.displayName.trim()) {
      toast({ title: 'Display name is required', description: 'Please provide a display name for the gateway.', variant: 'destructive' })
      return
    }

    if (!editingGateway && !gatewayForm.name.trim()) {
      toast({ title: 'Gateway identifier is required', description: 'Please provide a unique gateway key (e.g. stripe_live).', variant: 'destructive' })
      return
    }

    let configuration: Record<string, unknown> = {}
    const rawConfig = gatewayForm.configuration.trim()
  if (rawConfig) {
      // Try strict JSON first, then attempt a tolerant sanitize pass for common JS object paste patterns
      try {
        configuration = JSON.parse(rawConfig)
      } catch (err) {
        // Attempt to transform common JS object literals into valid JSON:
        // - Remove leading `const foo =` or `let foo =` or `var foo =`
        // - Remove trailing semicolons
        // - Replace single quotes with double quotes for keys/values
        // - Remove trailing commas
        try {
          let cleaned = rawConfig
            .replace(/^\s*(?:const|let|var)\s+[\w$]+\s*=\s*/i, '')
            .replace(/;\s*$/, '')
            .trim()

          // Heuristic: if it looks like an object literal, try sanitizing common JS object styles
          if (/^\{[\s\S]*\}$/.test(cleaned)) {
            // 1) Quote unquoted keys: {key: -> {"key":
            //    Only match keys consisting of letters, numbers, _ or $ to avoid touching complex expressions
            cleaned = cleaned.replace(/([\{,\s])([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":')

            // 2) Replace single quotes around values/strings with double quotes
            cleaned = cleaned.replace(/'([^']*)'/g, '"$1"')
          }

          // Remove trailing commas before closing object/array
          cleaned = cleaned.replace(/,\s*}/g, '}')
          cleaned = cleaned.replace(/,\s*\]/g, ']')

          configuration = JSON.parse(cleaned)
          // If parsing succeeded, update the form textarea with a pretty JSON string for clarity
          setGatewayForm((prev) => ({ ...prev, configuration: JSON.stringify(configuration, null, 2) }))
        } catch (err2) {
          console.error('Configuration parse failed:', err, err2)
          const msg = 'Invalid configuration JSON. Provide valid JSON or paste only the object literal (e.g. {"headers": {"merchant_api_key": "KEY"}}).'
          toast({ title: 'Invalid configuration JSON', description: msg, variant: 'destructive' })
          setGatewayFormErrors([msg])
          return
        }
      }
    }

    const supportedCurrencies = gatewayForm.supportedCurrencies
      .split(',')
      .map((currency) => currency.trim().toUpperCase())
      .filter(Boolean)

    // Client-side validation: ensure all currency codes are 3 uppercase letters (ISO 4217)
    const invalidCurrencies = supportedCurrencies.filter(c => !/^[A-Z]{3}$/.test(c))
    if (invalidCurrencies.length > 0) {
      const msg = `The following currency codes are invalid: ${invalidCurrencies.join(', ')}. Use 3-letter codes like USD, EUR, GBP.`
      toast({ title: 'Invalid supported currencies', description: msg, variant: 'destructive' })
      setGatewayFormErrors([msg])
      return
    }

    // Clear errors if validation passed
    setGatewayFormErrors([])

    const commonPayload = {
      displayName: gatewayForm.displayName.trim(),
      provider: gatewayForm.provider.trim() || undefined,
      minAmount: Number(gatewayForm.minAmount || 0),
      maxAmount: Number(gatewayForm.maxAmount || 0),
      processingFeeType: gatewayForm.processingFeeType,
      processingFeeValue: Number(gatewayForm.processingFeeValue || 0),
      processingTimeHours: Number(gatewayForm.processingTimeHours || 0),
      supportedCurrencies,
      description: gatewayForm.description.trim() || undefined,
      iconUrl: gatewayForm.iconUrl.trim() || undefined,
      configuration,
    }

    try {
      setIsSubmittingGateway(true)

      if (editingGateway) {
        await adminService.updatePaymentGateway(editingGateway.id, {
          ...commonPayload,
          isActive: gatewayForm.isActive,
        })
        toast({ title: 'Gateway updated', description: `${gatewayForm.displayName} has been updated successfully.` })
      } else {
        await adminService.createPaymentGateway({
          name: gatewayForm.name.trim(),
          displayName: commonPayload.displayName,
          type: gatewayForm.type,
          provider: commonPayload.provider,
          minAmount: commonPayload.minAmount,
          maxAmount: commonPayload.maxAmount,
          processingFeeType: commonPayload.processingFeeType,
          processingFeeValue: commonPayload.processingFeeValue,
          processingTimeHours: commonPayload.processingTimeHours,
          supportedCurrencies: commonPayload.supportedCurrencies,
          description: commonPayload.description,
          iconUrl: commonPayload.iconUrl,
          configuration: commonPayload.configuration,
        })
        toast({ title: 'Gateway created', description: `${gatewayForm.displayName} is now available to your users.` })
      }

      closeGatewayDialog()
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save payment gateway'
      toast({ title: 'Gateway save failed', description: message, variant: 'destructive' })
    } finally {
      setIsSubmittingGateway(false)
    }
  }

  const handleBankSubmit = async () => {
    if (!bankForm.label.trim() || !bankForm.bankName.trim() || !bankForm.accountName.trim() || !bankForm.accountNumber.trim()) {
      toast({ title: 'Missing information', description: 'Label, bank name, account name, and account number are required.', variant: 'destructive' })
      return
    }

    let metadata: Record<string, unknown> = {}
    try {
      metadata = bankForm.metadata.trim() ? JSON.parse(bankForm.metadata) : {}
    } catch {
      toast({ title: 'Invalid metadata JSON', description: 'Please provide valid JSON for metadata.', variant: 'destructive' })
      return
    }

    const paymentGatewayId = bankForm.paymentGatewayId ? Number(bankForm.paymentGatewayId) : null

    const payload = {
      label: bankForm.label.trim(),
      bankName: bankForm.bankName.trim(),
      accountName: bankForm.accountName.trim(),
      accountNumber: bankForm.accountNumber.trim(),
      accountType: bankForm.accountType,
      currency: bankForm.currency.trim() || 'USD',
      country: bankForm.country.trim() || undefined,
      iban: bankForm.iban.trim() || undefined,
      swiftCode: bankForm.swiftCode.trim() || undefined,
      routingNumber: bankForm.routingNumber.trim() || undefined,
      branchName: bankForm.branchName.trim() || undefined,
      branchAddress: bankForm.branchAddress.trim() || undefined,
      instructions: bankForm.instructions.trim() || undefined,
      metadata,
      paymentGatewayId,
      currentBalance: Number(bankForm.currentBalance || 0),
      isActive: bankForm.isActive,
    }

    try {
      setIsSubmittingBank(true)

      if (editingBank) {
        await adminService.updateBankAccount(editingBank.id, payload)
        toast({ title: 'Bank account updated', description: `${bankForm.bankName} details have been updated.` })
      } else {
        await adminService.createBankAccount(payload)
        toast({ title: 'Bank account added', description: `${bankForm.bankName} is now visible to your users.` })
      }

      closeBankDialog()
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save bank account'
      toast({ title: 'Bank account save failed', description: message, variant: 'destructive' })
    } finally {
      setIsSubmittingBank(false)
    }
  }

  const handleGatewayToggle = async (gateway: GatewayRow) => {
    try {
      await adminService.togglePaymentGateway(gateway.id)
      toast({
        title: gateway.isActive ? 'Gateway deactivated' : 'Gateway activated',
        description: `${gateway.displayName} status has been updated.`
      })
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update gateway status'
      toast({ title: 'Toggle failed', description: message, variant: 'destructive' })
    }
  }

  const handleBankToggle = async (account: BankAccountRow) => {
    try {
      await adminService.toggleBankAccount(account.id)
      toast({
        title: account.isActive ? 'Bank account deactivated' : 'Bank account activated',
        description: `${account.bankName} visibility has been updated.`
      })
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update bank account status'
      toast({ title: 'Toggle failed', description: message, variant: 'destructive' })
    }
  }

  const handleGatewayDelete = async (gateway: GatewayRow) => {
    const confirmed = window.confirm(`Delete payment gateway "${gateway.displayName}"? This cannot be undone.`)
    if (!confirmed) return

    try {
      await adminService.deletePaymentGateway(gateway.id)
      toast({ title: 'Gateway deleted', description: `${gateway.displayName} has been removed.` })
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete payment gateway'
      toast({ title: 'Delete failed', description: message, variant: 'destructive' })
    }
  }

  const handleBankDelete = async (account: BankAccountRow) => {
    const confirmed = window.confirm(`Delete bank account "${account.bankName}"? This cannot be undone.`)
    if (!confirmed) return

    try {
      await adminService.deleteBankAccount(account.id)
      toast({ title: 'Bank account deleted', description: `${account.bankName} has been removed.` })
      fetchData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete bank account'
      toast({ title: 'Delete failed', description: message, variant: 'destructive' })
    }
  }

  const handleRefresh = () => {
    fetchData()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
      case 'maintenance': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      default: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'credit card': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'ewallet': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'crypto': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground leading-tight">
              Payment Gateway & Bank Accounts
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage payment gateways and bank account configurations
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto bg-background/60 backdrop-blur-sm border-border/20"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {isLoading ? "Refreshing" : "Refresh data"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto bg-background/60 backdrop-blur-sm border border-border/20"
                onClick={() => fetchData()}
                disabled={isLoading}
              >
                <Zap className="h-4 w-4 mr-2" />
                Test all gateways
              </Button>
            </div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Gateways</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalGateways}</div>
              <p className="text-xs text-muted-foreground">{activeGateways} active</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Gateways</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeGateways}</div>
              <p className="text-xs text-muted-foreground">Processing payments</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Bank Accounts</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Building className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{totalBankAccounts}</div>
              <p className="text-xs text-muted-foreground">{activeBankAccounts} active</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${formatAmount(totalBalance)}</div>
              <p className="text-xs text-muted-foreground">Across all accounts</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search gateways and banks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background/60 backdrop-blur-sm border-border/20"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-background/60 backdrop-blur-sm border-border/20">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CardHeader className="pb-0">
                <div className="-mx-6 px-6 sm:mx-0 sm:px-0">
                <div className="overflow-x-auto">
                  <TabsList className="overflow-x-auto px-2 py-1 sm:overflow-visible sm:px-0 bg-muted/30 backdrop-blur-sm">
                    <div className="inline-flex gap-2 whitespace-nowrap min-w-max sm:grid sm:grid-cols-2 sm:gap-0 sm:min-w-0">
                      <TabsTrigger value="gateways" className="flex items-center space-x-2 whitespace-nowrap px-2 py-1 text-xs sm:text-sm max-w-[34vw] sm:max-w-none truncate">
                        <Wallet className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="truncate min-w-0">Payment Gateways ({paymentGateways.length})</span>
                      </TabsTrigger>
                      <TabsTrigger value="banks" className="flex items-center space-x-2 whitespace-nowrap px-2 py-1 text-xs sm:text-sm max-w-[34vw] sm:max-w-none truncate">
                        <Building className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="truncate min-w-0">Bank Accounts ({bankAccounts.length})</span>
                      </TabsTrigger>
                    </div>
                  </TabsList>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              {/* Payment Gateways Tab */}
              <TabsContent value="gateways" className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-foreground">Payment Gateways</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage payment processing integrations
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white justify-center" onClick={() => openGatewayDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Gateway
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Gateway</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Provider</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Fees</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Limits</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Updated</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                            Loading payment gateways...
                          </TableCell>
                        </TableRow>
                      )}

                      {!isLoading && filteredGateways.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                            No payment gateways found. Try adjusting your filters or add a new gateway.
                          </TableCell>
                        </TableRow>
                      )}

                      {!isLoading && filteredGateways.map((gateway) => (
                        <TableRow key={gateway.id} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div>
                              <div className="font-semibold text-foreground">{gateway.displayName}</div>
                              <div className="text-xs text-muted-foreground">
                                {gateway.supportedCurrencies.length > 0 ? gateway.supportedCurrencies.join(", ") : "—"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium capitalize ${getTypeColor(formatGatewayTypeLabel(gateway.type))}`}>
                              <span>{formatGatewayTypeLabel(gateway.type)}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground">{gateway.provider ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{formatFeeDisplay(gateway.processingFeeType, gateway.processingFeeValue)}</div>
                              <div className="text-xs text-muted-foreground">{gateway.processingTimeHours}h processing</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>Min: ${formatAmount(gateway.minAmount)}</div>
                              <div>Max: ${formatAmount(gateway.maxAmount)}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`font-medium ${getStatusColor(gateway.status)}`}>
                              {gateway.status === 'active' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {gateway.status === 'maintenance' && <Settings className="h-3 w-3 mr-1" />}
                              {gateway.status === 'inactive' && <XCircle className="h-3 w-3 mr-1" />}
                              <span className="capitalize">{gateway.status}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{gateway.updatedAt ? new Date(gateway.updatedAt).toLocaleString() : '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={gateway.isActive}
                                onCheckedChange={() => handleGatewayToggle(gateway)}
                                aria-label={`Toggle ${gateway.displayName}`}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                                onClick={() => openGatewayDialog(gateway)}
                              >
                                <Edit className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                                onClick={() => handleGatewayDelete(gateway)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Bank Accounts Tab */}
              <TabsContent value="banks" className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-foreground">Bank Accounts</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage bank account configurations
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white justify-center" onClick={() => openBankDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Bank Account
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border/20">
                        <TableHead className="text-muted-foreground font-semibold">Bank</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Account Name</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Account Number</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Currency</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Country</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Balance</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Gateway</TableHead>
                        <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                            Loading bank accounts...
                          </TableCell>
                        </TableRow>
                      )}

                      {!isLoading && filteredBankAccounts.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                            No bank accounts found. Try adjusting your filters or add a new bank account.
                          </TableCell>
                        </TableRow>
                      )}

                      {!isLoading && filteredBankAccounts.map((account) => (
                        <TableRow key={account.id} className="hover:bg-muted/30 transition-colors border-border/20">
                          <TableCell>
                            <div>
                              <div className="font-semibold text-foreground">{account.label}</div>
                              <div className="text-xs text-muted-foreground">{account.bankName}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-foreground">{account.accountName}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-foreground">{account.accountNumber}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              {account.currency}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-foreground">{account.country || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              {(() => {
                                const value = formatAmount(account.currentBalance)
                                return value === '—' ? value : `${account.currency} ${value}`
                              })()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{account.gatewayDisplayName ?? '—'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={account.isActive}
                                onCheckedChange={() => handleBankToggle(account)}
                                aria-label={`Toggle ${account.bankName}`}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                                onClick={() => openBankDialog(account)}
                              >
                                <Edit className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                                onClick={() => handleBankDelete(account)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Gateway Dialog */}
        <Dialog open={gatewayDialogOpen} onOpenChange={(open) => (open ? setGatewayDialogOpen(true) : closeGatewayDialog())}>
          <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingGateway ? 'Edit Payment Gateway' : 'Add Payment Gateway'}</DialogTitle>
              <DialogDescription>
                Configure the payment gateway details and availability for clients.
              </DialogDescription>
            </DialogHeader>

            {gatewayFormErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <div className="font-medium mb-1">Please fix the following:</div>
                <ul className="list-disc pl-5 space-y-1">
                  {gatewayFormErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4">
              {!editingGateway && (
                <div className="grid gap-2">
                  <Label htmlFor="gateway-name">Identifier</Label>
                  <Input
                    id="gateway-name"
                    placeholder="stripe_live"
                    value={gatewayForm.name}
                    onChange={(event) => handleGatewayFormChange('name', event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Unique identifier used in API responses.</p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="gateway-display-name">Display Name</Label>
                <Input
                  id="gateway-display-name"
                  placeholder="Stripe"
                  value={gatewayForm.displayName}
                  onChange={(event) => handleGatewayFormChange('displayName', event.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="gateway-type">Type</Label>
                  <Select
                    value={gatewayForm.type}
                    onValueChange={(value) => handleGatewayFormChange('type', value)}
                  >
                    <SelectTrigger id="gateway-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit_card">Credit card</SelectItem>
                      <SelectItem value="debit_card">Debit card</SelectItem>
                      <SelectItem value="e_wallet">E-wallet</SelectItem>
                      <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                      <SelectItem value="wire_transfer">Wire transfer</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gateway-provider">Provider</Label>
                  <Input
                    id="gateway-provider"
                    placeholder="Stripe"
                    value={gatewayForm.provider}
                    onChange={(event) => handleGatewayFormChange('provider', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="gateway-min-amount">Minimum amount</Label>
                  <Input
                    id="gateway-min-amount"
                    type="number"
                    min="0"
                    value={gatewayForm.minAmount}
                    onChange={(event) => handleGatewayFormChange('minAmount', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gateway-max-amount">Maximum amount</Label>
                  <Input
                    id="gateway-max-amount"
                    type="number"
                    min="0"
                    value={gatewayForm.maxAmount}
                    onChange={(event) => handleGatewayFormChange('maxAmount', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gateway-processing-time">Processing time (hours)</Label>
                  <Input
                    id="gateway-processing-time"
                    type="number"
                    min="0"
                    value={gatewayForm.processingTimeHours}
                    onChange={(event) => handleGatewayFormChange('processingTimeHours', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Processing fee type</Label>
                  <Select
                    value={gatewayForm.processingFeeType}
                    onValueChange={(value) => handleGatewayFormChange('processingFeeType', value as GatewayFormState['processingFeeType'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fee type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gateway-processing-value">Processing fee value</Label>
                  <Input
                    id="gateway-processing-value"
                    type="number"
                    min="0"
                    value={gatewayForm.processingFeeValue}
                    onChange={(event) => handleGatewayFormChange('processingFeeValue', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="gateway-currencies">Supported currencies</Label>
                <Input
                  id="gateway-currencies"
                  placeholder="USD, EUR"
                  value={gatewayForm.supportedCurrencies}
                  onChange={(event) => handleGatewayFormChange('supportedCurrencies', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Separate currency codes with commas.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="gateway-description">Description</Label>
                <Textarea
                  id="gateway-description"
                  rows={3}
                  placeholder="Gateway description for internal reference"
                  value={gatewayForm.description}
                  onChange={(event) => handleGatewayFormChange('description', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="gateway-icon">Icon URL</Label>
                <Input
                  id="gateway-icon"
                  placeholder="https://..."
                  value={gatewayForm.iconUrl}
                  onChange={(event) => handleGatewayFormChange('iconUrl', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="gateway-configuration">Configuration (JSON)</Label>
                <Textarea
                  id="gateway-configuration"
                  rows={6}
                  value={gatewayForm.configuration}
                  onChange={(event) => handleGatewayFormChange('configuration', event.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Gateway status</p>
                  <p className="text-xs text-muted-foreground">Toggle to make the gateway available to clients.</p>
                </div>
                <Switch
                  checked={gatewayForm.isActive}
                  onCheckedChange={(value) => handleGatewayFormChange('isActive', value)}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={closeGatewayDialog} disabled={isSubmittingGateway}>
                Cancel
              </Button>
              <Button onClick={handleGatewaySubmit} disabled={isSubmittingGateway}>
                {isSubmittingGateway && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingGateway ? 'Save changes' : 'Create gateway'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bank Dialog */}
        <Dialog open={bankDialogOpen} onOpenChange={(open) => (open ? setBankDialogOpen(true) : closeBankDialog())}>
          <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
              <DialogDescription>
                Provide the bank account details that clients will use for manual transfers.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bank-label">Label</Label>
                <Input
                  id="bank-label"
                  placeholder="Corporate USD Account"
                  value={bankForm.label}
                  onChange={(event) => handleBankFormChange('label', event.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bank-name">Bank name</Label>
                  <Input
                    id="bank-name"
                    placeholder="Bank of America"
                    value={bankForm.bankName}
                    onChange={(event) => handleBankFormChange('bankName', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bank-account-name">Account holder name</Label>
                  <Input
                    id="bank-account-name"
                    placeholder="Legacy Markets LLC"
                    value={bankForm.accountName}
                    onChange={(event) => handleBankFormChange('accountName', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bank-account-number">Account number</Label>
                  <Input
                    id="bank-account-number"
                    placeholder="123456789"
                    value={bankForm.accountNumber}
                    onChange={(event) => handleBankFormChange('accountNumber', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bank-account-type">Account type</Label>
                  <Select
                    value={bankForm.accountType}
                    onValueChange={(value) => handleBankFormChange('accountType', value as BankFormState['accountType'])}
                  >
                    <SelectTrigger id="bank-account-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bank-currency">Currency</Label>
                  <Input
                    id="bank-currency"
                    placeholder="USD"
                    value={bankForm.currency}
                    onChange={(event) => handleBankFormChange('currency', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bank-country">Country</Label>
                  <Input
                    id="bank-country"
                    placeholder="United States"
                    value={bankForm.country}
                    onChange={(event) => handleBankFormChange('country', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bank-balance">Display balance</Label>
                  <Input
                    id="bank-balance"
                    type="number"
                    min="0"
                    value={bankForm.currentBalance}
                    onChange={(event) => handleBankFormChange('currentBalance', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bank-iban">IBAN</Label>
                  <Input
                    id="bank-iban"
                    placeholder="DE89 3704 0044 0532 0130 00"
                    value={bankForm.iban}
                    onChange={(event) => handleBankFormChange('iban', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bank-swift">SWIFT/BIC</Label>
                  <Input
                    id="bank-swift"
                    placeholder="BOFAUS3N"
                    value={bankForm.swiftCode}
                    onChange={(event) => handleBankFormChange('swiftCode', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="bank-routing">Routing number</Label>
                  <Input
                    id="bank-routing"
                    placeholder="026009593"
                    value={bankForm.routingNumber}
                    onChange={(event) => handleBankFormChange('routingNumber', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bank-gateway">Linked payment gateway</Label>
                  <Select
                    value={bankForm.paymentGatewayId || ''}
                    onValueChange={(value) => handleBankFormChange('paymentGatewayId', value)}
                  >
                    <SelectTrigger id="bank-gateway">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {paymentGateways.map((gateway) => (
                        <SelectItem key={gateway.id} value={String(gateway.id)}>
                          {gateway.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bank-branch-name">Branch name</Label>
                <Input
                  id="bank-branch-name"
                  placeholder="New York Corporate Branch"
                  value={bankForm.branchName}
                  onChange={(event) => handleBankFormChange('branchName', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bank-branch-address">Branch address</Label>
                <Input
                  id="bank-branch-address"
                  placeholder="123 Madison Ave, New York, NY"
                  value={bankForm.branchAddress}
                  onChange={(event) => handleBankFormChange('branchAddress', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bank-instructions">Deposit instructions</Label>
                <Textarea
                  id="bank-instructions"
                  rows={4}
                  placeholder="Provide any specific instructions for clients"
                  value={bankForm.instructions}
                  onChange={(event) => handleBankFormChange('instructions', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bank-metadata">Additional metadata (JSON)</Label>
                <Textarea
                  id="bank-metadata"
                  rows={4}
                  value={bankForm.metadata}
                  onChange={(event) => handleBankFormChange('metadata', event.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Bank account active</p>
                  <p className="text-xs text-muted-foreground">Toggle to show or hide this bank account from clients.</p>
                </div>
                <Switch
                  checked={bankForm.isActive}
                  onCheckedChange={(value) => handleBankFormChange('isActive', value)}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="ghost" onClick={closeBankDialog} disabled={isSubmittingBank}>
                Cancel
              </Button>
              <Button onClick={handleBankSubmit} disabled={isSubmittingBank}>
                {isSubmittingBank && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingBank ? 'Save changes' : 'Create bank account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}