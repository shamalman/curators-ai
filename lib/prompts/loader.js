const fs = require('fs');
const path = require('path');

const stableSkillsDir = path.join(process.cwd(), 'lib', 'prompts', 'skills');
const stagingSkillsDir = path.join(process.cwd(), 'lib', 'prompts', 'skills', 'staging');

// No in-memory cache. Skills are small (~1-3KB each) and
// fs.readFileSync is microseconds. A module-level cache with no
// invalidation caused a cross-deploy bug on 2026-04-21 where warm
// Fluid Compute instances kept serving stale skill content after
// a deploy. The performance cost of reading from disk every call
// is negligible; the correctness cost of stale prompts is not.
function loadSkill(name, aiProfile = 'stable') {
  const dir = aiProfile === 'staging' ? stagingSkillsDir : stableSkillsDir;
  const filePath = path.join(dir, `${name}.md`);
  const content = fs.readFileSync(filePath, 'utf-8');
  if (aiProfile === 'staging') {
    console.log(`[SKILL_LOAD] profile=staging skill=${name}`);
  }
  return content;
}

module.exports = { loadSkill };
