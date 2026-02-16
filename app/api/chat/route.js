import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { message, isVisitor, curatorName, recommendations, isFirstMessage, recCount } = await request.json()

    const recsContext = recommendations && recommendations.length > 0
      ? recommendations.map(rec => `- ${rec.title} (${rec.category}): "${rec.context}" [Tags: ${rec.tags?.join(', ') || 'none'}]`).join('\n')
      : 'No recommendations yet.';

    const categoryCounts = {};
    if (recommendations) {
      recommendations.forEach(rec => {
        categoryCounts[rec.category] = (categoryCounts[rec.category] || 0) + 1;
      });
    }
    const categoryBreakdown = Object.entries(categoryCounts)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ') || 'none yet';

    const visitorSystemPrompt = `You are ${curatorName}'s taste AI — trained on their personal recommendations. You know what ${curatorName} loves, why they love it, and who it's for.

Here are ${curatorName}'s ${recommendations?.length || 0} recommendations:
${recsContext}

Your job: Help visitors find the right recommendation for their needs. Be warm, helpful, and conversational. Reference specific recommendations when relevant. Keep responses concise for mobile (2-4 sentences usually).

Match ${curatorName}'s energy based on how they wrote their recommendation contexts.`

    const curatorSystemPrompt = `You are the curator's AI partner. Your
cat > app/api/chat/route.js << 'EOF'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { message, isVisitor, curatorName, recommendations, isFirstMessage, recCount } = await request.json()

    const recsContext = recommendations && recommendations.length > 0
      ? recommendations.map(rec => `- ${rec.title} (${rec.category}): "${rec.context}" [Tags: ${rec.tags?.join(', ') || 'none'}]`).join('\n')
      : 'No recommendations yet.';

    const categoryCounts = {};
    if (recommendations) {
      recommendations.forEach(rec => {
        categoryCounts[rec.category] = (categoryCounts[rec.category] || 0) + 1;
      });
    }
    const categoryBreakdown = Object.entries(categoryCounts)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ') || 'none yet';

    const visitorSystemPrompt = `You are ${curatorName}'s taste AI — trained on their personal recommendations. You know what ${curatorName} loves, why they love it, and who it's for.

Here are ${curatorName}'s ${recommendations?.length || 0} recommendations:
${recsContext}

Your job: Help visitors find the right recommendation for their needs. Be warm, helpful, and conversational. Reference specific recommendations when relevant. Keep responses concise for mobile (2-4 sentences usually).

Match ${curatorName}'s energy based on how they wrote their recommendation contexts.`

    const curatorSystemPrompt = `You are the curator's AI partner. Your job: capture recommendations and add value. That's it.

## Current Curator Context
- Name: ${curatorName}
- Total recommendations: ${recommendations?.length || 0}
- Categories: ${categoryBreakdown}

Their current recommendations:
${recsContext}

## How You Respond

BE USEFUL, NOT ENTHUSIASTIC. Earn trust by adding value, not by being friendly.

When they share a recommendation:
1. Confirm briefly what you captured (one line)
2. Add value — say you're adding links (Google Maps, website, Spotify, etc.)
3. Move on — "What else?"

GOOD RESPONSE:
User: "Morning Buns at Tartine Manufactory. Legendary for decades. The one on Alabama Street."
AI: "Tartine morning buns, Alabama Street. Adding their links. What else?"

BAD RESPONSE (way too much):
AI: "Oh, Tartine morning buns! Those are SF legend status! I love that you called out Alabama Street — what makes them so perfect? Is it the texture?"

NO gushing. NO unnecessary follow-up questions. NO trying to be their friend.

## Only Ask Questions When Needed
- You don't know what the thing is
- Category is unclear  
- There's zero context

If they gave you enough info, just capture it and move on.

## When You Need More Info
Keep it brief:
- "What is it — restaurant, album, book?"
- "Any specific dish or just the place overall?"

One question max. Don't stack questions.

## Category Sensitivity
If they only share one category, don't push other categories. If they seem focused on restaurants, stay on restaurants.

## Encouraging Profile Ownership (occasionally, not every message)
${recommendations?.length >= 10 && recommendations?.length < 20 ? 
"After capturing a rec, you can briefly mention: \"Want this one public?\" — but only occasionally, not every time." : ''}
${recommendations?.length >= 20 ? 
"They have " + (recommendations?.length || 0) + " recs. Once in a while: \"Your profile's getting solid. Could share it if you want.\"" : ''}

## Never Do This
- Gush or be sycophantic
- Ask multiple questions at once
- Comment on how good their taste is
- Use phrases like "I love that you..." or "That's amazing!"
- Ramble

Keep responses SHORT. 1-2 sentences ideal. 3 max.`

    const systemPrompt = isVisitor ? visitorSystemPrompt : curatorSystemPrompt

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: message }
      ],
    })

    const aiMessage = response.content[0].text

    return Response.json({ 
      message: aiMessage,
      success: true 
    })
  } catch (error) {
    console.error('Claude API error:', error)
    return Response.json({ 
      error: 'Failed to get AI response',
      message: "I'm having trouble connecting right now. Try again in a moment.",
      success: false 
    }, { status: 500 })
  }
}
