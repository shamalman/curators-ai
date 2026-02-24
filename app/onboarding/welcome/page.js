'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { T, F, S } from "@/lib/constants"

export default function WelcomePage() {
  const router = useRouter()
  const [name, setName] = useState("")

  useEffect(() => {
    async function loadName() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("auth_user_id", user.id)
        .single()
      if (profile) setName(profile.name)
    }
    loadName()
  }, [])

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <h1 style={{ fontFamily: S, fontSize: 32, color: T.ink, fontWeight: 400, lineHeight: 1.2, marginBottom: 16 }}>
          Welcome to Curators{name ? `, ${name}` : ""}!
        </h1>
        <p style={{ fontFamily: F, fontSize: 15, color: T.ink2, lineHeight: 1.6, marginBottom: 36 }}>
          Your AI is ready to capture your first recommendation.
        </p>
        <button onClick={() => router.push("/myai")} style={{
          padding: "14px 32px", borderRadius: 8, border: "none",
          background: T.acc, color: T.accText, fontSize: 15, fontWeight: 600,
          fontFamily: F, cursor: "pointer",
        }}>Start chatting →</button>
      </div>
    </div>
  )
}
