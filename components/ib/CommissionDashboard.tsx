"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  BarChart3, 
  Download, 
  Calendar as CalendarIcon,
  Loader2 
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ibService } from "@/lib/services"
import { format } from "date-fns"

interface CommissionSummary {
  totalCommission: number
  totalVolume: number
  totalTrades: number
  adminShare: number
  ibShare: number
  ibSharePercent: number
  pendingCommission: number
  paidCommission: number
}

interface CommissionBreakdown {
  id: number
  trade_id: number
  symbol: string
  lot_size: number
  commission_amount: number
  ib_share: number
  admin_share: number
  status: string
  created_at: string
  client_name: string
}

interface ClientCommission {
  client_id: number
  client_name: string
  client_email: string
  total_trades: number
  total_volume: number
  total_commission: number
  ib_share: number
}

export function CommissionDashboard() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<CommissionSummary | null>(null)
  const [commissions, setCommissions] = useState<CommissionBreakdown[]>([])
  const [clientBreakdown, setClientBreakdown] = useState<ClientCommission[]>([])
  const [pendingCommissions, setPendingCommissions] = useState<CommissionBreakdown[]>([])
  
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const { toast } = useToast()

  useEffect(() => {
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, statusFilter])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Load commission summary
      const summaryResponse = await ibService.getCommissionSummary(
        dateFrom ? format(dateFrom, 'yyyy-MM-dd') : undefined,
        dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined
      )

      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data.summary)
        setCommissions(summaryResponse.data.commissions || [])
        setClientBreakdown(summaryResponse.data.clientBreakdown || [])
      }

      // Load pending commissions
      const pendingResponse = await ibService.getPendingCommissions()
      if (pendingResponse.success && pendingResponse.data) {
        setPendingCommissions(pendingResponse.data)
      }
    } catch (error) {
      console.error('Failed to load commission data:', error)
      toast({
        title: "Error",
        description: "Failed to load commission data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        ...(dateFrom && { startDate: format(dateFrom, 'yyyy-MM-dd') }),
        ...(dateTo && { endDate: format(dateTo, 'yyyy-MM-dd') }),
      })
      
      window.open(`/api/ib/commissions/report?${params.toString()}`, '_blank')
      
      toast({
        title: "Report Downloaded",
        description: "Commission report has been downloaded",
      })
    } catch (err) {
      console.error('Download failed:', err)
      toast({
        title: "Download Failed",
        description: "Failed to download commission report",
        variant: "destructive"
      })
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Commission
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.totalCommission?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {summary?.totalTrades || 0} trades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your Share ({summary?.ibSharePercent || 0}%)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              ${summary?.ibShare?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Pending: ${summary?.pendingCommission?.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Admin Share
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.adminShare?.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {(100 - (summary?.ibSharePercent || 0)).toFixed(0)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Volume
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalVolume?.toFixed(2) || '0.00'} lots</div>
            <p className="text-xs text-muted-foreground mt-1">
              From {clientBreakdown.length} active clients
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'PPP') : 'From Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'PPP') : 'To Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={downloadReport} variant="outline" className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          </div>

          <Tabs defaultValue="commissions" className="w-full">
            <TabsList>
              <TabsTrigger value="commissions">Commission History</TabsTrigger>
              <TabsTrigger value="clients">By Client</TabsTrigger>
              <TabsTrigger value="pending">
                Pending Payments
                {pendingCommissions.length > 0 && (
                  <Badge className="ml-2" variant="secondary">
                    {pendingCommissions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="commissions" className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Lot Size</TableHead>
                      <TableHead>Total Commission</TableHead>
                      <TableHead>Your Share</TableHead>
                      <TableHead>Admin Share</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No commission records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      commissions
                        .filter(c => statusFilter === 'all' || c.status === statusFilter)
                        .map((commission) => (
                          <TableRow key={commission.id}>
                            <TableCell className="font-mono text-sm">
                              {format(new Date(commission.created_at), 'MMM dd, yyyy HH:mm')}
                            </TableCell>
                            <TableCell>{commission.client_name}</TableCell>
                            <TableCell className="font-mono">{commission.symbol}</TableCell>
                            <TableCell className="font-mono">{commission.lot_size}</TableCell>
                            <TableCell className="font-mono">${commission.commission_amount.toFixed(2)}</TableCell>
                            <TableCell className="font-mono text-green-600">
                              ${commission.ib_share.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              ${commission.admin_share.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={commission.status === 'paid' ? 'default' : 'secondary'}>
                                {commission.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="clients" className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Total Trades</TableHead>
                      <TableHead>Total Volume</TableHead>
                      <TableHead>Total Commission</TableHead>
                      <TableHead>Your Earnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientBreakdown.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No client data available
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientBreakdown.map((client) => (
                        <TableRow key={client.client_id}>
                          <TableCell className="font-medium">{client.client_name}</TableCell>
                          <TableCell className="text-muted-foreground">{client.client_email}</TableCell>
                          <TableCell className="font-mono">{client.total_trades}</TableCell>
                          <TableCell className="font-mono">{client.total_volume.toFixed(2)} lots</TableCell>
                          <TableCell className="font-mono">${client.total_commission.toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-green-600 font-semibold">
                            ${client.ib_share.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="pending" className="mt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Total Commission</TableHead>
                      <TableHead>Your Share</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCommissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No pending payments
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingCommissions.map((commission) => (
                        <TableRow key={commission.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(commission.created_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>{commission.client_name}</TableCell>
                          <TableCell className="font-mono">{commission.symbol}</TableCell>
                          <TableCell className="font-mono">${commission.commission_amount.toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-green-600 font-semibold">
                            ${commission.ib_share.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">Pending</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {pendingCommissions.length > 0 && (
                <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Total Pending:</strong> $
                    {pendingCommissions.reduce((sum, c) => sum + c.ib_share, 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                    These commissions will be processed in the next payment cycle
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
