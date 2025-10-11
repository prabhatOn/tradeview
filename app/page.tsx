"use client"

import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed"
import { TradingSidebar } from "@/components/trading-sidebar"
import TradingChart from "@/components/trading-chart"
import PositionsTable from "@/components/positions-table"
import { TopDashboardPanel } from "@/components/top-dashboard-panel"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { NotificationsFeed } from "@/components/notifications-feed"

export default function TradingDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <TradingSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        {/* Main Content */}
        <main
          className={`flex-1 flex flex-col gap-4 overflow-auto transition-all duration-300 w-full ${
            sidebarCollapsed ? "pl-20 pr-6 pt-4 pb-4" : "pl-68 pr-6 pt-4 pb-4"
          }`}
        >
          {/* Top Section - adaptive height */}
          <section className="flex-shrink-0">
            <TopDashboardPanel />
          </section>

          {/* Notifications Section */}
          <section className="flex-shrink-0">
            <NotificationsFeed />
          </section>

          {/* Chart Section - expands to available space */}
          <section className="flex-1 min-h-[300px]">
            <TradingChart />
          </section>

          {/* Positions Table - fixed at bottom, scrolls if long */}
          <section className="flex-shrink-0">
            <PositionsTable />
          </section>
        </main>
      </div>
    </div>
    </ProtectedRoute>
  )
}
