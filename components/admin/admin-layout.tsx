"use client"

import { useState } from "react"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminTopBar } from "@/components/admin/admin-topbar"
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed"

// Temporary inline types until we fix the imports
interface SidebarItem {
  title: string
  icon: any
  href: string
  description?: string
}

interface TopBarConfig {
  title: string
  showBalance?: boolean
  showNotifications?: boolean
  showDeposit?: boolean
  showUserMenu?: boolean
}

interface AdminLayoutProps {
  children: React.ReactNode
  sidebarItems: SidebarItem[]
  topBarConfig: TopBarConfig
}

export function AdminLayout({ children, sidebarItems, topBarConfig }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Fixed Sidebar */}
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        items={sidebarItems}
      />

      {/* Main Content Area */}
      <div
        className={`transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* Top Bar */}
        <AdminTopBar config={topBarConfig} />

        {/* Scrollable Content */}
        <main className="min-h-[calc(100vh-4rem)] overflow-auto">
          <div className="p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}