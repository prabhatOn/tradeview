"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { LogOut, Sun, Moon } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Shield } from "lucide-react"

interface TopBarConfig {
  title: string
  showBalance?: boolean
  showNotifications?: boolean
  showDeposit?: boolean
  showUserMenu?: boolean
}

interface AdminTopBarProps {
  config: TopBarConfig
}

export function AdminTopBar({ config }: AdminTopBarProps) {
  const { theme, setTheme } = useTheme()
  const { logout } = useAuth()
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState("super_admin")

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <header className="flex h-14 sm:h-16 items-center justify-between border-b bg-background px-4 sm:px-6 sticky top-0 z-30 border-border shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-mono truncate">
              {config.title}
            </h1>
            <p className="hidden xs:block text-xs text-muted-foreground font-medium truncate">Administrative Control Center</p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Role selector (small) */}
        <div className="hidden xs:flex items-center space-x-2">
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[140px] h-8 bg-card border-border shadow-sm font-medium text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="administrator">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Theme toggle */}
        <Button variant="ghost" size="sm" className="inline-flex p-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Sun className="h-5 w-5" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Logout */}
        <Button variant="ghost" size="sm" onClick={handleLogout} className="inline-flex items-center px-2">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}