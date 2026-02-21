'use client'

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

const REQUESTS_DATA = [
  { id: "r1", from: "Maria", handle: "@maria", text: "Looking for music that's soulful but also good for working?", category: "music", date: "2026-02-14T10:30:00", status: "new", aiDraft: "Based on your taste, I'd suggest **Emancipator** — beautiful instrumentals that are introspective but have great rhythm. Perfect for focus. **Michael Kiwanuka** is another option if you want something with vocals." },
  { id: "r2", from: "David", handle: "@david", text: "A book that will really move me emotionally?", category: "book", date: "2026-02-13T16:00:00", status: "new", aiDraft: "**When Breath Becomes Air** by Paul Kalanithi is exactly what you're looking for. A neurosurgeon writing about his own mortality with incredible prose. It will stay with you." },
  { id: "r3", from: "Jess", handle: "@jess", text: "Need a special date night restaurant - somewhere memorable?", category: "restaurant", date: "2026-02-12T09:15:00", status: "new", aiDraft: "**Delfina** is perfect for this. Inventive, progressive food that's a real adventure. Great for someone who appreciates quality and creativity in their meal." },
];

const TASTE_DATA = [
  { id: 1, slug: "she-was-the-one-joe-higgs", title: "She Was the One — Joe Higgs", category: "music", context: "Beautiful soul lifting song that makes you smile, move, and sing along.", tags: ["Reggae", "Old School"], date: "2026-02-15", visibility: "public", revision: 1, earnableMode: "none",
    links: [
      { type: "youtube", url: "https://www.youtube.com/watch?v=-lVBp8sulrk", label: "She Was The One" }
    ],
    revisions: [{ rev: 1, date: "2026-02-15", change: "Created" }] },
  { id: 2, slug: "delfina", title: "Delfina", category: "restaurant", context: "Inventive, progressive minded food that brings tradition, classics, and novel approaches. It's a high-quality adventure for people who love food.", tags: ["Special Occasion", "Date Night"], date: "2026-02-15", visibility: "public", revision: 1, earnableMode: "none",
    links: [],
    revisions: [{ rev: 1, date: "2026-02-15", change: "Created" }] },
  { id: 3, slug: "emancipator", title: "Emancipator", category: "music", context: "A unique artist who creates lovely instrumentals with classical sounds mixed in beautiful, haunting, introspective, rhythmic songs that capture me.", tags: ["Instrumental", "Chill"], date: "2026-02-15", visibility: "public", revision: 1, earnableMode: "none",
    links: [
      { type: "spotify", url: "https://open.spotify.com/track/7cHRys0Lhk9642dLaPUMkm?si=9f16a2b071484958", label: "Soon It Will Be Cold Enough to Build Fires" },
      { type: "spotify", url: "https://open.spotify.com/track/4qCYYhzI5bCz7JxV7VD4HH?si=d50e0285ec214655", label: "First Snow" }
    ],
    revisions: [{ rev: 1, date: "2026-02-15", change: "Created" }] },
  { id: 4, slug: "when-breath-becomes-air", title: "When Breath Becomes Air — Paul Kalanithi", category: "book", context: "An incredible autobiography of a neurosurgeon who also had a masters in English Literature. He wrote masterfully about his life and his own mortality. It moved me deeply. Highly recommend.", tags: ["Autobiography", "Cancer"], date: "2026-02-15", visibility: "public", revision: 1, earnableMode: "none",
    links: [
      { type: "wikipedia", url: "https://en.wikipedia.org/wiki/Paul_Kalanithi", label: "About the Author" }
    ],
    revisions: [{ rev: 1, date: "2026-02-15", change: "Created" }] },
  { id: 5, slug: "michael-kiwanuka", title: "Michael Kiwanuka", category: "music", context: "A soulful artist and great performer. His song Father's Child off the album Love and Hate is one of my favorites.", tags: ["Soul", "Indie Rock", "Folk"], date: "2026-02-15", visibility: "public", revision: 1, earnableMode: "none",
    links: [
      { type: "spotify", url: "https://open.spotify.com/track/4pjnTKFhJxQzyd90onjqQi?si=ecbe239cc5b14bef", label: "Father's Child" }
    ],
    revisions: [{ rev: 1, date: "2026-02-15", change: "Created" }] },
];

const DEFAULT_TIERS = [
  { id: "free", name: "Free", price: 0, color: "#6BAA8E" },
  { id: "plus", name: "Plus", price: 5, color: "#C8956C" },
  { id: "pro", name: "Pro", price: 15, color: "#9B8BC2" },
];

const DEFAULT_BUNDLES = [
  { id: "b1", name: "SF Restaurant Guide", count: 4, price: 12 },
  { id: "b2", name: "Road Trip Essentials", count: 3, price: 8 },
];

const LICENSE_TYPES = [
  { id: "social", label: "Social media", desc: "Instagram, TikTok, X" },
  { id: "digital", label: "Digital / web", desc: "Websites, newsletters, ads" },
  { id: "print", label: "Print", desc: "Magazines, billboards, packaging" },
];

const CAT = {
  restaurant: { emoji: "🍽", color: "#C8956C", bg: "#C8956C18", label: "Restaurants" },
  book: { emoji: "📖", color: "#8B8BDB", bg: "#8B8BDB18", label: "Books" },
  music: { emoji: "🎵", color: "#C27BA0", bg: "#C27BA018", label: "Music" },
  tv: { emoji: "📺", color: "#9B8BC2", bg: "#9B8BC218", label: "TV & Film" },
  film: { emoji: "📺", color: "#9B8BC2", bg: "#9B8BC218", label: "TV & Film" },
  travel: { emoji: "✈️", color: "#6BAA8E", bg: "#6BAA8E18", label: "Travel" },
  product: { emoji: "⚡", color: "#6B9EC2", bg: "#6B9EC218", label: "Products" },
  other: { emoji: "◆", color: "#8B8B8B", bg: "#8B8B8B18", label: "Other" },
};

const EARNINGS = {
  total: 1247,
  streams: {
    tips: { amount: 412, count: 63, color: "#6BAA8E", icon: "☕", label: "Tips", trend: "+$87 this month" },
    subs: { amount: 508, count: 12, color: "#C7956D", icon: "🔒", label: "Subscriptions", trend: "+$42 this month" },
    license: { amount: 250, count: 2, color: "#8B7EC8", icon: "📜", label: "Licensing", trend: "1 pending inquiry" },
    bundles: { amount: 77, count: 11, color: "#5B9BD5", icon: "📦", label: "Bundles", trend: "+$21 this month" },
  },
  topRecs: [
    { title: "Kin Khao", category: "restaurant", earned: 285, sources: "☕ $180 tips · 📦 $105 bundles" },
    { title: "Parable of the Sower", category: "book", earned: 230, sources: "📜 $150 license · ☕ $80 tips" },
    { title: "Bar Agricole", category: "restaurant", earned: 195, sources: "📜 $100 license · 📦 $60 bundles · ☕ $35 tips" },
    { title: "Khruangbin — Con Todo El Mundo", category: "music", earned: 142, sources: "☕ $117 tips · 🔒 $25 subs" },
  ],
  transactions: {
    tips: [
      { from: "Jessica", amount: 5, rec: "Kin Khao", message: "Crab fried rice was unreal!", time: "2h ago" },
      { from: "Marcus", amount: 10, rec: "Parable of the Sower", message: "Buying copies for friends now.", time: "Yesterday" },
      { from: "Priya", amount: 25, rec: "Kin Khao", message: "Best meal I've had in SF. Period.", time: "2d ago" },
      { from: "Tom", amount: 3, rec: "Khruangbin", message: "", time: "3d ago" },
      { from: "Aiko", amount: 10, rec: "Kin Khao", message: "Took my parents, they loved it", time: "4d ago" },
      { from: "Diego", amount: 5, rec: "Bar Agricole", message: "Perfect date spot, thanks!", time: "5d ago" },
      { from: "Sarah", amount: 15, rec: "Parable of the Sower", message: "This book changed my perspective", time: "1w ago" },
    ],
    subs: [
      { from: "New subscriber", amount: 42, rec: "Monthly", message: "", time: "Today" },
      { from: "Emily R.", amount: 42, rec: "Renewal", message: "", time: "3d ago" },
      { from: "New subscriber", amount: 42, rec: "Monthly", message: "", time: "1w ago" },
    ],
    license: [
      { from: "Eater SF", amount: 150, rec: "Parable of the Sower", message: "Digital and social use license", time: "Jan 2026" },
      { from: "Taste Collective", amount: 100, rec: "Bar Agricole", message: "Social media feature", time: "Dec 2025" },
    ],
    bundles: [
      { from: "Anonymous", amount: 7, rec: "SF Essentials", message: "", time: "1d ago" },
      { from: "Chris M.", amount: 7, rec: "SF Essentials", message: "", time: "3d ago" },
      { from: "Anonymous", amount: 7, rec: "SF Essentials", message: "", time: "5d ago" },
    ],
  },
};

