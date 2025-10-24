"use client"

import { useState, useMemo, FC, useEffect, useCallback } from "react"
import { useAuth } from '@/hooks/use-auth'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { TradingSidebar } from '@/components/trading-sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  UserPlus,
  Users,
  DollarSign,
  EllipsisVertical,
  Loader2,
  Copy,
  Link2,
  TrendingUp,
  Target
} from "lucide-react"
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api-client'
import { IbCommissionMessageData } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ENV_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? null;

// --- TYPES ---
interface Client {
  id: string;
  clientUserId: number;
  clientName: string;
  clientEmail: string;
  clientJoined: string;
  volume: number;
  commission: number;
  commissionRate: number | null;
  commissionTier: string;
  status: string;
  totalTrades: number;
  winRate: number;
  lastTradeAt?: string | null;
}

interface CommissionHistoryEntry {
  id: number;
  commission_amount: number;
  trade_volume: number;
  currency: string;
  status: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  symbol?: string;
  side?: string;
  lot_size?: number;
  profit?: number;
}

interface IbStatistics {
  total_clients: number;
  active_clients: number;
  total_commission_earned: number;
  total_client_volume: number;
  avg_commission_rate: number;
}

interface MonthlyCommission {
  month: string;
  total_commission: number;
  commission_count: number;
}

interface IbDashboardData {
  statistics: IbStatistics;
  clients: Client[];
  commissionHistory: CommissionHistoryEntry[];
  monthlyCommissions: MonthlyCommission[];
}

interface ClientTrade {
  id: number;
  symbol: string | null;
  side: string | null;
  lot_size: number;
  open_price: number | null;
  close_price: number | null;
  profit_loss: number;
  commission: number;
  swap: number;
  opened_at: string | null;
  closed_at: string | null;
  ib_commission?: number | null;
}

interface ClientOpenPosition {
  id: number;
  symbol: string | null;
  side: string | null;
  status: string;
  lot_size: number;
  open_price: number | null;
  current_price: number | null;
  commission: number;
  swap: number;
  opened_at: string | null;
  updated_at: string | null;
  unrealized_profit: number;
  accrued_ib_commission: number;
}

interface TradesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ClientTradesResponse {
  trades: ClientTrade[];
  openPositions?: ClientOpenPosition[];
  pagination: TradesPagination;
}

interface IbStatusResponse {
  isIB: boolean;
  applicationStatus: string;
}

interface ReferralCode {
  id: number;
  code: string;
  isActive: boolean;
  usageCount: number;
  maxUsage: number | null;
  expiresAt: string | null;
  createdAt: string;
  link: string;
}

interface CreateIbClientResult {
  alreadyExists?: boolean;
  clientEmail?: string;
  clientName?: string;
}

type ReferralCodeApiDto = {
  id: number;
  code: string;
  is_active: number | boolean;
  usage_count: number | null;
  max_usage: number | null;
  expires_at: string | null;
  created_at: string;
  referralLink?: string | null;
  referral_link?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const coerceNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = coerceNumber(value, Number.NaN);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildReferralLink = (baseUrl: string | null | undefined, code: string) => {
  const normalizedBase = (baseUrl && baseUrl.length > 0 ? baseUrl : 'http://localhost:3000').replace(/\/$/, '');
  return `${normalizedBase}/register?ref=${code}`;
};

const mapReferralCode = (payload: unknown, baseUrl: string | null | undefined): ReferralCode | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const codeValue = payload.code;
  if (typeof codeValue !== 'string' || codeValue.length === 0) {
    return null;
  }

  const usageCount = coerceNumber(payload.usage_count ?? (payload as Record<string, unknown>).usageCount, 0);
  const maxUsageRaw = payload.max_usage ?? (payload as Record<string, unknown>).maxUsage;
  const maxUsage =
    typeof maxUsageRaw === 'number' ? maxUsageRaw :
    typeof maxUsageRaw === 'string' ? Number(maxUsageRaw) :
    null;
  const expiresAtRaw = payload.expires_at ?? (payload as Record<string, unknown>).expiresAt;
  const createdAtRaw = payload.created_at ?? (payload as Record<string, unknown>).createdAt ?? new Date().toISOString();
  const isActiveRaw = payload.is_active ?? (payload as Record<string, unknown>).isActive ?? true;

  return {
    id: coerceNumber(payload.id, Date.now()),
    code: codeValue,
    isActive: Boolean(isActiveRaw),
    usageCount,
    maxUsage: typeof maxUsage === 'number' && !Number.isNaN(maxUsage) ? maxUsage : null,
    expiresAt: typeof expiresAtRaw === 'string' ? expiresAtRaw : null,
    createdAt: typeof createdAtRaw === 'string' ? createdAtRaw : new Date().toISOString(),
    link: typeof payload.referralLink === 'string'
      ? payload.referralLink
      : typeof (payload as Record<string, unknown>).referral_link === 'string'
        ? (payload as Record<string, unknown>).referral_link as string
        : buildReferralLink(baseUrl, codeValue)
  };
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (!isRecord(error)) {
    return undefined;
  }
  const response = (error as Record<string, unknown>).response;
  if (!isRecord(response)) {
    return undefined;
  }
  const status = response.status;
  return typeof status === 'number' ? status : undefined;
};

const extractErrorMessage = (error: unknown, fallback = 'Unexpected error'): string => {
  if (typeof error === 'string') {
    return error;
  }
  if (isRecord(error)) {
    if (typeof error.message === 'string') {
      return error.message;
    }
    const response = error.response;
    if (isRecord(response) && typeof response.data === 'object' && response.data !== null) {
      const data = response.data as Record<string, unknown>;
      if (typeof data.message === 'string') {
        return data.message;
      }
    }
  }
  return fallback;
};

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const formatLots = (lots: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(lots);
const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'No trades yet';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No trades yet';
  }
  return date.toLocaleString();
};

