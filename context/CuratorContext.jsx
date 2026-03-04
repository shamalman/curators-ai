'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { VisitorContext } from "./VisitorContext";

export const CuratorContext = createContext(null);

export function CuratorProvider({ children }) {
  const [profile, setProfile] = useState(null);
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

  // Subscription state
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [mySubscribers, setMySubscribers] = useState([]);
  const [mySubscriptionIds, setMySubscriptionIds] = useState(new Set());

  // Saved recs state
  const [savedRecIds, setSavedRecIds] = useState(new Set());

  // Load profile + recs + messages from Supabase
  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setDbLoaded(true); return; }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();
      if (!prof) { setDbLoaded(true); return; }

      setProfileId(prof.id);
      setProfile({
        name: prof.name, handle: "@" + prof.handle,
        bio: prof.bio, location: prof.location || "",
        styleSummary: prof.style_summary || null,
        invitedBy: prof.invited_by || null,
        aiEnabled: prof.ai_enabled,
        acceptRequests: prof.accept_requests, showRecs: prof.show_recs,
        cryptoEnabled: prof.crypto_enabled, wallet: prof.wallet || "",
        walletFull: "",
        subscribers: 0, subsEnabled: true,
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

      setDbLoaded(true);

      // Load subscriptions separately — non-blocking so core data loads even if table doesn't exist
      try {
        // My subscriptions (curators I follow)
        const { data: subRows } = await supabase
          .from("subscriptions").select("*")
          .eq("subscriber_id", prof.id).is("unsubscribed_at", null);
        if (subRows && subRows.length > 0) {
          const curatorIds = subRows.map(s => s.curator_id);
          const { data: curatorProfiles } = await supabase
            .from("profiles").select("id, name, handle, bio").in("id", curatorIds);
          const profileMap = {};
          (curatorProfiles || []).forEach(p => { profileMap[p.id] = p; });
          const merged = subRows.map(s => ({ ...s, curator: profileMap[s.curator_id] || null }));
          setMySubscriptions(merged);
          setMySubscriptionIds(new Set(curatorIds));
        } else {
          setMySubscriptions(subRows || []);
          setMySubscriptionIds(new Set());
        }

        // My subscribers (people following me)
        const { data: fanRows } = await supabase
          .from("subscriptions").select("*")
          .eq("curator_id", prof.id).is("unsubscribed_at", null);
        if (fanRows && fanRows.length > 0) {
          const subscriberIds = fanRows.map(s => s.subscriber_id);
          const { data: subProfiles } = await supabase
            .from("profiles").select("id, name, handle, bio").in("id", subscriberIds);
          const profileMap = {};
          (subProfiles || []).forEach(p => { profileMap[p.id] = p; });
          setMySubscribers(fanRows.map(s => ({ ...s, subscriber: profileMap[s.subscriber_id] || null })));
        } else {
          setMySubscribers(fanRows || []);
        }
      } catch (subErr) {
        console.warn("Failed to load subscriptions (table may not exist yet):", subErr);
      }

      // Load saved recs — non-blocking
      try {
        const { data: savedRows } = await supabase
          .from("saved_recs").select("recommendation_id").eq("user_id", prof.id);
        if (savedRows && savedRows.length > 0) {
          setSavedRecIds(new Set(savedRows.map(r => r.recommendation_id)));
        }
      } catch (e) { console.warn("Failed to load saved recs:", e); }
    } catch (err) {
      console.error("Failed to load from Supabase:", err);
      setDbLoaded(true);
    }
  }, []);

  // Load on mount
  useEffect(() => { loadData(); }, [loadData]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') loadData();
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProfileId(null);
        setTasteItems([]);
        setMessages([]);
        setMySubscriptions([]);
        setMySubscribers([]);
        setMySubscriptionIds(new Set());
        setSavedRecIds(new Set());
      }
    });
    return () => subscription.unsubscribe();
  }, [loadData]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const saveProfile = async () => {
    if (!profileId || !profile) return;
    try {
      const { error } = await supabase.from("profiles").update({
        name: profile.name,
        handle: profile.handle.replace("@", ""),
        bio: profile.bio,
        location: profile.location || "",
        ai_enabled: profile.aiEnabled,
        accept_requests: profile.acceptRequests,
        show_recs: profile.showRecs,
        crypto_enabled: profile.cryptoEnabled,
        wallet: profile.wallet || "",
      }).eq("id", profileId);
      if (error) throw error;
      // Re-fetch profile from DB to ensure context is fully in sync
      const { data: prof } = await supabase
        .from("profiles").select("*").eq("id", profileId).single();
      if (prof) {
        setProfile({
          name: prof.name, handle: "@" + prof.handle,
          bio: prof.bio, location: prof.location || "",
          styleSummary: prof.style_summary || null,
          invitedBy: prof.invited_by || null,
          aiEnabled: prof.ai_enabled,
          acceptRequests: prof.accept_requests, showRecs: prof.show_recs,
          cryptoEnabled: prof.crypto_enabled, wallet: prof.wallet || "",
          walletFull: "",
          subscribers: 0, subsEnabled: true,
          subsText: "Curated recs straight to your inbox. Only things worth your time.",
        });
      }
    } catch (err) { console.error("Failed to save profile:", err); }
  };

  const saveProfileFromChat = async ({ name, location, bio }) => {
    if (!profileId) return;
    try {
      const { error } = await supabase.from("profiles").update({
        name, location, bio,
      }).eq("id", profileId);
      if (error) throw error;
      // Re-fetch to sync all fields
      const { data: prof } = await supabase
        .from("profiles").select("*").eq("id", profileId).single();
      if (prof) {
        setProfile({
          name: prof.name, handle: "@" + prof.handle,
          bio: prof.bio, location: prof.location || "",
          styleSummary: prof.style_summary || null,
          invitedBy: prof.invited_by || null,
          aiEnabled: prof.ai_enabled,
          acceptRequests: prof.accept_requests, showRecs: prof.show_recs,
          cryptoEnabled: prof.crypto_enabled, wallet: prof.wallet || "",
          walletFull: "",
          subscribers: 0, subsEnabled: true,
          subsText: "Curated recs straight to your inbox. Only things worth your time.",
        });
      }
    } catch (err) { console.error("Failed to save profile from chat:", err); }
  };

  const addRec = async (item) => {
    if (!item.slug) {
      item = { ...item, slug: item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') };
    }
    if (!profileId) {
      setTasteItems(prev => [item, ...prev]);
      return item;
    }
    try {
      const slug = item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { data, error } = await supabase.from("recommendations").insert({
        profile_id: profileId,
        title: item.title,
        category: item.category,
        context: item.context,
        tags: item.tags || [],
        links: item.links || [],
        slug,
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

  const refreshSubscriptions = useCallback(async () => {
    if (!profileId) return;
    try {
      const { data: subRows } = await supabase
        .from("subscriptions").select("*")
        .eq("subscriber_id", profileId).is("unsubscribed_at", null);
      if (subRows && subRows.length > 0) {
        const curatorIds = subRows.map(s => s.curator_id);
        const { data: curatorProfiles } = await supabase
          .from("profiles").select("id, name, handle, bio").in("id", curatorIds);
        const profileMap = {};
        (curatorProfiles || []).forEach(p => { profileMap[p.id] = p; });
        setMySubscriptions(subRows.map(s => ({ ...s, curator: profileMap[s.curator_id] || null })));
        setMySubscriptionIds(new Set(curatorIds));
      } else {
        setMySubscriptions(subRows || []);
        setMySubscriptionIds(new Set());
      }

      const { data: fanRows } = await supabase
        .from("subscriptions").select("*")
        .eq("curator_id", profileId).is("unsubscribed_at", null);
      if (fanRows && fanRows.length > 0) {
        const subscriberIds = fanRows.map(s => s.subscriber_id);
        const { data: subProfiles } = await supabase
          .from("profiles").select("id, name, handle, bio").in("id", subscriberIds);
        const profileMap = {};
        (subProfiles || []).forEach(p => { profileMap[p.id] = p; });
        setMySubscribers(fanRows.map(s => ({ ...s, subscriber: profileMap[s.subscriber_id] || null })));
      } else {
        setMySubscribers(fanRows || []);
      }
    } catch (err) {
      console.warn("Failed to refresh subscriptions:", err);
    }
  }, [profileId]);

  const subscribe = async (curatorId) => {
    if (!profileId) return;
    try {
      // Check if a row already exists (possibly with unsubscribed_at set)
      const { data: existing } = await supabase.from("subscriptions")
        .select("*")
        .eq("subscriber_id", profileId)
        .eq("curator_id", curatorId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        // Re-subscribe: clear unsubscribed_at
        await supabase.from("subscriptions")
          .update({ unsubscribed_at: null })
          .eq("id", existing.id);
      } else {
        // New subscription
        await supabase.from("subscriptions").insert({
          subscriber_id: profileId,
          curator_id: curatorId,
        });
      }
      setMySubscriptionIds(prev => new Set([...prev, curatorId]));
      // Refresh to get full data with profiles
      await refreshSubscriptions();
    } catch (err) { console.error("Failed to subscribe:", err); }
  };

  const unsubscribe = async (curatorId) => {
    if (!profileId) return;
    try {
      const { error } = await supabase.from("subscriptions")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("subscriber_id", profileId)
        .eq("curator_id", curatorId)
        .is("unsubscribed_at", null);
      if (error) throw error;
      setMySubscriptions(prev => prev.filter(s => s.curator_id !== curatorId));
      setMySubscriptionIds(prev => { const next = new Set(prev); next.delete(curatorId); return next; });
      setMySubscribers(prev => prev.filter(s => s.subscriber_id !== curatorId));
    } catch (err) { console.error("Failed to unsubscribe:", err); }
  };

  const saveRec = useCallback(async (recId) => {
    if (!profileId) return;
    setSavedRecIds(prev => new Set([...prev, recId]));
    try {
      const { data: existing } = await supabase.from("saved_recs")
        .select("id").eq("user_id", profileId).eq("recommendation_id", recId)
        .limit(1).maybeSingle();
      if (!existing) {
        const { error: insertErr } = await supabase.from("saved_recs")
          .insert({ user_id: profileId, recommendation_id: recId });
        if (insertErr) {
          setSavedRecIds(prev => { const next = new Set(prev); next.delete(recId); return next; });
        }
      }
    } catch (err) {
      setSavedRecIds(prev => { const next = new Set(prev); next.delete(recId); return next; });
    }
  }, [profileId]);

  const unsaveRec = useCallback(async (recId) => {
    if (!profileId) return;
    setSavedRecIds(prev => { const next = new Set(prev); next.delete(recId); return next; });
    try {
      await supabase.from("saved_recs").delete()
        .eq("user_id", profileId).eq("recommendation_id", recId);
    } catch (err) {
      setSavedRecIds(prev => new Set([...prev, recId]));
    }
  }, [profileId]);

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

  // First-time curator: 0 recs and no bio yet
  const isFirstTime = dbLoaded && tasteItems.length === 0 && (!profile?.bio || profile.bio.trim() === '');

  return (
    <CuratorContext.Provider value={{
      profile, setProfile,
      profileId,
      isFirstTime,
      tasteItems, setTasteItems,
      messages, setMessages,
      dbLoaded,
      prevMsgCount,
      addRec,
      deleteRec,
      updateRec,
      saveProfile,
      saveProfileFromChat,
      saveMsgToDb,
      archived, setArchived,
      removing, setRemoving,
      filterCat, setFilterCat,
      undoItem, setUndoItem,
      removeItem,
      restoreItem,
      undoArchive,
      toggleVisibility,
      logout,
      mySubscriptions, mySubscribers, mySubscriptionIds,
      subscribe, unsubscribe, refreshSubscriptions,
      savedRecIds, saveRec, unsaveRec,
      isOwner: true,
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
