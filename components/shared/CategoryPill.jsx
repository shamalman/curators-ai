'use client'

import { T, F, CAT } from "@/lib/constants";

export default function CategoryPill({ categories, counts, activeCategory, onSelect, activeCount }) {
  return (
    <>
      <button onClick={() => onSelect(null)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: !activeCategory ? T.acc : T.s, color: !activeCategory ? T.accText : T.ink2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap" }}>All ({activeCount})</button>
      {categories.map(cat => { const ct = CAT[cat]; return <button key={cat} onClick={() => onSelect(activeCategory === cat ? null : cat)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: activeCategory === cat ? T.acc : T.s, color: activeCategory === cat ? T.accText : T.ink2, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap" }}>{ct.emoji} ({counts[cat]})</button>; })}
    </>
  );
}
