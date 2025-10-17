"use client"

import { CommissionDashboard } from "@/components/ib/CommissionDashboard"

export default function IBCommissionPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Commission Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Track your earnings, client performance, and commission breakdown
        </p>
      </div>
      <CommissionDashboard />
    </div>
  )
}
