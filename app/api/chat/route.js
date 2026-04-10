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
import { URL_REGEX, normalizeUrls, findRecentUrl, isTasteReadIntent, parseContentForTasteRead, buildAgentUrlNotes, distillForReinjection } from "../../../lib/chat/link-parsing.js";
import { buildMediaEmbedBlocks } from "../../../lib/chat/media-embeds.js";
import { uploadArtifact } from "../../../lib/rec-files/artifact.js";

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
    let originalParsedContentLength = 0;
    let linkContextCapped = false;

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

      // ── Hard cap on total parsed content injected into system prompt ──
      const LINK_CONTEXT_CAP = 40000;
      originalParsedContentLength = parsedLinkBlocks.reduce((sum, b) => sum + (b.content?.length || 0), 0);
      linkContextCapped = originalParsedContentLength > LINK_CONTEXT_CAP;
      if (linkContextCapped) {
        console.warn(`[LINK_CONTEXT_CAPPED] original_length=${originalParsedContentLength} capped_to=${LINK_CONTEXT_CAP} blocks=${parsedLinkBlocks.length}`);
        const ratio = LINK_CONTEXT_CAP / originalParsedContentLength;
        for (const block of parsedLinkBlocks) {
          if (block.content) {
            const allowance = Math.floor(block.content.length * ratio);
            block.content = block.content.slice(0, allowance) + '\n\n[content truncated due to length]';
          }
        }
      }

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

    // ── Re-inject parsed content from recent messages for follow-up turns ──
    // If the current message has no URLs but a recent message has parsed_content,
    // re-inject it so the AI can continue discussing the link accurately.
    // Only look within the last 5 messages (if the link is older, conversation moved on).
    const hasNewParsedContent = parsedLinkBlocks.some(b => b.quality !== 'failed');
    if (!isVisitor && profileId && !generateOpening && !hasNewParsedContent) {
      try {
        const { data: recentMessages } = await sb
          .from('chat_messages')
          .select('parsed_content')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentMessages) {
          const withContent = recentMessages.find(m => m.parsed_content && m.parsed_content.length > 0);
          if (withContent) {
            // Distill each block down to a bounded reference (~800 chars max).
            // Cap at 2 blocks total to protect context window -- if an earlier
            // message had 3+ URLs, we only replay the most relevant 2.
            // Deploy 4: fixes the context bloat / hallucination bug where
            // 60KB articles were being re-injected verbatim on every turn.
            const REINJECT_BLOCK_CAP = 2;
            let injectedCount = 0;
            for (const block of withContent.parsed_content) {
              if (injectedCount >= REINJECT_BLOCK_CAP) break;
              const distilled = distillForReinjection(block);
              if (distilled) {
                linkContextBlock += distilled;
                injectedCount++;
              }
            }
            if (injectedCount > 0) {
              const urls = withContent.parsed_content.slice(0, injectedCount).map(b => b.url).join(',');
              console.log(`[REINJECTION_APPLIED] profile=${profileId} blocks=${injectedCount} urls=${urls}`);
            }
          }
        }
      } catch (err) {
        console.error('[PARSED_CONTENT_REINJECTION_ERROR]', err.message);
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

      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 400,
          system: systemPrompt,
          messages: openingMessages,
        });

        const aiMessage = response.content[0]?.text || "Hey! I'm here to learn what you're into. What's something you wish more people knew about?";
        return NextResponse.json({ message: aiMessage });
      } catch (openingErr) {
        console.error(`[OPENING_API_ERROR] status=${openingErr.status || 'unknown'} type=${openingErr.error?.type || 'unknown'} profileId=${profileId} message=${openingErr.message}`);
        // Return a graceful fallback opening instead of crashing
        const name = curatorName?.split(' ')[0] || curatorName || 'there';
        return NextResponse.json({ message: `Hey ${name}! I'm your Record. I'm here to learn what you're into and help you capture it.\n\nWhat's something you've been recommending to everyone lately?` });
      }
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
        // Bug 1 fix: skip empty-text history messages that would crash Claude API
        if (!text.trim()) continue;
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
      console.error(`[CHAT_API_ERROR] status=${apiError.status || 'unknown'} type=${apiError.error?.type || 'unknown'} message=${apiError.message} duration_ms=${durationMs} profileId=${profileId} systemPromptLength=${systemPrompt.length} messagesCount=${cleanedMessages.length} parsedContentOriginalLength=${originalParsedContentLength} capFired=${linkContextCapped}`);

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

    // ── Feature B: persist image to artifacts + infer metadata for save prompt ──
    let imageRecCandidate = null;
    if (image && image.base64 && image.mimeType && profileId && !isVisitor) {
      try {
        // (a) Decode base64 to bytes and upload to artifacts bucket
        const rawBase64 = image.base64.replace(/^data:image\/[^;]+;base64,/, "");
        const imageBytes = Buffer.from(rawBase64, "base64");
        const artifactResult = await uploadArtifact(sb, profileId, imageBytes, image.mimeType);

        // (b) Generate signed URL for preview (1 hour expiry)
        let signedUrl = null;
        const { data: signedData, error: signedErr } = await sb
          .storage
          .from("artifacts")
          .createSignedUrl(artifactResult.path, 3600);
        if (signedErr) {
          console.error(`[CHAT_API_ERROR] feature_b_signed_url error=${signedErr.message} profileId=${profileId}`);
        } else {
          signedUrl = signedData.signedUrl;
        }

        // (c) Second Claude call to infer rec metadata from the image
        if (signedUrl) {
          const inferBase64 = rawBase64;
          const inferMessages = [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: image.mimeType, data: inferBase64 } },
                ...(message ? [{ type: "text", text: message }] : []),
              ],
            },
          ];

          const inferResponse = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 400,
            system: `You are extracting recommendation metadata from an image a curator just shared. Respond with ONLY a JSON object, no prose, no markdown fences:\n{"title": "<short title, max 60 chars>", "category": "<one of: watch, listen, read, visit, get, wear, play, other>", "suggested_why": "<one sentence describing what makes this save-worthy, max 140 chars>"}\nIf the image is not save-worthy as a recommendation (e.g. a screenshot of an error, a blank image, a personal photo with no recommendation context), respond with: {"skip": true}`,
            messages: inferMessages,
          });

          const inferText = (inferResponse.content[0]?.text || "").trim();
          // (d) Parse JSON — strip markdown fences if present
          const cleanedInfer = inferText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
          try {
            const inferred = JSON.parse(cleanedInfer);
            if (!inferred.skip && inferred.title && inferred.category) {
              // (e) Build imageRecCandidate
              imageRecCandidate = {
                sha256: artifactResult.sha256,
                artifactRef: artifactResult.ref,
                artifactPath: artifactResult.path,  // for signed URL regeneration on DB reload
                signedUrl,
                mimeType: image.mimeType,
                sizeBytes: imageBytes.length,
                inferred: {
                  title: inferred.title,
                  category: inferred.category,
                  suggested_why: inferred.suggested_why || "",
                },
              };
            }
          } catch (parseErr) {
            console.error(`[CHAT_API_ERROR] feature_b_infer_parse error=${parseErr.message} raw=${cleanedInfer.substring(0, 200)} profileId=${profileId}`);
          }
        }
      } catch (featureBErr) {
        console.error(`[CHAT_API_ERROR] feature_b_pipeline error=${featureBErr.message} profileId=${profileId}`);
      }
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

    // Feature C: emit save prompt buttons when a fresh URL was parsed successfully.
    // One button per successfully parsed URL (typically 1, capped at 3 URLs per message
    // by the existing URL regex slice). Skip on failed parses — nothing to save.
    // Skip if the AI already captured a rec in this turn (recCapture is set) — no
    // need to double up the save prompt.
    if (hasNewParsedContent && !recCapture) {
      const successfulBlocks = parsedLinkBlocks.filter(
        b => b.quality === "full" || b.quality === "partial"
      );
      if (successfulBlocks.length > 0) {
        const firstUrl = successfulBlocks[0].url;
        blocks.push({
          type: "action_buttons",
          data: {
            prompt: "Want to add this to your archive?",
            options: [
              {
                label: "Save as a Recommendation",
                action: `save_rec_from_chat:${firstUrl}`,
                style: "primary",
              },
              {
                label: "Not Now",
                action: "skip_save",
              },
            ],
          },
        });
      }
    }

    // Feature B: emit save prompt buttons when an image was persisted and inference succeeded.
    // Image candidate wins over recCapture -- if Claude emitted a rogue [REC] from the image,
    // suppress it so we don't double-save. The action button is the canonical save path for images.
    if (imageRecCandidate) {
      recCapture = null;
    }

    // Skip if Feature C already emitted action_buttons (hasNewParsedContent).
    if (imageRecCandidate && !hasNewParsedContent) {
      blocks.push({
        type: "action_buttons",
        data: {
          prompt: "Want to add this to your archive?",
          options: [
            {
              label: "Save as a Recommendation",
              action: `save_image_rec:${imageRecCandidate.sha256}`,
              style: "primary",
            },
            {
              label: "Not Now",
              action: "skip_save",
            },
          ],
        },
      });
    }

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

    // ── Persist parsed content on the user's most recent chat_messages row ──
    // Done server-side with service role key (bypasses RLS -- frontend update silently fails)
    const parsedContentForStorage = parsedLinkBlocks
      .filter(b => b.quality !== 'failed')
      .map(b => ({ url: b.url, content: b.content, metadata: b.metadata, quality: b.quality, sourceType: b.sourceType }));

    if (parsedContentForStorage.length > 0 && profileId) {
      try {
        const { data: latestUserMsg } = await sb
          .from('chat_messages')
          .select('id')
          .eq('profile_id', profileId)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestUserMsg) {
          const { error: updateErr } = await sb
            .from('chat_messages')
            .update({ parsed_content: parsedContentForStorage })
            .eq('id', latestUserMsg.id);
          if (updateErr) {
            console.error('[PARSED_CONTENT_SAVE_ERROR]', updateErr.message);
          } else {
            console.log(`[PARSED_CONTENT_SAVED] msgId=${latestUserMsg.id} blocks=${parsedContentForStorage.length}`);
          }
        }
      } catch (err) {
        console.error('[PARSED_CONTENT_SAVE_ERROR]', err.message);
      }
    }

    return NextResponse.json({
      message: aiMessage,
      blocks: blocks,
      captured_rec: recCapture || undefined,
      // Feature C: return parsed_content so the frontend can look up parsed data
      // when the curator taps "Save as a Recommendation" from a chat action button.
      parsed_content: parsedContentForStorage.length > 0 ? parsedContentForStorage : undefined,
      // Feature B: return imageRecCandidate so the frontend can look up inferred metadata
      // when the curator taps "Save as a Recommendation" from an image action button.
      image_rec_candidate: imageRecCandidate || undefined,
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
