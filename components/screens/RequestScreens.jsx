'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, W, F, S, MN, CAT, REQUESTS_DATA } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";

const renderMd = (text) => text.split("\n").map((line, i) => {
  const b = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return <div key={i} dangerouslySetInnerHTML={{ __html: b }} style={{ marginBottom: line === "" ? 8 : 2 }} />;
});

/* ── Request Form (visitor) ── */
export function RequestScreen() {
  const router = useRouter();
  const { profile } = useCurator();
  const profileName = profile?.name || "";
  const [requestText, setRequestText] = useState("");
  const [requestCat, setRequestCat] = useState(null);
  const [requestSent, setRequestSent] = useState(false);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "52px 20px 14px", flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
      </div>
      <div style={{ flex: 1, padding: "0 24px", overflowY: "auto", overscrollBehavior: "contain", minHeight: 0 }}>
        {!requestSent ? (
          <div className="fu">
            <h2 style={{ fontFamily: S, fontSize: 26, color: T.ink, fontWeight: 400, marginBottom: 6 }}>Ask {profileName} for a rec</h2>
            <p style={{ fontSize: 13, color: T.ink2, fontFamily: F, lineHeight: 1.6, marginBottom: 28 }}>Be specific. {profileName} personally reviews every request.</p>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Category</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
              {["restaurant", "music", "book", "tv", "travel", "product"].map(cat => {
                const c = CAT[cat]; const sel = requestCat === cat;
                return <button key={cat} onClick={() => setRequestCat(sel ? null : cat)} style={{ padding: "8px 14px", borderRadius: 20, border: "none", background: sel ? c.color : c.bg, color: sel ? "#fff" : c.color, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>{c.emoji} {c.label}</button>;
              })}
            </div>
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Your request</div>
            <textarea value={requestText} onChange={e => setRequestText(e.target.value)} placeholder={`e.g. "Great cocktails, not too loud, first date vibe"`} rows={4}
              style={{ width: "100%", padding: "16px", borderRadius: 14, border: `1.5px solid ${T.bdr}`, fontSize: 14, fontFamily: F, outline: "none", resize: "none", background: T.s, color: T.ink, lineHeight: 1.6 }}
            />
            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, marginTop: 20 }}>Your email</div>
            <input placeholder="you@email.com" type="email" style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${T.bdr}`, fontSize: 14, fontFamily: F, outline: "none", background: T.s, color: T.ink }} />
            <button onClick={() => { if (requestText.trim()) setRequestSent(true); }} style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", marginTop: 20, background: requestText.trim() ? T.acc : T.bdr, color: requestText.trim() ? T.accText : T.ink3, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F, transition: "all .2s" }}>Send request</button>
            <p style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 10, textAlign: "center" }}>Free · Subscribers get priority</p>
          </div>
        ) : (
          <div className="fu" style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: T.accSoft, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: T.acc, fontSize: 24 }}>✓</span></div>
            <h2 style={{ fontFamily: S, fontSize: 22, color: T.ink, fontWeight: 400, marginBottom: 8 }}>Request sent</h2>
            <p style={{ fontSize: 14, color: T.ink2, fontFamily: F, lineHeight: 1.6, maxWidth: 260, margin: "0 auto 28px" }}>{profileName} will send a personal recommendation.</p>
            <button onClick={() => router.back()} style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: T.acc, color: T.accText, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F }}>Back to profile</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Requests Panel (curator) ── */
export function RequestsPanel({ onClose, onOpenThread }) {
  const [requests] = useState(REQUESTS_DATA);
  const [requestFilter, setRequestFilter] = useState("all");
  const newRequests = requests.filter(r => r.status === "new");
  const repliedRequests = requests.filter(r => r.status === "replied");
  const autoRequests = requests.filter(r => r.status === "auto");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "52px 20px 14px", flexShrink: 0, borderBottom: `1px solid ${W.bdr}`, background: W.bg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← My AI</button>
        </div>
        <h2 style={{ fontFamily: S, fontSize: 26, color: T.ink, fontWeight: 400, marginBottom: 4 }}>Requests</h2>
        <p style={{ fontSize: 13, color: T.ink3, fontFamily: F, marginBottom: 14 }}>People asking for your taste. AI drafts responses — you approve or edit.</p>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: "all", label: "All", count: requests.length },
            { id: "new", label: "New", count: newRequests.length },
            { id: "replied", label: "Replied", count: repliedRequests.length },
            { id: "auto", label: "Auto", count: autoRequests.length },
          ].map(f => (
            <button key={f.id} onClick={() => setRequestFilter(f.id)} style={{
              padding: "6px 14px", borderRadius: 20, border: "none",
              background: requestFilter === f.id ? W.accent : W.s,
              color: requestFilter === f.id ? "#fff" : T.ink2,
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {f.label}
              <span style={{ fontSize: 10, opacity: .7 }}>({f.count})</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", background: W.bg, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
        {(requestFilter === "all" ? requests : requests.filter(r => r.status === requestFilter)).map((req, i) => {
          const c = CAT[req.category] || CAT.other;
          const isNew = req.status === "new";
          const isReplied = req.status === "replied";
          const isAuto = req.status === "auto";
          const timeAgo = (() => {
            const diff = Date.now() - new Date(req.date).getTime();
            const hrs = Math.floor(diff / 3600000);
            if (hrs < 1) return "Just now";
            if (hrs < 24) return `${hrs}h ago`;
            const days = Math.floor(hrs / 24);
            return days === 1 ? "Yesterday" : `${days}d ago`;
          })();
          return (
            <button key={req.id} className="fu" onClick={() => onOpenThread(req)}
              style={{
                width: "100%", padding: "16px", borderRadius: 16,
                border: `1px solid ${isNew ? W.accent + "40" : W.bdr}`,
                background: W.s, cursor: "pointer", textAlign: "left",
                marginBottom: 8, animationDelay: `${i * .04}s`,
                display: "flex", flexDirection: "column", gap: 10,
              }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{c.emoji}</div>
                  <div>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: T.ink }}>{req.from}</div>
                    <div style={{ fontFamily: MN, fontSize: 10, color: T.ink3, marginTop: 1 }}>{req.handle}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: F,
                    background: isNew ? "#EF444418" : isReplied ? T.accSoft : W.accent + "15",
                    color: isNew ? "#EF4444" : isReplied ? T.acc : W.accent,
                  }}>{isNew ? "New" : isReplied ? "Replied" : "Auto"}</span>
                  <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>{timeAgo}</span>
                </div>
              </div>
              <p style={{ fontFamily: F, fontSize: 14, color: T.ink, lineHeight: 1.5 }}>"{req.text}"</p>
              {isNew && req.aiDraft && (
                <div style={{ padding: "10px 12px", borderRadius: 10, background: W.accent + "10", border: `1px solid ${W.accent}20` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: W.accent, fontFamily: F, marginBottom: 4 }}>AI DRAFT READY</div>
                  <div style={{ fontSize: 12, color: T.ink2, fontFamily: F, lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{req.aiDraft.replace(/\*\*/g, "")}</div>
                </div>
              )}
              {isReplied && <p style={{ fontFamily: F, fontSize: 12, color: T.ink2, lineHeight: 1.45 }}>You: "{req.reply}"</p>}
              {isAuto && <p style={{ fontFamily: F, fontSize: 12, color: T.ink3, lineHeight: 1.45 }}>AI replied automatically</p>}
            </button>
          );
        })}
        {(requestFilter === "all" ? requests : requests.filter(r => r.status === requestFilter)).length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: T.ink3, fontSize: 13, fontFamily: F }}>No {requestFilter} requests yet.</div>
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

/* ── Request Thread (curator) ── */
export function RequestThread({ request, onBack }) {
  const [activeRequest, setActiveRequest] = useState(request);
  const [requestReply, setRequestReply] = useState("");

  const c = CAT[activeRequest.category] || CAT.other;
  const isNew = activeRequest.status === "new";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, background: W.bg }}>
      <div style={{ padding: "52px 20px 14px", flexShrink: 0, borderBottom: `1px solid ${W.bdr}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Requests</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
        {/* Request header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.emoji}</div>
          <div>
            <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: T.ink }}>{activeRequest.from}</div>
            <div style={{ fontFamily: MN, fontSize: 11, color: T.ink3, marginTop: 2 }}>{activeRequest.handle} · {c.label}</div>
          </div>
        </div>

        {/* The request */}
        <div style={{ padding: "18px 20px", background: W.s, borderRadius: 16, border: `1px solid ${W.bdr}`, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, fontFamily: F }}>Their request</div>
          <p style={{ fontFamily: F, fontSize: 16, color: T.ink, lineHeight: 1.6 }}>{activeRequest.text}</p>
        </div>

        {/* AI draft */}
        {activeRequest.aiDraft && isNew && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: W.accent, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F, display: "flex", alignItems: "center", gap: 6 }}>
              <span>✦</span> AI-drafted response
            </div>
            <div style={{ padding: "18px 20px", background: W.accent + "08", borderRadius: 16, border: `1px solid ${W.accent}20` }}>
              <div style={{ fontFamily: F, fontSize: 14, color: T.ink, lineHeight: 1.65 }}>{renderMd(activeRequest.aiDraft)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => {
                setActiveRequest(a => ({ ...a, status: "replied" }));
              }} style={{
                flex: 1, padding: "14px", borderRadius: 12, border: "none",
                background: T.acc, color: T.accText, fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: F,
              }}>Send as-is</button>
              <button onClick={() => setRequestReply(activeRequest.aiDraft.replace(/\*\*/g, ""))} style={{
                flex: 1, padding: "14px", borderRadius: 12,
                border: `1.5px solid ${W.bdr}`, background: W.s,
                color: T.ink, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: F,
              }}>Edit first</button>
            </div>
          </div>
        )}

        {/* Already replied */}
        {activeRequest.status === "replied" && activeRequest.reply && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.acc, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Your reply</div>
            <div style={{ padding: "18px 20px", background: T.accSoft, borderRadius: 16, border: `1px solid ${T.acc}20` }}>
              <p style={{ fontFamily: F, fontSize: 14, color: T.ink, lineHeight: 1.6 }}>{activeRequest.reply}</p>
            </div>
            <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 8 }}>✓ Sent{activeRequest.repliedAt ? ` · ${new Date(activeRequest.repliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>
          </div>
        )}

        {/* Auto-replied */}
        {activeRequest.status === "auto" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: W.accent, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Auto-replied by AI</div>
            <div style={{ padding: "18px 20px", background: W.accent + "08", borderRadius: 16, border: `1px solid ${W.accent}20` }}>
              <p style={{ fontFamily: F, fontSize: 14, color: T.ink, lineHeight: 1.6 }}>{renderMd(activeRequest.aiReply)}</p>
            </div>
            <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 8 }}>✦ Based on your recommendations</div>
          </div>
        )}

        {/* Manual reply box (for new requests if editing) */}
        {isNew && requestReply && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Your reply</div>
            <textarea value={requestReply} onChange={e => setRequestReply(e.target.value)} rows={4}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${W.bdr}`, fontSize: 14, fontFamily: F, outline: "none", resize: "none", background: W.s, color: T.ink, lineHeight: 1.6 }}
            />
            <button onClick={() => {
              setActiveRequest(a => ({ ...a, status: "replied", reply: requestReply }));
              setRequestReply("");
            }} style={{
              width: "100%", padding: "14px", borderRadius: 12, border: "none", marginTop: 10,
              background: requestReply.trim() ? T.acc : W.bdr, color: requestReply.trim() ? T.accText : T.ink3,
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F,
            }}>Send reply</button>
          </div>
        )}

        {/* Quick reply for new requests without editing */}
        {isNew && !requestReply && !activeRequest.aiDraft && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Write a reply</div>
            <textarea value={requestReply} onChange={e => setRequestReply(e.target.value)} rows={3}
              placeholder="Type your recommendation..."
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${W.bdr}`, fontSize: 14, fontFamily: F, outline: "none", resize: "none", background: W.s, color: T.ink, lineHeight: 1.6 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
