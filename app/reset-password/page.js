'use client'

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { T, F, S } from "@/lib/constants"

const input = {
  width: "100%", padding: "12px 16px", borderRadius: 8,
  border: `1.5px solid ${T.bdr}`, background: T.s2, color: T.ink,
  fontSize: 15, fontFamily: F, outline: "none",
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase sends reset links with tokens in the URL hash.
    // We need to let the Supabase client pick up the session from the hash.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true)
      }
    })
    // Also check if session already exists (e.g. on reload)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!sessionReady) {
      setError("Auth session missing — please use the link from your email.")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }
    setLoading(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr
      window.location.href = "/myai"
    } catch (err) {
      setError(err.message || "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ fontFamily: S, fontSize: 28, color: T.acc, fontWeight: 400 }}>curators</span>
        </div>
        <div style={{ fontFamily: F, fontSize: 14, color: T.ink2, marginBottom: 20 }}>
          Choose a new password for your account.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.ink3, marginBottom: 6 }}>New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={input} />
          </div>
          <div>
            <label style={{ display: "block", fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.ink3, marginBottom: 6 }}>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={input} />
          </div>
          {error && <div style={{ fontFamily: F, fontSize: 13, color: "#E05555" }}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: 100, background: T.acc, color: T.accText, fontFamily: F, fontSize: 15, fontWeight: 600, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </div>
      </div>
    </div>
  )
}
