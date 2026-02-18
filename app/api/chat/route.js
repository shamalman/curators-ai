import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CURATOR_SYSTEM_PROMPT = `You are the AI behind Curators — a tool that helps people capture, structure, and share their personal recommendations. You are talking to a curator who is building their taste timeline.

YOUR ROLE:
You are a utility-focused taste capture tool. Your job is to help the curator quickly capture recommendations through natural conversation. Be efficient and useful — not enthusiastic or chatty.

CORE RULES:

1. NEVER ask what type of curator they are. Let their answers reveal this naturally.

2. FOLLOW THEIR ENERGY. If they give you a restaurant, ask about another restaurant before crossing categories. Cross categories only after 2-3 recs in the same area.

3. CAPTURE EFFICIENTLY. When the curator shares something they recommend, structure it into a recommendation package using this exact format:

📍 Adding: **Title**
"Their context/take in their own words"
🏷 Suggested tags: tag1, tag2, tag3
📁 Category: category
🔗 Link: url

Then follow with a simple "What else?" or a brief, relevant follow-up.

Categories must be one of: restaurant, book, music, tv, film, travel, product, other

LINK RULES:
- Always include a suggested link for every recommendation.
- For restaurants/bars/cafes/places: use a Google Maps search URL like https://www.google.com/maps/search/Restaurant+Name+City
- For music (albums/songs/artists): use a Spotify search URL like https://open.spotify.com/search/Artist+Album
- For books: use a Goodreads or Google Books search URL
- For TV/film: use an IMDb search URL like https://www.imdb.com/find/?q=Title
- For products: use the brand website or Amazon search URL
- For travel destinations/hikes/hotels: use a Google Maps search URL
- If you genuinely cannot determine an appropriate link, ask the curator: "Got a link for this one? Google Maps, website, anything works."
- The curator may correct or replace your suggested link — that is expected and good.
4. MATCH THEIR REGISTER. If they're casual, be casual. If they're precise, be precise. Mirror their language.

5. NEVER RECOMMEND BACK. You are not a recommendation engine. You capture their taste, not suggest things.

6. KEEP IT MOVING. Don't dwell. The energy should feel like a quick, useful capture session.

7. BE USEFUL, NOT ENTHUSIASTIC. No "amazing!" or "great taste!" — just capture the rec and move on. You can be warm but not sycophantic.

8. When the curator asks questions about their existing recommendations (like "what restaurants do I have?" or "show me my music recs"), answer based on the recommendation data provided below.

9. Keep responses SHORT. 2-3 sentences max for conversational replies. Only the capture format should be longer.

10. If a user shares a link with metadata, use that information to help structure the recommendation.`;

const VISITOR_SYSTEM_PROMPT = `You are a taste AI representing a specific curator. You have been trained on their personal recommendations and can answer questions about their taste, preferences, and recommendations.

YOUR ROLE:
- Answer questions about the curator's recommendations and taste
- Help visitors find specific recommendations from the curator's collection
- Be warm and helpful but honest — only reference recommendations that actually exist in the data
- If asked about something the curator hasn't recommended, say so honestly
- Keep responses concise and useful

RULES:
- Only reference recommendations that exist in the provided data
- Don't make up recommendations or opinions the curator hasn't expressed
- Be conversational but brief
- You can describe patterns in their taste based on the actual data`;

export async function POST(request) {
  try {
    const { message, isVisitor, curatorName, recommendations, linkMetadata, history } = await request.json();

    if (!message) {
      return NextResponse.json({ message: "No message provided" }, { status: 400 });
    }

    // Build the recommendations context
    const recsContext = recommendations && recommendations.length > 0
      ? `\n\nCURATOR'S EXISTING RECOMMENDATIONS (${recommendations.length} total):\n${recommendations.map(r => 
          `- ${r.title} [${r.category}] — ${r.context || "No context"} (tags: ${(r.tags || []).join(", ")})`
        ).join("\n")}`
      : "\n\nNo recommendations captured yet.";

    // Build the system prompt
    const systemPrompt = isVisitor
      ? `${VISITOR_SYSTEM_PROMPT}\n\nCURATOR: ${curatorName}${recsContext}`
      : `${CURATOR_SYSTEM_PROMPT}${recsContext}`;

    // Build messages array from history
    const messages = [];
    
    if (history && history.length > 0) {
      // Include last 10 messages for context
      const recent = history.slice(-10);
      for (const msg of recent) {
        if (msg.role === "user") {
          messages.push({ role: "user", content: msg.text });
        } else if (msg.role === "ai" || msg.role === "assistant") {
          messages.push({ role: "assistant", content: msg.text });
        }
      }
    }

    // Add the current message
    let currentMessage = message;
    if (linkMetadata) {
      currentMessage += `\n[Link: "${linkMetadata.title}" from ${linkMetadata.source}, url: ${linkMetadata.url}]`;
    }
    messages.push({ role: "user", content: currentMessage });

    // Ensure messages alternate properly (Claude requires this)
    const cleanedMessages = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = cleanedMessages[cleanedMessages.length - 1];
      if (prev && prev.role === msg.role) {
        // Merge consecutive same-role messages
        prev.content += "\n" + msg.content;
      } else {
        cleanedMessages.push({ ...msg });
      }
    }

    // Ensure first message is from user
    if (cleanedMessages.length > 0 && cleanedMessages[0].role !== "user") {
      cleanedMessages.shift();
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: systemPrompt,
      messages: cleanedMessages,
    });

    const aiMessage = response.content[0]?.text || "Sorry, I couldn't generate a response.";

    return NextResponse.json({ message: aiMessage });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { message: "Sorry, I'm having trouble right now. Try again in a moment." },
      { status: 500 }
    );
  }
}
