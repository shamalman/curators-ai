'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { VisitorProvider } from '@/context/VisitorContext'
import { CuratorProvider } from '@/context/CuratorContext'
import CuratorShell from '@/components/layout/CuratorShell'
import { T } from '@/lib/constants'

export default function VisitorLayout({ children }) {
  const { handle } = useParams()
  const [isDesktop, setIsDesktop] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mq.matches)
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) setIsLoggedIn(true)
      } catch {
        // Not logged in — treat as anonymous visitor
      }
      setChecked(true)
    }
    checkAuth()
  }, [])

  if (!checked) {
    return <div style={{ minHeight: "100vh", background: T.bg }} />
  }

  // Logged-in curator (owner or not) → CuratorProvider for shell + VisitorProvider for content
  // Shell reads CuratorContext directly; page content gets VisitorContext via useCurator()
  if (isLoggedIn) {
    return (
      <CuratorProvider>
        <CuratorShell>
          <VisitorProvider handle={handle}>
            {children}
          </VisitorProvider>
        </CuratorShell>
      </CuratorProvider>
    )
  }

  // Anonymous visitor — no shell
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
