'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { T, F, S } from "@/lib/constants"

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: 8,
  border: `1.5px solid ${T.bdr}`, background: T.s2, color: T.ink,
  fontSize: 15, fontFamily: F, outline: "none",
}

const RESERVED = [
  "myai", "ask", "recommendations", "taste", "settings", "fans",
  "api", "onboarding", "admin", "login", "signup", "about",
  "help", "terms", "privacy",
]

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [bio, setBio] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [handleStatus, setHandleStatus] = useState(null) // null | "checking" | "available" | "taken" | "invalid" | "reserved"
  const debounceRef = useRef(null)

  const handleRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/

  const checkHandle = useCallback((value) => {
    const h = value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    if (h.length < 3) { setHandleStatus(null); return }
    if (h.length > 30) { setHandleStatus("invalid"); return }
    if (!handleRegex.test(h)) { setHandleStatus("invalid"); return }
    if (RESERVED.includes(h)) { setHandleStatus("reserved"); return }

    setHandleStatus("checking")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("handle", h)
          .single()
        setHandleStatus(data ? "taken" : "available")
      } catch {
        setHandleStatus("available")
      }
    }, 500)
  }, [])

  const onHandleChange = (e) => {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
    setHandle(v)
    checkHandle(v)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!name.trim()) { setError("Name is required"); return }
    if (handle.length < 3) { setError("Handle must be at least 3 characters"); return }
    if (handleStatus !== "available") { setError("Please choose an available handle"); return }
    setLoading(true)
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) throw new Error("Not logged in")

      const { error: insertErr } = await supabase.from("profiles").insert({
        name: name.trim(),
        handle: handle.toLowerCase(),
        bio: bio.trim(),
        auth_user_id: user.id,
        onboarding_complete: true,
        ai_enabled: true,
        accept_requests: true,
        show_recs: true,
      })
      if (insertErr) throw insertErr

      router.push("/onboarding/welcome")
    } catch (err) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const statusMsg = {
    checking: { text: "Checking...", color: T.ink3 },
    available: { text: "\u2713 Available", color: "#6BAA8E" },
    taken: { text: "\u2717 Already taken", color: "#EF4444" },
    invalid: { text: "Lowercase letters, numbers, hyphens only (3-30 chars)", color: "#EF4444" },
    reserved: { text: "\u2717 Reserved", color: "#EF4444" },
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ fontFamily: S, fontSize: 28, color: T.acc, fontWeight: 400 }}>curators</span>
          <div style={{ fontFamily: F, fontSize: 14, color: T.ink3, marginTop: 10 }}>Set up your profile</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>Name</label>
            <input
              type="text" name="name" autoComplete="name"
              value={name} onChange={e => setName(e.target.value)}
              required placeholder="Your display name"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>Handle</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontFamily: F, fontSize: 15, color: T.ink3 }}>@</span>
              <input
                type="text" name="handle" autoComplete="off"
                value={handle} onChange={onHandleChange}
                required placeholder="yourhandle"
                style={{ ...inputStyle, paddingLeft: 32 }}
              />
            </div>
            {handleStatus && statusMsg[handleStatus] && (
              <div style={{ fontFamily: F, fontSize: 11, marginTop: 6, color: statusMsg[handleStatus].color }}>
                {statusMsg[handleStatus].text}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 6 }}>Bio <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
            <textarea
              name="bio" value={bio} onChange={e => setBio(e.target.value)}
              placeholder="What do you recommend?"
              rows={3}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
            />
          </div>

          {error && <div style={{ fontFamily: F, fontSize: 13, color: "#EF4444", lineHeight: 1.4 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: 14, borderRadius: 8, border: "none",
            background: T.acc, color: T.accText, fontSize: 15, fontWeight: 600,
            fontFamily: F, cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1, marginTop: 4,
          }}>{loading ? "Setting up..." : "Continue"}</button>
        </form>
      </div>
    </div>
  )
}
