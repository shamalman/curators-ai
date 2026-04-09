'use client'

import { useState, useEffect, useRef } from "react";
import { T, F, CAT } from "@/lib/constants";

const CATEGORIES = ["watch", "listen", "read", "visit", "get", "wear", "play", "other"];

function makeLinkId() {
  return `lnk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isValidHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function LinkRow({ link, onUrlChange, onParse, onRemove }) {
  // Parsed-display state
  if (link.parsed) {
    const displayTitle = link.title || hostnameOf(link.url);
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
        border: `1px solid ${T.bdr}`, borderRadius: 10, background: T.bg, marginBottom: 8,
      }}>
        {link.thumbnail_url ? (
          <img src={link.thumbnail_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 6, background: T.s2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayTitle}</div>
          {link.provider && <div style={{ fontSize: 11, color: T.ink3, fontFamily: F }}>{link.provider}</div>}
        </div>
        <button onClick={onRemove} style={{
          width: 24, height: 24, borderRadius: 12, border: "none", background: T.s2,
          color: T.ink3, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>×</button>
      </div>
    );
  }

  // Input state (empty or parsing)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <input
        value={link.url}
        readOnly={link.parsing}
        onChange={(e) => onUrlChange(e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData?.getData("text") || "";
          if (pasted && isValidHttpUrl(pasted.trim())) {
            // Defer to allow value update first, then parse
            setTimeout(() => onParse(pasted.trim()), 200);
          }
        }}
        onBlur={() => {
          const trimmed = link.url.trim();
          if (trimmed && isValidHttpUrl(trimmed)) {
            onParse(trimmed);
          }
        }}
        placeholder="Paste a link"
        style={{
          flex: 1, padding: "10px 12px", borderRadius: 10,
          border: `1px solid ${T.bdr}`, fontSize: 14, fontFamily: F,
          background: T.bg, color: T.ink, outline: "none",
        }}
      />
      {link.parsing && (
        <div style={{
          width: 16, height: 16, borderRadius: 8,
          border: `2px solid ${T.bdr}`, borderTopColor: T.acc,
          animation: "qcSpin 700ms linear infinite",
        }} />
      )}
      <button onClick={onRemove} style={{
        width: 28, height: 28, borderRadius: 14, border: "none", background: T.s2,
        color: T.ink3, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>×</button>
    </div>
  );
}

export default function QuickCaptureSheet({ isOpen, onClose, onSaved, defaultVisibility, isDesktop, profileId }) {
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [category, setCategory] = useState(null);
  const [links, setLinks] = useState([]);
  const [visibility, setVisibility] = useState(defaultVisibility || "public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const titleInputRef = useRef(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setContext("");
      setCategory(null);
      setLinks([]);
      setVisibility(defaultVisibility || "public");
      setSaving(false);
      setError(null);
      // Autofocus title after a tick
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultVisibility]);

  if (!isOpen) return null;

  const isDirty = title.trim() !== "" || context.trim() !== "" || category !== null || links.some(l => l.url);

  const handleCancel = () => {
    if (isDirty) {
      if (!window.confirm("Discard this rec?")) return;
    }
    onClose();
  };

  const addLinkRow = () => {
    setLinks(prev => [...prev, { id: makeLinkId(), url: "", parsing: false, parsed: false, title: null, thumbnail_url: null, provider: null }]);
  };

  const updateLinkUrl = (linkId, url) => {
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, url } : l));
  };

  const removeLink = (linkId) => {
    setLinks(prev => {
      const filtered = prev.filter(l => l.id !== linkId);
      return filtered.length === 0 ? [{ id: makeLinkId(), url: "", parsing: false, parsed: false, title: null, thumbnail_url: null, provider: null }] : filtered;
    });
  };

  const parseLink = async (linkId, url) => {
    // Snapshot whether this is the first link BEFORE we mutate state
    const isFirstLink = links[0]?.id === linkId;

    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, url, parsing: true, parsed: false } : l));

    try {
      const res = await fetch("/api/recs/parse-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, profileId }),
      });

      if (!res.ok) {
        throw new Error(`parse-link returned ${res.status}`);
      }

      const data = await res.json();

      setLinks(prev => prev.map(l => l.id === linkId ? {
        ...l,
        url,
        parsing: false,
        parsed: true,
        title: data.title,
        thumbnail_url: data.thumbnail_url,
        provider: data.provider,
        // Deploy 2a: parsed content for future rec_files dual-write
        parsedPayload: {
          body_md: data.body_md || "",
          body_truncated: data.body_truncated || false,
          body_original_length: data.body_original_length || 0,
          canonical_url: data.canonical_url || null,
          site_name: data.site_name || null,
          author: data.author || null,
          authors: data.authors || [],
          published_at: data.published_at || null,
          lang: data.lang || null,
          word_count: data.word_count || 0,
          media_type: data.media_type || null,
          artifact_sha256: data.artifact_sha256 || null,
          artifact_ref: data.artifact_ref || null,
          extraction_mode: data.extraction_mode || "parsed",
          extractor: data.extractor || null,
        },
      } : l));

      // Auto-fill rule: only first link, only empty fields
      if (isFirstLink && data.parsed_successfully) {
        if (title.trim() === "" && data.title) setTitle(data.title);
        if (category === null && data.category) setCategory(data.category);
      }
    } catch (err) {
      console.error("Quick capture link parse failed:", err);
      setLinks(prev => prev.map(l => l.id === linkId ? {
        ...l,
        url,
        parsing: false,
        parsed: true,
        title: null,
        thumbnail_url: null,
        provider: null,
      } : l));
    }
  };

  const handleAddAnotherLink = () => {
    addLinkRow();
  };

  // Initialize first link row lazily on first focus of "Add link" affordance
  const ensureFirstLinkRow = () => {
    if (links.length === 0) addLinkRow();
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      // Build canonical link objects {url, type, label}
      const linksForDb = links
        .filter(l => l.url && l.parsed)
        .map(l => ({
          url: l.url,
          type: (l.provider || "website").toLowerCase().replace(/\s+/g, "_"),
          label: l.title || hostnameOf(l.url),
        }));

      // Deploy 2a: pass parsed payload for the first parsed link (if any)
      // through to addRec. addRec ignores it in this deploy; Deploy 2b will
      // wire it into the rec_files dual-write.
      const firstParsedLink = links.find(l => l.parsed && l.parsedPayload);

      const newItem = {
        title: title.trim(),
        category: category || "other",
        context: context.trim(),
        tags: [],
        links: linksForDb,
        visibility,
        date: new Date().toISOString().split("T")[0],
        revision: 1,
        revisions: [{ rev: 1, date: new Date().toISOString().split("T")[0], change: "Created" }],
        parsedPayload: firstParsedLink?.parsedPayload || null,
      };

      const saved = await onSaved(newItem);
      // onSaved is responsible for closing the sheet on success.
      // If it threw or returned falsy, surface an error and re-enable.
      if (!saved) {
        throw new Error("Couldn't save. Try again.");
      }
    } catch (err) {
      console.error("Quick capture save failed:", err);
      setError(err.message || "Couldn't save. Try again.");
      setSaving(false);
    }
  };

  const firstLinkAddedOrParsed = links.some(l => l.parsed);
  const hasAnyEmptyLinkInput = links.some(l => !l.parsed);

  // Sheet positioning: bottom sheet on mobile, centered on desktop
  const sheetStyle = isDesktop
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(560px, 92vw)",
        maxHeight: "88dvh",
        background: T.bg2,
        border: `0.5px solid ${T.bdr}`,
        borderRadius: 16,
        padding: 20,
        overflowY: "auto",
        zIndex: 101,
      }
    : {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: T.bg2,
        borderTop: `0.5px solid ${T.bdr}`,
        borderRadius: "16px 16px 0 0",
        padding: 16,
        maxHeight: "92dvh",
        overflowY: "auto",
        zIndex: 101,
      };

  return (
    <>
      <style>{`@keyframes qcSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Backdrop */}
      <div
        onClick={handleCancel}
        style={{
          position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.55)", zIndex: 100,
        }}
      />
      <div style={sheetStyle}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.ink, fontFamily: F }}>Recommend something great</div>
            <div style={{ fontSize: 12, color: T.ink3, fontFamily: F, marginTop: 2 }}>Share what you love. Add a link if you have one.</div>
          </div>
          <button
            onClick={handleCancel}
            aria-label="Close"
            style={{
              width: 44, height: 44, borderRadius: 22, border: "none", background: "transparent",
              color: T.ink3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginRight: -8, marginTop: -8,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Title</div>
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is it?"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: `1px solid ${T.bdr}`, fontSize: 15, fontFamily: F,
              background: T.bg, color: T.ink, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Context */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Why you're recommending it</div>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="A line or two in your words..."
            rows={3}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: `1px solid ${T.bdr}`, fontSize: 14, fontFamily: F,
              background: T.bg, color: T.ink, outline: "none", resize: "vertical",
              boxSizing: "border-box", lineHeight: 1.4,
            }}
          />
        </div>

        {/* Links */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Links</div>
          {links.length === 0 ? (
            <button onClick={ensureFirstLinkRow} style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: `1px dashed ${T.bdr}`, background: "transparent",
              color: T.ink3, fontSize: 13, fontFamily: F, cursor: "pointer", textAlign: "left",
            }}>
              + Add a link
            </button>
          ) : (
            <>
              {links.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  onUrlChange={(url) => updateLinkUrl(link.id, url)}
                  onParse={(url) => parseLink(link.id, url)}
                  onRemove={() => removeLink(link.id)}
                />
              ))}
              {firstLinkAddedOrParsed && !hasAnyEmptyLinkInput && (
                <button onClick={handleAddAnotherLink} style={{
                  width: "100%", padding: "8px 12px", borderRadius: 10,
                  border: `1px dashed ${T.bdr}`, background: "transparent",
                  color: T.ink3, fontSize: 12, fontFamily: F, cursor: "pointer",
                }}>
                  + Add another link
                </button>
              )}
            </>
          )}
        </div>

        {/* Category */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, fontFamily: F }}>Category</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", rowGap: 8 }}>
            {CATEGORIES.map((cat) => {
              const selected = category === cat;
              const catColor = CAT[cat]?.color || T.acc;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: "6px 11px", borderRadius: 999,
                    border: selected ? "none" : `1px solid ${T.bdr}`,
                    background: selected ? catColor : T.bg,
                    color: selected ? "#fff" : T.ink2,
                    fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F,
                    textTransform: "capitalize", whiteSpace: "nowrap",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Visibility */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: T.s, border: `1px solid ${T.bdr}`, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>{visibility === "public" ? "Public" : "Private"}</div>
            <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>{visibility === "public" ? "Shared with your subscribers and visitors" : "Only you and your AI can see this"}</div>
          </div>
          <button onClick={() => setVisibility(v => v === "public" ? "private" : "public")} style={{
            width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
            background: visibility === "public" ? "#6BAA8E" : T.bdr, transition: "background .2s",
            flexShrink: 0,
          }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: visibility === "public" ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: "#CC665820", color: "#CC6658", fontSize: 13, fontFamily: F }}>
            {error}
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          style={{
            width: "100%", padding: "12px 16px", borderRadius: 12, border: "none",
            background: (!title.trim() || saving) ? T.s2 : T.acc,
            color: (!title.trim() || saving) ? T.ink3 : T.accText,
            fontSize: 14, fontWeight: 600, cursor: (!title.trim() || saving) ? "default" : "pointer",
            fontFamily: F,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </>
  );
}
