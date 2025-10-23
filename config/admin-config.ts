import {
  LayoutDashboard,
  Users,
  Receipt,
  TrendingUp,
  HeadphonesIcon,
  CreditCard,
  Handshake,
  Wallet,
  Coins,
} from "lucide-react"
import { SidebarItem, TopBarConfig } from "@/types/index"

export const adminSidebarItems: SidebarItem[] = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    href: "/admin",
    description: "Dashboard overview and analytics"
  },
  {
    title: "User Management",
    icon: Users,
    href: "/admin/users",
    description: "Manage users and accounts"
  },
  {
    title: "Trades & Charges",
    icon: Receipt,
    href: "/admin/trades-charges",
    description: "Trading fees and charges"
  },
  {
    title: "Trades",
    icon: TrendingUp,
    href: "/admin/trades",
    description: "Trading activities monitoring"
  },
  {
    title: "Support Tickets",
    icon: HeadphonesIcon,
    href: "/admin/support",
    description: "Customer support management"
  },
  {
    title: "Deposits",
    icon: CreditCard,
    href: "/admin/deposits",
    description: "Deposit transaction management"
  },
  {
    title: "Withdrawals",
    icon: Wallet,
    href: "/admin/withdrawals",
    description: "Withdrawal transaction management"
  },
  {
    title: "Introducing Brokers",
    icon: Handshake,
    href: "/admin/introducing-brokers",
    description: "Manage introducing broker relationships and shares"
  },
  {
    title: "Symbol Management",
    icon: Coins,
    href: "/admin/symbols",
    description: "Manage trading symbols and currency pairs"
  },
  {
    title: "Payment Gateway",
    icon: Wallet,
    href: "/admin/payment-gateway",
    description: "Payment processing settings"
  },
]

export const adminTopBarConfig: TopBarConfig = {
  title: "Admin Portal",
  showBalance: false,
  showNotifications: true,
  showDeposit: false,
  showUserMenu: true,
}

export const adminRoles = [
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
  { value: "administrator", label: "Administrator" },
]