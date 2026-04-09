// lib/rec-files/ingest.js
// Dual-write entry point for URL captures.
// Call this alongside (AFTER) the existing recommendations insert.
// Never throws — returns { success, recFileId, error } for the caller to inspect.
import { buildRecFileRow } from './build.js';

/**
 * Ingest a URL capture into rec_files.
 *
 * @param {object} supabase - Supabase client (client-side is fine; RLS allows curator's own rows)
 * @param {object} params
 * @param {string} params.curatorId
 * @param {string} params.curatorHandle
 * @param {object} params.parsedPayload - from parse-link (Deploy 2a)
 * @param {object} params.curation - curator-provided fields from the save form
 * @returns {Promise<{ success: boolean, recFileId: string|null, error: string|null }>}
 */
export async function ingestUrlCapture(supabase, { curatorId, curatorHandle, parsedPayload, curation }) {
  try {
    if (!curatorId) {
      return { success: false, recFileId: null, error: 'curatorId is required' };
    }
    if (!parsedPayload) {
      return { success: false, recFileId: null, error: 'parsedPayload is required' };
    }

    const row = buildRecFileRow({ curatorId, curatorHandle, parsedPayload, curation });

    const { data, error } = await supabase
      .from('rec_files')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error('[rec-files] Insert failed:', error.message, { intended_id: row.id });
      return { success: false, recFileId: null, error: error.message };
    }

    console.log(`[rec-files] Inserted ${data.id}`);
    return { success: true, recFileId: data.id, error: null };
  } catch (e) {
    console.error('[rec-files] Ingestion exception:', e.message || e);
    return { success: false, recFileId: null, error: e.message || String(e) };
  }
}
