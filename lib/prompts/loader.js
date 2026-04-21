const fs = require('fs');
const path = require('path');

const skillsDir = path.join(process.cwd(), 'lib', 'prompts', 'skills');

// No in-memory cache. Skills are small (~1-3KB each) and
// fs.readFileSync is microseconds. A module-level cache with no
// invalidation caused a cross-deploy bug on 2026-04-21 where warm
// Fluid Compute instances kept serving stale skill content after
// a deploy. The performance cost of reading from disk every call
// is negligible; the correctness cost of stale prompts is not.
function loadSkill(name) {
  const filePath = path.join(skillsDir, `${name}.md`);
  const content = fs.readFileSync(filePath, 'utf-8');
  return content;
}

module.exports = { loadSkill };
