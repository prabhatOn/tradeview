"use client"

import { useState, useEffect } from "react"

const STORAGE_KEY = "sidebar_collapsed"

export function useSidebarCollapsed(defaultValue = false) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return defaultValue
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw === null ? defaultValue : raw === "true"
    } catch (e) {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch (e) {
      // ignore
    }
  }, [collapsed])

  // Wrapped setter that writes to localStorage and notifies other listeners in the same window
  const setCollapsedShared = (value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsed(prev => {
      const next = typeof value === 'function' ? (value as (p: boolean) => boolean)(prev) : value
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignore
      }
      // Dispatch a custom event so other hooks in same window can react immediately
      try {
        window.dispatchEvent(new CustomEvent('sidebar:change', { detail: next }))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Listen for changes from other components (same window) via the custom event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail
      if (typeof detail === 'boolean') {
        setCollapsed(detail)
      }
    }

    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setCollapsed(e.newValue === 'true')
      }
    }

    window.addEventListener('sidebar:change', handler as EventListener)
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener('sidebar:change', handler as EventListener)
      window.removeEventListener('storage', storageHandler)
    }
  }, [])

  return [collapsed, setCollapsedShared] as const
}
