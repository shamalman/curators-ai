import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { detectSource } from "../../../lib/agent/registry.js";
import { buildOnboardingPrompt } from "../../../lib/prompts/onboarding.js";
import { buildStandardPrompt } from "../../../lib/prompts/standard.js";
import { buildVisitorPrompt } from "../../../lib/prompts/visitor.js";
import { extractRecCapture, validateRecContext } from "../../../lib/chat/rec-extraction.js";
import { getSubscribedRecs } from "../../../lib/chat/network-context.js";
import { getInviterContext } from "../../../lib/chat/inviter-context.js";
import { URL_REGEX, normalizeUrls, findRecentUrl, isTasteReadIntent, parseContentForTasteRead, buildAgentUrlNotes } from "../../../lib/chat/link-parsing.js";
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

export async function POST(request) {
  try {
    const {
      message, isVisitor, curatorName, curatorHandle, curatorBio,
      profileId, recommendations, history,
      generateOpening, image,
    } = await request.json();

    if (!message && !generateOpening && !image) {
      return NextResponse.json({ message: "No message provided" }, { status: 400 });
    }

    const recCount = recommendations ? recommendations.length : 0;
    const hasBio = curatorBio && curatorBio.trim() !== '';

    // Detect mode: onboarding until 3+ recs AND bio, then standard
    const isOnboarding = !isVisitor && (recCount < 3 || !hasBio);

    const sb = getSupabaseAdmin();

    // ── Link parsing (curator modes only, not visitor, not opening generation) ──
    let linkContextBlock = "";
    let agentNotes = [];
    let parsedLinkBlocks = [];

    if (!isVisitor && profileId && !generateOpening) {
      // Detect URLs in message and parse ALL synchronously before calling Claude (cap at 3 links)
      // Normalize bare domains (Safari strips https:// when copying from address bar)
      if (message) {
        const normalizedMessage = normalizeUrls(message);
        const urls = (normalizedMessage.match(URL_REGEX) || []).slice(0, 3);

        // Parse all URLs concurrently for speed
        const parseResults = await Promise.all(
          urls.map(async (url) => {
            const parsed = await parseContentForTasteRead(url);
            return { url, ...parsed };
          })
        );

        for (const result of parseResults) {
          if (result.quality === 'full' || result.quality === 'partial') {
            parsedLinkBlocks.push({
              url: result.url,
              metadata: result.metadata,
              content: result.content,
              quality: result.quality,
              sourceType: result.sourceType,
              parseTimeMs: result.parseTimeMs,
            });
            agentNotes.push({ url: result.url, type: "link_parsed", sourceType: result.sourceType });
          } else {
            agentNotes.push({ url: result.url, type: "link_parse_failed", sourceType: result.sourceType, error: result.error });
            // Track failed parses for logging too
            parsedLinkBlocks.push({
              url: result.url,
              quality: 'failed',
              sourceType: result.sourceType,
              parseTimeMs: result.parseTimeMs,
              error: result.error,
            });
          }
        }
      }

      // Add URL-specific notes for this message
      const urlNotes = buildAgentUrlNotes(agentNotes);
      if (urlNotes) linkContextBlock += urlNotes;

      // Inject parsed link content into prompt with quality signals
      for (const block of parsedLinkBlocks) {
        const meta = block.metadata || {};
        if (block.quality === 'full') {
          linkContextBlock += `\n\n=== PARSED LINK CONTENT (${block.url}) ===
Quality: FULL -- you have the complete content. Reference it specifically.
${meta.title ? `Title: ${meta.title}` : ''}
${meta.providerName || meta.source ? `Provider: ${meta.providerName || meta.source}` : ''}
${meta.author ? `Author: ${meta.author}` : ''}

${block.content}
=== END PARSED CONTENT ===`;
        } else if (block.quality === 'partial') {
          linkContextBlock += `\n\n=== PARSED LINK CONTENT (${block.url}) ===
Quality: PARTIAL -- you have some content but not everything.
Name the specific items you can see. Acknowledge you have a sample, not the full content.
${meta.title ? `Title: ${meta.title}` : ''}
${meta.providerName || meta.source ? `Provider: ${meta.providerName || meta.source}` : ''}
${meta.author ? `Author: ${meta.author}` : ''}

${block.content}
=== END PARSED CONTENT ===`;
        }
      }

      // Add explicit FAILED blocks for URLs that couldn't be parsed
      for (const note of agentNotes) {
        if (note.type === 'link_parse_failed') {
          linkContextBlock += `\n\n=== LINK PARSE FAILED (${note.url}) ===
You could NOT read this link. Do NOT describe, summarize, or reference its contents.
Tell the curator honestly: "I couldn't read that link. Can you paste the content or tell me about it?"
=== END ===`;
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
      systemPrompt = buildVisitorPrompt({ curatorName, styleBlock, recsContext });
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
      }) + recsContext + linkContextBlock;
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
      }) + recsContext + linkContextBlock;
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

        if (parsed.quality === 'failed') {
          systemPrompt += `\n\n=== LINK PARSE FAILED (${recentUrl.url}) ===\nThe curator asked for a taste read but parsing failed: ${parsed.error}\nYou could NOT read this link. Do NOT describe, summarize, or reference its contents.\nTell the curator honestly: "I couldn't read that link. Can you paste the content or tell me about it?"\n=== END ===`;
          console.error(`[TASTE_READ_TIMING] url=${recentUrl.url} parser=${parsed.parserName} duration_ms=${durationMs} status=error`);
          // Track failed parse
          parsedLinkBlocks.push({ url: recentUrl.url, quality: 'failed', sourceType: parsed.sourceType, parseTimeMs: durationMs, error: parsed.error });
        } else {
          hasLinkContent = true;
          const meta = parsed.metadata;
          const qualityLabel = parsed.quality === 'full' ? 'FULL' : 'PARTIAL';
          const qualityNote = parsed.quality === 'full'
            ? 'you have the complete content. Reference it specifically.'
            : 'you have some content but not everything. Name the specific items you can see.';
          systemPrompt += `\n\n=== PARSED LINK CONTENT (${recentUrl.url}) ===
Quality: ${qualityLabel} -- ${qualityNote}
The curator wants you to engage with this link they shared earlier.
Title: ${meta.title || 'Unknown'}
Provider: ${meta.providerName || meta.source || 'Unknown'}
Author: ${meta.author || 'Unknown'}

${parsed.content}
=== END PARSED CONTENT ===`;

          parsedLinkBlocks.push({ url: recentUrl.url, quality: parsed.quality, metadata: parsed.metadata, content: parsed.content, sourceType: parsed.sourceType, parseTimeMs: durationMs });
          console.log(`[TASTE_READ_TIMING] url=${recentUrl.url} parser=${parsed.parserName} quality=${parsed.quality} duration_ms=${durationMs} status=success`);
          if (durationMs > 45000) {
            console.warn(`[TASTE_READ_SLOW] url=${recentUrl.url} parser=${parsed.parserName} duration_ms=${durationMs} -- approaching Vercel timeout`);
          }
        }
      }
    }

    const maxTokens = hasLinkContent ? 1000 : 600;

    let response;
    const apiStart = Date.now();
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: cleanedMessages,
      });
    } catch (apiError) {
      const durationMs = Date.now() - apiStart;
      const isTimeout = apiError.status === 408 || apiError.error?.type === 'timeout' || /timeout/i.test(apiError.message);

      if (isTimeout) {
        console.error(`[CHAT_API_TIMEOUT] duration_ms=${durationMs} profileId=${profileId} mode=${isVisitor ? 'visitor' : isOnboarding ? 'onboarding' : 'standard'}`);
      }
      console.error(`[CHAT_API_ERROR] status=${apiError.status || 'unknown'} type=${apiError.error?.type || 'unknown'} duration_ms=${durationMs} profileId=${profileId} message=${apiError.message}`);

      const friendlyMessage = "I'm having trouble thinking right now. Give me a moment and try again.";
      return NextResponse.json({
        message: friendlyMessage,
        blocks: [{ type: "text", data: { content: friendlyMessage } }],
      });
    }

    let aiMessage = response.content[0]?.text || "Sorry, I couldn't generate a response.";

    // ── Extract and process feedback if present ──
    const feedbackMatch = aiMessage.match(/\[FEEDBACK\]([\s\S]*?)\[\/FEEDBACK\]/);
    if (feedbackMatch) {
      try {
        const feedback = JSON.parse(feedbackMatch[1].trim());

        // Save to feedback table
        const { error: fbError } = await sb.from('feedback').insert({
          profile_id: profileId,
          message: feedback.message,
          summary: feedback.summary,
          category: feedback.type,
        });
        if (fbError) {
          console.error('[FEEDBACK_DB_ERROR]', fbError.message);
        }

        // Send email notification to founder
        try {
          const { resend } = await import('../../../lib/resend.js');
          await resend.emails.send({
            from: 'Curators AI <noreply@curators.ai>',
            to: process.env.FEEDBACK_EMAIL || 'shamal@curators.ai',
            subject: `[Feedback] ${feedback.type}: ${feedback.summary}`,
            text: `Feedback from ${curatorName} (@${curatorHandle}):\n\n"${feedback.message}"\n\nType: ${feedback.type}\nSummary: ${feedback.summary}`,
          });
        } catch (emailErr) {
          console.error('[FEEDBACK_EMAIL_ERROR]', emailErr.message);
        }

        console.log(`[FEEDBACK_CAPTURED] profile=${profileId} type=${feedback.type} summary=${feedback.summary}`);
      } catch (parseErr) {
        console.error('[FEEDBACK_PARSE_ERROR]', parseErr.message);
      }

      // Strip the [FEEDBACK] block from the visible message
      aiMessage = aiMessage.replace(/\[FEEDBACK\][\s\S]*?\[\/FEEDBACK\]/, '').trim();
    }

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
    const detectedUrls = message ? (normalizeUrls(message).match(URL_REGEX) || []) : [];

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

    // ── Log link parse results (awaited -- fire-and-forget drops on Vercel Lambda shutdown) ──
    if (parsedLinkBlocks.length > 0 && profileId) {
      const HONEST_PHRASES = ["couldn't read", "can't read", "couldn't access", "can't access", "unable to read", "couldn't open", "paste the text", "paste the content", "tell me about it", "tell me what"];
      const aiLower = aiMessage.toLowerCase();

      const logInserts = parsedLinkBlocks.map(block => {
        const aiAcknowledgedFailure = block.quality === 'failed'
          ? HONEST_PHRASES.some(p => aiLower.includes(p))
          : null;

        return sb.from('link_parse_log').insert({
          profile_id: profileId,
          url: block.url,
          source_type: block.sourceType || 'unknown',
          parse_quality: block.quality,
          content_length: block.content?.length || 0,
          parse_time_ms: block.parseTimeMs || null,
          error_message: block.error || null,
          ai_response_excerpt: aiMessage.substring(0, 500),
          ai_acknowledged_failure: aiAcknowledgedFailure,
          metadata: block.metadata || null,
        });
      });

      const logResults = await Promise.all(logInserts);
      for (const { error } of logResults) {
        if (error) console.error('[LINK_PARSE_LOG_ERROR]', error.message);
      }
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
