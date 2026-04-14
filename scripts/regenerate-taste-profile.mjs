#!/usr/bin/env node
// scripts/regenerate-taste-profile.mjs
//
// One-time manual trigger to regenerate a curator's Taste File using the
// shared lib/taste-profile/generate.js pipeline.
//
// Usage:
//   node --experimental-vm-modules scripts/regenerate-taste-profile.mjs --profile <profile_id>

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { generateTasteProfile } from '../lib/taste-profile/generate.js';

function loadEnv() {
  const files = ['.env.local', '.env'];
  const env = {};
  for (const f of files) {
    if (!existsSync(f)) continue;
    const contents = readFileSync(f, 'utf8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in env)) env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check .env.local.');
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error('Missing ANTHROPIC_API_KEY. Check .env.local.');
  process.exit(1);
}
process.env.ANTHROPIC_API_KEY = ANTHROPIC_KEY;

const { values: args } = parseArgs({
  options: {
    profile: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (args.help || !args.profile) {
  console.log(`
Regenerate a curator's Taste File.

Required:
  --profile <profile_id>    The profiles.id UUID of the curator.

Example:
  node --experimental-vm-modules scripts/regenerate-taste-profile.mjs --profile d6d01b8d-b8f8-4560-bdbf-f6f01e4325f2
`);
  process.exit(args.help ? 0 : 1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const profileId = args.profile;
console.log(`Regenerating taste profile for profile_id=${profileId}...`);

try {
  const result = await generateTasteProfile(profileId, supabase);
  console.log(`\n✓ Taste profile generated. Version: ${result.version}`);
  console.log(`Length: ${result.content.length} chars\n`);
  console.log('--- CONTENT ---');
  console.log(result.content);
  console.log('--- END ---');
  process.exit(0);
} catch (err) {
  console.error('Failed to regenerate taste profile:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
}
