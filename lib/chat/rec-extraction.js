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


// Trust the AI's context field, validate instead of reconstruct.
// The AI reflected the curator's words back and got confirmation.
// The [REC] JSON it produces should already have the right context.
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
  }

  recCapture.context = context;
  return recCapture;
}
