"use client"

import { useState, useEffect, useContext } from "react"
import { useRouter } from "next/navigation"
import { T, F, S, MN } from "@/lib/constants"
import { supabase } from "@/lib/supabase"
import { CuratorContext } from "@/context/CuratorContext"

function Toggle({ on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none",
        background: on ? T.acc : T.s2, cursor: "pointer",
        position: "relative", transition: "background .2s", flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 9,
        background: on ? "#fff" : T.ink3,
        position: "absolute", top: 3,
        left: on ? 23 : 3,
        transition: "left .2s, background .2s",
      }} />
    </button>
  )
}

export default function SettingsView() {
  const router = useRouter()
  const { profileId } = useContext(CuratorContext)
  const [email, setEmail] = useState("")
  const [weeklyDigest, setWeeklyDigest] = useState(true)
  const [newSubscriber, setNewSubscriber] = useState(true)
  const [networkActivity, setNetworkActivity] = useState(false)
  const [inviteHistory, setInviteHistory] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email)
    })
  }, [])

  useEffect(() => {
    if (!profileId) return
    fetch(`/api/invite?profileId=${profileId}&history=1`)
      .then(r => r.json())
      .then(data => { if (data.history) setInviteHistory(data.history) })
      .catch(() => {})
  }, [profileId])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error("Sign out error:", err)
    }
    window.location.href = "/login"
  }

  const settingRow = (label, desc, right) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 0", borderBottom: `1px solid ${T.bdr}`,
    }}>
      <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
        <div style={{ fontFamily: F, fontSize: 14, color: T.ink, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>{desc}</div>}
      </div>
      {right}
    </div>
  )

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ maxWidth: 700, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", flex: 1, overflow: "auto", minHeight: 0 }}>

        {/* Header with back button */}
        <div style={{ padding: "52px 20px 0", flexShrink: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => router.back()} style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <h2 style={{ fontFamily: S, fontSize: 28, color: T.ink, fontWeight: 400, marginBottom: 24 }}>Settings</h2>
        </div>

        <div style={{ padding: "0 20px", paddingBottom: 60 }}>

          {/* Notifications */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Notifications
            </div>
            {settingRow("Weekly digest", "Summary of your activity each week",
              <Toggle on={weeklyDigest} onToggle={() => setWeeklyDigest(!weeklyDigest)} />
            )}
            {settingRow("New subscriber", "When someone subscribes to you",
              <Toggle on={newSubscriber} onToggle={() => setNewSubscriber(!newSubscriber)} />
            )}
            {settingRow("Network activity", "When curators you follow post",
              <Toggle on={networkActivity} onToggle={() => setNetworkActivity(!networkActivity)} />
            )}
          </div>

          {/* Your Invites */}
          {inviteHistory.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Your Invites
              </div>
              {inviteHistory.map(inv => (
                <div key={inv.id} style={{
                  padding: "12px 0", borderBottom: `1px solid ${T.bdr}`,
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: MN, fontSize: 13, color: T.ink, letterSpacing: ".04em" }}>{inv.code}</div>
                    {inv.inviter_note && (
                      <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 4, fontStyle: "italic" }}>
                        {inv.inviter_note}
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: "3px 10px", borderRadius: 6, flexShrink: 0,
                    background: inv.used_at ? T.accSoft : T.s,
                    fontFamily: F, fontSize: 11, fontWeight: 600,
                    color: inv.used_at ? T.acc : T.ink3,
                  }}>
                    {inv.used_at
                      ? (inv.profile_handle ? `Used by @${inv.profile_handle}` : "Used")
                      : "Pending"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Account */}
          <div>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Account
            </div>
            {settingRow("Email", email || "...", null)}
            {settingRow("Password", null,
              <button style={{
                background: "none", border: `1px solid ${T.bdr}`, borderRadius: 8,
                padding: "6px 14px", cursor: "pointer", fontFamily: F, fontSize: 12,
                fontWeight: 600, color: T.ink3,
              }}>Change</button>
            )}
            {settingRow("Export data", "Download all your recommendations",
              <button style={{
                background: "none", border: `1px solid ${T.bdr}`, borderRadius: 8,
                padding: "6px 14px", cursor: "pointer", fontFamily: F, fontSize: 12,
                fontWeight: 600, color: T.ink3,
              }}>Export</button>
            )}
            <div style={{ paddingTop: 24 }}>
              <button
                onClick={handleLogout}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 8,
                  border: `1px solid ${T.bdr}`, background: "none",
                  fontFamily: F, fontSize: 14, fontWeight: 600, color: "#E85C5C",
                  cursor: "pointer",
                }}
              >
                Log out
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
