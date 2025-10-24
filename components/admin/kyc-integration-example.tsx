'use client'
import React, { useState } from 'react'
import KycModal from './kyc-modal'

export default function KycIntegrationExample({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className="px-2 py-1 border rounded">View KYC</button>
      <KycModal userId={open ? userId : null} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
