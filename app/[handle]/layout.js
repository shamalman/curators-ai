'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { VisitorProvider } from '@/context/VisitorContext'
import { T } from '@/lib/constants'

export default function VisitorLayout({ children }) {
  const { handle } = useParams()
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mq.matches)
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <VisitorProvider handle={handle}>
      <div style={isDesktop ? {
        width: "100%", minHeight: "100vh", background: T.bg,
      } : {
        width: "100%", maxWidth: 430, margin: "0 auto", height: "100dvh",
        display: "flex", flexDirection: "column", background: T.bg,
        position: "relative", overflow: "hidden",
      }}>
        {children}
      </div>
    </VisitorProvider>
  )
}
