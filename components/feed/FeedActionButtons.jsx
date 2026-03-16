'use client'

import { T, F } from "@/lib/constants";

export default function FeedActionButtons({ data, used, onUse }) {
  if (!data?.options || data.options.length === 0) return null;
  return (
    <div style={{
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      padding: "4px 0",
      opacity: used ? 0.3 : 1,
      pointerEvents: used ? "none" : "auto",
    }}>
      {data.options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onUse && onUse(opt)}
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
  );
}
