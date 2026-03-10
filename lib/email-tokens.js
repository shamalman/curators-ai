import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function generateEmailToken(profileId, action, payload = {}, expiresInDays = 30) {
  const supabase = getServiceClient();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from('email_tokens').insert({
    token,
    profile_id: profileId,
    action,
    payload,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('Failed to generate email token:', error);
    throw error;
  }
  return token;
}

export async function validateEmailToken(token, expectedAction) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('email_tokens')
    .select('*')
    .eq('token', token)
    .eq('action', expectedAction)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data;
}

export async function markTokenUsed(tokenId) {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('email_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenId);

  if (error) console.error('Failed to mark token used:', error);
}
