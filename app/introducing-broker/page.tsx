"use client"

import { useState, useMemo, FC, useEffect } from "react"
import { useAuth } from '@/hooks/use-auth'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { TradingSidebar } from '@/components/trading-sidebar'
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Settings,
  UserPlus,
  Search,
  Users,
  DollarSign,
  BarChart2,
  EllipsisVertical,
  ArrowRight,
  Loader2
} from "lucide-react"
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TrendingUp, Target } from "lucide-react"

// --- TYPES ---
interface Client {
  id: string;
  clientName: string;
  clientEmail: string;
  clientJoined: string;
  volume: number;
  commission: number;
  commissionTier: string;
  status: string;
  totalTrades: number;
  winRate: number;
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

interface IbDashboardData {
  statistics: IbStatistics;
  clients: Client[];
  commissionHistory: CommissionHistoryEntry[];
  monthlyCommissions: any[];
}

// --- HELPER FUNCTIONS ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

// --- REUSABLE ROW COMPONENTS ---
const ClientRow: FC<{ client: Client }> = ({ client }) => {
  const { toast } = useToast();
  const getCommissionColor = (status: string) => status === 'inactive' ? 'text-red-500' : 'text-emerald-500';
  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'Gold': return 'border-yellow-400/50 bg-yellow-400/10 text-yellow-400';
      case 'Silver': return 'border-gray-400/50 bg-gray-400/10 text-gray-400';
      case 'Platinum': return 'border-blue-400/50 bg-blue-400/10 text-blue-400';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-border/50 hover:bg-muted/30 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Users size={20} className="text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{client.clientName}</h3>
          <p className="text-sm text-muted-foreground">{client.clientEmail} • Joined: {new Date(client.clientJoined).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Volume</p>
          <p className="font-medium">{formatCurrency(client.volume)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Commission</p>
          <p className={`font-medium ${getCommissionColor(client.status)}`}>{formatCurrency(client.commission)}</p>
        </div>
        <div className="flex items-center gap-2 w-32 justify-end">
           <Badge variant="outline" className={`text-xs ${getTierBadgeColor(client.commissionTier)}`}>{client.commissionTier}</Badge>
           <Badge variant={client.status === 'active' ? 'secondary' : 'destructive'} className="text-xs capitalize">{client.status}</Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><EllipsisVertical size={16} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => toast({ title: 'View Client', description: `Viewing details for ${client.clientName}` })}>View Details</DropdownMenuItem>
            <DropdownMenuItem className="text-red-500" onClick={() => toast({ title: 'Remove Client', description: `Removing ${client.clientName}` })}>Remove</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

const CommissionHistoryRow: FC<{ entry: CommissionHistoryEntry }> = ({ entry }) => {
    const isPaid = entry.status === 'paid';
    return (
        <div className="flex items-center justify-between p-4 border-b border-border/50 hover:bg-muted/30 transition-colors duration-200">
            <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
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
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientData, setNewClientData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: true // Auto-accept for IB clients
  });
  const [commissionRate, setCommissionRate] = useState('0.0070');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = !!user?.roles?.includes('Admin') || user?.role === 'Admin';

  // Fetch IB data
  const fetchIbData = async () => {
    try {
      setIsLoading(true);
      const statusResp = await apiClient.get('/introducing-broker/status');
      if (statusResp.success) {
        setIbStatus(statusResp.data);
      }
      const response = await apiClient.get('/introducing-broker/dashboard');
      if (response.success) {
        setDashboardData(response.data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load IB data",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error fetching IB data:', error);
      if (error?.response?.status === 403) {
        setDashboardData(null);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to load IB data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIbData();
  }, []);

  // Add new client
  const handleAddClient = async () => {
    console.log('handleAddClient called with data:', newClientData);

    // Validate form data
    if (!newClientData.firstName.trim() || !newClientData.lastName.trim() || !newClientData.email.trim()) {
      console.log('Validation failed: missing required fields');
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (newClientData.password !== newClientData.confirmPassword) {
      console.log('Validation failed: passwords do not match');
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    if (newClientData.password.length < 6) {
      console.log('Validation failed: password too short');
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive"
      });
      return;
    }

    // Check if user is trying to add themselves
    if (user?.email && newClientData.email.trim().toLowerCase() === user.email.toLowerCase()) {
      console.log('Validation failed: trying to add self');
      toast({
        title: "Error",
        description: "You cannot add yourself as a client",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      console.log('Starting client addition process...');

      // 1) Try to register the client account (if it already exists, we'll proceed)
      try {
        await apiClient.post('/auth/register', {
          email: newClientData.email.trim(),
          password: newClientData.password,
          firstName: newClientData.firstName.trim(),
          lastName: newClientData.lastName.trim(),
          phone: newClientData.phone?.trim() || undefined,
          acceptTerms: true
        });
      } catch (regErr: any) {
        console.warn('Client registration step skipped/failed:', regErr?.message || regErr);
        // Continue; they may already exist
      }

      // 2) Add them to the IB program using entered email
      const ibResponse = await apiClient.post('/introducing-broker/clients', {
        clientEmail: newClientData.email.trim(),
        commissionRate: parseFloat(commissionRate)
      });

      console.log('IB addition response received:', ibResponse);

      if (ibResponse.success) {
        console.log('IB addition successful');
        const alreadyExists = (ibResponse as any).alreadyExists ?? (ibResponse.data?.alreadyExists ?? false);
        const message = alreadyExists
          ? "Client is already in your IB program"
          : "Client added to IB program successfully";
        toast({
          title: "Success",
          description: message,
        });
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
        // Refresh data
        fetchIbData();
      } else {
        console.log('IB addition failed:', ibResponse.message);
        toast({
          title: "Error",
          description: ibResponse.message || "Failed to add client to IB program",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Error in handleAddClient:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      // Handle the cached code error gracefully - treat "already exists" as success
      const errorMessage = error.response?.data?.message || error.message || "Failed to add client";
      if (errorMessage.includes('IB relationship already exists for this client')) {
        console.log('Client already exists, treating as success');
        toast({
          title: "Success",
          description: "Client is already in your IB program",
        });
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
        // Refresh data
        fetchIbData();
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setIsSubmitting(false);
      console.log('handleAddClient completed');
    }
  };

  // Filter clients based on search and status
  const filteredClients = dashboardData?.clients?.filter(client => {
    const matchesSearch = client.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
    return matchesSearch && matchesStatus;
  }) || [];

  // Filter commission history
  const filteredHistory = dashboardData?.commissionHistory?.filter(entry =>
    `${entry.first_name} ${entry.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex flex-1 overflow-hidden">
          <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <main className={`flex-1 flex items-center justify-center transition-all duration-300 ${
            sidebarCollapsed ? "pl-20 pr-6" : "pl-68 pr-6"
          }`}>
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading IB dashboard...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
        
        <main className={`flex-1 flex flex-col gap-6 overflow-auto transition-all duration-300 w-full ${
          sidebarCollapsed ? "pl-20 pr-6 pt-6 pb-6" : "pl-68 pr-6 pt-6 pb-6"
        }`}>
          {/* IB Status gating */}
          {ibStatus && !ibStatus.isIB && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Introducing Broker Access</h3>
                    <p className="text-sm text-muted-foreground">
                      {ibStatus.applicationStatus === 'pending'
                        ? 'Your application to become an IB is pending admin approval.'
                        : 'You are not an approved IB yet. Apply to become an IB to add clients and earn commissions.'}
                    </p>
                  </div>
                  {ibStatus.applicationStatus !== 'pending' && (
                    <Button onClick={async () => {
                      try {
                        const resp = await apiClient.post('/introducing-broker/apply', {});
                        if (resp.success) {
                          toast({ title: 'Application submitted', description: 'We will notify you once approved.' });
                          setIbStatus({ isIB: false, applicationStatus: 'pending' });
                        }
                      } catch (e:any) {
                        toast({ title: 'Error', description: e?.response?.data?.message || 'Failed to submit application', variant: 'destructive' });
                      }
                    }}>Apply to be IB</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Header */}
            <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Introducing Broker Dashboard</h1>
              <p className="text-muted-foreground">Manage your clients and track commissions</p>
            </div>
            <Button onClick={() => setIsAddClientOpen(true)} className="flex items-center gap-2" disabled={!!ibStatus && !ibStatus.isIB}>
              <UserPlus size={16} />
              Add Client
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Clients</p>
                    <p className="text-2xl font-bold">{dashboardData?.statistics?.total_clients || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Commission</p>
                    <p className="text-2xl font-bold">${(dashboardData?.statistics?.total_commission_earned || 0).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Clients</p>
                    <p className="text-2xl font-bold">{dashboardData?.statistics?.active_clients || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Commission Rate</p>
                    <p className="text-2xl font-bold">{((dashboardData?.statistics?.avg_commission_rate || 0) * 100).toFixed(2)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs and Search */}
          <div className="flex items-center justify-between mb-4">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'clients' | 'history')}>
              <TabsList>
                <TabsTrigger value="clients">Clients ({filteredClients.length})</TabsTrigger>
                <TabsTrigger value="history">Commission History ({filteredHistory.length})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              {activeTab === 'clients' && (
                <>
                  <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | 'active' | 'inactive')}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setIsAddClientOpen(true)}>
                    <UserPlus size={16} className="mr-2" />
                    Add Client
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <Card>
            <CardContent className="p-0">
              {isAdmin && (
                <div className="p-4 border-b border-border/50 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Admin tools:</span>
                  <Button size="sm" variant="outline" onClick={async () => {
                    const id = window.prompt('Approve IB for userId:');
                    if (!id) return;
                    try {
                      const resp = await apiClient.post('/introducing-broker/admin/approve', { userId: parseInt(id) });
                      if (resp.success) {
                        toast({ title: 'Approved', description: 'User granted IB role' });
                        fetchIbData();
                      }
                    } catch (e:any) {
                      toast({ title: 'Error', description: e?.response?.data?.message || 'Failed to approve', variant: 'destructive' });
                    }
                  }}>Approve IB</Button>
                </div>
              )}
              {activeTab === 'clients' ? (
                <div>
                  {filteredClients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users size={48} className="text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No clients found</h3>
                      <p className="text-muted-foreground text-center mb-4">
                        {searchQuery || filterStatus !== 'all' ? 'Try adjusting your search or filters.' : 'Start by adding your first client to the IB program.'}
                      </p>
                      {!searchQuery && filterStatus === 'all' && (
                        <Button onClick={() => setIsAddClientOpen(true)}>
                          <UserPlus size={16} className="mr-2" />
                          Add Your First Client
                        </Button>
                      )}
                    </div>
                  ) : (
                    filteredClients.map((client) => (
                      <ClientRow key={client.id} client={client} />
                    ))
                  )}
                </div>
              ) : (
                <div>
                  {filteredHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <DollarSign size={48} className="text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No commission history</h3>
                      <p className="text-muted-foreground text-center">
                        {searchQuery ? 'No commissions match your search.' : 'Commission history will appear here once your clients start trading.'}
                      </p>
                    </div>
                  ) : (
                    filteredHistory.map((entry) => (
                      <CommissionHistoryRow key={entry.id} entry={entry} />
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Client Dialog */}
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
                  <p className="text-sm text-muted-foreground mt-1">
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
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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