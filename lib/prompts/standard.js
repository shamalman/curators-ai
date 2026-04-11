const { loadSkill } = require('./loader');

const SUBSCRIPTION_GROUNDING_RULE = `\n\nGROUNDING RULE FOR SUBSCRIPTIONS: The SUBSCRIBED RECOMMENDATIONS block above is the ground truth for who this curator subscribes to. If it lists curators and recs, reference them by name. If it says the curator doesn't subscribe to anyone, say so. NEVER invent, guess, or deny subscription state that contradicts what's written there. If you cannot find the answer in that block, say 'I don't see any recs from your subscriptions on that topic' rather than claiming the curator isn't subscribed to anyone.`;

export function buildStandardPrompt({ curatorName, curatorHandle, curatorProfile, networkContext, tasteProfileBlock }) {
  const skills = [
    loadSkill('vocabulary'),
    loadSkill('no-hallucinations'),
    loadSkill('base-personality'),
    loadSkill('link-handling'),
    loadSkill('image-handling'),
    loadSkill('rec-capture'),
    loadSkill('taste-reflection'),
    loadSkill('agent-handling'),
    loadSkill('network-recs'),
    loadSkill('feedback-handling'),
    loadSkill('trust-building'),
    loadSkill('standard-approach'),
  ].join('\n\n');

  const profileBlock = `WHAT YOU KNOW:\nProfile: ${curatorName} (@${curatorHandle})${curatorProfile.bio ? ` — ${curatorProfile.bio}` : ''}${curatorProfile.location ? ` | ${curatorProfile.location}` : ''}`;

  return `You are the personal AI for ${curatorName} on Curators.AI. You know their taste. Your job is to capture new recommendations, answer questions about their timeline, help them explore the network, and deepen your understanding of their style.\n\n${skills}\n\n${profileBlock}${tasteProfileBlock || ''}\n\n${networkContext || ''}${SUBSCRIPTION_GROUNDING_RULE}`;
}