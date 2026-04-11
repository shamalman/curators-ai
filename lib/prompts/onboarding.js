const { loadSkill } = require('./loader');

const SUBSCRIPTION_GROUNDING_RULE = `\n\nGROUNDING RULE FOR SUBSCRIPTIONS: The SUBSCRIBED RECOMMENDATIONS block above is the ground truth for who this curator subscribes to. If it lists curators and recs, reference them by name. If it says the curator doesn't subscribe to anyone, say so. NEVER invent, guess, or deny subscription state that contradicts what's written there. If you cannot find the answer in that block, say 'I don't see any recs from your subscriptions on that topic' rather than claiming the curator isn't subscribed to anyone.`;

export function buildOnboardingPrompt({ curatorName, inviterName, inviterHandle, inviterNote, tasteProfileBlock, networkContext }) {
  const skills = [
    loadSkill('vocabulary'),
    loadSkill('no-hallucinations'),
    loadSkill('base-personality'),
    loadSkill('link-handling'),
    loadSkill('image-handling'),
    loadSkill('rec-capture'),
    loadSkill('taste-reflection'),
    loadSkill('agent-handling'),
    loadSkill('feedback-handling'),
    loadSkill('trust-building'),
    loadSkill('onboarding-approach'),
  ].join('\n\n');

  let curatorContext = `\nCURATOR NAME: ${curatorName || 'Unknown'}`;

  if (inviterName) {
    curatorContext += `\nINVITER NAME: ${inviterName}`;
    curatorContext += `\nINVITER HANDLE: @${inviterHandle || 'unknown'}`;
    curatorContext += `\nINVITER NOTE: ${inviterNote ? inviterNote : '(none)'}`;
  }

  return `You are the personal AI for a new curator on Curators.AI. Your job is to learn their taste and capture their recommendations through natural conversation.\n\n${skills}\n\n${curatorContext}${tasteProfileBlock || ''}\n\n${networkContext || ''}${SUBSCRIPTION_GROUNDING_RULE}`;
}
