'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { T, F, S, CAT } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";
import CategoryPill from "@/components/shared/CategoryPill";
import RecCard from "./RecCard";

export default function NetworkView() {
  const router = useRouter();
  const { savedRecIds, saveRec, unsaveRec } = useCurator();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("recommendations")
        .select("*, profiles(id, name, handle)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) console.error("Failed to load network recs:", error);
      setRecs(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const q = search.toLowerCase().trim();
  const qAlt = q.endsWith("s") ? q.slice(0, -1) : q + "s";
  const matches = (text) => text?.toLowerCase().includes(q) || text?.toLowerCase().includes(qAlt);
  let filtered = recs;
  if (q) {
    filtered = filtered.filter(r => {
      const cat = CAT[r.category] || CAT.other;
      return matches(r.title) ||
        matches(r.context) ||
        (r.tags || []).some(t => matches(t)) ||
        matches(r.category) ||
        matches(cat.label);
    });
  }
  if (filterCat) {
    filtered = filtered.filter(r => r.category === filterCat);
  }

  const cats = [...new Set(filtered.map(r => r.category))];
  const cc = {};
  cats.forEach(c => { cc[c] = filtered.filter(r => r.category === c).length; });

  const curatorSet = new Set();
  filtered.forEach(r => { if (r.profiles?.handle) curatorSet.add(r.profiles.handle); });

  // Attribution: count per curator
  const curatorCounts = {};
  filtered.forEach(r => {
    const h = r.profiles?.handle;
    if (h) curatorCounts[h] = (curatorCounts[h] || 0) + 1;
  });
  const sortedCurators = Object.entries(curatorCounts).sort((a, b) => b[1] - a[1]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 13, color: T.ink3, fontFamily: F }}>Loading recs...</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", WebkitOverflowScrolling: "touch" }}>
      {/* Search */}
      <div style={{ padding: "8px 0 12px" }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recs..."
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10,
            border: "1px solid " + T.bdr, background: T.s, color: T.ink,
            fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Category pills */}
      {cats.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, flexShrink: 0 }}>
          <CategoryPill categories={cats} counts={cc} activeCategory={filterCat} onSelect={setFilterCat} activeCount={filtered.length} />
        </div>
      )}

      {/* Count line */}
      <p style={{ fontSize: 12, color: T.ink3, fontFamily: F, marginBottom: 8 }}>
        {filtered.length} rec{filtered.length !== 1 ? "s" : ""} from {curatorSet.size} curator{curatorSet.size !== 1 ? "s" : ""}
      </p>

      {/* Rec list */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>{"\u25C6"}</div>
          <div style={{ fontFamily: S, fontSize: 18, color: T.ink, fontWeight: 400, marginBottom: 8 }}>No recs found</div>
          <p style={{ fontFamily: F, fontSize: 13, color: T.ink3 }}>
            {search ? "Try a different search" : "No approved recs in the network yet"}
          </p>
        </div>
      )}

      {filtered.map((rec, i) => (
        <div key={rec.id} className="fu" style={{ animationDelay: (i * .03) + "s" }}>
          <RecCard
            item={{ ...rec, date: rec.created_at?.split("T")[0] }}
            onClick={() => router.push(`/recommendations/${rec.slug || rec.id}`)}
            showCurator
            curatorName={rec.profiles?.name}
            curatorHandle={rec.profiles?.handle}
            onHandleClick={() => router.push(`/${rec.profiles?.handle}`)}
            onBookmark={() => savedRecIds.has(rec.id) ? unsaveRec(rec.id) : saveRec(rec.id)}
            isBookmarked={savedRecIds.has(rec.id)}
          />
        </div>
      ))}

      {/* Attribution summary */}
      {sortedCurators.length > 0 && filtered.length > 0 && (
        <div style={{ padding: "20px 0 8px" }}>
          <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, lineHeight: 1.6 }}>
            From {sortedCurators.length} curator{sortedCurators.length !== 1 ? "s" : ""}:{" "}
            {sortedCurators.map(([h, c], i) => (
              <span key={h}>
                {i > 0 ? " · " : ""}
                <span style={{ color: T.ink2 }}>@{h}</span> ({c})
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}
