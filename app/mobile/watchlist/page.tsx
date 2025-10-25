"use client"

import React, { useEffect, useState } from "react"
import MobileWatchlist from "@/components/mobile-watchlist"
import { useRouter } from "next/navigation"

export default function MobileWatchlistPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // On the client check viewport width and redirect desktop users to '/'
    if (typeof window === 'undefined') return
    const width = window.innerWidth
    const lgPx = 1024
    if (width >= lgPx) {
      router.replace('/')
      return
    }
    setReady(true)
  }, [router])

  if (!ready) return null
  return <MobileWatchlist />
}
