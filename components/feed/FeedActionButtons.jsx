'use client'

import { useState } from "react";
import { T, F } from "@/lib/constants";

export default function FeedActionButtons({ data, used, onUse }) {
  const [tapped, setTapped] = useState(false);
  const isUsed = used || tapped;

  if (!data?.options || data.options.length === 0) return null;
  return (
    <div style={{
      padding: "4px 0",
      opacity: isUsed ? 0.3 : 1,
      pointerEvents: isUsed ? "none" : "auto",
    }}>
      {data.prompt && (
        <div style={{ fontSize: 13, color: T.ink2, fontFamily: F, marginBottom: 8 }}>{data.prompt}</div>
      )}
      <div style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}>
      {data.options.map((opt, i) => (
        <button
          key={i}
          onClick={() => {
            setTapped(true);
            if (onUse) onUse(opt);
          }}
          style={{
            padding: "10px 18px",
            borderRadius: 22,
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: F,
            cursor: "pointer",
            transition: "all .15s",
            ...(opt.style === "primary" ? {
              border: `1.5px solid ${T.acc}`,
              background: T.accSoft,
              color: T.acc,
            } : {
              border: `1px solid ${T.bdr}`,
              background: "transparent",
              color: T.ink2,
            }),
          }}
        >
          {opt.label}
        </button>
      ))}
      </div>
    </div>
  );
}
