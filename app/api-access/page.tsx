"use client"

import { TradingSidebar } from "@/components/trading-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Eye, Clipboard, Shield, Plus, Trash2, Settings } from "lucide-react"
import { useState, useEffect } from "react"
import { useSidebarCollapsed } from '@/hooks/use-sidebar-collapsed'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Input as UiInput } from "@/components/ui/input"
import { apiKeysService } from '@/lib/services'

// API Key type definitions
interface ApiKey {
  id: string
  key_id: string
  secret_key: string
  status: 'active' | 'inactive'
  last_used_at: string | null
  permissions: string[]
  rate_limit: number
  created_at: string
  expires_at: string | null
  usage_count: number
  allowed_ips: string[]
}

function CreateKeyForm({ onCreate }: { onCreate: (keyData: any) => void }) {
  const [allowedIps, setAllowedIps] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsLoading(true)
    try {
      const keyData = {
        ipWhitelist: allowedIps ? allowedIps.split(',').map(ip => ip.trim()) : []
      }
      await onCreate(keyData)
    } catch (error) {
      console.error('Error creating API key:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-muted/50 p-4 rounded-lg">
        <h4 className="text-sm font-medium mb-2">Personal Trading API Key</h4>
        <p className="text-xs text-muted-foreground">
          Your personal API key will have <strong>read</strong> and <strong>trade</strong> permissions 
          with a rate limit of <strong>5,000 requests/hour</strong>.
        </p>
      </div>

      <div>
        <label className="text-sm text-muted-foreground">Allowed IPs (optional)</label>
        <UiInput 
          value={allowedIps} 
          onChange={(e) => setAllowedIps(e.target.value)} 
          className="mt-2"
          placeholder="192.168.1.1, 10.0.0.1 (comma-separated)"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Leave empty to allow access from any IP address.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button variant="ghost" disabled={isLoading}>Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Personal API Key'}
        </Button>
      </div>
    </form>
  )
}

export default function ApiAccessPage() {
  const [apiKey, setApiKey] = useState<ApiKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewKey, setViewKey] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [newKeyCredentials, setNewKeyCredentials] = useState<{key_id: string, secret_key: string} | null>(null)
  const { toast } = useToast()

  // Load API key on component mount
  useEffect(() => {
    loadApiKey()
  }, [])

  const loadApiKey = async () => {
    try {
      setLoading(true)
      const response = await apiKeysService.getApiKey()
      setApiKey(response.data)
    } catch (error) {
      console.error('Error loading API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to load API key',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (value: string, name?: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast({ title: 'Copied', description: name ? `${name} copied to clipboard` : 'Copied to clipboard' })
    } catch (e) {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard', variant: 'destructive' })
    }
  }

  const handleCreate = async (keyData: any) => {
    try {
      const response = await apiKeysService.createApiKey(keyData)
      
      if (response.success) {
        setNewKeyCredentials({
          key_id: response.data.key_id,
          secret_key: response.data.secret_key
        })
        
        await loadApiKey()
        setCreateOpen(false)
        
        toast({ 
          title: 'Personal API key created', 
          description: 'Your trading API key has been created successfully' 
        })
      }
    } catch (error: any) {
      console.error('Error creating API key:', error)
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to create API key',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async () => {
    try {
      const response = await apiKeysService.deleteApiKey()
      
      if (response.success) {
        setApiKey(null)
        toast({ 
          title: 'API key deleted', 
          description: 'Your personal API key has been deleted successfully' 
        })
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete API key',
        variant: 'destructive'
      })
    }
    setDeleteConfirmOpen(false)
  }

  const handleToggleStatus = async () => {
    try {
      if (!apiKey) return

      const newStatus = apiKey.status === 'active' ? 'inactive' : 'active'
      const isActive = newStatus === 'active'
      
      const response = await apiKeysService.updateApiKey({ 
        isActive
      })
      
      if (response.success) {
        setApiKey({
          ...apiKey,
          status: newStatus
        })
        toast({ 
          title: 'API key updated', 
          description: `API key has been ${newStatus === 'active' ? 'activated' : 'deactivated'}` 
        })
      }
    } catch (error) {
      console.error('Error updating API key:', error)
      toast({
        title: 'Error',
        description: 'Failed to update API key',
        variant: 'destructive'
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatLastUsed = (lastUsedAt: string | null) => {
    if (!lastUsedAt) return 'Never'
    const date = new Date(lastUsedAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours} hours ago`
    return `${diffDays} days ago`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <TradingSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

        <main className={`flex-1 flex flex-col gap-6 overflow-auto transition-all duration-300 w-full ${
          sidebarCollapsed ? "pl-20 pr-6 pt-6 pb-6" : "pl-68 pr-6 pt-6 pb-6"
        }`}>
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Loading API key...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: API overview */}
              <aside className="lg:col-span-1 space-y-6">
                <Card className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-muted/10 flex items-center justify-center text-muted-foreground">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Personal Trading API</h2>
                      <p className="text-sm text-muted-foreground mt-1">Your personal API key for trading operations. One key per account for security.</p>
                      <div className="mt-4 flex items-center gap-3">
                        <div className="text-sm">
                          <div className="text-xs text-muted-foreground">Status</div>
                          <div className="text-lg font-medium">{apiKey ? 'Created' : 'Not Created'}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-xs text-muted-foreground">Active</div>
                          <div className="text-lg font-medium">{apiKey?.status === 'active' ? 'Yes' : 'No'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    {!apiKey ? (
                      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full inline-flex items-center justify-center gap-2">
                            <Plus className="h-4 w-4" /> Create Personal API Key
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-md md:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Create Personal Trading API Key</DialogTitle>
                            <DialogDescription>
                              Create your personal API key for trading operations. This key will have read and trade permissions.
                            </DialogDescription>
                          </DialogHeader>
                          <CreateKeyForm onCreate={handleCreate} />
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <div className="space-y-3">
                        <Button 
                          variant="outline" 
                          className="w-full" 
                          onClick={() => setViewKey(true)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View API Key Details
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full" 
                          onClick={handleToggleStatus}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {apiKey.status === 'active' ? 'Deactivate' : 'Activate'} API Key
                        </Button>
                        <Button 
                          variant="destructive" 
                          className="w-full" 
                          onClick={() => setDeleteConfirmOpen(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete API Key
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="p-4">
                  <CardHeader>
                    <CardTitle>Security Notice</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Keep your API credentials secure. The secret key is only shown once during creation.</p>
                  </CardContent>
                </Card>
              </aside>

              {/* Right: API key details + docs */}
              <section className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Personal Trading API Key</h3>
                    <p className="text-sm text-muted-foreground">Your personal API key for automated trading</p>
                  </div>
                </div>

                {apiKey ? (
                  <Card className="p-4">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      <div className="h-10 w-10 rounded-md bg-muted/10 flex items-center justify-center text-muted-foreground shrink-0">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">Personal Trading API Key</div>
                        <div className="text-xs text-muted-foreground break-words">
                          Created {formatDate(apiKey.created_at)} • {formatLastUsed(apiKey.last_used_at)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {apiKey.permissions.map((p: string) => (
                            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                        <Badge variant={apiKey.status === 'active' ? 'secondary' : 'outline'} className="text-xs">
                          {apiKey.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            className="p-2" 
                            onClick={handleToggleStatus} 
                            title={apiKey.status === 'active' ? 'Deactivate' : 'Activate'}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" className="p-2" onClick={() => setViewKey(true)} title="View Key Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" className="p-2" onClick={() => handleCopy(apiKey.key_id, 'API Key')} title="Copy Key ID">
                            <Clipboard className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            className="p-2" 
                            onClick={() => setDeleteConfirmOpen(true)} 
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-8 text-center">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No API Key Created</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your personal trading API key to start automated trading operations.
                    </p>
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Personal API Key
                    </Button>
                  </Card>
                )}

                {/* Comprehensive API Documentation */}
                <section className="mt-8 space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold">🚀 Trading API Documentation</h3>
                    <p className="text-sm text-muted-foreground mt-1">Complete guide to using your personal API key for automated trading</p>
                  </div>

                  {/* Authentication Section */}
                  <Card className="p-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Authentication
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">Every API request must include your credentials in the headers:</p>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <code className="text-xs block whitespace-pre-wrap">
{`X-API-Key: tk_your_api_key_here
X-API-Secret: your_api_secret_here
Content-Type: application/json`}
                        </code>
                      </div>
                      <div className="text-xs text-amber-600 flex items-center gap-1">
                        <span>⚠️</span>
                        <span>Base URL: <code className="bg-muted px-1 rounded">http://localhost:3001/api/v1</code></span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Available Endpoints */}
                  <Card className="p-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">📊 Available Endpoints</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Get Account */}
                      <div className="border-l-2 border-blue-500 pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">GET</Badge>
                          <code className="text-sm">/account</code>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Get your account information, balance, and trading statistics</p>
                        <div className="bg-muted/30 p-2 rounded text-xs">
                          <code>curl -H "X-API-Key: YOUR_KEY" -H "X-API-Secret: YOUR_SECRET" http://localhost:3001/api/v1/account</code>
                        </div>
                      </div>

                      {/* Get Positions */}
                      <div className="border-l-2 border-green-500 pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">GET</Badge>
                          <code className="text-sm">/positions</code>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">View all your current open positions</p>
                        <div className="bg-muted/30 p-2 rounded text-xs">
                          <code>curl -H "X-API-Key: YOUR_KEY" -H "X-API-Secret: YOUR_SECRET" http://localhost:3001/api/v1/positions</code>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Query params: <code>?status=open</code>, <code>?symbol=EURUSD</code>
                        </p>
                      </div>

                      {/* Open Position */}
                      <div className="border-l-2 border-orange-500 pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs bg-orange-50">POST</Badge>
                          <code className="text-sm">/positions</code>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Open a new trading position (buy/sell)</p>
                        <div className="bg-muted/30 p-2 rounded text-xs">
                          <code className="whitespace-pre-wrap">{`curl -X POST -H "X-API-Key: YOUR_KEY" -H "X-API-Secret: YOUR_SECRET" \\
     -H "Content-Type: application/json" \\
     -d '{"symbol": "EURUSD", "position_type": "buy", "volume": 0.1, "stop_loss": 1.1200, "take_profit": 1.1300}' \\
     http://localhost:3001/api/v1/positions`}</code>
                        </div>
                        <div className="mt-2 text-xs">
                          <p className="font-medium mb-1">Required fields:</p>
                          <ul className="text-muted-foreground space-y-1 ml-4">
                            <li>• <code>symbol</code>: Trading pair (e.g., "EURUSD")</li>
                            <li>• <code>position_type</code>: "buy" or "sell"</li>
                            <li>• <code>volume</code>: Position size in lots</li>
                          </ul>
                          <p className="font-medium mb-1 mt-2">Optional fields:</p>
                          <ul className="text-muted-foreground space-y-1 ml-4">
                            <li>• <code>stop_loss</code>: Stop loss price</li>
                            <li>• <code>take_profit</code>: Take profit price</li>
                          </ul>
                        </div>
                      </div>

                      {/* Close Position */}
                      <div className="border-l-2 border-red-500 pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs bg-red-50">DELETE</Badge>
                          <code className="text-sm">/positions/{`{id}`}</code>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Close an existing open position</p>
                        <div className="bg-muted/30 p-2 rounded text-xs">
                          <code>curl -X DELETE -H "X-API-Key: YOUR_KEY" -H "X-API-Secret: YOUR_SECRET" http://localhost:3001/api/v1/positions/123</code>
                        </div>
                      </div>

                      {/* Get History */}
                      <div className="border-l-2 border-purple-500 pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">GET</Badge>
                          <code className="text-sm">/history</code>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Get your trading history (closed positions)</p>
                        <div className="bg-muted/30 p-2 rounded text-xs">
                          <code>curl -H "X-API-Key: YOUR_KEY" -H "X-API-Secret: YOUR_SECRET" "http://localhost:3001/api/v1/history?limit=10"</code>
                        </div>
                      </div>

                      {/* Market Data */}
                      <div className="border-l-2 border-cyan-500 pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">GET</Badge>
                          <code className="text-sm">/market/{`{symbol}`}</code>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Get current market data for a trading symbol</p>
                        <div className="bg-muted/30 p-2 rounded text-xs">
                          <code>curl -H "X-API-Key: YOUR_KEY" -H "X-API-Secret: YOUR_SECRET" http://localhost:3001/api/v1/market/EURUSD</code>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Response Format */}
                  <Card className="p-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">📋 Response Format</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">All API responses follow this consistent format:</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium mb-2 text-green-600">✅ Success Response:</p>
                          <div className="bg-muted/30 p-3 rounded text-xs">
                            <code className="whitespace-pre-wrap">{`{
  "success": true,
  "data": {
    "position_id": 123,
    "symbol": "EURUSD",
    "status": "open",
    ...
  }
}`}</code>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium mb-2 text-red-600">❌ Error Response:</p>
                          <div className="bg-muted/30 p-3 rounded text-xs">
                            <code className="whitespace-pre-wrap">{`{
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid API key or secret"
}`}</code>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Programming Examples */}
                  <Card className="p-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">👨‍💻 Programming Examples</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Python Example */}
                      <div>
                        <p className="text-sm font-medium mb-2">Python Example:</p>
                        <div className="bg-muted/30 p-3 rounded text-xs overflow-x-auto">
                          <code className="whitespace-pre-wrap">{`import requests

headers = {
    'X-API-Key': 'tk_your_api_key_here',
    'X-API-Secret': 'your_api_secret_here',
    'Content-Type': 'application/json'
}

# Get account info
response = requests.get('http://localhost:3001/api/v1/account', headers=headers)
print(response.json())

# Open position
position_data = {
    'symbol': 'EURUSD',
    'position_type': 'buy',
    'volume': 0.1,
    'stop_loss': 1.1200,
    'take_profit': 1.1300
}
response = requests.post('http://localhost:3001/api/v1/positions', 
                        headers=headers, json=position_data)
print(response.json())`}</code>
                        </div>
                      </div>

                      {/* JavaScript Example */}
                      <div>
                        <p className="text-sm font-medium mb-2">JavaScript/Node.js Example:</p>
                        <div className="bg-muted/30 p-3 rounded text-xs overflow-x-auto">
                          <code className="whitespace-pre-wrap">{`const axios = require('axios');

const headers = {
    'X-API-Key': 'tk_your_api_key_here',
    'X-API-Secret': 'your_api_secret_here',
    'Content-Type': 'application/json'
};

async function getPositions() {
    try {
        const response = await axios.get('http://localhost:3001/api/v1/positions', { headers });
        console.log(response.data);
    } catch (error) {
        console.error('Error:', error.response.data);
    }
}

getPositions();`}</code>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rate Limits & Security */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-4">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">⚡ Rate Limits</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Requests per hour:</span>
                          <span className="font-medium">5,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Concurrent requests:</span>
                          <span className="font-medium">10</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          Rate limit info is included in response headers:
                        </p>
                        <code className="text-xs bg-muted/50 p-2 rounded block">
                          X-RateLimit-Remaining: 4,999
                        </code>
                      </CardContent>
                    </Card>

                    <Card className="p-4">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">🔒 Security Best Practices</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <ul className="text-muted-foreground space-y-1">
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">•</span>
                            <span>Never share your API credentials</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">•</span>
                            <span>Use HTTPS in production</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">•</span>
                            <span>Set up IP whitelisting</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">•</span>
                            <span>Monitor API usage regularly</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">•</span>
                            <span>Rotate credentials periodically</span>
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>

                  {/* JSON Format Documentation */}
                  <Card className="p-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">📋 JSON Request/Response Examples</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      
                      {/* Open Position Example */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400">Open Position (POST /positions)</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium mb-2 text-muted-foreground">Request Body:</p>
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                              <code className="text-xs whitespace-pre-wrap text-slate-800 dark:text-slate-200">{`{
  "symbol": "EURUSD",
  "position_type": "buy",
  "volume": 0.1,
  "stop_loss": 1.1200,
  "take_profit": 1.1300
}`}</code>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-2 text-muted-foreground">Response:</p>
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                              <code className="text-xs whitespace-pre-wrap text-green-800 dark:text-green-200">{`{
  "success": true,
  "data": {
    "position_id": 124,
    "symbol": "EURUSD",
    "position_type": "buy",
    "volume": 0.1,
    "open_price": 1.1234,
    "stop_loss": 1.1200,
    "take_profit": 1.1300,
    "status": "open"
  }
}`}</code>
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded border border-slate-700">
                          <p className="text-xs font-medium mb-2 text-slate-300 dark:text-slate-400">cURL Example:</p>
                          <code className="text-xs text-green-400 dark:text-green-300 whitespace-pre-wrap break-all">{`curl -X POST http://localhost:3001/api/v1/positions \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-API-Secret: YOUR_API_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "symbol": "EURUSD",
    "position_type": "buy",
    "volume": 0.1,
    "stop_loss": 1.1200,
    "take_profit": 1.1300
  }'`}</code>
                        </div>
                      </div>

                      {/* Get Positions Example */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Get Positions (GET /positions)</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium mb-2 text-muted-foreground">Query Parameters:</p>
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                              <code className="text-xs whitespace-pre-wrap text-slate-800 dark:text-slate-200">{`?status=open
?symbol=EURUSD
?limit=10
?offset=0`}</code>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-2 text-muted-foreground">Response:</p>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
                              <code className="text-xs whitespace-pre-wrap text-blue-800 dark:text-blue-200">{`{
  "success": true,
  "data": [
    {
      "position_id": 123,
      "symbol": "EURUSD",
      "position_type": "buy",
      "volume": 0.1,
      "open_price": 1.1234,
      "current_price": 1.1250,
      "profit_loss": 16.00,
      "status": "open"
    }
  ]
}`}</code>
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded border border-slate-700">
                          <p className="text-xs font-medium mb-2 text-slate-300 dark:text-slate-400">cURL Example:</p>
                          <code className="text-xs text-green-400 dark:text-green-300 whitespace-pre-wrap break-all">{`curl -H "X-API-Key: YOUR_API_KEY" \\
     -H "X-API-Secret: YOUR_API_SECRET" \\
     "http://localhost:3001/api/v1/positions?status=open"`}</code>
                        </div>
                      </div>

                      {/* Account Info Example */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-green-600 dark:text-green-400">Account Info (GET /account)</h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-medium mb-2 text-muted-foreground">No Request Body Needed</p>
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-center">
                              <span className="text-xs text-muted-foreground">Simple GET request</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-2 text-muted-foreground">Response:</p>
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
                              <code className="text-xs whitespace-pre-wrap text-green-800 dark:text-green-200">{`{
  "success": true,
  "data": {
    "account_id": 1,
    "balance": 10000.00,
    "equity": 10250.50,
    "margin": 250.50,
    "currency": "USD",
    "leverage": "1:100"
  }
}`}</code>
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-900 dark:bg-slate-950 p-3 rounded border border-slate-700">
                          <p className="text-xs font-medium mb-2 text-slate-300 dark:text-slate-400">cURL Example:</p>
                          <code className="text-xs text-green-400 dark:text-green-300 whitespace-pre-wrap break-all">{`curl -H "X-API-Key: YOUR_API_KEY" \\
     -H "X-API-Secret: YOUR_API_SECRET" \\
     http://localhost:3001/api/v1/account`}</code>
                        </div>
                      </div>

                      {/* Error Response Example */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-red-600 dark:text-red-400">Error Response Format</h4>
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                          <p className="text-xs font-medium mb-2 text-red-800 dark:text-red-200">Common Error Response:</p>
                          <code className="text-xs whitespace-pre-wrap text-red-800 dark:text-red-200">{`{
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid API key or secret"
}

// Other common errors:
{
  "error": "INSUFFICIENT_PERMISSIONS",
  "message": "Trade permission required to open positions"
}

{
  "error": "VALIDATION_ERROR", 
  "message": "Position type must be 'buy' or 'sell'"
}

{
  "error": "POSITION_NOT_FOUND",
  "message": "Position not found or already closed"
}`}</code>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Enhanced Quick Test Section */}
                  <Card className="p-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-lg">🧪</span>
                        <span className="font-medium">Quick Test Your API</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">Test your API key with this simple command:</p>
                      
                      <div className="bg-muted/40 p-4 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-muted-foreground/40"></div>
                            <div className="w-2 h-2 rounded-full bg-muted-foreground/60"></div>
                            <div className="w-2 h-2 rounded-full bg-muted-foreground/80"></div>
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">Terminal</span>
                        </div>
                        <code className="text-sm text-foreground whitespace-pre-wrap break-all font-mono leading-relaxed">
                          {`curl -H "X-API-Key: YOUR_API_KEY" \\
     -H "X-API-Secret: YOUR_API_SECRET" \\
     http://localhost:3001/api/v1/account`}
                        </code>
                      </div>
                      
                      <div className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg border">
                        <span className="text-muted-foreground text-lg">✅</span>
                        <div>
                          <p className="text-sm font-medium">If successful, you'll see your account information</p>
                          <p className="text-xs text-muted-foreground mt-1">This confirms your API key is working correctly</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                        <div className="flex items-center gap-2 text-xs bg-muted/20 p-2 rounded border">
                          <span>🔑</span>
                          <span className="text-muted-foreground">Replace YOUR_API_KEY</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs bg-muted/20 p-2 rounded border">
                          <span>🔐</span>
                          <span className="text-muted-foreground">Replace YOUR_API_SECRET</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs bg-muted/20 p-2 rounded border">
                          <span>⚡</span>
                          <span className="text-muted-foreground">Server must be running</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </section>
            </div>
          )}
        </main>

        {/* API Key Details Dialog */}
        {apiKey && (
          <Dialog open={viewKey} onOpenChange={setViewKey}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Personal Trading API Key</DialogTitle>
                <DialogDescription>
                  Your API key credentials and usage information.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Key ID</label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Input readOnly value={apiKey.key_id} className="flex-1 text-xs sm:text-sm" />
                    <Button variant="outline" onClick={() => handleCopy(apiKey.key_id, 'Key ID')} className="shrink-0">
                      <Clipboard className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Copy</span>
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Secret Key</label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <Input readOnly value="••••••••••••••••••••••••••••••••" className="flex-1 text-xs sm:text-sm" />
                    <Button variant="outline" disabled title="Secret key is hidden for security" className="shrink-0">
                      <Eye className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Hidden</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Secret key is only shown once during creation for security reasons.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Rate Limit:</span>
                    <span className="ml-2">{apiKey.rate_limit}/hour</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <span className="ml-2">{formatDate(apiKey.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2">{apiKey.status}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Used:</span>
                    <span className="ml-2">{formatLastUsed(apiKey.last_used_at)}</span>
                  </div>
                </div>
                {apiKey.allowed_ips && apiKey.allowed_ips.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Allowed IPs:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {apiKey.allowed_ips.map((ip: string) => (
                        <Badge key={ip} variant="outline" className="text-xs">{ip}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <DialogClose asChild>
                  <Button>Close</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Personal API Key</DialogTitle>
              <DialogDescription>Are you sure you want to delete your personal API key? This action cannot be undone.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* New API Key Credentials Dialog */}
        <Dialog 
          open={!!newKeyCredentials} 
          onOpenChange={(open) => !open && setNewKeyCredentials(null)}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                API Key Created Successfully
              </DialogTitle>
              <DialogDescription>
                <strong>Important:</strong> Save these credentials now. The secret key cannot be viewed again.
              </DialogDescription>
            </DialogHeader>
            
            {newKeyCredentials && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Key ID</label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <UiInput readOnly value={newKeyCredentials.key_id} className="flex-1 text-xs sm:text-sm" />
                    <Button variant="outline" onClick={() => handleCopy(newKeyCredentials.key_id, 'Key ID')} className="shrink-0">
                      <Clipboard className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Copy</span>
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Secret Key</label>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <UiInput readOnly value={newKeyCredentials.secret_key} className="flex-1 text-xs sm:text-sm" />
                    <Button variant="outline" onClick={() => handleCopy(newKeyCredentials.secret_key, 'Secret Key')} className="shrink-0">
                      <Clipboard className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Copy</span>
                    </Button>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Copy this secret key now. You won't be able to see it again!
                  </p>
                </div>

                <div className="bg-muted/50 p-3 sm:p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Quick Start</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    Use these credentials in your API requests:
                  </p>
                  <div className="bg-background p-3 rounded border overflow-x-auto">
                    <code className="text-xs whitespace-pre-wrap break-all block">
{`curl -H "X-API-Key: ${newKeyCredentials.key_id}" \
     -H "X-API-Secret: ${newKeyCredentials.secret_key}" \
     http://localhost:3001/api/v1/positions`}
                    </code>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button onClick={() => setNewKeyCredentials(null)} className="w-full sm:w-auto">
                I've Saved My Credentials
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Toaster />
      </div>
    </div>
  )
}