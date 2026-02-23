'use client'

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { VisitorContext } from "./VisitorContext";

export const CuratorContext = createContext(null);

export function CuratorProvider({ children }) {
  const [profile, setProfile] = useState({
    name: "Shamal", handle: "@shamal",
    bio: "SF food obsessive. Deep house collector. Sci-fi reader. I only recommend things I'd stake my reputation on.",
    aiEnabled: true, acceptRequests: true, subscribers: 847,
    subsEnabled: true, subsText: "Curated recs straight to your inbox. Only things worth your time.",
    showRecs: true,
    wallet: "0x1a2B...9fE3", walletFull: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9fE3", cryptoEnabled: true,
  });
  const [profileId, setProfileId] = useState(null);
  const [tasteItems, setTasteItems] = useState([]);
  const [messages, setMessages] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const prevMsgCount = useRef(0);

  // Archive/remove state (moved from CuratorsApp)
  const [archived, setArchived] = useState({});
  const [removing, setRemoving] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const [undoItem, setUndoItem] = useState(null);
  const undoTimer = useRef(null);

  // Load profile + recs + messages from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("handle", "shamal")
          .single();
        if (prof) {
          setProfileId(prof.id);
          setProfile({
            name: prof.name, handle: "@" + prof.handle,
            bio: prof.bio, aiEnabled: prof.ai_enabled,
            acceptRequests: prof.accept_requests, showRecs: prof.show_recs,
            cryptoEnabled: prof.crypto_enabled, wallet: prof.wallet || "",
            walletFull: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9fE3",
            subscribers: 847, subsEnabled: true,
            subsText: "Curated recs straight to your inbox. Only things worth your time.",
          });
          const { data: recs } = await supabase
            .from("recommendations")
            .select("*")
            .eq("profile_id", prof.id)
            .order("created_at", { ascending: false });
          if (recs && recs.length > 0) {
            setTasteItems(recs.map(r => ({
              id: r.id, slug: r.slug || r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              title: r.title, category: r.category, context: r.context,
              tags: r.tags || [], links: r.links || [], date: r.created_at?.split("T")[0],
              visibility: r.visibility || "public", revision: r.revision || 1,
              earnableMode: r.earnable_mode || "none",
              revisions: [{ rev: r.revision || 1, date: r.created_at?.split("T")[0], change: "Created" }],
            })));
          }
          const { data: msgs } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("profile_id", prof.id)
            .order("created_at", { ascending: false })
            .limit(50);
          if (msgs && msgs.length > 0) {
            setMessages(msgs.reverse().map(m => ({ role: m.role === "assistant" ? "ai" : m.role, text: m.text, capturedRec: m.captured_rec })));
            prevMsgCount.current = msgs.length;
          }
        }
        setDbLoaded(true);
      } catch (err) {
        console.error("Failed to load from Supabase:", err);
        setDbLoaded(true);
      }
    }
    loadData();
  }, []);

  const addRec = async (item) => {
    if (!profileId) {
      setTasteItems(prev => [item, ...prev]);
      return item;
    }
    try {
      const { data, error } = await supabase.from("recommendations").insert({
        profile_id: profileId,
        title: item.title,
        category: item.category,
        context: item.context,
        tags: item.tags || [],
        links: item.links || [],
        slug: item.slug,
        visibility: item.visibility || "public",
        status: "approved",
        revision: 1,
        earnable_mode: "none",
      }).select().single();
      if (error) throw error;
      const saved = { ...item, id: data.id };
      setTasteItems(prev => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.error("Failed to save rec:", err);
      setTasteItems(prev => [item, ...prev]);
      return item;
    }
  };

  const deleteRec = async (id) => {
    const { error } = await supabase.from("recommendations").delete().eq("id", id);
    if (error) throw error;
    const { error: revErr } = await supabase.from("revisions").delete().eq("rec_id", id);
    if (revErr) throw revErr;
    setTasteItems(items => items.filter(i => i.id !== id));
  };

  const updateRec = async (updated) => {
    setTasteItems(items => items.map(i => i.id === updated.id ? updated : i));
    if (profileId) {
      try {
        await supabase.from("recommendations").update({
          title: updated.title, context: updated.context,
          tags: updated.tags, category: updated.category,
          links: updated.links, revision: updated.revision,
        }).eq("id", updated.id);
      } catch (err) { console.error("Failed to update rec:", err); }
    }
  };

  const saveMsgToDb = async (role, text, capturedRec) => {
    if (!profileId) return;
    try {
      await supabase.from("chat_messages").insert({
        profile_id: profileId,
        role: role === "ai" ? "assistant" : role,
        text,
        captured_rec: capturedRec || null,
      });
    } catch (err) { console.error("Failed to save message:", err); }
  };

  const removeItem = async (id) => {
    if (!window.confirm("\u26A0\uFE0F DELETE RECOMMENDATION\n\nThis will permanently delete this recommendation and cannot be undone. Are you sure?")) return;
    setRemoving(id);
    try {
      await deleteRec(id);
      setArchived(prev => { const next = { ...prev }; delete next[id]; return next; });
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete recommendation. Please try again.");
    }
    setRemoving(null);
  };

  const undoArchive = () => {
    if (undoItem) {
      setArchived(prev => { const next = { ...prev }; delete next[undoItem.id]; return next; });
      setUndoItem(null);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    }
  };

  const restoreItem = (id) => {
    setArchived(prev => { const next = { ...prev }; delete next[id]; return next; });
    if (filterCat === "archived") {
      if (Object.keys(archived).length <= 1) setFilterCat(null);
    }
    if (profileId) {
      supabase.from("recommendations").update({ status: "approved" }).eq("id", id).catch(console.error);
    }
  };

  const toggleVisibility = (id) => {
    setTasteItems(items => items.map(i =>
      i.id === id ? { ...i, visibility: i.visibility === "public" ? "private" : "public" } : i
    ));
  };

  return (
    <CuratorContext.Provider value={{
      profile, setProfile,
      profileId,
      tasteItems, setTasteItems,
      messages, setMessages,
      dbLoaded,
      prevMsgCount,
      addRec,
      deleteRec,
      updateRec,
      saveMsgToDb,
      archived, setArchived,
      removing, setRemoving,
      filterCat, setFilterCat,
      undoItem, setUndoItem,
      removeItem,
      restoreItem,
      undoArchive,
      toggleVisibility,
    }}>
      {children}
    </CuratorContext.Provider>
  );
}

export function useCurator() {
  // Both contexts are always called (rules of hooks) — one will be null
  const curator = useContext(CuratorContext);
  const visitor = useContext(VisitorContext);
  const ctx = curator || visitor;
  if (!ctx) throw new Error("useCurator must be used within CuratorProvider or VisitorProvider");
  return ctx;
}
