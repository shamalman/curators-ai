'use client'

import { T, F } from "@/lib/constants";

export default function Toast({ message, onAction, actionLabel }) {
  return (
    <div style={{ position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)", padding: "12px 20px", borderRadius: 14, background: T.ink, color: T.bg, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", zIndex: 10, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 13, fontFamily: F }}>{message}</span>
      {onAction && actionLabel && (
        <button onClick={onAction} style={{ background: "none", border: "1px solid " + T.bg + "40", borderRadius: 8, padding: "4px 12px", color: T.acc, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F }}>{actionLabel}</button>
      )}
    </div>
  );
}
