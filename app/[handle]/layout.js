'use client'

import { useParams } from 'next/navigation'
import { VisitorProvider } from '@/context/VisitorContext'
import { T } from '@/lib/constants'

export default function VisitorLayout({ children }) {
  const { handle } = useParams()

  return (
    <VisitorProvider handle={handle}>
      <div style={{
        width: "100%", maxWidth: 430, margin: "0 auto", height: "100dvh",
        display: "flex", flexDirection: "column", background: T.bg,
        position: "relative", overflow: "hidden",
      }}>
        {children}
      </div>
    </VisitorProvider>
  )
}
