import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { detectSource, getParser } from "../../../lib/agent/registry.js";
import { buildOnboardingPrompt } from "../../../lib/prompts/onboarding.js";
import { buildStandardPrompt } from "../../../lib/prompts/standard.js";
import { extractRecCapture, validateRecContext } from "../../../lib/chat/rec-extraction.js";
import { getSubscribedRecs } from "../../../lib/chat/network-context.js";
import { getInviterContext } from "../../../lib/chat/inviter-context.js";
import { URL_REGEX, sourceNameFromType, findRecentUrl, isTasteReadIntent, parseContentForTasteRead, buildAgentUrlNotes } from "../../../lib/chat/link-parsing.js";
import { buildMediaEmbedBlocks } from "../../../lib/chat/media-embeds.js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-no-log": "true"
  }
});

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
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

    // Track parsed link content for prompt injection
    let parsedLinkBlocks = [];

    if (!isVisitor && profileId && !generateOpening) {
      // Detect URLs in message and parse content inline (cap at 3 links)
      if (message) {
        const urls = (message.match(URL_REGEX) || []).slice(0, 3);
        for (const url of urls) {
          const detection = detectSource(url);
          if (detection.supported && detection.implemented) {
            const parsed = await parseContentForTasteRead(url);
            if (parsed.error) {
              agentNotes.push({ url, type: "link_parse_failed", sourceType: detection.sourceType, error: parsed.error });
            } else {
              agentNotes.push({ url, type: "link_parsed", sourceType: detection.sourceType });
              parsedLinkBlocks.push({ url, metadata: parsed.metadata, content: parsed.content });
            }
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

      // Inject parsed link content into prompt
      if (parsedLinkBlocks.length > 0) {
        for (const block of parsedLinkBlocks) {
          const meta = block.metadata;
          agentBlock += `\n\n## Content from Shared Link
The curator shared this link in their message.
URL: ${block.url}
Title: ${meta.title || 'Unknown'}
Provider: ${meta.providerName || meta.source || 'Unknown'}
Author: ${meta.author || 'Unknown'}

Parsed content:
${block.content}

You now have the actual content from this link. Use it naturally in conversation.
If the curator is talking about it, engage with specifics from the content.
If they ask for a taste read, deliver one using this content and their taste profile.
If they want to capture it as a rec, ask for their context first.
Do NOT say "I can't read this link" or "I don't have access to the content." You have it.`;
        }
      }
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

    // ── Taste read on previous link: curator says "read those links" without pasting a new URL ──
    let hasLinkContent = parsedLinkBlocks.length > 0;

    if (!isVisitor && !generateOpening && message && !hasLinkContent && isTasteReadIntent(message)) {
      const tasteReadStart = Date.now();
      const recentUrl = findRecentUrl(history, null);

      if (recentUrl) {
        const parsed = await parseContentForTasteRead(recentUrl.url);
        const durationMs = Date.now() - tasteReadStart;

        if (parsed.error) {
          systemPrompt += `\n\n## Taste Read Error\nThe curator asked for a taste read but parsing failed: ${parsed.error}\nAcknowledge the error naturally and suggest alternatives (paste again, send a screenshot, tell you about it).`;
          console.error(`[TASTE_READ_TIMING] url=${recentUrl.url} parser=${parsed.parserName} duration_ms=${durationMs} status=error`);
        } else {
          hasLinkContent = true;
          const meta = parsed.metadata;
          systemPrompt += `\n\n## Content from Shared Link
The curator wants you to engage with this link they shared earlier.
URL: ${recentUrl.url}
Title: ${meta.title || 'Unknown'}
Provider: ${meta.providerName || meta.source || 'Unknown'}
Author: ${meta.author || 'Unknown'}

Parsed content:
${parsed.content}

You now have the actual content from this link. Use it naturally in conversation.
Connect what you find to patterns in their existing taste.
Be specific: name actual items, tracks, dishes, films from the content.
Do NOT say "I can't read this link" or "I don't have access to the content." You have it.`;

          console.log(`[TASTE_READ_TIMING] url=${recentUrl.url} parser=${parsed.parserName} duration_ms=${durationMs} status=success`);
          if (durationMs > 45000) {
            console.warn(`[TASTE_READ_SLOW] url=${recentUrl.url} parser=${parsed.parserName} duration_ms=${durationMs} -- approaching Vercel timeout`);
          }
        }
      }
    }

    const maxTokens = hasLinkContent ? 1000 : (agentBlock.includes('AGENT RESULTS READY') ? 800 : 600);

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
      mediaEmbeds = await buildMediaEmbedBlocks(detectedUrls, parsedLinkBlocks);
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
