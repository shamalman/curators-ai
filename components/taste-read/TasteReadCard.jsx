'use client'

import { useEffect, useRef, useState } from "react";
import { T, F } from "@/lib/constants";

// Module-level session cache. Survives remount (chat scroll-back, React re-render)
// but not page reload. Keyed by source_url::rec_file_id.
// Shape: Map<key, { extraction, inferences: [{id,text}], states: {id: state}, refined: {id: text} }>
const cache = new Map();

function cacheKey(source_url, rec_file_id) {
  return `${source_url || ""}::${rec_file_id || ""}`;
}

function writeCache(key, patch) {
  const prev = cache.get(key) || {};
  cache.set(key, { ...prev, ...patch });
}

function writeInferenceState(key, inferenceId, state) {
  const entry = cache.get(key);
  if (!entry) return;
  const states = { ...(entry.states || {}), [inferenceId]: state };
  cache.set(key, { ...entry, states });
}

function writeRefinedText(key, inferenceId, text) {
  const entry = cache.get(key);
  if (!entry) return;
  const refined = { ...(entry.refined || {}), [inferenceId]: text };
  cache.set(key, { ...entry, refined });
}

function writeDismissed(key, value) {
  const entry = cache.get(key);
  if (!entry) return;
  cache.set(key, { ...entry, dismissed: value });
}

const ACCENT = T.acc;
const CONFIRMED_BG = "#5E9E8218";
const CONFIRMED_FG = "#5E9E82";
const REFINED_BG = "#4B92CC18";
const REFINED_FG = "#4B92CC";
const IGNORED_BG = T.s2;
const IGNORED_FG = T.ink3;

