'use client'

import { useState, useEffect } from "react";
import { T, F, S, MN } from "@/lib/constants";

const MAX_UNUSED = 5;

export default function InviteModal({ profileId, onClose }) {
  const [inviteCode, setInviteCode] = useState(null);
  const [codeId, setCodeId] = useState(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unusedCount, setUnusedCount] = useState(0);
  const [history, setHistory] = useState([]);
  const [generating, setGenerating] = useState(false);

  const loadInvite = () => {
    if (!profileId) return;
    setLoading(true);
    fetch(`/api/invite?profileId=${profileId}`)
      .then(r => r.json())
      .then(data => {
        if (data.code) {
          setInviteCode(data.code.code);
          setCodeId(data.code.id);
          setNote(data.code.inviter_note || "");
          setUnusedCount(data.unusedCount || 1);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const loadHistory = () => {
    if (!profileId) return;
    fetch(`/api/invite?profileId=${profileId}&history=1`)
      .then(r => r.json())
      .then(data => { if (data.history) setHistory(data.history); })
      .catch(() => {});
  };

  useEffect(() => { loadInvite(); loadHistory(); }, [profileId]);

  const generateNew = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, action: "generate" }),
      });
      const data = await res.json();
      if (data.error === "limit_reached") {
        setGenerating(false);
        return;
      }
      if (data.code) {
        setInviteCode(data.code.code);
        setCodeId(data.code.id);
        setNote(data.code.inviter_note || "");
        setUnusedCount(prev => prev + 1);
        loadHistory();
      }
    } catch {}
    setGenerating(false);
  };

  const saveNote = async () => {
    if (!codeId) return;
    await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId, inviterNote: note.trim() }),
    });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const copyCode = () => {
    if (!inviteCode) return;
    const text = note.trim()
      ? `Join me on Curators \u2014 ${note.trim()}\n\nInvite code: ${inviteCode}\nhttps://curators-ai.vercel.app/signup`
      : `Join me on Curators!\n\nInvite code: ${inviteCode}\nhttps://curators-ai.vercel.app/signup`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    if (!inviteCode) return;
    const text = note.trim()
      ? `Join me on Curators \u2014 ${note.trim()}`
      : "Join me on Curators!";
    if (navigator.share) {
      try { await navigator.share({ title: "Curators Invite", text: `${text}\n\nInvite code: ${inviteCode}`, url: "https://curators-ai.vercel.app/signup" }); } catch {}
    } else {
      copyCode();
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 400, maxHeight: "85vh", background: T.bg2, borderRadius: 20,
        border: `1px solid ${T.bdr}`, overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <h2 style={{ fontFamily: S, fontSize: 22, color: T.ink, fontWeight: 400, margin: 0 }}>Invite a Curator</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", padding: 4,
            color: T.ink3, fontSize: 18, lineHeight: 1,
          }}>{"\u2715"}</button>
        </div>

        <div style={{ padding: "16px 22px 24px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: T.ink3, fontFamily: F, fontSize: 13 }}>Loading...</div>
          ) : (
            <>
              {/* Active invite code */}
              {inviteCode && (
                <>
                  <div style={{
                    padding: "16px", borderRadius: 14, background: T.s, border: `1px solid ${T.bdr}`,
                    textAlign: "center", marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, fontFamily: F }}>Invite Code</div>
                    <div style={{ fontFamily: MN, fontSize: 22, fontWeight: 700, color: T.ink, letterSpacing: ".06em" }}>{inviteCode}</div>
                  </div>

                  {/* Note field */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>What makes them a great curator?</div>
                    <textarea
                      value={note}
                      onChange={e => { setNote(e.target.value); setNoteSaved(false); }}
                      placeholder="She knows every ramen spot in Tokyo"
                      rows={2}
                      style={{
                        width: "100%", padding: "12px 14px", borderRadius: 12,
                        border: `1.5px solid ${T.bdr}`, fontSize: 14, fontFamily: F,
                        outline: "none", resize: "none", background: T.s, color: T.ink,
                        lineHeight: 1.5,
                      }}
                      onFocus={e => e.target.style.borderColor = T.acc}
                      onBlur={e => e.target.style.borderColor = T.bdr}
                    />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: T.ink3, fontFamily: F }}>Personalizes their onboarding AI</span>
                      <button onClick={saveNote} style={{
                        padding: "5px 12px", borderRadius: 8, border: `1px solid ${T.bdr}`,
                        background: noteSaved ? T.accSoft : T.s, color: noteSaved ? T.acc : T.ink2,
                        fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F,
                      }}>{noteSaved ? "\u2713 Saved" : "Save note"}</button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button onClick={copyCode} style={{
                      flex: 1, padding: "14px", borderRadius: 12, border: "none",
                      background: copied ? T.accSoft : T.acc, color: copied ? T.acc : T.accText,
                      fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F,
                      transition: "all .2s",
                    }}>{copied ? "\u2713 Copied" : "Copy Invite"}</button>
                    <button onClick={shareCode} style={{
                      flex: 1, padding: "14px", borderRadius: 12, border: `1px solid ${T.bdr}`,
                      background: T.s, color: T.ink,
                      fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F,
                    }}>Share</button>
                  </div>

                  {/* New invite button */}
                  {unusedCount < MAX_UNUSED ? (
                    <button onClick={generateNew} disabled={generating} style={{
                      width: "100%", padding: "10px", borderRadius: 10, border: `1px dashed ${T.bdr}`,
                      background: "transparent", color: T.ink3, fontSize: 12, fontWeight: 500,
                      cursor: "pointer", fontFamily: F, marginBottom: 20,
                    }}>{generating ? "Generating..." : "+ Generate another invite code"}</button>
                  ) : (
                    <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, textAlign: "center", marginBottom: 20 }}>
                      You have {MAX_UNUSED} pending invites. Wait for one to be used before creating more.
                    </div>
                  )}
                </>
              )}

              {/* Invite history */}
              {history.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Your Invites</div>
                  {history.map((inv, i) => (
                    <div key={inv.id || i} style={{
                      padding: "10px 12px", borderRadius: 10, background: T.s, border: `1px solid ${T.bdr}`,
                      marginBottom: 6, display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: MN, fontSize: 11, color: T.ink, fontWeight: 600 }}>{inv.code}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                            background: inv.used_at ? "#6BAA8E18" : T.accSoft,
                            color: inv.used_at ? "#6BAA8E" : T.acc,
                            fontFamily: F, textTransform: "uppercase", letterSpacing: ".04em",
                          }}>{inv.used_at ? "Used" : "Pending"}</span>
                        </div>
                        {inv.used_at && inv.profile_name && (
                          <div style={{ fontSize: 11, color: T.ink2, fontFamily: F, marginTop: 2 }}>
                            {inv.profile_name} {inv.profile_handle ? `@${inv.profile_handle}` : ""}
                          </div>
                        )}
                        {inv.inviter_note && (
                          <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 2, fontStyle: "italic" }}>
                            "{inv.inviter_note}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
