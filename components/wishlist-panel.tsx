"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, ChevronRight } from "lucide-react"
import { TradeDialog } from "@/components/trade-dialog"
import { useTrading } from "@/contexts/TradingContext"
import { useMarket } from "@/contexts/MarketContext"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"
import { marketService } from "@/lib/services"

interface Props {
  isOpen: boolean
  onClose: () => void
  inline?: boolean
}

const DEFAULT_SYMBOLS = ["EURUSD", "USDJPY", "GBPUSD", "XAUUSD", "BTCUSD"]

type SymbolResult = { id: number; symbol: string; name?: string }

export default function WishlistPanel({ isOpen, onClose, inline = false }: Props) {
  const { toast } = useToast()
  const [symbols, setSymbols] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('watchlist_symbols')
        if (raw) return JSON.parse(raw)
      }
    } catch {
      // ignore
    }
    return DEFAULT_SYMBOLS
  })
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 300)
  const [searchResults, setSearchResults] = useState<SymbolResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

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

  // Persist watchlist symbols to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('watchlist_symbols', JSON.stringify(symbols))
      }
    } catch {
      // ignore
    }
  }, [symbols])

  // Search backend symbols when query debounces
  useEffect(() => {
    let cancelled = false
    const doSearch = async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        setSearchResults([])
        setSearchLoading(false)
        return
      }
      setSearchLoading(true)
      try {
        const res = await marketService.searchSymbols(debouncedQuery.trim())
        if (!cancelled) {
          // response shape may vary: try several fields
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const results = (res?.symbols) || (res?.data?.symbols) || (Array.isArray(res) ? res : [])
          setSearchResults(results)
        }
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }

    doSearch()

    return () => { cancelled = true }
  }, [debouncedQuery])

  const addSymbolToWatchlist = (r: { symbol: string }) => {
    const sym = (r.symbol || '').toUpperCase()
    if (!sym) return
    if (symbols.includes(sym)) {
      toast({ title: 'Already in watchlist', description: sym })
      return
    }
    setSymbols(prev => [sym, ...prev].slice(0, 100))
    toast({ title: 'Added to watchlist', description: sym })
    setSearchQuery('')
    setSearchResults([])
  }

  const removeSymbolFromWatchlist = (sym: string) => {
    setSymbols(prev => prev.filter(s => s !== sym))
  }

  // Inline mode: render as a docked panel (no backdrop/fixed positioning)
  if (inline) {
    // Inline mode - but on small screens we prefer overlay/drawer behavior.
    return (
      <div aria-hidden={!isOpen} className={`w-full ${isOpen ? 'block' : 'hidden'}`} role="region" aria-label="Watchlist panel" style={{ height: '80%' }}>
        <div className="relative" style={{ height: '100%' }}>
          {/* Vertical close tab attached to the left edge of the panel */}
          <button
            type="button"
            aria-label="Close wishlist"
            onClick={onClose}
            className="absolute -left-4 top-1/2 -translate-y-1/2 h-24 w-8 flex items-center justify-center bg-card/80 rounded-r shadow-sm hover:bg-card/90 z-50"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>

          <Card className="flex flex-col bg-card/90 backdrop-blur-md border-l" style={{ height: '100%' }}>
            <div className="px-3 py-2 flex items-center justify-between border-b">
              <h3 className="font-semibold text-sm">Watchlist</h3>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Search symbols"
                  placeholder="Search symbols..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-2 py-1 rounded-md bg-card border border-border text-sm"
                />
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="px-3 py-2 space-y-2 overflow-auto" style={{ height: 'calc(100% - 8px)' }}>
              {searchQuery.trim().length >= 2 ? (
                searchLoading ? (
                  <div className="text-sm">Searching...</div>
                ) : (
                  searchResults.length ? (
                    searchResults.map((r: SymbolResult) => (
                      <div key={r.id} className="flex items-center justify-between py-2 rounded-md hover:bg-muted/20">
                        <div>
                          <div className="font-semibold text-sm">{r.symbol}</div>
                          <div className="text-xs text-muted-foreground">{r.name}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => addSymbolToWatchlist(r)}>Add</Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm">No results</div>
                  )
                )
              ) : (
                symbols.map((s) => {
                  const md = marketData.find(m => m.symbol === s)
                  const price = md?.currentPrice ?? md?.closePrice ?? 0
                  const symbolId = md?.symbolId ?? null
                  const bid = md?.bid ?? null
                  const ask = md?.ask ?? null
                  const fmt = (v: number | null | undefined) => (typeof v === 'number' ? v.toString() : '-')
                  return (
                    <div key={s} className="flex p-1 items-center justify-between py-2 rounded-md hover:bg-muted/20">
                      <div className="cursor-pointer" onClick={() => { setSelectedSymbol(s); onClose(); }}>
                        <div className="font-semibold text-sm">{s}</div>
                        <div className="text-xs text-muted-foreground">Quick actions</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs">
                          <div className="text-emerald-500">Bid: <span className="font-mono">{fmt(bid)}</span></div>
                          <div className="text-rose-500">Ask: <span className="font-mono">{fmt(ask)}</span></div>
                        </div>

                        <TradeDialog symbol={s} symbolId={symbolId ?? 0} price={String(ask ?? price)} type="buy">
                          <Button size="sm" className="px-2 py-0.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">Buy</Button>
                        </TradeDialog>

                        <TradeDialog symbol={s} symbolId={symbolId ?? 0} price={String(bid ?? price)} type="sell">
                          <Button size="sm" variant="destructive" className="px-2 py-0.5 text-xs">Sell</Button>
                        </TradeDialog>

                        <Button variant="ghost" size="sm" className="" aria-label={`Remove ${s}`} onClick={() => removeSymbolFromWatchlist(s)}>
                          <X className="w-2 h-2" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
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

      <div className={`absolute right-0 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: '26%', top: '0', height: '80%' }}>
        <Card className="flex flex-col bg-card/90 backdrop-blur-md border-l" style={{ height: '100%' }}>
          <div className="p-3 flex items-center justify-between border-b">
            <h3 className="font-semibold">Watchlist</h3>
            <div className="flex items-center gap-2">
              <input
                aria-label="Search symbols"
                placeholder="Search symbols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-2 py-1 rounded-md bg-card border border-border text-sm"
              />
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-3 space-y-3 overflow-auto" style={{ height: 'calc(80% - 56px)' }}>
            {searchQuery.trim().length >= 2 ? (
              searchLoading ? (
                <div className="text-sm">Searching...</div>
              ) : (
                searchResults.length ? (
                  searchResults.map((r: SymbolResult) => (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30">
                      <div>
                        <div className="font-semibold">{r.symbol}</div>
                        <div className="text-xs text-muted-foreground">{r.name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button size="sm" onClick={() => addSymbolToWatchlist(r)}>Add</Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm">No results</div>
                )
              )
            ) : (
              symbols.map((s) => {
                const md = marketData.find(m => m.symbol === s)
                const bid = md?.bid ?? null
                const ask = md?.ask ?? null
                const fmt = (v: number | null | undefined) => (typeof v === 'number' ? v.toString() : '-')
                return (
                  <div key={s} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/30">
                    <div>
                      <div className="font-semibold">{s}</div>
                      <div className="text-xs text-muted-foreground">Quick actions</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <div className="text-emerald-500">Bid: <span className="font-mono">{fmt(bid)}</span></div>
                        <div className="text-rose-500">Ask: <span className="font-mono">{fmt(ask)}</span></div>
                      </div>

                      <Button size="sm" className="px-2 py-0.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => quickOrder(s, 'buy')} disabled={!!loading[s]}>Buy</Button>
                      <Button size="sm" variant="destructive" className="px-2 py-0.5 text-xs" onClick={() => quickOrder(s, 'sell')} disabled={!!loading[s]}>Sell</Button>
                      <Button variant="ghost" size="sm" className="p-1 ml-2" aria-label={`Remove ${s}`} onClick={() => removeSymbolFromWatchlist(s)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
