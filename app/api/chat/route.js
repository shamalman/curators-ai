import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { detectSource } from "../../../lib/agent/registry.js";
import { buildOnboardingPrompt } from "../../../lib/prompts/onboarding.js";
import { buildStandardPrompt } from "../../../lib/prompts/standard.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-no-log": "true"
  }
});

function sourceNameFromType(t) {
  const map = { spotify: "Spotify", apple_music: "Apple Music", google_maps: "Google Maps", youtube: "YouTube", letterboxd: "Letterboxd", goodreads: "Goodreads", soundcloud: "SoundCloud", twitter: "X (Twitter)", webpage: "Webpage" };
  return map[t] || t;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Extract structured rec capture from [REC]...[/REC] JSON tags ──
function extractRecCapture(aiText) {
  if (!aiText) return null;
  const recMatch = aiText.match(/\[REC\]([\s\S]*?)\[\/REC\]/);
  if (!recMatch) return null;

  try {
    const parsed = JSON.parse(recMatch[1].trim());

    // Validate required fields
    if (!parsed.title) return null;

    return {
      title: parsed.title,
      context: parsed.context || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      category: parsed.category || 'other',
      content_type: parsed.content_type || null,
      links: Array.isArray(parsed.links) ? parsed.links.map(l => ({
        url: l.url || '',
        label: l.label || l.url || '',
        type: 'website'
      })) : [],
    };
  } catch (e) {
    console.error('Failed to parse [REC] JSON:', e, recMatch[1]);
    return null;
  }
}


function validateRecContext(recCapture, history, currentMessage) {
  if (!recCapture || !recCapture.title) return recCapture;

  const userMessages = [];
  if (history && Array.isArray(history)) {
    for (const msg of history) {
      if ((msg.role === 'user') && msg.text) {
        userMessages.push(msg.text);
      }
    }
  }
  if (currentMessage) {
    userMessages.push(currentMessage);
  }

  if (userMessages.length === 0) {
    recCapture.context = '';
    return recCapture;
  }

  const titleLower = recCapture.title.toLowerCase();

  const relevantSet = new Set();
  for (const msg of userMessages) {
    if (msg.toLowerCase().includes(titleLower)) {
      relevantSet.add(msg);
    }
  }

  // Always include the last user message (triggered the capture)
  const lastMsg = userMessages[userMessages.length - 1];
  if (lastMsg) relevantSet.add(lastMsg);

  const relevantMessages = [...relevantSet];

  const rebuiltContext = relevantMessages
    .map(m => m.trim())
    .filter(m => m.length > 0)
    .join('. ')
    .replace(/\.\./g, '.')
    .trim();

  recCapture.context = rebuiltContext;
  return recCapture;
}


// ── Fetch subscribed + broader recs for standard mode ──
async function getSubscribedRecs(profileId) {
  try {
    const sb = getSupabaseAdmin();

    // 1. Get subscribed curator IDs
    const { data: subs } = await sb
      .from("subscriptions")
      .select("curator_id")
      .eq("subscriber_id", profileId)
      .is("unsubscribed_at", null);

    const subscribedIds = (subs || []).map(s => s.curator_id);

    // 2. Fetch subscribed curators' profiles + recs (up to 50 most recent)
    let subscribedRecs = [];
    let subscribedProfiles = {};
    if (subscribedIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, name, handle")
        .in("id", subscribedIds);
      (profiles || []).forEach(p => { subscribedProfiles[p.id] = p; });

      const { data: recs } = await sb
        .from("recommendations")
        .select("*")
        .in("profile_id", subscribedIds)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(50);
      subscribedRecs = recs || [];
    }

    // 3. Fetch broader platform recs (other curators, up to 100 most recent)
    const excludeIds = [profileId, ...subscribedIds];
    const { data: broaderRecs } = await sb
      .from("recommendations")
      .select("*, profiles!inner(id, name, handle)")
      .not("profile_id", "in", `(${excludeIds.join(",")})`)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(100);

    // 4. Format subscribed curators block
    let subscribedBlock = "";
    if (subscribedIds.length === 0) {
      subscribedBlock = "\nSUBSCRIBED RECOMMENDATIONS:\nYou don't subscribe to any curators yet. When you do, I'll be able to surface their recommendations.";
    } else {
      // Group subscribed recs by curator
      const byCurator = {};
      subscribedIds.forEach(id => { byCurator[id] = []; });
      subscribedRecs.forEach(r => {
        if (byCurator[r.profile_id]) byCurator[r.profile_id].push(r);
      });

      const hasAnyRecs = subscribedRecs.length > 0;
      if (!hasAnyRecs) {
        const names = subscribedIds
          .map(id => subscribedProfiles[id]?.name || "Unknown")
          .join(", ");
        subscribedBlock = `\nSUBSCRIBED RECOMMENDATIONS:\nYou subscribe to ${names} but they haven't added any recommendations yet.`;
      } else {
        const sections = subscribedIds
          .filter(id => byCurator[id].length > 0)
          .map(id => {
            const p = subscribedProfiles[id];
            const recs = byCurator[id];
            const recLines = recs.map(r => {
              const ctx = r.context
                ? (r.context.length > 150 ? r.context.slice(0, 147) + "..." : r.context)
                : "No context";
              const tags = (r.tags || []).length > 0 ? ` [tags: ${r.tags.join(", ")}]` : "";
              const handle = p?.handle || "unknown";
              const slug = r.slug ? ` [link: /${handle}/${r.slug}]` : "";
              return `- ${r.title} (${r.category}) - "${ctx}"${tags}${slug}`;
            });
            return `@${p?.handle || "unknown"} (${p?.name || "Unknown"}) - ${recs.length} rec${recs.length !== 1 ? "s" : ""}:\n${recLines.join("\n")}`;
          });
        subscribedBlock = `\nSUBSCRIBED RECOMMENDATIONS (from curators you subscribe to):\n---\n${sections.join("\n---\n")}\n---`;
      }
    }

    // 5. Format broader network block
    let broaderBlock = "";
    if (broaderRecs && broaderRecs.length > 0) {
      const lines = broaderRecs.map(r => {
        const p = r.profiles;
        const ctx = r.context
          ? (r.context.length > 80 ? r.context.slice(0, 77) + "..." : r.context)
          : "";
        const handle = p?.handle || "unknown";
        const slug = r.slug ? ` [link: /${handle}/${r.slug}]` : "";
        return `@${p?.handle || "unknown"} (${p?.name || "Unknown"}): ${r.title} (${r.category})${ctx ? ` - "${ctx}"` : ""}${slug}`;
      });
      broaderBlock = `\n\nBROADER NETWORK (other curators on the platform):\n---\n${lines.join("\n")}\n---`;
    }

    return subscribedBlock + broaderBlock;
  } catch (err) {
    console.error("Failed to fetch subscribed recs:", err);
    return "\nSUBSCRIBED RECOMMENDATIONS:\nUnable to load subscription data right now.";
  }
}


const VISITOR_SYSTEM_PROMPT = `You are a taste AI representing a specific curator. You are talking TO A VISITOR who is browsing the curator's profile. You are NOT talking to the curator.

CRITICAL — PRONOUNS:
- You are speaking to a VISITOR about the CURATOR in third person.
- Use the curator's name or "they/he/she" — NEVER "you" when referring to the curator.
- Correct: "Shamal recommends Frisky.fm" / "He says the mixes are just his vibe"
- WRONG: "You recommended Frisky.fm" / "You said the mixes are just your vibe"
- "You" refers to the visitor you're talking to, not the curator.

YOUR ROLE:
- Answer questions about the curator's recommendations and taste
- Help visitors find specific recommendations from the curator's collection
- Be warm and helpful but honest — only reference recommendations that actually exist in the data
- If asked about something the curator hasn't recommended, say so honestly
- Keep responses concise and useful
- Use your full knowledge to enrich answers (background on artists, restaurants, books, etc.)

RULES:
- Only reference recommendations that exist in the provided data
- Don't make up recommendations or opinions the curator hasn't expressed
- Be conversational but brief
- You can describe patterns in their taste based on the actual data
- Always refer to the curator by name or third-person pronouns, never "you"

VOICE:
You must EMBODY this curator's communication style in every response. Don't describe their recs like a Wikipedia article. Deliver them with the curator's energy and voice. If they're casual and direct, be casual and direct. If they use slang, use similar language. You're not a narrator summarizing their taste — you're an extension of how they talk about the things they love.
Never say things like "has some fantastic recommendations!" or "Here's what they're loving!" — that's generic AI voice. Instead, match the curator's register.

LINKING RECS:
When mentioning a recommendation, link to it using markdown format: [Title](/handle/slug). Example: [Alberto Balsam](/shamal/alberto-balsam-by-aphex-twin). This lets visitors tap through to the full recommendation. Each rec in the data below includes a [link: /handle/slug] — use that path in your markdown links.`;

// ── Look up inviter info for onboarding mode ──
async function getInviterContext(profileId) {
  try {
    const sb = getSupabaseAdmin();

    // Get the curator's invited_by
    const { data: profile } = await sb
      .from("profiles")
      .select("invited_by")
      .eq("id", profileId)
      .single();

    if (!profile?.invited_by) return { inviterName: null, inviterHandle: null, inviterNote: null };

    // Get inviter's profile
    const { data: inviter } = await sb
      .from("profiles")
      .select("name, handle")
      .eq("id", profile.invited_by)
      .single();

    // Get the inviter_note from the invite code that was used for this curator
    // The invite code's created_by matches the inviter, and it was used (has used_at set)
    const { data: inviteCode } = await sb
      .from("invite_codes")
      .select("inviter_note")
      .eq("used_by", profileId)
      .single();

    return {
      inviterName: inviter?.name || null,
      inviterHandle: inviter?.handle || null,
      inviterNote: inviteCode?.inviter_note || null,
    };
  } catch (err) {
    console.error("Failed to look up inviter context:", err);
    return { inviterName: null, inviterHandle: null, inviterNote: null };
  }
}

// ── Extract URLs from message text ──
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

// ── Agent context: query agent_jobs and build prompt context ──
async function getAgentContext(profileId, sb) {
  try {
    // Fetch pending/processing agent jobs only
    const { data: jobs, error } = await sb
      .from("agent_jobs")
      .select("id, status, source_type, source_url")
      .eq("profile_id", profileId)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false });

    if (error || !jobs || jobs.length === 0) return { agentBlock: "" };

    let agentBlock = "";

    if (jobs.length > 0) {
      const sources = jobs.map(j => `${j.source_type} (${j.source_url})`).join(", ");
      agentBlock += `\nAGENT STATUS:\nI'm currently reading through your ${sources}. This might take a minute.\nWhile I work on that, let's keep talking. When I'm done, I'll share what I found.\n`;
    }

    return { agentBlock };
  } catch (err) {
    console.error("Failed to get agent context:", err);
    return { agentBlock: "" };
  }
}

