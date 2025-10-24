import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

// Base API URL - prefer NEXT_PUBLIC_API_BASE for Next.js, fallback to backend dev port
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE as string) || 'http://localhost:3001'

type KycDoc = {
  id: number
  documentType: string
  documentNumber?: string
  documentFrontUrl?: string | null
  documentBackUrl?: string | null
  status?: string
  rejectionReason?: string | null
  submittedAt?: string | null
}

type Props = {
  userId: number | null
  open: boolean
  onClose: () => void
  onApproved?: (docId: number) => void
  onRejected?: (docId: number) => void
  adminMode?: boolean
  adminUserId?: number | null
}

export default function KycModal({ userId, open, onClose, onApproved, onRejected, adminMode = false, adminUserId = null }: Props) {
  const [docs, setDocs] = useState<KycDoc[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !userId) return
    setLoading(true)
    setError(null)
    const getStoredToken = (): string | null => {
      if (typeof window === 'undefined') return null
      try {
        const fromLocal = localStorage.getItem('accessToken')
        if (fromLocal) return fromLocal
        const cookieVal = (document.cookie || '').split(';').map(c => c.trim()).reduce<string | null>((acc, pair) => {
          const [k, v] = pair.split('=')
          if (!k) return acc
          if (k === 'accessToken') return v || null
          return acc
        }, null)
        return cookieVal
      } catch {
        return null
      }
    }

    const fetchWithFallback = async (path: string) => {
      const primary = `${API_BASE}${path}`
      const fallback = `${path}` // relative

      const tryRequest = async (url: string) => {
        try {
          const headers: Record<string,string> = {}
          const token = getStoredToken()
          if (token) headers['Authorization'] = `Bearer ${token}`
          const r = await fetch(url, { credentials: 'include', headers })
          if (!r.ok) {
            const text = await r.text().catch(() => '')
            throw new Error(`Server responded ${r.status}: ${text || r.statusText}`)
          }
          return await r.json()
        } catch (err) {
          throw err
        }
      }

      // Try primary first, then fallback
      try {
        return await tryRequest(primary)
      } catch (errPrimary) {
        try {
          return await tryRequest(fallback)
        } catch (errFallback) {
          // Combine messages
          const m1 = errPrimary instanceof Error ? errPrimary.message : String(errPrimary)
          const m2 = errFallback instanceof Error ? errFallback.message : String(errFallback)
          throw new Error(`Primary error: ${m1}; Fallback error: ${m2}`)
        }
      }
    }

      const path = adminMode && adminUserId ? `/api/kyc/admin/user/${adminUserId}/documents` : `/api/kyc/documents?userId=${userId}`
    fetchWithFallback(path)
      .then(json => setDocs(json.data || []))
      .catch(err => setError(err?.message || String(err)))
      .finally(() => setLoading(false))
  }, [open, userId, adminMode, adminUserId])

  const review = async (docId: number, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? prompt('Reason for rejection (optional)') : undefined
    if (action === 'reject' && reason === null) return
    setProcessing(docId)
    try {
      const getStoredToken = (): string | null => {
        if (typeof window === 'undefined') return null
        try {
          const fromLocal = localStorage.getItem('accessToken')
          if (fromLocal) return fromLocal
          const cookieVal = (document.cookie || '').split(';').map(c => c.trim()).reduce<string | null>((acc, pair) => {
            const [k, v] = pair.split('=')
            if (!k) return acc
            if (k === 'accessToken') return v || null
            return acc
          }, null)
          return cookieVal
        } catch {
          return null
        }
      }

      const postWithFallback = async (path: string, bodyObj: unknown) => {
        const primary = `${API_BASE}${path}`
        const fallback = `${path}`

        const tryPost = async (url: string) => {
          const headers: Record<string,string> = { 'Content-Type': 'application/json' }
          const token = getStoredToken()
          if (token) headers['Authorization'] = `Bearer ${token}`
          const r = await fetch(url, {
            method: 'POST', credentials: 'include', headers,
            body: JSON.stringify(bodyObj as unknown)
          })
          if (!r.ok) {
            const text = await r.text().catch(() => '')
            throw new Error(`Server responded ${r.status}: ${text || r.statusText}`)
          }
          return await r.json()
        }

        try {
          return await tryPost(primary)
        } catch (errPrimary) {
          try {
            return await tryPost(fallback)
          } catch (errFallback) {
            const m1 = errPrimary instanceof Error ? errPrimary.message : String(errPrimary)
            const m2 = errFallback instanceof Error ? errFallback.message : String(errFallback)
            throw new Error(`Primary error: ${m1}; Fallback error: ${m2}`)
          }
        }
      }

      const json = await postWithFallback(`/api/kyc/admin/${docId}/review`, { action, reason })
      if (!json.success) throw new Error(json.message || 'Failed')
      if (action === 'approve') onApproved?.(docId)
      if (action === 'reject') onRejected?.(docId)
      // refresh list
      setDocs(d => d ? d.filter(x => x.id !== docId) : d)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setProcessing(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle>KYC Documents</DialogTitle>
          <DialogDescription>Review and manage submitted KYC documents for this user.</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && docs && docs.length === 0 && (
          <div className="py-6 text-center text-muted-foreground">No KYC documents submitted</div>
        )}

        <div className="space-y-4">
          {docs && docs.map(doc => (
            <div key={doc.id} className="rounded border border-border/40 p-4 bg-card/60">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Submitted: {doc.submittedAt ? new Date(doc.submittedAt).toLocaleString() : 'N/A'}</div>
                  <div className="mt-1 flex items-center gap-3">
                    <div className="font-medium">{doc.documentType || '—'}</div>
                    <div className="text-sm text-muted-foreground">{doc.documentNumber || ''}</div>
                    <Badge variant="outline" className="ml-2 capitalize">{doc.status || 'unknown'}</Badge>
                  </div>
                  {doc.rejectionReason && <div className="text-sm text-red-600 mt-2">Rejection: {doc.rejectionReason}</div>}
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" disabled={processing === doc.id} onClick={() => review(doc.id, 'approve')}>
                    {processing === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={processing === doc.id} onClick={() => review(doc.id, 'reject')}>
                    {processing === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {doc.documentFrontUrl ? (
                  doc.documentFrontUrl.startsWith('http') ? (
                    <div className="relative h-48 w-full bg-background/60 border">
                      <Image src={doc.documentFrontUrl} alt="front" fill unoptimized style={{ objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div className="relative h-48 w-full">
                      <Image src={doc.documentFrontUrl} alt="front" fill style={{ objectFit: 'contain' }} />
                    </div>
                  )
                ) : (
                  <div className="h-48 w-full border flex items-center justify-center">No front</div>
                )}

                {doc.documentBackUrl ? (
                  doc.documentBackUrl.startsWith('http') ? (
                    <div className="relative h-48 w-full bg-background/60 border">
                      <Image src={doc.documentBackUrl} alt="back" fill unoptimized style={{ objectFit: 'contain' }} />
                    </div>
                  ) : (
                    <div className="relative h-48 w-full">
                      <Image src={doc.documentBackUrl} alt="back" fill style={{ objectFit: 'contain' }} />
                    </div>
                  )
                ) : (
                  <div className="h-48 w-full border flex items-center justify-center">No back</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <div className="w-full flex justify-end gap-2">
            <Button variant="outline" onClick={() => onClose()}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
