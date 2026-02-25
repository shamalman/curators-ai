'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { T, W, V, F, S, MN, CAT } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";
import MessageBubble from "./MessageBubble";
import CaptureCard from "./CaptureCard";

const renderMd = (text) => text.split("\n").map((line, i) => {
  const b = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return <div key={i} dangerouslySetInnerHTML={{ __html: b }} style={{ marginBottom: line === "" ? 8 : 2 }} />;
});

export default function ChatView({ variant }) {
  const router = useRouter();
  const { profile, tasteItems, messages, setMessages, dbLoaded, prevMsgCount, addRec, saveMsgToDb } = useCurator();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [pendingLink, setPendingLink] = useState(null);
  const [editingCapture, setEditingCapture] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const chatEnd = useRef(null);
  const chatScrollRef = useRef(null);
  const shouldScroll = useRef(false);

  const isCurator = variant === "curator";
  const items = tasteItems;
  const n = items.length;
  const cats = [...new Set(items.map(i => i.category))];

  // Visitor opening message
  useEffect(() => {
    if (!isCurator && profile && dbLoaded && messages.length === 0) {
      setMessages([{ role: "ai", text: `I'm ${profile.name}'s taste AI \u2014 trained on ${n} personal recommendations.\n\nI know what ${profile.name} loves, why they love it, and who it's for. Ask me anything.` }]);
    }
  }, [isCurator, profile, dbLoaded]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > prevMsgCount.current || typing) {
      shouldScroll.current = true;
      prevMsgCount.current = messages.length;
    }
    if (shouldScroll.current) {
      chatEnd.current?.scrollIntoView({ behavior: "smooth" });
      shouldScroll.current = false;
    }
  }, [messages, typing]);

  // Auto-scroll on initial load
  useEffect(() => {
    if (dbLoaded && messages.length > 0) {
      setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "instant" }), 100);
    }
  }, [dbLoaded]);

  // Opening prompts for curator chat
  useEffect(() => {
    if (!dbLoaded || !isCurator) return;
    if (messages.length === 0) {
      const openingPrompts = [
        "What's something you're enjoying that you want to capture and share?",
        "What have you been recommending to people lately?",
        "Anything new you've discovered that deserves a spot in your collection?",
        "What's something you keep telling people about?",
      ];
      const randomPrompt = openingPrompts[Math.floor(Math.random() * openingPrompts.length)];
      const openingMessage = n === 0
        ? `Hey! I'm here to help you capture the stuff you love — the music, places, books, shows, whatever you find yourself telling people about.\n\nJust tell me about something you'd recommend and I'll save it to your profile.\n\nWhat have you been recommending to people lately?`
        : n < 10
        ? `You've got ${n} recommendations so far.\n\n${randomPrompt}`
        : `${n} recs and counting.\n\n${randomPrompt}`;
      setMessages([{ role: "ai", text: openingMessage }]);
    }
  }, [dbLoaded]);

  const send = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    shouldScroll.current = true;
    setMessages(m => [...m, { role: "user", text: msg }]);
    saveMsgToDb("user", msg);
    setInput("");
    setTyping(true);

    const isVis = !isCurator;

    const urlMatch = msg.match(/https?:\/\/[^\s]+/);
    let enrichedMsg = msg;
    let linkMetadata = null;

    if (pendingLink && !urlMatch && !isVis) {
      enrichedMsg = `${msg}\n[Pending link: "${pendingLink.title}" from ${pendingLink.source}, url: ${pendingLink.url}]`;
      linkMetadata = pendingLink;
    } else if (urlMatch && !isVis) {
      try {
        const metaRes = await fetch('/api/link-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlMatch[0] })
        });
        const meta = await metaRes.json();
        if (meta.title) {
          linkMetadata = { url: urlMatch[0], title: meta.title, source: meta.source };
          enrichedMsg = `${msg}\n[Link metadata: "${meta.title}" from ${meta.source}]`;
          setPendingLink(linkMetadata);
        }
      } catch (e) {
        console.log('Could not fetch link metadata');
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: enrichedMsg,
          isVisitor: isVis,
          curatorName: profile.name,
          recommendations: items.map(item => ({
            title: item.title, category: item.category,
            context: item.context, tags: item.tags, date: item.date
          })),
          linkMetadata,
          history: messages.slice(-10),
        }),
      });

      const data = await response.json();
      setTyping(false);

      const text = data.message;
      const isCapturedRec = text.includes('\u{1F4CD} Adding:') || text.includes('\u{1F3F7} Suggested tags:');

      let capturedRec = null;
      if (isCapturedRec) {
        const titleMatch = text.match(/\*\*([^*]+)\*\*/);
        const contextMatch = text.match(/"([^"]+)"/);
        const tagsMatch = text.match(/\u{1F3F7} Suggested tags?:?\s*([^\n]+)/iu);
        const categoryMatch = text.match(/\u{1F4C1} Category:\s*(\w+)/i);
        const linkMatch = text.match(/\u{1F517} Link:\s*(https?:\/\/[^\s]+)/i);
        if (titleMatch) {
          capturedRec = {
            title: titleMatch[1].replace(' \u2014 ', ' - '),
            context: contextMatch ? contextMatch[1] : '',
            tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [],
            category: categoryMatch ? categoryMatch[1].toLowerCase() : 'other',
            links: linkMatch ? [{ url: linkMatch[1], title: 'Suggested link' }] : [],
          };
        }
      }

      setMessages(m => [...m, { role: "ai", text: data.message, capturedRec }]);
      saveMsgToDb("ai", data.message, capturedRec);
    } catch (error) {
      console.error('Chat error:', error);
      setTyping(false);
      setMessages(m => [...m, { role: "ai", text: "Sorry, I'm having trouble connecting right now. Try again in a moment." }]);
    }
  };

  const handleSaveCapture = (capturedRec, msgIndex) => {
    const newItem = {
      id: Date.now(),
      slug: capturedRec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: capturedRec.title,
      category: capturedRec.category || "other",
      context: capturedRec.context,
      tags: capturedRec.tags,
      date: new Date().toISOString().split("T")[0],
      visibility: "public",
      revision: 1,
      earnableMode: "none",
      links: editingCapture?.links?.length > 0 ? editingCapture.links : (pendingLink ? [{ type: pendingLink.source?.toLowerCase() || "website", url: pendingLink.url, label: pendingLink.title }] : (capturedRec.links || [])),
      revisions: [{ rev: 1, date: new Date().toISOString().split("T")[0], change: "Created" }]
    };
    addRec(newItem);
    setMessages(prev => [...prev.map((m, idx) => idx === msgIndex ? { ...m, saved: true } : m), { role: "ai", text: "\u2713 Saved. What else?" }]);
    saveMsgToDb("ai", "\u2713 Saved. What else?");
    setPendingLink(null);
    setEditingCapture(null);
  };

  const handleAddLink = async () => {
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
      setEditingCapture(p => ({ ...p, links: [...(p.links || []), newLink] }));
    } catch (e) {
      setEditingCapture(p => ({ ...p, links: [...(p.links || []), { type: "website", url, label: url }] }));
    }
  };

  const handleRemoveLink = (linkIndex) => {
    const links = editingCapture.links || [];
    setEditingCapture(p => ({ ...p, links: links.filter((_, idx) => idx !== linkIndex) }));
    if (pendingLink && linkIndex === 0 && links.length === 0) setPendingLink(null);
  };

  // ── CURATOR CHAT ──
  if (isCurator) {
    const newRequests = []; // placeholder for requests integration
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, width: "100%" }}>
        {/* Workspace header */}
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${W.bdr}`, background: W.bg }}>
        <div style={{ padding: "48px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 700, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: W.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${W.accent}30` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: W.accent, fontFamily: F }}>C</span>
            </div>
            <div>
              <div style={{ fontFamily: F, fontSize: 16, color: T.ink, fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em" }}>My AI</div>
              <div style={{ fontSize: 10, color: T.ink3, fontFamily: MN, fontWeight: 400, marginTop: 3 }}>{n} recs {"\u00B7"} {cats.length} categories</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: T.ink3, fontFamily: MN }}>{n} recs</div>
        </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, background: W.bg }}>
          <div ref={chatScrollRef} onScroll={() => { const el = chatScrollRef.current; if (el) setShowScrollBtn(el.scrollTop < el.scrollHeight - el.clientHeight - 100); }} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "none", minHeight: 0, touchAction: "pan-y" }}>
            <div style={{ maxWidth: 700, margin: "0 auto", padding: "12px 16px" }}>
            {messages.map((msg, i) => {
              // Request alert card
              if (msg.type === "requestAlert") {
                return (
                  <div key={i} className="fu" style={{ marginBottom: 12, animationDelay: `${i * .03}s` }}>
                    <button onClick={() => router.push('/recommendations/review')} style={{
                      width: "100%", padding: "16px", borderRadius: 16, border: `1px solid ${W.bdr}`,
                      background: W.s, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 18 }}>{"\uD83D\uDCE9"}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: T.ink }}>{msg.count} new request{msg.count !== 1 ? "s" : ""}</div>
                        <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>
                          {newRequests.slice(0, 2).map(r => r.from).join(", ")}{newRequests.length > 2 ? ` +${newRequests.length - 2} more` : ""} {"\u2014"} tap to review
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#EF4444", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{msg.count}</span>
                        <span style={{ color: T.ink3, fontSize: 14 }}>{"\u203A"}</span>
                      </div>
                    </button>
                  </div>
                );
              }
              // Gratuity card
              if (msg.type === "gratuity") {
                const gc = CAT[msg.recCategory] || CAT.other;
                return (
                  <div key={i} className="fu" style={{ marginBottom: 12, animationDelay: `${i * .03}s` }}>
                    <div style={{
                      padding: "18px", borderRadius: 16,
                      background: `linear-gradient(135deg, #6BAA8E10, ${W.s})`,
                      border: `1px solid #6BAA8E30`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#6BAA8E18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 16 }}>{"\u2615"}</span>
                          </div>
                          <div>
                            <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: T.ink }}>{msg.from}</div>
                            <div style={{ fontFamily: F, fontSize: 10, color: T.ink3, marginTop: 1 }}>{msg.time}</div>
                          </div>
                        </div>
                        <div style={{ padding: "6px 14px", borderRadius: 10, background: "#6BAA8E20", border: `1px solid #6BAA8E30` }}>
                          <span style={{ fontFamily: MN, fontSize: 16, fontWeight: 700, color: "#6BAA8E" }}>{"$"}{msg.amount}</span>
                        </div>
                      </div>
                      {msg.message && (
                        <div style={{ padding: "12px 16px", borderRadius: 12, background: W.s, border: `1px solid ${W.bdr}`, marginBottom: 10 }}>
                          <p style={{ fontFamily: F, fontSize: 13, color: T.ink, lineHeight: 1.55, fontStyle: "italic" }}>"{msg.message}"</p>
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{gc.emoji}</span>
                        <span style={{ fontFamily: F, fontSize: 11, color: T.ink3 }}>For <span style={{ fontWeight: 600, color: T.ink2 }}>{msg.recTitle}</span></span>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className="fu" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12, animationDelay: `${i * .03}s` }}>
                  {msg.role === "ai" && (
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: W.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2, flexShrink: 0, border: `1px solid ${W.accent}25` }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: W.accent, fontFamily: F }}>C</span>
                    </div>
                  )}
                  <div style={{ maxWidth: "82%", minWidth: 0 }}>
                    <div style={{
                      padding: msg.role === "user" ? "12px 16px" : "14px 18px",
                      borderRadius: msg.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                      background: msg.role === "user" ? W.userBub : W.aiBub,
                      color: msg.role === "user" ? W.userTxt : T.ink,
                      fontSize: 14, lineHeight: 1.55, fontFamily: F,
                      fontWeight: msg.role === "user" ? 500 : 400,
                      border: msg.role === "user" ? "none" : `1px solid ${W.bdr}`,
                      overflowWrap: "break-word", wordBreak: "break-word",
                    }}>{msg.role === "ai" ? renderMd(msg.text) : msg.text}</div>
                    {msg.capturedRec && !msg.saved && !editingCapture && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => handleSaveCapture(msg.capturedRec, i)} style={{
                          padding: "8px 16px", borderRadius: 10, border: "none",
                          background: T.acc, color: "#fff", fontSize: 13, fontWeight: 600,
                          cursor: "pointer", fontFamily: F
                        }}>Save</button>
                        <button onClick={() => setEditingCapture({ ...msg.capturedRec, msgIndex: i })} style={{
                          padding: "8px 16px", borderRadius: 10, border: "1px solid " + T.bdr,
                          background: T.s, color: T.ink, fontSize: 13, fontWeight: 500,
                          cursor: "pointer", fontFamily: F
                        }}>Edit</button>
                      </div>
                    )}
                    {editingCapture && editingCapture.msgIndex === i && (
                      <CaptureCard
                        capture={editingCapture}
                        onUpdate={setEditingCapture}
                        onSave={() => handleSaveCapture(editingCapture, editingCapture.msgIndex)}
                        onCancel={() => setEditingCapture(null)}
                        pendingLink={pendingLink}
                        onRemoveLink={handleRemoveLink}
                        onAddLink={handleAddLink}
                      />
                    )}
                    {msg.saved && false && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#6BAA8E", fontFamily: F, fontWeight: 600 }}>{"\u2713"} Saved to your recommendations</div>
                    )}
                  </div>
                </div>
              );
            })}
            {typing && <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: W.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2, flexShrink: 0, border: `1px solid ${W.accent}25` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: W.accent, fontFamily: F }}>C</span>
              </div>
              <div style={{ padding: "14px 18px", background: W.aiBub, borderRadius: "20px 20px 20px 6px", border: `1px solid ${W.bdr}` }}><span className="dt" /><span className="dt" style={{ animationDelay: ".2s" }} /><span className="dt" style={{ animationDelay: ".4s" }} /></div>
            </div>}
            <div ref={chatEnd} />
            {showScrollBtn && <button onClick={() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollBtn(false); }} style={{ position: "sticky", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 36, height: 36, borderRadius: 18, background: W.s2, border: "1px solid " + W.bdr, color: T.ink2, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", zIndex: 10 }}>{"\u2193"}</button>}
            </div>
          </div>
          <div style={{ padding: "10px 16px 28px", flexShrink: 0, maxWidth: 700, margin: "0 auto", width: "100%" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Drop a rec, paste a link, or ask anything..."
                style={{ flex: 1, padding: "14px 18px", borderRadius: 24, border: `1.5px solid ${W.inputBdr}`, fontSize: 15, fontFamily: F, outline: "none", background: W.inputBg, color: T.ink }}
                onFocus={e => e.target.style.borderColor = W.accent} onBlur={e => e.target.style.borderColor = W.inputBdr}
              />
              <button onClick={send} style={{ width: 46, height: 46, borderRadius: 23, border: "none", background: input.trim() ? T.acc : W.bdr, color: input.trim() ? T.accText : T.ink3, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0, fontWeight: 600 }}>{"\u2191"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VISITOR CHAT ──
  if (!profile) return null;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, background: V.bg }}>
      {/* Branded header with curator identity */}
      <div style={{ padding: "48px 20px 12px", background: V.bg, flexShrink: 0, borderBottom: `1px solid ${V.bdr}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>{"\u2190"} Profile</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: `linear-gradient(145deg, ${T.s2}, ${T.s})`, border: `1.5px solid ${V.bdr}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: S, fontSize: 20, color: T.acc, fontWeight: 400 }}>{profile.name[0]}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: S, fontSize: 17, color: T.ink, fontWeight: 400, lineHeight: 1 }}>{profile.name}'s AI</div>
            <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: 3, background: T.acc, animation: "breathe 3s ease-in-out infinite" }} />
              Trained on {n} personal recs
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} className="fu" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 14, animationDelay: `${i * .03}s` }}>
            {msg.role === "ai" && (
              <div style={{ width: 26, height: 26, borderRadius: 9, background: `linear-gradient(145deg, ${T.s2}, ${T.s})`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2, flexShrink: 0 }}>
                <span style={{ fontFamily: S, fontSize: 13, color: T.acc, fontWeight: 400 }}>{profile.name[0]}</span>
              </div>
            )}
            <div style={{
              maxWidth: "82%", padding: msg.role === "user" ? "12px 16px" : "14px 18px",
              borderRadius: msg.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
              background: msg.role === "user" ? V.userBub : V.aiBub,
              color: msg.role === "user" ? V.userTxt : T.ink,
              fontSize: 14, lineHeight: 1.55, fontFamily: F,
              fontWeight: msg.role === "user" ? 500 : 400,
              border: "none",
              boxShadow: msg.role === "user" ? "none" : `inset 0 0 0 1px ${V.bdr}`,
              overflowWrap: "break-word", wordBreak: "break-word",
            }}>{msg.role === "ai" ? renderMd(msg.text) : msg.text}</div>
          </div>
        ))}
        {typing && <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ width: 26, height: 26, borderRadius: 9, background: `linear-gradient(145deg, ${T.s2}, ${T.s})`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2, flexShrink: 0 }}>
            <span style={{ fontFamily: S, fontSize: 13, color: T.acc, fontWeight: 400 }}>{profile.name[0]}</span>
          </div>
          <div style={{ padding: "14px 18px", background: V.aiBub, borderRadius: "20px 20px 20px 6px", boxShadow: `inset 0 0 0 1px ${V.bdr}` }}><span className="dt" /><span className="dt" style={{ animationDelay: ".2s" }} /><span className="dt" style={{ animationDelay: ".4s" }} /></div>
        </div>}
        <div ref={chatEnd} />
      </div>
      <div style={{ padding: "4px 16px 6px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0, maxWidth: "100%" }}>
        {[
          { label: "\uD83C\uDFA7 Radio", prompt: "Play me a radio station from the music recs" },
          { label: "\u2728 Newest", prompt: "What are the newest recommendations?" },
          { label: "\uD83D\uDD25 Most Popular", prompt: "What are the most popular picks?" },
          { label: "\uD83D\uDCD6 Books", prompt: "Show me book recommendations" },
          { label: "\uD83C\uDFB5 Music", prompt: "What music do you recommend?" },
          { label: "\uD83C\uDF7D Restaurants", prompt: "What are the restaurant recommendations?" },
        ].map(chip => (
          <button key={chip.label} onClick={() => setInput(chip.prompt)} style={{
            padding: "8px 14px", borderRadius: 20, border: `1px solid ${V.chipBdr}`, background: V.chip,
            fontSize: 12, color: T.ink2, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap", flexShrink: 0, fontWeight: 500,
          }}>{chip.label}</button>
        ))}
      </div>
      <div style={{ padding: "10px 16px 28px", flexShrink: 0, background: V.bg }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            placeholder={`Ask ${profile.name} anything...`}
            style={{ flex: 1, padding: "14px 18px", borderRadius: 24, border: `1.5px solid ${V.inputBdr}`, fontSize: 15, fontFamily: F, outline: "none", background: V.inputBg, color: T.ink }}
            onFocus={e => e.target.style.borderColor = T.acc} onBlur={e => e.target.style.borderColor = V.inputBdr}
          />
          <button onClick={send} style={{ width: 46, height: 46, borderRadius: 23, border: "none", background: input.trim() ? T.acc : V.bdr, color: input.trim() ? T.accText : T.ink3, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0, fontWeight: 600 }}>{"\u2191"}</button>
        </div>
      </div>
    </div>
  );
}
