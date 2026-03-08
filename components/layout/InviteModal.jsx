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
  const [generating, setGenerating] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    if (!profileId) return;
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
  }, [profileId]);

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
        setInviteCode(data.code.code);
        setCodeId(data.code.id);
        setNote(data.code.inviter_note || "");
        setUnusedCount(prev => prev + 1);
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

  const shareMessage = `Join me on curators.ai with this exclusive invite code: ${inviteCode}`;

  const copyToClipboard = (text) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  };

  const copyCode = () => {
    if (!inviteCode) return;
    copyToClipboard(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = () => {
    if (!inviteCode) return;
    if (navigator.share) {
      navigator.share({ text: shareMessage }).catch(() => {});
    } else {
      copyToClipboard(shareMessage);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
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
        width: "100%", maxWidth: 380, background: T.bg2, borderRadius: 20,
        border: `1px solid ${T.bdr}`, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h2 style={{ fontFamily: S, fontSize: 22, color: T.ink, fontWeight: 400, margin: 0 }}>Invite a Curator</h2>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", padding: 4,
            color: T.ink3, fontSize: 18, lineHeight: 1,
          }}>{"\u2715"}</button>
        </div>

        <div style={{ padding: "16px 22px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: T.ink3, fontFamily: F, fontSize: 13 }}>Loading...</div>
          ) : inviteCode ? (
            <>
              {/* Invite code display */}
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
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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

              {shareToast && (
                <div style={{ fontSize: 12, color: T.acc, fontFamily: F, textAlign: "center", marginBottom: 8, fontWeight: 500 }}>{"\u2713"} Message copied — paste it anywhere to share.</div>
              )}

              {/* New invite button */}
              {unusedCount < MAX_UNUSED ? (
                <button onClick={generateNew} disabled={generating} style={{
                  width: "100%", padding: "10px", borderRadius: 10, border: `1px dashed ${T.bdr}`,
                  background: "transparent", color: T.ink3, fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: F,
                }}>{generating ? "Generating..." : "+ Generate another invite code"}</button>
              ) : (
                <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, textAlign: "center" }}>
                  You have {MAX_UNUSED} pending invites. Wait for one to be used before creating more.
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>{"\uD83D\uDCE8"}</div>
              <div style={{ fontFamily: F, fontSize: 14, color: T.ink3 }}>Could not load invite code. Try again.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
