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

// Pure affirmations that should NOT be used as rec context.
// Lowercase, punctuation-stripped comparison.
const PURE_AFFIRMATIONS = new Set([
  'yes', 'yeah', 'yep', 'yup', 'ya', 'y',
  'ok', 'okay', 'k', 'kk',
  'sure', 'sounds good', 'sgtm',
  'save it', 'save', 'do it', 'go for it', 'go ahead',
  'please', 'pls', 'plz',
  'thanks', 'thank you', 'ty',
  'yes please', 'yeah save it', 'yes save it',
  'confirmed', 'confirm',
]);

const MIN_CONTEXT_LENGTH = 15; // characters — "the new Neurosis album" = 22

function isPureAffirmation(text) {
  if (!text) return true;
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return true;
  return PURE_AFFIRMATIONS.has(normalized);
}

// Walk backwards through history, skip affirmations, return first substantive
// user message. Returns empty string if nothing substantive found.
function findSubstantiveMessage(conversationHistory) {
  if (!Array.isArray(conversationHistory)) return '';
  for (let i = conversationHistory.length - 1; i >= 0; i--) {
    const msg = conversationHistory[i];
    if (!msg || msg.role !== 'user') continue;
    const text = typeof msg.content === 'string' ? msg.content : msg.text || '';
    const cleaned = text.replace(/\[Pending link:.*?\]/gs, '').replace(/\[Link metadata:.*?\]/gs, '').trim();
    if (isPureAffirmation(cleaned)) continue;
    if (cleaned.length < MIN_CONTEXT_LENGTH) continue;
    return cleaned;
  }
  return '';
}


// Validate that recCapture.context is a verbatim substring of the curator's
// actual messages. If the AI paraphrased, replace with the most recent
// substantive curator message (skipping pure affirmations like "Yes").
export function validateRecContext(recCapture, history, currentMessage) {
  if (!recCapture || !recCapture.title) return recCapture;

  let context = recCapture.context || '';

  // Strip any metadata pollution
  context = context.replace(/\[Pending link:.*?\]/gs, '').trim();
  context = context.replace(/\[Link metadata:.*?\]/gs, '').trim();
  context = context.replace(/\[REC\].*?\[\/REC\]/gs, '').trim();

  // If context is empty or just the title, fall back to the most recent
  // substantive curator message (NOT the current message, which may be
  // a pure affirmation like "Yes").
  if (!context || context.toLowerCase() === recCapture.title.toLowerCase()) {
    const historyWithCurrent = [...(history || [])];
    if (currentMessage) {
      historyWithCurrent.push({ role: 'user', content: currentMessage });
    }
    const substantive = findSubstantiveMessage(historyWithCurrent);
    console.log('[REC_EXTRACTION] Empty-context fallback triggered:', {
      originalContext: recCapture.context || '',
      fallbackContext: substantive ? substantive.slice(0, 60) + '...' : '(empty)',
      currentMessageWas: (currentMessage || '').slice(0, 30),
    });
    recCapture.context = substantive;
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
    // Paraphrased -- fall back to the most recent substantive curator message.
    // Previously this fell back to currentMessage, which would populate context
    // with "Yes" when the curator was just affirming a save prompt.
    const original = context;
    const historyWithCurrent = [...(history || [])];
    if (currentMessage) {
      historyWithCurrent.push({ role: 'user', content: currentMessage });
    }
    const substantive = findSubstantiveMessage(historyWithCurrent);
    recCapture.context = substantive;
    console.warn(`[VERBATIM_VIOLATION] AI paraphrased rec context. Original: "${original}" -> Replaced with substantive message.`);
    console.log('[REC_EXTRACTION] Verbatim-violation fallback triggered:', {
      originalContext: original,
      fallbackContext: substantive ? substantive.slice(0, 60) + '...' : '(empty)',
      currentMessageWas: (currentMessage || '').slice(0, 30),
    });
  }

  return recCapture;
}
