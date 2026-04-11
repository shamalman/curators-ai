# Rec Files Migration — Architecture & History

## What rec_files is

`rec_files` is the canonical structured storage for recommendations in the `.rec` format (spec: `rec-format-v1-spec.md` v1.0.2). It runs alongside `recommendations` as a parent/child pair — `recommendations` is the flat queryable index, `rec_files` is the rich content artifact.

## Current state (as of 2026-04-11)

- 30/30 production `recommendations` rows have non-null `rec_file_id`
- All curators covered: bradbarrish (7 recs), chris (2), roneil (2), shamal (17), warmerdam (2)
- Extraction mode breakdown: parsed (26), authored (3), uploaded (1)
- Dual-write is unconditional for all curators — `rec_files_writes_enabled` feature flag removed

## Dual-write architecture

Every rec save flows through `addRec` in `context/CuratorContext.jsx`:
1. Insert into `recommendations`
2. If `item.parsedPayload` present → call `ingestUrlCapture` → insert into `rec_files`
3. Update `recommendations.rec_file_id` to point at the new row

`buildRecFileRow` (`lib/rec-files/build.js`) assembles the row. It reads `parsedPayload.curator_is_author` and `parsedPayload.source_type` overrides, so paste/upload routes can thread flags through the unchanged `addRec` chain.

Failures in step 2-3 are logged and never thrown — the `recommendations` insert always succeeds.

## Capture entry points

- **URL** (`app/api/recs/parse-link/route.js`): `extraction_mode: 'parsed'`, real `source` block, `body_md` via parser registry, optional artifact in Supabase Storage
- **Paste** (`app/api/recs/paste/route.js`): `extraction_mode: 'pasted'`, no `source` block, `curator_is_author: true`, AI-infers metadata
- **Upload** (`app/api/recs/upload/route.js`): `extraction_mode: 'uploaded'`, synthetic `artifact://<sha256>` canonical URL
- **Chat image** (Feature B): JSON path through upload route, pre-uploaded artifact
- **Chat URL** (Feature C): `parsedPayload` reconstructed from `chat_messages.parsed_content`

## Backfill script

`scripts/backfill-rec-files.mjs` — standalone Node script (`.mjs` for ESM imports). Reads `.env.local` for service role key.

- `--curator <handle>` — single curator, defaults LIVE (`--dry-run` to preview)
- `--all` — all curators with unlinked recs, defaults DRY (`--live` to execute)
- Asymmetric safety: `--all` requires explicit `--live` because of global blast radius
- Synthesizes `body_md` from title + category + context + links, marks `extraction.lossy = true`, preserves original timestamps

## Read paths that use rec_files

- `CuratorContext.jsx` — secondary load merges `body_md`, `extraction`, `work`, `curation_block`, `curator_is_author` onto tasteItems
- `RecDetail.jsx` (CuratorRecDetail + NetworkRecDetail) — secondary load for `body_md` render
- `lib/taste-profile/generate.js` — enriches prompt with `work` and `curation` structured fields

## Known gaps

- `VisitorRecDetail` (RecDetail.jsx lines 653–944) does not render `body_md`
- `chat_messages.rec_refs` column exists but is not yet populated — reserved for future chat route migration to read from rec_files instead of re-injecting `parsed_content`
- `rec_blocks` table schema exists but is not populated

## Deploy history

- **Deploy 1 (pre-April 2026):** Schema foundation — `rec_files` table, `rec_blocks`, `recommendations.rec_file_id`, `chat_messages.rec_refs`
- **Deploy 2 (pre-April 2026):** URL capture dual-write behind `rec_files_writes_enabled` flag (shamal only)
- **Deploy 3 series (April 2026):** Paste + upload capture, QuickCaptureSheet tabs, verbatim "why" extraction
- **Deploy 4 (April 11, 2026):** Feature flag removed, dual-write unconditional for all curators. Backfill `--all` flag added. RecDetail body_md render with react-markdown. Taste profile enriched from rec_files.
