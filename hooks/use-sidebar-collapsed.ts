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

  return [collapsed, setCollapsed] as const
}