// ── Deliver agent results ONLY when curator clicks the banner ──
async function getAgentResultsForDelivery(profileId, message, sb) {
  if (!message) return { block: "", deliveredJobIds: [], jobs: [] };

  // Check if this message is asking for agent results
  const lc = message.toLowerCase();
  const isAskingForResults = /show me what you found|what did you find|what('d| did) you get|show me your (analysis|read|findings)|let('s| me) see (what|the)|taste read/i.test(lc);
  if (!isAskingForResults) return { block: "", deliveredJobIds: [], jobs: [] };

  try {
    const { data: jobs, error } = await sb
      .from("agent_jobs")
      .select("*")
      .eq("profile_id", profileId)
      .eq("status", "completed")
      .is("presented_at", null)
      .order("completed_at", { ascending: false });

    if (error || !jobs || jobs.length === 0) return { block: "", deliveredJobIds: [], jobs: [] };

    const platforms = jobs.map(j => j.source_type);

    // Build taste read from job analyses
    const tasteTheses = jobs
      .map(j => j.taste_analysis?.taste_thesis)
      .filter(Boolean);

    const tasteRead = tasteTheses.length > 0
      ? tasteTheses.join(" ")
      : "I found some interesting patterns in your sources.";

    // Mark jobs as presented NOW
    const jobIds = jobs.map(j => j.id);
    await sb.from("agent_jobs")
      .update({ presented_at: new Date().toISOString() })
      .in("id", jobIds);

    return {
      block: `\nAGENT RESULTS READY:
I finished analyzing your ${platforms.join(" and ")}.

TASTE READ to deliver:
${tasteRead}

INSTRUCTIONS:
- Deliver the taste read conversationally. Have a point of view.
- End with "Am I reading that right?" or "What am I missing?"
- After delivering the taste read, transition naturally back to conversation. Ask about their taste or ask for a rec.
- Do NOT show any rec cards. Taste read only.
`,
      deliveredJobIds: jobIds,
      jobs,
    };
  } catch (err) {
    console.error("Failed to get agent results for delivery:", err);
    return { block: "", deliveredJobIds: [], jobs: [] };
  }
}

