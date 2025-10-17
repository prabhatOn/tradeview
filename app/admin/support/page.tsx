"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  LayoutDashboard,
  Users,
  Receipt,
  TrendingUp,
  HeadphonesIcon,
  CreditCard,
  Wallet,
  Search,
  Plus,
  Eye,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  MoreHorizontal,
  User,
  Calendar,
  Flag,
  UserCheck,
  Reply,
  ArrowRight
} from "lucide-react"

const supportTickets = [
  {
    id: 1,
    user: "John Doe",
    email: "john@example.com",
    subject: "Cannot login to my account",
    category: "account",
    priority: "high",
    status: "open",
    assignedTo: "Unassigned",
    created: "2024-01-20",
    lastUpdate: "2024-01-20",
    messages: 3,
    description: "I'm unable to access my trading account. Getting authentication error."
  },
  {
    id: 2,
    user: "Jane Smith",
    email: "jane@example.com", 
    subject: "Withdrawal request not processed",
    category: "payment",
    priority: "urgent",
    status: "in-progress",
    assignedTo: "Support Team",
    created: "2024-01-18",
    lastUpdate: "2024-01-19",
    messages: 5,
    description: "My withdrawal request submitted 3 days ago is still pending."
  },
  {
    id: 3,
    user: "Mike Johnson",
    email: "mike@example.com",
    subject: "Platform technical issues",
    category: "technical",
    priority: "medium",
    status: "resolved",
    assignedTo: "Tech Team",
    created: "2024-01-15",
    lastUpdate: "2024-01-17",
    messages: 8,
    description: "Trading platform freezing during high volatility periods."
  },
  {
    id: 4,
    user: "Sarah Wilson",
    email: "sarah@example.com",
    subject: "Account verification problems",
    category: "account",
    priority: "low",
    status: "open",
    assignedTo: "Unassigned",
    created: "2024-01-16",
    lastUpdate: "2024-01-16",
    messages: 2,
    description: "Need help with document verification process."
  },
  {
    id: 5,
    user: "David Brown",
    email: "david@example.com",
    subject: "Trading fees clarification",
    category: "billing",
    priority: "low",
    status: "resolved",
    assignedTo: "Finance Team",
    created: "2024-01-14",
    lastUpdate: "2024-01-15",
    messages: 4,
    description: "Questions about commission structure and trading fees."
  }
]

export default function SupportTicketsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const totalTickets = supportTickets.length
  const openTickets = supportTickets.filter(ticket => ticket.status === 'open').length
  const inProgressTickets = supportTickets.filter(ticket => ticket.status === 'in-progress').length
  const resolvedTickets = supportTickets.filter(ticket => ticket.status === 'resolved').length

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      default: return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'account': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'payment': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
      case 'technical': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
      case 'billing': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Support Tickets
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage user support requests and inquiries
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="bg-background/60 backdrop-blur-sm border-border/20">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg backdrop-blur-sm">
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <HeadphonesIcon className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalTickets}</div>
              <p className="text-xs text-muted-foreground">All time tickets</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{openTickets}</div>
              <p className="text-xs text-muted-foreground">Needs attention</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{inProgressTickets}</div>
              <p className="text-xs text-muted-foreground">Being worked on</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
                <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{resolvedTickets}</div>
              <p className="text-xs text-muted-foreground">Successfully closed</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background/60 backdrop-blur-sm border-border/20"
                />
              </div>
              <div className="flex items-center space-x-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-background/60 backdrop-blur-sm border-border/20">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-40 bg-background/60 backdrop-blur-sm border-border/20">
                    <SelectValue placeholder="All Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card className="bg-card/40 backdrop-blur-xl border border-border/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">
              Support Tickets ({supportTickets.length})
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage and respond to user support requests
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/20 overflow-hidden bg-background/30 backdrop-blur-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border/20">
                    <TableHead className="text-muted-foreground font-semibold">Ticket ID</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">User</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Subject</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Category</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Priority</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Assigned To</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Created</TableHead>
                    <TableHead className="text-muted-foreground font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supportTickets.map((ticket) => (
                    <TableRow key={ticket.id} className="hover:bg-muted/30 transition-colors border-border/20">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <HeadphonesIcon className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="font-semibold text-foreground">#{ticket.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">{ticket.user}</div>
                          <div className="text-xs text-muted-foreground">{ticket.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <div className="font-medium text-foreground truncate">{ticket.subject}</div>
                          <div className="text-xs text-muted-foreground flex items-center mt-1">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {ticket.messages} messages
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`font-medium ${getCategoryColor(ticket.category)}`}>
                          {ticket.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`font-medium ${getPriorityColor(ticket.priority)}`}>
                          <Flag className="h-3 w-3 mr-1" />
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status === 'in-progress' ? 'In Progress' : ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {ticket.assignedTo === 'Unassigned' ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              <User className="h-3 w-3 mr-1" />
                              Unassigned
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                              <UserCheck className="h-3 w-3 mr-1" />
                              {ticket.assignedTo}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{ticket.created}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/30">
                            <Reply className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-900/30">
                            <MoreHorizontal className="h-4 w-4 text-gray-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
                Urgent Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {supportTickets.filter(ticket => ticket.priority === 'urgent').map(ticket => (
                  <div key={ticket.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <div>
                      <div className="text-sm font-medium text-foreground">#{ticket.id} - {ticket.user}</div>
                      <div className="text-xs text-muted-foreground">{ticket.subject}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center">
                <Clock className="h-5 w-5 mr-2 text-yellow-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/20">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <div className="text-sm">
                    <span className="font-medium">Ticket #3</span> resolved by Tech Team
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/20">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <div className="text-sm">
                    <span className="font-medium">Ticket #2</span> assigned to Support Team
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/20">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <div className="text-sm">
                    <span className="font-medium">Ticket #1</span> priority updated to high
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-border/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center">
                <UserCheck className="h-5 w-5 mr-2 text-purple-600" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Support Team</span>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 w-3/4"></div>
                    </div>
                    <span className="text-xs text-muted-foreground">75%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tech Team</span>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-4/5"></div>
                    </div>
                    <span className="text-xs text-muted-foreground">90%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Finance Team</span>
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 w-full"></div>
                    </div>
                    <span className="text-xs text-muted-foreground">100%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}