"use client"

// no local state required
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed"
import { TradingSidebar } from "@/components/trading-sidebar"
import TradingChart from "@/components/trading-chart"
import PositionsTable from "@/components/positions-table"
import { ProtectedRoute } from "@/components/auth/protected-route"
// Notifications and wishlist removed per user request
import BottomStatsBar from "@/components/bottom-stats-bar"
import WishlistPanel from "@/components/wishlist-panel"
import { useState } from "react"
import { ChevronLeft } from "lucide-react"

export default function TradingDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed(false)
  const [isWishlistOpen, setIsWishlistOpen] = useState(true)

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
            className={`flex-1 flex flex-col overflow-auto transition-all duration-300 w-full ${
              sidebarCollapsed ? "sm:pl-20 pl-4 pr-4 pt-4 pb-10 sm:pb-28" : "sm:pl-68 pl-4 pr-4 pt-4 pb-10 sm:pb-28"
            }`}
          >
            {/* Notifications Section removed per request */}

            {/* Quick shortcuts removed from main - moved to mobile bottom nav per user request */}

            {/* Chart Section - expands to available space */}
        <section className=" h-[70vh] sm:min-h-[75vh] md:min-h-[50vh] lg:min-h-[70vh] relative">
              {/* On small screens stack vertically: chart -> wishlist -> positions
                  On larger screens show chart + wishlist docked as sibling columns. */}
              <div className="h-full w-full flex flex-col lg:flex-row">
                {/* Chart column */}
                <div className={`transition-all duration-300 relative ${isWishlistOpen ? 'lg:w-3/4 lg:h-full h-full' : 'w-full h-full'}`}>
                  <TradingChart key={isWishlistOpen ? 'split' : 'full'} />
                </div>

                {/* Dedicated tab column (independent space) - only on lg and up */}
                  <div className="hidden lg:flex w-16 items-center justify-center">
                  {!isWishlistOpen && (
                    <button
                      type="button"
                      aria-label="Open watchlist"
                      onClick={() => setIsWishlistOpen(true)}
                      className="h-32 w-full flex items-center justify-center bg-card/80 backdrop-blur shadow-md hover:bg-card/90 transition-all rounded-l px-1"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <ChevronLeft className="w-5 h-5 text-foreground" />
                        <span className="text-xs text-foreground/90 tracking-wider" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)'}}>
                          Watchlist
                        </span>
                      </div>
                    </button>
                  )}
                </div>

                {/* Wishlist column - only visible on large screens (hidden on mobile) */}
                <div className={`hidden lg:block transition-all duration-300 ${isWishlistOpen ? 'lg:w-1/4' : 'w-0 overflow-hidden'}`} style={isWishlistOpen ? { height: '100%' } : undefined}>
                  <WishlistPanel isOpen={isWishlistOpen} onClose={() => setIsWishlistOpen(false)} inline={true} />
                </div>
              </div>
            </section>

            {/* Positions Table - fixed at bottom, scrolls if long */}
            <section className="flex-shrink-0">
              <PositionsTable />
            </section>
          </main>

          {/* Wishlist removed per request */}
        </div>

        {/* Bottom stats bar (fixed) */}
        <BottomStatsBar />
      </div>
    </ProtectedRoute>
  )
}
