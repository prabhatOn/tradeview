"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Upload, FileText, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

interface KycDocument {
  id: number
  documentType: string
  documentNumber: string
  documentFrontUrl: string
  documentBackUrl?: string
  status: 'pending' | 'submitted' | 'verified' | 'rejected'
  rejectionReason?: string
  submittedAt?: string
  verifiedAt?: string
  createdAt: string
}

interface KycStatus {
  kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected'
  kycSubmittedAt?: string
  kycApprovedAt?: string
  kycRejectionReason?: string
  phoneNumber?: string
  dateOfBirth?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export function KycDocuments() {
  const [documents, setDocuments] = useState<KycDocument[]>([])
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const [newDocument, setNewDocument] = useState({
    documentType: 'aadhar',
    documentNumber: '',
    documentFrontUrl: '',
    documentBackUrl: ''
  })

  useEffect(() => {
    fetchDocuments()
    fetchKycStatus()
  }, [])

  const fetchDocuments = async () => {
    try {
      const response = await apiClient.get('/kyc/documents')
      if (response.success) {
        setDocuments(response.data)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load KYC documents",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchKycStatus = async () => {
    try {
      const response = await apiClient.get('/kyc/status')
      if (response.success) {
        setKycStatus(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch KYC status:', error)
    }
  }

  const handleUpload = async () => {
    if (!newDocument.documentNumber || !newDocument.documentFrontUrl) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive"
      })
      return
    }

    setUploading(true)
    try {
      const response = await apiClient.post('/kyc/documents', newDocument)
      if (response.success) {
        toast({
          title: "Success",
          description: "KYC document uploaded successfully"
        })
        setNewDocument({
          documentType: 'aadhar',
          documentNumber: '',
          documentFrontUrl: '',
          documentBackUrl: ''
        })
        fetchDocuments()
        fetchKycStatus()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await apiClient.delete(`/kyc/documents/${id}`)
      if (response.success) {
        toast({
          title: "Success",
          description: "Document deleted successfully"
        })
        fetchDocuments()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete document",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const config = {
      pending: { label: "Pending", icon: <Clock className="h-3 w-3" />, variant: "secondary" as const, className: "" },
      submitted: { label: "Submitted", icon: <Clock className="h-3 w-3" />, variant: "default" as const, className: "" },
      verified: { label: "Verified", icon: <CheckCircle2 className="h-3 w-3" />, variant: "default" as const, className: "bg-green-500" },
      rejected: { label: "Rejected", icon: <XCircle className="h-3 w-3" />, variant: "destructive" as const, className: "" }
    }
    const item = config[status as keyof typeof config] || config.pending
    return (
      <Badge variant={item.variant} className={`flex items-center gap-1 ${item.className}`}>
        {item.icon} {item.label}
      </Badge>
    )
  }

  const getDocumentTypeName = (type: string) => {
    const names: Record<string, string> = {
      aadhar: "Aadhar Card",
      pancard: "PAN Card",
      passport: "Passport",
      driving_license: "Driving License",
      voter_id: "Voter ID"
    }
    return names[type] || type
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* KYC Status */}
      {kycStatus && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">KYC Status</h3>
              <p className="text-sm text-muted-foreground">
                {kycStatus.kycStatus === 'approved' && 'Your KYC is approved'}
                {kycStatus.kycStatus === 'submitted' && 'Your KYC is under review'}
                {kycStatus.kycStatus === 'rejected' && 'Your KYC was rejected'}
                {kycStatus.kycStatus === 'pending' && 'Please submit your KYC documents'}
              </p>
              {kycStatus.kycRejectionReason && (
                <p className="text-sm text-destructive mt-1">
                  Reason: {kycStatus.kycRejectionReason}
                </p>
              )}
            </div>
            {getStatusBadge(kycStatus.kycStatus)}
          </div>
        </Card>
      )}

      {/* Upload New Document */}
      <div className="space-y-4">
        <h3 className="font-semibold">Upload KYC Document</h3>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Document Type</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newDocument.documentType}
              onChange={(e) => setNewDocument({ ...newDocument, documentType: e.target.value })}
            >
              <option value="aadhar">Aadhar Card</option>
              <option value="pancard">PAN Card</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
              <option value="voter_id">Voter ID</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label>Document Number</Label>
            <Input
              placeholder="Enter document number"
              value={newDocument.documentNumber}
              onChange={(e) => setNewDocument({ ...newDocument, documentNumber: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Document Front Image URL</Label>
            <Input
              placeholder="https://example.com/front.jpg"
              value={newDocument.documentFrontUrl}
              onChange={(e) => setNewDocument({ ...newDocument, documentFrontUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Upload your image to a service like Imgur or Cloudinary and paste the URL here
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Document Back Image URL (Optional)</Label>
            <Input
              placeholder="https://example.com/back.jpg"
              value={newDocument.documentBackUrl}
              onChange={(e) => setNewDocument({ ...newDocument, documentBackUrl: e.target.value })}
            />
          </div>

          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </div>
      </div>

      {/* Uploaded Documents */}
      <div className="space-y-4">
        <h3 className="font-semibold">Your Documents</h3>
        {documents.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No documents uploaded yet</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{getDocumentTypeName(doc.documentType)}</h4>
                      {getStatusBadge(doc.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Document Number: {doc.documentNumber}
                    </p>
                    {doc.rejectionReason && (
                      <p className="text-sm text-destructive mt-2">
                        Rejection Reason: {doc.rejectionReason}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <a 
                        href={doc.documentFrontUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        View Front
                      </a>
                      {doc.documentBackUrl && (
                        <>
                          <span className="text-muted-foreground">|</span>
                          <a 
                            href={doc.documentBackUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            View Back
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  {doc.status !== 'verified' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default KycDocuments
