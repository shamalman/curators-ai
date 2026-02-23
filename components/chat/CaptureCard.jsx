'use client'

import { T, F } from "@/lib/constants";

export default function CaptureCard({ capture, onSave, onEdit, onCancel, onUpdate, pendingLink, onRemoveLink, onAddLink }) {
  if (!capture) return null;

  return (
    <div style={{ marginTop: 12, padding: 16, background: T.s, borderRadius: 14, border: "1px solid " + T.bdr }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Title</div>
        <input value={capture.title} onChange={e => onUpdate({ ...capture, title: e.target.value })}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + T.bdr, fontSize: 14, fontFamily: F, background: T.bg, color: T.ink, outline: "none" }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Context</div>
        <textarea value={capture.context} onChange={e => onUpdate({ ...capture, context: e.target.value })} rows={2}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + T.bdr, fontSize: 14, fontFamily: F, background: T.bg, color: T.ink, outline: "none", resize: "none" }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Category</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["restaurant", "book", "music", "tv", "film", "travel", "product", "other"].map(cat => (
            <button key={cat} onClick={() => onUpdate({ ...capture, category: cat })}
              style={{
                padding: "6px 12px", borderRadius: 8, border: capture.category === cat ? "none" : "1px solid " + T.bdr,
                background: capture.category === cat ? T.acc : T.bg, color: capture.category === cat ? "#fff" : T.ink2,
                fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: F, textTransform: "capitalize"
              }}>{cat}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Tags</div>
        <input value={capture.tags?.join(", ") || ""} onChange={e => onUpdate({ ...capture, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
          placeholder="Comma separated"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + T.bdr, fontSize: 14, fontFamily: F, background: T.bg, color: T.ink, outline: "none" }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Links</div>
        {(capture.links || (pendingLink ? [pendingLink] : [])).map((link, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <input value={link.label || link.title || link.url} readOnly
              style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid " + T.bdr, fontSize: 12, fontFamily: F, background: T.s, color: T.ink, outline: "none" }}
            />
            <button onClick={() => onRemoveLink(i)} style={{
              padding: "8px 10px", borderRadius: 6, border: "1px solid " + T.bdr,
              background: T.s, color: T.ink3, fontSize: 10, cursor: "pointer"
            }}>{"\u2715"}</button>
          </div>
        ))}
        <button onClick={onAddLink} style={{
          padding: "8px 10px", borderRadius: 6, border: "1px dashed " + T.bdr,
          background: "transparent", color: T.ink3, fontSize: 11, cursor: "pointer", fontFamily: F,
          width: "100%", textAlign: "center"
        }}>+ Add link</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} style={{
          padding: "8px 16px", borderRadius: 10, border: "none",
          background: T.acc, color: "#fff", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: F
        }}>Save</button>
        <button onClick={onCancel} style={{
          padding: "8px 16px", borderRadius: 10, border: "1px solid " + T.bdr,
          background: T.bg, color: T.ink2, fontSize: 13, fontWeight: 500,
          cursor: "pointer", fontFamily: F
        }}>Cancel</button>
      </div>
    </div>
  );
}
