'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { T, F, S } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";
import CategoryPill from "@/components/shared/CategoryPill";
import RecCard from "./RecCard";

export default function SavedView({ onSwitchToNetwork }) {
  const router = useRouter();
  const { savedRecIds, unsaveRec } = useCurator();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(null);

  useEffect(() => {
    async function load() {
      const ids = [...savedRecIds];
      if (ids.length === 0) { setRecs([]); setLoading(false); return; }
      const { data, error } = await supabase
        .from("recommendations")
        .select("*, profiles(id, name, handle)")
        .in("id", ids)
        .eq("visibility", "public");
      if (error) console.error("Failed to load saved recs:", error);
      setRecs(data || []);
      setLoading(false);
    }
    load();
  }, [savedRecIds]);

  const q = search.toLowerCase().trim();
  let filtered = recs;
  if (q) {
    filtered = filtered.filter(r =>
      r.title?.toLowerCase().includes(q) ||
      r.context?.toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  const cats = [...new Set(filtered.map(r => r.category))];
  const cc = {};
  cats.forEach(c => { cc[c] = filtered.filter(r => r.category === c).length; });
  if (filterCat) {
    filtered = filtered.filter(r => r.category === filterCat);
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 13, color: T.ink3, fontFamily: F }}>Loading saved recs...</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", WebkitOverflowScrolling: "touch" }}>
      {/* Search */}
      {recs.length > 0 && (
        <div style={{ padding: "8px 0 12px" }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search saved recs..."
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid " + T.bdr, background: T.s, color: T.ink,
              fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* Category pills */}
      {cats.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, flexShrink: 0 }}>
          <CategoryPill categories={cats} counts={cc} activeCategory={filterCat} onSelect={setFilterCat} activeCount={recs.length} />
        </div>
      )}

      {/* Count line */}
      {recs.length > 0 && (
        <p style={{ fontSize: 12, color: T.ink3, fontFamily: F, marginBottom: 8 }}>
          {filtered.length} saved rec{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Empty state */}
      {recs.length === 0 && (
        <div style={{ padding: "48px 20px" }}>
          <p style={{ fontFamily: F, fontSize: 14, color: T.ink3, lineHeight: 1.6, marginBottom: 16 }}>
            No saved recs yet. Bookmark recommendations from the{" "}
            <span onClick={onSwitchToNetwork} style={{ color: T.acc, cursor: "pointer", fontWeight: 600 }}>Network tab</span>
            {" "}or a curator's profile, and they'll appear here.
          </p>
          <button onClick={onSwitchToNetwork} style={{
            background: T.acc, border: "none", borderRadius: 10, padding: "12px 20px",
            cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 600, color: T.accText,
            marginBottom: 28,
          }}>Browse Network</button>

          <p style={{ fontFamily: F, fontSize: 12, color: T.ink3, lineHeight: 1.6 }}>
            Everything you save helps your AI understand your taste and make better recommendations for you.
          </p>
        </div>
      )}

      {/* Rec list */}
      {filtered.map((rec, i) => (
        <div key={rec.id} className="fu" style={{ animationDelay: (i * .03) + "s" }}>
          <RecCard
            item={{ ...rec, date: rec.created_at?.split("T")[0] }}
            onClick={() => router.push(`/find/${rec.slug || rec.id}`)}
            showCurator
            curatorName={rec.profiles?.name}
            curatorHandle={rec.profiles?.handle}
            onHandleClick={() => router.push(`/${rec.profiles?.handle}`)}
            onBookmark={() => unsaveRec(rec.id)}
            isBookmarked={true}
          />
        </div>
      ))}

      <div style={{ height: 40 }} />
    </div>
  );
}