function buildTasteReadBlock(job) {
  const ta = job.taste_analysis;
  if (!ta || !ta.taste_thesis) return null;

  const sourceToCategory = {
    spotify: 'listen', apple_music: 'listen', soundcloud: 'listen',
    youtube: 'watch', letterboxd: 'watch',
    goodreads: 'read', google_maps: 'visit',
  };
  const sourceToName = {
    spotify: 'Spotify', apple_music: 'Apple Music', soundcloud: 'SoundCloud',
    youtube: 'YouTube', letterboxd: 'Letterboxd',
    goodreads: 'Goodreads', google_maps: 'Google Maps',
  };

  const sampleSize = job.raw_data?.items?.length || 0;

  // Calculate duration from job timestamps
  let durationSec = null;
  if (job.started_at && job.completed_at) {
    durationSec = Math.round((new Date(job.completed_at) - new Date(job.started_at)) / 1000);
  }

  return {
    type: "taste_read",
    data: {
      thesis: ta.taste_thesis,
      patterns: Array.isArray(ta.patterns) ? ta.patterns : [],
      genres: Array.isArray(ta.genres) ? ta.genres : [],
      primary_moods: Array.isArray(ta.primary_moods) ? ta.primary_moods : [],
      category: sourceToCategory[job.source_type] || 'other',
      source: {
        type: job.source_type,
        name: sourceToName[job.source_type] || job.source_type,
      },
      sample_size: sampleSize,
      total_items: sampleSize,
      duration_sec: durationSec,
    }
  };
}

