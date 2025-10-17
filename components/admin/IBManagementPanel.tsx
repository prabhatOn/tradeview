"use client"

import { useCallback, useEffect, useState } from "react"
import { adminIbService } from "@/lib/services"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { DollarSign, Users, TrendingUp, Settings } from "lucide-react"

interface IBStats {
  id: number;
  ibName: string;
  ibEmail: string;
  ibSharePercent: number;
  commissionRate: number;
  tierLevel: string;
  status: string;
  totalClients: number;
  totalTrades: number;
  totalCommission: number;
  totalIBAmount: number;
  totalAdminAmount: number;
}

interface Commission {
  id: number;
  ibName: string;
  ibEmail: string;
  tradeVolume: number;
  totalCommission: number;
  ibAmount: number;
  adminAmount: number;
  createdAt: string;
}

interface GlobalSettings {
  default_commission_rate: number;
  default_ib_share_percent: number;
  min_ib_share_percent: number;
  max_ib_share_percent: number;
}

export function IBManagementPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [ibs, setIbs] = useState<IBStats[]>([])
  const [pendingCommissions, setPendingCommissions] = useState<Commission[]>([])
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editShareValue, setEditShareValue] = useState("")
  const [editingSettings, setEditingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    default_commission_rate: "",
    default_ib_share_percent: "",
    min_ib_share_percent: "",
    max_ib_share_percent: ""
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ibsResp, pendingResp, settingsResp] = await Promise.all([
        adminIbService.getAllIBsWithStats(),
        adminIbService.getPendingCommissions(),
        adminIbService.getGlobalSettings()
      ])

      if (ibsResp.success) setIbs(ibsResp.data || [])
      if (pendingResp.success) setPendingCommissions(pendingResp.data || [])
      if (settingsResp.success) {
        setGlobalSettings(settingsResp.data)
        setSettingsForm({
          default_commission_rate: String(settingsResp.data.default_commission_rate || 0.0070),
          default_ib_share_percent: String(settingsResp.data.default_ib_share_percent || 50),
          min_ib_share_percent: String(settingsResp.data.min_ib_share_percent || 10),
          max_ib_share_percent: String(settingsResp.data.max_ib_share_percent || 90)
        })
      }
    } catch (error: any) {
      toast({
        title: "Failed to load data",
        description: error?.message || "An error occurred",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const startEdit = (id: number, current: number) => {
    setEditingId(id)
    setEditShareValue(String(current))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditShareValue("")
  }

  const saveShare = async (id: number) => {
    const parsed = parseFloat(editShareValue)
    if (!Number.isFinite(parsed) || parsed < 10 || parsed > 90) {
      toast({
        title: "Invalid value",
        description: "Share percentage must be between 10% and 90%",
        variant: "destructive"
      })
      return
    }

    try {
      const resp = await adminIbService.updateIBSharePercent(id, parsed)
      if (resp.success) {
        toast({ title: "Success", description: "IB share percentage updated" })
        cancelEdit()
        await loadData()
      }
    } catch (error: any) {
      toast({
        title: "Failed to update",
        description: error?.message || "An error occurred",
        variant: "destructive"
      })
    }
  }

  const markAsPaid = async (commissionId: number) => {
    try {
      const resp = await adminIbService.markCommissionPaid(commissionId)
      if (resp.success) {
        toast({ title: "Success", description: "Commission marked as paid" })
        await loadData()
      }
    } catch (error: any) {
      toast({
        title: "Failed to mark as paid",
        description: error?.message || "An error occurred",
        variant: "destructive"
      })
    }
  }

  const updateGlobalSetting = async (key: keyof GlobalSettings) => {
    const value = parseFloat(settingsForm[key])
    if (!Number.isFinite(value) || value < 0) {
      toast({
        title: "Invalid value",
        description: "Please enter a valid number",
        variant: "destructive"
      })
      return
    }

    try {
      const resp = await adminIbService.updateGlobalSetting(key, value)
      if (resp.success) {
        toast({ title: "Success", description: "Setting updated" })
        setEditingSettings(false)
        await loadData()
      }
    } catch (error: any) {
      toast({
        title: "Failed to update setting",
        description: error?.message || "An error occurred",
        variant: "destructive"
      })
    }
  }

  const totalStats = {
    totalIBs: ibs.length,
    totalClients: ibs.reduce((sum, ib) => sum + ib.totalClients, 0),
    totalCommission: ibs.reduce((sum, ib) => sum + ib.totalCommission, 0),
    totalAdminEarnings: ibs.reduce((sum, ib) => sum + ib.totalAdminAmount, 0)
  }

  if (loading) {
    return <div className="p-8">Loading IB management data...</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total IBs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalIBs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalClients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commission</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalStats.totalCommission.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalStats.totalAdminEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ibs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ibs">IBs List</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Payments
            {pendingCommissions.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingCommissions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">Global Settings</TabsTrigger>
        </TabsList>

        {/* IBs List Tab */}
        <TabsContent value="ibs">
          <Card>
            <CardHeader>
              <CardTitle>Introducing Brokers</CardTitle>
              <CardDescription>Manage IB commission settings and view performance</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IB Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Clients</TableHead>
                    <TableHead>Trades</TableHead>
                    <TableHead>Total Commission</TableHead>
                    <TableHead>IB Share %</TableHead>
                    <TableHead>IB Amount</TableHead>
                    <TableHead>Admin Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ibs.map((ib) => (
                    <TableRow key={ib.id}>
                      <TableCell className="font-medium">{ib.ibName}</TableCell>
                      <TableCell>{ib.ibEmail}</TableCell>
                      <TableCell>{ib.totalClients}</TableCell>
                      <TableCell>{ib.totalTrades}</TableCell>
                      <TableCell>${ib.totalCommission.toFixed(2)}</TableCell>
                      <TableCell>
                        {editingId === ib.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editShareValue}
                              onChange={(e) => setEditShareValue(e.target.value)}
                              className="w-20"
                              min="10"
                              max="90"
                            />
                            <Button size="sm" onClick={() => saveShare(ib.id)}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{ib.ibSharePercent}%</span>
                            <Button size="sm" variant="outline" onClick={() => startEdit(ib.id, ib.ibSharePercent)}>
                              Edit
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-green-600">${ib.totalIBAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-blue-600">${ib.totalAdminAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={ib.status === 'active' ? 'default' : 'secondary'}>
                          {ib.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Payments Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Commission Payments</CardTitle>
              <CardDescription>Review and mark commissions as paid</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingCommissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending commissions
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IB Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Trade Volume</TableHead>
                      <TableHead>Total Commission</TableHead>
                      <TableHead>IB Amount</TableHead>
                      <TableHead>Admin Amount</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingCommissions.map((comm) => (
                      <TableRow key={comm.id}>
                        <TableCell className="font-medium">{comm.ibName}</TableCell>
                        <TableCell>{comm.ibEmail}</TableCell>
                        <TableCell>{new Date(comm.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>${comm.tradeVolume.toFixed(2)}</TableCell>
                        <TableCell>${comm.totalCommission.toFixed(2)}</TableCell>
                        <TableCell className="text-green-600">${comm.ibAmount.toFixed(2)}</TableCell>
                        <TableCell className="text-blue-600">${comm.adminAmount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => markAsPaid(comm.id)}
                          >
                            Mark Paid
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Global IB Settings</CardTitle>
              <CardDescription>Configure default commission rates and IB share percentages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Commission Rate (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={settingsForm.default_commission_rate}
                      onChange={(e) => setSettingsForm({ ...settingsForm, default_commission_rate: e.target.value })}
                      disabled={!editingSettings}
                      step="0.0001"
                    />
                    {editingSettings && (
                      <Button onClick={() => updateGlobalSetting('default_commission_rate')}>Save</Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current: {globalSettings?.default_commission_rate}% (0.0070 = 0.70%)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Default IB Share (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={settingsForm.default_ib_share_percent}
                      onChange={(e) => setSettingsForm({ ...settingsForm, default_ib_share_percent: e.target.value })}
                      disabled={!editingSettings}
                    />
                    {editingSettings && (
                      <Button onClick={() => updateGlobalSetting('default_ib_share_percent')}>Save</Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current: {globalSettings?.default_ib_share_percent}%
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Minimum IB Share (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={settingsForm.min_ib_share_percent}
                      onChange={(e) => setSettingsForm({ ...settingsForm, min_ib_share_percent: e.target.value })}
                      disabled={!editingSettings}
                    />
                    {editingSettings && (
                      <Button onClick={() => updateGlobalSetting('min_ib_share_percent')}>Save</Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current: {globalSettings?.min_ib_share_percent}%
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Maximum IB Share (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={settingsForm.max_ib_share_percent}
                      onChange={(e) => setSettingsForm({ ...settingsForm, max_ib_share_percent: e.target.value })}
                      disabled={!editingSettings}
                    />
                    {editingSettings && (
                      <Button onClick={() => updateGlobalSetting('max_ib_share_percent')}>Save</Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Current: {globalSettings?.max_ib_share_percent}%
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant={editingSettings ? "outline" : "default"}
                  onClick={() => setEditingSettings(!editingSettings)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {editingSettings ? "Cancel Edit" : "Edit Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
