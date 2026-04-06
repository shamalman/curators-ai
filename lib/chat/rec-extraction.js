// ── Extract structured rec capture from [REC]...[/REC] JSON tags ──
export function extractRecCapture(aiText) {
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


// Validate that recCapture.context is a verbatim substring of the curator's
// actual messages. If the AI paraphrased, replace with the raw curator message.
export function validateRecContext(recCapture, history, currentMessage) {
  if (!recCapture || !recCapture.title) return recCapture;

  let context = recCapture.context || '';

  // Strip any metadata pollution
  context = context.replace(/\[Pending link:.*?\]/gs, '').trim();
  context = context.replace(/\[Link metadata:.*?\]/gs, '').trim();
  context = context.replace(/\[REC\].*?\[\/REC\]/gs, '').trim();

  // If context is empty or just the title, use last user message as fallback
  if (!context || context.toLowerCase() === recCapture.title.toLowerCase()) {
    if (currentMessage) {
      context = currentMessage.replace(/\[Pending link:.*?\]/gs, '').trim();
    }
    recCapture.context = context;
    return recCapture;
  }

  // Build the curator corpus from all user messages in history + current message
  const userMessages = (history || [])
    .filter(m => m.role === 'user' && m.text)
    .map(m => m.text);
  if (currentMessage) {
    userMessages.push(currentMessage);
  }
  const corpus = userMessages.join(' ');

  // Normalize for comparison: lowercase, collapse whitespace, trim
  const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();

  const normalizedContext = normalize(context);
  const normalizedCorpus = normalize(corpus);

  if (normalizedCorpus.includes(normalizedContext)) {
    // Verbatim match -- keep the original (un-normalized) context with curator's casing
    recCapture.context = context;
  } else {
    // Paraphrased -- replace with the current user message
    const original = context;
    context = (currentMessage || '').replace(/\[Pending link:.*?\]/gs, '').trim();
    recCapture.context = context;
    console.warn(`[VERBATIM_VIOLATION] AI paraphrased rec context. Original: "${original}" -> Replaced with current user message.`);
  }

  return recCapture;
}
