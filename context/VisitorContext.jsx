'use client'

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export const VisitorContext = createContext(null);

export function VisitorProvider({ handle, children }) {
  const [profile, setProfile] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [tasteItems, setTasteItems] = useState([]);
  const [messages, setMessages] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const prevMsgCount = useRef(0);

  // Fetch profile + public recs by handle
  useEffect(() => {
    if (!handle) return;
    async function loadVisitorData() {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("handle", handle)
          .single();
        if (prof) {
          setProfileId(prof.id);
          setProfile({
            name: prof.name, handle: "@" + prof.handle,
            bio: prof.bio, aiEnabled: prof.ai_enabled,
            acceptRequests: prof.accept_requests, showRecs: prof.show_recs,
            cryptoEnabled: prof.crypto_enabled, wallet: prof.wallet || "",
            walletFull: "",
            subscribers: 0, subsEnabled: true,
            subsText: "Curated recs straight to your inbox. Only things worth your time.",
          });

          // Check if logged-in user owns this profile
          const { data: { user } } = await supabase.auth.getUser();
          if (user && prof.auth_user_id === user.id) {
            setIsOwner(true);
          }

          const { data: recs } = await supabase
            .from("recommendations")
            .select("*")
            .eq("profile_id", prof.id)
            .eq("visibility", "public")
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
        }
        setDbLoaded(true);
      } catch (err) {
        console.error("Failed to load visitor data:", err);
        setDbLoaded(true);
      }
    }
    loadVisitorData();
  }, [handle]);

  // No-op stubs for curator-only functions
  const addRec = async () => {};
  const deleteRec = async () => {};
  const updateRec = async () => {};
  const saveMsgToDb = async () => {};
  const removeItem = async () => {};
  const restoreItem = () => {};
  const undoArchive = () => {};
  const toggleVisibility = () => {};

  return (
    <VisitorContext.Provider value={{
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
      archived: {},
      setArchived: () => {},
      removing: null,
      setRemoving: () => {},
      filterCat: null,
      setFilterCat: () => {},
      undoItem: null,
      setUndoItem: () => {},
      removeItem,
      restoreItem,
      undoArchive,
      toggleVisibility,
      isOwner,
    }}>
      {children}
    </VisitorContext.Provider>
  );
}