// ── Detect URLs and create agent jobs ──
async function processUrlsForAgent(message, profileId, sb) {
  const urls = message.match(URL_REGEX) || [];
  const agentNotes = [];

  for (const url of urls) {
    try {
      const detection = detectSource(url);

      if (!detection.supported) {
        try {
          await sb.from("unsupported_source_requests").insert({
            profile_id: profileId, source_url: url, source_type: "unknown",
          });
        } catch (err) {
          console.error("Failed to log unsupported source:", err);
        }
        agentNotes.push({ url, type: "unsupported" });
        continue;
      }

      if (!detection.implemented) {
        agentNotes.push({ url, type: "coming_soon", sourceType: detection.sourceType, parserName: detection.parserName });
        continue;
      }

      // Check for existing job
      const { data: existing } = await sb.from("agent_jobs")
        .select("id, status")
        .eq("profile_id", profileId).eq("source_url", url)
        .in("status", ["pending", "processing", "completed"])
        .limit(1).maybeSingle();

      if (existing) {
        agentNotes.push({ url, type: "already_processing", sourceType: detection.sourceType, jobId: existing.id, status: existing.status });
        continue;
      }

      // Create agent job — processing happens separately via frontend
      const { data: job, error: jobErr } = await sb.from("agent_jobs")
        .insert({ profile_id: profileId, source_type: detection.sourceType, source_url: url, status: "pending" })
        .select("id").single();

      if (jobErr) {
        console.error("Failed to create agent job:", url, jobErr);
        continue;
      }

      agentNotes.push({ url, type: "agent_started", sourceType: detection.sourceType, jobId: job.id, classification: detection.classification });
    } catch (err) {
      console.error("Error processing URL for agent:", url, err);
    }
  }

  return agentNotes;
}

