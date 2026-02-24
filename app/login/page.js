'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { T, F, S } from "@/lib/constants"

const input = {
  width: "100%", padding: "12px 16px", borderRadius: 8,
  border: `1.5px solid ${T.bdr}`, background: T.s2, color: T.ink,
  fontSize: 15, fontFamily: F, outline: "none",
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      console.log("[login] signing in…")
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw authErr
      console.log("[login] auth success, user:", data.user.id)

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("auth_user_id", data.user.id)
        .single()
      console.log("[login] profile query:", { profile, profErr })

      if (!profile || !profile.onboarding_complete) {
        console.log("[login] redirecting to /onboarding")
        window.location.href = "/onboarding"
      } else {
        console.log("[login] redirecting to /myai")
        window.location.href = "/myai"
      }
    } catch (err) {
      console.error("[login] error:", err)
      setError(err.message || "Login failed")
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ fontFamily: S, fontSize: 28, color: T.acc, fontWeight: 400 }}>curators</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>Email</label>
            <input
              type="email" name="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              required style={input}
            />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>Password</label>
            <input
              type="password" name="password" autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              required style={input}
            />
          </div>

          {error && <div style={{ fontFamily: F, fontSize: 13, color: "#EF4444", lineHeight: 1.4 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: 14, borderRadius: 8, border: "none",
            background: T.acc, color: T.accText, fontSize: 15, fontWeight: 600,
            fontFamily: F, cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1, marginTop: 4,
          }}>{loading ? "Logging in..." : "Log in"}</button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => {}} style={{ background: "none", border: "none", color: T.ink3, fontFamily: F, fontSize: 13, cursor: "pointer" }}>Forgot password?</button>
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <span style={{ fontFamily: F, fontSize: 14, color: T.ink3 }}>Don't have an account? </span>
          <button onClick={() => router.push("/signup")} style={{ background: "none", border: "none", color: T.acc, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Sign up</button>
        </div>
      </div>
    </div>
  )
}
