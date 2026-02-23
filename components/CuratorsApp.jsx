'use client'

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { T, W, F, DEFAULT_BUNDLES } from "../lib/constants";
import { useCurator } from "../context/CuratorContext";
import ChatView from "./chat/ChatView";
import VisitorProfile from "./visitor/VisitorProfile";
import EditProfile from "./screens/EditProfile";
import { RequestScreen, RequestsPanel, RequestThread } from "./screens/RequestScreens";
import TasteManager from "./taste/TasteManager";
import { CuratorRecDetail, VisitorRecDetail } from "./recs/RecDetail";
import BottomTabs from "./layout/BottomTabs";

export default function CuratorsV2() {
  const { profile, setProfile, profileId, tasteItems, setTasteItems, messages, setMessages, dbLoaded, prevMsgCount, addRec, deleteRec, updateRec, saveMsgToDb } = useCurator();

  // mode: "curator" (logged-in owner) or "visitor" (public viewer)
  const [mode, setMode] = useState("curator");
  const [curatorTab, setCuratorTab] = useState("myai");
  const [subScreen, setSubScreen] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [archived, setArchived] = useState({});
  const [undoItem, setUndoItem] = useState(null);
  const undoTimer = useRef(null);
  const [profileCopied, setProfileCopied] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemCopied, setItemCopied] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);

  // Per-item earnings config
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

  const items = tasteItems;
  const n = items.length;

  const switchMode = (m) => {
    setMode(m);
    setCuratorTab("myai");
    setSubScreen(null);
    setMessages([]);
    prevMsgCount.current = 0;
    setSelectedItem(null);
    setFilterCat(null);
  };

  const openVisitorAI = () => {
    setSubScreen("ai");
    setMessages([{ role: "ai", text: `I'm ${profile.name}'s taste AI \u2014 trained on ${n} personal recommendations.\n\nI know what ${profile.name} loves, why they love it, and who it's for. Ask me anything.` }]);
  };

  const closeSubScreen = () => {
    setSubScreen(null);
    setSelectedItem(null);
    setFilterCat(null);
    setEditingItem(null);
    setItemCopied(false);
    if (mode === "visitor") { setMessages([]); prevMsgCount.current = 0; }
  };

  const removeItem = async (id) => {
    if (!window.confirm("\u26A0\uFE0F DELETE RECOMMENDATION\n\nThis will permanently delete this recommendation and cannot be undone. Are you sure?")) return;
    setRemoving(id);
    try {
      await deleteRec(id);
      setArchived(prev => { const next = { ...prev }; delete next[id]; return next; });
      if (selectedItem?.id === id) { setSelectedItem(null); setSubScreen("taste"); }
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
    if (selectedItem?.id === id) setSelectedItem(s => ({ ...s, visibility: s.visibility === "public" ? "private" : "public" }));
  };

  const saveItemEdit = async () => {
    if (!editingItem) return;
    const newRev = (selectedItem.revision || 1) + 1;
    const newRevisions = [
      { rev: newRev, date: new Date().toISOString().split("T")[0], change: "Updated context and tags" },
      ...(selectedItem.revisions || []),
    ];
    const updated = { ...selectedItem, title: editingItem.title, context: editingItem.context, tags: editingItem.tags, category: editingItem.category, links: editingItem.links || [], revision: newRev, revisions: newRevisions };
    setSelectedItem(updated);
    setEditingItem(null);
    await updateRec(updated);
  };

  const copyLink = (slug) => {
    const url = `curators.com/${profile.handle.replace("@", "")}/${slug}`;
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    setItemCopied(true);
    setTimeout(() => setItemCopied(false), 2000);
  };

  const shareProfile = () => {
    const url = `curators.com/${profile.handle.replace("@", "")}`;
    if (navigator.share) {
      navigator.share({ title: `${profile.name} on Curators`, url: `https://${url}` }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`https://${url}`);
    }
    setProfileCopied(true);
    setTimeout(() => setProfileCopied(false), 2200);
  };

  // Screen flags
  const showingProfile = (mode === "visitor" && !subScreen) || (mode === "curator" && curatorTab === "profile" && !subScreen);
  const showingCuratorChat = mode === "curator" && curatorTab === "myai" && !subScreen;
  const showingVisitorAI = subScreen === "ai";
  const showingRequest = subScreen === "request";
  const showingEditProfile = subScreen === "editProfile";
  const showingTaste = subScreen === "taste";
  const showingItem = subScreen === "item";
  const showingVisitorItem = subScreen === "visitorItem";
  const showingRequests = subScreen === "requests";
  const showingRequestThread = subScreen === "requestThread";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,300;1,6..72,400&family=Manrope:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        body{background:${T.bg}}
        ::selection{background:${T.acc}30}
        ::-webkit-scrollbar{width:0;display:none}
        @keyframes fu{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes thumbBreathe{0%,100%{transform:scale(1);box-shadow:0 2px 8px rgba(0,0,0,0.3)}50%{transform:scale(1.12);box-shadow:0 2px 16px rgba(0,0,0,0.4)}}
        @keyframes rm{from{opacity:1;max-height:80px}to{opacity:0;max-height:0;padding:0;margin:0}}
        @keyframes breathe{0%,100%{opacity:.4}50%{opacity:1}}
        .fu{animation:fu .35s ease-out forwards;opacity:0}
        .dt{width:5px;height:5px;border-radius:50%;display:inline-block;margin:0 2px;animation:pulse 1.2s infinite;background:${T.ink3}}
        .rm{animation:rm .3s ease-out forwards;overflow:hidden}
      `}</style>

      <div style={{ width: "100%", maxWidth: 430, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column", background: T.bg, position: "relative", overflow: "hidden" }}>

        {/* ═══ PROFILE PAGE ═══ */}
        {showingProfile && (
          <VisitorProfile
            mode={mode}
            onSwitchMode={switchMode}
            onOpenAI={openVisitorAI}
            onOpenRequest={() => setSubScreen("request")}
            onOpenEdit={() => setSubScreen("editProfile")}
            onShareProfile={shareProfile}
            profileCopied={profileCopied}
            onSelectItem={(item) => { setSelectedItem(item); setSubScreen("visitorItem"); }}
          />
        )}

        {/* ═══ CURATOR: MY AI CHAT ═══ */}
        {showingCuratorChat && (
          <ChatView variant="curator" onOpenTaste={() => { setSubScreen("taste"); setFilterCat(null); }} onOpenRequests={() => setSubScreen("requests")} />
        )}

        {/* ═══ VISITOR AI CHAT ═══ */}
        {showingVisitorAI && (
          <ChatView variant="visitor" onClose={closeSubScreen} />
        )}

        {/* ═══ REQUEST SCREEN ═══ */}
        {showingRequest && (
          <RequestScreen onClose={closeSubScreen} profileName={profile.name} />
        )}

        {/* ═══ EDIT PROFILE ═══ */}
        {showingEditProfile && (
          <EditProfile onClose={closeSubScreen} />
        )}

        {/* ═══ REQUESTS PANEL ═══ */}
        {showingRequests && (
          <RequestsPanel
            onClose={closeSubScreen}
            onOpenThread={(req) => { setActiveRequest(req); setSubScreen("requestThread"); }}
          />
        )}

        {/* ═══ REQUEST THREAD ═══ */}
        {showingRequestThread && activeRequest && (
          <RequestThread
            request={activeRequest}
            onBack={() => { setSubScreen("requests"); setActiveRequest(null); }}
          />
        )}

        {/* ═══ TASTE LIBRARY ═══ */}
        {showingTaste && (
          <TasteManager
            items={items}
            archived={archived}
            filterCat={filterCat}
            setFilterCat={setFilterCat}
            removing={removing}
            onClose={closeSubScreen}
            onSelectItem={(item) => { setSelectedItem(item); setSubScreen("item"); }}
            onRemoveItem={removeItem}
            onRestoreItem={restoreItem}
            undoItem={undoItem}
            onUndoArchive={undoArchive}
          />
        )}

        {/* ═══ CURATOR ITEM DETAIL ═══ */}
        {showingItem && selectedItem && (
          <CuratorRecDetail
            selectedItem={selectedItem}
            onBack={() => { setSubScreen("taste"); setEditingItem(null); }}
            onRemoveItem={removeItem}
            onRestoreItem={(id) => { restoreItem(id); setSubScreen("taste"); }}
            archived={archived}
            editingItem={editingItem}
            setEditingItem={setEditingItem}
            onSaveEdit={saveItemEdit}
            onToggleVisibility={toggleVisibility}
            onCopyLink={copyLink}
            itemCopied={itemCopied}
            itemSubOnly={itemSubOnly} setItemSubOnly={setItemSubOnly}
            itemTiers={itemTiers} setItemTiers={setItemTiers}
            itemInBundle={itemInBundle} setItemInBundle={setItemInBundle}
            itemBundles={itemBundles} setItemBundles={setItemBundles}
            itemLicensable={itemLicensable} setItemLicensable={setItemLicensable}
            itemLicense={itemLicense} setItemLicense={setItemLicense}
            itemTipEnabled={itemTipEnabled} setItemTipEnabled={setItemTipEnabled}
            itemTipConfig={itemTipConfig} setItemTipConfig={setItemTipConfig}
            bundles={bundles} setBundles={setBundles}
            newBundleName={newBundleName} setNewBundleName={setNewBundleName}
          />
        )}

        {/* ═══ VISITOR ITEM DETAIL ═══ */}
        {showingVisitorItem && selectedItem && (
          <VisitorRecDetail
            selectedItem={selectedItem}
            onClose={closeSubScreen}
            itemLicensable={itemLicensable}
            itemLicense={itemLicense}
            itemTipEnabled={itemTipEnabled}
            itemTipConfig={itemTipConfig}
            itemBundles={itemBundles}
            bundles={bundles}
          />
        )}

        {/* ═══ CURATOR TAB BAR ═══ */}
        {mode === "curator" && !subScreen && (
          <BottomTabs curatorTab={curatorTab} setCuratorTab={setCuratorTab} />
        )}

      </div>
    </>
  );
}
