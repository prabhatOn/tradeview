"use client"

import { AdminLayout } from "@/components/admin/admin-layout"
import { adminSidebarItems, adminTopBarConfig } from '@/config/admin-config'
import { IBManagementPanel } from "@/components/admin/IBManagementPanel"

export default function AdminIntroducingBrokersPage() {
  return (
    <AdminLayout sidebarItems={adminSidebarItems} topBarConfig={adminTopBarConfig}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">IB Management</h1>
          <p className="text-muted-foreground">
            Manage introducing brokers, commissions, and global settings
          </p>
        </div>
        <IBManagementPanel />
      </div>
    </AdminLayout>
  )
}