export default function TasteReadCard({ data, onSendMessage }) {
  const parsed_content = data?.parsed_content || "";
  const source_url = data?.source_url || null;
  const rec_file_id = data?.rec_file_id || null;
  const key = cacheKey(source_url, rec_file_id);

  const cached = cache.get(key);
  const [loading, setLoading] = useState(!cached || !cached.inferences);
  const [error, setError] = useState(null);
  const [extraction, setExtraction] = useState(cached?.extraction || "");
  const [inferences, setInferences] = useState(cached?.inferences || []);
  const [states, setStates] = useState(cached?.states || {});
  const [refinedTexts, setRefinedTexts] = useState(cached?.refined || {});
  const [drafts, setDrafts] = useState({}); // id -> textarea content during refine
  const [collapsed, setCollapsed] = useState(false); // ephemeral; resets on remount
  const [dismissed, setDismissed] = useState(cached?.dismissed === true); // sticky via cache
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (cached?.inferences) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/taste-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsed_content, source_url, rec_file_id }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || `Read failed (${res.status})`);
        }
        const initialStates = Object.fromEntries(
          (json.inferences || []).map(i => [i.id, "idle"])
        );
        writeCache(key, {
          extraction: json.extraction,
          inferences: json.inferences,
          states: initialStates,
          refined: {},
        });
        setExtraction(json.extraction);
        setInferences(json.inferences);
        setStates(initialStates);
        setRefinedTexts({});
        setLoading(false);
      } catch (e) {
        setError(e.message || "Couldn't read this.");
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setState = (id, newState) => {
    setStates(prev => {
      const next = { ...prev, [id]: newState };
      writeInferenceState(key, id, newState);
      return next;
    });
  };

  const setRefinedFor = (id, text) => {
    setRefinedTexts(prev => {
      const next = { ...prev, [id]: text };
      writeRefinedText(key, id, text);
      return next;
    });
  };

  const onConfirm = async (inf) => {
    const prevState = states[inf.id] || "idle";
    setState(inf.id, "pending");
    try {
      const res = await fetch("/api/taste-read/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inference_text: inf.text,
          source_url,
          rec_file_id,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error();
      setState(inf.id, "confirmed");
    } catch {
      setState(inf.id, prevState === "pending" ? "idle" : prevState);
    }
  };

  const onRefineStart = (id) => {
    setState(id, "refining");
  };

  const onRefineCancel = (id) => {
    setDrafts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setState(id, "idle");
  };

  const onRefineSave = async (inf) => {
    const refined = (drafts[inf.id] || "").trim();
    if (!refined) return;
    setState(inf.id, "pending");
    try {
      const res = await fetch("/api/taste-read/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_inference_text: inf.text,
          refined_text: refined,
          source_url,
          rec_file_id,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error();
      setRefinedFor(inf.id, refined);
      setState(inf.id, "refined");
      setDrafts(prev => {
        const next = { ...prev };
        delete next[inf.id];
        return next;
      });
    } catch {
      setState(inf.id, "refining");
    }
  };

  const onIgnore = async (inf) => {
    setState(inf.id, "pending");
    try {
      const res = await fetch("/api/taste-read/ignore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inference_text: inf.text,
          source_url,
          rec_file_id,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) throw new Error();
      setState(inf.id, "ignored");
    } catch {
      setState(inf.id, "idle");
    }
  };

  const onUndoConfirm = async (inf) => {
    setState(inf.id, "idle");
    try {
      const res = await fetch("/api/taste-read/confirm", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inference_text: inf.text,
          source_url,
          rec_file_id,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setState(inf.id, "confirmed"); // revert
    }
  };

  const onUndoRefine = async (inf) => {
    const refined = refinedTexts[inf.id] || "";
    setState(inf.id, "idle");
    try {
      const res = await fetch("/api/taste-read/refine", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refined_text: refined,
          source_url,
          rec_file_id,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setState(inf.id, "refined"); // revert
    }
  };

  const onUndoIgnore = async (inf) => {
    setState(inf.id, "idle");
    try {
      const res = await fetch("/api/taste-read/ignore", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inference_text: inf.text,
          source_url,
          rec_file_id,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setState(inf.id, "ignored"); // revert
    }
  };

  const onSaveAsRec = () => {
    if (!source_url || !onSendMessage) return;
    onSendMessage(`save_rec_from_taste_read:${source_url}`);
  };

  // ── Render ──

  const containerStyle = {
    borderRadius: 14,
    border: `1px solid ${T.bdr}`,
    background: T.s,
    overflow: "hidden",
    marginBottom: 4,
  };

  if (dismissed) return null;

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}80)` }} />
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 14, height: 14, borderRadius: 7,
            border: `2px solid ${T.bdr}`, borderTopColor: ACCENT,
            animation: "qcSpin 700ms linear infinite",
          }} />
          <span style={{ fontFamily: F, fontSize: 13, color: T.ink2 }}>
            Reading the piece.
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ height: 3, background: T.ink3 }} />
        <div style={{ padding: "14px 16px", fontFamily: F, fontSize: 13, color: T.ink2 }}>
          Couldn't read this. {error}
        </div>
      </div>
    );
  }

  const counts = inferences.reduce((acc, inf) => {
    const st = states[inf.id] || "idle";
    if (st === "confirmed") acc.confirmed += 1;
    else if (st === "refined") acc.refined += 1;
    else if (st === "ignored") acc.ignored += 1;
    else acc.unresolved += 1;
    return acc;
  }, { confirmed: 0, refined: 0, ignored: 0, unresolved: 0 });

  const anyResolved = counts.confirmed + counts.refined + counts.ignored > 0;
  const allResolved = inferences.length > 0 && counts.unresolved === 0;

  // Collapsed summary view
  if (collapsed) {
    const parts = [];
    if (counts.confirmed) parts.push(`${counts.confirmed} confirmed`);
    if (counts.refined) parts.push(`${counts.refined} refined`);
    if (counts.ignored) parts.push(`${counts.ignored} ignored`);
    const summary = parts.join(", ") || "resolved";

    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          ...containerStyle,
          cursor: "pointer",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{
          fontFamily: F, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase", color: ACCENT,
        }}>
          TASTE READ
        </span>
        <span style={{ fontFamily: F, fontSize: 12, color: T.ink3 }}>·</span>
        <span style={{ fontFamily: F, fontSize: 12, color: T.ink2 }}>{summary}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: F, fontSize: 11, color: T.ink3 }}>Tap to expand</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}80)` }} />

      {/* Header */}
      <div style={{
        padding: "10px 16px",
        borderBottom: `1px solid ${ACCENT}15`,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
        <span style={{
          fontFamily: F, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.06em", textTransform: "uppercase", color: ACCENT,
        }}>
          TASTE READ
        </span>
      </div>

      {/* Extraction */}
      {extraction && (
        <div style={{
          padding: "14px 16px 12px",
          fontFamily: F,
          fontSize: 14,
          color: T.ink,
          lineHeight: 1.55,
          borderBottom: `1px solid ${T.bdr}`,
        }}>
          {extraction}
        </div>
      )}

      {/* Inferences */}
      <div style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {inferences.map((inf) => {
          const st = states[inf.id] || "idle";

          if (st === "ignored") {
            const preview = inf.text.length > 60 ? inf.text.slice(0, 60) + "…" : inf.text;
            return (
              <div key={inf.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 8, background: IGNORED_BG,
                fontFamily: F, fontSize: 12, color: IGNORED_FG,
              }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Ignored: {preview}
                </span>
                <button
                  onClick={() => onUndoIgnore(inf)}
                  style={{
                    background: "none", border: "none", color: ACCENT,
                    fontSize: 12, fontFamily: F, cursor: "pointer", padding: 0,
                  }}
                >
                  Undo
                </button>
              </div>
            );
          }

          if (st === "confirmed") {
            return (
              <div key={inf.id} style={{
                padding: "12px 14px", borderRadius: 10,
                background: CONFIRMED_BG, border: `1px solid ${CONFIRMED_FG}30`,
              }}>
                <div style={{ fontFamily: F, fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>
                  {inf.text}
                </div>
                <div style={{ fontFamily: F, fontSize: 11, color: CONFIRMED_FG, marginTop: 6, fontWeight: 600 }}>
                  Saved to taste profile
                  <span style={{ color: T.ink3, fontWeight: 400 }}> · </span>
                  <button
                    onClick={() => onUndoConfirm(inf)}
                    style={{
                      background: "none", border: "none", color: ACCENT,
                      fontSize: 11, fontFamily: F, fontWeight: 600,
                      cursor: "pointer", padding: 0,
                    }}
                  >
                    Undo
                  </button>
                </div>
              </div>
            );
          }

          if (st === "refined") {
            return (
              <div key={inf.id} style={{
                padding: "12px 14px", borderRadius: 10,
                background: REFINED_BG, border: `1px solid ${REFINED_FG}30`,
              }}>
                <div style={{ fontFamily: F, fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>
                  {refinedTexts[inf.id] || inf.text}
                </div>
                <div style={{ fontFamily: F, fontSize: 11, color: REFINED_FG, marginTop: 6, fontWeight: 600 }}>
                  Saved your correction
                  <span style={{ color: T.ink3, fontWeight: 400 }}> · </span>
                  <button
                    onClick={() => onUndoRefine(inf)}
                    style={{
                      background: "none", border: "none", color: ACCENT,
                      fontSize: 11, fontFamily: F, fontWeight: 600,
                      cursor: "pointer", padding: 0,
                    }}
                  >
                    Undo
                  </button>
                </div>
              </div>
            );
          }

          if (st === "refining") {
            const draft = drafts[inf.id] ?? "";
            return (
              <div key={inf.id} style={{
                padding: "12px 14px", borderRadius: 10,
                background: T.bg, border: `1px solid ${T.bdr}`,
              }}>
                <div style={{ fontFamily: F, fontSize: 12.5, color: T.ink3, marginBottom: 8, lineHeight: 1.45 }}>
                  {inf.text}
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDrafts(prev => ({ ...prev, [inf.id]: e.target.value }))}
                  placeholder="Closer to: ..."
                  autoFocus
                  rows={3}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "8px 10px", borderRadius: 8,
                    border: `1px solid ${T.bdr}`, background: T.s2,
                    color: T.ink, fontFamily: F, fontSize: 13,
                    outline: "none", resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => onRefineSave(inf)}
                    disabled={!(drafts[inf.id] || "").trim()}
                    style={{
                      padding: "6px 12px", borderRadius: 16, border: "none",
                      background: ACCENT, color: T.accText,
                      fontFamily: F, fontSize: 12, fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Save correction
                  </button>
                  <button
                    onClick={() => onRefineCancel(inf.id)}
                    style={{
                      padding: "6px 12px", borderRadius: 16,
                      border: `1px solid ${T.bdr}`, background: "transparent",
                      color: T.ink2, fontFamily: F, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          // idle or pending
          const pending = st === "pending";
          return (
            <div key={inf.id} style={{
              padding: "12px 14px", borderRadius: 10,
              background: T.bg, border: `1px solid ${T.bdr}`,
              opacity: pending ? 0.6 : 1,
            }}>
              <div style={{ fontFamily: F, fontSize: 13.5, color: T.ink, lineHeight: 1.5 }}>
                {inf.text}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => onConfirm(inf)}
                  disabled={pending}
                  style={{
                    padding: "6px 12px", borderRadius: 16, border: "none",
                    background: ACCENT, color: T.accText,
                    fontFamily: F, fontSize: 12, fontWeight: 600,
                    cursor: pending ? "default" : "pointer",
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => onRefineStart(inf.id)}
                  disabled={pending}
                  style={{
                    padding: "6px 12px", borderRadius: 16,
                    border: `1px solid ${T.bdr}`, background: "transparent",
                    color: T.ink, fontFamily: F, fontSize: 12,
                    cursor: pending ? "default" : "pointer",
                  }}
                >
                  Refine
                </button>
                <button
                  onClick={() => onIgnore(inf)}
                  disabled={pending}
                  style={{
                    padding: "6px 12px", borderRadius: 16,
                    border: `1px solid ${T.bdr}`, background: "transparent",
                    color: T.ink3, fontFamily: F, fontSize: 12,
                    cursor: pending ? "default" : "pointer",
                  }}
                >
                  Ignore
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${T.bdr}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}>
        {source_url && onSendMessage && (
          <button
            onClick={onSaveAsRec}
            style={{
              padding: "6px 12px", borderRadius: 16,
              border: `1px solid ${T.bdr}`, background: "transparent",
              color: T.ink, fontFamily: F, fontSize: 12, cursor: "pointer",
            }}
          >
            Save as a Recommendation
          </button>
        )}
        <span style={{ flex: 1 }} />
        {allResolved && (
          <button
            onClick={() => setCollapsed(true)}
            style={{
              padding: "6px 12px", borderRadius: 16, border: "none",
              background: ACCENT, color: T.accText,
              fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            Done
          </button>
        )}
        {!anyResolved && (
          <button
            onClick={() => { writeDismissed(key, true); setDismissed(true); }}
            style={{
              padding: "6px 12px", borderRadius: 16,
              border: `1px solid ${T.bdr}`, background: "transparent",
              color: T.ink3, fontFamily: F, fontSize: 12, cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
