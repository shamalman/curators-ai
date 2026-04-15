import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { "anthropic-no-log": "true" },
});

export async function generateTasteProfile(profileId, supabase) {
  // 1. Fetch curator's data
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, name, bio, location')
    .eq('id', profileId)
    .single();

  if (!profile) throw new Error('Profile not found');

  const { data: recs, error: recsError } = await supabase
    .from('recommendations')
    .select('title, category, context, tags, created_at, rec_file_id')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true });

  console.log('Taste profile generation - profileId:', profileId, 'recs found:', recs?.length || 0, 'error:', recsError?.message || 'none');

  if (!recs || recs.length === 0) {
    throw new Error(`No recs to generate taste profile from (profileId: ${profileId}, error: ${recsError?.message || 'none'})`);
  }

  // Secondary fetch: enrich with rec_files structured data when available.
  // Null-safe — if this fails, we fall back to recommendations-only fields below.
  const recFileIds = recs.map(r => r.rec_file_id).filter(Boolean);
  let recFilesById = {};
  if (recFileIds.length > 0) {
    const { data: recFilesData, error: recFilesErr } = await supabase
      .from('rec_files')
      .select('id, work, curation, extraction, body_md')
      .in('id', recFileIds);

    if (recFilesErr) {
      console.warn('[taste-profile] rec_files secondary load failed, falling back to recommendations-only:', recFilesErr.message);
    } else if (recFilesData) {
      recFilesById = Object.fromEntries(recFilesData.map(rf => [rf.id, rf]));
    }
  }

  // Build the enriched view. Prefer structured rec_files fields when present;
  // fall back to legacy recommendations columns. Authored-mode rows with no
  // archived body are treated as unenriched (the rec_files row exists but
  // carries no signal beyond what the legacy columns already gave us).
  let enrichedCount = 0;
  const enrichedRecs = recs.map(r => {
    const rf = r.rec_file_id ? recFilesById[r.rec_file_id] : null;
    const skipEnrichment = !rf || (rf.extraction?.mode === 'authored' && !rf.body_md);
    if (skipEnrichment) {
      return {
        title: r.title,
        category: r.category,
        why: r.context || null,
        site_name: null,
        authors: [],
        tags: Array.isArray(r.tags) ? r.tags : [],
        conviction: null,
      };
    }
    enrichedCount++;
    const work = rf.work || {};
    const curation = rf.curation || {};
    return {
      title: work.title || r.title,
      category: r.category,
      why: curation.why || r.context || null,
      site_name: work.site_name || null,
      authors: Array.isArray(work.authors) ? work.authors : [],
      tags: Array.isArray(curation.tags) && curation.tags.length > 0
        ? curation.tags
        : (Array.isArray(r.tags) ? r.tags : []),
      conviction: curation.conviction || null,
    };
  });

  console.log('[taste-profile] enriched', enrichedCount, 'of', recs.length, 'recs from rec_files');

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
${enrichedRecs.map(r => {
  const head = [`- [${r.category}] ${r.title}`];
  if (r.authors.length > 0) head.push(`by ${r.authors.join(', ')}`);
  if (r.site_name) head.push(`(${r.site_name})`);
  let line = head.join(' ');
  line += ` — ${r.why || 'no context'}.`;
  if (r.tags.length > 0) line += ` Tags: ${r.tags.join(', ')}.`;
  if (r.conviction) line += ` Conviction: ${r.conviction}.`;
  return line;
}).join('\n')}

${subscriptions.length > 0 ? `CURATORS THEY SUBSCRIBE TO:\n${subscriptions.map(s => `- @${s.handle}`).join('\n')}` : ''}

${confirmations && confirmations.length > 0 ? `=== CONFIRMED TASTE OBSERVATIONS (curator-endorsed signals) ===
${confirmations.map(c => `- [${c.type}] (${c.created_at})\n"${c.observation}"`).join('\n\n')}
=== END ===

Use these observations as signals to inform and enrich the Thesis, Domains, and Patterns sections. Extract themes, specific references, and curatorial instincts from them. Do NOT quote them verbatim and do NOT create a separate section for them. They are source material, not output content.` : ''}

Generate the taste profile markdown document with these sections:

# Taste Profile: @${profile.handle}

## Thesis
[1-3 sentences: your core read on this curator's taste identity. Only write this if you have enough data to form a real thesis. If less than 3 recs, write "Building..." instead.]

## Domains
[Ranked by strength based on rec count and depth. Include the category, their specific angle, and any patterns you see.]

## Patterns
[Cross-domain observations. What connects their recs across categories? Only include patterns supported by the data.]

## Voice & Style
[How they communicate based on their rec contexts. Are they precise or vibes-based? Casual or formal? Do they give specific instructions or broad endorsements?]

## Curators They Subscribe To
[List from the subscription data. This is a CONSUMPTION signal, not a TASTE signal. Keep it as a simple list.]

## Anti-Taste
[Only if there are confirmed anti-taste observations. Otherwise omit.]

## Stats
- ${recs.length} recommendations across ${[...new Set(recs.map(r => r.category))].length} categories
- ${(confirmations || []).filter(c => c.type === 'taste_read_confirmed' || c.type === 'correction').length} taste signals confirmed or corrected
- ${subscriptions.length} subscriptions
- Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

RULES:
- Never invent observations not supported by the data
- Never use em dashes
- Be specific. Reference actual rec titles and patterns.
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
        rec_files_enriched: enrichedCount,
        confirmation_count: confirmations?.length || 0,
        taste_read_confirmed_count: (confirmations || []).filter(c => c.type === 'taste_read_confirmed').length,
        taste_read_corrected_count: (confirmations || []).filter(c => c.type === 'correction').length,
        subscription_count: subscriptions.length,
        generated_from: 'rec_files+recommendations+subscriptions+confirmations',
      },
      generated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' });

  if (error) {
    console.error('Failed to save taste profile:', error);
    throw error;
  }

  return { content: markdownContent, version: newVersion };
}