'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { T, F, S, CAT } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";
import CategoryPill from "@/components/shared/CategoryPill";
import RecCard from "./RecCard";

export default function SubscribedView({ onSwitchToNetwork }) {
  const router = useRouter();
  const { profileId, mySubscriptionIds, savedRecIds, saveRec, unsaveRec } = useCurator();
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState(null);

  useEffect(() => {
    async function load() {
      const subIds = [...mySubscriptionIds].filter(id => id !== profileId);
      if (subIds.length === 0) { setRecs([]); setLoading(false); return; }

      const { data: recRows, error: recErr } = await supabase
        .from("recommendations")
        .select("*")
        .in("profile_id", subIds)
        .eq("status", "approved")
        .eq("visibility", "public")
        .order("created_at", { ascending: false });
      if (recErr) { console.error("Failed to load subscribed recs:", recErr); setRecs([]); setLoading(false); return; }

      const curatorIds = [...new Set((recRows || []).map(r => r.profile_id))];
      let profileMap = {};
      if (curatorIds.length > 0) {
        const { data: profRows, error: profErr } = await supabase
          .from("profiles")
          .select("id, name, handle")
          .in("id", curatorIds);
        if (profErr) console.error("Failed to load subscribed curator profiles:", profErr);
        (profRows || []).forEach(p => { profileMap[p.id] = p; });
      }

      const merged = (recRows || []).map(r => ({ ...r, profiles: profileMap[r.profile_id] || null }));
      setRecs(merged);
      setLoading(false);
    }
    load();
  }, [mySubscriptionIds, profileId]);

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

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 13, color: T.ink3, fontFamily: F }}>Loading recs...</div>
      </div>
    );
  }

  // Variant A: not subscribed to any curators
  if (mySubscriptionIds.size === 0) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "48px 20px" }}>
          <div style={{ fontFamily: S, fontSize: 18, color: T.ink, fontWeight: 400, marginBottom: 8 }}>
            You're not subscribed to any curators yet.
          </div>
          <p style={{ fontFamily: F, fontSize: 14, color: T.ink3, lineHeight: 1.6, marginBottom: 16 }}>
            Subscribe to curators to see their recs here.
          </p>
          <button onClick={onSwitchToNetwork} style={{
            background: T.acc, border: "none", borderRadius: 10, padding: "12px 20px",
            cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 600, color: T.accText,
          }}>Browse Network</button>
        </div>
      </div>
    );
  }

  // Variant B: subscribed but no recs from them yet
  if (recs.length === 0) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "48px 20px" }}>
          <div style={{ fontFamily: S, fontSize: 18, color: T.ink, fontWeight: 400, marginBottom: 8 }}>
            No recs yet from the curators you subscribe to.
          </div>
          <p style={{ fontFamily: F, fontSize: 14, color: T.ink3, lineHeight: 1.6 }}>
            Check back soon.
          </p>
        </div>
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
          <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>{"◆"}</div>
          <div style={{ fontFamily: S, fontSize: 18, color: T.ink, fontWeight: 400, marginBottom: 8 }}>No recs found</div>
          <p style={{ fontFamily: F, fontSize: 13, color: T.ink3 }}>
            {search ? "Try a different search" : "No recs match that filter"}
          </p>
        </div>
      )}

      {filtered.map((rec, i) => (
        <div key={rec.id} className="fu" style={{ animationDelay: (i * .03) + "s" }}>
          <RecCard
            item={{ ...rec, date: rec.created_at?.split("T")[0] }}
            onClick={() => router.push(`/find/${rec.slug || rec.id}`)}
            showCurator
            curatorName={rec.profiles?.name}
            curatorHandle={rec.profiles?.handle}
            onHandleClick={() => router.push(`/${rec.profiles?.handle}`)}
            onBookmark={() => savedRecIds.has(rec.id) ? unsaveRec(rec.id) : saveRec(rec.id)}
            isBookmarked={savedRecIds.has(rec.id)}
          />
        </div>
      ))}

      <div style={{ height: 40 }} />
    </div>
  );
}
