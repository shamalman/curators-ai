const { loadSkill } = require('./loader');

export function buildOnboardingPrompt({ curatorName, inviterName, inviterHandle, inviterNote, tasteProfileBlock }) {
  const skills = [
    loadSkill('vocabulary'),
    loadSkill('no-hallucinations'),
    loadSkill('base-personality'),
    loadSkill('link-handling'),
    loadSkill('image-handling'),
    loadSkill('rec-capture'),
    loadSkill('taste-reflection'),
    loadSkill('agent-handling'),
    loadSkill('onboarding-approach'),
  ].join('\n\n');

  let curatorContext = `\nCURATOR NAME: ${curatorName || 'Unknown'}`;

  if (inviterName) {
    curatorContext += `\nINVITER NAME: ${inviterName}`;
    curatorContext += `\nINVITER HANDLE: @${inviterHandle || 'unknown'}`;
    curatorContext += `\nINVITER NOTE: ${inviterNote || 'none'}`;
  }

  return `You are the personal AI for a new curator on Curators.AI. Your job is to learn their taste and capture their recommendations through natural conversation.\n\n${skills}\n\n${curatorContext}${tasteProfileBlock || ''}`;
}