"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, ChevronRight } from "lucide-react"
import { TradeDialog } from "@/components/trade-dialog"
import { useTrading } from "@/contexts/TradingContext"
import { useMarket } from "@/contexts/MarketContext"
import { useToast } from "@/hooks/use-toast"

interface Props {
  isOpen: boolean
  onClose: () => void
  inline?: boolean
}

const DEFAULT_SYMBOLS = ["EURUSD", "USDJPY", "GBPUSD", "XAUUSD", "BTCUSD"]

export default function WishlistPanel({ isOpen, onClose, inline = false }: Props) {
  const { toast } = useToast()
  const [symbols] = useState(DEFAULT_SYMBOLS)
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const { openPosition } = useTrading()
  const { setSelectedSymbol, marketData } = useMarket()

  type CreatePositionLike = Record<string, unknown>

  const quickOrder = async (symbol: string, side: 'buy' | 'sell') => {
    try {
      setLoading(prev => ({ ...prev, [symbol]: true }))
      // For quick orders we send a market order with 0.01 lots by default
      const payload: CreatePositionLike = {
        symbolId: symbol,
        side,
        lotSize: 0.01,
        orderType: 'market',
        triggerPrice: null,
        stopLoss: null,
        takeProfit: null,
        comment: `Quick ${side.toUpperCase()} ${symbol}`
      }

      await openPosition(payload)
      toast({ title: `Order placed`, description: `${side.toUpperCase()} ${symbol}` })
    } catch (err) {
      toast({ title: 'Order error', description: String(err), variant: 'destructive' })
    } finally {
      setLoading(prev => ({ ...prev, [symbol]: false }))
    }
  }

  // Inline mode: render as a docked panel (no backdrop/fixed positioning)
  if (inline) {
    // Inline mode - but on small screens we prefer overlay/drawer behavior.
    return (
      <div aria-hidden={!isOpen} className={`h-full ${isOpen ? 'block' : 'hidden'}`} role="region" aria-label="Wishlist panel">
        <div className="relative h-full">
          {/* Vertical close tab attached to the left edge of the panel */}
          <button
            type="button"
            aria-label="Close wishlist"
            onClick={onClose}
            className="absolute -left-4 top-1/2 -translate-y-1/2 h-24 w-8 flex items-center justify-center bg-card/80 rounded-r shadow-sm hover:bg-card/90 z-50"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>

          <Card className="h-full flex flex-col bg-card/90 backdrop-blur-md border-l">
            <div className="px-3 py-2 flex items-center justify-between border-b">
              <h3 className="font-semibold text-sm">Wishlist</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="px-3 py-2 space-y-2 overflow-auto h-full">
              {symbols.map((s) => (
                <div key={s} className="flex items-center justify-between py-2 rounded-md hover:bg-muted/20">
                  <div className="cursor-pointer" onClick={() => { setSelectedSymbol(s); onClose(); }}>
                    <div className="font-semibold text-sm">{s}</div>
                    <div className="text-xs text-muted-foreground">Quick actions</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const md = marketData.find(m => m.symbol === s)
                      const price = md?.currentPrice ?? md?.closePrice ?? 0
                      const symbolId = md?.symbolId ?? null
                      const bid = md?.bid ?? null
                      const ask = md?.ask ?? null
                      const fmt = (v: number | null | undefined) => (typeof v === 'number' ? v.toString() : '-')
                      return (
                        <>
                          <div className="text-right text-xs">
                            <div className="text-emerald-500">Bid: <span className="font-mono">{fmt(bid)}</span></div>
                            <div className="text-rose-500">Ask: <span className="font-mono">{fmt(ask)}</span></div>
                          </div>

                          <TradeDialog symbol={s} symbolId={symbolId ?? 0} price={String(ask ?? price)} type="buy">
                            <Button size="sm" className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">
                              Buy
                            </Button>
                          </TradeDialog>

                          <TradeDialog symbol={s} symbolId={symbolId ?? 0} price={String(bid ?? price)} type="sell">
                            <Button size="sm" variant="destructive" className="px-3 py-1 text-sm">
                              Sell
                            </Button>
                          </TradeDialog>
                        </>
                      )
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Default (overlay) mode - constrained to parent (chart) by using absolute positioning
  return (
    <div aria-hidden={!isOpen} className={`absolute inset-0 z-[70] ${isOpen ? '' : 'pointer-events-none'}`} role="dialog" aria-modal={isOpen}>
      {/* Backdrop for small opacity when open */}
      <div className={`absolute inset-0 bg-black/30 transition-opacity ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />

  <div className={`absolute top-0 right-0 h-full transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '26%' }}>
        <Card className="h-full flex flex-col bg-card/90 backdrop-blur-md border-l">
          <div className="p-3 flex items-center justify-between border-b">
            <h3 className="font-semibold">Wishlist</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-3 space-y-3 overflow-auto">
            {symbols.map((s) => (
              <div key={s} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30">
                <div>
                  <div className="font-semibold">{s}</div>
                  <div className="text-xs text-muted-foreground">Quick actions</div>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const md = marketData.find(m => m.symbol === s)
                    const bid = md?.bid ?? null
                    const ask = md?.ask ?? null
                    const fmt = (v: number | null | undefined) => (typeof v === 'number' ? v.toString() : '-')
                    return (
                      <>
                        <div className="text-right text-xs">
                          <div className="text-emerald-500">Bid: <span className="font-mono">{fmt(bid)}</span></div>
                          <div className="text-rose-500">Ask: <span className="font-mono">{fmt(ask)}</span></div>
                        </div>

                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => quickOrder(s, 'buy')} disabled={!!loading[s]}>
                          Buy
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => quickOrder(s, 'sell')} disabled={!!loading[s]}>
                          Sell
                        </Button>
                      </>
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
