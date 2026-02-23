'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { T, F, S, MN, CAT, DEFAULT_TIERS, DEFAULT_BUNDLES, LICENSE_TYPES } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";
import LinkDisplay from "@/components/shared/LinkDisplay";

// Helper to auto-linkify URLs in text
function Linkify({ text, style }) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ ...style, color: "#6BAA8E", textDecoration: "underline" }}>{part}</a>
    ) : <span key={i}>{part}</span>
  );
}

const fmtDateFull = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ── Curator Item Detail ── */
export function CuratorRecDetail({ itemId }) {
  const router = useRouter();
  const { profile, tasteItems, updateRec, archived, removeItem, restoreItem, toggleVisibility } = useCurator();

  const selectedItem = tasteItems.find(i => String(i.id) === String(itemId));

  // Local state for editing
  const [editingItem, setEditingItem] = useState(null);
  const [itemCopied, setItemCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Local earnings config (defaults)
  const [itemSubOnly, setItemSubOnly] = useState({ 10: true, 5: true });
  const [itemTiers, setItemTiers] = useState({ 10: ["plus", "pro"], 5: ["pro"] });
  const [itemInBundle, setItemInBundle] = useState({ 1: true, 3: true, 6: true });
  const [itemBundles, setItemBundles] = useState({ 1: ["b1"], 3: ["b1"], 6: ["b1"] });
  const [itemLicensable, setItemLicensable] = useState({ 2: true, 3: true, 11: true });
  const [itemLicense, setItemLicense] = useState({ 2: { types: ["digital", "social"], floor: 150 }, 3: { types: ["social"], floor: 250 }, 11: { types: ["digital"], floor: 100 } });
  const [itemTipEnabled, setItemTipEnabled] = useState({ 1: true, 2: true, 4: true });
  const [itemTipConfig, setItemTipConfig] = useState({ 1: { suggested: 5, min: 1, max: 100 }, 2: { suggested: 3, min: 1, max: 50 }, 4: { suggested: 3, min: 1, max: 100 } });
  const [bundles, setBundles] = useState(DEFAULT_BUNDLES);
  const [newBundleName, setNewBundleName] = useState("");

  if (!selectedItem) return null;

  const c = CAT[selectedItem.category] || CAT.other;
  const isPublic = selectedItem.visibility === "public";
  const slug = selectedItem.slug || selectedItem.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const url = `curators.com/${profile.handle.replace("@", "")}/${slug}`;
  const isSubOnly = !!itemSubOnly[selectedItem.id];
  const isInBundle = !!itemInBundle[selectedItem.id];
  const isLicensable = !!itemLicensable[selectedItem.id];
  const isTipEnabled = !!itemTipEnabled[selectedItem.id];
  const tipConf = itemTipConfig[selectedItem.id] || { suggested: 5, min: 1, max: 100 };
  const tiers = itemTiers[selectedItem.id] || [];
  const bndls = itemBundles[selectedItem.id] || [];
  const lic = itemLicense[selectedItem.id] || { types: [], floor: 100 };
  const hasAnyEarning = isSubOnly || isInBundle || isLicensable || isTipEnabled;
  const isEditing = !!editingItem;

  const saveItemEdit = async () => {
    if (!editingItem) return;
    const newRev = (selectedItem.revision || 1) + 1;
    const newRevisions = [
      { rev: newRev, date: new Date().toISOString().split("T")[0], change: "Updated context and tags" },
      ...(selectedItem.revisions || []),
    ];
    const updated = { ...selectedItem, title: editingItem.title, context: editingItem.context, tags: editingItem.tags, category: editingItem.category, links: editingItem.links || [], revision: newRev, revisions: newRevisions };
    setEditingItem(null);
    await updateRec(updated);
  };

  const copyLink = (s) => {
    const copyUrl = `curators.com/${profile.handle.replace("@", "")}/${s}`;
    if (navigator.clipboard) navigator.clipboard.writeText(copyUrl);
    setItemCopied(true);
    setTimeout(() => setItemCopied(false), 2000);
  };

  const toggleItemTier = (id, tierId) => {
    setItemTiers(prev => {
      const current = prev[id] || [];
      return { ...prev, [id]: current.includes(tierId) ? current.filter(t => t !== tierId) : [...current, tierId] };
    });
  };

  const toggleItemBundle = (id, bundleId) => {
    setItemBundles(prev => {
      const current = prev[id] || [];
      return { ...prev, [id]: current.includes(bundleId) ? current.filter(b => b !== bundleId) : [...current, bundleId] };
    });
  };

  const addBundle = () => {
    if (!newBundleName.trim()) return;
    const id = "b" + Date.now();
    setBundles(prev => [...prev, { id, name: newBundleName.trim(), count: 0, price: 0 }]);
    setNewBundleName("");
  };

  const toggleLicenseType = (id, typeId) => {
    setItemLicense(prev => {
      const current = prev[id] || { types: [], floor: 100 };
      const types = current.types.includes(typeId) ? current.types.filter(t => t !== typeId) : [...current.types, typeId];
      return { ...prev, [id]: { ...current, types } };
    });
  };

  const setLicenseFloor = (id, floor) => {
    setItemLicense(prev => {
      const current = prev[id] || { types: [], floor: 100 };
      return { ...prev, [id]: { ...current, floor: parseInt(floor) || 0 } };
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "52px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
        {!isEditing && (
          <button onClick={() => setEditingItem({ title: selectedItem.title, context: selectedItem.context, tags: [...(selectedItem.tags || [])], category: selectedItem.category, links: [...(selectedItem.links || [])] })} style={{
            background: T.s, border: "1px solid " + T.bdr, borderRadius: 10, padding: "6px 14px",
            cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 600, color: T.ink2,
          }}>Edit</button>
        )}
        {isEditing && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setEditingItem(null)} style={{ background: "none", border: "1px solid " + T.bdr, borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 600, color: T.ink3 }}>Cancel</button>
            <button onClick={saveItemEdit} style={{ background: T.acc, border: "none", borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 700, color: T.accText }}>Save</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 40px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
        <div className="fu">

          {/* Category + visibility badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.emoji}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: c.color, fontFamily: F }}>{c.label}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: isPublic ? "#6BAA8E" : T.ink3, background: isPublic ? "#6BAA8E15" : T.s2, padding: "3px 10px", borderRadius: 6, fontFamily: F }}>
              {isPublic ? "\u25CF Public" : "\u25CB Private"}
            </span>
            <span style={{ fontSize: 10, color: T.ink3, fontFamily: MN }}>rev {selectedItem.revision || 1}</span>
          </div>

          {/* Title */}
          {isEditing ? (
            <input value={editingItem.title} onChange={e => setEditingItem(p => ({ ...p, title: e.target.value }))}
              style={{ fontFamily: S, fontSize: 28, color: T.ink, fontWeight: 400, lineHeight: 1.2, marginBottom: 6, width: "100%", background: T.s, border: `1.5px solid ${T.bdr}`, borderRadius: 10, padding: "10px 14px", outline: "none" }}
            />
          ) : (
            <h1 style={{ fontFamily: S, fontSize: 28, color: T.ink, fontWeight: 400, lineHeight: 1.2, marginBottom: 6 }}>{selectedItem.title}</h1>
          )}

          {/* Date + URL */}
          <div style={{ fontSize: 12, color: T.ink3, fontFamily: F, marginBottom: 6 }}>Added {fmtDateFull(selectedItem.date)}</div>
          <button onClick={() => copyLink(slug)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
            background: T.s, border: "1px solid " + T.bdr, cursor: "pointer", marginBottom: 20,
          }}>
            <span style={{ fontSize: 11, color: T.ink3, fontFamily: MN }}>{url}</span>
            <span style={{ fontSize: 10, color: itemCopied ? "#6BAA8E" : T.acc, fontFamily: F, fontWeight: 600 }}>{itemCopied ? "\u2713 Copied" : "Copy"}</span>
          </button>

          {/* Your take */}
          <div style={{ padding: "16px 18px", background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, fontFamily: F }}>Your take</div>
            {isEditing ? (
              <textarea value={editingItem.context} onChange={e => setEditingItem(p => ({ ...p, context: e.target.value }))} rows={3}
                style={{ fontFamily: F, fontSize: 15, lineHeight: 1.6, color: T.ink, width: "100%", background: T.bg, border: `1.5px solid ${T.bdr}`, borderRadius: 10, padding: "10px 14px", outline: "none", resize: "none" }}
              />
            ) : (
              <p style={{ fontFamily: F, fontSize: 15, lineHeight: 1.6, color: T.ink, whiteSpace: "pre-line" }}>"<Linkify text={selectedItem.context} style={{ fontFamily: F, fontSize: 15 }} />"</p>
            )}
          </div>

          {/* Tags */}
          {!isEditing && selectedItem.tags?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {selectedItem.tags.map(tag => <span key={tag} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 12, background: T.s, color: T.ink2, border: "1px solid " + T.bdr, fontFamily: F }}>{tag}</span>)}
            </div>
          )}
          {isEditing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, fontFamily: F }}>Category</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["restaurant", "book", "music", "tv", "film", "travel", "product", "other"].map(cat => (
                  <button key={cat} onClick={() => setEditingItem(p => ({ ...p, category: cat }))}
                    style={{
                      padding: "8px 14px", borderRadius: 10, border: editingItem.category === cat ? "none" : "1px solid " + T.bdr,
                      background: editingItem.category === cat ? T.acc : T.s, color: editingItem.category === cat ? "#fff" : T.ink2,
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F, textTransform: "capitalize"
                    }}>{cat}</button>
                ))}
              </div>
            </div>
          )}
          {isEditing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, fontFamily: F }}>Tags</div>
              <input value={editingItem.tags.join(", ")} onChange={e => setEditingItem(p => ({ ...p, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
                placeholder="Comma separated tags"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${T.bdr}`, fontSize: 13, fontFamily: F, outline: "none", background: T.s, color: T.ink }}
              />
            </div>
          )}
          {isEditing && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, fontFamily: F }}>Links</div>
              {editingItem.links?.map((link, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input value={link.url} onChange={e => {
                    const newLinks = [...editingItem.links];
                    newLinks[i] = { ...newLinks[i], url: e.target.value };
                    setEditingItem(p => ({ ...p, links: newLinks }));
                  }}
                    placeholder="URL"
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1.5px solid " + T.bdr, fontSize: 13, fontFamily: F, outline: "none", background: T.s, color: T.ink }}
                  />
                  <button onClick={() => {
                    const newLinks = editingItem.links.filter((_, idx) => idx !== i);
                    setEditingItem(p => ({ ...p, links: newLinks }));
                  }} style={{
                    padding: "10px 12px", borderRadius: 10, border: "1px solid " + T.bdr,
                    background: T.s, color: T.ink3, fontSize: 12, cursor: "pointer", fontFamily: F
                  }}>{"\u2715"}</button>
                </div>
              ))}
              <button onClick={async () => {
                const url = prompt("Paste a link:");
                if (!url) return;
                try {
                  const res = await fetch("/api/link-metadata", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url })
                  });
                  const meta = await res.json();
                  const newLink = { type: meta.source?.toLowerCase() || "website", url, label: meta.title || url };
                  setEditingItem(p => ({ ...p, links: [...(p.links || []), newLink] }));
                } catch (e) {
                  const newLink = { type: "website", url, label: url };
                  setEditingItem(p => ({ ...p, links: [...(p.links || []), newLink] }));
                }
              }} style={{
                padding: "10px 14px", borderRadius: 10, border: "1.5px dashed " + T.bdr,
                background: "transparent", color: T.ink2, fontSize: 13, cursor: "pointer", fontFamily: F,
                width: "100%", textAlign: "center"
              }}>+ Add link</button>
            </div>
          )}

          {/* Links */}
          {!isEditing && selectedItem.links?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10, fontFamily: F }}>Links</div>
              <LinkDisplay links={selectedItem.links} />
            </div>
          )}

          {/* Settings section */}
          {!isEditing && (
            <>
              {/* Visibility toggle */}
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F, marginTop: 4 }}>Visibility</div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, marginBottom: 16,
              }}>
                <div>
                  <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>{isPublic ? "Public" : "Private"}</div>
                  <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 2 }}>
                    {isPublic ? "Visible on your profile and via link" : "Only you can see this"}
                  </div>
                </div>
                <button onClick={() => toggleVisibility(selectedItem.id)} style={{
                  width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                  background: isPublic ? "#6BAA8E" : T.bdr, transition: "background .2s",
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: isPublic ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              </div>

              {/* Earnings config */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: F }}>Earnings</div>
                {hasAnyEarning && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#6BAA8E", fontFamily: F, background: "#6BAA8E15", padding: "3px 10px", borderRadius: 6 }}>
                    {[isSubOnly && "Subscriber", isInBundle && "Bundle", isLicensable && "License", isTipEnabled && "Tips"].filter(Boolean).join(" \u00B7 ")}
                  </span>
                )}
              </div>

              {/* Tips & Donations */}
              <div style={{ background: T.s, borderRadius: 14, border: `1px solid ${isTipEnabled ? "#6BAA8E40" : T.bdr}`, marginBottom: 10, overflow: "hidden", transition: "border-color .2s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>Tips & Donations</div>
                    <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 2 }}>Let people express their gratitude</div>
                  </div>
                  <button onClick={() => setItemTipEnabled(p => ({ ...p, [selectedItem.id]: !p[selectedItem.id] }))} style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                    background: isTipEnabled ? "#6BAA8E" : T.bdr, transition: "background .2s",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: isTipEnabled ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
                {isTipEnabled && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.bdr}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12, marginTop: 12, fontFamily: F }}>
                      Suggested tip
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                      {[1, 3, 5, 10, 25].map(amt => (
                        <button key={amt} onClick={() => setItemTipConfig(p => ({ ...p, [selectedItem.id]: { ...(p[selectedItem.id] || tipConf), suggested: amt } }))} style={{
                          flex: 1, padding: "10px 0", borderRadius: 10, textAlign: "center",
                          border: tipConf.suggested === amt ? `2px solid #6BAA8E` : `1.5px solid ${T.bdr}`,
                          background: tipConf.suggested === amt ? "#6BAA8E15" : T.bg,
                          color: tipConf.suggested === amt ? "#6BAA8E" : T.ink2,
                          fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: MN,
                        }}>
                          {"$"}{amt}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: T.ink3, fontFamily: F, textTransform: "uppercase", letterSpacing: ".06em" }}>Range</span>
                      <span style={{ fontSize: 12, color: T.ink2, fontFamily: MN }}>{"$"}{tipConf.min} – {"$"}{tipConf.max}</span>
                    </div>
                    <div style={{ position: "relative", height: 32, marginBottom: 8 }}>
                      <div style={{ position: "absolute", top: 14, left: 0, right: 0, height: 4, borderRadius: 2, background: T.bdr }} />
                      <div style={{
                        position: "absolute", top: 14, height: 4, borderRadius: 2, background: "#6BAA8E",
                        left: `${(tipConf.min / 100) * 100}%`, right: `${100 - (tipConf.max / 100) * 100}%`,
                      }} />
                      <input type="range" min="1" max="100" value={tipConf.max}
                        onChange={e => setItemTipConfig(p => ({ ...p, [selectedItem.id]: { ...(p[selectedItem.id] || tipConf), max: parseInt(e.target.value) } }))}
                        style={{ position: "absolute", top: 4, width: "100%", opacity: 0, cursor: "pointer", height: 24 }}
                      />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, marginTop: 14, fontFamily: F }}>
                      Accept via
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: T.acc + "12", border: `1px solid ${T.acc}40`, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14 }}>💳</span>
                        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: T.ink }}>Card</span>
                      </div>
                      {profile.cryptoEnabled && (
                        <div style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#6B9EC212", border: `1px solid #6B9EC240`, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14 }}>⛓</span>
                          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: T.ink }}>Crypto</span>
                        </div>
                      )}
                    </div>
                    {!profile.cryptoEnabled && (
                      <p style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 8 }}>Enable crypto in Profile → Edit to accept crypto tips</p>
                    )}
                  </div>
                )}
              </div>

              {/* Subscriber Only */}
              <div style={{ background: T.s, borderRadius: 14, border: `1px solid ${isSubOnly ? "#6BAA8E40" : T.bdr}`, marginBottom: 10, overflow: "hidden", transition: "border-color .2s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>Subscriber Only</div>
                    <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 2 }}>Restrict to specific tiers</div>
                  </div>
                  <button onClick={() => setItemSubOnly(p => ({ ...p, [selectedItem.id]: !p[selectedItem.id] }))} style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                    background: isSubOnly ? "#6BAA8E" : T.bdr, transition: "background .2s",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: isSubOnly ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
                {isSubOnly && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.bdr}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10, marginTop: 12, fontFamily: F }}>
                      Which tiers can see this?
                    </div>
                    {DEFAULT_TIERS.map(tier => {
                      const checked = tiers.includes(tier.id);
                      return (
                        <button key={tier.id} onClick={() => toggleItemTier(selectedItem.id, tier.id)} style={{
                          display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px",
                          background: checked ? `${tier.color}12` : T.bg, borderRadius: 10, border: `1px solid ${checked ? tier.color + "40" : T.bdr}`,
                          cursor: "pointer", marginBottom: 6, textAlign: "left",
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? tier.color : T.ink3}`,
                            background: checked ? tier.color : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            {checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: T.ink }}>{tier.name}</span>
                          <span style={{ fontFamily: MN, fontSize: 11, color: T.ink3, marginLeft: "auto" }}>{tier.price > 0 ? `$${tier.price}/mo` : "Free"}</span>
                        </button>
                      );
                    })}
                    {tiers.length === 0 && <div style={{ fontSize: 11, color: T.acc, fontFamily: F, marginTop: 2 }}>Select at least one tier</div>}
                    <p style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 6 }}>Manage tiers in Profile → Edit</p>
                  </div>
                )}
              </div>

              {/* Bundle */}
              <div style={{ background: T.s, borderRadius: 14, border: `1px solid ${isInBundle ? "#6BAA8E40" : T.bdr}`, marginBottom: 10, overflow: "hidden", transition: "border-color .2s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>Bundle</div>
                    <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 2 }}>Add to a sellable recommendation pack</div>
                  </div>
                  <button onClick={() => setItemInBundle(p => ({ ...p, [selectedItem.id]: !p[selectedItem.id] }))} style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                    background: isInBundle ? "#6BAA8E" : T.bdr, transition: "background .2s",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: isInBundle ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
                {isInBundle && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.bdr}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10, marginTop: 12, fontFamily: F }}>
                      Add to bundles
                    </div>
                    {bundles.map(bundle => {
                      const inBundle = bndls.includes(bundle.id);
                      return (
                        <button key={bundle.id} onClick={() => toggleItemBundle(selectedItem.id, bundle.id)} style={{
                          display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px",
                          background: inBundle ? T.acc + "12" : T.bg, borderRadius: 10,
                          border: `1px solid ${inBundle ? T.acc + "40" : T.bdr}`,
                          cursor: "pointer", marginBottom: 6, textAlign: "left",
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 4, border: `2px solid ${inBundle ? T.acc : T.ink3}`,
                            background: inBundle ? T.acc : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            {inBundle && <span style={{ color: T.accText, fontSize: 11, fontWeight: 700 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: T.ink }}>{bundle.name}</div>
                            <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 1 }}>{bundle.count} recs{bundle.price > 0 ? ` · $${bundle.price}` : ""}</div>
                          </div>
                        </button>
                      );
                    })}
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <input value={newBundleName} onChange={e => setNewBundleName(e.target.value)}
                        placeholder="New bundle name..." onKeyDown={e => e.key === "Enter" && addBundle()}
                        style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${T.bdr}`, fontSize: 12, fontFamily: F, outline: "none", background: T.bg, color: T.ink }}
                      />
                      <button onClick={addBundle} style={{
                        padding: "9px 14px", borderRadius: 8, border: "none",
                        background: newBundleName.trim() ? T.acc : T.bdr, color: newBundleName.trim() ? T.accText : T.ink3,
                        fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap",
                      }}>+ Create</button>
                    </div>
                    <p style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 6 }}>Manage bundles in Taste → Bundles</p>
                  </div>
                )}
              </div>

              {/* License */}
              <div style={{ background: T.s, borderRadius: 14, border: `1px solid ${isLicensable ? "#6BAA8E40" : T.bdr}`, marginBottom: 16, overflow: "hidden", transition: "border-color .2s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>License</div>
                    <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 2 }}>Allow brands to license this rec</div>
                  </div>
                  <button onClick={() => setItemLicensable(p => ({ ...p, [selectedItem.id]: !p[selectedItem.id] }))} style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                    background: isLicensable ? "#6BAA8E" : T.bdr, transition: "background .2s",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: isLicensable ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
                {isLicensable && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.bdr}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10, marginTop: 12, fontFamily: F }}>
                      Usage rights
                    </div>
                    {LICENSE_TYPES.map(type => {
                      const checked = lic.types.includes(type.id);
                      return (
                        <button key={type.id} onClick={() => toggleLicenseType(selectedItem.id, type.id)} style={{
                          display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px",
                          background: checked ? T.acc + "12" : T.bg, borderRadius: 10,
                          border: `1px solid ${checked ? T.acc + "40" : T.bdr}`,
                          cursor: "pointer", marginBottom: 6, textAlign: "left",
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? T.acc : T.ink3}`,
                            background: checked ? T.acc : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            {checked && <span style={{ color: T.accText, fontSize: 11, fontWeight: 700 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: T.ink }}>{type.label}</div>
                            <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 1 }}>{type.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, marginTop: 14, fontFamily: F }}>
                      Minimum price
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: F, fontSize: 16, color: T.ink2, fontWeight: 600 }}>$</span>
                      <input value={lic.floor} onChange={e => setLicenseFloor(selectedItem.id, e.target.value)}
                        type="number" min="0" step="50"
                        style={{ width: 100, padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.bdr}`, fontSize: 14, fontFamily: MN, outline: "none", background: T.bg, color: T.ink, textAlign: "right" }}
                      />
                      <span style={{ fontFamily: F, fontSize: 12, color: T.ink3 }}>per use</span>
                    </div>
                    <p style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 8, lineHeight: 1.5 }}>
                      Brands request through your profile. Review in My AI → Requests.
                    </p>
                  </div>
                )}
              </div>

              {/* On-chain rec / wallet */}
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>On-chain</div>
              <div style={{
                background: T.s, borderRadius: 14, border: "1px solid " + T.bdr,
                marginBottom: 16, overflow: "hidden",
              }}>
                <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: profile.cryptoEnabled ? `1px solid ${T.bdr}` : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#6B9EC215", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>⛓</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: T.ink }}>Proof of Taste</div>
                    <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 1 }}>
                      This rec will be timestamped on-chain
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#6B9EC2", fontFamily: MN, background: "#6B9EC215", padding: "3px 8px", borderRadius: 6 }}>Soon</span>
                </div>
                {profile.cryptoEnabled && (
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Wallet receiving address</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: T.bg, borderRadius: 8, border: "1px solid " + T.bdr }}>
                      <span style={{ fontSize: 12, color: T.ink2, fontFamily: MN, flex: 1 }}>{profile.wallet}</span>
                      <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>From profile</span>
                    </div>
                    <p style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 6 }}>
                      Tips, licensing payments, and donations route to this wallet. Change in Profile → Edit.
                    </p>
                  </div>
                )}
              </div>

              {/* Version history */}
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Version History</div>
              <div style={{ background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, overflow: "hidden", marginBottom: 20 }}>
                <button onClick={() => setShowHistory(!showHistory)} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  padding: "13px 16px", background: "transparent", border: "none", cursor: "pointer",
                }}>
                  <span style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: T.ink }}>
                    {selectedItem.revision || 1} revision{(selectedItem.revision || 1) !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontSize: 12, color: T.ink3, transform: showHistory ? "rotate(180deg)" : "rotate(0)", transition: "transform .2s" }}>▾</span>
                </button>
                {showHistory && selectedItem.revisions?.map((rev, i) => (
                  <div key={rev.rev} style={{
                    display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 16px",
                    borderTop: `1px solid ${T.bdr}`,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: i === 0 ? T.acc : T.ink3 }} />
                      {i < selectedItem.revisions.length - 1 && <div style={{ width: 1, height: 24, background: T.bdr, marginTop: 2 }} />}
                    </div>
                    <div>
                      <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: i === 0 ? T.ink : T.ink2 }}>
                        v{rev.rev} — {rev.change}
                      </div>
                      <div style={{ fontFamily: MN, fontSize: 10, color: T.ink3, marginTop: 2 }}>{fmtDateFull(rev.date)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Remove */}
              {!!archived[selectedItem.id] ? (
                <button onClick={() => restoreItem(selectedItem.id)} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid #6BAA8E30", background: "#6BAA8E10", color: "#6BAA8E", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F }}>Restore to taste</button>
              ) : (
                <button onClick={() => removeItem(selectedItem.id)} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid #EF444430", background: "none", color: "#EF4444", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F }}>Delete Recommendation</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Visitor Item Detail ── */
export function VisitorRecDetail({ slug }) {
  const router = useRouter();
  const { profile, tasteItems } = useCurator();

  const selectedItem = tasteItems.find(i => i.slug === slug);

  const [tipExpanded, setTipExpanded] = useState(false);
  const [tipAmount, setTipAmount] = useState(null);
  const [tipSent, setTipSent] = useState(false);
  const [tipMessage, setTipMessage] = useState("");

  // Local earnings config defaults (mock data)
  const [itemLicensable] = useState({ 2: true, 3: true, 11: true });
  const [itemLicense] = useState({ 2: { types: ["digital", "social"], floor: 150 }, 3: { types: ["social"], floor: 250 }, 11: { types: ["digital"], floor: 100 } });
  const [itemTipEnabled] = useState({ 1: true, 2: true, 4: true });
  const [itemTipConfig] = useState({ 1: { suggested: 5, min: 1, max: 100 }, 2: { suggested: 3, min: 1, max: 50 }, 4: { suggested: 3, min: 1, max: 100 } });
  const [itemBundlesMap] = useState({ 1: ["b1"], 3: ["b1"], 6: ["b1"] });
  const [bundles] = useState(DEFAULT_BUNDLES);

  if (!selectedItem || !profile) return null;

  const c = CAT[selectedItem.category] || CAT.other;
  const itemSlug = selectedItem.slug || selectedItem.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const url = `curators.com/${profile.handle.replace("@", "")}/${itemSlug}`;
  const bndls = itemBundlesMap[selectedItem.id] || [];
  const recBundles = bundles.filter(b => bndls.includes(b.id));
  const fmtPhone = (p) => p ? p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ padding: "52px 20px 10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
        <button onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(url); }} style={{ background: T.s, border: "1px solid " + T.bdr, borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontFamily: MN, fontSize: 10, color: T.ink3 }}>
          Copy link
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 40px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
        <div className="fu">
          {/* Category + date */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: c.bg,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
              border: `1px solid ${c.color}20`,
            }}>{c.emoji}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.color, fontFamily: F }}>{c.label}</div>
              <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 2 }}>Recommended {fmtDateFull(selectedItem.date)}</div>
            </div>
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: S, fontSize: 32, color: T.ink, fontWeight: 400, lineHeight: 1.15, marginBottom: 20 }}>{selectedItem.title}</h1>

          {/* Context */}
          <div style={{
            padding: "20px 22px", background: T.s, borderRadius: 16,
            border: "1px solid " + T.bdr, marginBottom: 20,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Why {profile.name} recommends this</div>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: T.ink, fontFamily: F, fontWeight: 500, whiteSpace: "pre-line" }}>
              <Linkify text={selectedItem.context} style={{ fontSize: 17, fontFamily: F }} />
            </p>
          </div>

          {/* Tags */}
          {selectedItem.tags?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
              {selectedItem.tags.map(tag => (
                <span key={tag} style={{ padding: "6px 14px", borderRadius: 10, fontSize: 12, background: T.s, color: T.ink2, border: "1px solid " + T.bdr, fontFamily: F }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Links */}
          {selectedItem.links?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10, fontFamily: F }}>Links</div>
              <LinkDisplay links={selectedItem.links} />
            </div>
          )}

          {/* Website + Phone */}
          {(selectedItem.website || selectedItem.phone) && (
            <div style={{ background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, marginBottom: 24, overflow: "hidden" }}>
              {selectedItem.website && (
                <a href={selectedItem.website} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                  textDecoration: "none", borderBottom: selectedItem.phone ? `1px solid ${T.bdr}` : "none",
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: T.s2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>🌐</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: F }}>Website</div>
                    <div style={{ fontSize: 11, color: T.acc, fontFamily: F, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedItem.website.replace(/^https?:\/\/(www\.)?/, "")}</div>
                  </div>
                  <span style={{ color: T.ink3, fontSize: 12 }}>↗</span>
                </a>
              )}
              {selectedItem.phone && (
                <a href={`tel:${selectedItem.phone}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textDecoration: "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: T.s2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>📞</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: F }}>Call</div>
                    <div style={{ fontSize: 12, color: T.acc, fontFamily: MN, marginTop: 1 }}>{fmtPhone(selectedItem.phone)}</div>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Also appears in (bundles) */}
          {recBundles.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Also in</div>
              {recBundles.map(bundle => (
                <div key={bundle.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  background: T.s, borderRadius: 12, border: "1px solid " + T.bdr, marginBottom: 6,
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: T.accSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 13 }}>📦</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: F }}>{bundle.name}</div>
                    <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 1 }}>{bundle.count} recs{bundle.price > 0 ? ` · $${bundle.price}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tip section — simplified, uses local state */}
          {!!itemTipEnabled[selectedItem.id] && !tipSent && (
            <div style={{ marginTop: 20, marginBottom: 8 }}>
              {!tipExpanded ? (
                <button onClick={() => { setTipExpanded(true); setTipAmount(itemTipConfig[selectedItem.id]?.suggested || 5); }} style={{
                  width: "100%", padding: "20px 22px", borderRadius: 18,
                  border: `1.5px solid ${T.acc}35`,
                  background: `linear-gradient(135deg, ${T.accSoft}, ${T.s})`,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                  transition: "all .2s",
                  boxShadow: `0 2px 16px ${T.acc}12`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: `linear-gradient(135deg, ${T.acc}25, #6BAA8E20)`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 22 }}>☕</span>
                  </div>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontSize: 15, color: T.ink, fontFamily: F, fontWeight: 700, lineHeight: 1.2 }}>This helped? Give thanks.</div>
                    <div style={{ fontSize: 12, color: T.ink3, fontFamily: F, marginTop: 3 }}>Express your gratitude.</div>
                  </div>
                  <span style={{ fontSize: 16, color: T.acc, fontWeight: 600 }}>→</span>
                </button>
              ) : (
                <div className="fu" style={{ padding: "28px 22px", borderRadius: 20, background: T.s, border: "1px solid " + T.bdr }}>
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>☕</div>
                    <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>
                      Thank {profile.name} for this rec
                    </div>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <textarea value={tipMessage} onChange={e => setTipMessage(e.target.value)}
                      placeholder="What did you like about this recommendation?"
                      rows={3}
                      style={{
                        width: "100%", padding: "16px 18px", borderRadius: 16,
                        border: `1.5px solid ${T.bdr}`, fontSize: 15, fontFamily: F,
                        outline: "none", resize: "none", background: T.bg, color: T.ink,
                        lineHeight: 1.55, transition: "border-color .2s",
                      }}
                      onFocus={e => e.target.style.borderColor = T.acc}
                      onBlur={e => e.target.style.borderColor = T.bdr}
                    />
                    <div style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 6 }}>
                      {profile.name} will see your note with this rec
                    </div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, fontFamily: F, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
                    Attach a tip
                  </div>
                  <div style={{ textAlign: "center", marginBottom: 4 }}>
                    <div style={{ fontFamily: MN, fontSize: 40, fontWeight: 700, color: T.ink, lineHeight: 1, letterSpacing: "-0.03em" }}>
                      {"$"}{tipAmount}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 24, marginTop: 12 }}>
                    {[3, 5, 10, 25].map(amt => (
                      <button key={amt} onClick={() => setTipAmount(amt)} style={{
                        flex: 1, padding: "10px 0", borderRadius: 12, textAlign: "center",
                        border: tipAmount === amt ? `2px solid ${T.acc}` : `1.5px solid ${T.bdr}`,
                        background: tipAmount === amt ? T.accSoft : "transparent",
                        color: tipAmount === amt ? T.acc : T.ink3,
                        fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: MN,
                        transition: "all .12s",
                      }}>
                        {"$"}{amt}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setTipSent(true)} style={{
                    width: "100%", padding: "16px", borderRadius: 14, border: "none",
                    background: T.acc, color: T.accText,
                    fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: F,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                    Send {"$"}{tipAmount} ☕
                  </button>
                  <button onClick={() => { setTipExpanded(false); setTipAmount(null); }} style={{
                    width: "100%", background: "none", border: "none", padding: "10px 0 0",
                    cursor: "pointer", fontSize: 12, color: T.ink3, fontFamily: F,
                  }}>Maybe later</button>
                </div>
              )}
            </div>
          )}

          {/* Tip sent confirmation */}
          {tipSent && (
            <div className="fu" style={{
              marginTop: 20, marginBottom: 8, padding: "22px 20px", borderRadius: 16,
              background: "#6BAA8E12", border: `1px solid #6BAA8E30`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#6BAA8E" }}>{"$"}{tipAmount} sent!</div>
              <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 4 }}>{profile.name} will see your message with this rec</div>
            </div>
          )}

          {/* On-chain footer */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.bdr}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, opacity: .4 }}>⛓</span>
              <span style={{ fontSize: 10, color: T.ink3, fontFamily: MN, fontWeight: 500 }}>On-chain</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 10, fontFamily: MN,
                background: T.s, border: "1px solid " + T.bdr, color: T.ink3,
              }}>Timestamped · Rev {selectedItem.revision || 1}</span>
              {!!itemLicensable[selectedItem.id] && (
                <span style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 10, fontFamily: MN,
                  background: T.s, border: "1px solid " + T.bdr, color: T.ink3,
                }}>Licensable</span>
              )}
              {profile.cryptoEnabled && (
                <span style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 10, fontFamily: MN,
                  background: T.s, border: "1px solid " + T.bdr, color: T.ink3,
                }}>{profile.wallet}</span>
              )}
            </div>
            <div style={{ height: 20 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
