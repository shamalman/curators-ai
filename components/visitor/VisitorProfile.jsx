'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { T, F, S, MN, CAT } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";

export default function VisitorProfile({ mode }) {
  const router = useRouter();
  const { profile, profileId, tasteItems, isOwner } = useCurator();
  const [subscribed, setSubscribed] = useState(false);
  const [subEmail, setSubEmail] = useState("");
  const [profileTab, setProfileTab] = useState("recent");
  const [profileCopied, setProfileCopied] = useState(false);

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

  return (
    <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
      <div style={{ maxWidth: 700, margin: "0 auto", width: "100%" }}>

      {/* Curator edit banner */}
      {mode === "curator" && (
        <div style={{
          margin: "48px 16px 0", padding: "12px 16px", borderRadius: 12,
          background: T.acc + "15", border: `1px solid ${T.acc}30`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: F, fontSize: 13, color: T.acc, fontWeight: 500 }}>
            This is your public profile
          </span>
          <div style={{ display: "flex", gap: 8 }}>
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

      {/* Visitor top bar */}
      {mode === "visitor" && (
        <div style={{ padding: "48px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: S, fontSize: 15, color: T.ink3 }}>curators</span>
          {isOwner ? (
            <button onClick={() => router.push(`/${handle}/edit`)} style={{
              background: T.acc, border: "none", borderRadius: 8, padding: "6px 14px",
              cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 600, color: T.accText,
            }}>Edit Profile</button>
          ) : (
            <button onClick={() => router.push('/login')} style={{ background: "none", border: "1px solid " + T.bdr, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: MN, fontSize: 9, color: T.ink3 }}>log in →</button>
          )}
        </div>
      )}

      {/* Hero */}
      <div style={{ padding: mode === "curator" ? "20px 24px 0" : "36px 24px 0", textAlign: "center" }}>
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
        <p style={{ fontFamily: F, fontSize: 14, color: T.ink2, lineHeight: 1.65, maxWidth: 300, margin: "0 auto" }}>
          {profile.bio}
        </p>
      </div>

      {/* Email subscribe widget */}
      {!subscribed ? (
        <div style={{ padding: "16px 28px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="email"
              value={subEmail}
              onChange={e => setSubEmail(e.target.value)}
              placeholder={`Get notified of new recs`}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 13,
                fontFamily: F, background: T.s, border: "1px solid " + T.bdr,
                color: T.ink, outline: "none",
              }}
              onKeyDown={e => e.key === "Enter" && subEmail.includes("@") && (async () => {
                console.log("Subscribing with curator_id:", profileId, "email:", subEmail);
                const { error } = await supabase.from("subscribers").insert({ curator_id: profileId, email: subEmail });
                if (error) { console.error("Subscribe failed:", error, "curator_id was:", profileId); return; }
                setSubscribed(true);
              })()}
            />
            <button
              onClick={async () => {
                if (!subEmail.includes("@")) return;
                console.log("Subscribing with curator_id:", profileId, "email:", subEmail);
                const { error } = await supabase.from("subscribers").insert({ curator_id: profileId, email: subEmail });
                if (error) { console.error("Subscribe failed:", error, "curator_id was:", profileId); return; }
                setSubscribed(true);
              }}
              style={{
                padding: "10px 16px", borderRadius: 10, border: "none",
                background: T.acc, color: "#fff", fontSize: 13, fontWeight: 600,
                fontFamily: F, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >Subscribe</button>
          </div>
        </div>
      ) : (
        <div style={{ padding: "16px 28px 0", textAlign: "center" }}>
          <p style={{ fontFamily: F, fontSize: 13, color: T.acc }}>✓ You'll get notified of new recs</p>
        </div>
      )}

      {/* Taste spectrum */}
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

      {/* Two action cards */}
      <div style={{ padding: "12px 20px 0", display: "flex", gap: 10 }}>
        {profile.aiEnabled && (
          <button onClick={onOpenAI} style={{
            flex: 1, padding: "22px 16px", borderRadius: 18, border: "1px solid " + T.bdr, cursor: "pointer", textAlign: "left",
            background: `linear-gradient(160deg, ${T.s2}, ${T.s})`, position: "relative", overflow: "hidden",
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.accSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>🧠</span>
            </div>
            <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
              Ask {profile.name}'s AI
            </div>
            <div style={{ fontFamily: F, fontSize: 11, color: T.ink2, lineHeight: 1.45 }}>
              Get streams of their new recommendations
            </div>
            <div style={{ position: "absolute", top: 18, right: 18, width: 7, height: 7, borderRadius: 4, background: T.acc, animation: "breathe 3s ease-in-out infinite" }} />
          </button>
        )}
        <button onClick={() => { mode === "visitor" ? router.push(`/${handle}/request`) : router.push('/recommendations/review'); }} style={{
          flex: 1, padding: "22px 16px", borderRadius: 18, border: "1px solid " + T.bdr,
          background: T.s, cursor: "pointer", textAlign: "left",
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#9B8BC215", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🙏</span>
          </div>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Request a rec</div>
          <div style={{ fontFamily: F, fontSize: 11, color: T.ink2, lineHeight: 1.45 }}>
            Ask {profile.name} directly for a recommendation
          </div>
        </button>
      </div>

      {/* Taste preview */}
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
            {items.filter(i => mode === "curator" || i.visibility === "public").slice(0, 6).map((item, i) => {
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
            {items.length > 6 && (
              <button onClick={onOpenAI} style={{ padding: "14px", borderRadius: 14, border: `1px dashed ${T.bdr}`, background: "none", cursor: "pointer", fontFamily: F, fontSize: 13, color: T.ink2, fontWeight: 500, textAlign: "center" }}>
                + {items.length - 6} more — ask the AI →
              </button>
            )}
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

      </div>
    </div>
  );
}
