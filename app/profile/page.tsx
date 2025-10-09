"use client"

import React, { useState } from 'react'
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { useTradingAccounts } from '@/hooks/use-trading-accounts'
import { TradingSidebar } from '@/components/trading-sidebar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { TradingAccountCard } from '@/components/ui/trading-account-card'
import { Calendar, CreditCard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const currencyFormatter = new Intl.NumberFormat('en-US')
const fmt = (n: number) => `$${currencyFormatter.format(n)}`

export default function ProfilePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)
  const { toast } = useToast()
  const { user, isLoading } = useAuth()
  const { accounts, isLoading: accountsLoading, error: accountsError, refreshAccounts } = useTradingAccounts()

  // Modal state for account details
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<import('@/lib/types').TradingAccount | null>(null)

  // Debug logging
  React.useEffect(() => {
    console.log('Profile Page - User data:', user)
    console.log('Profile Page - Is loading:', isLoading)
  }, [user, isLoading])

  // Use actual user data or fallback to empty values
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')

  // Update state when user data loads
  React.useEffect(() => {
    console.log('Profile Page - Updating state with user:', user)
    console.log('Profile Page - Is loading:', isLoading)
    
    if (!isLoading && user) {
      const normalizedFirstName = user.first_name ?? user.firstName ?? ''
      const normalizedLastName = user.last_name ?? user.lastName ?? ''
      console.log('Profile Page - Setting form data from user:', {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: user.email,
        phone: user.phone,
        bio: user.bio
      })
      setFirstName(normalizedFirstName)
      setLastName(normalizedLastName)
      setEmail(user.email || '')
      setPhone(user.phone || '')
      setBio(user.bio || '')
    }
  }, [user, isLoading])

  // Calculate stats from trading accounts
  const totalAccounts = accounts.length
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
  const totalEquity = accounts.reduce((sum, account) => sum + account.equity, 0)
  const activeAccounts = accounts.filter(account => account.status === 'active').length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex flex-1 overflow-hidden">
          <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
          <main className={`flex-1 overflow-auto transition-all duration-300 w-full p-8 ${sidebarCollapsed ? 'pl-20' : 'pl-68'}`}>
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading profile...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

        <main className={`flex-1 overflow-auto transition-all duration-300 w-full p-8 ${sidebarCollapsed ? 'pl-20' : 'pl-68'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Profile</h1>
              <p className="text-muted-foreground mt-1">Manage your personal information and trading statistics</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* Left column: profile header + personal info */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6 bg-card/60 border border-border">
                <div className="flex items-center gap-6">
                  <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center text-xl font-bold">
                    {firstName || lastName
                      ? `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
                      : 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold">
                        {firstName && lastName ? `${firstName} ${lastName}` : 'Loading...'}
                      </h2>
                      <Badge className="text-xs bg-yellow-500/10 text-yellow-400">
                        {user?.role || user?.roles?.[0] || 'Trader'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-2">{bio || 'No bio available'}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        Joined {(() => {
                          const created = user?.created_at ?? user?.createdAt
                          return created ? new Date(created).toLocaleDateString() : 'Loading...'
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/40 border border-border">
                <h3 className="text-lg font-semibold">Personal Information</h3>
                <p className="text-sm text-muted-foreground mt-1">Manage your personal details</p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">First Name</label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Last Name</label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-muted-foreground">Email Address</label>
                    <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Phone Number</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm text-muted-foreground">About</label>
                    <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-[120px]" />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button variant="ghost" onClick={() => toast({ title: 'Cancelled' })}>Cancel</Button>
                  <Button onClick={async () => {
                    try {
                      // This would call updateUser from AuthContext
                      toast({ title: 'Profile saved', description: 'Your profile changes have been saved.' })
                    } catch {
                      toast({ 
                        title: 'Error', 
                        description: 'Failed to save profile changes.',
                        variant: 'destructive' 
                      })
                    }
                  }}>Save Changes</Button>
                </div>
              </Card>

              {/* Trading Accounts Section */}
              <Card className="p-6 bg-card/40 border border-border">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      Trading Accounts
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your trading accounts and their current status
                    </p>
                  </div>
                </div>

                {accountsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-muted-foreground">Loading accounts...</span>
                  </div>
                ) : accountsError ? (
                  <div className="text-center py-8">
                    <p className="text-red-400 mb-4">{accountsError}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={refreshAccounts}
                    >
                      Try Again
                    </Button>
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No trading accounts found</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {accounts.map((account) => (
                      <TradingAccountCard
                        key={account.id}
                        account={account}
                        onViewDetails={(account) => {
                          setSelectedAccount(account)
                          setDetailsOpen(true)
                        }}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Right column: KPIs & quick cards */}
            <aside className="space-y-6">
              <div className="sticky top-24 space-y-4">
                <Card className="p-4 bg-card/40 border-border">
                  <div className="text-xs text-muted-foreground">Trading Accounts</div>
                  <div className="text-2xl font-extrabold mt-2">{totalAccounts}</div>
                  <div className="text-xs text-muted-foreground mt-1">{activeAccounts} active</div>
                </Card>

                <Card className="p-4 bg-card/40 border-border">
                  <div className="text-xs text-muted-foreground">Total Balance</div>
                  <div className="text-2xl font-extrabold text-emerald-500 mt-2">{fmt(totalBalance)}</div>
                </Card>

                <Card className="p-4 bg-card/40 border-border">
                  <div className="text-xs text-muted-foreground">Total Equity</div>
                  <div className="text-2xl font-extrabold text-emerald-500 mt-2">{fmt(totalEquity)}</div>
                </Card>

                <Card className="p-4 bg-card/40 border-border">
                  <div className="text-xs text-muted-foreground">Account Status</div>
                  <div className="text-2xl font-extrabold mt-2">
                    {accounts.length > 0 ? (
                      <Badge className="text-sm bg-green-500/10 text-green-400">
                        {activeAccounts === accounts.length ? 'All Active' : `${activeAccounts}/${accounts.length} Active`}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-base">No Accounts</span>
                    )}
                  </div>
                </Card>
              </div>
            </aside>
          </div>

          <Toaster />

          {/* Account Details Modal */}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Account Details</DialogTitle>
                <DialogDescription>
                  View detailed information about your trading account.
                </DialogDescription>
              </DialogHeader>

              {selectedAccount && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Account Number</div>
                      <div className="font-medium">#{selectedAccount.accountNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Type</div>
                      <div className="font-medium capitalize">{selectedAccount.accountType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Status</div>
                      <div className="font-medium capitalize">{selectedAccount.status}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Leverage</div>
                      <div className="font-medium">{selectedAccount.leverage}:1</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Currency</div>
                      <div className="font-medium">{selectedAccount.currency}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Created</div>
                      <div className="font-medium">{new Date(selectedAccount.createdAt).toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-md border border-border bg-card/50">
                      <div className="text-xs text-muted-foreground">Balance</div>
                      <div className="text-lg font-bold">{fmt(selectedAccount.balance)}</div>
                    </div>
                    <div className="p-3 rounded-md border border-border bg-card/50">
                      <div className="text-xs text-muted-foreground">Equity</div>
                      <div className="text-lg font-bold">{fmt(selectedAccount.equity)}</div>
                    </div>
                    <div className="p-3 rounded-md border border-border bg-card/50">
                      <div className="text-xs text-muted-foreground">Free Margin</div>
                      <div className="text-lg font-bold">{fmt(selectedAccount.freeMargin)}</div>
                    </div>
                    <div className="p-3 rounded-md border border-border bg-card/50">
                      <div className="text-xs text-muted-foreground">Margin Level</div>
                      <div className="text-lg font-bold">{selectedAccount.marginLevel.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setDetailsOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  )
}
