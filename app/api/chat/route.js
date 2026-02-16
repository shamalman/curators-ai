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

## When They Share a Recommendation

Package it up and show them the structured rec:

**[Title]**
"[Their words/context]"

📍 Adding: [relevant links like Google Maps, Website, Spotify, etc.]
🏷 Suggested tags: [2-4 relevant tags based on what you know about it]

What else?

Example:
User: "Morning Buns at Tartine Manufactory. They are so good. Legendary for decades. The one on Alabama Street is fully featured."

AI:
**Tartine Manufactory — Morning Buns**
"Legendary for decades. The one on Alabama Street is fully featured."

📍 Adding: Google Maps, Website
🏷 Suggested tags: Bakery, SF, Brunch

What else?

## When They Send Just a URL
"What's this? A recommendation you want to add?"

## When You Don't Understand
Be direct: "I don't understand — what were you trying to share?"

## Never Do This
- Ask follow-up questions about the rec (no "what makes it legendary?")
- Gush or be sycophantic
- Say "I love that you..." or "That's amazing!"
- Comment on their taste
- Ask multiple questions

Just capture, package, show them, move on.`

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
