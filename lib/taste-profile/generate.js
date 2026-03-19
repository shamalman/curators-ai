import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { "anthropic-no-log": "true" },
});

export async function generateTasteProfile(profileId, supabase) {
  // 1. Fetch curator's data
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, name, bio, location, style_summary')
    .eq('id', profileId)
    .single();

  if (!profile) throw new Error('Profile not found');

  const { data: recs } = await supabase
    .from('recommendations')
    .select('title, category, context, tags, content_type, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true });

  if (!recs || recs.length === 0) {
    throw new Error('No recs to generate taste profile from');
  }

  // Two-step query for subscriptions (no join aliases)
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('curator_id')
    .eq('subscriber_id', profileId)
    .is('unsubscribed_at', null);

  const subscribedIds = (subs || []).map(s => s.curator_id);
  let subscriptions = [];
  if (subscribedIds.length > 0) {
    const { data: subProfiles } = await supabase
      .from('profiles')
      .select('id, handle, name')
      .in('id', subscribedIds);
    subscriptions = subProfiles || [];
  }

  const { data: confirmations } = await supabase
    .from('taste_confirmations')
    .select('type, observation, source, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true });

  const { data: existingProfile } = await supabase
    .from('taste_profiles')
    .select('version')
    .eq('profile_id', profileId)
    .single();

  // 2. Build the Claude prompt
  const prompt = `You are generating a taste profile document for a curator on Curators.AI.
This document will be read by AI systems to understand this curator's taste.

Generate a markdown document following this EXACT structure. Only include sections where you have data. Do not invent or hallucinate information.

CURATOR: ${profile.name} (@${profile.handle})
${profile.bio ? `BIO: ${profile.bio}` : ''}
${profile.location ? `LOCATION: ${profile.location}` : ''}

THEIR RECOMMENDATIONS (${recs.length} total):
${recs.map(r => `- ${r.title} [${r.category}/${r.content_type}]: ${r.context || 'no context'} (tags: ${(r.tags || []).join(', ')})`).join('\n')}

${subscriptions.length > 0 ? `CURATORS THEY SUBSCRIBE TO:\n${subscriptions.map(s => `- @${s.handle}`).join('\n')}` : ''}

${confirmations && confirmations.length > 0 ? `CONFIRMED TASTE OBSERVATIONS:\n${confirmations.map(c => `- [${c.type}] "${c.observation}" (${c.created_at})`).join('\n')}` : ''}

${profile.style_summary ? `EXISTING STYLE SUMMARY (for reference, incorporate into Voice & Style):\n${JSON.stringify(profile.style_summary)}` : ''}

Generate the taste profile markdown document with these sections:

# Taste Profile: @${profile.handle}

## Thesis
[1-3 sentences: your core read on this curator's taste identity. Only write this if you have enough data to form a real thesis. If less than 3 recs, write "Building..." instead.]

## Domains
[Ranked by strength based on rec count and depth. Include the category, their specific angle, and any patterns you see.]

## Patterns
[Cross-domain observations. What connects their recs across categories? Only include patterns supported by the data.]

## Confirmed Observations
[Include ALL confirmed observations from the CONFIRMED TASTE OBSERVATIONS data above, verbatim with timestamps. If none exist, omit this section entirely.]

## Voice & Style
[How they communicate based on their rec contexts. Are they precise or vibes-based? Casual or formal? Do they give specific instructions or broad endorsements?]

## Curators They Subscribe To
[List from the subscription data. This is a CONSUMPTION signal, not a TASTE signal. Keep it as a simple list.]

## Anti-Taste
[Only if there are confirmed anti-taste observations. Otherwise omit.]

## Stats
- ${recs.length} recommendations across ${[...new Set(recs.map(r => r.category))].length} categories
- ${subscriptions.length} subscriptions
- Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

RULES:
- Never invent observations not supported by the data
- Never use em dashes
- Be specific. Reference actual rec titles and patterns.
- If confirmed observations exist, include them VERBATIM. Do not rephrase.
- Keep it concise. This document should be under 500 words.
- Output ONLY the markdown document. No preamble, no explanation.`;

  // 3. Call Claude API
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const markdownContent = response.content[0].text;

  // 4. Upsert into taste_profiles
  const newVersion = (existingProfile?.version || 0) + 1;

  const { error } = await supabase
    .from('taste_profiles')
    .upsert({
      profile_id: profileId,
      content: markdownContent,
      version: newVersion,
      sources: {
        rec_count: recs.length,
        confirmation_count: confirmations?.length || 0,
        subscription_count: subscriptions.length,
        generated_from: 'recs+subscriptions+confirmations',
      },
      generated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' });

  if (error) {
    console.error('Failed to save taste profile:', error);
    throw error;
  }

  return { content: markdownContent, version: newVersion };
}