export default function CuratorsV2() {
  // mode: "curator" (logged-in owner) or "visitor" (public viewer)
  const [mode, setMode] = useState("curator");
  // curator tabs: "myai" | "profile"
  const [curatorTab, setCuratorTab] = useState("myai");
  // sub-screens that overlay on top
  const [subScreen, setSubScreen] = useState(null); // null | "ai" | "request" | "editProfile" | "taste" | "item" | "requests" | "requestThread"
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [tasteItems, setTasteItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [filterCat, setFilterCat] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [archived, setArchived] = useState({});
  const [undoItem, setUndoItem] = useState(null);
  const undoTimer = useRef(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subEmail, setSubEmail] = useState("");
  const [requestText, setRequestText] = useState("");
  const [requestCat, setRequestCat] = useState(null);
  const [requestSent, setRequestSent] = useState(false);
  const [profileTab, setProfileTab] = useState("recent");
  const [showHistory, setShowHistory] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // holds editable copy
  const [itemCopied, setItemCopied] = useState(false);
  const [profileCopied, setProfileCopied] = useState(false);
  const [requests, setRequests] = useState(REQUESTS_DATA);
  const [activeRequest, setActiveRequest] = useState(null);
  const [requestFilter, setRequestFilter] = useState("all");
  const [requestReply, setRequestReply] = useState("");
  const [tipExpanded, setTipExpanded] = useState(false);
  const [tipAmount, setTipAmount] = useState(null);
  const [tipSent, setTipSent] = useState(false);
  const [editingCapture, setEditingCapture] = useState(null); // { title, context, tags, msgIndex }
  const [pendingLink, setPendingLink] = useState(null); // { url, title, source } - waiting for user's take
  const [tipMessage, setTipMessage] = useState("");
  // Per-item earnings config — each is independent (keyed by item id)
  const [itemSubOnly, setItemSubOnly] = useState({ 10: true, 5: true }); // Flour+Water, Hotel
  const [itemTiers, setItemTiers] = useState({ 10: ["plus", "pro"], 5: ["pro"] });
  const [itemInBundle, setItemInBundle] = useState({ 1: true, 3: true, 6: true });
  const [itemBundles, setItemBundles] = useState({ 1: ["b1"], 3: ["b1"], 6: ["b1"] });
  const [itemLicensable, setItemLicensable] = useState({ 2: true, 3: true, 11: true });
  const [itemLicense, setItemLicense] = useState({ 2: { types: ["digital", "social"], floor: 150 }, 3: { types: ["social"], floor: 250 }, 11: { types: ["digital"], floor: 100 } });
  const [itemTipEnabled, setItemTipEnabled] = useState({ 1: true, 2: true, 4: true });
  const [itemTipConfig, setItemTipConfig] = useState({ 1: { suggested: 5, min: 1, max: 100 }, 2: { suggested: 3, min: 1, max: 50 }, 4: { suggested: 3, min: 1, max: 100 } });
  const [bundles, setBundles] = useState(DEFAULT_BUNDLES);
  const [newBundleName, setNewBundleName] = useState("");
  const [earningsExpanded, setEarningsExpanded] = useState(false);
  const [earningsDrill, setEarningsDrill] = useState(null);
  const [profile, setProfile] = useState({
    name: "Shamal", handle: "@shamal",
    bio: "SF food obsessive. Deep house collector. Sci-fi reader. I only recommend things I'd stake my reputation on.",
    aiEnabled: true, acceptRequests: true, subscribers: 847,
    subsEnabled: true, subsText: "Curated recs straight to your inbox. Only things worth your time.",
    showRecs: true,
    wallet: "0x1a2B...9fE3", walletFull: "0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9fE3", cryptoEnabled: true,
  });
  const chatEnd = useRef(null);
  const chatScrollRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);  const chatInitd = useRef(false);
  const shouldScroll = useRef(false);
  const prevMsgCount = useRef(0);
  const [profileId, setProfileId] = useState(null);
  const [dbLoaded, setDbLoaded] = useState(false);

  // Load profile + recs from Supabase on mount
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
            .order("created_at", { ascending: true })
            .limit(50);
          if (msgs && msgs.length > 0) {
            setMessages(msgs.map(m => ({ role: m.role === "assistant" ? "ai" : m.role, text: m.text, capturedRec: m.captured_rec })));
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

  const items = tasteItems;
  const n = items.length;
  const activeItems = items.filter(i => !archived[i.id]);
  const archivedItems = items.filter(i => !!archived[i.id]);
  const cats = [...new Set(activeItems.map(i => i.category))];
  const cc = {}; cats.forEach(c => { cc[c] = activeItems.filter(i => i.category === c).length; });
  const activeN = activeItems.length;
  const topCats = [...cats].sort((a, b) => (cc[b] || 0) - (cc[a] || 0));

  // Only auto-scroll when new messages arrive or typing starts — not on every render
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

  // Opening prompts for curator chat
  const openingPrompts = [
    "What's something you're enjoying that you want to capture and share?",
    "What have you been recommending to people lately?",
    "Anything new you've discovered that deserves a spot in your collection?",
    "What's something you keep telling people about?",
  ];
  
  // Init curator chat once - only after DB loads, and only if no messages from DB
  useEffect(() => {
    if (!dbLoaded) return;
    if (mode === "curator" && curatorTab === "myai" && messages.length === 0) {
      const randomPrompt = openingPrompts[Math.floor(Math.random() * openingPrompts.length)];
      const openingMessage = n === 0
        ? `Hey! I'm here to help you capture the stuff you love — the songs, spots, books, whatever you find yourself telling people about.\n\n${randomPrompt}`
        : n < 10
        ? `You've got ${n} recommendations so far.\n\n${randomPrompt}`
        : `${n} recs and counting.\n\n${randomPrompt}`;
      setMessages([{ role: "ai", text: openingMessage }]);
    }
  }, [mode, curatorTab, dbLoaded]);
  const switchMode = (m) => {
    setMode(m);
    setCuratorTab("myai");
    setSubScreen(null);
    setMessages([]);
    prevMsgCount.current = 0;
    setSelectedItem(null);
    setFilterCat(null);
    setRequestSent(false);
    setRequestText("");
    setRequestCat(null);
    chatInitd.current = false;
  };

  const openVisitorAI = () => {
    setSubScreen("ai");
    setMessages([{ role: "ai", text: `I'm ${profile.name}'s taste AI — trained on ${n} personal recommendations.\n\nI know what ${profile.name} loves, why they love it, and who it's for. Ask me anything.` }]);
  };

  const closeSubScreen = () => {
    setSubScreen(null);
    setSelectedItem(null);
    setFilterCat(null);
    setShowHistory(false);
    setEditingItem(null);
    setItemCopied(false);
    setEarningsExpanded(false); setEarningsDrill(null);
    if (mode === "visitor") { setMessages([]); prevMsgCount.current = 0; }
    setRequestSent(false);
    setRequestText("");
    setRequestCat(null);
    setTipExpanded(false); setTipAmount(null); setTipSent(false); setTipMessage("");
  };

  const send = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    shouldScroll.current = true;
    setMessages(m => [...m, { role: "user", text: msg }]);
    saveMsgToDb("user", msg);
    setInput(""); 
    setTyping(true);
    
    const isVis = subScreen === "ai";
    
    // Check if the message is a URL and fetch metadata
    const urlMatch = msg.match(/https?:\/\/[^\s]+/);
    let enrichedMsg = msg;
    let linkMetadata = null;
    
    // If there's a pending link and user is giving their take
    if (pendingLink && !urlMatch && !isVis) {
      enrichedMsg = `${msg}\n[Pending link: "${pendingLink.title}" from ${pendingLink.source}, url: ${pendingLink.url}]`;
      linkMetadata = pendingLink;
    }
    // If user pastes a new link
    else if (urlMatch && !isVis) {
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
          // Store as pending link for next message
          setPendingLink(linkMetadata);
        }
      } catch (e) {
        console.log('Could not fetch link metadata');
      }
    }
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: enrichedMsg,
          isVisitor: isVis,
          curatorName: profile.name,
          recommendations: items.map(item => ({
            title: item.title,
            category: item.category,
            context: item.context,
            tags: item.tags
          })),
          linkMetadata,
          history: messages.slice(-10),
        }),
      });
      
      const data = await response.json();
      setTyping(false);
      
      // Check if AI response contains a captured recommendation
      const text = data.message;
      const isCapturedRec = text.includes('📍 Adding:') || text.includes('🏷 Suggested tags:');
      
      // Try to parse the captured rec
      let capturedRec = null;
      if (isCapturedRec) {
        const titleMatch = text.match(/\*\*([^*]+)\*\*/);
        const contextMatch = text.match(/"([^"]+)"/);
        const tagsMatch = text.match(/🏷 Suggested tags?:?\s*([^\n]+)/i);
        const categoryMatch = text.match(/📁 Category:\s*(\w+)/i);
        const linkMatch = text.match(/🔗 Link:\s*(https?:\/\/[^\s]+)/i);        
        if (titleMatch) {
          capturedRec = {
            title: titleMatch[1].replace(' — ', ' - '),
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

  const removeItem = (id) => {
    setRemoving(id);
    setTimeout(() => {
      setArchived(prev => ({ ...prev, [id]: true }));
      setRemoving(null);
      if (selectedItem?.id === id) { setSelectedItem(null); setSubScreen("taste"); }
      const item = tasteItems.find(i => i.id === id);
      setUndoItem(item);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndoItem(null), 4000);
      if (profileId) {
        supabase.from("recommendations").update({ status: "archived" }).eq("id", id).catch(console.error);
      }
    }, 300);
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

  const filtered = filterCat === "archived" ? archivedItems : filterCat ? activeItems.filter(i => i.category === filterCat) : activeItems;
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const fmtDateFull = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
    setTasteItems(items => items.map(i => i.id === updated.id ? updated : i));
    setSelectedItem(updated);
    setEditingItem(null);
    if (profileId) {
      try {
        await supabase.from("recommendations").update({
          title: updated.title, context: updated.context,
          tags: updated.tags, category: updated.category,
          links: updated.links, revision: newRev,
        }).eq("id", updated.id);
      } catch (err) { console.error("Failed to update rec:", err); }
    }
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

  const saveRecToDb = async (item) => {
    if (!profileId) return item;
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
      if (data) return { ...item, id: data.id };
    } catch (err) { console.error("Failed to save rec:", err); }
    return item;
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

  const toggleItemTier = (itemId, tierId) => {
    setItemTiers(prev => {
      const current = prev[itemId] || [];
      return { ...prev, [itemId]: current.includes(tierId) ? current.filter(t => t !== tierId) : [...current, tierId] };
    });
  };

  const toggleItemBundle = (itemId, bundleId) => {
    setItemBundles(prev => {
      const current = prev[itemId] || [];
      return { ...prev, [itemId]: current.includes(bundleId) ? current.filter(b => b !== bundleId) : [...current, bundleId] };
    });
  };

  const addBundle = () => {
    if (!newBundleName.trim()) return;
    const id = "b" + Date.now();
    setBundles(prev => [...prev, { id, name: newBundleName.trim(), count: 0, price: 0 }]);
    setNewBundleName("");
  };

  const toggleLicenseType = (itemId, typeId) => {
    setItemLicense(prev => {
      const current = prev[itemId] || { types: [], floor: 100 };
      const types = current.types.includes(typeId) ? current.types.filter(t => t !== typeId) : [...current.types, typeId];
      return { ...prev, [itemId]: { ...current, types } };
    });
  };

  const setLicenseFloor = (itemId, floor) => {
    setItemLicense(prev => {
      const current = prev[itemId] || { types: [], floor: 100 };
      return { ...prev, [itemId]: { ...current, floor: parseInt(floor) || 0 } };
    });
  };
  const renderMd = (text) => text.split("\n").map((line, i) => {
    const b = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: b }} style={{ marginBottom: line === "" ? 8 : 2 }} />;
  });

  // ── Theme: shared base ──
  const T = {
    bg: "#131210", bg2: "#1A1714", s: "#201D18", s2: "#2A2620", s3: "#332F28",
    ink: "#E8E2D6", ink2: "#A09888", ink3: "#6B6258",
    bdr: "#302B25", acc: "#D4956B", accText: "#131210", accSoft: "#D4956B20",
  };

  // ── Curator workspace: cooler, blue-shifted ──
  const W = {
    bg: "#101214", s: "#181B20", s2: "#1F2329", bdr: "#262B33",
    aiBub: "#181B20", aiBdr: "#3B7BF6", aiBdrSoft: "#3B7BF620",
    userBub: T.acc, userTxt: "#101214",
    accent: "#6B9EC2", accentSoft: "#6B9EC220",
    chip: "#181B20", chipBdr: "#262B33",
    inputBg: "#181B20", inputBdr: "#262B33",
  };

  // ── Visitor AI: warm, personal ──
  const V = {
    bg: "#151310", s: "#1E1A15", bdr: "#302A22",
    aiBub: "#1E1A15", userBub: "#A09888", userTxt: "#151310",
    chip: "#1E1A15", chipBdr: "#302A22",
    inputBg: "#1E1A15", inputBdr: "#302A22",
  };

  const curatorBubble = (msg) => ({
    maxWidth: "82%", padding: msg.role === "user" ? "12px 16px" : "14px 18px",
    borderRadius: msg.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
    background: msg.role === "user" ? W.userBub : W.aiBub,
    color: msg.role === "user" ? W.userTxt : T.ink,
    fontSize: 14, lineHeight: 1.55, fontFamily: F,
    fontWeight: msg.role === "user" ? 500 : 400,
    border: msg.role === "user" ? "none" : `1px solid ${W.bdr}`,
  });

  const visitorBubble = (msg) => ({
    maxWidth: "82%", padding: msg.role === "user" ? "12px 16px" : "14px 18px",
    borderRadius: msg.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
    background: msg.role === "user" ? V.userBub : V.aiBub,
    color: msg.role === "user" ? V.userTxt : T.ink,
    fontSize: 14, lineHeight: 1.55, fontFamily: F,
    fontWeight: msg.role === "user" ? 500 : 400,
    border: "none",
    boxShadow: msg.role === "user" ? "none" : `inset 0 0 0 1px ${V.bdr}`,
  });

  // What screen to show?
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
  const newRequests = requests.filter(r => r.status === "new");
  const repliedRequests = requests.filter(r => r.status === "replied");
  const autoRequests = requests.filter(r => r.status === "auto");

  const F = "'Manrope',sans-serif";
  const S = "'Newsreader',serif";
  const MN = "'JetBrains Mono',monospace";

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

        {/* ══════════════════════════════════════════ */}
        {/* ════════ PROFILE PAGE ════════════════════ */}
        {/* Shown for visitors (default) and curators  */}
        {/* when on Profile tab                        */}
        {/* ══════════════════════════════════════════ */}
        {showingProfile && (
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>

            {/* Curator edit banner */}
            {mode === "curator" && (
              <div style={{
                margin: "48px 16px 0", padding: "12px 16px", borderRadius: 12,
                background: T.acc + "15", border: `1px solid ${T.acc}30`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontFamily: F, fontSize: 13, color: T.acc, fontWeight: 500 }}>
                  This is your public profile
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={shareProfile} style={{
                    background: "none", border: `1px solid ${T.acc}50`, borderRadius: 8, padding: "6px 14px",
                    cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 600, color: T.acc,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>{profileCopied ? "Copied ✓" : "Share ↗"}</button>
                  <button onClick={() => setSubScreen("editProfile")} style={{
                    background: T.acc, border: "none", borderRadius: 8, padding: "6px 14px",
                    cursor: "pointer", fontFamily: F, fontSize: 12, fontWeight: 700, color: T.accText,
                  }}>Edit</button>
                </div>
              </div>
            )}

            {/* Visitor top bar */}
            {mode === "visitor" && (
              <div style={{ padding: "48px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: S, fontSize: 15, color: T.ink3 }}>curators</span>
                <button onClick={() => switchMode("curator")} style={{ background: "none", border: "1px solid " + T.bdr, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: MN, fontSize: 9, color: T.ink3 }}>log in →</button>
              </div>
            )}

            {/* Hero */}
            <div style={{ padding: mode === "curator" ? "20px 24px 0" : "36px 24px 0", textAlign: "center" }}>
              <div style={{
                width: 92, height: 92, borderRadius: 26, margin: "0 auto 18px",
                background: `linear-gradient(145deg, ${T.s2}, ${T.s})`,
                border: `2px solid ${T.bdr}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 8px 32px rgba(0,0,0,0.3)`,
              }}>
                <span style={{ fontFamily: S, fontSize: 38, color: T.acc, fontWeight: 400 }}>{profile.name[0]}</span>
              </div>
              <h1 style={{ fontFamily: S, fontSize: 34, color: T.ink, fontWeight: 400, lineHeight: 1.1, marginBottom: 6 }}>{profile.name}</h1>
              <p style={{ fontFamily: F, fontSize: 13, color: T.ink3, marginBottom: 14 }}>
                {profile.handle}
              </p>
              <p style={{ fontFamily: F, fontSize: 14, color: T.ink2, lineHeight: 1.65, maxWidth: 300, margin: "0 auto" }}>
                {profile.bio}
              </p>
            </div>

            {/* Taste spectrum */}
            <div style={{ padding: "24px 28px 0" }}>
              <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", height: 4, background: T.s2 }}>
                {topCats.map(cat => {
                  const c = CAT[cat] || CAT.other;
                  return <div key={cat} style={{ width: `${((cc[cat] || 0) / n) * 100}%`, background: c.color, minWidth: 3 }} />;
                })}
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                {topCats.map(cat => {
                  const c = CAT[cat] || CAT.other;
                  return (
                    <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: T.ink2, fontFamily: F }}>
                      <span style={{ width: 5, height: 5, borderRadius: 3, background: c.color }} />
                      {cc[cat]} {c.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Two action cards */}
            <div style={{ padding: "12px 20px 0", display: "flex", gap: 10 }}>
              {profile.aiEnabled && (
                <button onClick={openVisitorAI} style={{
                  flex: 1, padding: "22px 16px", borderRadius: 18, border: "1px solid " + T.bdr, cursor: "pointer", textAlign: "left",
                  background: `linear-gradient(160deg, ${T.s2}, ${T.s})`, position: "relative", overflow: "hidden",
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: T.accSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 18 }}>🧠</span>
                  </div>
                  <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>
                    Ask {profile.name}'s AI
                  </div>
                  <div style={{ fontFamily: F, fontSize: 11, color: T.ink2, lineHeight: 1.45 }}>
                    Get streams of their new recommendations
                  </div>
                  <div style={{ position: "absolute", top: 18, right: 18, width: 7, height: 7, borderRadius: 4, background: T.acc, animation: "breathe 3s ease-in-out infinite" }} />
                </button>
              )}
              <button onClick={() => { setSubScreen("request"); setRequestSent(false); setRequestText(""); setRequestCat(null); }} style={{
                flex: 1, padding: "22px 16px", borderRadius: 18, border: "1px solid " + T.bdr,
                background: T.s, cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#9B8BC215", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>🙏</span>
                </div>
                <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Request a rec</div>
                <div style={{ fontFamily: F, fontSize: 11, color: T.ink2, lineHeight: 1.45 }}>
                  Ask {profile.name} directly for a recommendation
                </div>
              </button>
            </div>

            {/* Taste preview */}
            <div style={{ padding: "28px 20px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em" }}>
                  What {profile.name} recommends
                </span>
                <div style={{ display: "flex", gap: 2, background: T.s, borderRadius: 8, padding: 2 }}>
                  {["recent", "categories"].map(tab => (
                    <button key={tab} onClick={() => setProfileTab(tab)} style={{
                      padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: profileTab === tab ? T.s2 : "transparent", color: profileTab === tab ? T.ink : T.ink3,
                      fontSize: 10, fontWeight: 600, fontFamily: F,
                    }}>{tab === "recent" ? "Recent" : "By Category"}</button>
                  ))}
                </div>
              </div>

              {profileTab === "recent" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.filter(i => mode === "curator" || i.visibility === "public").slice(0, 6).map((item, i) => {
                    const c = CAT[item.category] || CAT.other;
                    return (
                      <div key={item.id} className="fu" onClick={() => { setSelectedItem(item); setSubScreen("visitorItem"); }} style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "14px 15px",
                        background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, animationDelay: `${i * .05}s`,
                        cursor: "pointer", transition: "border-color .15s",
                      }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{c.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: T.ink2, fontFamily: F, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.context}</div>
                        </div>
                        <span style={{ color: T.ink3, fontSize: 14, flexShrink: 0 }}>›</span>
                      </div>
                    );
                  })}
                  {items.length > 6 && (
                    <button onClick={openVisitorAI} style={{ padding: "14px", borderRadius: 14, border: `1px dashed ${T.bdr}`, background: "none", cursor: "pointer", fontFamily: F, fontSize: 13, color: T.ink2, fontWeight: 500, textAlign: "center" }}>
                      + {items.length - 6} more — ask the AI →
                    </button>
                  )}
                </div>
              )}

              {profileTab === "categories" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {topCats.map((cat, i) => {
                    const c = CAT[cat] || CAT.other;
                    const ci = items.filter(x => x.category === cat);
                    return (
                      <div key={cat} className="fu" style={{ padding: "16px", background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, animationDelay: `${i * .06}s` }}>
                        <div style={{ fontSize: 22, marginBottom: 8 }}>{c.emoji}</div>
                        <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{c.label}</div>
                        <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginBottom: 8 }}>{cc[cat]} rec{cc[cat] !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: 12, color: T.ink2, fontFamily: F, lineHeight: 1.4 }}>
                          {ci.slice(0, 2).map(x => x.title).join(", ")}{ci.length > 2 ? `, +${ci.length - 2}` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pull quote */}
            <div style={{ padding: "28px 20px 20px" }}>
              <div style={{ background: T.s, borderRadius: 16, padding: "22px 20px", borderLeft: `3px solid ${T.acc}` }}>
                <div style={{ fontFamily: S, fontSize: 17, fontStyle: "italic", color: T.ink, lineHeight: 1.55, marginBottom: 8 }}>
                  "{items[3]?.context}"
                </div>
                <div style={{ fontSize: 12, color: T.ink3, fontFamily: F }}>— on {items[3]?.title}</div>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ CURATOR: MY AI CHAT ═════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingCuratorChat && (
          <>
            {/* Workspace header */}
            <div style={{ padding: "48px 20px 14px", background: W.bg, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderBottom: `1px solid ${W.bdr}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: W.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${W.accent}30` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: W.accent, fontFamily: F }}>C</span>
                </div>
                <div>
                  <div style={{ fontFamily: F, fontSize: 16, color: T.ink, fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em" }}>My AI</div>
                  <div style={{ fontSize: 10, color: T.ink3, fontFamily: MN, fontWeight: 400, marginTop: 3 }}>{n} recs · {cats.length} categories</div>
                </div>
              </div>
              <button onClick={() => { setSubScreen("taste"); setFilterCat(null); }} style={{
                background: W.s, border: `1px solid ${W.bdr}`, borderRadius: 10, width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative",
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke={T.ink3} strokeWidth="1.5" /><rect x="9" y="1" width="6" height="6" rx="1.5" stroke={T.ink3} strokeWidth="1.5" /><rect x="1" y="9" width="6" height="6" rx="1.5" stroke={T.ink3} strokeWidth="1.5" /><rect x="9" y="9" width="6" height="6" rx="1.5" stroke={T.ink3} strokeWidth="1.5" /></svg>
                <div style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: 7, background: W.accent, color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
              </button>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, background: W.bg }}>
              <div ref={chatScrollRef} onScroll={() => { const el = chatScrollRef.current; if (el) setShowScrollBtn(el.scrollTop < el.scrollHeight - el.clientHeight - 100); }} style={{ flex: 1, overflowY: "auto", padding: "12px 16px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
                {messages.map((msg, i) => {
                  // Request alert card
                  if (msg.type === "requestAlert") {
                    return (
                      <div key={i} className="fu" style={{ marginBottom: 12, animationDelay: `${i * .03}s` }}>
                        <button onClick={() => setSubScreen("requests")} style={{
                          width: "100%", padding: "16px", borderRadius: 16, border: `1px solid ${W.bdr}`,
                          background: W.s, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14,
                        }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 18 }}>📩</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: T.ink }}>{msg.count} new request{msg.count !== 1 ? "s" : ""}</div>
                            <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>
                              {newRequests.slice(0, 2).map(r => r.from).join(", ")}{newRequests.length > 2 ? ` +${newRequests.length - 2} more` : ""} — tap to review
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#EF4444", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{msg.count}</span>
                            <span style={{ color: T.ink3, fontSize: 14 }}>›</span>
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
                              <div style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: "#6BAA8E18",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <span style={{ fontSize: 16 }}>☕</span>
                              </div>
                              <div>
                                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: T.ink }}>{msg.from}</div>
                                <div style={{ fontFamily: F, fontSize: 10, color: T.ink3, marginTop: 1 }}>{msg.time}</div>
                              </div>
                            </div>
                            <div style={{
                              padding: "6px 14px", borderRadius: 10,
                              background: "#6BAA8E20", border: `1px solid #6BAA8E30`,
                            }}>
                              <span style={{ fontFamily: MN, fontSize: 16, fontWeight: 700, color: "#6BAA8E" }}>{"$"}{msg.amount}</span>
                            </div>
                          </div>
                          {msg.message && (
                            <div style={{
                              padding: "12px 16px", borderRadius: 12,
                              background: W.s, border: `1px solid ${W.bdr}`,
                              marginBottom: 10,
                            }}>
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
                      <div style={{ maxWidth: "82%" }}>
                        <div style={curatorBubble(msg)}>{msg.role === "ai" ? renderMd(msg.text) : msg.text}</div>
                        {msg.capturedRec && !msg.saved && !editingCapture && (
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button onClick={() => {
                              const newItem = {
                                id: Date.now(),
                                slug: msg.capturedRec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                                title: msg.capturedRec.title,
                                category: msg.capturedRec.category || "other",
                                context: msg.capturedRec.context,
                                tags: msg.capturedRec.tags,
                                date: new Date().toISOString().split("T")[0],
                                visibility: "public",
                                revision: 1,
                                earnableMode: "none",
                                links: editingCapture?.links?.length > 0 ? editingCapture.links : (pendingLink ? [{ type: pendingLink.source?.toLowerCase() || "website", url: pendingLink.url, label: pendingLink.title }] : []),
                                revisions: [{ rev: 1, date: new Date().toISOString().split("T")[0], change: "Created" }]
                              };
                              saveRecToDb(newItem).then(saved => setTasteItems(prev => [saved, ...prev]));
                              setMessages(prev => [...prev.map((m, idx) => idx === i ? { ...m, saved: true } : m), { role: "ai", text: "✓ Saved. What else?" }]);
                              saveMsgToDb("ai", "✓ Saved. What else?");
                              setPendingLink(null);
                            }} style={{
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
                          <div style={{ marginTop: 12, padding: 16, background: T.s, borderRadius: 14, border: "1px solid " + T.bdr }}>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Title</div>
                              <input value={editingCapture.title} onChange={e => setEditingCapture(p => ({ ...p, title: e.target.value }))}
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + T.bdr, fontSize: 14, fontFamily: F, background: T.bg, color: T.ink, outline: "none" }}
                              />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Context</div>
                              <textarea value={editingCapture.context} onChange={e => setEditingCapture(p => ({ ...p, context: e.target.value }))} rows={2}
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + T.bdr, fontSize: 14, fontFamily: F, background: T.bg, color: T.ink, outline: "none", resize: "none" }}
                              />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Category</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {["restaurant", "book", "music", "tv", "film", "travel", "product", "other"].map(cat => (
                                  <button key={cat} onClick={() => setEditingCapture(p => ({ ...p, category: cat }))}
                                    style={{
                                      padding: "6px 12px", borderRadius: 8, border: editingCapture.category === cat ? "none" : "1px solid " + T.bdr,
                                      background: editingCapture.category === cat ? T.acc : T.bg, color: editingCapture.category === cat ? "#fff" : T.ink2,
                                      fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: F, textTransform: "capitalize"
                                    }}>{cat}</button>
                                ))}
                              </div>
                            </div>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Tags</div>
                              <input value={editingCapture.tags?.join(", ") || ""} onChange={e => setEditingCapture(p => ({ ...p, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
                                placeholder="Comma separated"
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid " + T.bdr, fontSize: 14, fontFamily: F, background: T.bg, color: T.ink, outline: "none" }}
                              />
                            </div>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, fontFamily: F }}>Links</div>
                              {(editingCapture.links || (pendingLink ? [pendingLink] : [])).map((link, i) => (
                                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                                  <input value={link.label || link.title || link.url} readOnly
                                    style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid " + T.bdr, fontSize: 12, fontFamily: F, background: T.s, color: T.ink, outline: "none" }}
                                  />
                                  <button onClick={() => {
                                    const links = editingCapture.links || [];
                                    setEditingCapture(p => ({ ...p, links: links.filter((_, idx) => idx !== i) }));
                                    if (pendingLink && i === 0 && links.length === 0) setPendingLink(null);
                                  }} style={{
                                    padding: "8px 10px", borderRadius: 6, border: "1px solid " + T.bdr,
                                    background: T.s, color: T.ink3, fontSize: 10, cursor: "pointer"
                                  }}>✕</button>
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
                                  setEditingCapture(p => ({ ...p, links: [...(p.links || []), newLink] }));
                                } catch (e) {
                                  setEditingCapture(p => ({ ...p, links: [...(p.links || []), { type: "website", url, label: url }] }));
                                }
                              }} style={{
                                padding: "8px 10px", borderRadius: 6, border: "1px dashed " + T.bdr,
                                background: "transparent", color: T.ink3, fontSize: 11, cursor: "pointer", fontFamily: F,
                                width: "100%", textAlign: "center"
                              }}>+ Add link</button>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={() => {
                                const newItem = {
                                  id: Date.now(),
                                  slug: editingCapture.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                                  title: editingCapture.title,
                                  category: editingCapture.category || "other",
                                  context: editingCapture.context,
                                  tags: editingCapture.tags || [],
                                  date: new Date().toISOString().split("T")[0],
                                  visibility: "public",
                                  revision: 1,
                                  earnableMode: "none",
                                  links: editingCapture?.links?.length > 0 ? editingCapture.links : (pendingLink ? [{ type: pendingLink.source?.toLowerCase() || "website", url: pendingLink.url, label: pendingLink.title }] : []),
                                  revisions: [{ rev: 1, date: new Date().toISOString().split("T")[0], change: "Created" }]
                                };
                                saveRecToDb(newItem).then(saved => setTasteItems(prev => [saved, ...prev]));
                                setMessages(prev => [...prev.map((m, idx) => idx === editingCapture.msgIndex ? { ...m, saved: true } : m), { role: "ai", text: "✓ Saved. What else?" }]);
                                saveMsgToDb("ai", "✓ Saved. What else?");
                                setEditingCapture(null);
                                setPendingLink(null);
                              }} style={{
                                padding: "8px 16px", borderRadius: 10, border: "none",
                                background: T.acc, color: "#fff", fontSize: 13, fontWeight: 600,
                                cursor: "pointer", fontFamily: F
                              }}>Save</button>
                              <button onClick={() => setEditingCapture(null)} style={{
                                padding: "8px 16px", borderRadius: 10, border: "1px solid " + T.bdr,
                                background: T.bg, color: T.ink2, fontSize: 13, fontWeight: 500,
                                cursor: "pointer", fontFamily: F
                              }}>Cancel</button>
                            </div>
                          </div>
                        )}
                        {msg.saved && false && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#6BAA8E", fontFamily: F, fontWeight: 600 }}>✓ Saved to your recommendations</div>
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
                {showScrollBtn && <button onClick={() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollBtn(false); }} style={{ position: "sticky", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 36, height: 36, borderRadius: 18, background: W.s2, border: "1px solid " + W.bdr, color: T.ink2, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", zIndex: 10 }}>↓</button>}
              </div>
              <div style={{ padding: "10px 16px 28px", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
                    placeholder="Drop a rec, paste a link, or ask anything..."
                    style={{ flex: 1, padding: "14px 18px", borderRadius: 24, border: `1.5px solid ${W.inputBdr}`, fontSize: 15, fontFamily: F, outline: "none", background: W.inputBg, color: T.ink }}
                    onFocus={e => e.target.style.borderColor = W.accent} onBlur={e => e.target.style.borderColor = W.inputBdr}
                  />
                  <button onClick={send} style={{ width: 46, height: 46, borderRadius: 23, border: "none", background: input.trim() ? T.acc : W.bdr, color: input.trim() ? T.accText : T.ink3, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0, fontWeight: 600 }}>↑</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ VISITOR AI CHAT ═════════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingVisitorAI && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, background: V.bg }}>
            {/* Branded header with curator identity */}
            <div style={{ padding: "48px 20px 12px", background: V.bg, flexShrink: 0, borderBottom: `1px solid ${V.bdr}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={closeSubScreen} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Profile</button>
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
                  <div style={visitorBubble(msg)}>{msg.role === "ai" ? renderMd(msg.text) : msg.text}</div>
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
            <div style={{ padding: "4px 16px 6px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
              {[
                { label: "🎧 Radio", prompt: "Play me a radio station from the music recs" },
                { label: "✨ Newest", prompt: "What are the newest recommendations?" },
                { label: "🔥 Most Popular", prompt: "What are the most popular picks?" },
                { label: "📖 Books", prompt: "Show me book recommendations" },
                { label: "🎵 Music", prompt: "What music do you recommend?" },
                { label: "🍽 Restaurants", prompt: "What are the restaurant recommendations?" },
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
                <button onClick={send} style={{ width: 46, height: 46, borderRadius: 23, border: "none", background: input.trim() ? T.acc : V.bdr, color: input.trim() ? T.accText : T.ink3, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0, fontWeight: 600 }}>↑</button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ REQUEST SCREEN ══════════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingRequest && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <div style={{ padding: "52px 20px 14px", flexShrink: 0 }}>
              <button onClick={closeSubScreen} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
            </div>
            <div style={{ flex: 1, padding: "0 24px", overflowY: "auto", overscrollBehavior: "contain", minHeight: 0 }}>
              {!requestSent ? (
                <div className="fu">
                  <h2 style={{ fontFamily: S, fontSize: 26, color: T.ink, fontWeight: 400, marginBottom: 6 }}>Ask {profile.name} for a rec</h2>
                  <p style={{ fontSize: 13, color: T.ink2, fontFamily: F, lineHeight: 1.6, marginBottom: 28 }}>Be specific. {profile.name} personally reviews every request.</p>
                  <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Category</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
                    {["restaurant", "music", "book", "tv", "travel", "product"].map(cat => {
                      const c = CAT[cat]; const sel = requestCat === cat;
                      return <button key={cat} onClick={() => setRequestCat(sel ? null : cat)} style={{ padding: "8px 14px", borderRadius: 20, border: "none", background: sel ? c.color : c.bg, color: sel ? "#fff" : c.color, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F }}>{c.emoji} {c.label}</button>;
                    })}
                  </div>
                  <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Your request</div>
                  <textarea value={requestText} onChange={e => setRequestText(e.target.value)} placeholder={`e.g. "Great cocktails, not too loud, first date vibe"`} rows={4}
                    style={{ width: "100%", padding: "16px", borderRadius: 14, border: `1.5px solid ${T.bdr}`, fontSize: 14, fontFamily: F, outline: "none", resize: "none", background: T.s, color: T.ink, lineHeight: 1.6 }}
                  />
                  <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, marginTop: 20 }}>Your email</div>
                  <input placeholder="you@email.com" type="email" style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${T.bdr}`, fontSize: 14, fontFamily: F, outline: "none", background: T.s, color: T.ink }} />
                  <button onClick={() => { if (requestText.trim()) setRequestSent(true); }} style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", marginTop: 20, background: requestText.trim() ? T.acc : T.bdr, color: requestText.trim() ? T.accText : T.ink3, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F, transition: "all .2s" }}>Send request</button>
                  <p style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 10, textAlign: "center" }}>Free · Subscribers get priority</p>
                </div>
              ) : (
                <div className="fu" style={{ textAlign: "center", paddingTop: 60 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 26, background: T.accSoft, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: T.acc, fontSize: 24 }}>✓</span></div>
                  <h2 style={{ fontFamily: S, fontSize: 22, color: T.ink, fontWeight: 400, marginBottom: 8 }}>Request sent</h2>
                  <p style={{ fontSize: 14, color: T.ink2, fontFamily: F, lineHeight: 1.6, maxWidth: 260, margin: "0 auto 28px" }}>{profile.name} will send a personal recommendation.</p>
                  <button onClick={closeSubScreen} style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: T.acc, color: T.accText, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F }}>Back to profile</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ EDIT PROFILE ════════════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingEditProfile && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <div style={{ padding: "52px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <button onClick={closeSubScreen} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Cancel</button>
              <button onClick={closeSubScreen} style={{ background: T.acc, border: "none", borderRadius: 10, padding: "8px 18px", cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 700, color: T.accText }}>Save</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px 40px", WebkitOverflowScrolling: "touch" }}>
              <h2 style={{ fontFamily: S, fontSize: 26, color: T.ink, fontWeight: 400, marginBottom: 4 }}>Edit Profile</h2>
              <p style={{ fontSize: 13, color: T.ink3, fontFamily: F, lineHeight: 1.5, marginBottom: 28 }}>This is what visitors see on your public page.</p>

              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ width: 76, height: 76, borderRadius: 22, margin: "0 auto 10px", background: T.s, border: `2px solid ${T.bdr}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <span style={{ fontFamily: S, fontSize: 30, color: T.acc }}>{profile.name[0]}</span>
                </div>
                <button style={{ background: "none", border: "none", color: T.acc, fontSize: 13, fontFamily: F, fontWeight: 600, cursor: "pointer" }}>Change photo</button>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 8 }}>Display name</label>
                <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${T.bdr}`, fontSize: 15, fontFamily: F, outline: "none", background: T.s, color: T.ink }} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 8 }}>Username</label>
                <input value={profile.handle} onChange={e => setProfile(p => ({ ...p, handle: e.target.value }))} style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${T.bdr}`, fontSize: 15, fontFamily: F, outline: "none", background: T.s, color: T.ink }} />
                <p style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 6 }}>curators.com/{profile.handle.replace("@", "")}</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: F, fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 8 }}>Bio</label>
                <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} rows={3}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${T.bdr}`, fontSize: 14, fontFamily: F, outline: "none", resize: "none", background: T.s, color: T.ink, lineHeight: 1.6 }}
                />
                <p style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 6, textAlign: "right" }}>{profile.bio.length}/160</p>
              </div>

              {/* ── Section: Profile display ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Profile Display</div>

              <div style={{ background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>Show recommendations</div>
                    <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>Display public recs on your profile</div>
                  </div>
                  <button onClick={() => setProfile(p => ({ ...p, showRecs: !p.showRecs }))} style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                    background: profile.showRecs ? T.acc : T.bdr, transition: "background .2s",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: profile.showRecs ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
                {!profile.showRecs && (
                  <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${T.bdr}` }}>
                    <p style={{ fontSize: 12, color: T.ink2, fontFamily: F, marginTop: 12, lineHeight: 1.5 }}>
                      Your profile will only show your bio, AI, and subscription options. Visitors can still ask your AI about your recs.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Section: Interactions ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Interactions</div>

              <div style={{ background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: `1px solid ${T.bdr}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>Public AI access</div>
                    <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>Let visitors chat with your taste AI</div>
                  </div>
                  <button onClick={() => setProfile(p => ({ ...p, aiEnabled: !p.aiEnabled }))} style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                    background: profile.aiEnabled ? T.acc : T.bdr, transition: "background .2s",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: profile.aiEnabled ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>Accept requests</div>
                    <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>Let visitors request personal curations</div>
                  </div>
                  <button onClick={() => setProfile(p => ({ ...p, acceptRequests: !p.acceptRequests }))} style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                    background: profile.acceptRequests ? T.acc : T.bdr, transition: "background .2s",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: profile.acceptRequests ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
              </div>

              {/* ── Section: Wallet & Crypto ── */}
              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Wallet & Crypto</div>

              <div style={{ background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>Accept crypto</div>
                    <div style={{ fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2 }}>Enable tips and licensing payments in crypto</div>
                  </div>
                  <button onClick={() => setProfile(p => ({ ...p, cryptoEnabled: !p.cryptoEnabled }))} style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
                    background: profile.cryptoEnabled ? T.acc : T.bdr, transition: "background .2s",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: profile.cryptoEnabled ? 23 : 3, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
                {profile.cryptoEnabled && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${T.bdr}` }}>
                    <label style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 8, marginTop: 12 }}>Wallet address</label>
                    <input value={profile.walletFull} onChange={e => setProfile(p => ({ ...p, walletFull: e.target.value, wallet: e.target.value.slice(0, 6) + "..." + e.target.value.slice(-4) }))}
                      placeholder="0x..."
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${T.bdr}`, fontSize: 12, fontFamily: MN, outline: "none", background: T.bg, color: T.ink }}
                    />
                    <p style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 8, lineHeight: 1.5 }}>
                      This wallet receives all crypto payments across your recommendations — tips, licensing fees, and bundle purchases. One address, all recs.
                    </p>
                    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                      {["ETH", "USDC", "SOL"].map(chain => (
                        <div key={chain} style={{ padding: "6px 12px", borderRadius: 8, background: T.bg, border: "1px solid " + T.bdr, fontFamily: MN, fontSize: 11, color: T.ink2, fontWeight: 600 }}>{chain}</div>
                      ))}
                      <div style={{ padding: "6px 12px", borderRadius: 8, background: T.bg, border: `1px dashed ${T.bdr}`, fontFamily: F, fontSize: 11, color: T.ink3, cursor: "pointer" }}>+ More</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ REQUESTS PANEL ═══════════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingRequests && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
            <div style={{ padding: "52px 20px 14px", flexShrink: 0, borderBottom: `1px solid ${W.bdr}`, background: W.bg }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <button onClick={closeSubScreen} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← My AI</button>
              </div>
              <h2 style={{ fontFamily: S, fontSize: 26, color: T.ink, fontWeight: 400, marginBottom: 4 }}>Requests</h2>
              <p style={{ fontSize: 13, color: T.ink3, fontFamily: F, marginBottom: 14 }}>People asking for your taste. AI drafts responses — you approve or edit.</p>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { id: "all", label: "All", count: requests.length },
                  { id: "new", label: "New", count: newRequests.length },
                  { id: "replied", label: "Replied", count: repliedRequests.length },
                  { id: "auto", label: "Auto", count: autoRequests.length },
                ].map(f => (
                  <button key={f.id} onClick={() => setRequestFilter(f.id)} style={{
                    padding: "6px 14px", borderRadius: 20, border: "none",
                    background: requestFilter === f.id ? W.accent : W.s,
                    color: requestFilter === f.id ? "#fff" : T.ink2,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    {f.label}
                    <span style={{ fontSize: 10, opacity: .7 }}>({f.count})</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", background: W.bg, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
              {(requestFilter === "all" ? requests : requests.filter(r => r.status === requestFilter)).map((req, i) => {
                const c = CAT[req.category] || CAT.other;
                const isNew = req.status === "new";
                const isReplied = req.status === "replied";
                const isAuto = req.status === "auto";
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(req.date).getTime();
                  const hrs = Math.floor(diff / 3600000);
                  if (hrs < 1) return "Just now";
                  if (hrs < 24) return `${hrs}h ago`;
                  const days = Math.floor(hrs / 24);
                  return days === 1 ? "Yesterday" : `${days}d ago`;
                })();
                return (
                  <button key={req.id} className="fu" onClick={() => { setActiveRequest(req); setRequestReply(""); setSubScreen("requestThread"); }}
                    style={{
                      width: "100%", padding: "16px", borderRadius: 16,
                      border: `1px solid ${isNew ? W.accent + "40" : W.bdr}`,
                      background: W.s, cursor: "pointer", textAlign: "left",
                      marginBottom: 8, animationDelay: `${i * .04}s`,
                      display: "flex", flexDirection: "column", gap: 10,
                    }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{c.emoji}</div>
                        <div>
                          <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: T.ink }}>{req.from}</div>
                          <div style={{ fontFamily: MN, fontSize: 10, color: T.ink3, marginTop: 1 }}>{req.handle}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, fontFamily: F,
                          background: isNew ? "#EF444418" : isReplied ? T.accSoft : W.accent + "15",
                          color: isNew ? "#EF4444" : isReplied ? T.acc : W.accent,
                        }}>{isNew ? "New" : isReplied ? "Replied" : "Auto"}</span>
                        <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>{timeAgo}</span>
                      </div>
                    </div>
                    <p style={{ fontFamily: F, fontSize: 14, color: T.ink, lineHeight: 1.5 }}>"{req.text}"</p>
                    {isNew && req.aiDraft && (
                      <div style={{ padding: "10px 12px", borderRadius: 10, background: W.accent + "10", border: `1px solid ${W.accent}20` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: W.accent, fontFamily: F, marginBottom: 4 }}>AI DRAFT READY</div>
                        <div style={{ fontSize: 12, color: T.ink2, fontFamily: F, lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{req.aiDraft.replace(/\*\*/g, "")}</div>
                      </div>
                    )}
                    {isReplied && <p style={{ fontFamily: F, fontSize: 12, color: T.ink2, lineHeight: 1.45 }}>You: "{req.reply}"</p>}
                    {isAuto && <p style={{ fontFamily: F, fontSize: 12, color: T.ink3, lineHeight: 1.45 }}>AI replied automatically</p>}
                  </button>
                );
              })}
              {(requestFilter === "all" ? requests : requests.filter(r => r.status === requestFilter)).length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 20px", color: T.ink3, fontSize: 13, fontFamily: F }}>No {requestFilter} requests yet.</div>
              )}
              <div style={{ height: 20 }} />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ REQUEST THREAD ═══════════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingRequestThread && activeRequest && (() => {
          const c = CAT[activeRequest.category] || CAT.other;
          const isNew = activeRequest.status === "new";
          return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, background: W.bg }}>
              <div style={{ padding: "52px 20px 14px", flexShrink: 0, borderBottom: `1px solid ${W.bdr}` }}>
                <button onClick={() => { setSubScreen("requests"); setActiveRequest(null); }} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Requests</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 20px", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", minHeight: 0 }}>
                {/* Request header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{c.emoji}</div>
                  <div>
                    <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: T.ink }}>{activeRequest.from}</div>
                    <div style={{ fontFamily: MN, fontSize: 11, color: T.ink3, marginTop: 2 }}>{activeRequest.handle} · {c.label}</div>
                  </div>
                </div>

                {/* The request */}
                <div style={{ padding: "18px 20px", background: W.s, borderRadius: 16, border: `1px solid ${W.bdr}`, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, fontFamily: F }}>Their request</div>
                  <p style={{ fontFamily: F, fontSize: 16, color: T.ink, lineHeight: 1.6 }}>{activeRequest.text}</p>
                </div>

                {/* AI draft */}
                {activeRequest.aiDraft && isNew && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: W.accent, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>✦</span> AI-drafted response
                    </div>
                    <div style={{ padding: "18px 20px", background: W.accent + "08", borderRadius: 16, border: `1px solid ${W.accent}20` }}>
                      <div style={{ fontFamily: F, fontSize: 14, color: T.ink, lineHeight: 1.65 }}>{renderMd(activeRequest.aiDraft)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={() => {
                        setRequests(rs => rs.map(r => r.id === activeRequest.id ? { ...r, status: "replied", reply: activeRequest.aiDraft.replace(/\*\*/g, "").slice(0, 100) + "..." } : r));
                        setActiveRequest(a => ({ ...a, status: "replied" }));
                      }} style={{
                        flex: 1, padding: "14px", borderRadius: 12, border: "none",
                        background: T.acc, color: T.accText, fontSize: 14, fontWeight: 700,
                        cursor: "pointer", fontFamily: F,
                      }}>Send as-is</button>
                      <button onClick={() => setRequestReply(activeRequest.aiDraft.replace(/\*\*/g, ""))} style={{
                        flex: 1, padding: "14px", borderRadius: 12,
                        border: `1.5px solid ${W.bdr}`, background: W.s,
                        color: T.ink, fontSize: 14, fontWeight: 600,
                        cursor: "pointer", fontFamily: F,
                      }}>Edit first</button>
                    </div>
                  </div>
                )}

                {/* Already replied */}
                {activeRequest.status === "replied" && activeRequest.reply && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.acc, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Your reply</div>
                    <div style={{ padding: "18px 20px", background: T.accSoft, borderRadius: 16, border: `1px solid ${T.acc}20` }}>
                      <p style={{ fontFamily: F, fontSize: 14, color: T.ink, lineHeight: 1.6 }}>{activeRequest.reply}</p>
                    </div>
                    <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 8 }}>✓ Sent{activeRequest.repliedAt ? ` · ${new Date(activeRequest.repliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>
                  </div>
                )}

                {/* Auto-replied */}
                {activeRequest.status === "auto" && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: W.accent, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Auto-replied by AI</div>
                    <div style={{ padding: "18px 20px", background: W.accent + "08", borderRadius: 16, border: `1px solid ${W.accent}20` }}>
                      <p style={{ fontFamily: F, fontSize: 14, color: T.ink, lineHeight: 1.6 }}>{renderMd(activeRequest.aiReply)}</p>
                    </div>
                    <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 8 }}>✦ Based on your recommendations</div>
                  </div>
                )}

                {/* Manual reply box (for new requests if editing) */}
                {isNew && requestReply && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Your reply</div>
                    <textarea value={requestReply} onChange={e => setRequestReply(e.target.value)} rows={4}
                      style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${W.bdr}`, fontSize: 14, fontFamily: F, outline: "none", resize: "none", background: W.s, color: T.ink, lineHeight: 1.6 }}
                    />
                    <button onClick={() => {
                      setRequests(rs => rs.map(r => r.id === activeRequest.id ? { ...r, status: "replied", reply: requestReply.slice(0, 100) + (requestReply.length > 100 ? "..." : "") } : r));
                      setActiveRequest(a => ({ ...a, status: "replied", reply: requestReply }));
                      setRequestReply("");
                    }} style={{
                      width: "100%", padding: "14px", borderRadius: 12, border: "none", marginTop: 10,
                      background: requestReply.trim() ? T.acc : W.bdr, color: requestReply.trim() ? T.accText : T.ink3,
                      fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: F,
                    }}>Send reply</button>
                  </div>
                )}

                {/* Quick reply for new requests without editing */}
                {isNew && !requestReply && !activeRequest.aiDraft && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Write a reply</div>
                    <textarea value={requestReply} onChange={e => setRequestReply(e.target.value)} rows={3}
                      placeholder="Type your recommendation..."
                      style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${W.bdr}`, fontSize: 14, fontFamily: F, outline: "none", resize: "none", background: W.s, color: T.ink, lineHeight: 1.6 }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ TASTE LIBRARY ═══════════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingTaste && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, position: "relative" }}>
            <div style={{ padding: "52px 20px 14px", flexShrink: 0 }}>
              <button onClick={closeSubScreen} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
            </div>
            <div style={{ padding: "4px 20px 12px" }}>
              <h2 style={{ fontFamily: S, fontSize: 28, color: T.ink, fontWeight: 400, marginBottom: 4 }}>Your Taste</h2>
              <p style={{ fontSize: 13, color: T.ink3, fontFamily: F }}>Everything your AI knows. Remove to update instantly.</p>
            </div>
            <div style={{ padding: "0 20px 12px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
              <button onClick={() => setFilterCat(null)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: !filterCat ? T.acc : T.s, color: !filterCat ? T.accText : T.ink2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap" }}>All ({activeN})</button>
              {cats.map(cat => { const ct = CAT[cat]; return <button key={cat} onClick={() => setFilterCat(filterCat === cat ? null : cat)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: filterCat === cat ? T.acc : T.s, color: filterCat === cat ? T.accText : T.ink2, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap" }}>{ct.emoji} ({cc[cat]})</button>; })}
              {archivedItems.length > 0 && (
                <button onClick={() => setFilterCat(filterCat === "archived" ? null : "archived")} style={{ padding: "6px 14px", borderRadius: 20, border: "none", background: filterCat === "archived" ? T.ink3 : T.s, color: filterCat === "archived" ? "#fff" : T.ink3, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: F, whiteSpace: "nowrap" }}>{"🗄"} ({archivedItems.length})</button>
              )}
            </div>

            {/* Earnings Card */}
            {mode === "curator" && !earningsDrill && (
              <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
                <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid " + T.bdr, background: T.s }}>
                  <button onClick={() => setEarningsExpanded(!earningsExpanded)} style={{ width: "100%", padding: "14px 16px", border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: MN, fontSize: 20, fontWeight: 700, color: T.ink }}>{"$"}{EARNINGS.total.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: T.ink3, fontFamily: F }}>earned</span>
                    </div>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {Object.values(EARNINGS.streams).filter(function(s) { return s.amount > 0; }).map(function(s) { return <span key={s.label} style={{ fontSize: 10 }}>{s.icon}</span>; })}
                    </div>
                    <span style={{ fontSize: 14, color: T.ink3, transition: "transform .2s", transform: earningsExpanded ? "rotate(180deg)" : "rotate(0)" }}>{"▾"}</span>
                  </button>
                  {earningsExpanded && (
                    <div className="fu" style={{ padding: "0 16px 18px" }}>
                      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
                        {Object.entries(EARNINGS.streams).map(function(entry) { return <div key={entry[0]} style={{ width: ((entry[1].amount / EARNINGS.total) * 100) + "%", background: entry[1].color, transition: "width .3s" }} />; })}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                        {Object.entries(EARNINGS.streams).map(function(entry) { var key = entry[0]; var s = entry[1]; return (
                          <button key={key} onClick={function() { setEarningsDrill(key); }} style={{ padding: "14px", borderRadius: 14, border: "1px solid " + T.bdr, background: T.bg, cursor: "pointer", textAlign: "left" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <span style={{ fontSize: 14 }}>{s.icon}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: T.ink2, fontFamily: F }}>{s.label}</span>
                            </div>
                            <div style={{ fontFamily: MN, fontSize: 22, fontWeight: 700, color: T.ink, marginBottom: 3 }}>{"$"}{s.amount}</div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 10, color: s.color, fontFamily: F, fontWeight: 600 }}>{s.trend}</span>
                              <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>{s.count} {key === "tips" ? "people" : key === "subs" ? "active" : key === "license" ? "deals" : "sold"}</span>
                            </div>
                          </button>
                        ); })}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, fontFamily: F, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Top earning recs</div>
                      {EARNINGS.topRecs.map(function(rec, i) {
                        var rc = CAT[rec.category] || CAT.other;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < EARNINGS.topRecs.length - 1 ? "1px solid " + T.bdr : "none" }}>
                            <span style={{ fontSize: 14 }}>{rc.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.title}</div>
                              <div style={{ fontSize: 10, color: T.ink3, fontFamily: F, marginTop: 2 }}>{rec.sources}</div>
                            </div>
                            <span style={{ fontFamily: MN, fontSize: 14, fontWeight: 700, color: "#6BAA8E" }}>{"$"}{rec.earned}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Earnings drill-down */}
            {mode === "curator" && earningsDrill && (
              <div style={{ padding: "0 20px 12px", flexShrink: 0 }}>
                <div style={{ borderRadius: 16, border: "1px solid " + T.bdr, background: T.s, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid " + T.bdr }}>
                    <button onClick={function() { setEarningsDrill(null); }} style={{ background: "none", border: "none", color: T.acc, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F, padding: 0 }}>{"← Earnings"}</button>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 14 }}>{EARNINGS.streams[earningsDrill].icon}</span>
                    <span style={{ fontFamily: MN, fontSize: 18, fontWeight: 700, color: T.ink }}>{"$"}{EARNINGS.streams[earningsDrill].amount}</span>
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, fontFamily: F, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Recent {EARNINGS.streams[earningsDrill].label.toLowerCase()}</div>
                    {(EARNINGS.transactions[earningsDrill] || []).map(function(tx, i, arr) { return (
                      <div key={i} style={{ padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid " + T.bdr : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: tx.message ? 6 : 0 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: F }}>{tx.from}</span>
                            <span style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginLeft: 8 }}>{tx.rec}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: MN, fontSize: 14, fontWeight: 700, color: EARNINGS.streams[earningsDrill].color }}>{"$"}{tx.amount}</span>
                            <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>{tx.time}</span>
                          </div>
                        </div>
                        {tx.message ? <p style={{ fontSize: 12, color: T.ink2, fontFamily: F, fontStyle: "italic", lineHeight: 1.4 }}>“{tx.message}”</p> : null}
                      </div>
                    ); })}
                  </div>
                </div>
              </div>
            )}

            {/* Timeline list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", WebkitOverflowScrolling: "touch" }}>
              {filterCat === "archived" && (
                <div style={{ padding: "8px 4px 12px" }}>
                  <div style={{ fontSize: 13, color: T.ink3, fontFamily: F, lineHeight: 1.5 }}>Archived recs are hidden from your AI and public profile. Restore anytime.</div>
                </div>
              )}
              {filtered.length === 0 && filterCat === "archived" && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: T.ink3 }}>
                  <div style={{ fontSize: 28, marginBottom: 8, opacity: .3 }}>{"🗄"}</div>
                  <div style={{ fontSize: 13, fontFamily: F }}>No archived recs</div>
                </div>
              )}
              {filtered.map(function(item, i) { var ct = CAT[item.category] || CAT.other; var isArch = !!archived[item.id]; return (
                <div key={item.id} className={removing === item.id ? "rm" : "fu"} style={{ animationDelay: removing === item.id ? "0s" : (i * .03) + "s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 4px", borderBottom: "1px solid " + T.bdr, opacity: isArch ? 0.6 : 1 }}>
                    <div onClick={function() { setSelectedItem(item); setSubScreen("item"); }} style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: ct.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{ct.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: T.ink3, fontFamily: F, marginTop: 1 }}>{ct.label} {"·"} {fmtDate(item.date)}</div>
                      </div>
                    </div>
                    {isArch ? (
                      <button onClick={function() { restoreItem(item.id); }} style={{ padding: "6px 12px", borderRadius: 10, border: "1px solid #6BAA8E40", background: "#6BAA8E15", color: "#6BAA8E", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F, flexShrink: 0 }}>Restore</button>
                    ) : (
                      <button onClick={function() { removeItem(item.id); }} style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid " + T.bdr, background: "none", color: T.ink3, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{"\u2715"}</button>
                    )}
                  </div>
                </div>
              ); })}
              <div style={{ height: 40 }} />
            </div>

            {/* Undo toast */}
            {undoItem && (
              <div style={{ position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)", padding: "12px 20px", borderRadius: 14, background: T.ink, color: T.bg, display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", zIndex: 10, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 13, fontFamily: F }}>Archived <strong>{undoItem.title}</strong></span>
                <button onClick={undoArchive} style={{ background: "none", border: "1px solid " + T.bg + "40", borderRadius: 8, padding: "4px 12px", color: T.acc, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F }}>Undo</button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ ITEM DETAIL ═════════════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingItem && selectedItem && (() => {
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

          return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <div style={{ padding: "52px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <button onClick={() => { setSubScreen("taste"); setShowHistory(false); setEditingItem(null); }} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
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
                      {isPublic ? "● Public" : "○ Private"}
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
                    <span style={{ fontSize: 10, color: itemCopied ? "#6BAA8E" : T.acc, fontFamily: F, fontWeight: 600 }}>{itemCopied ? "✓ Copied" : "Copy"}</span>
                  </button>

                  {/* Your take */}
                  <div style={{ padding: "16px 18px", background: T.s, borderRadius: 14, border: "1px solid " + T.bdr, marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, fontFamily: F }}>Your take</div>
                    {isEditing ? (
                      <textarea value={editingItem.context} onChange={e => setEditingItem(p => ({ ...p, context: e.target.value }))} rows={3}
                        style={{ fontFamily: S, fontSize: 16, fontStyle: "italic", lineHeight: 1.6, color: T.ink, width: "100%", background: T.bg, border: `1.5px solid ${T.bdr}`, borderRadius: 10, padding: "10px 14px", outline: "none", resize: "none" }}
                      />
                    ) : (
                      <p style={{ fontFamily: S, fontSize: 17, fontStyle: "italic", lineHeight: 1.6, color: T.ink }}>"{selectedItem.context}"</p>
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
                          }}>✕</button>
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedItem.links.map((link, i) => (
                          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "12px 14px", background: T.s, borderRadius: 12, border: "1px solid " + T.bdr,
                            textDecoration: "none", color: T.ink, transition: "background .15s"
                          }}>
                            <span style={{ fontSize: 16 }}>
                              {link.type === "spotify" ? "🎵" : 
                               link.type === "youtube" ? "▶️" : 
                               link.type === "wikipedia" ? "📖" :
                               link.type === "google_maps" ? "📍" :
                               link.type === "website" ? "🔗" : "🔗"}
                            </span>
                            <span style={{ fontFamily: F, fontSize: 13, fontWeight: 500 }}>{link.label || link.type}</span>
                            <span style={{ marginLeft: "auto", fontSize: 12, color: T.ink3 }}>↗</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─── Settings section ─── */}
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

                      {/* Earnings config — independent toggles */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", fontFamily: F }}>Earnings</div>
                        {hasAnyEarning && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#6BAA8E", fontFamily: F, background: "#6BAA8E15", padding: "3px 10px", borderRadius: 6 }}>
                            {[isSubOnly && "Subscriber", isInBundle && "Bundle", isLicensable && "License", isTipEnabled && "Tips"].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>

                      {/* ── Tips & Donations ── */}
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

                      {/* ── Subscriber Only ── */}
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

                      {/* ── Bundle ── */}
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

                      {/* ── License ── */}
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
                        <button onClick={() => { restoreItem(selectedItem.id); setSubScreen("taste"); }} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid #6BAA8E30", background: "#6BAA8E10", color: "#6BAA8E", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F }}>Restore to taste</button>
                      ) : (
                        <button onClick={() => removeItem(selectedItem.id)} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid #D4956B30", background: "none", color: T.acc, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F, opacity: 0.7 }}>Archive from taste</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ VISITOR ITEM DETAIL ═════════════ */}
        {/* ══════════════════════════════════════════ */}
        {showingVisitorItem && selectedItem && (() => {
          const c = CAT[selectedItem.category] || CAT.other;
          const slug = selectedItem.slug || selectedItem.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const url = `curators.com/${profile.handle.replace("@", "")}/${slug}`;
          const bndls = itemBundles[selectedItem.id] || [];
          const recBundles = bundles.filter(b => bndls.includes(b.id));
          const fmtPhone = (p) => p ? p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3") : "";
          return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              <div style={{ padding: "52px 20px 10px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={closeSubScreen} style={{ background: "none", border: "none", color: T.acc, fontSize: 14, fontFamily: F, fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
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

                  {/* Context — elevated card */}
                  <div style={{
                    padding: "20px 22px", background: T.s, borderRadius: 16,
                    border: "1px solid " + T.bdr, marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontFamily: F }}>Why {profile.name} recommends this</div>
                    <p style={{ fontSize: 17, lineHeight: 1.6, color: T.ink, fontFamily: F, fontWeight: 500 }}>
                      {selectedItem.context}
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
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedItem.links.map((link, i) => {
                          const isSpotify = link.url?.includes("spotify.com");
                          const isYouTube = link.url?.includes("youtube.com") || link.url?.includes("youtu.be");
                          const isWikipedia = link.url?.includes("wikipedia.org");
                          const isGoogleMaps = link.url?.includes("google.com/maps") || link.url?.includes("goo.gl/maps");
                          const isAppleMusic = link.url?.includes("music.apple.com");
                          const isSoundCloud = link.url?.includes("soundcloud.com");
                          
                          const iconStyle = { width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
                          const icon = isSpotify ? (
                            <div style={{ ...iconStyle, background: "#1DB954" }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                            </div>
                          ) : isYouTube ? (
                            <div style={{ ...iconStyle, background: "#FF0000" }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            </div>
                          ) : isWikipedia ? (
                            <div style={{ ...iconStyle, background: "#fff", border: "1px solid " + T.bdr }}>
                              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "serif" }}>W</span>
                            </div>
                          ) : isGoogleMaps ? (
                            <div style={{ ...iconStyle, background: "#4285F4" }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                            </div>
                          ) : isAppleMusic ? (
                            <div style={{ ...iconStyle, background: "linear-gradient(135deg, #FA2D48, #A833B9)" }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.392-.238-.693-.106-1.384.428-1.945.37-.39.833-.6 1.35-.7.351-.067.709-.103 1.063-.163.238-.04.388-.186.397-.437.003-.063.003-.125.003-.19V9.357a.472.472 0 00-.49-.503c-.67-.032-1.34-.062-2.007-.105a41.27 41.27 0 01-1.433-.123.46.46 0 00-.52.467V17.77c0 .41-.057.815-.242 1.188-.29.583-.76.955-1.38 1.128-.86.238-1.7.116-2.447-.474-.476-.376-.715-.873-.764-1.467-.052-.627.12-1.19.55-1.66.355-.39.8-.6 1.31-.7.512-.098 1.03-.16 1.546-.242.26-.04.397-.194.405-.457.002-.068 0-.136 0-.204V6.946c0-.083.007-.167.017-.25.043-.354.255-.57.607-.615.21-.027.424-.04.635-.054.946-.06 1.893-.105 2.838-.17 1.042-.07 2.082-.16 3.124-.234.17-.012.342-.016.51.006.347.046.563.263.607.61.02.158.024.318.024.477v3.35z"/></svg>
                            </div>
                          ) : isSoundCloud ? (
                            <div style={{ ...iconStyle, background: "#FF5500" }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1zm-.899 1.18c-.048 0-.091.037-.098.094l-.18 1.072.18 1.048c.007.057.05.092.098.092.046 0 .087-.035.094-.092l.21-1.048-.21-1.072c-.007-.057-.048-.094-.094-.094zm1.83-.091c-.06 0-.109.053-.116.112l-.216 1.266.216 1.225c.007.063.056.113.116.113.06 0 .107-.05.116-.113l.246-1.225-.246-1.266c-.009-.063-.056-.112-.116-.112zm.93-.478c-.066 0-.119.059-.127.126l-.195 1.741.195 1.64c.008.066.061.122.127.122.066 0 .119-.056.127-.122l.225-1.64-.225-1.741c-.008-.067-.061-.126-.127-.126z"/></svg>
                            </div>
                          ) : (
                            <div style={{ ...iconStyle, background: T.s2 }}>
                              <span style={{ fontSize: 14 }}>🔗</span>
                            </div>
                          );
                          
                          const sourceName = isSpotify ? "Spotify" : isYouTube ? "YouTube" : isWikipedia ? "Wikipedia" : isGoogleMaps ? "Google Maps" : isAppleMusic ? "Apple Music" : isSoundCloud ? "SoundCloud" : "Link";
                          
                          return (
                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "12px 14px", background: T.s, borderRadius: 12, border: "1px solid " + T.bdr,
                              textDecoration: "none", color: T.ink, transition: "background .15s"
                            }}>
                              {icon}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600 }}>{link.label || sourceName}</div>
                                <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 2 }}>{sourceName}</div>
                              </div>
                              <span style={{ fontSize: 12, color: T.ink3 }}>↗</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Website + Phone (for restaurants/travel/products) */}
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
                        <a href={`tel:${selectedItem.phone}`} style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
                          textDecoration: "none",
                        }}>
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
                        <div className="fu" style={{
                          padding: "28px 22px", borderRadius: 20,
                          background: T.s, border: "1px solid " + T.bdr,
                        }}>
                          {/* Header */}
                          <div style={{ textAlign: "center", marginBottom: 20 }}>
                            <div style={{ fontSize: 28, marginBottom: 6 }}>☕</div>
                            <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>
                              Thank {profile.name} for this rec
                            </div>
                          </div>

                          {/* Personal message — first */}
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

                          {/* Amount section */}
                          <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, fontFamily: F, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
                            Attach a tip
                          </div>

                          {/* Amount display + exponential slider */}
                          {(() => {
                            const tipMax = itemTipConfig[selectedItem.id]?.max || 100;
                            const EXP = 2.5;
                            const range = tipMax - 1;
                            const posToAmt = (p) => Math.max(1, Math.round(1 + range * Math.pow(p / 100, EXP)));
                            const amtToPos = (a) => Math.pow(Math.max(0, (a - 1)) / range, 1 / EXP) * 100;
                            const pos = amtToPos(tipAmount);
                            const t = pos / 100; // 0→1 normalized progress

                            // Ball size: 16px at $1 → 56px at max
                            const ballSize = 16 + t * t * 40;
                            // Track height: hairline 2px → chunky 16px
                            const trackH = 2 + t * t * 14;

                            // Color temperature: cool grey-blue at 0% → warm terracotta at 100%
                            const coolR = 140, coolG = 155, coolB = 175; // steel blue-grey
                            const warmR = 195, warmG = 120, warmB = 80;  // terracotta
                            const r = Math.round(coolR + (warmR - coolR) * t);
                            const g = Math.round(coolG + (warmG - coolG) * t);
                            const b = Math.round(coolB + (warmB - coolB) * t);
                            const ballColor = `rgb(${r},${g},${b})`;
                            // Second gradient stop — goes toward green at high values
                            const r2 = Math.round(coolR + (107 - coolR) * t); // 107 = 6BAA8E
                            const g2 = Math.round(coolG + (170 - coolG) * t);
                            const b2 = Math.round(coolB + (142 - coolB) * t);
                            const ballColor2 = `rgb(${r2},${g2},${b2})`;

                            // Glow: none at low, strong at high
                            const glowSpread = t * 20;
                            const glowAlpha = Math.round(t * 0.6 * 255).toString(16).padStart(2, "0");

                            // Smart presets based on max
                            const presets = tipMax >= 50 ? [3, 5, 10, 25] : tipMax >= 25 ? [2, 5, 10, 20] : [1, 3, 5, 10];

                            // Scale labels — positioned on curve
                            const scalePoints = tipMax >= 50
                              ? [1, 5, 10, 25, tipMax]
                              : tipMax >= 25
                                ? [1, 5, 10, tipMax]
                                : [1, 3, 5, tipMax];

                            return (
                              <>
                                <div style={{ textAlign: "center", marginBottom: 4 }}>
                                  <div style={{
                                    fontFamily: MN, fontSize: 32 + t * 28, fontWeight: 700, color: T.ink,
                                    lineHeight: 1, letterSpacing: "-0.03em",
                                    transition: "font-size .12s",
                                  }}>
                                    {"$"}{tipAmount}
                                  </div>
                                </div>

                                {/* Slider */}
                                <div style={{ padding: "26px 6px 10px" }}>
                                  <div style={{ position: "relative", height: 60, display: "flex", alignItems: "center" }}>
                                    {/* Track bg — tapered: thin left, thick right */}
                                    <div style={{
                                      position: "absolute", left: 0, right: 0, height: 18,
                                      background: T.bdr,
                                      clipPath: "polygon(0% 45%, 100% 0%, 100% 100%, 0% 55%)",
                                      borderRadius: 2,
                                    }} />
                                    {/* Track fill — same taper, colored */}
                                    <div style={{
                                      position: "absolute", left: 0, height: 18,
                                      background: `linear-gradient(90deg, rgb(${coolR},${coolG},${coolB}), ${ballColor})`,
                                      width: `${pos}%`,
                                      clipPath: "polygon(0% 45%, 100% 0%, 100% 100%, 0% 55%)",
                                      borderRadius: 2,
                                      transition: "width .05s",
                                    }} />
                                    {/* Glow — only visible at higher amounts */}
                                    {t > 0.2 && <div style={{
                                      position: "absolute",
                                      left: `calc(${pos}% - ${ballSize}px)`,
                                      width: ballSize * 2, height: ballSize * 2,
                                      borderRadius: "50%",
                                      background: `radial-gradient(circle, ${ballColor}${glowAlpha} 0%, transparent 70%)`,
                                      pointerEvents: "none", transition: "left .05s",
                                      top: "50%", transform: "translateY(-50%)",
                                    }} />}
                                    {/* The ball */}
                                    <div style={{
                                      position: "absolute",
                                      left: `calc(${pos}% - ${ballSize / 2}px)`,
                                      width: ballSize, height: ballSize,
                                      borderRadius: "50%",
                                      background: `linear-gradient(135deg, ${ballColor}, ${ballColor2})`,
                                      boxShadow: t > 0.15
                                        ? `0 2px ${4 + glowSpread}px ${ballColor}${glowAlpha}`
                                        : `0 1px 4px rgba(0,0,0,0.25)`,
                                      transition: "left .05s, width .12s, height .12s, background .12s, box-shadow .12s",
                                      animation: t > 0.1 ? "thumbBreathe 2.5s ease-in-out infinite" : "none",
                                      pointerEvents: "none",
                                    }} />
                                    {/* Hidden input */}
                                    <input type="range" min="0" max="100" value={Math.round(pos)}
                                      onChange={e => setTipAmount(posToAmt(parseInt(e.target.value)))}
                                      style={{ position: "absolute", width: "100%", height: 60, opacity: 0, cursor: "grab", margin: 0, zIndex: 2 }}
                                    />
                                  </div>
                                  {/* Scale labels at curve positions */}
                                  <div style={{ position: "relative", height: 16, marginTop: 6, padding: "0 2px" }}>
                                    {scalePoints.map(v => (
                                      <span key={v} style={{
                                        position: "absolute",
                                        left: `${amtToPos(v)}%`, transform: "translateX(-50%)",
                                        fontSize: 10, color: tipAmount >= v ? T.ink2 : T.ink3,
                                        fontFamily: MN, fontWeight: tipAmount === v ? 700 : 400,
                                        transition: "color .15s",
                                      }}>{"$"}{v}</span>
                                    ))}
                                  </div>
                                </div>

                                {/* Quick presets */}
                                <div style={{ display: "flex", gap: 8, marginBottom: 24, marginTop: 12 }}>
                                  {presets.map(amt => (
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
                              </>
                            );
                          })()}

                          {/* Send button */}
                          <button onClick={() => setTipSent(true)} style={{
                            width: "100%", padding: "16px", borderRadius: 14, border: "none",
                            background: T.acc, color: T.accText,
                            fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: F,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          }}>
                            Send {"$"}{tipAmount} ☕
                          </button>

                          {/* Payment methods */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 14 }}>
                            <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>💳 Card</span>
                            {profile.cryptoEnabled && <span style={{ fontSize: 10, color: T.ink3, fontFamily: F }}>⛓ Crypto</span>}
                          </div>

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
                      {tipMessage && (
                        <div style={{
                          marginTop: 12, padding: "12px 16px", borderRadius: 12,
                          background: T.s, border: "1px solid " + T.bdr, textAlign: "left",
                        }}>
                          <p style={{ fontFamily: F, fontSize: 13, color: T.ink2, fontStyle: "italic", lineHeight: 1.5 }}>"{tipMessage}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Layer 3: On-chain footer ── */}
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
                    {!!itemLicensable[selectedItem.id] && (() => {
                      const lic = itemLicense[selectedItem.id] || { types: [], floor: 100 };
                      return (
                        <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: T.s, border: "1px solid " + T.bdr }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, fontFamily: F, textTransform: "uppercase", letterSpacing: ".06em" }}>License this recommendation</div>
                              <div style={{ fontSize: 11, color: T.ink2, fontFamily: F, marginTop: 3 }}>
                                {lic.types.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") || "Custom"} use · from {"$"}{lic.floor}
                              </div>
                            </div>
                            <button style={{
                              padding: "8px 14px", borderRadius: 8, border: "1px solid " + T.bdr,
                              background: T.s, fontSize: 11, fontWeight: 600, color: T.ink2,
                              cursor: "pointer", fontFamily: F,
                            }}>Inquire</button>
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{ height: 20 }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════ */}
        {/* ════════ CURATOR TAB BAR ═════════════════ */}
        {/* ══════════════════════════════════════════ */}
        {mode === "curator" && !subScreen && (
          <div style={{
            display: "flex", borderTop: `1px solid ${curatorTab === "myai" ? W.bdr : T.bdr}`,
            background: curatorTab === "myai" ? W.bg : T.bg2,
            padding: "6px 0 28px", flexShrink: 0, transition: "background .3s",
          }}>
            {[
              { id: "myai", icon: "◈", label: "My AI", activeColor: W.accent },
              { id: "profile", icon: "◉", label: "Profile", activeColor: T.acc },
            ].map(tab => (
              <button key={tab.id} onClick={() => setCuratorTab(tab.id)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  border: "none", background: "transparent", cursor: "pointer", padding: "10px 0",
                  color: curatorTab === tab.id ? tab.activeColor : T.ink3,
                }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 11, fontFamily: F, fontWeight: curatorTab === tab.id ? 700 : 400 }}>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

      </div>
    </>
  );
}
