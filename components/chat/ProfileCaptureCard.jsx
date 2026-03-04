'use client'

import { useState } from "react";
import { T, F } from "@/lib/constants";

const ACCENT = "#6BAA8E";

export default function ProfileCaptureCard({ profile, onSave, onDismiss }) {
  const [name, setName] = useState(profile.name || "");
  const [location, setLocation] = useState(profile.location || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ name: name.trim(), location: location.trim(), bio: bio.trim() });
    setSaving(false);
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1px solid " + T.bdr, fontSize: 14, fontFamily: F,
    background: T.bg, color: T.ink, outline: "none",
  };

  return (
    <div style={{ marginTop: 12, padding: 16, background: T.s, borderRadius: 14, border: `1px solid ${ACCENT}40` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${ACCENT}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 14 }}>{"\uD83D\uDCCB"}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: "uppercase", letterSpacing: ".06em", fontFamily: F }}>Profile Draft</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Name</div>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Location</div>
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" style={inputStyle} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Bio</div>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
          style={{ ...inputStyle, resize: "none", lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={{
          padding: "8px 16px", borderRadius: 10, border: "none",
          background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 600,
          cursor: saving ? "default" : "pointer", fontFamily: F,
          opacity: saving ? 0.6 : 1,
        }}>{saving ? "Saving..." : "Save Profile"}</button>
        <button onClick={onDismiss} style={{
          padding: "8px 16px", borderRadius: 10, border: "1px solid " + T.bdr,
          background: T.bg, color: T.ink2, fontSize: 13, fontWeight: 500,
          cursor: "pointer", fontFamily: F,
        }}>Dismiss</button>
      </div>
    </div>
  );
}
