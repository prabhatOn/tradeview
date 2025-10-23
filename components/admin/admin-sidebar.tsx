"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
// Separator intentionally removed; not used in this component
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  MoreVertical,
} from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
interface SidebarItem {
  title: string
  icon?: React.ElementType
  href: string
  description?: string
}

interface AdminSidebarProps {
  className?: string
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  items: SidebarItem[]
}

export function AdminSidebar({ className, collapsed = false, onCollapsedChange, items }: AdminSidebarProps) {
  const pathname = usePathname()

  const handleToggle = () => {
    onCollapsedChange?.(!collapsed)
  }

  // Mobile primary items: Overview, User Management, Trades (indexes chosen to match admin config)
  const mobilePrimary = [items[0], items[1], items[3]]
  const mobileMore = items.filter((it) => !mobilePrimary.includes(it))

  return (
    <>
    {/* Desktop/Large Sidebar (hidden on small screens) */}
    <div
      className={cn(
        "hidden lg:flex fixed left-0 top-0 h-screen flex-col bg-card border-r border-border transition-all duration-300 shadow-lg z-40",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground font-mono">
                AdminPro
              </h2>
              <p className="text-xs text-muted-foreground font-medium">Control Panel</p>
            </div>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="h-8 w-8 p-0 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {items.map((item, index) => {
            const isActive = pathname === item.href
            // Ensure icon is defined; fall back to Shield if missing
            const Icon = item.icon || Shield

            return (
              <Link key={index} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group relative",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    collapsed ? "justify-center px-2" : "justify-start"
                  )}
                >
                  
                  {Icon ? (
                    <Icon className={cn(
                      "h-4 w-4 flex-shrink-0 transition-colors duration-200",
                      collapsed ? "" : "mr-3"
                    )} />
                  ) : (
                    <Shield className="h-4 w-4 flex-shrink-0 transition-colors duration-200" />
                  )}
                  
                  {!collapsed && (
                    <span className="font-medium truncate">{item.title}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-4 mt-auto">
        {!collapsed ? (
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Admin Panel</p>
              <p className="text-xs text-muted-foreground font-mono">v1.0.0</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Mobile Bottom Navigation - visible only on small screens */}
    <div className="fixed bottom-0 w-full z-[9999] bg-card/95 border-t lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <nav className="flex items-center justify-between h-16 px-2 w-full mx-2 rounded-t-lg">
        {mobilePrimary.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex-1 flex flex-col items-center justify-center py-1 text-xs",
              isActive ? "text-primary" : "text-muted-foreground"
            )}>
              {Icon && <Icon className="h-5 w-5" />}
              <span className="mt-1 text-center text-[10px]">{item.title}</span>
            </Link>
          )
        })}

        {/* More menu in center */}
        <div className="flex-1 flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center py-1 text-xs">
                <MoreVertical className="h-5 w-5" />
                <span className="mt-1 text-[10px]">More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {mobileMore.map((it) => (
                <DropdownMenuItem asChild key={it.href}>
                  <Link href={it.href}>{it.title}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
    </>
  )
}