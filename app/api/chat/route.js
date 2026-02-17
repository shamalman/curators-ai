import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { message, isVisitor, curatorName, recommendations, linkMetadata, pendingLink } = await request.json()

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

    const visitorSystemPrompt = `You are ${curatorName}'s taste AI — trained on their personal recommendations.

Here are ${curatorName}'s ${recommendations?.length || 0} recommendations:
${recsContext}

Help visitors find the right recommendation. Be helpful and concise. 2-3 sentences max.`

    const curatorSystemPrompt = `You are the curator's AI partner. Capture recommendations and add value.

## Curator Context
- Name: ${curatorName}
- Recommendations: ${recommendations?.length || 0}
- Categories: ${categoryBreakdown}

Their current recs:
${recsContext}

## TWO-STEP FLOW FOR LINKS

### Step 1: When curator pastes a link (has [Link metadata])

Acknowledge what it is, then ask for their take. Keep it brief and natural.

Example:
User: "https://youtube.com/watch?v=xyz
[Link metadata: "Time In A Bottle - Jim Croce" from YouTube]"

AI: "Jim Croce, Time In A Bottle — classic. What's your take on this one?"

Do NOT show the full card yet. Just acknowledge and ask.

### Step 2: When curator gives their take (has [Pending link])

NOW package the full card with their context.

Example:
User: "This song always gets me. The lyrics about time are so poignant.
[Pending link: "Time In A Bottle - Jim Croce" from YouTube, url: https://youtube.com/watch?v=xyz]"

AI:
**Time In A Bottle — Jim Croce**
"This song always gets me. The lyrics about time are so poignant."

📁 Category: music
📍 Link: YouTube
🏷 Suggested tags: Folk, Classic Rock, 70s, Timeless

What else?

## REGULAR RECOMMENDATIONS (no link)

When curator shares a recommendation without a link, identify:
1. **CATEGORY**: restaurant, book, music, tv, film, travel, product, other
2. **PRIMARY RECOMMENDATION**: The main thing
3. **SIGNATURE/HIGHLIGHT**: What makes it special

Package it immediately:

**[Title]**
"[Their context]"

📁 Category: [category]
📍 Adding: [relevant links]
🏷 Suggested tags: [tags]

What else?

## Category Guide
- restaurant: Restaurants, cafes, bars, bakeries
- music: Artists, albums, songs, tracks
- book: Books, authors
- tv: TV shows
- film: Movies, documentaries
- travel: Hotels, destinations
- product: Products, apps, services

## Rules
- For links: Ask for take FIRST, then package
- For regular recs: Package immediately
- Keep acknowledgments brief and natural
- NO gushing
- Use their energy and words`

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
