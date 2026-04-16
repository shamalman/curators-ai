import { getCuratorStats } from './curator-stats.js';

export const CURATOR_STATS_TOOL = {
  name: 'get_curator_stats',
  description: `Get the curator's engagement stats: how many people saved their recs, subscriber counts, top-performing recs, posting cadence, and network growth.

CALL THIS TOOL when the curator asks about:
- Saves ("how many people saved my recs", "am I getting saves")
- Subscribers ("how many subscribers do I have", "is my audience growing")
- Reach or engagement ("how am I doing", "what's my reach")
- Top-performing recs ("which of my recs is doing best")
- Posting activity ("how many recs have I posted", "when did I last post")
- Network growth ("how many new curators joined", "is the network growing")

DO NOT call this tool:
- Unprompted. Only when the curator explicitly asks a stats-related question.
- For rec recommendations ("what should I recommend next"), use recs context, not stats.
- For taste-profile questions, those are in the taste profile block.

If the tool returns an error or empty data, be honest: "I don't have that data yet", never fabricate numbers.`,
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function handleCuratorStatsTool(supabase, curatorId) {
  try {
    const stats = await getCuratorStats(supabase, curatorId);
    return { success: true, stats };
  } catch (err) {
    console.error('[CURATOR_STATS_ERROR]', err.message);
    return { success: false, error: err.message };
  }
}
