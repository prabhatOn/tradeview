"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Bell, 
  Moon, 
  Sun, 
  Settings, 
  User, 
  LogOut, 
  Wallet,
  ChevronDown,
  Shield,
  Crown,
  UserCog
} from "lucide-react"
import { useTheme } from "next-themes"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

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
  const router = useRouter()
  const { logout } = useAuth()
  const [notifications] = useState(5)
  const [selectedRole, setSelectedRole] = useState("super_admin")

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const roleIcons = {
    admin: User,
    super_admin: Crown,
    administrator: UserCog,
  }

  const roleColors = {
    admin: "text-blue-600 dark:text-blue-400",
    super_admin: "text-yellow-600 dark:text-yellow-400",
    administrator: "text-purple-600 dark:text-purple-400",
  }

  const getRoleIcon = (role: string) => {
    const IconComponent = roleIcons[role as keyof typeof roleIcons] || User
    return IconComponent
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6 sticky top-0 z-30 border-border shadow-sm">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
              {config.title}
            </h1>
            <p className="text-xs text-muted-foreground font-medium">Administrative Control Center</p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Role Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Role:</span>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[160px] h-9 bg-card border-border shadow-sm font-medium">
              <div className="flex items-center space-x-2">
                {React.createElement(getRoleIcon(selectedRole), { 
                  className: `h-4 w-4 ${roleColors[selectedRole as keyof typeof roleColors]}` 
                })}
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <span>Admin</span>
                </div>
              </SelectItem>
              <SelectItem value="super_admin">
                <div className="flex items-center space-x-2">
                  <Crown className="h-4 w-4 text-yellow-600" />
                  <span>Super Admin</span>
                </div>
              </SelectItem>
              <SelectItem value="administrator">
                <div className="flex items-center space-x-2">
                  <UserCog className="h-4 w-4 text-purple-600" />
                  <span>Administrator</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Funds Button */}
        {config.showDeposit ? (
          <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 shadow-sm hover:shadow-md transition-all duration-200" asChild>
            <Link href="/admin/deposits-withdrawals">
              <Wallet className="h-4 w-4 mr-2" />
              Funds
            </Link>
          </Button>
        ) : null}

        {/* Notifications */}
        {config.showNotifications && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative hover:bg-accent/50">
                <Bell className="h-5 w-5" />
                {notifications > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs animate-pulse">
                    {notifications}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-card border-border shadow-lg">
              <DropdownMenuLabel className="flex items-center justify-between font-semibold">
                <span>Admin Notifications</span>
                <Badge variant="secondary" className="text-xs font-medium">{notifications}</Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="p-4" asChild>
                <Link href="/admin/overview" className="flex flex-col space-y-1 w-full">
                  <p className="text-sm font-medium text-orange-600">System Alert</p>
                  <p className="text-xs text-muted-foreground">High volume trading detected - system monitoring required</p>
                  <p className="text-xs text-muted-foreground">2 minutes ago</p>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-4" asChild>
                <Link href="/admin/users" className="flex flex-col space-y-1 w-full">
                  <p className="text-sm font-medium text-blue-600">New User Registration</p>
                  <p className="text-xs text-muted-foreground">15 new users registered in the last hour</p>
                  <p className="text-xs text-muted-foreground">5 minutes ago</p>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-4" asChild>
                <Link href="/admin/overview" className="flex flex-col space-y-1 w-full">
                  <p className="text-sm font-medium text-red-600">Security Alert</p>
                  <p className="text-xs text-muted-foreground">Multiple failed login attempts detected</p>
                  <p className="text-xs text-muted-foreground">10 minutes ago</p>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="hover:bg-accent/50"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Settings */}
        <Button variant="ghost" size="sm" className="hover:bg-accent/50" asChild>
          <Link href="/admin/overview">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>

        {/* Profile Menu */}
        {config.showUserMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-3 hover:bg-accent px-3 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <Shield className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium">John Admin</p>
                  <p className="text-xs text-muted-foreground">System Administrator</p>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-lg">
              <DropdownMenuLabel>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">John Admin</p>
                    <p className="text-xs text-muted-foreground">admin@tradepro.com</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center w-full">
                  <User className="mr-2 h-4 w-4" />
                  Profile Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/overview" className="flex items-center w-full">
                  <Settings className="mr-2 h-4 w-4" />
                  Admin Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/overview" className="flex items-center w-full">
                  <Shield className="mr-2 h-4 w-4" />
                  Security Center
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-600 focus:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-medium cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}