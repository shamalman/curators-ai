'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { VisitorProvider } from '@/context/VisitorContext'
import { CuratorProvider } from '@/context/CuratorContext'
import CuratorShell from '@/components/layout/CuratorShell'
import { T, F } from '@/lib/constants'

export default function VisitorLayout({ children }) {
  const { handle } = useParams()
  const pathname = usePathname()
  const [isDesktop, setIsDesktop] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [checked, setChecked] = useState(false)
  // DEBUG: track redirect — remove after investigation
  const [debugInfo, setDebugInfo] = useState(null)
  const mountTime = useRef(Date.now())

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

  // DEBUG: Monitor for unexpected URL changes — remove after investigation
  useEffect(() => {
    if (!checked) return
    const info = `[handle]layout: path=${pathname} handle=${handle} owner=${isOwner} t=${Date.now() - mountTime.current}ms`
    setDebugInfo(info)
    // Watch for URL changes that would indicate a redirect
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== pathname) {
        setDebugInfo(prev => prev + ` → REDIRECT to ${window.location.pathname}`)
      }
    })
    observer.observe(document.querySelector('head') || document.body, { childList: true, subtree: true })
    // Auto-hide debug banner after 5s
    const timer = setTimeout(() => setDebugInfo(null), 5000)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [checked, pathname, handle, isOwner])

  if (!checked) {
    return <div style={{ minHeight: "100vh", background: T.bg }} />
  }

  // Owner on /[handle]/edit → wrap in CuratorProvider + CuratorShell
  if (isOwner && pathname === `/${handle}/edit`) {
    return (
      <CuratorProvider>
        <CuratorShell>
          {children}
        </CuratorShell>
      </CuratorProvider>
    )
  }

  // All other /[handle] routes (profile, ask, [slug]) → always visitor view
  // This lets curators see their own profile/AI exactly as visitors do
  return (
    <VisitorProvider handle={handle}>
      <div style={isDesktop ? {
        width: "100%", minHeight: "100vh", background: T.bg,
      } : {
        width: "100%", maxWidth: 430, margin: "0 auto", height: "100dvh",
        display: "flex", flexDirection: "column", background: T.bg,
        position: "relative", overflow: "hidden",
      }}>
        {/* DEBUG: visible banner — remove after investigation */}
        {debugInfo && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
            background: "#1a1a2e", color: "#0f0", fontFamily: "monospace",
            fontSize: 10, padding: "4px 8px", opacity: 0.9,
          }}>{debugInfo}</div>
        )}
        {children}
      </div>
    </VisitorProvider>
  )
}
