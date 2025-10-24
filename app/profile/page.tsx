"use client"

"use client"

import React, { useState, useEffect } from 'react'
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
import { Calendar, CreditCard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

const currencyFormatter = new Intl.NumberFormat('en-US')
const fmt = (n: number) => `$${currencyFormatter.format(n)}`

export default function ProfilePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)
  const { toast } = useToast()
  const { user, isLoading } = useAuth()
  const { accounts, isLoading: accountsLoading, error: accountsError, refreshAccounts } = useTradingAccounts()

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<import('@/lib/types').TradingAccount | null>(null)

  // form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')

  useEffect(() => {
    if (!isLoading && user) {
      const normalizedFirstName = (user as any).first_name ?? (user as any).firstName ?? ''
      const normalizedLastName = (user as any).last_name ?? (user as any).lastName ?? ''
      setFirstName(normalizedFirstName)
      setLastName(normalizedLastName)
      setEmail((user as any).email || '')
      setPhone((user as any).phone || '')
      setBio((user as any).bio || '')
    }
  }, [user, isLoading])

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

        <main className={`flex-1 overflow-auto transition-all duration-300 w-full p-4 sm:p-8 pb-28 sm:pb-6 ${sidebarCollapsed ? 'sm:pl-20 pl-4' : 'sm:pl-68 pl-4'}`}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground mt-1">Manage your personal information and trading accounts</p>
          </div>

          <div className="space-y-6">
            {/* Header card */}
            <Card className="p-6 bg-card/60 border border-border">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-muted/20 flex items-center justify-center text-xl font-bold">
                  {firstName || lastName ? `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() : 'U'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold">{(firstName && lastName) ? `${firstName} ${lastName}` : (user?.email || 'User')}</h2>
                    <Badge className="text-xs bg-yellow-500/10 text-yellow-400">{(user as any)?.role || 'Trader'}</Badge>
                  </div>
                  <p className="text-muted-foreground">{bio || 'No bio available'}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      Joined {(() => { const created = (user as any)?.created_at ?? (user as any)?.createdAt; return created ? new Date(created).toLocaleDateString() : '—' })()}
                    </div>
                  </div>
                </div>
                <div className="ml-4 hidden md:block">
                  <Button variant="ghost" onClick={() => toast({ title: 'Edit profile (not implemented)' })}>Edit</Button>
                </div>
              </div>
            </Card>

            {/* Personal info form */}
            <Card className="p-6 bg-card/40 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Personal Information</h3>
                  <p className="text-sm text-muted-foreground mt-1">Keep your profile up to date</p>
                </div>
              </div>

              <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); toast({ title: 'Profile saved' }) }}>
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground">First Name</label>
                  <Input className="h-10 bg-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground">Last Name</label>
                  <Input className="h-10 bg-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Email Address</label>
                    <Input className="h-10 bg-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground">Phone Number</label>
                    <Input className="h-10 bg-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground">About</label>
                  <Textarea className="min-h-[88px]" value={bio} onChange={(e) => setBio(e.target.value)} />
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-3">
                  <Button variant="ghost" onClick={() => toast({ title: 'Cancelled' })}>Cancel</Button>
                  <Button type="submit">Save Changes</Button>
                </div>
              </form>
            </Card>

            {/* Trading Accounts */}
            <Card className="p-6 bg-card/40 border border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Trading Accounts</h3>
                </div>
                <p className="text-sm text-muted-foreground">Your trading accounts and current status</p>
              </div>

              {accountsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="ml-2 text-muted-foreground">Loading accounts...</span>
                </div>
              ) : accountsError ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-4">{accountsError}</p>
                  <Button variant="outline" size="sm" onClick={refreshAccounts}>Try Again</Button>
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No trading accounts found</p>
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-full max-w-5xl space-y-6">
                    {accounts.map((acc) => (
                      <div key={acc.id} className="w-full mx-auto bg-card/50 border border-border rounded-xl p-8 shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-md bg-muted/20 flex items-center justify-center text-lg">
                                <CreditCard className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-lg md:text-xl font-semibold">#{acc.accountNumber}</div>
                                <div className="text-sm text-muted-foreground">{acc.accountType} • {acc.leverage}:1 Leverage</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {acc.isLive && <div className="px-2 py-1 text-xs bg-green-900/60 text-emerald-400 rounded-full">Live</div>}
                            {acc.status === 'active' && <div className="px-2 py-1 text-xs bg-green-900/60 text-emerald-400 rounded-full">Active</div>}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center mb-4">
                          <div>
                            <div className="text-xs text-muted-foreground">Balance</div>
                            <div className="text-xl md:text-2xl font-bold">{fmt(acc.balance)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Equity</div>
                            <div className="text-xl md:text-2xl font-bold">{fmt(acc.equity)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Free Margin</div>
                            <div className={`text-xl md:text-2xl font-bold ${acc.freeMargin < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(acc.freeMargin)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Margin Level</div>
                            <div className={`text-xl md:text-2xl font-bold ${((acc.marginLevel||0) < 50) ? 'text-red-400' : 'text-emerald-400'}`}>{(acc.marginLevel||0).toFixed(2)}%</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-border pt-4">
                          <div className="text-sm text-muted-foreground">Created: {new Date(acc.createdAt).toLocaleDateString()}</div>
                          <Button variant="ghost" onClick={() => { setSelectedAccount(acc); setDetailsOpen(true); }}>View Details</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
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
                      <div className={`text-base font-semibold ${selectedAccount.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(selectedAccount.balance)}</div>
                    </div>
                    <div className="p-3 rounded-md border border-border bg-card/50">
                      <div className="text-xs text-muted-foreground">Equity</div>
                      <div className={`text-base font-semibold ${selectedAccount.equity < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(selectedAccount.equity)}</div>
                    </div>
                    <div className="p-3 rounded-md border border-border bg-card/50">
                      <div className="text-xs text-muted-foreground">Free Margin</div>
                      <div className={`text-base font-semibold ${selectedAccount.freeMargin > 0 ? 'text-emerald-400' : (selectedAccount.freeMargin < 0 ? 'text-red-400' : 'text-muted-foreground')}`}>{fmt(selectedAccount.freeMargin)}</div>
                    </div>
                    <div className="p-3 rounded-md border border-border bg-card/50">
                      <div className="text-xs text-muted-foreground">Margin Level</div>
                      <div className={`text-base font-semibold ${(selectedAccount.marginLevel || 0) >= 100 ? 'text-emerald-400' : (selectedAccount.marginLevel || 0) >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{(selectedAccount.marginLevel || 0).toFixed(2)}%</div>
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
