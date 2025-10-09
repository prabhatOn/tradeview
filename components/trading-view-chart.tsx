"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"

declare global {
  interface Window {
    TradingView?: any
  }
}

export default function TradingViewChart({
  symbol,
  timeframe,
  onBuy,
  onSell,
  onChangeTimeframe,
}: {
  symbol: string
  timeframe: string
  onBuy: () => void
  onSell: () => void
  onChangeTimeframe?: (t: string) => void
}) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetInstance = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load TradingView script if not already loaded
    if (!window.TradingView) {
      console.log("Loading TradingView script...")
      const script = document.createElement("script")
      script.src = "https://s3.tradingview.com/tv.js"
      script.async = true
      script.onload = () => {
        console.log("TradingView script loaded successfully")
        setIsLoading(false)
        initWidget()
      }
      script.onerror = (e) => {
        console.error("Failed to load TradingView script:", e)
        setError("Failed to load TradingView script")
        setIsLoading(false)
      }
      document.head.appendChild(script)
    } else {
      console.log("TradingView script already loaded")
      setIsLoading(false)
      initWidget()
    }

    return () => {
      // Cleanup widget on unmount
      if (widgetInstance.current) {
        try {
          widgetInstance.current.remove()
        } catch (e) {
          console.warn("Error removing widget:", e)
        }
        widgetInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    // Reinitialize widget when symbol or timeframe changes
    if (window.TradingView && containerRef.current) {
      initWidget()
    }
  }, [symbol, timeframe])

  useEffect(() => {
    // Reinitialize widget when theme changes
    if (window.TradingView && containerRef.current) {
      initWidget()
    }
  }, [theme])

  const initWidget = () => {
    if (!containerRef.current || !window.TradingView) {
      console.log("Container or TradingView not ready")
      return
    }

    console.log("Initializing TradingView widget...")

    // Clean up existing widget
    if (widgetInstance.current) {
      try {
        widgetInstance.current.remove()
      } catch (e) {
        console.warn("Error removing previous widget:", e)
      }
      widgetInstance.current = null
    }

    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = ""
    }

    // Get theme colors based on next-themes
    const getThemeColors = () => {
      switch (theme) {
        case "light":
          return {
            theme: "light",
            backgroundColor: "#ffffff",
            toolbar_bg: "#f8fafc",
            gridColor: "#e2e8f0",
            textColor: "#1e293b",
          }
        case "dark":
          return {
            theme: "dark",
            backgroundColor: "#0f172a",
            toolbar_bg: "#1e293b",
            gridColor: "#334155",
            textColor: "#f1f5f9",
          }
        default: // system or any other
          return {
            theme: "dark",
            backgroundColor: "#0f172a",
            toolbar_bg: "#1e293b",
            gridColor: "#334155",
            textColor: "#f1f5f9",
          }
      }
    }

    const themeColors = getThemeColors()

    // Create new widget
    try {
      const containerId = `tradingview_${symbol}_${timeframe}_${Date.now()}`
      if (containerRef.current) {
        containerRef.current.id = containerId
      }

      console.log("Creating widget with config:", {
        symbol,
        timeframe,
        containerId,
        theme: themeColors.theme
      })

      widgetInstance.current = new window.TradingView.widget({
        autosize: true,
        symbol: symbol,
        interval: timeframeToInterval(timeframe),
        timezone: "Etc/UTC",
        theme: themeColors.theme,
        style: "1",
        locale: "en",
        hide_top_toolbar: false,
        hide_legend: false,
        withdateranges: true,
        allow_symbol_change: true,
        container_id: containerId,
        backgroundColor: themeColors.backgroundColor,
        toolbar_bg: themeColors.toolbar_bg,
        gridColor: themeColors.gridColor,
        textColor: themeColors.textColor,
        enabled_features: [
          "side_toolbar_in_fullscreen_mode",
          "header_in_fullscreen_mode",
          "use_localstorage_for_settings",
        ],
        disabled_features: ["volume_force_overlay", "create_volume_indicator_by_default"],
        onReady: () => {
          console.log("TradingView widget is ready")
          setError(null)
        },
        overrides: {
          "mainSeriesProperties.style": 1,
          "mainSeriesProperties.candleStyle.upColor": theme === "light" ? "#10b981" : "#22c55e",
          "mainSeriesProperties.candleStyle.downColor": theme === "light" ? "#ef4444" : "#ef4444",
          "mainSeriesProperties.candleStyle.borderUpColor": theme === "light" ? "#10b981" : "#22c55e",
          "mainSeriesProperties.candleStyle.borderDownColor": theme === "light" ? "#ef4444" : "#ef4444",
        },
      })
      console.log("Widget created successfully")
    } catch (err) {
      console.error("TradingView widget error:", err)
      setError("Failed to initialize TradingView widget")
    }
  }

  const timeframeToInterval = (tf: string): string => {
    switch (tf) {
      case "1m":
        return "1"
      case "5m":
        return "5"
      case "15m":
        return "15"
      case "1h":
        return "60"
      case "4h":
        return "240"
      case "1d":
        return "D"
      default:
        return "15"
    }
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full tradingview-widget-container"
        style={{ width: "100%", height: "100%" }}
      />

      {isLoading && (
        <div className="flex items-center justify-center h-full text-muted-foreground absolute inset-0 bg-card">
          Loading chart...
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground absolute inset-0 bg-card">
          <div className="text-destructive mb-4">{error}</div>
          <div className="text-sm mb-4">Chart temporarily unavailable</div>
          <div className="text-xs text-muted-foreground mb-6">
            Symbol: {symbol} | Timeframe: {timeframe}
          </div>
          <div className="w-full h-64 bg-muted/5 rounded border border-border flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-semibold mb-2 text-foreground">{symbol}</div>
              <div className="text-sm text-muted-foreground">Price Chart</div>
              <div className="text-xs text-muted-foreground mt-1">Interactive chart will load here</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
