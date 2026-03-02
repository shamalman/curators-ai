"use client"

import { useRouter } from "next/navigation"
import { T, F, S } from "@/lib/constants"
import { useCurator } from "@/context/CuratorContext"

export default function ProfileView() {
  const router = useRouter()
  const { profile, tasteItems } = useCurator()

  const name = profile?.name || ""
  const handle = profile?.handle?.replace("@", "") || ""
  const bio = profile?.bio || ""
  const recCount = tasteItems?.filter(r => r.visibility === "public").length || 0
  const initial = name[0] || ""

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ maxWidth: 700, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", flex: 1, overflow: "auto", minHeight: 0 }}>

        {/* Header with gear icon */}
        <div style={{ padding: "52px 20px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h2 style={{ fontFamily: S, fontSize: 28, color: T.ink, fontWeight: 400 }}>Profile</h2>
            <button
              onClick={() => router.push("/settings")}
              style={{
                background: "none", border: `1px solid ${T.bdr}`, borderRadius: 8,
                padding: "7px 8px", cursor: "pointer", display: "flex", alignItems: "center",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Profile card */}
        <div style={{ padding: "0 20px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 16, marginBottom: 20,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: T.accSoft,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontFamily: S, fontSize: 24, color: T.acc, fontWeight: 400 }}>{initial}</span>
            </div>
            <div>
              <div style={{ fontFamily: S, fontSize: 20, color: T.ink, fontWeight: 400, marginBottom: 2 }}>{name}</div>
              {handle && <div style={{ fontFamily: F, fontSize: 13, color: T.ink3 }}>@{handle}</div>}
            </div>
          </div>

          {bio && (
            <p style={{ fontFamily: F, fontSize: 14, color: T.ink2, lineHeight: 1.6, marginBottom: 20, whiteSpace: "pre-line" }}>{bio}</p>
          )}

          <div style={{
            display: "flex", gap: 24, padding: "16px 0",
            borderTop: `1px solid ${T.bdr}`, borderBottom: `1px solid ${T.bdr}`,
          }}>
            <div>
              <div style={{ fontFamily: F, fontSize: 20, color: T.ink, fontWeight: 600 }}>{recCount}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>recommendations</div>
            </div>
            <div>
              <div style={{ fontFamily: F, fontSize: 20, color: T.ink, fontWeight: 600 }}>{profile?.subscribers || 0}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>subscribers</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
