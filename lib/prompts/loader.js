const fs = require('fs');
const path = require('path');

const skillsDir = path.join(process.cwd(), 'lib', 'prompts', 'skills');
const skillCache = {};

function loadSkill(name) {
  if (skillCache[name]) return skillCache[name];
  const filePath = path.join(skillsDir, `${name}.md`);
  const content = fs.readFileSync(filePath, 'utf-8');
  skillCache[name] = content;
  return content;
}

module.exports = { loadSkill };