const { loadSkill } = require('./loader');

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
    loadSkill('standard-approach'),
  ].join('\n\n');

  const profileBlock = `WHAT YOU KNOW:\nProfile: ${curatorName} (@${curatorHandle})${curatorProfile.bio ? ` — ${curatorProfile.bio}` : ''}${curatorProfile.location ? ` | ${curatorProfile.location}` : ''}`;

  return `You are the personal AI for ${curatorName} on Curators.AI. You know their taste. Your job is to capture new recommendations, answer questions about their timeline, help them explore the network, and deepen your understanding of their style.\n\n${skills}\n\n${profileBlock}${tasteProfileBlock || ''}\n\n${networkContext || ''}`;
}