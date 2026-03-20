'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { T, W, V, F, S, MN, CAT } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";
import { supabase } from "@/lib/supabase";
import CaptureCard from "./CaptureCard";
import ProfileCaptureCard from "./ProfileCaptureCard";
import ErrorBoundary from "../shared/ErrorBoundary";
import FeedUserBubble from "../feed/FeedUserBubble";
import FeedBlockGroup from "../feed/FeedBlockGroup";
import FeedLegacyBubble from "../feed/FeedLegacyBubble";

const linkStyle = {
  color: T.acc, textDecoration: "underline",
  textUnderlineOffset: 2, cursor: "pointer",
};

const parseLinks = (text) => {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (!match) return part;
    const [, label, href] = match;
    if (href.startsWith("/")) {
      return <Link key={i} href={href} style={linkStyle}>{label}</Link>;
    }
    return <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{label}</a>;
  });
};

const renderMd = (text) => text.split("\n").map((line, i) => {
  const b = line.replace(/\*\*(.*?)\*\*/g, '<b_mark>$1</b_mark>');
  const segments = b.split(/(<b_mark>.*?<\/b_mark>)/g);
  const content = segments.map((seg, j) => {
    const boldMatch = seg.match(/^<b_mark>(.*?)<\/b_mark>$/);
    if (boldMatch) return <strong key={j}>{parseLinks(boldMatch[1])}</strong>;
    return <span key={j}>{parseLinks(seg)}</span>;
  });
  return <div key={i} style={{ marginBottom: line === "" ? 8 : 2 }}>{content}</div>;
});

const isSpecificLink = (url) => {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/\/+$/, '');
    // Root domain with no path and no meaningful query params → not specific
    if (!p && !u.search) return false;
    // Search/browse/explore pages → not specific
    if (/^\/(search|browse|explore|discover|results|home)(\/|$)/i.test(u.pathname)) return false;
    // Channel/user/profile pages → not specific
    if (/^\/(channel|c|user|@[^/]*)(\/[^/]*)?$/i.test(u.pathname)) return false;
    // Category/genre landing pages → not specific
    if (/^\/(category|genre)(\/[^/]*)?$/i.test(u.pathname)) return false;
    // Root domain with only a search query (no real path) → not specific
    if (!p && u.search && !u.searchParams.has('v') && !u.searchParams.has('id')) return false;
    // Has a real path or content query params → specific
    return true;
  } catch { return false; }
};

const hasValidLink = (links) => (links || []).some(l => isSpecificLink(l.url));