const getCommissionColor = (status?: string) => {
  if (status === 'active') return 'text-emerald-600';
  if (status === 'inactive') return 'text-gray-500';
  return 'text-foreground';
};

const getTierBadgeColor = (tier?: string) => {
  const normalized = (tier || '').toLowerCase();
  if (normalized === 'platinum' || normalized === 'diamond') return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300';
  if (normalized === 'gold') return 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300';
  if (normalized === 'silver') return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-900/30 dark:text-gray-300';
  if (normalized === 'bronze') return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300';
  return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300';
};


// --- REUSABLE ROW COMPONENTS ---
const ClientRow: FC<{ client: Client; onViewDetails: (client: Client) => void }> = ({ client, onViewDetails }) => {
  const { toast } = useToast();

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4 transition-colors duration-200 hover:bg-muted/20">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Users size={20} className="text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{client.clientName}</h3>
          <p className="text-sm text-muted-foreground">{client.clientEmail} • Joined: {new Date(client.clientJoined).toLocaleDateString()}</p>
          <p className="text-xs text-muted-foreground">
            {client.lastTradeAt ? `Last trade: ${formatDateTime(client.lastTradeAt)}` : 'No trades yet'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Volume (lots)</p>
          <p className="font-medium">{formatLots(client.volume)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Commission</p>
          <p className={`font-medium ${getCommissionColor(client.status)}`}>{formatCurrency(client.commission)}</p>
        </div>
        <div className="hidden text-right lg:block">
          <p className="text-xs text-muted-foreground">Trades</p>
          <p className="font-medium">{client.totalTrades}</p>
        </div>
        <div className="hidden text-right lg:block">
          <p className="text-xs text-muted-foreground">Win Rate</p>
          <p className="font-medium">{client.winRate}%</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${getTierBadgeColor(client.commissionTier)}`}>{client.commissionTier}</Badge>
          <Badge variant={client.status === 'active' ? 'secondary' : 'destructive'} className="text-xs capitalize">{client.status}</Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <EllipsisVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetails(client)}>View Details</DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-500"
              onClick={() => toast({ title: 'Remove Client', description: `Removing ${client.clientName}` })}
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="hidden xl:flex" onClick={() => onViewDetails(client)}>
          View details
        </Button>
      </div>
    </div>
  );
};

const CommissionHistoryRow: FC<{ entry: CommissionHistoryEntry }> = ({ entry }) => {
  const isPaid = entry.status === 'paid';
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4 transition-colors duration-200 hover:bg-muted/20">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <DollarSign size={20} className={isPaid ? "text-emerald-500" : "text-amber-500"} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{entry.first_name} {entry.last_name}</h3>
          <p className="text-sm text-muted-foreground">
            Volume: {formatCurrency(entry.trade_volume)} •
            Rate: {(entry.commission_amount / entry.trade_volume * 100).toFixed(2)}% •
            Date: {new Date(entry.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Commission Earned</p>
          <p className={`font-medium ${isPaid ? 'text-emerald-500' : 'text-amber-500'}`}>{formatCurrency(entry.commission_amount)}</p>
        </div>
        <Badge variant={isPaid ? 'secondary' : 'outline'} className={`w-20 justify-center text-xs capitalize ${!isPaid ? 'border-amber-500/50 bg-amber-500/10 text-amber-500' : ''}`}>{entry.status}</Badge>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function IntroducingBrokerPageV2() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false);
  const [activeTab, setActiveTab] = useState<'clients' | 'history'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<IbDashboardData | null>(null);
  const [ibStatus, setIbStatus] = useState<{ isIB: boolean; applicationStatus: string } | null>(null);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: true
  });
  const [commissionRate, setCommissionRate] = useState('0.0070');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [isGeneratingReferral, setIsGeneratingReferral] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<number | null>(null);
  const [appOrigin, setAppOrigin] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [clientTrades, setClientTrades] = useState<ClientTrade[]>([]);
  const [clientOpenPositions, setClientOpenPositions] = useState<ClientOpenPosition[]>([]);
  const [clientTradesLoading, setClientTradesLoading] = useState(false);
  const [clientTradesError, setClientTradesError] = useState<string | null>(null);
  const [clientTradesPagination, setClientTradesPagination] = useState<TradesPagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const referralBaseUrl = useMemo(() => {
    if (ENV_APP_URL && ENV_APP_URL.length > 0) {
      return ENV_APP_URL;
    }
    if (appOrigin && appOrigin.length > 0) {
      return appOrigin;
    }
    return 'http://localhost:3000';
  }, [appOrigin]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (copiedCodeId === null) {
      return;
    }
    const timeout = window.setTimeout(() => setCopiedCodeId(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [copiedCodeId]);

  const loadReferralCodes = useCallback(async (isIb: boolean) => {
    if (!isIb) {
      setReferralCodes([]);
      return;
    }
    setReferralLoading(true);
    try {
      const response = await apiClient.get<ReferralCodeApiDto[]>('/introducing-broker/referral-codes');
      if (response.success && Array.isArray(response.data)) {
        const parsed = response.data
          .map(item => mapReferralCode(item, referralBaseUrl))
          .filter((item): item is ReferralCode => item !== null);
        setReferralCodes(parsed);
      } else {
        setReferralCodes([]);
      }
    } catch (error) {
      if (getErrorStatus(error) !== 403) {
        const message = extractErrorMessage(error, 'Failed to load referral codes');
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    } finally {
      setReferralLoading(false);
    }
  }, [toast, referralBaseUrl]);

  const handleGenerateReferralCode = async () => {
    setIsGeneratingReferral(true);
    try {
      const response = await apiClient.post<ReferralCodeApiDto>('/introducing-broker/referral-codes');
      if (response.success && response.data) {
        const mapped = mapReferralCode(response.data, referralBaseUrl);
        if (mapped) {
          setReferralCodes(prev => [mapped, ...prev]);
          await loadReferralCodes(true);
          toast({ title: 'Referral link ready', description: 'Share this link to onboard new clients.' });
        }
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to generate referral code');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsGeneratingReferral(false);
    }
  };

  const handleToggleReferralCode = async (code: ReferralCode) => {
    try {
      const endpoint = `/introducing-broker/referral-codes/${code.id}/toggle`;
      const response = await apiClient.patch<{ success: boolean; message?: string }>(endpoint);
      if (response.success) {
        setReferralCodes(prev => prev.map(item => (
          item.id === code.id ? { ...item, isActive: !item.isActive } : item
        )));
        toast({
          title: 'Updated',
          description: code.isActive ? 'Referral code deactivated.' : 'Referral code activated.',
        });
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to update referral code status');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleCopyReferralLink = async (code: ReferralCode) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code.link);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code.link;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedCodeId(code.id);
      toast({ title: 'Copied', description: 'Referral link copied to clipboard.' });
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to copy referral link');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const resetClientDetails = () => {
    setClientTrades([]);
    setClientOpenPositions([]);
    setClientTradesPagination({ page: 1, limit: 20, total: 0, totalPages: 1 });
    setClientTradesError(null);
  };

  const fetchClientTrades = useCallback(async (client: Client, page = 1) => {
    if (!client.clientUserId || Number.isNaN(client.clientUserId)) {
      setClientTradesError('Client identifier is missing.');
      return;
    }

    setClientTradesLoading(true);
    setClientTradesError(null);

    try {
      const response = await apiClient.get<ClientTradesResponse>(
        `/introducing-broker/clients/${client.clientUserId}/trades`,
        { page, limit: clientTradesPagination.limit }
      );

      if (response.success && response.data) {
        const trades = Array.isArray(response.data.trades) ? response.data.trades : [];
        const sanitizedTrades: ClientTrade[] = trades.map((trade) => ({
          id: typeof trade.id === 'number' ? trade.id : Number(trade.id ?? 0),
          symbol: typeof trade.symbol === 'string' ? trade.symbol : null,
          side: typeof trade.side === 'string' ? trade.side : null,
          lot_size: coerceNumber(trade.lot_size, 0),
          open_price: parseOptionalNumber(trade.open_price),
          close_price: parseOptionalNumber(trade.close_price),
          profit_loss: coerceNumber(trade.profit_loss, 0),
          commission: coerceNumber(trade.commission, 0),
          swap: coerceNumber(trade.swap, 0),
          opened_at: typeof trade.opened_at === 'string' ? trade.opened_at : null,
          closed_at: typeof trade.closed_at === 'string' ? trade.closed_at : null,
          ib_commission: trade.ib_commission == null ? null : coerceNumber(trade.ib_commission, 0),
        }));
        setClientTrades(sanitizedTrades);
        const openPositions = Array.isArray(response.data.openPositions) ? response.data.openPositions : [];
        setClientOpenPositions(openPositions.map((position) => ({
          id: position.id,
          symbol: typeof position.symbol === 'string' ? position.symbol : null,
          side: typeof position.side === 'string' ? position.side : null,
          status: typeof position.status === 'string' ? position.status : 'open',
          lot_size: coerceNumber(position.lot_size, 0),
          open_price: parseOptionalNumber(position.open_price),
          current_price: parseOptionalNumber(position.current_price),
          commission: coerceNumber(position.commission, 0),
          swap: coerceNumber(position.swap, 0),
          opened_at: typeof position.opened_at === 'string' ? position.opened_at : null,
          updated_at: typeof position.updated_at === 'string' ? position.updated_at : null,
          unrealized_profit: coerceNumber(position.unrealized_profit, 0),
          accrued_ib_commission: coerceNumber(position.accrued_ib_commission, 0),
        })));
        setClientTradesPagination(prev => {
          if (response.data?.pagination) {
            return response.data.pagination;
          }

          const nextLimit = prev.limit > 0 ? prev.limit : 20;
          return {
            page,
            limit: nextLimit,
            total: trades.length,
            totalPages: Math.max(Math.ceil(trades.length / nextLimit), 1),
          };
        });
      } else {
        const message = extractErrorMessage(response, 'Unable to load client trades');
        setClientTradesError(message);
        setClientTrades([]);
        setClientOpenPositions([]);
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to load client trades');
      setClientTradesError(message);
      setClientTrades([]);
      setClientOpenPositions([]);
    } finally {
      setClientTradesLoading(false);
    }
  }, [clientTradesPagination.limit]);

  const handleViewClientDetails = (client: Client) => {
    setSelectedClient(client);
    setIsClientDialogOpen(true);
    resetClientDetails();
    void fetchClientTrades(client, 1);
  };

  const handleClientDialogOpenChange = (isOpen: boolean) => {
    setIsClientDialogOpen(isOpen);
    if (!isOpen) {
      setSelectedClient(null);
      resetClientDetails();
    }
  };

  const handleClientTradesPageChange = (page: number) => {
    if (!selectedClient) return;
    setClientTradesPagination(prev => ({ ...prev, page }));
    void fetchClientTrades(selectedClient, page);
  };

  const fetchIbData = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusResp = await apiClient.get<IbStatusResponse>('/introducing-broker/status');
      if (statusResp.success && statusResp.data) {
        const statusData = statusResp.data;
        setIbStatus(statusData);
        await loadReferralCodes(statusData.isIB);

        if (!statusData.isIB) {
          setDashboardData(null);
          return;
        }
      } else {
        setIbStatus(null);
        setDashboardData(null);
        setReferralCodes([]);
        toast({
          title: "Error",
          description: 'Failed to resolve IB status',
          variant: 'destructive'
        });
        return;
      }

      const response = await apiClient.get<IbDashboardData>('/introducing-broker/dashboard');
      if (response.success && response.data) {
        setDashboardData(response.data);
      } else {
        setDashboardData(null);
        const message = extractErrorMessage(response, 'Failed to load IB data');
        toast({
          title: "Error",
          description: message,
          variant: "destructive"
        });
      }
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 403) {
        setDashboardData(null);
        setReferralCodes([]);
        return;
      }
      const message = extractErrorMessage(error, 'Failed to load IB data');
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [loadReferralCodes, toast]);

  useEffect(() => {
    void fetchIbData();
  }, [fetchIbData]);

  useEffect(() => {
    const handleIbCommission = (event: Event) => {
      const detail = (event as CustomEvent<IbCommissionMessageData>).detail;
      if (!detail) return;

      void fetchIbData();

      if (selectedClient && detail.clientUserId === selectedClient.clientUserId) {
        void fetchClientTrades(selectedClient, clientTradesPagination.page);
      }
    };

    window.addEventListener('ibCommissionRecorded', handleIbCommission);

    return () => {
      window.removeEventListener('ibCommissionRecorded', handleIbCommission);
    };
  }, [clientTradesPagination.page, fetchClientTrades, fetchIbData, selectedClient]);

  const handleAddClient = async () => {
    if (!newClientData.firstName.trim() || !newClientData.lastName.trim() || !newClientData.email.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (newClientData.password !== newClientData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (newClientData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    if (user?.email && newClientData.email.trim().toLowerCase() === user.email.toLowerCase()) {
      toast({
        title: "Error",
        description: "You cannot add yourself as a client",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);

      try {
        await apiClient.post('/auth/register', {
          email: newClientData.email.trim(),
          password: newClientData.password,
          firstName: newClientData.firstName.trim(),
          lastName: newClientData.lastName.trim(),
          phone: newClientData.phone?.trim() || undefined,
          acceptTerms: true
        });
      } catch (regErr: unknown) {
        console.warn('Client registration step skipped/failed:', regErr);
      }

      const ibResponse = await apiClient.post<CreateIbClientResult>('/introducing-broker/clients', {
        clientEmail: newClientData.email.trim(),
        commissionRate: parseFloat(commissionRate)
      });

      if (ibResponse.success) {
        const alreadyExists = ibResponse.data?.alreadyExists ?? false;
        const message = alreadyExists
          ? "Client is already in your IB program"
          : "Client added to IB program successfully";
        toast({ title: "Success", description: message });
        setIsAddClientOpen(false);
        setNewClientData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
          acceptTerms: true
        });
        setCommissionRate('0.0070');
        void fetchIbData();
      } else {
        toast({
          title: "Error",
          description: ibResponse.message || "Failed to add client to IB program",
          variant: "destructive"
        });
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error, 'Failed to add client');
      if (errorMessage.includes('IB relationship already exists for this client')) {
        toast({ title: "Success", description: "Client is already in your IB program" });
        setIsAddClientOpen(false);
        setNewClientData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
          acceptTerms: true
        });
        setCommissionRate('0.0070');
        void fetchIbData();
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyForIb = useCallback(async () => {
    if (isApplying) return;
    setIsApplying(true);
    try {
      const response = await apiClient.post('/introducing-broker/apply');
      if (response.success) {
        toast({
          title: 'Application submitted',
          description: 'We\'ll notify you once an admin reviews your IB request.',
        });
        await fetchIbData();
      } else {
        const message = extractErrorMessage(response, 'Unable to submit IB application');
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to submit IB application');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsApplying(false);
    }
  }, [fetchIbData, isApplying, toast]);

  const filteredClients = useMemo(() => (
    dashboardData?.clients?.filter(client => {
      const matchesSearch = client.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
      return matchesSearch && matchesStatus;
    }) || []
  ), [dashboardData?.clients, searchQuery, filterStatus]);

  const filteredHistory = useMemo(() => (
    dashboardData?.commissionHistory?.filter(entry =>
      `${entry.first_name} ${entry.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.email.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []
  ), [dashboardData?.commissionHistory, searchQuery]);

  const openPositionsSummary = useMemo(() => {
    if (clientOpenPositions.length === 0) {
      return { count: 0, totalLots: 0, totalUnrealized: 0, totalAccruedCommission: 0 };
    }
    return clientOpenPositions.reduce((acc, position) => {
      const lots = coerceNumber(position.lot_size, 0);
      const unrealized = coerceNumber(position.unrealized_profit, 0);
      const accrued = coerceNumber(position.accrued_ib_commission, 0);
      return {
        count: acc.count + 1,
        totalLots: acc.totalLots + lots,
        totalUnrealized: acc.totalUnrealized + unrealized,
        totalAccruedCommission: acc.totalAccruedCommission + accrued
      };
    }, { count: 0, totalLots: 0, totalUnrealized: 0, totalAccruedCommission: 0 });
  }, [clientOpenPositions]);

  const clientPerformanceStats = useMemo(() => {
    if (!selectedClient) {
      return null;
    }

    const baseVolume = coerceNumber(selectedClient.volume, 0);
    const baseCommission = coerceNumber(selectedClient.commission, 0);
    const baseTrades = Number(selectedClient.totalTrades ?? 0);
    const baseWinRate = Number(selectedClient.winRate ?? 0);
    const baseCommissionRate = selectedClient.commissionRate ?? null;

    const closedVolume = clientTrades.reduce((sum, trade) => sum + Math.abs(coerceNumber(trade.lot_size, 0)), 0);
    const openVolume = clientOpenPositions.reduce((sum, position) => sum + Math.abs(coerceNumber(position.lot_size, 0)), 0);
    const derivedVolume = closedVolume + openVolume;
    const totalVolumeLots = Math.max(baseVolume, derivedVolume);

    const closedCommission = clientTrades.reduce((sum, trade) => {
      const ibCommission = trade.ib_commission != null ? coerceNumber(trade.ib_commission, 0) : 0;
      return sum + Math.max(ibCommission, 0);
    }, 0);
    const derivedCommission = closedCommission + openPositionsSummary.totalAccruedCommission;
    const totalCommissionAmount = Math.max(baseCommission, derivedCommission);

    const tradesFromPagination = Number(clientTradesPagination.total ?? clientTrades.length ?? 0);
    const totalTrades = Math.max(baseTrades, tradesFromPagination);

    const winSamples = clientTrades.length > 0 ? clientTrades.length : 0;
    const wins = winSamples > 0
      ? clientTrades.filter((trade) => coerceNumber(trade.profit_loss, 0) > 0).length
      : 0;
    const derivedWinRate = winSamples > 0 ? Math.round((wins / winSamples) * 100) : baseWinRate;
    const winRate = winSamples > 0 ? derivedWinRate : baseWinRate;

    const averageTradeLots = winSamples > 0 && closedVolume > 0
      ? closedVolume / winSamples
      : (totalTrades > 0 && totalVolumeLots > 0 ? totalVolumeLots / totalTrades : 0);

    const activityCandidates = [selectedClient.lastTradeAt]
      .concat(clientTrades.map((trade) => trade.closed_at ?? trade.opened_at ?? null))
      .concat(clientOpenPositions.map((position) => position.updated_at ?? position.opened_at ?? null))
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    const latestTimestamp = activityCandidates.reduce((max, value) => {
      const timestamp = new Date(value).getTime();
      if (!Number.isFinite(timestamp)) {
        return max;
      }
      return Math.max(max, timestamp);
    }, Number.NEGATIVE_INFINITY);

    const lastActivity = Number.isFinite(latestTimestamp) && latestTimestamp > 0
      ? new Date(latestTimestamp).toISOString()
      : selectedClient.lastTradeAt ?? null;

    const commissionRate = baseCommissionRate ?? (totalVolumeLots > 0 ? totalCommissionAmount / totalVolumeLots : null);

    return {
      totalVolumeLots,
      totalCommissionAmount,
      totalTrades,
      winRate,
      averageTradeLots,
      commissionRate,
      lastActivity
    };
  }, [selectedClient, clientTrades, clientOpenPositions, openPositionsSummary, clientTradesPagination.total]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading Introducing Broker dashboard…</p>
        </div>
      </div>
    );
  }

  if (!ibStatus?.isIB) {
    const applicationStatus = ibStatus?.applicationStatus ?? 'not_applied';
    const statusCopy = {
      not_applied: {
        label: 'Not applied',
        description: 'Unlock enhanced earnings by referring traders to the platform.',
        helper: 'Submit an application to join the Introducing Broker program. Our team will review it shortly.',
        badgeVariant: 'outline' as const,
      },
      pending: {
        label: 'Pending review',
        description: 'Your application is currently awaiting review.',
        helper: 'We will notify you via email and in-app notifications once a decision has been made.',
        badgeVariant: 'secondary' as const,
      },
      approved: {
        label: 'Approved',
        description: 'Your application has been approved. Access will be enabled shortly.',
        helper: 'If you still see this screen, please refresh or contact support for assistance.',
        badgeVariant: 'secondary' as const,
      },
      rejected: {
        label: 'Rejected',
        description: 'Your previous application was not approved.',
        helper: 'You can update your profile details and apply again for reconsideration.',
        badgeVariant: 'destructive' as const,
      },
    } satisfies Record<string, {
      label: string;
      description: string;
      helper: string;
      badgeVariant: 'outline' | 'secondary' | 'destructive';
    }>;

    const statusMeta = statusCopy[applicationStatus] ?? statusCopy.not_applied;
    const canApply = applicationStatus === 'not_applied' || applicationStatus === 'rejected';

    return (
      <div className="flex min-h-screen bg-muted/20">
        <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        <Toaster />
        <div className={`flex flex-1 items-center justify-center transition-all duration-300 ${
          sidebarCollapsed ? "sm:pl-20 pl-4 pr-4 sm:pr-6" : "sm:pl-68 pl-4 pr-4 sm:pr-6"
        } py-10 sm:px-6 lg:px-12`}>
          <Card className="w-full max-w-xl border border-border/60 bg-card/90 shadow-xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-semibold text-foreground">Introducing Broker Program</CardTitle>
              <CardDescription>{statusMeta.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Application status</p>
                  <p className="text-lg font-semibold text-foreground capitalize">{statusMeta.label}</p>
                </div>
                <Badge variant={statusMeta.badgeVariant} className="capitalize">
                  {statusMeta.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{statusMeta.helper}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => void handleApplyForIb()}
                  disabled={!canApply || isApplying}
                  className="min-w-[180px]"
                >
                  {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {canApply ? 'Apply for IB access' : 'Application in review'}
                </Button>
                <Button variant="outline" onClick={() => window.location.assign('/profile')}>
                  Update profile
                </Button>
              </div>
              <Alert>
                <AlertDescription>
                  Need help? Contact support or your account manager for expedited review.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <Toaster />
      <div className={`flex-1 transition-all duration-300 ${
        sidebarCollapsed ? "sm:pl-20 pl-4 pr-4 sm:pr-6" : "sm:pl-68 pl-4 pr-4 sm:pr-6"
      }`}>
        <main className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-10 sm:px-6 lg:px-12 pb-28 sm:pb-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="w-full text-center sm:text-left">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Introducing Broker Portal</h1>
              <p className="text-muted-foreground">Monitor your clients, commissions, and referral performance in real time.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => void fetchIbData()}>
                Refresh
              </Button>
              <Button onClick={() => setIsAddClientOpen(true)}>
                <UserPlus size={16} className="mr-2" />
                Add Client
              </Button>
            </div>
          </div>

          <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="bg-card/80">
              <CardHeader>
                <CardTitle>Total Clients</CardTitle>
                <CardDescription>All clients connected to your IB code</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold text-foreground">{dashboardData?.statistics.total_clients ?? 0}</span>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80">
              <CardHeader>
                <CardTitle>Active Clients</CardTitle>
                <CardDescription>Clients trading in the past 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold text-emerald-500">{dashboardData?.statistics.active_clients ?? 0}</span>
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80">
              <CardHeader>
                <CardTitle>Total Commission</CardTitle>
                <CardDescription>Lifetime earnings from your clients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold text-foreground">{formatCurrency(dashboardData?.statistics.total_commission_earned ?? 0)}</span>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/80">
              <CardHeader>
                <CardTitle>Average Commission Rate</CardTitle>
                <CardDescription>Across all assigned clients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold text-foreground">{((dashboardData?.statistics.avg_commission_rate ?? 0) * 100).toFixed(2)}%</span>
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">Client Management</h2>
                <p className="text-sm text-muted-foreground">Search, filter, and monitor the performance of your referrals.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  placeholder="Search by name or email"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56"
                />
                <Select value={filterStatus} onValueChange={(value: 'all' | 'active' | 'inactive') => setFilterStatus(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'clients' | 'history')} className="mt-6">
              <TabsList className="grid w-full grid-cols-2 bg-muted/40">
                <TabsTrigger value="clients">Clients</TabsTrigger>
                <TabsTrigger value="history">Commission History</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-6 space-y-6">
              {activeTab === 'clients' ? (
                filteredClients.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center text-sm text-muted-foreground">
                    No clients found. Invite traders using your referral link below.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredClients.map((client) => (
                      <ClientRow key={client.id} client={client} onViewDetails={handleViewClientDetails} />
                    ))}
                  </div>
                )
              ) : (
                filteredHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center text-sm text-muted-foreground">
                    Commission history will appear once your clients start trading.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredHistory.map(entry => (
                      <CommissionHistoryRow key={entry.id} entry={entry} />
                    ))}
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Referral Links</h2>
                <p className="text-sm text-muted-foreground">Share unique codes and track usage for each campaign.</p>
              </div>
              <Button onClick={handleGenerateReferralCode} disabled={isGeneratingReferral || referralLoading}>
                {isGeneratingReferral ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Generate Link
              </Button>
            </div>

            <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {referralCodes.length === 0 && !referralLoading ? (
                <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-border/60 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                  No referral codes yet. Generate your first link to start onboarding clients.
                </div>
              ) : referralCodes.map((code) => (
                <Card key={code.id} className="border-border/70 bg-background/90">
                  <CardHeader className="flex flex-wrap items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">{code.code}</CardTitle>
                      <CardDescription>
                        Created {new Date(code.createdAt).toLocaleDateString()} · Usage {code.usageCount}{code.maxUsage ? ` / ${code.maxUsage}` : ''}
                      </CardDescription>
                    </div>
                    <Badge variant={code.isActive ? 'secondary' : 'outline'} className="text-xs capitalize">
                      {code.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-sm">
                      <p className="break-all font-mono text-xs text-muted-foreground">{code.link}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopyReferralLink(code)}>
                        <Copy className="mr-2 h-4 w-4" />
                        {copiedCodeId === code.id ? 'Copied!' : 'Copy'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleReferralCode(code)}>
                        {code.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Dialog open={isClientDialogOpen} onOpenChange={handleClientDialogOpenChange}>
            <DialogContent className="w-[96vw] max-w-5xl border border-border/60 bg-background/95 p-0 shadow-2xl sm:w-[92vw] sm:rounded-3xl">
              {selectedClient ? (
                <div className="max-h-[80vh] space-y-6 overflow-y-auto p-6">
                  <DialogHeader className="border-b border-border/40 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <DialogTitle className="text-2xl font-semibold tracking-tight">
                          {selectedClient.clientName}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                          {selectedClient.clientEmail} • Joined {selectedClient.clientJoined}
                        </DialogDescription>
                      </div>
                      <div className="flex flex-col items-end text-right text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">Tier</span>
                        <span className="text-base font-semibold text-foreground">{selectedClient.commissionTier}</span>
                        <span className="text-xs capitalize">Status: {selectedClient.status}</span>
                      </div>
                    </div>
                  </DialogHeader>

                  {(() => {
                    const fallbackStats = {
                      totalVolumeLots: coerceNumber(selectedClient.volume, 0),
                      totalCommissionAmount: coerceNumber(selectedClient.commission, 0),
                      totalTrades: Number(selectedClient.totalTrades ?? 0),
                      winRate: Number(selectedClient.winRate ?? 0),
                      averageTradeLots: selectedClient.totalTrades > 0
                        ? coerceNumber(selectedClient.volume, 0) / selectedClient.totalTrades
                        : 0,
                      commissionRate: selectedClient.commissionRate ?? null,
                      lastActivity: selectedClient.lastTradeAt ?? null
                    };
                    const stats = clientPerformanceStats ?? fallbackStats;
                    const commissionRateDisplay = stats.commissionRate != null
                      ? `${(stats.commissionRate * 100).toFixed(2)}%`
                      : 'Not set';
                    const safeWinRate = Number.isFinite(stats.winRate) ? Math.max(0, Math.round(stats.winRate)) : 0;
                    const averageLotsDisplay = Number.isFinite(stats.averageTradeLots)
                      ? formatLots(stats.averageTradeLots)
                      : formatLots(0);
                    const headlineStats = [
                      { label: 'Total Volume (Lots)', value: formatLots(stats.totalVolumeLots) },
                      { label: 'Total Commission', value: formatCurrency(stats.totalCommissionAmount) },
                      { label: 'Trades', value: stats.totalTrades.toString() },
                      { label: 'Win Rate', value: `${safeWinRate}%` }
                    ];
                    const detailStats = [
                      { label: 'Commission Rate', value: commissionRateDisplay },
                      { label: 'Average Trade Volume', value: `${averageLotsDisplay} lots` },
                      { label: 'Last Activity', value: formatDateTime(stats.lastActivity) },
                      { label: 'Live Exposure', value: `${formatLots(openPositionsSummary.totalLots)} lots active` }
                    ];

                    return (
                      <>
                        <div className="flex flex-wrap gap-4">
                          {headlineStats.map((stat) => (
                            <div
                              key={stat.label}
                              className="flex min-w-[200px] flex-1 flex-col rounded-xl border border-border/50 bg-muted/10 p-4 shadow-sm"
                            >
                              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                {stat.label}
                              </p>
                              <p className="mt-2 text-xl font-semibold text-foreground">
                                {stat.value}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-4">
                          {detailStats.map((stat) => (
                            <div
                              key={stat.label}
                              className="flex min-w-[220px] flex-1 flex-col rounded-lg border border-border/40 bg-background/80 p-4"
                            >
                              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                                {stat.label}
                              </p>
                              <p className="mt-2 text-lg font-medium text-foreground">
                                {stat.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}

                  <div className="space-y-6">
                    <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background/95 to-background/80 shadow-xl">
                      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 px-6 py-5">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Active Positions</h3>
                          <p className="text-xs text-muted-foreground">
                            Monitor live exposure, unrealized profit, and accrued commissions in real time.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 font-medium text-foreground">
                            {openPositionsSummary.count} open
                          </span>
                          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 font-medium text-foreground">
                            {formatLots(openPositionsSummary.totalLots)} lots
                          </span>
                          <span className={`rounded-full border border-border/60 px-3 py-1 font-medium ${openPositionsSummary.totalUnrealized > 0 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : openPositionsSummary.totalUnrealized < 0 ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'text-muted-foreground bg-background/60'}`}>
                            Unrealized P/L {formatCurrency(openPositionsSummary.totalUnrealized)}
                          </span>
                        </div>
                      </header>

                      {clientTradesLoading ? (
                        <div className="flex items-center justify-center px-6 py-12 text-sm text-muted-foreground">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading positions...
                        </div>
                      ) : clientOpenPositions.length === 0 ? (
                        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                          <div className="mx-auto w-fit rounded-full border border-dashed border-border/60 bg-muted/20 px-4 py-2 text-xs uppercase tracking-[0.18em]">
                            No active positions
                          </div>
                          <p className="mt-4 text-base font-medium text-foreground">This client does not have any current exposure.</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            As soon as positions open, you will see running profit and commission progress here.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-4 border-b border-border/50 px-6 py-6 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
                              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Active Positions</p>
                              <p className="mt-3 text-2xl font-semibold text-foreground">{openPositionsSummary.count}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
                              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total Lots</p>
                              <p className="mt-3 text-2xl font-semibold text-foreground">{formatLots(openPositionsSummary.totalLots)}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
                              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Accrued IB Commission</p>
                              <p className="mt-3 text-2xl font-semibold text-foreground">{formatCurrency(openPositionsSummary.totalAccruedCommission)}</p>
                            </div>
                            <div className="rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
                              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Unrealized Profit</p>
                              <p className={`mt-3 text-2xl font-semibold ${openPositionsSummary.totalUnrealized > 0 ? 'text-emerald-500' : openPositionsSummary.totalUnrealized < 0 ? 'text-red-500' : 'text-foreground'}`}>
                                {formatCurrency(openPositionsSummary.totalUnrealized)}
                              </p>
                            </div>
                          </div>

                          <div className="overflow-x-auto px-2 pb-6">
                            <div className="rounded-2xl border border-border/60 bg-background/95 shadow-sm">
                              <table className="w-full min-w-[760px] text-sm">
                                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                  <tr>
                                    <th className="px-5 py-3 text-left">Opened</th>
                                    <th className="px-5 py-3 text-left">Symbol</th>
                                    <th className="px-5 py-3 text-left">Side</th>
                                    <th className="px-5 py-3 text-left">Status</th>
                                    <th className="px-5 py-3 text-right">Lots</th>
                                    <th className="px-5 py-3 text-right">Open</th>
                                    <th className="px-5 py-3 text-right">Current</th>
                                    <th className="px-5 py-3 text-right">Unrealized P/L</th>
                                    <th className="px-5 py-3 text-right">Accrued IB</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {clientOpenPositions.map((position) => {
                                    const lots = coerceNumber(position.lot_size, 0);
                                    const unrealized = coerceNumber(position.unrealized_profit, 0);
                                    const accrued = coerceNumber(position.accrued_ib_commission, 0);
                                    const openPrice = position.open_price != null ? position.open_price : null;
                                    const currentPrice = position.current_price != null ? position.current_price : null;
                                    const openedAt = position.opened_at ? new Date(position.opened_at) : null;
                                    const unrealizedClass = unrealized > 0 ? 'text-emerald-500' : unrealized < 0 ? 'text-red-500' : 'text-muted-foreground';
                                    const statusVariant = position.status === 'partially_closed' ? 'secondary' : 'default';
                                    const statusLabel = position.status.replace(/[-_]/g, ' ');
                                    return (
                                      <tr key={`open-${position.id}`} className="border-t border-border/40">
                                        <td className="px-5 py-3 text-left text-muted-foreground">
                                          {openedAt ? openedAt.toLocaleString() : '—'}
                                        </td>
                                        <td className="px-5 py-3 font-medium text-foreground">
                                          {position.symbol || '—'}
                                        </td>
                                        <td className="px-5 py-3 uppercase text-muted-foreground">
                                          {position.side ? position.side.toUpperCase() : '—'}
                                        </td>
                                        <td className="px-5 py-3 text-left">
                                          <Badge variant={statusVariant} className="text-xs capitalize">
                                            {statusLabel}
                                          </Badge>
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums">{lots.toFixed(2)}</td>
                                        <td className="px-5 py-3 text-right tabular-nums">{openPrice != null ? openPrice.toFixed(5) : '—'}</td>
                                        <td className="px-5 py-3 text-right tabular-nums">{currentPrice != null ? currentPrice.toFixed(5) : '—'}</td>
                                        <td className={`px-5 py-3 text-right tabular-nums ${unrealizedClass}`}>
                                          {formatCurrency(unrealized)}
                                        </td>
                                        <td className="px-5 py-3 text-right tabular-nums">{formatCurrency(accrued)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}
                    </section>

                    <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background/95 to-background/80 shadow-xl">
                      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 px-6 py-5">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Recent Trades</h3>
                          <p className="text-xs text-muted-foreground">
                            Completed positions, realized profit, and commissions credited to the IB.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 font-medium text-foreground">
                            {clientTradesPagination.total} trades
                          </span>
                        </div>
                      </header>

                      {clientTradesError && (
                        <Alert variant="destructive" className="mx-6 mt-6">
                          <AlertDescription>{clientTradesError}</AlertDescription>
                        </Alert>
                      )}

                      <div className="overflow-x-auto px-2 pt-2">
                        <div className="rounded-2xl border border-border/60 bg-background/95 shadow-sm">
                          <table className="w-full min-w-[680px] text-sm">
                            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-5 py-3 text-left">Opened</th>
                                <th className="px-5 py-3 text-left">Symbol</th>
                                <th className="px-5 py-3 text-left">Side</th>
                                <th className="px-5 py-3 text-right">Lots</th>
                                <th className="px-5 py-3 text-right">Profit</th>
                                <th className="px-5 py-3 text-right">IB Commission</th>
                                <th className="hidden px-5 py-3 text-left xl:table-cell">Closed</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientTradesLoading ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                                    Loading trades...
                                  </td>
                                </tr>
                              ) : clientTrades.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                                    <div className="mx-auto w-fit rounded-full border border-dashed border-border/60 bg-muted/20 px-4 py-2 text-xs uppercase tracking-[0.18em]">
                                      No closed trades yet
                                    </div>
                                    <p className="mt-4 text-base font-medium text-foreground">Recent history will show up as soon as positions close.</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      Trigger a manual or automatic close, then refresh to review commissions.
                                    </p>
                                  </td>
                                </tr>
                              ) : (
                                clientTrades.map((trade) => {
                                  const lotSize = coerceNumber(trade.lot_size, 0);
                                  const profitLoss = coerceNumber(trade.profit_loss, 0);
                                  const ibCommissionValue = coerceNumber(trade.ib_commission, 0);
                                  const profitClass = profitLoss > 0
                                    ? 'text-emerald-500'
                                    : profitLoss < 0
                                      ? 'text-red-500'
                                      : 'text-muted-foreground';
                                  const openedAtDate = trade.opened_at ? new Date(trade.opened_at) : null;
                                  const closedAtDate = trade.closed_at ? new Date(trade.closed_at) : null;
                                  return (
                                    <tr key={trade.id} className="border-t border-border/40">
                                      <td className="px-5 py-3 text-left text-muted-foreground">
                                        {openedAtDate ? openedAtDate.toLocaleString() : '—'}
                                      </td>
                                      <td className="px-5 py-3 font-medium text-foreground">
                                        {trade.symbol || '—'}
                                      </td>
                                      <td className="px-5 py-3 uppercase text-muted-foreground">
                                        {trade.side ? trade.side.toUpperCase() : '—'}
                                      </td>
                                      <td className="px-5 py-3 text-right tabular-nums">
                                        {lotSize.toFixed(2)}
                                      </td>
                                      <td className={`px-5 py-3 text-right tabular-nums ${profitClass}`}>
                                        {formatCurrency(profitLoss)}
                                      </td>
                                      <td className="px-5 py-3 text-right tabular-nums">
                                        {formatCurrency(ibCommissionValue)}
                                      </td>
                                      <td className="hidden px-5 py-3 text-left text-muted-foreground xl:table-cell">
                                        {closedAtDate ? closedAtDate.toLocaleString() : 'Open'}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <footer className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                        <p className="text-xs text-muted-foreground">
                          Page {clientTradesPagination.page} of {Math.max(clientTradesPagination.totalPages, 1)}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClientTradesPageChange(Math.max(clientTradesPagination.page - 1, 1))}
                            disabled={clientTradesPagination.page <= 1 || clientTradesLoading}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClientTradesPageChange(Math.min(clientTradesPagination.page + 1, clientTradesPagination.totalPages))}
                            disabled={clientTradesPagination.page >= clientTradesPagination.totalPages || clientTradesLoading}
                          >
                            Next
                          </Button>
                        </div>
                      </footer>
                    </section>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground">Select a client to see detailed activity.</div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>
                  Register a new client and add them to your Introducing Broker program. They will receive a full trading account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={newClientData.firstName}
                      onChange={(e) => setNewClientData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={newClientData.lastName}
                      onChange={(e) => setNewClientData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="clientEmail">Email Address *</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="client@example.com"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={newClientData.password}
                      onChange={(e) => setNewClientData(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm password"
                      value={newClientData.confirmPassword}
                      onChange={(e) => setNewClientData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                  <Input
                    id="commissionRate"
                    type="number"
                    step="0.0001"
                    min="0"
                    max="1"
                    placeholder="0.0070"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                  />
                  <p className="mt-1 text-sm text-muted-foreground">
                    Default rate is 0.70% (0.0070). This can be adjusted per client.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddClientOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddClient} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} className="mr-2" />
                      Add Client
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}