// ── Content Blocks helpers ──
function classifyMediaType(url, metadata) {
  if (url.includes('spotify.com')) return 'audio';
  if (url.includes('music.apple.com')) return 'audio';
  if (url.includes('soundcloud.com')) return 'audio';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
  if (url.includes('maps.google.com') || url.includes('maps.app.goo.gl')) return 'place';
  if (url.includes('letterboxd.com')) {
    return url.includes('/film/') ? 'article' : 'profile';
  }
  if (url.includes('goodreads.com')) return 'book';
  return 'article';
}

function hasEmbeddablePlayer(provider) {
  return ['Spotify', 'YouTube', 'SoundCloud', 'Apple Music'].includes(provider);
}

async function fetchLinkMetadataForBlocks(url) {
  let metadata = { title: null, source: null, author: null, thumbnail_url: null, embed_html: null };
  try {
    if (url.includes('spotify.com')) {
      metadata.source = 'Spotify';
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      if (res.ok) { const d = await res.json(); metadata.title = d.title; metadata.author = d.author_name || null; metadata.thumbnail_url = d.thumbnail_url || null; metadata.embed_html = d.html || null; }
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      metadata.source = 'YouTube';
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) { const d = await res.json(); metadata.title = d.title; metadata.author = d.author_name || null; metadata.thumbnail_url = d.thumbnail_url || null; metadata.embed_html = d.html || null; }
    } else if (url.includes('soundcloud.com')) {
      metadata.source = 'SoundCloud';
      const res = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) { const d = await res.json(); metadata.title = d.title; metadata.author = d.author_name || null; metadata.thumbnail_url = d.thumbnail_url || null; metadata.embed_html = d.html || null; }
    } else if (url.includes('music.apple.com')) {
      metadata.source = 'Apple Music';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CuratorsBot/1.0)' } });
      if (res.ok) { const html = await res.text(); const t = html.match(/<title[^>]*>([^<]+)<\/title>/i); if (t) metadata.title = t[1].trim(); }
    } else {
      metadata.source = 'Website';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CuratorsBot/1.0)' } });
      if (res.ok) { const html = await res.text(); const t = html.match(/<title[^>]*>([^<]+)<\/title>/i); if (t) metadata.title = t[1].trim(); }
    }
  } catch (err) {
    console.error('fetchLinkMetadataForBlocks error:', url, err);
  }
  return metadata;
}

function buildActionButtons(urls, aiText) {
  if (urls.length > 0) {
    return {
      type: "action_buttons",
      data: {
        options: [
          { label: "Taste read", action: "Do a taste read on this", style: "primary" },
          { label: urls.length > 1 ? "Capture these recs" : "Capture this rec", action: "Add as a recommendation", style: "primary" },
        ]
      }
    };
  }
  return null;
}

// ── Build agent notes for system prompt injection ──
function buildAgentUrlNotes(agentNotes) {
  if (!agentNotes || agentNotes.length === 0) return "";

  const lines = [];
  for (const note of agentNotes) {
    if (note.type === "link_detected") {
      lines.push(`URL DETECTED: ${note.url} — This is a ${sourceNameFromType(note.sourceType)} link. Acknowledge what you see (title, platform) and let the action buttons offer the choice. Do NOT start analyzing content yet.`);
    } else if (note.type === "coming_soon") {
      lines.push(`URL DETECTED: ${note.url} — This is a ${note.sourceType} link. I can't read this platform yet, but it's on my list. Be honest about it.`);
    } else if (note.type === "unsupported") {
      lines.push(`URL DETECTED: ${note.url} — I don't support this platform yet. Be honest. Ask them to tell you their favorites from there instead.`);
    }
  }

  return lines.length > 0 ? `\nURLs IN THIS MESSAGE:\n${lines.join("\n")}\n` : "";
}

