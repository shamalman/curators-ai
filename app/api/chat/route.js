import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { message, isVisitor, curatorName, recommendations } = await request.json()

    // Build the recommendations context dynamically
    const recsContext = recommendations && recommendations.length > 0
      ? recommendations.map(rec => `- ${rec.title} (${rec.category}): "${rec.context}" [Tags: ${rec.tags?.join(', ') || 'none'}]`).join('\n')
      : 'No recommendations yet.';

    const systemPrompt = isVisitor 
      ? `You are ${curatorName}'s taste AI — trained on their personal recommendations. You know what ${curatorName} loves, why they love it, and who it's for. Help visitors find the right recommendation for their needs. Be warm, helpful, and conversational. Keep responses concise for mobile.

Here are ${curatorName}'s recommendations:
${recsContext}

When responding:
- Reference specific recommendations when relevant
- Match the curator's voice and energy
- Be helpful but not overly formal
- Keep responses short (2-4 sentences usually)`
      : `You are the AI behind Curators — a tool that helps people capture, structure, and share their personal recommendations.

You are talking to ${curatorName}, a curator building their taste timeline. Here are their current recommendations:
${recsContext}

YOUR ROLE:
- Help the curator capture new recommendations through natural conversation
- Answer questions about their existing taste timeline
- Extract structured recommendation data from casual mentions
- Be conversational, warm, and match their energy
- Don't be sycophantic or overly formal

When they share something new:
1. Acknowledge it naturally
2. Ask clarifying questions: What stood out? Who would you send there? Tips?
3. Help them articulate why it matters

Keep responses concise - this is a mobile chat interface.`

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
