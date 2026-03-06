'use client'

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { T, F, S, CAT } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";

export default function VisitorProfile({ mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ctx = useCurator();
  const { profile, profileId, tasteItems, isOwner } = ctx;
  const [subToggling, setSubToggling] = useState(false);

  // Local subscription state for visitor mode
  const [localSubbed, setLocalSubbed] = useState(false);
  const [myProfileId, setMyProfileId] = useState(null);

  // Network data
  const [subscribedTo, setSubscribedTo] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [networkLoaded, setNetworkLoaded] = useState(false);

  // My subscriptions (for showing sub status on curator rows)
  const [mySubIds, setMySubIds] = useState(new Set());

  useEffect(() => {
    if (mode !== "visitor" || isOwner || !profileId) return;
    async function checkSub() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: myProf } = await supabase
        .from("profiles").select("id").eq("auth_user_id", user.id).single();
      if (!myProf) return;
      setMyProfileId(myProf.id);
      try {
        const { data } = await supabase
          .from("subscriptions").select("id")
          .eq("subscriber_id", myProf.id).eq("curator_id", profileId)
          .is("unsubscribed_at", null).limit(1);
        if (data && data.length > 0) setLocalSubbed(true);
      } catch { /* subscriptions table may not exist */ }
    }
    checkSub();
  }, [mode, isOwner, profileId]);

  // Fetch network data
  useEffect(() => {
    if (!profileId || !profile) return;
    async function loadNetwork() {
      try {
        // Fetch logged-in user's subscriptions for sub status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: myProf } = await supabase
            .from("profiles").select("id").eq("auth_user_id", user.id).single();
          if (myProf) {
            setMyProfileId(myProf.id);
            const { data: mySubs } = await supabase
              .from("subscriptions").select("curator_id")
              .eq("subscriber_id", myProf.id).is("unsubscribed_at", null);
            if (mySubs) setMySubIds(new Set(mySubs.map(s => s.curator_id)));
          }
        }

        if (profile.showSubscriptions) {
          const { data: subRows } = await supabase
            .from("subscriptions").select("curator_id")
            .eq("subscriber_id", profileId).is("unsubscribed_at", null);
          if (subRows && subRows.length > 0) {
            const ids = subRows.map(s => s.curator_id);
            const { data: profiles } = await supabase
              .from("profiles").select("id, name, handle, bio").in("id", ids);
            setSubscribedTo(profiles || []);
          }
        }

        if (profile.showSubscribers) {
          const { data: fanRows } = await supabase
            .from("subscriptions").select("subscriber_id")
            .eq("curator_id", profileId).is("unsubscribed_at", null);
          if (fanRows && fanRows.length > 0) {
            const ids = fanRows.map(s => s.subscriber_id);
            const { data: profiles } = await supabase
              .from("profiles").select("id, name, handle, bio").in("id", ids);
            setSubscribers(profiles || []);
          }
        }
      } catch (err) {
        console.warn("Failed to load network data:", err);
      }
      setNetworkLoaded(true);
    }
    loadNetwork();
  }, [profileId, profile?.showSubscriptions, profile?.showSubscribers]);

  const [profileTab, setProfileTab] = useState("recent");
  const [profileCopied, setProfileCopied] = useState(false);

  // Determine active view from query params
  const viewParam = searchParams.get("view") || "recs";
  const showSubsTo = profile?.showSubscriptions && subscribedTo.length > 0;
  const showSubsOf = profile?.showSubscribers && subscribers.length > 0;

  // Fall back to recs if view param points to hidden/empty data
  const activeView = (viewParam === "subscribed-to" && showSubsTo) ? "subscribed-to"
    : (viewParam === "subscribers" && showSubsOf) ? "subscribers"
    : "recs";

  const setView = (v) => {
    const handle = profile.handle.replace("@", "");
    if (v === "recs") {
      router.replace(`/${handle}`, { scroll: false });
    } else {
      router.replace(`/${handle}?view=${v}`, { scroll: false });
    }
  };

  const handleSubToCurator = async (curatorId) => {
    if (!myProfileId) {
      window.location.href = '/login';
      return;
    }
    // Optimistic update
    setMySubIds(prev => new Set([...prev, curatorId]));
    try {
      const { data: existing } = await supabase.from("subscriptions")
        .select("*").eq("subscriber_id", myProfileId).eq("curator_id", curatorId)
        .limit(1).maybeSingle();
      if (existing) {
        await supabase.from("subscriptions").update({ unsubscribed_at: null }).eq("id", existing.id);
      } else {
        await supabase.from("subscriptions").insert({ subscriber_id: myProfileId, curator_id: curatorId });
      }
    } catch (err) {
      console.error("Subscribe failed:", err);
      setMySubIds(prev => { const next = new Set(prev); next.delete(curatorId); return next; });
    }
  };

  if (!profile) return null;

  const handle = profile.handle.replace("@", "");
  const items = tasteItems;
  const n = items.length;
  const activeItems = items;
  const cats = [...new Set(activeItems.map(i => i.category))];
  const cc = {}; cats.forEach(c => { cc[c] = activeItems.filter(i => i.category === c).length; });
  const topCats = [...cats].sort((a, b) => (cc[b] || 0) - (cc[a] || 0));

  const shareProfile = () => {
    const url = `curators.com/${handle}`;
    if (navigator.share) {
      navigator.share({ title: `${profile.name} on Curators`, url: `https://${url}` }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`https://${url}`);
    }
    setProfileCopied(true);
    setTimeout(() => setProfileCopied(false), 2200);
  };

  const onSelectItem = (item) => {
    if (mode === "curator") {
      router.push(`/recommendations/${item.slug}`);
    } else {
      router.push(`/${handle}/${item.slug}`);
    }
  };

  const onOpenAI = () => {
    if (mode === "curator") {
      router.push('/myai');
    } else {
      router.push(`/${handle}/ask`);
    }
  };

  const CuratorRow = ({ curator }) => {
    const isSubbed = mySubIds.has(curator.id);
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
        background: T.bg2, borderRadius: 14, border: `1px solid ${T.bdr}`, marginBottom: 8,
        cursor: "pointer",
      }} onClick={() => router.push(`/${curator.handle}`)}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: T.accSoft, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: S, fontSize: 16, color: T.acc, fontWeight: 400, fontStyle: "italic" }}>{curator.name?.[0]}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: S, fontSize: 16, color: T.ink, fontWeight: 400 }}>{curator.name}</div>
          <div style={{ fontSize: 11, color: T.ink3, fontFamily: F }}>@{curator.handle}</div>
          {curator.bio && (
            <div style={{ fontSize: 12, color: T.ink3, fontFamily: F, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{curator.bio}</div>
          )}
        </div>
        {curator.id !== myProfileId && (
          isSubbed ? (
            <span style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, fontFamily: F, color: T.ink3, whiteSpace: "nowrap" }}>Subscribed ✓</span>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); handleSubToCurator(curator.id); }} style={{
              padding: "5px 12px", borderRadius: 20, border: `1px solid ${T.bdr}`,
              background: "none", color: T.acc, fontSize: 11, fontWeight: 600,
              fontFamily: F, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>+ Sub</button>
          )
        )}
      </div>
    );
  };

  // Build stats for the filter nav
  const stats = [{ id: "recs", label: "Recs", count: n }];
  if (showSubsTo) stats.push({ id: "subscribed-to", label: "Subscribed to", count: subscribedTo.length });
  if (showSubsOf) stats.push({ id: "subscribers", label: "Subscribers", count: subscribers.length });

  return (
    <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
      <div style={{ maxWidth: 700, margin: "0 auto", width: "100%" }}>

      {/* Back arrow for visitor mode (viewing another curator) */}
      {mode === "visitor" && !isOwner && (
        <div style={{ padding: "48px 20px 0" }}>
          <button onClick={() => router.back()} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
            display: "flex", alignItems: "center",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Edit banner for owner */}
      {isOwner && (
        <div style={{
          margin: "48px 16px 0", padding: "12px 16px", borderRadius: 12,
          background: T.acc + "15", border: `1px solid ${T.acc}30`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: F, fontSize: 13, color: T.acc, fontWeight: 500 }}>
            This is your public profile
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={shareProfile} style={{
              background: "none", border: `1px solid ${T.acc}50`, borderRadius: 8, padding: "6px 14px",
              cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 600, color: T.acc,
              display: "flex", alignItems: "center", gap: 5,
            }}>{profileCopied ? "Copied \u2713" : "Share \u2197"}</button>
            <button onClick={() => router.push(`/${handle}/edit`)} style={{
              background: T.acc, border: "none", borderRadius: 8, padding: "6px 14px",
              cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 700, color: T.accText,
            }}>Edit</button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div style={{ padding: isOwner ? "20px 24px 0" : "36px 24px 0", textAlign: "center" }}>
        <div style={{
          width: 92, height: 92, borderRadius: 26, margin: "0 auto 18px",
          background: `linear-gradient(145deg, ${T.s2}, ${T.s})`,
          border: `2px solid ${T.bdr}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
        }}>
          <span style={{ fontFamily: S, fontSize: 38, color: T.acc, fontWeight: 400 }}>{profile.name[0]}</span>
        </div>
        <h1 style={{ fontFamily: S, fontSize: 34, color: T.ink, fontWeight: 400, lineHeight: 1.1, marginBottom: 6 }}>{profile.name}</h1>
        <p style={{ fontFamily: F, fontSize: 13, color: T.ink3, marginBottom: 14 }}>
          {profile.handle}
        </p>
        {mode === "visitor" && !isOwner && myProfileId && (
          <button onClick={async () => {
            if (subToggling) return;
            setSubToggling(true);
            try {
              if (localSubbed) {
                await supabase.from("subscriptions")
                  .update({ unsubscribed_at: new Date().toISOString() })
                  .eq("subscriber_id", myProfileId).eq("curator_id", profileId)
                  .is("unsubscribed_at", null);
                setLocalSubbed(false);
              } else {
                const { data: existing } = await supabase.from("subscriptions")
                  .select("*")
                  .eq("subscriber_id", myProfileId)
                  .eq("curator_id", profileId)
                  .limit(1)
                  .maybeSingle();
                if (existing) {
                  await supabase.from("subscriptions")
                    .update({ unsubscribed_at: null })
                    .eq("id", existing.id);
                } else {
                  await supabase.from("subscriptions")
                    .insert({ subscriber_id: myProfileId, curator_id: profileId });
                }
                setLocalSubbed(true);
              }
            } catch (err) { console.error("Subscribe toggle failed:", err); }
            finally { setSubToggling(false); }
          }} style={{
            background: localSubbed ? "transparent" : T.acc,
            border: localSubbed ? `1px solid ${T.bdr}` : "none",
            borderRadius: 8, padding: "6px 18px", cursor: "pointer",
            fontFamily: F, fontSize: 12, fontWeight: 600,
            color: localSubbed ? T.ink3 : "#fff",
            marginBottom: 10, transition: "all .15s",
          }}>{localSubbed ? "Subscribed" : "Subscribe"}</button>
        )}
        <p style={{ fontFamily: F, fontSize: 14, color: T.ink2, lineHeight: 1.65, maxWidth: 300, margin: "0 auto" }}>
          {profile.bio}
        </p>
      </div>

      {/* Stats filter nav */}
      {stats.length > 1 && (
        <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "center", gap: 24 }}>
          {stats.map(stat => (
            <button key={stat.id} onClick={() => setView(stat.id)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "4px 0",
              borderBottom: activeView === stat.id ? `2px solid ${T.acc}` : "2px solid transparent",
              transition: "border-color .15s",
            }}>
              <div style={{ fontFamily: F, fontSize: 18, fontWeight: 700, color: activeView === stat.id ? T.acc : T.ink3 }}>{stat.count}</div>
              <div style={{ fontFamily: F, fontSize: 11, color: activeView === stat.id ? T.acc : T.ink3, marginTop: 2 }}>{stat.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Taste spectrum — only when recs view and recs exist */}
      {activeView === "recs" && n > 0 && profile.showRecs !== false && (
        <div style={{ padding: "24px 28px 0" }}>
          <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", height: 4, background: T.s2 }}>
            {topCats.map(cat => {
              const c = CAT[cat] || CAT.other;
              return <div key={cat} style={{ width: `${((cc[cat] || 0) / n) * 100}%`, background: c.color, minWidth: 3 }} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
            {topCats.map(cat => {
              const c = CAT[cat] || CAT.other;
              return (
                <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: T.ink2, fontFamily: F }}>
                  <span style={{ width: 5, height: 5, borderRadius: 3, background: c.color }} />
                  {cc[cat]} {c.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Ask AI banner — only in recs view */}
      {activeView === "recs" && profile.aiEnabled && n >= 5 && (
        <div style={{ padding: "16px 20px 0" }}>
          <button onClick={onOpenAI} style={{
            width: "100%", padding: "18px 20px", borderRadius: 16, border: `1px solid ${T.acc}30`,
            cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 16,
            background: `linear-gradient(135deg, ${T.acc}12, ${T.s})`, position: "relative", overflow: "hidden",
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14, flexShrink: 0,
              background: `linear-gradient(145deg, ${T.acc}25, ${T.acc}10)`, border: `1px solid ${T.acc}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: S, fontSize: 22, color: T.acc, fontWeight: 400 }}>{profile.name[0]}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
                Chat with {profile.name}'s AI
              </div>
              <div style={{ fontFamily: F, fontSize: 12, color: T.ink2, lineHeight: 1.4 }}>
                Ask about their recommendations — get personalized suggestions from their taste
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
            <div style={{ position: "absolute", top: 14, right: 14, width: 6, height: 6, borderRadius: 3, background: T.acc, animation: "breathe 3s ease-in-out infinite" }} />
          </button>
        </div>
      )}

      {/* Recs view */}
      {activeView === "recs" && n > 0 && profile.showRecs !== false ? (
        <>
          <div style={{ padding: "28px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em" }}>
                What {profile.name} recommends
              </span>
              <div style={{ display: "flex", gap: 2, background: T.s, borderRadius: 8, padding: 2 }}>
                {["recent", "categories"].map(tab => (
                  <button key={tab} onClick={() => setProfileTab(tab)} style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    background: profileTab === tab ? T.s2 : "transparent", color: profileTab === tab ? T.ink : T.ink3,
                    fontSize: 10, fontWeight: 600, fontFamily: F,
                  }}>{tab === "recent" ? "Recent" : "By Category"}</button>
                ))}
              </div>
            </div>

            {profileTab === "recent" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {items.filter(i => mode === "curator" || i.visibility === "public").map((item, i) => {
                  const c = CAT[item.category] || CAT.other;
                  return (
                    <div key={item.id} className="fu" onClick={() => onSelectItem(item)} style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 15px",
                      background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, animationDelay: `${i * .05}s`,
                      cursor: "pointer", transition: "border-color .15s",
                    }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{c.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: T.ink2, fontFamily: F, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.context}</div>
                      </div>
                      <span style={{ color: T.ink3, fontSize: 14, flexShrink: 0 }}>›</span>
                    </div>
                  );
                })}
              </div>
            )}

            {profileTab === "categories" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {topCats.map((cat, i) => {
                  const c = CAT[cat] || CAT.other;
                  const ci = items.filter(x => x.category === cat);
                  return (
                    <div key={cat} className="fu" style={{ padding: "16px", background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, animationDelay: `${i * .06}s` }}>
                      <div style={{ fontSize: 22, marginBottom: 8 }}>{c.emoji}</div>
                      <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{c.label}</div>
                      <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginBottom: 8 }}>{cc[cat]} rec{cc[cat] !== 1 ? "s" : ""}</div>
                      <div style={{ fontSize: 12, color: T.ink2, fontFamily: F, lineHeight: 1.4 }}>
                        {ci.slice(0, 2).map(x => x.title).join(", ")}{ci.length > 2 ? `, +${ci.length - 2}` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pull quote */}
          {items[3] && (
            <div style={{ padding: "28px 20px 20px" }}>
              <div style={{ background: T.s, borderRadius: 16, padding: "22px 20px", borderLeft: `3px solid ${T.acc}` }}>
                <div style={{ fontFamily: S, fontSize: 17, fontStyle: "italic", color: T.ink, lineHeight: 1.55, marginBottom: 8 }}>
                  {items[3]?.context}
                </div>
                <div style={{ fontSize: 12, color: T.ink3, fontFamily: F }}>— on {items[3]?.title}</div>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Subscribed to view */}
      {activeView === "subscribed-to" && (
        <div style={{ padding: "28px 20px 20px" }}>
          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>
            {profile.name} subscribes to
          </div>
          {subscribedTo.map(c => <CuratorRow key={c.id} curator={c} />)}
        </div>
      )}

      {/* Subscribers view */}
      {activeView === "subscribers" && (
        <div style={{ padding: "28px 20px 20px" }}>
          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>
            Subscribed to {profile.name}
          </div>
          {subscribers.map(c => <CuratorRow key={c.id} curator={c} />)}
        </div>
      )}

      </div>
    </div>
  );
}