export async function POST(request) {
  try {
    const {
      message, isVisitor, curatorName, curatorHandle, curatorBio,
      profileId, recommendations, linkMetadata, history,
      generateOpening, image,
    } = await request.json();

    if (!message && !generateOpening && !image) {
      return NextResponse.json({ message: "No message provided" }, { status: 400 });
    }

    const recCount = recommendations ? recommendations.length : 0;
    const hasBio = curatorBio && curatorBio.trim() !== '';

    // Detect mode: onboarding until 3+ recs AND bio, then standard
    const isOnboarding = !isVisitor && (recCount < 3 || !hasBio);
    const isStandard = !isVisitor && !isOnboarding;

    const sb = getSupabaseAdmin();

    // ── Agent integration (curator modes only, not visitor, not opening generation) ──
    let agentBlock = "";
    let agentNotes = [];

    if (!isVisitor && profileId && !generateOpening) {
      // Detect URLs in message for metadata — but do NOT create agent jobs.
      // Taste reads happen inline; agent jobs are reserved for future features.
      if (message) {
        const urls = message.match(URL_REGEX) || [];
        for (const url of urls) {
          const detection = detectSource(url);
          if (detection.supported && detection.implemented) {
            agentNotes.push({ url, type: "link_detected", sourceType: detection.sourceType, classification: detection.classification });
          } else if (detection.supported && !detection.implemented) {
            agentNotes.push({ url, type: "coming_soon", sourceType: detection.sourceType, parserName: detection.parserName });
          } else {
            agentNotes.push({ url, type: "unsupported" });
          }
        }
      }

      // Query existing agent jobs for pending/processing status (legacy jobs still in flight)
      try {
        const agentCtx = await getAgentContext(profileId, sb);
        agentBlock = agentCtx.agentBlock;
      } catch (agentErr) {
        console.error("getAgentContext failed:", agentErr.message);
      }

      // Check if curator is asking for agent results (legacy banner click)
      if (message) {
        const delivery = await getAgentResultsForDelivery(profileId, message, sb);
        if (delivery.block) {
          agentBlock += delivery.block;
        }
      }

      // Add URL-specific notes for this message
      const urlNotes = buildAgentUrlNotes(agentNotes);
      if (urlNotes) agentBlock += urlNotes;
    }

    // Build the recommendations context
    const curHandle = curatorHandle?.replace('@', '') || '';
    const recsContext = recommendations && recommendations.length > 0
      ? `\n\nCRITICAL: Only reference recommendations that appear in the CURRENT RECOMMENDATIONS LIST below. If something was discussed in previous chat messages but is NOT in the current list, the curator has deleted it. Never mention it, never reference it, pretend it never existed. The current list is the ONLY source of truth for what the curator recommends.\n\nCURRENT RECOMMENDATIONS LIST (${recommendations.length} total):\n${recommendations.map(r => {
          const slug = r.slug ? ` [link: /${curHandle}/${r.slug}]` : "";
          return `- ${r.title} [${r.category}] (added: ${r.date || 'unknown'}) — ${r.context || "No context"} (tags: ${(r.tags || []).join(", ")})${slug}`;
        }).join("\n")}`
      : "\n\nNo recommendations captured yet.";

    // Build the system prompt based on mode
    let systemPrompt;
    if (isVisitor) {
      // Fetch curator's style summary for visitor AI personality
      let styleBlock = "";
      if (profileId) {
        try {
          const { data: curatorProfile } = await sb
            .from("profiles")
            .select("style_summary")
            .eq("id", profileId)
            .single();
          if (curatorProfile?.style_summary) {
            const s = curatorProfile.style_summary;
            styleBlock = `\n\nCURATOR PERSONALITY (match this voice):
Voice: ${s.voice || "warm and direct"}
${s.voice_description || ""}
Energy: ${s.energy || "confident"}
Signature patterns: ${(s.signature_patterns || []).join(", ")}
Aesthetic threads: ${(s.aesthetic_threads || []).join(", ")}
${s.location ? `Location: ${s.location}` : ""}`;
          }
        } catch (err) {
          console.error("Failed to fetch style summary:", err);
        }
      }
      systemPrompt = `${VISITOR_SYSTEM_PROMPT}${styleBlock}\n\nCURATOR: ${curatorName}${recsContext}`;
    } else if (isOnboarding && profileId) {
      // Fetch taste profile for injection
      let tasteProfileBlock = '';
      try {
        const { data: tasteProfile } = await sb
          .from('taste_profiles')
          .select('content')
          .eq('profile_id', profileId)
          .single();
        if (tasteProfile?.content) {
          tasteProfileBlock = `\n\nCURATOR'S TASTE PROFILE:\n${tasteProfile.content}`;
        }
      } catch (err) {
        console.error('Failed to fetch taste profile:', err);
      }

      const inviterCtx = await getInviterContext(profileId);
      systemPrompt = buildOnboardingPrompt({
        curatorName,
        inviterName: inviterCtx.inviterName,
        inviterHandle: inviterCtx.inviterHandle,
        inviterNote: inviterCtx.inviterNote,
        tasteProfileBlock,
      }) + recsContext + agentBlock;
    } else {
      // Fetch taste profile for injection
      let tasteProfileBlock = '';
      try {
        const { data: tasteProfile } = await sb
          .from('taste_profiles')
          .select('content')
          .eq('profile_id', profileId)
          .single();
        if (tasteProfile?.content) {
          tasteProfileBlock = `\n\nCURATOR'S TASTE PROFILE:\n${tasteProfile.content}`;
        }
      } catch (err) {
        console.error('Failed to fetch taste profile:', err);
      }

      const networkContext = profileId ? await getSubscribedRecs(profileId) : '';
      systemPrompt = buildStandardPrompt({
        curatorName,
        curatorHandle: curatorHandle || '',
        curatorProfile: { bio: curatorBio, location: '' },
        networkContext,
        tasteProfileBlock,
      }) + recsContext + agentBlock;
    }

    // Handle opening message generation (no user message yet)
    if (generateOpening) {
      const openingMessages = [
        { role: "user", content: "Generate your opening message now. Follow the OPENING MESSAGE instructions exactly — use the inviter name, inviter note, and curator name provided in your system prompt. Output only the opening message, nothing else." },
      ];

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: systemPrompt,
        messages: openingMessages,
      });

      const aiMessage = response.content[0]?.text || "Hey! I'm here to learn what you're into. What's something you wish more people knew about?";
      return NextResponse.json({ message: aiMessage });
    }

    // Current rec titles for filtering
    const currentTitles = new Set((recommendations || []).map(r => r.title));

    // Build messages array from history, stripping deleted rec references
    const messages = [];

    if (history && history.length > 0) {
      const recent = history.slice(-10);
      for (const msg of recent) {
        let text = msg.text || "";
        // If this message captured a rec that's since been deleted, strip the capture data
        if (msg.capturedRec && !currentTitles.has(msg.capturedRec)) {
          // Replace capture card content referencing the deleted rec
          text = text.replace(/📍 Adding:.*$/ms, '[A recommendation was captured here but has since been removed by the curator.]');
        }
        // Note if the message originally included an image (base64 not stored in history)
        if (msg.imagePreview) {
          text = text ? `${text} [sent an image]` : "[sent an image]";
        }
        if (msg.role === "user") {
          messages.push({ role: "user", content: text });
        } else if (msg.role === "ai" || msg.role === "assistant") {
          messages.push({ role: "assistant", content: text });
        }
      }
    }

    // Add a reminder of current recs right before the user's message
    if (recommendations && recommendations.length > 0) {
      const titleList = recommendations.map(r => r.title).join(", ");
      messages.push({ role: "user", content: `REMINDER: My current recommendations are ONLY: ${titleList}. Do not reference anything not on this list.` });
      messages.push({ role: "assistant", content: "Understood. I'll only reference your current recommendations." });
    }

    // Add the current message — no metadata injection, URL is in the message text
    let currentMessageText = message || "What's this?";

    if (image && image.base64 && image.mimeType) {
      // Strip data URI prefix — Claude expects raw base64
      const base64Data = image.base64.replace(/^data:image\/[^;]+;base64,/, "");
      messages.push({
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mimeType, data: base64Data } },
          { type: "text", text: currentMessageText },
        ],
      });
    } else {
      messages.push({ role: "user", content: currentMessageText });
    }

    // Ensure messages alternate properly (Claude requires this)
    const cleanedMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = cleanedMessages[cleanedMessages.length - 1];
      if (prev && prev.role === msg.role) {
        // Merge consecutive same-role messages (skip if either is multimodal array content)
        if (Array.isArray(prev.content) || Array.isArray(msg.content)) {
          cleanedMessages.push({ ...msg });
          continue;
        }
        prev.content += "\n" + msg.content;
      } else {
        cleanedMessages.push({ ...msg });
      }
    }

    // Ensure first message is from user
    if (cleanedMessages.length > 0 && cleanedMessages[0].role !== "user") {
      cleanedMessages.shift();
    }

    const maxTokens = agentBlock.includes('AGENT RESULTS READY') ? 800 : 600;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: cleanedMessages,
    });

    const aiMessage = response.content[0]?.text || "Sorry, I couldn't generate a response.";

    if (profileId) {
      console.log('TRACKING: sent a message, profileId:', profileId);
      const { error: trackingError } = await sb.from('profiles').update({
        last_seen_at: new Date().toISOString(),
        last_action: 'sent a message',
        last_action_at: new Date().toISOString()
      }).eq('id', profileId);
      if (trackingError) console.error('TRACKING ERROR:', trackingError);
    }

    // ── Build content blocks ──
    const detectedUrls = message ? (message.match(URL_REGEX) || []) : [];

    let mediaEmbeds = [];
    if (!isVisitor && !generateOpening && detectedUrls.length > 0) {
      mediaEmbeds = await Promise.all(
        detectedUrls.map(async (url) => {
          try {
            const metadata = await fetchLinkMetadataForBlocks(url);
            const provider = metadata.source || "generic";
            return {
              type: "media_embed",
              data: {
                url,
                provider,
                title: metadata.title || url,
                author: metadata.author || null,
                description: null,
                thumbnail_url: metadata.thumbnail_url || null,
                media_type: classifyMediaType(url, metadata),
                has_embed: hasEmbeddablePlayer(provider),
                embed_html: metadata.embed_html || null,
                rating: null,
              }
            };
          } catch (e) {
            console.error('MediaEmbed fetch error:', url, e);
            return {
              type: "media_embed",
              data: {
                url, provider: "generic", title: url, author: null,
                description: null, thumbnail_url: null, media_type: "article",
                has_embed: false, embed_html: null, rating: null,
              }
            };
          }
        })
      );
    }

    const blocks = [];
    blocks.push(...mediaEmbeds);

    // Extract rec capture from AI text
    const recCapture = extractRecCapture(aiMessage);

    // Validate context against actual curator messages — prevents hallucinated context
    if (recCapture) {
      validateRecContext(recCapture, history, message);
    }

    // Strip [REC]...[/REC] from the text block content so it doesn't render as raw JSON
    const cleanedAiMessage = aiMessage.replace(/\[REC\][\s\S]*?\[\/REC\]/, '').trim();

    blocks.push({ type: "text", data: { content: cleanedAiMessage } });

    if (recCapture) {
      // Server-side fallback: if Claude forgot to include the curator's pasted URL, inject it
      if ((!recCapture.links || recCapture.links.length === 0) && detectedUrls.length > 0) {
        recCapture.links = detectedUrls.map(url => {
          let label = '';
          try { label = new URL(url).hostname.replace('www.', ''); } catch { label = 'Link'; }
          return { url, label, type: 'website' };
        });
      }
      blocks.push({
        type: "rec_capture",
        data: recCapture
      });
    }

    // Only show link intent buttons if NO rec was captured
    if (!recCapture) {
      const actionButtons = buildActionButtons(detectedUrls, cleanedAiMessage);
      if (actionButtons) blocks.push(actionButtons);
    }

    return NextResponse.json({
      message: aiMessage,
      blocks: blocks,
      captured_rec: recCapture || undefined,
    });
  } catch (error) {
    console.error("Chat API error:", error?.message || error);
    console.error("Chat API stack:", error?.stack || "no stack");
    return NextResponse.json(
      { message: "Sorry, I'm having trouble right now. Try again in a moment." },
      { status: 500 }
    );
  }
}