export default function ChatView({ variant }) {
  const router = useRouter();
  const { profile, setProfile, profileId, isFirstTime, tasteItems, messages, setMessages, dbLoaded, prevMsgCount, addRec, saveMsgToDb, saveProfileFromChat, isOwner } = useCurator();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [pendingLink, setPendingLink] = useState(null);
  const [editingCapture, setEditingCapture] = useState(null);
  const [captureLinkInputs, setCaptureLinkInputs] = useState({});
  const [pendingImage, setPendingImage] = useState(null);
  const imageInputRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const chatEnd = useRef(null);
  const chatScrollRef = useRef(null);
  const shouldScroll = useRef(false);
  const isBackNav = useRef(messages.length > 0);
  const nudgeTimer = useRef(null);
  const typedSinceSave = useRef(false);
  const tappedActionMsgIndices = useRef(new Set());
  const isWaitingForResponse = useRef(false);

  const [isDesktop, setIsDesktop] = useState(false);
  const [agentPollingJobs, setAgentPollingJobs] = useState([]);

  const isCurator = variant === "curator";
  const items = tasteItems;
  const n = items.length;
  const cats = [...new Set(items.map(i => i.category))];

  useEffect(() => { return () => { if (nudgeTimer.current) clearTimeout(nudgeTimer.current); }; }, []);

  // Image handling
  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB limit
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      setPendingImage({
        base64,
        mimeType: file.type,
        fileName: file.name,
        previewUrl: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Visitor opening message
  useEffect(() => {
    if (!isCurator && profile && dbLoaded && messages.length === 0) {
      // Top content-type tags by volume
      const CONTENT_TYPE_TAGS = ["album","song","podcast","playlist","mix","ep","audiobook","book","article","substack","essay","newsletter","blog post","paper","film","series","documentary","short film","anime","standup special","restaurant","bar","cafe","hotel","park","museum","city","neighborhood","app","tool","gadget","gear","product","software","clothing","shoes","accessories","fashion","beauty","game","sport","activity","hobby","videogame","boardgame"];
      const tagCounts = {};
      items.forEach(item => {
        (item.tags || []).forEach(tag => {
          const t = tag.toLowerCase();
          if (CONTENT_TYPE_TAGS.includes(t)) {
            tagCounts[t] = (tagCounts[t] || 0) + 1;
          }
        });
      });
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t + "s");
      const catStr = topTags.length === 0 ? "their favorites"
        : topTags.length === 1 ? topTags[0]
        : topTags.length === 2 ? `${topTags[0]} and ${topTags[1]}`
        : `${topTags[0]}, ${topTags[1]}, and ${topTags[2]}`;

      // Style-informed second sentence
      const voice = (profile.styleSummary?.voice || "").toLowerCase();
      let styleLine;
      if (/precise|specific|detailed|exact/.test(voice)) {
        styleLine = "Ask me about the exact spot, the right time to go, or what to order.";
      } else if (/broad|experiential|expansive/.test(voice)) {
        styleLine = "Ask me anything \u2014 places, music, things worth your time.";
      } else if (/thoughtful|measured|reflective|considered/.test(voice)) {
        styleLine = `I know what ${profile.name} recommends and why. Ask me anything.`;
      } else {
        styleLine = `Ask me anything about ${profile.name}'s taste.`;
      }

      setMessages([{ role: "ai", text: `I'm ${profile.name}'s taste AI, trained on recommendations across ${catStr}. ${styleLine}` }]);
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

  // Save chat scroll position before navigating away via internal links
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const handleClick = (e) => {
      const link = e.target.closest("a[href^='/']");
      if (link && el) {
        sessionStorage.setItem("chatScrollPos", String(el.scrollTop));
      }
    };
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, []);

  // Auto-scroll on initial load (skip + restore position if returning via back navigation)
  useEffect(() => {
    if (dbLoaded && messages.length > 0) {
      if (isBackNav.current) {
        const saved = sessionStorage.getItem("chatScrollPos");
        if (saved != null && chatScrollRef.current) {
          setTimeout(() => { chatScrollRef.current.scrollTop = parseInt(saved, 10); }, 80);
        }
        sessionStorage.removeItem("chatScrollPos");
      } else {
        setTimeout(() => chatEnd.current?.scrollIntoView({ behavior: "instant" }), 100);
      }
    }
    isBackNav.current = false;
  }, [dbLoaded]);

  // Opening prompts for curator chat
  const openingGenerated = useRef(false);
  useEffect(() => {
    if (!dbLoaded || !isCurator || !profile) return;
    if (messages.length > 0) return;

    // First-time curator: generate personalized AI opening via API
    if (isFirstTime && !openingGenerated.current) {
      openingGenerated.current = true;
      setTyping(true);
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generateOpening: true,
          curatorName: profile.name,
          curatorHandle: profile.handle?.replace('@', ''),
          curatorBio: profile.bio || '',
          profileId,
          recommendations: [],
        }),
      })
        .then(r => r.json())
        .then(data => {
          setTyping(false);
          const text = data.message;
          setMessages([{ role: "ai", text }]);
          saveMsgToDb("ai", text);
        })
        .catch(() => {
          setTyping(false);
          const name = profile.name?.split(' ')[0] || profile.name;
          setMessages([{ role: "ai", text: `Hey ${name}! I'm your personal taste AI — I'm here to capture what you love and help you share it.\n\nWhat's something you've been recommending to everyone lately?` }]);
        });
      return;
    }

    // Returning curator: standard opening
    const openingPrompts = [
      "What's something you're enjoying that you want to capture and share?",
      "What have you been recommending to people lately?",
      "Anything new you've discovered that deserves a spot in your collection?",
      "What's something you keep telling people about?",
    ];
    const randomPrompt = openingPrompts[Math.floor(Math.random() * openingPrompts.length)];
    const openingMessage = n < 10
      ? `You've got ${n} recommendations so far.\n\n${randomPrompt}`
      : `${n} recs and counting.\n\n${randomPrompt}`;
    setMessages([{ role: "ai", text: openingMessage }]);
  }, [dbLoaded]);

  // Create a DB-persisted agent_banner block for a completed job
  const createAgentBannerBlock = async (jobId, sourceType, sourceName, sourceUrl) => {
    // Dedup by job_id
    const { data: existingJob } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("profile_id", profileId)
      .filter("blocks", "cs", JSON.stringify([{ data: { job_id: jobId } }]))
      .limit(1);
    if (existingJob && existingJob.length > 0) return;

    // Resolve source name if missing
    const resolvedName = sourceName || { spotify: "Spotify", apple_music: "Apple Music", google_maps: "Google Maps", youtube: "YouTube", letterboxd: "Letterboxd", goodreads: "Goodreads", soundcloud: "SoundCloud", twitter: "X (Twitter)", webpage: "Webpage" }[sourceType] || sourceType;

    const blocks = [{
      type: "agent_banner",
      data: {
        job_id: jobId,
        source_type: sourceType,
        source_name: resolvedName,
        status: "completed",
        cta_text: "See what I found",
      },
    }];
    const savedId = await saveMsgToDb("ai", "", null, blocks);
    setMessages(m => [...m, { role: "assistant", text: null, blocks, id: savedId, interactions: [] }]);
    shouldScroll.current = true;
  };

  // Check for completed unpresented agent jobs on mount (runs once)
  const mountCheckDone = useRef(false);
  useEffect(() => {
    if (!isCurator || !profileId || !dbLoaded) return;
    if (mountCheckDone.current) return;
    mountCheckDone.current = true;
    fetch('/api/agent/check')
      .then(r => r.json())
      .then(async data => {
        if (data.jobs && data.jobs.length > 0) {
          for (const job of data.jobs) {
            await createAgentBannerBlock(job.jobId, job.sourceType, job.sourceName, job.sourceUrl);
          }
        }
        // Resume polling for any processing jobs
        if (data.processing && data.processing.length > 0) {
          setAgentPollingJobs(prev => [...prev, ...data.processing]);
        }
      })
      .catch(err => console.error('Agent check error:', err));
  }, [isCurator, profileId, dbLoaded]);

  // Poll agent jobs for completion
  useEffect(() => {
    if (agentPollingJobs.length === 0) return;
    const startTime = Date.now();
    const interval = setInterval(async () => {
      // Don't poll while waiting for a chat response
      if (isWaitingForResponse.current) return;
      if (Date.now() - startTime > 120000) {
        setAgentPollingJobs([]);
        clearInterval(interval);
        return;
      }
      for (const job of agentPollingJobs) {
        try {
          const res = await fetch(`/api/agent/status?jobId=${job.jobId}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.status === 'completed') {
            setAgentPollingJobs(prev => prev.filter(j => j.jobId !== job.jobId));
            await createAgentBannerBlock(job.jobId, job.sourceType, job.sourceName, job.sourceUrl);
          } else if (data.status === 'failed') {
            setAgentPollingJobs(prev => prev.filter(j => j.jobId !== job.jobId));
          }
        } catch (err) {
          console.error('Agent poll error:', err);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [agentPollingJobs]);

  const send = async (overrideMsg) => {
    const msg = overrideMsg || input.trim();
    if (!msg && !pendingImage) return;
    const imageToSend = pendingImage;
    shouldScroll.current = true;
    setMessages(m => [...m, { role: "user", text: msg || (imageToSend ? "[sent an image]" : ""), imagePreview: imageToSend?.previewUrl || null }]);
    saveMsgToDb("user", msg || "[sent an image]");
    setInput("");
    setPendingImage(null);
    setTyping(true);
    isWaitingForResponse.current = true;

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
          curatorHandle: profile.handle?.replace('@', ''),
          curatorBio: profile.bio || '',
          profileId,
          recommendations: items.map(item => ({
            title: item.title, category: item.category,
            context: item.context, tags: item.tags, date: item.date,
            slug: item.slug,
          })),
          linkMetadata,
          history: messages.filter(m => !m.type).slice(-10),
          ...(imageToSend ? { image: { base64: imageToSend.base64, mimeType: imageToSend.mimeType } } : {}),
        }),
      });

      const data = await response.json();
      setTyping(false);
      isWaitingForResponse.current = false;

      // Trigger agent processing for any new jobs + start polling
      if (data.agentJobs && data.agentJobs.length > 0) {
        for (const job of data.agentJobs) {
          fetch('/api/agent/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.jobId }),
          }).catch(err => console.error('Agent process failed:', err));
        }
        setAgentPollingJobs(prev => [...prev, ...data.agentJobs]);
      }

      let text = data.message || '';
      // Strip [REC]...[/REC] if present
      text = text.replace(/\[REC\][\s\S]*?\[\/REC\]/, '').trim();
      if (!text) text = ' ';

      // Parse and submit feedback capture blocks
      const feedbackMatch = text.match(/\n?FEEDBACK_CAPTURE:(\{[\s\S]*\})\s*$/);
      if (feedbackMatch) {
        text = text.replace(/\n?FEEDBACK_CAPTURE:\{[\s\S]*\}\s*$/, '').trim();
        try {
          const feedbackData = JSON.parse(feedbackMatch[1]);
          fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profileId,
              handle: profile.handle?.replace('@', ''),
              originalMessage: feedbackData.originalMessage,
              elaboration: feedbackData.elaboration,
              summary: feedbackData.summary,
            }),
          }).catch(err => console.error('Feedback submit error:', err));
        } catch (e) {
          console.error('Failed to parse feedback JSON:', e);
        }
      }

      const isProfileDraft = text.includes('\u{1F4CB} PROFILE DRAFT') || text.includes('PROFILE DRAFT');

      // Check server-extracted rec first, fall back to emoji parsing
      let capturedRec = data.captured_rec || null;
      let capturedProfile = null;

      if (isProfileDraft) {
        const nameMatch = text.match(/name:\s*(.+)/i);
        const locationMatch = text.match(/location:\s*(.+)/i);
        const bioMatch = text.match(/bio:\s*([\s\S]*?)(?:\n---|\n📋|$)/i);
        capturedProfile = {
          name: nameMatch ? nameMatch[1].trim() : profile.name,
          location: locationMatch ? locationMatch[1].trim() : '',
          bio: bioMatch ? bioMatch[1].trim() : '',
        };
      } else if (!capturedRec) {
        // Legacy emoji parsing fallback (backward compat during transition)
        const isCapturedRec = /\u{1F4CD}\s*Adding:/u.test(text) || /\u{1F3F7}\s*Suggested tags/u.test(text);
        if (isCapturedRec) {
          const titleMatch = text.match(/\*\*([^*]+)\*\*/);
          const contextMatch = text.match(/"([^"]+)"/);
          const tagsMatch = text.match(/\u{1F3F7}\s*Suggested tags?:?\s*([^\n]+)/iu);
          const categoryMatch = text.match(/\u{1F4C1}\s*Category:\s*\**(\w+)/iu) || text.match(/Category:\s*\**(\w+)/i);
          const linkMatch = text.match(/\u{1F517}\s*(?:Link:\s*)?(?:\[.*?\]\()?(https?:\/\/[^\s)]+)/iu);
          const validCategories = ["watch", "listen", "read", "visit", "get", "wear", "play", "other"];
          const parseCategory = (match) => {
            if (!match) return 'other';
            const raw = match[1].toLowerCase();
            if (validCategories.includes(raw)) return raw;
            if (raw === 'tv' || raw === 'film' || raw === 'movies' || raw === 'movie' || raw === 'television' || raw === 'show' || raw === 'shows') return 'watch';
            if (raw === 'music' || raw === 'song' || raw === 'songs' || raw === 'album' || raw === 'albums' || raw === 'artist' || raw === 'podcast') return 'listen';
            if (raw === 'book' || raw === 'books') return 'read';
            if (raw === 'restaurant' || raw === 'restaurants' || raw === 'dining' || raw === 'food' || raw === 'travel') return 'visit';
            if (raw === 'product' || raw === 'products') return 'get';
            return 'other';
          };
          if (titleMatch) {
            const parsedUrl = linkMatch ? linkMatch[1] : null;
            let linkLabel = '';
            if (parsedUrl) {
              try { linkLabel = new URL(parsedUrl).hostname.replace('www.', ''); } catch { linkLabel = 'Link'; }
            }
            capturedRec = {
              title: titleMatch[1].replace(' \u2014 ', ' - '),
              context: contextMatch ? contextMatch[1] : '',
              tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [],
              category: parseCategory(categoryMatch),
              links: parsedUrl ? [{ url: parsedUrl, label: linkLabel, type: 'website' }] : [],
            };
          }
        }
      }

      setMessages(m => [...m, { role: "ai", text, capturedRec, capturedProfile, blocks: data.blocks || null, interactions: [] }]);
      const savedId = await saveMsgToDb("ai", text, capturedRec, data.blocks);
      if (savedId) {
        setMessages(m => m.map((msg, idx) => idx === m.length - 1 && msg.role === "ai" && !msg.id ? { ...msg, id: savedId } : msg));
      }
    } catch (error) {
      console.error('Chat error:', error);
      setTyping(false);
      isWaitingForResponse.current = false;
      setMessages(m => [...m, { role: "ai", text: "Sorry, I'm having trouble connecting right now. Try again in a moment." }]);
    }
  };

  const handleInteraction = async (messageId, blockIndex, action) => {
    const interaction = { block_index: blockIndex, action, interacted_at: new Date().toISOString() };
    // Optimistic update — match by id if available, otherwise grey out the last AI message with blocks
    setMessages(prev => prev.map(msg => {
      if (messageId && msg.id === messageId) {
        return { ...msg, interactions: [...(msg.interactions || []), interaction] };
      }
      if (!messageId && msg.role === "ai" && msg.blocks && msg.blocks.length > 0 && !(msg.interactions || []).length) {
        return { ...msg, interactions: [interaction] };
      }
      return msg;
    }));
    // Resolve the DB id if we don't have one
    let dbId = messageId;
    if (!dbId && profileId) {
      try {
        const { data: recent } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('profile_id', profileId)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        dbId = recent?.id;
      } catch (err) {
        console.error('Failed to resolve message id for interaction:', err);
      }
    }
    if (!dbId) return;
    // Persist via server API (bypasses RLS — no UPDATE policy on chat_messages)
    try {
      await fetch('/api/chat/interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: dbId, interaction }),
      });
    } catch (err) {
      console.error('Failed to save interaction:', err);
    }
  };

  const handleSaveProfile = async (profileData, msgIndex) => {
    await saveProfileFromChat(profileData);
    setMessages(prev => [
      ...prev.map((m, idx) => idx === msgIndex ? { ...m, profileSaved: true } : m),
      { role: "ai", text: "\u2713 Profile saved. Looking good!" },
    ]);
    saveMsgToDb("ai", "\u2713 Profile saved. Looking good!");
  };

  const handleSaveCapture = (capturedRec, msgIndex) => {
    if (!capturedRec?.title) return;
    const newItem = {
      id: Date.now(),
      slug: capturedRec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: capturedRec.title,
      category: capturedRec.category || "other",
      context: capturedRec.context || '',
      tags: capturedRec.tags || [],
      date: new Date().toISOString().split("T")[0],
      visibility: "public",
      revision: 1,
      earnableMode: "none",
      links: (() => {
        // Priority: editing card links > inline link input > pending link > AI-parsed links
        // If editingCapture exists, always use its links (even if empty — user may have removed all)
        if (editingCapture) return editingCapture.links || [];
        const inlineLink = captureLinkInputs[msgIndex]?.trim();
        if (inlineLink && /^https?:\/\//.test(inlineLink)) {
          let label = 'Link';
          try { label = new URL(inlineLink).hostname.replace('www.', ''); } catch {}
          return [{ url: inlineLink, label, type: 'website' }];
        }
        if (pendingLink) return [{ type: pendingLink.source?.toLowerCase() || "website", url: pendingLink.url, label: pendingLink.title }];
        return capturedRec.links || [];
      })(),
      revisions: [{ rev: 1, date: new Date().toISOString().split("T")[0], change: "Created" }]
    };
    addRec(newItem);
    // Immediate toast
    setMessages(prev => [...prev.map((m, idx) => idx === msgIndex ? { ...m, saved: true, savedLinks: newItem.links } : m), { role: "ai", text: "\u2713 Saved." }]);
    saveMsgToDb("ai", "\u2713 Saved.");

    // Schedule post-save taste reflection after 3s (cancelled if curator starts typing)
    typedSinceSave.current = false;
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    const recCount = items.length + 1; // includes the one just saved
    const savedRec = { title: capturedRec.title, category: capturedRec.category || 'other', context: capturedRec.context || '' };
    nudgeTimer.current = setTimeout(async () => {
      if (typedSinceSave.current) return;
      setTyping(true);
      try {
        const reflectionMsg = `[SYSTEM: The curator just saved a new recommendation: "${savedRec.title}" (${savedRec.category}). Their context: "${savedRec.context}". They now have ${recCount} total recs. Reflect on what this rec adds to their taste profile — connect it to patterns you see, be specific and insightful. Then naturally ask what's next. Keep it to 2-3 sentences.]`;
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: reflectionMsg,
            curatorName: profile.name,
            curatorHandle: profile.handle?.replace('@', ''),
            curatorBio: profile.bio || '',
            profileId,
            recommendations: items.map(item => ({
              title: item.title, category: item.category,
              context: item.context, tags: item.tags, date: item.date,
              slug: item.slug,
            })),
            linkMetadata: null,
            history: messages.filter(m => !m.type).slice(-10),
          }),
        });
        const data = await res.json();
        setTyping(false);
        if (typedSinceSave.current) return;
        let text = data.message || '';
        text = text.replace(/\[REC\][\s\S]*?\[\/REC\]/, '').trim();
        if (!text) text = ' ';
        setMessages(prev => [...prev, { role: "ai", text, blocks: data.blocks || null, interactions: [] }]);
        saveMsgToDb("ai", text, null, data.blocks);
      } catch (err) {
        console.error('Taste reflection error:', err);
        setTyping(false);
      }
    }, 3000);

    // Regenerate taste profile after every Nth rec save (fire and forget)
    const TASTE_PROFILE_REGEN_INTERVAL = 1;
    if (recCount >= 3 && recCount % TASTE_PROFILE_REGEN_INTERVAL === 0) {
      fetch('/api/generate-taste-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      }).catch(() => {});
    }

    setPendingLink(null);
    setEditingCapture(null);
    setCaptureLinkInputs(prev => { const next = { ...prev }; delete next[msgIndex]; return next; });
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
    setEditingCapture(p => {
      const updated = (p.links || []).filter((_, idx) => idx !== linkIndex);
      return { ...p, links: updated };
    });
    setPendingLink(null);
  };

  // ── CURATOR CHAT ──
  if (isCurator) {
    const newRequests = []; // placeholder for requests integration
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, width: "100%" }}>
        {/* Workspace header */}
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${W.bdr}`, background: W.bg }}>
        <div style={{ padding: isDesktop ? "16px 20px" : "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 700, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: isDesktop ? 10 : 8 }}>
            <div style={{ width: isDesktop ? 34 : 28, height: isDesktop ? 34 : 28, borderRadius: isDesktop ? 10 : 8, background: W.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${W.accent}30` }}>
              <span style={{ fontSize: isDesktop ? 13 : 11, fontWeight: 700, color: W.accent, fontFamily: F }}>C</span>
            </div>
            <div>
              <div style={{ fontFamily: F, fontSize: isDesktop ? 16 : 14, color: T.ink, fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em" }}>My AI</div>
              <div style={{ fontSize: 10, color: T.ink3, fontFamily: MN, fontWeight: 400, marginTop: 2 }}>{n} recs {"\u00B7"} {cats.length} categories</div>
            </div>
          </div>
          {isDesktop && <div style={{ fontSize: 10, color: T.ink3, fontFamily: MN }}>{n} recs</div>}
        </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, background: W.bg }}>
          <div ref={chatScrollRef} onScroll={() => { const el = chatScrollRef.current; if (el) setShowScrollBtn(el.scrollTop < el.scrollHeight - el.clientHeight - 100); }} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "none", minHeight: 0, touchAction: "pan-y" }}>
            <div style={{ maxWidth: 700, margin: "0 auto", padding: "12px 16px" }}>
            <ErrorBoundary>
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
              // User message
              if (msg.role === "user") {
                return (
                  <div key={i} className="fu" style={{ animationDelay: `${i * .03}s` }}>
                    <FeedUserBubble text={msg.text} imagePreview={msg.imagePreview} />
                  </div>
                );
              }
              // AI message with blocks → full-width feed rendering
              if (msg.role === "ai" && msg.blocks && msg.blocks.length > 0) {
                return (
                  <div key={i} className="fu" style={{ animationDelay: `${i * .03}s` }}>
                    <FeedBlockGroup
                      blocks={msg.blocks}
                      interactions={msg.interactions || []}
                      messageId={msg.id}
                      tapped={tappedActionMsgIndices.current.has(i)}
                      onSendMessage={(action) => { send(action); }}
                      onInteraction={(msgId, blockIdx, act) => {
                        tappedActionMsgIndices.current.add(i);
                        handleInteraction(msgId, blockIdx, act);
                      }}
                    />
                    {msg.capturedRec && !msg.saved && !items.some(r => r.title?.toLowerCase() === msg.capturedRec.title?.toLowerCase()) && !editingCapture && (
                      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid " + T.bdr, background: T.s }}>
                        <div style={{ fontSize: 11, fontFamily: F, fontWeight: 600, color: CAT[msg.capturedRec.category]?.color || T.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                          {CAT[msg.capturedRec.category]?.emoji || "◆"} {msg.capturedRec.category}{msg.capturedRec.content_type ? ` · ${msg.capturedRec.content_type}` : ""}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F, color: T.ink, marginBottom: 4 }}>{msg.capturedRec.title}</div>
                        {msg.capturedRec.context && (
                          <div style={{ fontSize: 13, fontFamily: F, color: T.ink2, fontStyle: "italic", marginBottom: 6 }}>"{msg.capturedRec.context}"</div>
                        )}
                        {msg.capturedRec.tags?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                            {msg.capturedRec.tags.map((tag, t) => (
                              <span key={t} style={{ fontSize: 11, fontFamily: F, padding: "2px 8px", borderRadius: 10, background: "#1e1b18", color: T.ink3 }}>{tag}</span>
                            ))}
                          </div>
                        )}
                        {!hasValidLink(msg.capturedRec.links) && !(pendingLink && isSpecificLink(pendingLink.url)) && (
                          <input
                            value={captureLinkInputs[i] || ''}
                            onChange={e => setCaptureLinkInputs(prev => ({ ...prev, [i]: e.target.value }))}
                            placeholder="Add a link (optional)"
                            style={{
                              width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 8,
                              border: "1px solid " + T.bdr, fontSize: 13, fontFamily: F,
                              background: W.aiBub, color: T.ink, outline: "none",
                            }}
                            onFocus={e => e.target.style.borderColor = W.accent}
                            onBlur={e => e.target.style.borderColor = W.bdr}
                          />
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
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
                    {(() => {
                      const savedLinks = msg.savedLinks || (msg.capturedRec && items.find(r => r.title?.toLowerCase() === msg.capturedRec.title?.toLowerCase())?.links);
                      const isSaved = msg.saved || (msg.capturedRec && items.some(r => r.title?.toLowerCase() === msg.capturedRec.title?.toLowerCase()));
                      return isSaved && savedLinks?.length > 0 ? (
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, color: T.ink3 }}>{"\uD83D\uDD17"}</span>
                          <a href={savedLinks[0].url} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 12, color: T.ink3, fontFamily: F, textDecoration: "underline",
                            textUnderlineOffset: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200,
                          }}>{savedLinks[0].label || savedLinks[0].url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}</a>
                        </div>
                      ) : null;
                    })()}
                    {msg.capturedProfile && !msg.profileSaved && (
                      <ProfileCaptureCard
                        profile={msg.capturedProfile}
                        onSave={(data) => handleSaveProfile(data, i)}
                        onDismiss={() => setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, profileSaved: true } : m))}
                      />
                    )}
                    {msg.profileSaved && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#6BAA8E", fontFamily: F, fontWeight: 600 }}>{"\u2713"} Profile saved</div>
                    )}
                  </div>
                );
              }
              // AI message without blocks → legacy bubble
              if (msg.role === "ai") {
                return (
                  <div key={i} className="fu" style={{ animationDelay: `${i * .03}s` }}>
                    <FeedLegacyBubble text={msg.text} imagePreview={msg.imagePreview} />
                    {msg.capturedRec && !msg.saved && !items.some(r => r.title?.toLowerCase() === msg.capturedRec.title?.toLowerCase()) && !editingCapture && (
                      <div style={{ marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid " + T.bdr, background: T.s }}>
                        <div style={{ fontSize: 11, fontFamily: F, fontWeight: 600, color: CAT[msg.capturedRec.category]?.color || T.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                          {CAT[msg.capturedRec.category]?.emoji || "◆"} {msg.capturedRec.category}{msg.capturedRec.content_type ? ` · ${msg.capturedRec.content_type}` : ""}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, fontFamily: F, color: T.ink, marginBottom: 4 }}>{msg.capturedRec.title}</div>
                        {msg.capturedRec.context && (
                          <div style={{ fontSize: 13, fontFamily: F, color: T.ink2, fontStyle: "italic", marginBottom: 6 }}>"{msg.capturedRec.context}"</div>
                        )}
                        {msg.capturedRec.tags?.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                            {msg.capturedRec.tags.map((tag, t) => (
                              <span key={t} style={{ fontSize: 11, fontFamily: F, padding: "2px 8px", borderRadius: 10, background: "#1e1b18", color: T.ink3 }}>{tag}</span>
                            ))}
                          </div>
                        )}
                        {!hasValidLink(msg.capturedRec.links) && !(pendingLink && isSpecificLink(pendingLink.url)) && (
                          <input
                            value={captureLinkInputs[i] || ''}
                            onChange={e => setCaptureLinkInputs(prev => ({ ...prev, [i]: e.target.value }))}
                            placeholder="Add a link (optional)"
                            style={{
                              width: "100%", padding: "8px 12px", borderRadius: 8, marginBottom: 8,
                              border: "1px solid " + T.bdr, fontSize: 13, fontFamily: F,
                              background: W.aiBub, color: T.ink, outline: "none",
                            }}
                            onFocus={e => e.target.style.borderColor = W.accent}
                            onBlur={e => e.target.style.borderColor = W.bdr}
                          />
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
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
                    {(() => {
                      const savedLinks = msg.savedLinks || (msg.capturedRec && items.find(r => r.title?.toLowerCase() === msg.capturedRec.title?.toLowerCase())?.links);
                      const isSaved = msg.saved || (msg.capturedRec && items.some(r => r.title?.toLowerCase() === msg.capturedRec.title?.toLowerCase()));
                      return isSaved && savedLinks?.length > 0 ? (
                        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, color: T.ink3 }}>{"\uD83D\uDD17"}</span>
                          <a href={savedLinks[0].url} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 12, color: T.ink3, fontFamily: F, textDecoration: "underline",
                            textUnderlineOffset: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200,
                          }}>{savedLinks[0].label || savedLinks[0].url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}</a>
                        </div>
                      ) : null;
                    })()}
                    {msg.capturedProfile && !msg.profileSaved && (
                      <ProfileCaptureCard
                        profile={msg.capturedProfile}
                        onSave={(data) => handleSaveProfile(data, i)}
                        onDismiss={() => setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, profileSaved: true } : m))}
                      />
                    )}
                    {msg.profileSaved && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#6BAA8E", fontFamily: F, fontWeight: 600 }}>{"\u2713"} Profile saved</div>
                    )}
                  </div>
                );
              }
              return null;
            })}
            </ErrorBoundary>
            {typing && <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ padding: "14px 18px", background: W.aiBub, borderRadius: "20px 20px 20px 6px", border: `1px solid ${W.bdr}` }}><span className="dt" /><span className="dt" style={{ animationDelay: ".2s" }} /><span className="dt" style={{ animationDelay: ".4s" }} /></div>
            </div>}
            <div ref={chatEnd} />
            {showScrollBtn && <button onClick={() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); setShowScrollBtn(false); }} style={{ position: "sticky", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 36, height: 36, borderRadius: 18, background: W.s2, border: "1px solid " + W.bdr, color: T.ink2, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", zIndex: 10 }}>{"\u2193"}</button>}
            </div>
          </div>
          <div style={{ padding: "10px 16px 28px", flexShrink: 0, maxWidth: 700, margin: "0 auto", width: "100%" }}>
            {pendingImage && (
              <div style={{ marginBottom: 8, display: "inline-flex", position: "relative" }}>
                <img src={pendingImage.previewUrl} alt="" style={{ height: 60, borderRadius: 10, border: `1px solid ${T.bdr}`, display: "block" }} />
                <button onClick={() => setPendingImage(null)} style={{
                  position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
                  background: T.ink3, color: T.bg, border: "none", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                }}>&times;</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={input} onChange={e => { setInput(e.target.value); if (e.target.value) { typedSinceSave.current = true; if (nudgeTimer.current) { clearTimeout(nudgeTimer.current); nudgeTimer.current = null; } } }} onKeyDown={e => e.key === "Enter" && send()}
                onPaste={e => { const file = e.clipboardData?.files?.[0]; if (file && file.type.startsWith('image/')) { e.preventDefault(); handleImageFile(file); } }}
                placeholder="Drop a rec, paste a link, or ask anything..."
                style={{ flex: 1, padding: "14px 18px", borderRadius: 24, border: `1.5px solid ${W.inputBdr}`, fontSize: 15, fontFamily: F, outline: "none", background: W.inputBg, color: T.ink }}
                onFocus={e => e.target.style.borderColor = W.accent} onBlur={e => e.target.style.borderColor = W.inputBdr}
              />
              <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { handleImageFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button onClick={() => imageInputRef.current?.click()} style={{ width: 46, height: 46, borderRadius: 23, border: "none", background: "transparent", color: T.ink3, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2"/></svg>
              </button>
              <button onClick={() => send()} style={{ width: 46, height: 46, borderRadius: 23, border: "none", background: (input.trim() || pendingImage) ? T.acc : W.bdr, color: (input.trim() || pendingImage) ? T.accText : T.ink3, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0, fontWeight: 600 }}>{"\u2191"}</button>
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
      <div style={{ padding: isOwner ? "12px 20px 12px" : "48px 20px 12px", background: V.bg, flexShrink: 0, borderBottom: `1px solid ${V.bdr}` }}>
        {!isOwner && (
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => router.back()} style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              display: "flex", alignItems: "center",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
          { label: "\uD83C\uDFA7 Radio", prompt: "Play me a radio station from the listen recs" },
          { label: "\u2728 Newest", prompt: "What are the newest recommendations?" },
          { label: "\uD83D\uDD25 Most Popular", prompt: "What are the most popular picks?" },
          { label: "\uD83D\uDCFA Watch", prompt: "What should I watch?" },
          { label: "\uD83C\uDFA7 Listen", prompt: "What should I listen to?" },
          { label: "\uD83D\uDCC4 Read", prompt: "What should I read?" },
          { label: "\uD83D\uDCCD Visit", prompt: "What places should I visit?" },
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
          <button onClick={() => send()} style={{ width: 46, height: 46, borderRadius: 23, border: "none", background: input.trim() ? T.acc : V.bdr, color: input.trim() ? T.accText : T.ink3, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s", flexShrink: 0, fontWeight: 600 }}>{"\u2191"}</button>
        </div>
      </div>
    </div>
  );
}
