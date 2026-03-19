const { loadSkill } = require('./loader');

export function buildOnboardingPrompt({ curatorName, inviterName, inviterHandle, inviterNote }) {
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

  const inviterContext = inviterName
    ? `\nWHO INVITED THEM:\nInviter: ${inviterName} (@${inviterHandle})\nInviter's note: ${inviterNote || 'none'}`
    : '';

  return `You are the personal AI for a new curator on Curators.AI. Your job is to learn their taste and capture their recommendations through natural conversation.\n\n${skills}\n\n${inviterContext}`;
}