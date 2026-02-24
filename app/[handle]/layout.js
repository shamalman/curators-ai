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
  const [isOwner, setIsOwner] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    setIsDesktop(mq.matches)
    const handler = (e) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    async function checkOwnership() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setChecked(true); return }
        const { data: prof } = await supabase
          .from("profiles")
          .select("handle")
          .eq("auth_user_id", user.id)
          .single()
        if (prof && prof.handle === handle) {
          setIsOwner(true)
        }
      } catch {
        // Not logged in or query failed — treat as visitor
      }
      setChecked(true)
    }
    checkOwnership()
  }, [handle])

  if (!checked) {
    return <div style={{ minHeight: "100vh", background: T.bg }} />
  }

  // Owner: wrap in CuratorProvider + CuratorShell (sidebar + tabs)
  if (isOwner) {
    return (
      <CuratorProvider>
        <CuratorShell>
          {children}
        </CuratorShell>
      </CuratorProvider>
    )
  }

  // Visitor: standard visitor layout
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
