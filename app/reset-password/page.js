'use client'

import { useState } from "react"
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontFamily: F, fontSize: 14, color: T.ink2, marginBottom: 4 }}>
            Choose a new password for your account.
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>New password</label>
            <input
              type="password" name="new-password" autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)}
              required style={input}
            />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>Confirm password</label>
            <input
              type="password" name="confirm-password" autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              required style={input}
            />
          </div>

          {error && <div style={{ fontFamily: F, fontSize: 13, color: "#EF4444", lineHeight: 1.4 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: 14, borderRadius: 8, border: "none",
            background: T.acc, color: T.accText, fontSize: 15, fontWeight: 600,
            fontFamily: F, cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1, marginTop: 4,
          }}>{loading ? "Resetting..." : "Reset password"}</button>
        </form>
      </div>
    </div>
  )
}
