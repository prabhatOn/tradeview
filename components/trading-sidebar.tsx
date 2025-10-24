"use client"

import React, { useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  BarChart3,
  TrendingUp,
  History,
  Wallet,
  Key,
  UserCheck,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface SidebarProps {
  className?: string
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

const sidebarItems = [
  {
    title: "Dashboard",
    icon: BarChart3,
    href: "/",
  },
  {
    title: "Positions",
    icon: TrendingUp,
    href: "/positions",
  },
  {
    title: "History",
    icon: History,
    href: "/history",
  },
  {
    title: "Funds",
    icon: Wallet,
    href: "/funds",
  },
  {
    title: "API Access",
    icon: Key,
    href: "/api-access",
  },
  {
    title: "Introducing Broker",
    icon: UserCheck,
    href: "/introducing-broker",
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
  },
  {
    title: "Profile",
    icon: User,
    href: "/profile",
  },
]

export function TradingSidebar({ className, collapsed = false, onCollapsedChange }: SidebarProps) {
  const STORAGE_KEY = "sidebar_collapsed"

  // Read persisted value synchronously so initial render can use it and
  // avoid flashing the sidebar open when navigating between pages.
  const [persistedCollapsed, setPersistedCollapsed] = React.useState<boolean | null>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
      return raw === null ? null : raw === "true"
    } catch {
      return null
    }
  })

  // Effective collapsed state used for rendering. If we have a persisted
  // value use that; otherwise fall back to the parent-controlled prop.
  const isCollapsed = persistedCollapsed !== null ? persistedCollapsed : collapsed

  const handleToggle = () => {
    const next = !isCollapsed
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // ignore
    }

    setPersistedCollapsed(next)
    onCollapsedChange?.(next)
  }

  // When component mounts, if there's a persisted value, sync it into the
  // parent so other parts of the app reflect the user's preference.
  useEffect(() => {
    if (persistedCollapsed !== null && onCollapsedChange && persistedCollapsed !== collapsed) {
      onCollapsedChange(persistedCollapsed)
    }
    // We only want to run this on mount; deps intentionally exclude
    // onCollapsedChange/collapsed to avoid repeated updates during normal
    // renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pathname = usePathname() || "/"

  // Mobile primary items: Dashboard, Positions, Funds (user requested)
  const mobilePrimary = [sidebarItems[0], sidebarItems[1], sidebarItems[3]]
  const mobileMore = sidebarItems.filter((it) => !mobilePrimary.includes(it))

  return (
    <>
      <div
        className={cn(
          // hide on small screens, show from `sm` and up
          "hidden sm:flex flex-col border-r bg-card transition-all duration-300 fixed top-16 left-0 h-[calc(100vh-4rem)] z-40",
          collapsed ? "w-16" : "w-64",
          "border-border",
          className,
        )}
      >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {/* Logo removed as requested - keep collapse toggle aligned to the right */}
        <div />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="h-8 w-8 p-0 hover:bg-accent/50"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation - No ScrollArea, fixed height */}
      <div className="flex-1 px-3 py-6 overflow-hidden">
        <nav className="space-y-2">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "w-full flex items-center h-12 transition-all duration-200 font-medium text-sm whitespace-nowrap",
                  collapsed ? "px-2 justify-center" : "px-4 justify-start",
                  isActive ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-accent/50 hover:text-accent-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", collapsed ? "mr-0" : "mr-3")} />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      {!collapsed && (
        <div className="p-4 border-t border-border bg-muted/10">
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p className="font-medium">TradePro v2.1.0</p>
            <p>© 2025 All rights reserved</p>
          </div>
        </div>
      )}
      </div>

      {/* Mobile bottom navigation - visible only on small screens */}
      <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-card/95 border-t sm:hidden">
        <nav className="flex items-center justify-between h-16 px-1">
          {mobilePrimary.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex-1 flex flex-col items-center justify-center py-1 text-xs",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                <Icon className="h-5 w-5" />
                <span className="mt-1 text-[10px]">{item.title}</span>
              </Link>
            )
          })}

          {/* Profile / More menu */}
          <div className="flex-1 flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center justify-center py-1 text-xs">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="" alt="Menu" />
                    <AvatarFallback>Me</AvatarFallback>
                  </Avatar>
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
