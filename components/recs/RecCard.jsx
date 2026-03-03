'use client'

import { T, F, CAT } from "@/lib/constants";

export default function RecCard({ item, onClick, showCurator, curatorName, curatorHandle, onBookmark, isBookmarked }) {
  const ct = CAT[item.category] || CAT.other;
  const fmtDate = (d) => {
    if (!d) return "";
    const str = d.includes("T") ? d : d + "T00:00:00";
    return new Date(str).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 4px", borderBottom: "1px solid " + T.bdr, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: ct.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{ct.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
        <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 1 }}>
          {ct.label} · {fmtDate(item.date || item.created_at)}
          {showCurator && curatorHandle ? ` · @${curatorHandle}` : ""}
        </div>
      </div>
      {onBookmark && (
        <button onClick={(e) => { e.stopPropagation(); onBookmark(); }} style={{
          width: 32, height: 32, borderRadius: 8, border: "1px solid " + T.bdr,
          background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill={isBookmarked ? T.acc : "none"} stroke={isBookmarked ? T.acc : T.ink3} strokeWidth="1.5">
            <path d="M3 1.5h8a.5.5 0 0 1 .5.5v10.5L7 9.5 2.5 12.5V2a.5.5 0 0 1 .5-.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}
