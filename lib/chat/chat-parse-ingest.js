// lib/chat/chat-parse-ingest.js
// Fire-and-forget: write rec_files rows for chat-parsed URLs.
// Never throws. Returns [] on any failure.
import { createClient } from '@supabase/supabase-js';
import { generateRecId } from '../rec-files/id.js';
import { computeContentHash } from '../rec-files/hash.js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * For each successfully parsed URL block from the chat route:
 * - Check if a rec_files row already exists for this url + curator_id
 * - If not, insert one with extraction.extractor = 'chat-parse@v1'
 * - Return the array of rec_files IDs (existing or newly inserted)
 *
 * Never throws. Returns [] on any failure.
 *
 * @param {Array} parsedBlocks - from parsedContentForStorage (quality !== 'failed')
 * @param {string} curatorId - profile UUID
 * @param {string} curatorHandle - profile handle (no @ prefix)
 * @returns {Promise<string[]>} rec_files IDs
 */
export async function ingestChatParsedBlocks(parsedBlocks, curatorId, curatorHandle) {
  if (!parsedBlocks?.length || !curatorId) return [];

  const sb = getSupabaseAdmin();
  const recFileIds = [];

  for (const block of parsedBlocks) {
    try {
      const url = block.url;
      if (!url) continue;

      // Check for existing rec_files row for this url + curator
      const { data: existing, error: lookupError } = await sb
        .from('rec_files')
        .select('id')
        .eq('curator_id', curatorId)
        .eq('source->>url', url)
        .maybeSingle();

      if (lookupError) {
        console.error('[chat-parse-ingest] lookup error:', lookupError.message, { url, curatorId });
        continue;
      }

      if (existing) {
        recFileIds.push(existing.id);
        continue;
      }

      // Build a minimal rec_files row from the parsed block
      const id = generateRecId();
      const now = new Date().toISOString();
      const today = now.slice(0, 10);

      const title = block.metadata?.title || url;
      const siteName = block.metadata?.providerName || block.metadata?.source || null;
      const authors = block.metadata?.author ? [block.metadata.author] : [];
      const bodyMd = block.content || '';
      const contentHash = computeContentHash(bodyMd);

      const row = {
        id,
        version: 1,
        schema_version: 'curators.rec/v1',
        curator_id: curatorId,
        curator_handle: curatorHandle || '',
        curator_is_author: false,
        created_at: now,
        updated_at: now,
        valid_from: today,
        body_md: bodyMd,
        content_sha256: contentHash,
        source: {
          url,
          fetched_at: now,
        },
        work: {
          title,
          site_name: siteName,
          authors,
          url,
        },
        curation: {
          why: null,
          tags: [],
          conviction: null,
          contexts: [],
          notes: [],
        },
        provenance: {
          source_type: 'chat-parsed',
        },
        extraction: {
          mode: 'parsed',
          extractor: 'chat-parse@v1',
          extracted_at: now,
          quality: block.quality || 'partial',
          lossy: false,
        },
        visibility: {
          level: 'private',
          pool_eligible: false,
        },
      };

      const { error: insertError } = await sb
        .from('rec_files')
        .insert(row);

      if (insertError) {
        console.error('[chat-parse-ingest] insert error:', insertError.message, { url, curatorId });
        continue;
      }

      console.log('[chat-parse-ingest] inserted rec_files row:', id, { url, curatorId });
      recFileIds.push(id);

    } catch (err) {
      console.error('[chat-parse-ingest] unexpected error:', err.message, { curatorId });
    }
  }

  return recFileIds;
}
