"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Bell, Check, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { useNotifications, useMarkNotificationAsRead } from "@/hooks/use-trading"
import { useToast } from "@/hooks/use-toast"
import type { Notification } from "@/lib/types"

const typeStyles: Record<Notification["type"], string> = {
  info: "border-border/50 bg-blue-500/10 text-blue-600",
  success: "border-green-500/40 bg-green-500/10 text-green-600",
  warning: "border-yellow-500/40 bg-yellow-500/10 text-yellow-600",
  error: "border-red-500/40 bg-red-500/10 text-red-600",
  trading: "border-purple-500/40 bg-purple-500/10 text-purple-600",
  transaction: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  price_alert: "border-cyan-500/40 bg-cyan-500/10 text-cyan-600",
}

const getNotificationTypeStyle = (type: Notification["type"]) =>
  typeStyles[type] ?? "border-border/40 bg-muted/40 text-muted-foreground"

export function NotificationsFeed() {
  const { data: notifications, isLoading, error, refresh } = useNotifications()
  const markNotificationAsRead = useMarkNotificationAsRead()
  const { toast } = useToast()
  const [markingId, setMarkingId] = useState<number | null>(null)

  const unreadCount = useMemo(() => (notifications ?? []).filter((item) => !item.isRead).length, [notifications])

  const handleRefresh = () => {
    refresh()
  }

  const handleMarkAsRead = async (id: number) => {
    try {
      setMarkingId(id)
      await markNotificationAsRead(id)
      refresh()
    } catch (markError) {
      const message = markError instanceof Error ? markError.message : "Failed to update notification"
      toast({
        variant: "destructive",
        title: "Unable to mark as read",
        description: message,
      })
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-muted/30">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Notifications</CardTitle>
              <CardDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread` 
                  : "You're all caught up. We'll let you know when something changes."}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-9 w-9"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")}
            />
            <span className="sr-only">Refresh notifications</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Notifications unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (!notifications || notifications.length === 0) ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`notification-skeleton-${index}`}
                className="h-20 rounded-lg border border-border/30 bg-muted/20 animate-pulse"
              />
            ))}
          </div>
        ) : notifications && notifications.length ? (
          <ScrollArea className="max-h-80 pr-2">
            <div className="space-y-3">
              {notifications.map((notification) => {
                const relativeTime = notification.createdAt
                  ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
                  : ""

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "rounded-lg border p-3 text-sm transition-colors",
                      notification.isRead ? "border-border/30 bg-background/60" : "border-primary/40 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 pr-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getNotificationTypeStyle(notification.type)}>
                            {notification.type.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{relativeTime}</span>
                        </div>
                        <p className="font-medium text-foreground">{notification.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {notification.message}
                        </p>
                      </div>
                      <Button
                        variant={notification.isRead ? "outline" : "secondary"}
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={notification.isRead || markingId === notification.id}
                        title={notification.isRead ? "Notification already read" : "Mark as read"}
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">Mark as read</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
            No notifications yet. Activity updates will appear here.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
