"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Building2, Plus, Star, Trash2, Edit, CheckCircle2, XCircle, Clock } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

interface BankDetail {
  id: number
  bankName: string
  accountHolderName: string
  accountNumber: string
  ifscCode: string
  accountType: 'savings' | 'current'
  branchName?: string
  isPrimary: boolean
  isVerified: boolean
  status: 'active' | 'inactive' | 'pending_verification'
  verifiedAt?: string
  createdAt: string
}

export function BankDetailsList() {
  const [bankDetails, setBankDetails] = useState<BankDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBank, setEditingBank] = useState<BankDetail | null>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    accountType: 'savings' as 'savings' | 'current',
    branchName: '',
    isPrimary: false
  })

  useEffect(() => {
    fetchBankDetails()
  }, [])

  const fetchBankDetails = async () => {
    try {
      const response = await apiClient.get('/bank-details')
      if (response.success) {
        setBankDetails(response.data)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load bank details",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate IFSC code format
    const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/
    if (!ifscPattern.test(formData.ifscCode)) {
      toast({
        title: "Invalid IFSC Code",
        description: "Please enter a valid IFSC code (e.g., SBIN0001234)",
        variant: "destructive"
      })
      return
    }

    try {
      const response = editingBank
        ? await apiClient.put(`/bank-details/${editingBank.id}`, formData)
        : await apiClient.post('/bank-details', formData)

      if (response.success) {
        toast({
          title: "Success",
          description: editingBank ? "Bank details updated successfully" : "Bank details added successfully"
        })
        setDialogOpen(false)
        resetForm()
        fetchBankDetails()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save bank details",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return

    try {
      const response = await apiClient.delete(`/bank-details/${id}`)
      if (response.success) {
        toast({
          title: "Success",
          description: "Bank details deleted successfully"
        })
        fetchBankDetails()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete bank details",
        variant: "destructive"
      })
    }
  }

  const handleSetPrimary = async (id: number) => {
    try {
      const response = await apiClient.put(`/bank-details/${id}/set-primary`, {})
      if (response.success) {
        toast({
          title: "Success",
          description: "Primary bank account updated"
        })
        fetchBankDetails()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to set primary account",
        variant: "destructive"
      })
    }
  }

  const handleEdit = (bank: BankDetail) => {
    setEditingBank(bank)
    setFormData({
      bankName: bank.bankName,
      accountHolderName: bank.accountHolderName,
      accountNumber: bank.accountNumber,
      ifscCode: bank.ifscCode,
      accountType: bank.accountType,
      branchName: bank.branchName || '',
      isPrimary: bank.isPrimary
    })
    setDialogOpen(true)
  }

  const resetForm = () => {
    setEditingBank(null)
    setFormData({
      bankName: '',
      accountHolderName: '',
      accountNumber: '',
      ifscCode: '',
      accountType: 'savings',
      branchName: '',
      isPrimary: false
    })
  }

  const getStatusBadge = (status: string, isVerified: boolean) => {
    if (isVerified) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-500">
          <CheckCircle2 className="h-3 w-3" /> Verified
        </Badge>
      )
    }
    if (status === 'pending_verification') {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> Pending Verification
        </Badge>
      )
    }
    return (
      <Badge variant="default" className="flex items-center gap-1">
        {status}
      </Badge>
    )
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Manage your bank accounts for deposits and withdrawals
        </p>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label>Bank Name</Label>
                <Input
                  required
                  placeholder="e.g., State Bank of India"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Account Holder Name</Label>
                <Input
                  required
                  placeholder="As per bank records"
                  value={formData.accountHolderName}
                  onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Account Number</Label>
                <Input
                  required
                  placeholder="Enter account number"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>IFSC Code</Label>
                <Input
                  required
                  placeholder="e.g., SBIN0001234"
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                  maxLength={11}
                />
              </div>

              <div className="grid gap-2">
                <Label>Account Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.accountType}
                  onChange={(e) => setFormData({ ...formData, accountType: e.target.value as 'savings' | 'current' })}
                >
                  <option value="savings">Savings</option>
                  <option value="current">Current</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label>Branch Name (Optional)</Label>
                <Input
                  placeholder="e.g., Connaught Place"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isPrimary" className="cursor-pointer">
                  Set as primary account
                </Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingBank ? 'Update' : 'Add'} Bank Account
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bank Accounts List */}
      {bankDetails.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No bank accounts added yet</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Bank Account
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bankDetails.map((bank) => (
            <Card key={bank.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{bank.bankName}</h4>
                    {bank.isPrimary && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Star className="h-3 w-3" /> Primary
                      </Badge>
                    )}
                    {getStatusBadge(bank.status, bank.isVerified)}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Account Holder: {bank.accountHolderName}</p>
                    <p>Account Number: •••• {bank.accountNumber.slice(-4)}</p>
                    <p>IFSC Code: {bank.ifscCode}</p>
                    <p>Account Type: {bank.accountType === 'savings' ? 'Savings' : 'Current'}</p>
                    {bank.branchName && <p>Branch: {bank.branchName}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!bank.isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetPrimary(bank.id)}
                      title="Set as primary"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  {!bank.isVerified && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(bank)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(bank.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default BankDetailsList
