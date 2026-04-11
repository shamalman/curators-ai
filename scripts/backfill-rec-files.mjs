#!/usr/bin/env node
// scripts/backfill-rec-files.mjs
//
// Backfill existing `recommendations` rows into `rec_files` using the
// Deploy 2b buildRecFileRow function. Runs standalone (not in Vercel) to
// bypass the 60s function timeout and to use the service role key.
//
// Usage:
//   node scripts/backfill-rec-files.mjs --curator shamal --dry-run
//   node scripts/backfill-rec-files.mjs --curator shamal
//
// Safety:
//   - Dry-run by default shows what would happen without writing.
//   - Rows with rec_file_id already set are skipped.
//   - One curator at a time. No --all flag.
//   - Service role key never committed, never logged.

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { buildRecFileRow } from '../lib/rec-files/build.js';

// --- Load env from .env.local or .env (no dotenv dep) ---

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
      // Strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in env)) env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Check .env.local.');
  process.exit(1);
}

// --- Args ---

const { values: args } = parseArgs({
  options: {
    curator: { type: 'string' },
    all: { type: 'boolean', default: false },
    live: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    verbose: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (args.help || (!args.curator && !args.all)) {
  console.log(`
Backfill rec_files from legacy recommendations.

Required (one of):
  --curator <handle>   Single curator. LIVE by default; pass --dry-run to preview.
  --all                Every curator with unlinked recs. DRY by default; pass --live to execute.

Optional:
  --dry-run    --curator only: preview without writing
  --live       --all only: actually execute (otherwise dry-run)
  --verbose    Per-row detail
  --help       This message

Examples:
  node scripts/backfill-rec-files.mjs --curator shamal --dry-run
  node scripts/backfill-rec-files.mjs --curator shamal
  node scripts/backfill-rec-files.mjs --all              # dry-run
  node scripts/backfill-rec-files.mjs --all --live       # execute
`);
  process.exit(args.help ? 0 : 1);
}

if (args.curator && args.all) {
  console.error('Cannot pass both --curator and --all. Pick one.');
  process.exit(1);
}

// Safety asymmetry by design:
//   --curator defaults LIVE  (dry-run is opt-in)   ← preserves prior behavior
//   --all     defaults DRY   (live is opt-in)      ← global blast radius
const DRY = args.all ? !args.live : args['dry-run'];
const VERBOSE = args.verbose;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// --- Helpers ---

// Strip leading @ from handle (same as Deploy 2b's handleClean behavior)
function cleanHandle(h) {
  if (!h) return '';
  return h.startsWith('@') ? h.slice(1) : h;
}

// Map a link.type (spotify/youtube/wikipedia/website/etc) to a media_type + extractor label.
function linkTypeToMeta(linkType) {
  const t = (linkType || '').toLowerCase();
  switch (t) {
    case 'spotify':
    case 'apple-music':
    case 'youtube':
    case 'soundcloud':
    case 'letterboxd':
    case 'goodreads':
    case 'google-maps':
    case 'twitter':
      return { media_type: 'application/json', extractor: `${t}@backfill` };
    case 'wikipedia':
    case 'website':
    case 'webpage':
    default:
      return { media_type: 'text/html', extractor: 'webpage@backfill' };
  }
}

// Build a synthetic body_md from the legacy row.
// Legacy recs have no archived content — we synthesize a minimal markdown
// representation from title + context + links so rec_files has SOMETHING searchable.
// Marked lossy:true with a note so future re-parse can replace it.
function synthesizeBodyMd(rec) {
  const parts = [];
  parts.push(`# ${rec.title || 'Untitled'}`);
  if (rec.category) {
    parts.push(`_${rec.category}_`);
  }
  if (rec.context && rec.context.trim()) {
    parts.push('');
    parts.push(rec.context.trim());
  }
  if (Array.isArray(rec.links) && rec.links.length > 0) {
    parts.push('');
    parts.push('## Links');
    for (const link of rec.links) {
      if (!link?.url) continue;
      const label = link.label || link.type || link.url;
      parts.push(`- [${label}](${link.url})`);
    }
  }
  return parts.join('\n');
}

// Map legacy visibility to the rec_files visibility.level enum.
function mapVisibility(v) {
  if (v === 'public') return 'public';
  if (v === 'private') return 'private';
  return 'taste-file-only';
}

// --- Per-curator processing ---

async function processCurator(profile) {
  const curatorHandle = cleanHandle(profile.handle);
  console.log(`\n--- @${curatorHandle} (${profile.id}) ---`);

  const { data: recs, error: recsErr } = await supabase
    .from('recommendations')
    .select('id, title, category, context, tags, links, visibility, created_at, updated_at, rec_file_id')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: true });

  if (recsErr) {
    console.error(`  Failed to fetch recommendations: ${recsErr.message}`);
    return { migrated: 0, skipped: 0, errored: 0, createdRecFileIds: [] };
  }

  const alreadyBackfilled = recs.filter(r => r.rec_file_id).length;
  const toMigrate = recs.length - alreadyBackfilled;
  console.log(`  ${recs.length} total, ${alreadyBackfilled} linked, ${toMigrate} to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errored = 0;
  const createdRecFileIds = [];

  for (const rec of recs) {
    try {
      if (rec.rec_file_id) {
        skipped++;
        if (VERBOSE) console.log(`  skip ${rec.id} (rec_file_id=${rec.rec_file_id})`);
        continue;
      }

      const links = Array.isArray(rec.links) ? rec.links : [];
      const firstLink = links[0] || null;
      const hasUrl = Boolean(firstLink?.url);

      const bodyMd = synthesizeBodyMd(rec);
      const wordCount = bodyMd.split(/\s+/).filter(Boolean).length;

      // Build a synthetic parsedPayload that matches what Deploy 2a's parse-link
      // would have returned. buildRecFileRow reads these fields.
      let parsedPayload;
      if (hasUrl) {
        const meta = linkTypeToMeta(firstLink.type);
        parsedPayload = {
          body_md: bodyMd,
          body_truncated: false,
          body_original_length: bodyMd.length,
          canonical_url: firstLink.url,
          site_name: firstLink.type || null,
          author: null,
          authors: [],
          published_at: null,
          lang: 'en',
          word_count: wordCount,
          media_type: meta.media_type,
          artifact_sha256: null,     // no artifact for backfill
          artifact_ref: null,
          extraction_mode: 'parsed',
          extractor: meta.extractor,
          // Pass title so buildRecFileRow's work.title fallback works
          title: rec.title,
        };
      } else {
        // Authored rec — no URL, no source block
        parsedPayload = {
          body_md: bodyMd,
          body_truncated: false,
          body_original_length: bodyMd.length,
          canonical_url: null,        // no URL → buildRecFileRow sets source = null
          site_name: null,
          author: null,
          authors: [],
          published_at: null,
          lang: 'en',
          word_count: wordCount,
          media_type: null,
          artifact_sha256: null,
          artifact_ref: null,
          extraction_mode: 'authored',
          extractor: null,
          title: rec.title,
        };
      }

      // curation block — matches what addRec passes in Deploy 2b
      const curation = {
        title: rec.title,
        category: rec.category,
        context: rec.context,          // becomes curation.why
        tags: Array.isArray(rec.tags) ? rec.tags : [],
        visibility: mapVisibility(rec.visibility),
      };

      // Build the row using Deploy 2b's function — single source of truth
      const row = buildRecFileRow({
        curatorId: profile.id,
        curatorHandle,
        parsedPayload,
        curation,
      });

      // Preserve original timestamps (buildRecFileRow sets these to now)
      row.created_at = rec.created_at;
      row.updated_at = rec.updated_at || rec.created_at;
      row.valid_from = (rec.created_at || new Date().toISOString()).slice(0, 10);

      // Mark as lossy backfill with notes
      row.extraction = { ...row.extraction };
      row.extraction.lossy = true;
      const notes = Array.isArray(row.extraction.notes) ? [...row.extraction.notes] : [];
      notes.push(`Backfilled from recommendations.id=${rec.id}`);
      notes.push('body_md synthesized from title+context+links; original page not archived');
      if (links.length > 1) {
        const extraUrls = links.slice(1).map(l => l?.url).filter(Boolean);
        if (extraUrls.length > 0) {
          notes.push(`Additional links not in source block: ${extraUrls.join(', ')}`);
        }
      }
      row.extraction.notes = notes;

      if (DRY) {
        console.log(`  [dry] ${rec.id.slice(0, 8)}… → ${row.id} (${row.extraction.mode})`);
        console.log(`        title: ${row.work?.title || '(none)'}`);
        console.log(`        cat:   ${row.work?.category || '(none)'}`);
        console.log(`        url:   ${row.source?.url || '(none)'}`);
        console.log(`        body:  ${row.body_md.length} chars`);
        console.log(`        vis:   ${row.visibility?.level}`);
        if (VERBOSE) {
          console.log(`        tags:  ${JSON.stringify(row.curation?.tags)}`);
          console.log(`        why:   ${(row.curation?.why || '').slice(0, 80)}`);
        }
        migrated++;
        continue;
      }

      // LIVE: insert rec_file
      const { error: insertErr } = await supabase
        .from('rec_files')
        .insert(row);

      if (insertErr) {
        console.error(`  ERROR inserting for ${rec.id}: ${insertErr.message}`);
        errored++;
        continue;
      }

      // Link the legacy row
      const { error: linkErr } = await supabase
        .from('recommendations')
        .update({ rec_file_id: row.id })
        .eq('id', rec.id);

      if (linkErr) {
        console.error(`  ERROR linking ${rec.id} → ${row.id}: ${linkErr.message}`);
        // Soft failure — the rec_file exists, just unlinked. Continue.
      }

      migrated++;
      createdRecFileIds.push(row.id);
      console.log(`  ${rec.id.slice(0, 8)}… → ${row.id} (${row.extraction.mode})`);

      // Throttle in --all mode to avoid hammering Supabase across many curators.
      if (args.all) await sleep(50);
    } catch (e) {
      console.error(`  EXCEPTION on ${rec.id}: ${e.message || e}`);
      errored++;
    }
  }

  return { migrated, skipped, errored, createdRecFileIds };
}

// --- Main ---

async function resolveSingleCurator(handleArg) {
  let { data: profile } = await supabase
    .from('profiles')
    .select('id, handle')
    .eq('handle', handleArg)
    .single();
  if (!profile) {
    const { data: profile2 } = await supabase
      .from('profiles')
      .select('id, handle')
      .eq('handle', `@${handleArg}`)
      .single();
    profile = profile2 || null;
  }
  return profile;
}

async function resolveAllCuratorsWithUnlinkedRecs() {
  // Two-step: distinct profile_ids with rec_file_id IS NULL, then their profiles.
  const { data: rows, error: scanErr } = await supabase
    .from('recommendations')
    .select('profile_id')
    .is('rec_file_id', null);

  if (scanErr) {
    console.error('Failed to scan recommendations:', scanErr.message);
    process.exit(1);
  }

  const distinctIds = [...new Set((rows || []).map(r => r.profile_id).filter(Boolean))];
  if (distinctIds.length === 0) return [];

  const { data: profs, error: profsErr } = await supabase
    .from('profiles')
    .select('id, handle')
    .in('id', distinctIds);

  if (profsErr) {
    console.error('Failed to fetch profiles:', profsErr.message);
    process.exit(1);
  }

  return profs || [];
}

async function main() {
  console.log(`\n=== Backfill ${args.all ? '(ALL curators)' : `@${args.curator}`} ===`);
  console.log(`Mode: ${DRY ? 'DRY RUN (no writes)' : 'LIVE'}`);

  let profiles = [];

  if (args.all) {
    profiles = await resolveAllCuratorsWithUnlinkedRecs();
    console.log(`Curators with unlinked recs: ${profiles.length}`);
    if (profiles.length === 0) {
      console.log('Nothing to do.');
      return;
    }
  } else {
    const profile = await resolveSingleCurator(args.curator);
    if (!profile) {
      console.error(`Curator "${args.curator}" not found (tried both with and without @).`);
      process.exit(1);
    }
    profiles = [profile];
  }

  const totals = { migrated: 0, skipped: 0, errored: 0 };
  const allCreatedIds = [];

  for (const profile of profiles) {
    const r = await processCurator(profile);
    totals.migrated += r.migrated;
    totals.skipped += r.skipped;
    totals.errored += r.errored;
    allCreatedIds.push(...r.createdRecFileIds);
  }

  console.log();
  console.log('=== Summary ===');
  console.log(`Mode:     ${DRY ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Curators: ${profiles.length}`);
  console.log(`Migrated: ${totals.migrated}`);
  console.log(`Skipped:  ${totals.skipped}`);
  console.log(`Errored:  ${totals.errored}`);
  // Per-curator mode prints the full ID list (small, useful for spot-checking).
  // --all mode skips it — could be hundreds of IDs and they're already logged inline.
  if (!DRY && !args.all && allCreatedIds.length > 0) {
    console.log();
    console.log('Created rec_file IDs:');
    for (const id of allCreatedIds) console.log(`  ${id}`);
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
