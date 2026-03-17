'use client'

import { useState } from "react";
import { T, W, F } from "@/lib/constants";

export default function FeedAgentBanner({ data, used, onAction }) {
  const [tapped, setTapped] = useState(false);
  const isUsed = used || tapped;

  if (!data) return null;
  return (
    <div style={{
      padding: "14px 16px",
      borderRadius: 14,
      background: `linear-gradient(135deg, ${W.aiBdr}12, ${W.aiBdr}06)`,
      border: `1px solid ${W.aiBdr}40`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${W.aiBdr}20`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>✦</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: T.ink }}>
              Your AI has a read on your taste
            </div>
            <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>
              Based on your {data.source_name || data.sourceName || "source"}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (isUsed) return;
            setTapped(true);
            if (onAction) onAction(data);
          }}
          style={{
            padding: "7px 14px",
            borderRadius: 10,
            border: "none",
            background: W.aiBdr,
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            fontFamily: F,
            cursor: isUsed ? "default" : "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            opacity: isUsed ? 0.4 : 1,
            pointerEvents: isUsed ? "none" : "auto",
          }}
        >
          {isUsed ? "Delivered" : (data.cta_text || "See what I found")}
        </button>
      </div>
    </div>
  );
}
