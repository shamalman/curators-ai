'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, F, S, MN, CAT, EARNINGS } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";
import CategoryPill from "@/components/shared/CategoryPill";
import Toast from "@/components/shared/Toast";

export default function TasteManager() {
  const router = useRouter();
  const { tasteItems: items, archived, filterCat, setFilterCat, removing, removeItem, restoreItem, undoItem, undoArchive } = useCurator();
  const [earningsExpanded, setEarningsExpanded] = useState(false);
  const [earningsDrill, setEarningsDrill] = useState(null);

  const activeItems = items.filter(i => !archived[i.id]);
  const archivedItems = items.filter(i => !!archived[i.id]);
  const cats = [...new Set(activeItems.map(i => i.category))];
  const cc = {}; cats.forEach(c => { cc[c] = activeItems.filter(i => i.category === c).length; });
  const activeN = activeItems.length;

  const filtered = filterCat === "archived" ? archivedItems : filterCat ? activeItems.filter(i => i.category === filterCat) : activeItems;
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "52px 20px 14px", flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
      </div>
      <div style={{ padding: "4px 20px 12px" }}>
        <h2 style={{ fontFamily: S, fontSize: 28, color: T.ink, fontWeight: 400, marginBottom: 4 }}>Your Taste</h2>
        <p style={{ fontSize: 13, color: T.ink3, fontFamily: F }}>Everything your AI knows. Remove to update instantly.</p>
      </div>
      <div style={{ padding: "0 20px 12px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0, maxWidth: "100%" }}>
        <CategoryPill categories={cats} counts={cc} activeCategory={filterCat} onSelect={setFilterCat} activeCount={activeN} />
        {archivedItems.length > 0 && (
          <button onClick={() => setFilterCat(filterCat === "archived" ? null : "archived")} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: filterCat === "archived" ? T.ink3 : T.s, color: filterCat === "archived" ? "#fff" : T.ink3, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap" }}>{"\uD83D\uDDC4"} ({archivedItems.length})</button>
        )}
      </div>

      {/* TODO: Unhide when earnings are real */}
      {false && !earningsDrill && (
        <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
          <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid " + T.bdr, background: T.s }}>
            <button onClick={() => setEarningsExpanded(!earningsExpanded)} style={{ width: "100%", padding: "14px 16px", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: MN, fontSize: 20, fontWeight: 700, color: T.ink }}>{"$"}{EARNINGS.total.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: T.ink3, fontFamily: F }}>earned</span>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {Object.values(EARNINGS.streams).filter(function(s) { return s.amount > 0; }).map(function(s) { return <span key={s.label} style={{ fontSize: 10 }}>{s.icon}</span>; })}
              </div>
              <span style={{ fontSize: 14, color: T.ink3, transition: "transform .2s", transform: earningsExpanded ? "rotate(180deg)" : "rotate(0)" }}>{"▾"}</span>
            </button>
            {earningsExpanded && (
              <div className="fu" style={{ padding: "0 16px 18px" }}>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
                  {Object.entries(EARNINGS.streams).map(function(entry) { return <div key={entry[0]} style={{ width: ((entry[1].amount / EARNINGS.total) * 100) + "%", background: entry[1].color, transition: "width .3s" }} />; })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {Object.entries(EARNINGS.streams).map(function(entry) { var key = entry[0]; var s = entry[1]; return (
                    <button key={key} onClick={function() { setEarningsDrill(key); }} style={{ padding: "14px", borderRadius: 14, border: "1px solid " + T.bdr, background: T.bg, cursor: "pointer", textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 14 }}>{s.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: T.ink2, fontFamily: F }}>{s.label}</span>
                      </div>
                      <div style={{ fontFamily: MN, fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 3 }}>{"$"}{s.amount}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 10, color: s.color, fontFamily: F, fontWeight: 600 }}>{s.trend}</span>
                        <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>{s.count} {key === "tips" ? "people" : key === "subs" ? "active" : key === "license" ? "deals" : "sold"}</span>
                      </div>
                    </button>
                  ); })}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, fontFamily: F, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Top earning recs</div>
                {EARNINGS.topRecs.map(function(rec, i) {
                  var rc = CAT[rec.category] || CAT.other;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < EARNINGS.topRecs.length - 1 ? "1px solid " + T.bdr : "none" }}>
                      <span style={{ fontSize: 14 }}>{rc.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.title}</div>
                        <div style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 2 }}>{rec.sources}</div>
                      </div>
                      <span style={{ fontFamily: MN, fontSize: 14, fontWeight: 700, color: "#6BAA8E" }}>{"$"}{rec.earned}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TODO: Unhide when earnings are real */}
      {false && earningsDrill && (
        <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
          <div style={{ borderRadius: 16, border: "1px solid " + T.bdr, background: T.s, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid " + T.bdr }}>
              <button onClick={function() { setEarningsDrill(null); }} style={{ background: "none", border: "none", color: T.acc, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, padding: 0 }}>{"← Earnings"}</button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 14 }}>{EARNINGS.streams[earningsDrill].icon}</span>
              <span style={{ fontFamily: MN, fontSize: 18, fontWeight: 700, color: T.ink }}>{"$"}{EARNINGS.streams[earningsDrill].amount}</span>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, fontFamily: F, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Recent {EARNINGS.streams[earningsDrill].label.toLowerCase()}</div>
              {(EARNINGS.transactions[earningsDrill] || []).map(function(tx, i, arr) { return (
                <div key={i} style={{ padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid " + T.bdr : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: tx.message ? 6 : 0 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: F }}>{tx.from}</span>
                      <span style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginLeft: 8 }}>{tx.rec}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: MN, fontSize: 14, fontWeight: 700, color: EARNINGS.streams[earningsDrill].color }}>{"$"}{tx.amount}</span>
                      <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>{tx.time}</span>
                    </div>
                  </div>
                  {tx.message ? <p style={{ fontSize: 12, color: T.ink2, fontFamily: F, fontStyle: "italic", lineHeight: 1.4 }}>"{tx.message}"</p> : null}
                </div>
              ); })}
            </div>
          </div>
        </div>
      )}

      {/* Timeline list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", WebkitOverflowScrolling: "touch" }}>
        {items.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>{"\u25C6"}</div>
            <div style={{ fontFamily: S, fontSize: 20, color: T.ink, fontWeight: 400, marginBottom: 8 }}>No recommendations yet</div>
            <p style={{ fontFamily: F, fontSize: 13, color: T.ink3, lineHeight: 1.6, marginBottom: 20 }}>Head to My AI to start capturing your taste</p>
            <button onClick={() => router.push("/myai")} style={{
              background: T.acc, border: "none", borderRadius: 8, padding: "10px 20px",
              cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 600, color: T.accText,
            }}>Go to My AI →</button>
          </div>
        )}
        {filterCat === "archived" && (
          <div style={{ padding: "8px 4px 12px" }}>
            <div style={{ fontSize: 13, color: T.ink3, fontFamily: F, lineHeight: 1.5 }}>Archived recs are hidden from your AI and public profile. Restore anytime.</div>
          </div>
        )}
        {filtered.length === 0 && filterCat === "archived" && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.ink3 }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: .3 }}>{"\uD83D\uDDC4"}</div>
            <div style={{ fontSize: 13, fontFamily: F }}>No archived recs</div>
          </div>
        )}
        {filtered.map(function(item, i) { var ct = CAT[item.category] || CAT.other; var isArch = !!archived[item.id]; return (
          <div key={item.id} className={removing === item.id ? "rm" : "fu"} style={{ animationDelay: removing === item.id ? "0s" : (i * .03) + "s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 4px", borderBottom: "1px solid " + T.bdr, opacity: isArch ? 0.6 : 1 }}>
              <div onClick={function() { router.push('/recommendations/' + (item.slug || item.id)); }} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: ct.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{ct.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 1 }}>{ct.label} {"·"} {fmtDate(item.date)}</div>
                </div>
              </div>
              {isArch ? (
                <button onClick={function() { restoreItem(item.id); }} style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid #6BAA8E40", background: "#6BAA8E15", color: "#6BAA8E", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F, flexShrink: 0 }}>Restore</button>
              ) : (
                <button onClick={function() { removeItem(item.id); }} style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid " + T.bdr, background: "none", color: T.ink3, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{"\u2715"}</button>
              )}
            </div>
          </div>
        ); })}
        <div style={{ height: 40 }} />
      </div>

      {/* Undo toast */}
      {undoItem && (
        <Toast message={<>Archived <strong>{undoItem.title}</strong></>} onAction={undoArchive} actionLabel="Undo" />
      )}
      </div>
    </div>
  );
}
