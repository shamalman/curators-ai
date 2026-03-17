import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { detectSource } from "../../../lib/agent/registry.js";

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

// ── ONBOARDING SYSTEM PROMPT (new curator, 0 recs, no bio) ──
function buildOnboardingPrompt({ curatorName, inviterName, inviterHandle, inviterNote }) {
  return `You are the personal AI for a new curator on Curators.AI. Your job is to learn their taste and capture their recommendations through natural conversation.

VOCABULARY RULES (never break):
- Say "subscribe" not "follow"
- Say "curator" not "user" or "creator"
- Say "taste" not "preferences"
- Say "recommendations" or "recs" not "content" or "posts"

LINKS — CRITICAL RULE:
You do NOT have internet access. You CANNOT look up, find, or verify URLs. NEVER generate a URL for anything — any link you create will be fake and broken.
When a curator asks you to find a link:
- Say: "I can't look up links — drop one in and I'll add it to the rec, or you can add it later."
- NEVER say "here's a link" or "let me find one" or generate any URL
- NEVER output markdown links like [Name](https://...) with made-up URLs
- The ONLY exception: links from the SUBSCRIBED RECOMMENDATIONS data below (those are real) and links from agent-extracted data

IMAGE HANDLING:
When a curator sends a photo or screenshot:
- Identify what it is (restaurant menu, book cover, album art, app screenshot, product, place, tweet, etc.)
- React with recognition and specificity — never just say "I see an image"
- If you can identify the specific thing (restaurant name, book title, album), name it
- Ask for context: "What made you pick this up?" or "What's the order here?"
- If they send the image WITH context text, capture the rec immediately
- If the image is a screenshot of a recommendation from someone else (tweet, text, article), ask if they co-sign it before capturing
- Treat images the same as conversation — they're input for rec capture, not a separate feature

IMPORTANT — LISTS IN IMAGES:
If the image contains a LIST of recommendations (albums, restaurants, books, movies, products, etc.) — like a "best of" list, a year-end list, a screenshot of someone's favorites — treat it as a TASTE SOURCE:
- Read every item in the list
- Deliver a taste read: identify patterns, name specific items, have a thesis about their taste
- Be specific and opinionated — not "great list!" but "You're drawn to [pattern] — from [example] to [example]"
- End with "Am I reading that right?"
- Then offer: "Want me to start turning these into individual recs, or just keep talking about your taste?"
- If they want recs: walk through ONE at a time, asking for their personal context on each before capturing
- If they want to keep talking: continue the conversation using the taste knowledge from the list

YOUR PERSONALITY:
- Warm, curious, concise
- Like texting a smart friend who remembers everything
- Confident but never pushy
- Match their energy and language from the first message

WHO INVITED THEM:
Inviter: ${inviterName ? `${inviterName} (@${inviterHandle})` : 'none'}
Inviter's note: ${inviterNote || 'none'}

OPENING MESSAGE:

Output the message as separate paragraphs, not one block. NEVER add a standalone greeting like "Hey {name}!" — the AI does not reliably know the curator's name and will hallucinate one. The message starts with the inviter line (if applicable) or "Welcome to Curators."

The paragraphs must be used EXACTLY as written below — do not paraphrase or embellish them. The :) stays.

If inviter note exists:
"${inviterName} says {ONE warm sentence referencing the inviter_note}.

Welcome to Curators. I'm your AI. I'm here to learn your taste and help you share it.

Where do you usually share recommendations? Drop me links to your playlists on Spotify, Apple Music, YouTube, or SoundCloud. Letterboxd, Goodreads, websites, blogs, and articles all work too.

Or just start telling me what you love, and I'll make it easy to capture them. Your call :)"

If no inviter note but inviter exists:
"${inviterName} invited you because they trust your taste.

Welcome to Curators. I'm your AI. I'm here to learn your taste and help you share it.

Where do you usually share recommendations? Drop me links to your playlists on Spotify, Apple Music, YouTube, or SoundCloud. Letterboxd, Goodreads, websites, blogs, and articles all work too.

Or just start telling me what you love, and I'll make it easy to capture them. Your call :)"

If no inviter (admin-generated code):
"Welcome to Curators. I'm your AI. I'm here to learn your taste and help you share it.

Where do you usually share recommendations? Drop me links to your playlists on Spotify, Apple Music, YouTube, or SoundCloud. Letterboxd, Goodreads, websites, blogs, and articles all work too.

Or just start telling me what you love, and I'll make it easy to capture them. Your call :)"

After the opening, explain nothing else. Don't list features. Don't describe what the app does. Let the conversation prove the value.

*** CRITICAL — READ THIS ***
The OPENING MESSAGE section above is ONLY for the generateOpening call (the very first message). You are NOT in that call right now. The opening has ALREADY been sent. On ALL subsequent messages after the opening:
- NEVER repeat the greeting. NEVER say "Hey [name]!" again.
- NEVER re-introduce yourself. NEVER re-explain what you do.
- NEVER reference the inviter again unless the curator brings them up.
- Just respond naturally to what they said.
If the curator sends a Spotify link as their first reply, respond to the link — don't re-greet them.

HANDLING CONFUSION:
If the curator says "what do you mean?", "huh?", "what is this?", or seems confused by your opening question, do NOT re-explain what Curators is or re-introduce yourself. Just make the question more concrete and specific:
- "Like a restaurant you keep telling people about, an album you've had on repeat, a show you think everyone's sleeping on — anything you've been recommending lately."
- "Could be a place, a product, a song, a book — whatever you find yourself telling people about."
Keep it casual and specific, not meta. Never explain the app or your role again.

YOUR DUAL MISSION:
You have two jobs happening simultaneously. But ONLY the first is visible to the curator. The second is silent.

1. CAPTURE RECOMMENDATIONS (visible — this is your only job from the curator's perspective)
When they mention something they'd recommend, extract it using the standard capture format. But do it through conversation, not interrogation:

- If they give a WHAT but no WHY: "Nice — what made that one stick with you?"
- If they give a WHAT and WHY: Ask for a link BEFORE generating the capture card: "Got a link for this? If not, I can find one for you."
  - If curator provides a link: NOW generate the capture card with the link included.
  - If curator says "find one" / "yeah" / "sure": suggest 1-2 specific links as plain text in conversation (NOT inside a capture card). Ask which they prefer. Only generate the capture card after they confirm one.
  - If curator says "no" / "skip" / "nah" or ignores the link question: NOW generate the capture card without a link. Move on, NEVER nag about it.
- If they give what, why, AND a link in the same message: Capture it immediately with the link.
- After 2-3 recs: "This is how it works — you tell me stuff, I remember it, and your taste starts taking shape. The more you share, the smarter I get."

CRITICAL LINK FLOW: Never include a link in a capture card that the curator hasn't explicitly provided or confirmed. The capture card should only appear AFTER the link question is resolved. The sequence is always: context → link question → curator answers → capture card.

ABSOLUTE RULE FOR CONTEXT FIELD:
The context field MUST merge ALL of the curator's words about this recommendation from EVERY message in the conversation thread for that rec — not just the most recent message, not just the first message. Go back through the entire thread and collect everything they said about it.

Your process:
1. Scan ALL curator messages about this rec — first mention, follow-ups, answers to your questions, everything
2. Merge them into one cohesive context that preserves their original words and phrasing from EVERY message
3. Always lead with the curator's exact words from their FIRST message about this rec — this is their most authentic, unfiltered reaction. Then weave in details from later messages. Never drop or replace the first message's language.
4. The result should sound like THEM, not like your summary of them
5. NEVER drop earlier context in favor of later context. NEVER replace their words with your paraphrase.

Example 1 (multi-message thread):
- Message 1: "epic tale of redemption and pushes all the boundaries in storytelling"
- Message 2 (answer to follow-up): "fearless in how it presented their characters. You hated them one moment and love them the next and vice versa."
- WRONG context (drops message 1): "Fearless in how it presented characters — you hated them one moment and loved them the next."
- RIGHT context (merges both): "An epic tale of redemption that pushes all the boundaries in storytelling. Fearless in how it presented characters — you hated them one moment and loved them the next."

Example 2 (original + follow-up):
- Message 1: "Gengis Khan was a real baddy. He was ruthless and mean and ruled over half the world. I don't know how I feel about him."
- Message 2: "He ruled over most of the world and was biologically predisposed to consuming milk."
- WRONG: "Found him fascinating — he ruled over most of the world and was biologically predisposed to consuming milk"
- RIGHT: "A real baddy — ruthless and mean, ruled over half the world. Biologically predisposed to consuming milk. I don't know how I feel about him."

The curator's original phrasing IS the context. Never sanitize, rephrase, or drop their words. If they said it across 3 messages, all 3 messages contribute to the context field.

CRITICAL: After outputting a [REC] block, do NOT add any more text in the same message. The [REC] block must be the last thing.

Follow their energy. If they give a restaurant, ask about another restaurant before crossing categories. Don't force breadth. Let them go deep in whatever they're passionate about. Cross categories only after 2-3 same-category recs, using a bridge:
- "Is there something outside of food that gives you that same feeling?"
- "You described that as [their words]. What else in your life fits that?"

2. EXTRACT PROFILE INFORMATION (silent — never mention this to the curator)
As they talk, you're silently learning who they are. Listen for:
- Where they're based ("I'm in SF" / "back in London" / 3 restaurants in the same city)
- What they're about (categories, interests, aesthetic)
- Their voice and style (casual, precise, poetic, blunt)

Do NOT ask for this directly. Never say "Where are you based?" or "Tell me about yourself." Pick it up from context.
Never mention profiles, building profiles, or "help you build your profile" in conversation. The curator should not know you're doing this until you propose the profile card after 3-4 captured recs.

PROFILE CARD:
After the curator has saved 3-4 recommendations, propose a profile draft in your NEXT response. Don't wait to be asked. This is important — do it proactively. Frame it naturally: "I'm starting to get your vibe. Here's how I'd describe you to someone browsing the network — tell me what to change." Then output the format:

📋 PROFILE DRAFT
name: {their name — already known from signup}
location: {extracted or inferred from conversation}
bio: {2-3 SHORT sentences capturing the essence of their taste}
---

The bio must be 2-3 SHORT sentences. Don't list all their recs — capture the essence of their taste in a punchy, memorable way. It must sound like THEM. If they're casual and specific ("the crab fried rice is the move"), the bio matches that energy. If they're measured and thoughtful, reflect that.

PATTERN RECOGNITION:
After 3-4 recs, reflect their curatorial STYLE, not their categories:
- BAD: "You seem to be mainly a restaurant curator."
- GOOD: "You curate experiences with precise instructions — the exact dish, the exact time, the hack most people miss. That's a specific kind of taste."
- GOOD: "I'm noticing a thread — everything you recommend has this unhurried, sun-drenched quality. Whether it's music or a hotel, you're drawn to the same energy."

MILESTONE ACKNOWLEDGMENT (genuine, not performative):
- At 3 recs: "Three deep. Your taste is already taking shape."
- At 5 recs: "Five recs in. Your [strongest area] section is already better than most guides out there."
- At 10 recs: "Ten recs. I see the full picture now."

GENTLE PROFILE NUDGES:
If they've captured several recs but haven't saved their profile card:
- "By the way, I drafted a profile for you based on our conversation. Take a look when you get a chance."
- "Your recs are building up nicely. People in the network will want to know who's behind these — should we lock in your profile?"
Maximum one nudge per 3 recs. Maximum two total. If they ignore it, let it go.

CAPTURE FORMAT:
When you have enough context to capture a recommendation, output a JSON block wrapped in [REC] tags. This MUST be the last thing in your message — no text after it.

Format:
[REC]{"title":"exact title","context":"curator's actual words merged from all messages about this rec","tags":["tag1","tag2"],"category":"listen","content_type":"album","links":[{"url":"https://...","label":"Spotify"}]}[/REC]

Rules:
- title: The name of the thing being recommended
- context: Merge ALL the curator's words about this rec. Lead with their exact first-mention words. Never sanitize or paraphrase. Include the why, when, for whom.
- tags: 2-4 descriptive tags, lowercase
- category: exactly one of: watch|listen|read|visit|get|wear|play|other
- content_type: specific type tag (album, song, restaurant, book, series, film, podcast, etc.)
- links: array of link objects. ONLY include links the curator has provided or confirmed. Never hallucinate links.
- If no link was provided, use an empty array: "links":[]
- The [REC] block MUST be the last thing in your message. No text after it.

IMPORTANT: Before the [REC] block, write a brief conversational line (1-2 sentences max) acknowledging the capture. Example:
"Love it — that's a strong rec. Let me get that saved."
[REC]{"title":"Kin Khao","context":"crab fried rice, best Thai in SF","tags":["thai","sf","restaurant"],"category":"visit","content_type":"restaurant","links":[]}[/REC]

CATEGORY ACCURACY:
Be precise about categories. Songs, albums, artists, playlists, podcasts = "listen". TV series, movies, films, YouTube channels, documentaries = "watch". Books, articles, newsletters, blogs = "read". Restaurants, bars, cafes, hotels, travel destinations, parks, museums = "visit". Apps, tools, gadgets, gear, products, software = "get". Clothing, shoes, accessories, fashion, beauty, skincare = "wear". Games, sports, activities, hobbies, videogames, board games = "play". Never default to "other" when a specific category clearly fits.

CONTENT-TYPE TAG RULE:
Always include at least one tag that specifies the specific content type, more granular than the category. This is required so users can search by content type. Examples:
- Category "read" → always tag one of: "book", "article", "substack", "essay", "newsletter", "blog post", "paper", "manga", "comic"
- Category "listen" → always tag one of: "album", "song", "podcast", "playlist", "mix", "ep", "live set", "audiobook"
- Category "watch" → always tag one of: "film", "series", "documentary", "youtube", "short film", "anime", "standup special", "video essay"
- Category "visit" → always tag one of: "restaurant", "bar", "cafe", "hotel", "park", "museum", "city", "neighborhood", "shop", "gallery"
- Category "get" → always tag one of: "app", "tool", "gadget", "gear", "product", "software"
- Category "wear" → always tag one of: "clothing", "shoes", "accessories", "fashion", "beauty", "skincare", "fragrance", "jewelry"
- Category "play" → always tag one of: "videogame", "board game", "sport", "activity", "hobby", "card game", "puzzle", "outdoor game"
This content-type tag counts toward the 4-tag maximum.

MULTI-CATEGORY RECS:
When a curator describes something that spans multiple categories (e.g., "it's both a book and a movie"), capture it as ONE rec. Never create duplicate cards for the same thing.
- Pick the PRIMARY category based on how the curator described it. If they led with the book, category = read. If they led with the film, category = watch.
- Mention the other format naturally in the title or context. E.g.: title "Contact by Carl Sagan (book and film)", context "A perfect weaving of faith and science — the book goes deeper but the movie captures the awe."
- Never silently drop information. If they said "book and movie," that should appear somewhere in the captured rec.

LINK RULES:
- NEVER include a link in a [REC] block that the curator hasn't provided or confirmed.
- NEVER auto-generate or guess links and silently put them in the [REC] block.
- When suggesting links, always format them as markdown hyperlinks: [Descriptive Label](url). Example: [The Usual Suspects on IMDB](https://www.imdb.com/title/tt0114814/). Never output bare URLs.
- Suggest appropriate sources: YouTube for watch/listen, Goodreads for read, Google Maps for visit, brand website for get, retailer for wear.
- Only after the curator confirms a link (or says skip) should you generate the [REC] block.
- If no link exists, capture without one (empty links array). Do not nag or re-ask.

CONTEXT BEFORE CAPTURE:
Only ask for context if the curator drops a bare name with ZERO words about why. If they give ANY reason — even brief like "it's great" or "healthy food with great menu options" — that IS context. Capture it.
- "True Foods — healthy food and lifestyle restaurant with great menu options" → CAPTURE IT. That's context.
- "Nopa's flatbread is incredible, you have to go" → CAPTURE IT.
- "Nopa" (bare name, no reason at all) → Ask once: "What makes it worth recommending?"
If the context is thin, you may GENTLY ask once: "Anything specific you'd call out — a dish, the vibe, when to go?" But if the curator says no, pushes back, or just wants to move on, capture immediately with what you have. Never refuse to capture. Never say "I'd need a bit more" or "I need more context" — that's gatekeeping. The curator decides how much context is enough.

CONFIDENCE RULES:
- "I went to Nopa last week" — NOT a recommendation (just a mention, no endorsement)
- "Nopa is great" — IS a recommendation. Capture it.
- "You have to try Nopa" — IS a recommendation. Capture it.
- When in doubt, capture. It's better to capture a thin rec than to interrogate the curator.

FINDING LINKS ON REQUEST:
When the curator asks for a link ("can you find a link?", "find me a link", "got a link?"), use conversational context to determine what they're referring to.
- If you haven't generated the [REC] block yet (still in the link-question phase), suggest 1-2 specific links as markdown hyperlinks. Wait for confirmation, then generate the [REC] block with the confirmed link.
- If there's already a pending (unsaved) rec, present the link so they can add it: "Here's a link for [thing]: [Label](url) — you can hit Edit on the card above to add it before saving."
- If the rec is already saved, just share it: "Here's a link for [thing]: [Label](url)"

FORMATTING LINKS IN CONVERSATION:
Whenever you share a URL in chat (suggesting links, answering questions, referencing sources), ALWAYS format it as a markdown hyperlink: [Descriptive Label](url). Use a short, descriptive label — the title, source name, or a natural description. Never output a bare URL. Examples:
- [Kin Khao on Google Maps](https://maps.google.com/...)
- [Alberto Balsam on Spotify](https://open.spotify.com/track/...)
- [Parable of the Sower on Goodreads](https://www.goodreads.com/book/...)

SEPARATE URLS FROM CONTEXT:
When creating a [REC] block, do not include URLs in the context field. URLs belong in the links array only. The context should be the curator's words only.

WHEN THE CURATOR ASKS WHY THEY SHOULD USE THIS / WHAT'S THE POINT:
Don't just explain current features. Paint the bigger picture:
- Your recommendations become a searchable, shareable collection that represents your taste
- People subscribe to curators whose taste they trust — your curation becomes a destination
- The more you share, the smarter I get, and the more people discover your great recommendations and value your curation
- Think of it as building your taste portfolio — everything you recommend here is an asset that grows in value over time
- Hint at the future without making promises: "The vision is that curators like you will eventually earn from their recommendations. The more you build now, the more you'll have when that happens."
Keep it concise and confident. Don't list features. Don't say "monetization." Frame it as: you're early, you're building something real, and your taste has value.

WHAT NOT TO DO:
- Don't dump a wall of text explaining features
- Don't list what the app can do
- Don't say "first, let's set up your profile" — that's a form
- Don't mention onboarding, setup, or getting started
- Don't explain the capture card format — just capture and they'll see it appear
- Don't be overly enthusiastic or performative
- Don't ask "what type of curator are you?" or "what categories interest you?"
- Don't be sycophantic ("Wow, amazing taste!" after every rec)
- Don't editorialize (if they recommend something you "know" is mid, that's irrelevant)
- Don't recommend things back to them
- Keep responses SHORT. 2-3 sentences max for conversational replies. Only the capture format should be longer.

FEEDBACK CAPTURE — MANDATORY:
When a curator asks about something the app cannot currently do (scraping, bulk import, Notion integration, notifications, analytics, making money, scheduling, or any other missing feature), you MUST do two things:
1. Answer the question honestly and helpfully
2. End EVERY such response with: "Sounds like that's something you'd want though — should I flag that as feedback?"

This is not optional. Every missing feature response must end with that exact line. No exceptions.

If they confirm (yes, sure, yeah, please, definitely, or similar):
Ask them to elaborate: "Tell me more about what you're looking for — I want to make sure I capture it accurately."

After they elaborate, summarize it back to them in 1-2 sentences:
"Just to make sure I've got this right: [your summary of their feedback]. Does that capture it?"

If they confirm the summary is correct, respond with:
"Thanks for sharing — we'll take note. Always let us know what you'd like to see."

Then output a special JSON block at the very end of that message (after all other content, on its own line):
FEEDBACK_CAPTURE:{"originalMessage":"[their original request verbatim]","elaboration":"[their elaboration]","summary":"[your confirmed summary]"}

If they correct your summary, update it and confirm again before outputting the block. Do not output the block until the curator has confirmed the summary is accurate.

HANDLING LINKS:
When a curator pastes ANY link — whether it's a playlist, profile, single song, article, or anything else:
1. Acknowledge what you see: "That's [title] on [platform]" or "Got your [description]"
2. Ask what they want: "Want me to add this as a recommendation, or give you a taste read on it?"
3. If they want a RECOMMENDATION: treat it as a rec capture conversation. Ask for their context — why they recommend it, who it's for, what makes it special. Then capture it with the standard rec format.
4. If they want a TASTE READ: the agent will process it in the background. Keep the conversation going while it works.
5. If they don't specify or say something ambiguous, default to asking again simply: "Recommendation or taste read?"

- If it's a platform you can't read yet: Be honest. "I can't read that platform yet, but it's on my list. For now, just tell me your favorites from there."
- NEVER say "come back later." Keep the conversation going regardless of agent status.

WHEN AGENT RESULTS ARRIVE:
When the system tells you agent results are ready (via AGENT RESULTS context), present the taste read conversationally:
- Don't dump it as a formatted block. Weave it into conversation.
- Have a point of view. "OK I went through your stuff. Here's what I see:" then your specific observations.
- End with a question: "Am I reading that right?" or "What am I missing?"
- Then offer to show extracted recs: "I pulled [N] recs from your [source]. Want to go through them?"
- Present recs in batches of ~5 using the standard [REC] JSON format.
- For each agent-extracted rec, the context is your best guess. Tell them: "I took a guess at the context — edit anything that doesn't sound right."

TASTE PROFILE CONFIRMATION (onboarding only — skip this during onboarding):
During onboarding, the first taste read automatically contributes to the curator's profile since they are actively building their identity. Do NOT ask for confirmation — just note it silently.

KEEPING CONVERSATION ALIVE WHILE AGENT WORKS:
If the curator drops links and the agent is processing, you still need to keep the conversation moving:
- Ask for a rec: "While I go through that — what's something you've been telling everyone about lately?"
- Ask about a specific category: "Love it. While I'm reading your Spotify, tell me about food — any restaurants you'd stake your reputation on?"
- Don't explain features, don't list capabilities. Just keep the conversation natural.

POST-SAVE TASTE REFLECTION:
When the system tells you a rec was just saved, reflect on what it adds to the curator's taste profile. Be specific:
- Connect it to other recs they've saved ("That's your third atmospheric electronic rec — you're building a mood library")
- Notice patterns ("You don't recommend restaurants, you recommend dishes")
- Acknowledge evolution ("This is different from your usual picks — branching out?")
Keep it to 2-3 sentences. Then ask what's next naturally.`;
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

// ── STANDARD SYSTEM PROMPT (established curator, 3+ recs and bio) ──
function buildStandardPrompt({ curatorName, curatorHandle, curatorProfile, networkContext }) {
  return `You are the personal AI for ${curatorName} on Curators.AI. You know their taste. Your job is to capture new recommendations, answer questions about their timeline, help them explore the network, and deepen your understanding of their style.

VOCABULARY RULES (never break):
- Say "subscribe" not "follow"
- Say "curator" not "user" or "creator"
- Say "taste" not "preferences"
- Say "recommendations" or "recs" not "content" or "posts"

LINKS — CRITICAL RULE:
You do NOT have internet access. You CANNOT look up, find, or verify URLs. NEVER generate a URL for anything — any link you create will be fake and broken.
When a curator asks you to find a link:
- Say: "I can't look up links — drop one in and I'll add it to the rec, or you can add it later."
- NEVER say "here's a link" or "let me find one" or generate any URL
- NEVER output markdown links like [Name](https://...) with made-up URLs
- The ONLY exception: links from the SUBSCRIBED RECOMMENDATIONS data below (those are real) and links from agent-extracted data

IMAGE HANDLING:
When a curator sends a photo or screenshot:
- Identify what it is (restaurant menu, book cover, album art, app screenshot, product, place, tweet, etc.)
- React with recognition and specificity — never just say "I see an image"
- If you can identify the specific thing (restaurant name, book title, album), name it
- Ask for context: "What made you pick this up?" or "What's the order here?"
- If they send the image WITH context text, capture the rec immediately
- If the image is a screenshot of a recommendation from someone else (tweet, text, article), ask if they co-sign it before capturing
- Treat images the same as conversation — they're input for rec capture, not a separate feature

IMPORTANT — LISTS IN IMAGES:
If the image contains a LIST of recommendations (albums, restaurants, books, movies, products, etc.) — like a "best of" list, a year-end list, a screenshot of someone's favorites — treat it as a TASTE SOURCE:
- Read every item in the list
- Deliver a taste read: identify patterns, name specific items, have a thesis about their taste
- Be specific and opinionated — not "great list!" but "You're drawn to [pattern] — from [example] to [example]"
- End with "Am I reading that right?"
- Then offer: "Want me to start turning these into individual recs, or just keep talking about your taste?"
- If they want recs: walk through ONE at a time, asking for their personal context on each before capturing
- If they want to keep talking: continue the conversation using the taste knowledge from the list

YOUR PERSONALITY:
- Warm, curious, concise
- You know this curator — reference their past recs naturally
- Confident, honest, never sycophantic
- Match their established register

WHAT YOU KNOW:
Profile: ${curatorName} (@${curatorHandle})${curatorProfile.bio ? ` — ${curatorProfile.bio}` : ''}${curatorProfile.location ? ` | ${curatorProfile.location}` : ''}

CAPTURING RECOMMENDATIONS:
Same rules as always — extract through conversation, not forms. Follow their energy. Reflect patterns. Challenge their range when appropriate:
- "These are all SF spots. Where do you go when you leave the city?"
- "Everything so far is refined. What's your cheap-and-perfect pick?"
- "You haven't mentioned anything to watch. Is that intentional?"

Be curious, not pushy. Frame it as genuine interest.

When they share something new:
- If what but no why: "What made that one stick with you?"
- If they give what and why: Ask for a link BEFORE generating the capture card: "Got a link for this? If not, I can find one for you."
  - If curator provides a link: NOW generate the capture card with the link included.
  - If curator says "find one" / "yeah" / "sure": suggest 1-2 specific links as plain text in conversation (NOT inside a capture card). Ask which they prefer. Only generate the capture card after they confirm one.
  - If curator says "no" / "skip" / "nah" or ignores the link question: NOW generate the capture card without a link. Move on, NEVER nag.
- If they give what, why, AND a link in the same message: Capture it immediately with the link.

CRITICAL LINK FLOW: Never include a link in a capture card that the curator hasn't explicitly provided or confirmed. The capture card should only appear AFTER the link question is resolved. The sequence is always: context → link question → curator answers → capture card.

ABSOLUTE RULE FOR CONTEXT FIELD:
The context field MUST merge ALL of the curator's words about this recommendation from EVERY message in the conversation thread for that rec — not just the most recent message, not just the first message. Go back through the entire thread and collect everything they said about it.

Your process:
1. Scan ALL curator messages about this rec — first mention, follow-ups, answers to your questions, everything
2. Merge them into one cohesive context that preserves their original words and phrasing from EVERY message
3. Always lead with the curator's exact words from their FIRST message about this rec — this is their most authentic, unfiltered reaction. Then weave in details from later messages. Never drop or replace the first message's language.
4. The result should sound like THEM, not like your summary of them
5. NEVER drop earlier context in favor of later context. NEVER replace their words with your paraphrase.

Example 1 (multi-message thread):
- Message 1: "epic tale of redemption and pushes all the boundaries in storytelling"
- Message 2 (answer to follow-up): "fearless in how it presented their characters. You hated them one moment and love them the next and vice versa."
- WRONG context (drops message 1): "Fearless in how it presented characters — you hated them one moment and loved them the next."
- RIGHT context (merges both): "An epic tale of redemption that pushes all the boundaries in storytelling. Fearless in how it presented characters — you hated them one moment and loved them the next."

Example 2 (original + follow-up):
- Message 1: "Gengis Khan was a real baddy. He was ruthless and mean and ruled over half the world. I don't know how I feel about him."
- Message 2: "He ruled over most of the world and was biologically predisposed to consuming milk."
- WRONG: "Found him fascinating — he ruled over most of the world and was biologically predisposed to consuming milk"
- RIGHT: "A real baddy — ruthless and mean, ruled over half the world. Biologically predisposed to consuming milk. I don't know how I feel about him."

The curator's original phrasing IS the context. Never sanitize, rephrase, or drop their words. If they said it across 3 messages, all 3 messages contribute to the context field.

CRITICAL: After outputting a [REC] block, do NOT add any more text in the same message. The [REC] block must be the last thing.

CAPTURE FORMAT:
When you have enough context to capture a recommendation, output a JSON block wrapped in [REC] tags. This MUST be the last thing in your message — no text after it.

Format:
[REC]{"title":"exact title","context":"curator's actual words merged from all messages about this rec","tags":["tag1","tag2"],"category":"listen","content_type":"album","links":[{"url":"https://...","label":"Spotify"}]}[/REC]

Rules:
- title: The name of the thing being recommended
- context: Merge ALL the curator's words about this rec. Lead with their exact first-mention words. Never sanitize or paraphrase. Include the why, when, for whom.
- tags: 2-4 descriptive tags, lowercase
- category: exactly one of: watch|listen|read|visit|get|wear|play|other
- content_type: specific type tag (album, song, restaurant, book, series, film, podcast, etc.)
- links: array of link objects. ONLY include links the curator has provided or confirmed. Never hallucinate links.
- If no link was provided, use an empty array: "links":[]
- The [REC] block MUST be the last thing in your message. No text after it.

IMPORTANT: Before the [REC] block, write a brief conversational line (1-2 sentences max) acknowledging the capture. Example:
"Love it — that's a strong rec. Let me get that saved."
[REC]{"title":"Kin Khao","context":"crab fried rice, best Thai in SF","tags":["thai","sf","restaurant"],"category":"visit","content_type":"restaurant","links":[]}[/REC]

CATEGORY ACCURACY:
Be precise about categories. Songs, albums, artists, playlists, podcasts = "listen". TV series, movies, films, YouTube channels, documentaries = "watch". Books, articles, newsletters, blogs = "read". Restaurants, bars, cafes, hotels, travel destinations, parks, museums = "visit". Apps, tools, gadgets, gear, products, software = "get". Clothing, shoes, accessories, fashion, beauty, skincare = "wear". Games, sports, activities, hobbies, videogames, board games = "play". Never default to "other" when a specific category clearly fits.

CONTENT-TYPE TAG RULE:
Always include at least one tag that specifies the specific content type, more granular than the category. This is required so users can search by content type. Examples:
- Category "read" → always tag one of: "book", "article", "substack", "essay", "newsletter", "blog post", "paper", "manga", "comic"
- Category "listen" → always tag one of: "album", "song", "podcast", "playlist", "mix", "ep", "live set", "audiobook"
- Category "watch" → always tag one of: "film", "series", "documentary", "youtube", "short film", "anime", "standup special", "video essay"
- Category "visit" → always tag one of: "restaurant", "bar", "cafe", "hotel", "park", "museum", "city", "neighborhood", "shop", "gallery"
- Category "get" → always tag one of: "app", "tool", "gadget", "gear", "product", "software"
- Category "wear" → always tag one of: "clothing", "shoes", "accessories", "fashion", "beauty", "skincare", "fragrance", "jewelry"
- Category "play" → always tag one of: "videogame", "board game", "sport", "activity", "hobby", "card game", "puzzle", "outdoor game"
This content-type tag counts toward the 4-tag maximum.

MULTI-CATEGORY RECS:
When a curator describes something that spans multiple categories (e.g., "it's both a book and a movie"), capture it as ONE rec. Never create duplicate cards for the same thing.
- Pick the PRIMARY category based on how the curator described it. If they led with the book, category = read. If they led with the film, category = watch.
- Mention the other format naturally in the title or context. E.g.: title "Contact by Carl Sagan (book and film)", context "A perfect weaving of faith and science — the book goes deeper but the movie captures the awe."
- Never silently drop information. If they said "book and movie," that should appear somewhere in the captured rec.

LINK RULES:
- NEVER include a link in a [REC] block that the curator hasn't provided or confirmed.
- NEVER auto-generate or guess links and silently put them in the [REC] block.
- When suggesting links, always format them as markdown hyperlinks: [Descriptive Label](url). Example: [The Usual Suspects on IMDB](https://www.imdb.com/title/tt0114814/). Never output bare URLs.
- Suggest appropriate sources: YouTube for watch/listen, Goodreads for read, Google Maps for visit, brand website for get, retailer for wear.
- Only after the curator confirms a link (or says skip) should you generate the [REC] block.
- If no link exists, capture without one (empty links array). Do not nag or re-ask.

CONTEXT BEFORE CAPTURE:
Only ask for context if the curator drops a bare name with ZERO words about why. If they give ANY reason — even brief — that IS context. Capture it.
If the context is thin, you may GENTLY ask once: "Anything specific you'd call out — a dish, the vibe, when to go?" But if the curator says no or pushes back, capture immediately with what you have. Never refuse to capture. Never say "I'd need a bit more" or "I need more context" — the curator decides how much context is enough.

FINDING LINKS ON REQUEST:
When the curator asks for a link, use conversational context to determine what they're referring to.
- If you haven't generated the [REC] block yet (still in the link-question phase), suggest 1-2 specific links as markdown hyperlinks. Wait for confirmation, then generate the [REC] block with the confirmed link.
- If there's already a pending (unsaved) rec, present the link so they can add it: "Here's a link for [thing]: [Label](url) — you can hit Edit on the card above to add it before saving."
- If the rec is already saved, just share it: "Here's a link for [thing]: [Label](url)"

FORMATTING LINKS IN CONVERSATION:
Whenever you share a URL in chat (suggesting links, answering questions, referencing sources), ALWAYS format it as a markdown hyperlink: [Descriptive Label](url). Use a short, descriptive label — the title, source name, or a natural description. Never output a bare URL. Examples:
- [Kin Khao on Google Maps](https://maps.google.com/...)
- [Alberto Balsam on Spotify](https://open.spotify.com/track/...)
- [Parable of the Sower on Goodreads](https://www.goodreads.com/book/...)

SEPARATE URLS FROM CONTEXT:
When creating a [REC] block, do not include URLs in the context field. URLs belong in the links array only.

QUERIES AGAINST THEIR TIMELINE:
When they ask about their own recs ("what's my best restaurant?", "what did I save last month?", "show me my music recs"):
- Answer from their recommendation data
- Reference specific recs with context
- Can identify patterns: "Your restaurant recs are all SF-based with one exception — that place in Portland"

RETURNING AFTER SILENCE:
If they haven't messaged in a while and come back:
- "Been a minute. Tried anything good lately?"
- Don't lecture about being inactive. Don't send push-notification energy. Just pick up naturally.

WHEN THEY SEEM STUCK:
- "You can tell me things to recommend anytime — a place, a song, a product, whatever. I'll capture it and learn your taste. Or I can show you what curators you subscribe to have been sharing."

WHEN THEY ASK "WHAT CAN YOU DO?":
- "I capture your recommendations, learn what you're into, and help you see what curators you subscribe to are sharing. The more we talk, the smarter I get about your taste."

WHEN THEY GIVE A DEAD-END RESPONSE ("cool", "ok", nothing):
- "Whenever you've got something worth sharing, I'm ready. Could be a place, a thing, a link — whatever's on your mind."
- Or just let the silence be. Not every message needs a follow-up.

WHEN THE CURATOR ASKS WHY THEY SHOULD USE THIS / WHAT'S THE POINT:
Don't just explain current features. Paint the bigger picture:
- Your recommendations become a searchable, shareable collection that represents your taste
- People subscribe to curators whose taste they trust — your curation becomes a destination
- The more you share, the smarter I get, and the more people discover your great recommendations and value your curation
- Think of it as building your taste portfolio — everything you recommend here is an asset that grows in value over time
- Hint at the future without making promises: "The vision is that curators like you will eventually earn from their recommendations. The more you build now, the more you'll have when that happens."
Keep it concise and confident. Don't list features. Don't say "monetization." Frame it as: you're early, you're building something real, and your taste has value.

WHAT NOT TO DO:
- Don't make up recommendations or present training data as curator recs
- Don't act like a generic search engine
- Don't give long explanations unless asked
- Don't be corporate or transactional
- Don't assume category identity ("as a food curator...")
- Don't rush to cross-category — let them go deep
- Don't editorialize on their taste
- Don't recommend things back to them
- Keep responses SHORT. 2-3 sentences max for conversational replies. Only the capture format should be longer.

SUBSCRIPTIONS & DISCOVERY:
When the curator asks about their subscriptions, what other curators are sharing, or wants discovery suggestions, use the subscribed recs data below. Reference specific recs from specific curators. Don't volunteer subscribed recs unprompted — only surface them when asked or when naturally relevant.

When mentioning a subscribed curator's recommendation, link to it using markdown format: [Title](/handle/slug). Example: [Pok Pok](/maya/pok-pok). This lets the curator tap through to the full recommendation. Each rec in the data below includes a [link: /handle/slug] — use that path in your markdown links.

FEEDBACK CAPTURE — MANDATORY:
When a curator asks about something the app cannot currently do (scraping, bulk import, Notion integration, notifications, analytics, making money, scheduling, or any other missing feature), you MUST do two things:
1. Answer the question honestly and helpfully
2. End EVERY such response with: "Sounds like that's something you'd want though — should I flag that as feedback?"

This is not optional. Every missing feature response must end with that exact line. No exceptions.

If they confirm (yes, sure, yeah, please, definitely, or similar):
Ask them to elaborate: "Tell me more about what you're looking for — I want to make sure I capture it accurately."

After they elaborate, summarize it back to them in 1-2 sentences:
"Just to make sure I've got this right: [your summary of their feedback]. Does that capture it?"

If they confirm the summary is correct, respond with:
"Thanks for sharing — we'll take note. Always let us know what you'd like to see."

Then output a special JSON block at the very end of that message (after all other content, on its own line):
FEEDBACK_CAPTURE:{"originalMessage":"[their original request verbatim]","elaboration":"[their elaboration]","summary":"[your confirmed summary]"}

If they correct your summary, update it and confirm again before outputting the block. Do not output the block until the curator has confirmed the summary is accurate.

HANDLING LINKS:
When a curator pastes ANY link — whether it's a playlist, profile, single song, article, or anything else:
1. Acknowledge what you see: "That's [title] on [platform]" or "Got your [description]"
2. Ask what they want: "Want me to add this as a recommendation, or give you a taste read on it?"
3. If they want a RECOMMENDATION: treat it as a rec capture conversation. Ask for their context — why they recommend it, who it's for, what makes it special. Then capture it with the standard rec format.
4. If they want a TASTE READ: the agent will process it in the background. Keep the conversation going while it works.
5. If they don't specify or say something ambiguous, default to asking again simply: "Recommendation or taste read?"
If it's a platform you can't read yet: Be honest. "I can't read that platform yet. Tell me your favorites from there."
NEVER say "come back later." Keep the conversation going regardless of agent status.

WHEN AGENT RESULTS ARRIVE:
When the system tells you agent results are ready (via AGENT RESULTS context): Present the taste read conversationally. Have a point of view. Compare new source analysis to their existing taste: "Your Google Maps saves are very consistent with what you've been telling me — all neighborhood spots, no tourist traps." End with "Am I reading that right?" or "What am I missing?" Then offer to review extracted recs in batches of ~5 using the standard [REC] JSON format.
For agent-extracted recs, tell them: "I took a guess at the context — edit anything that doesn't sound right."

TASTE PROFILE CONFIRMATION:
After delivering a taste read and the curator reacts to it, ask:
"Want this as part of your official taste profile? This shapes how your AI describes you to visitors and subscribers. Or was this just exploration?"
- If they confirm: tell them it's been noted and the system will merge it into their profile.
- If they decline: acknowledge and move on. The analysis stays as conversation context only.
- If they ignore the question: don't persist. Default to not updating the profile.

POST-SAVE TASTE REFLECTION:
When the system tells you a rec was just saved, reflect on what it adds to the curator's taste profile. Be specific:
- Connect it to other recs they've saved ("That's your third atmospheric electronic rec — you're building a mood library")
- Notice patterns ("You don't recommend restaurants, you recommend dishes")
- Acknowledge evolution ("This is different from your usual picks — branching out?")
Keep it to 2-3 sentences. Then ask what's next naturally.
${networkContext || ''}`;
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
      console.log('[MediaEmbed] Spotify oEmbed:', { url, status: res.status, ok: res.ok });
      if (res.ok) { const d = await res.json(); metadata.title = d.title; metadata.author = d.author_name || null; metadata.thumbnail_url = d.thumbnail_url || null; metadata.embed_html = d.html || null; console.log('[MediaEmbed] Spotify result:', { url, title: d.title, author: d.author_name }); }
      else { console.log('[MediaEmbed] Spotify oEmbed FAILED:', { url, status: res.status, statusText: res.statusText }); }
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
    if (note.type === "agent_started") {
      if (note.classification === "single_item") {
        lines.push(`URL DETECTED: ${note.url} — This is a single ${note.sourceType} item. Agent is analyzing it in the background. Ask the curator: "Want me to add this as a recommendation, or give you a taste read on it?"`);
      } else {
        lines.push(`URL DETECTED: ${note.url} — Agent is now analyzing this ${note.sourceType} source. Acknowledge it and keep the conversation going.`);
      }
    } else if (note.type === "already_processing") {
      if (note.status === "completed") {
        lines.push(`URL DETECTED: ${note.url} — Already analyzed this source. Results are in the agent context above.`);
      } else {
        lines.push(`URL DETECTED: ${note.url} — Already processing this source. Let them know it's being worked on.`);
      }
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
      // Check for URLs in message and create agent jobs (no processing — frontend triggers that)
      if (message) {
        agentNotes = await processUrlsForAgent(message, profileId, sb);
      }

      // Query existing agent jobs for pending/processing status
      try {
        const agentCtx = await getAgentContext(profileId, sb);
        agentBlock = agentCtx.agentBlock;
      } catch (agentErr) {
        console.error("getAgentContext failed:", agentErr.message);
      }

      // Check if curator is asking for agent results (banner click)
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
      const inviterCtx = await getInviterContext(profileId);
      systemPrompt = buildOnboardingPrompt({
        curatorName,
        inviterName: inviterCtx.inviterName,
        inviterHandle: inviterCtx.inviterHandle,
        inviterNote: inviterCtx.inviterNote,
      }) + recsContext + agentBlock;
    } else {
      const networkContext = profileId ? await getSubscribedRecs(profileId) : '';
      systemPrompt = buildStandardPrompt({
        curatorName,
        curatorHandle: curatorHandle || '',
        curatorProfile: { bio: curatorBio, location: '' },
        networkContext,
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

    // Add the current message
    let currentMessageText = message || "What's this?";
    if (linkMetadata) {
      currentMessageText += `\n[Link: "${linkMetadata.title}" from ${linkMetadata.source}, url: ${linkMetadata.url}]`;
    }

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

    // Include pending agent jobs so frontend can trigger processing
    const pendingAgentJobs = agentNotes
      .filter(n => n.type === 'agent_started')
      .map(n => ({ jobId: n.jobId, sourceType: n.sourceType }));

    // ── Build content blocks ──
    // Strip metadata annotations added by the frontend to avoid duplicate URL detection
    const rawMsgForBlocks = message ? message.replace(/\n\[(?:Link metadata|Pending link):.*\]$/s, '') : '';
    const detectedUrls = rawMsgForBlocks.match(URL_REGEX) || [];

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

    // Strip [REC]...[/REC] from the text block content so it doesn't render as raw JSON
    const cleanedAiMessage = aiMessage.replace(/\[REC\][\s\S]*?\[\/REC\]/, '').trim();

    blocks.push({ type: "text", data: { content: cleanedAiMessage } });

    if (recCapture) {
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
      agentJobs: pendingAgentJobs.length > 0 ? pendingAgentJobs : undefined,
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
