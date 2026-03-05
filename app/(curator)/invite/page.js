'use client'

import { useState, useEffect, useContext } from "react";
import { T, F, S, MN } from "@/lib/constants";
import { CuratorContext } from "@/context/CuratorContext";

const MAX_UNUSED = 5;

export default function InvitePage() {
  const { profileId } = useContext(CuratorContext);
  const [unused, setUnused] = useState([]);
  const [used, setUsed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showNoteFor, setShowNoteFor] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [showAllUsed, setShowAllUsed] = useState(false);

  const fetchCodes = async () => {
    if (!profileId) return;
    try {
      const res = await fetch(`/api/invite?profileId=${profileId}&mode=all`);
      const data = await res.json();
      setUnused(data.unused || []);
      setUsed(data.used || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, [profileId]);

  const generateNew = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, action: "generate" }),
      });
      const data = await res.json();
      if (data.code) {
        setUnused(prev => [{ ...data.code, created_at: new Date().toISOString() }, ...prev]);
        setShowNoteFor(data.code.id);
        setNoteText("");
      }
    } catch {}
    setGenerating(false);
  };

  const saveNote = async (codeId) => {
    await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId, inviterNote: noteText.trim() }),
    });
    setUnused(prev => prev.map(c => c.id === codeId ? { ...c, inviter_note: noteText.trim() } : c));
    setNoteSaved(codeId);
    setShowNoteFor(null);
    setTimeout(() => setNoteSaved(null), 2000);
  };

  const buildShareText = (code) => {
    const note = code.inviter_note;
    const header = note ? `Join me on Curators \u2014 ${note}` : "Join me on Curators";
    return `${header}\nInvite code: ${code.code}\nhttps://curators-ai.vercel.app/signup`;
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(buildShareText(code));
    setCopiedId(code.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareCode = async (code) => {
    if (navigator.share) {
      try { await navigator.share({ title: "Curators Invite", text: buildShareText(code) }); } catch {}
    } else {
      copyCode(code);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const visibleUsed = showAllUsed ? used : used.slice(0, 5);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
        <span style={{ fontFamily: F, fontSize: 13, color: T.ink3 }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto", background: T.bg }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 16px 80px" }}>
        <h1 style={{ fontFamily: S, fontSize: 26, color: T.ink, fontWeight: 400, margin: "0 0 24px" }}>Invites</h1>

        {/* YOUR INVITE CODES */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", margin: 0 }}>Your Invite Codes</h2>
            <span style={{ fontFamily: F, fontSize: 11, color: T.ink3 }}>{unused.length}/{MAX_UNUSED} slots used</span>
          </div>

          {unused.length < MAX_UNUSED ? (
            <button onClick={generateNew} disabled={generating} style={{
              width: "100%", padding: "12px", borderRadius: 10, border: `1px dashed ${T.bdr}`,
              background: "transparent", color: T.acc, fontSize: 13, fontWeight: 600,
              cursor: generating ? "default" : "pointer", fontFamily: F, marginBottom: 12,
              opacity: generating ? 0.6 : 1,
            }}>{generating ? "Generating..." : "+ Generate new code"}</button>
          ) : (
            <div style={{
              padding: "12px 14px", borderRadius: 10, background: T.s,
              border: `1px solid ${T.bdr}`, marginBottom: 12,
              fontFamily: F, fontSize: 12, color: T.ink3, lineHeight: 1.5,
            }}>You have {MAX_UNUSED} pending invites. A slot opens when someone uses a code.</div>
          )}

          {unused.length === 0 && (
            <div style={{ padding: "20px 0", textAlign: "center", fontFamily: F, fontSize: 13, color: T.ink3 }}>
              No pending invite codes. Generate one above.
            </div>
          )}

          {unused.map(code => (
            <div key={code.id} style={{
              padding: "14px 16px", borderRadius: 12, background: T.s,
              border: `1px solid ${T.bdr}`, marginBottom: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: code.inviter_note ? 6 : 0 }}>
                <div style={{ fontFamily: MN, fontSize: 16, fontWeight: 700, color: T.ink, letterSpacing: ".04em" }}>{code.code}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => copyCode(code)} style={{
                    padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.bdr}`,
                    background: copiedId === code.id ? T.accSoft : T.bg, color: copiedId === code.id ? T.acc : T.ink2,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F,
                  }}>{copiedId === code.id ? "\u2713 Copied" : "Copy"}</button>
                  <button onClick={() => shareCode(code)} style={{
                    padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.bdr}`,
                    background: T.bg, color: T.ink2,
                    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F,
                  }}>Share</button>
                </div>
              </div>

              {code.inviter_note && showNoteFor !== code.id && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span style={{ fontFamily: F, fontSize: 12, color: T.ink3, fontStyle: "italic", flex: 1 }}>"{code.inviter_note}"</span>
                  <button onClick={() => { setShowNoteFor(code.id); setNoteText(code.inviter_note || ""); }} style={{
                    background: "none", border: "none", color: T.ink3, fontSize: 11, cursor: "pointer", fontFamily: F, padding: "2px 4px",
                  }}>Edit</button>
                </div>
              )}

              {!code.inviter_note && showNoteFor !== code.id && (
                <button onClick={() => { setShowNoteFor(code.id); setNoteText(""); }} style={{
                  background: "none", border: "none", color: T.ink3, fontSize: 11, cursor: "pointer",
                  fontFamily: F, padding: "4px 0 0", marginTop: 4,
                }}>+ Add note</button>
              )}

              {showNoteFor === code.id && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="What makes them a great curator?"
                    rows={2}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 8,
                      border: `1.5px solid ${T.bdr}`, fontSize: 13, fontFamily: F,
                      outline: "none", resize: "none", background: T.bg, color: T.ink,
                      lineHeight: 1.4,
                    }}
                    autoFocus
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <button onClick={() => saveNote(code.id)} style={{
                      padding: "6px 12px", borderRadius: 6, border: "none",
                      background: T.acc, color: T.accText, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", fontFamily: F,
                    }}>Save</button>
                    <button onClick={() => setShowNoteFor(null)} style={{
                      padding: "6px 12px", borderRadius: 6, border: `1px solid ${T.bdr}`,
                      background: T.bg, color: T.ink3, fontSize: 11, cursor: "pointer", fontFamily: F,
                    }}>Cancel</button>
                  </div>
                </div>
              )}

              {noteSaved === code.id && (
                <div style={{ marginTop: 4, fontFamily: F, fontSize: 11, color: T.acc }}>{"\u2713"} Note saved</div>
              )}
            </div>
          ))}
        </div>

        {/* USED CODES */}
        {used.length > 0 && (
          <div>
            <h2 style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 14px" }}>Used Codes</h2>

            {visibleUsed.map(code => (
              <div key={code.id} style={{
                padding: "12px 16px", borderRadius: 12, background: T.s,
                border: `1px solid ${T.bdr}`, marginBottom: 8, opacity: 0.7,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: MN, fontSize: 14, color: T.ink3, letterSpacing: ".04em" }}>{code.code}</div>
                  <span style={{ fontFamily: F, fontSize: 11, color: T.ink3 }}>{formatDate(code.used_at)}</span>
                </div>
                {(code.profile_name || code.profile_handle) && (
                  <div style={{ marginTop: 4, fontFamily: F, fontSize: 12, color: T.ink2 }}>
                    Used by {code.profile_name || code.profile_handle}{code.profile_handle ? ` (@${code.profile_handle.replace("@", "")})` : ""}
                  </div>
                )}
                {code.inviter_note && (
                  <div style={{ marginTop: 2, fontFamily: F, fontSize: 11, color: T.ink3, fontStyle: "italic" }}>"{code.inviter_note}"</div>
                )}
              </div>
            ))}

            {used.length > 5 && !showAllUsed && (
              <button onClick={() => setShowAllUsed(true)} style={{
                width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${T.bdr}`,
                background: "transparent", color: T.ink3, fontSize: 12, cursor: "pointer",
                fontFamily: F, marginTop: 4,
              }}>Show all {used.length} used codes</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
