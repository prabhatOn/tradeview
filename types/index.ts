export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d"

export interface TradeData {
  id: string
  symbol: string
  type: "BUY" | "SELL"
  lot: number
  openPrice: number
  currentPrice: number
  profit: number
  time: string
}

export interface SidebarItem {
  title: string
  icon: any
  href: string
  description?: string
}

export interface TopBarConfig {
  title: string
  showBalance?: boolean
  showNotifications?: boolean
  showDeposit?: boolean
  showUserMenu?: boolean
}
