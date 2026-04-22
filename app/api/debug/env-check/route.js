export const dynamic = 'force-dynamic';

export async function GET() {
  const raw = process.env.DEBUG_CHAT_PROMPT;
  const body = {
    DEBUG_CHAT_PROMPT_raw: raw,
    DEBUG_CHAT_PROMPT_type: typeof raw,
    DEBUG_CHAT_PROMPT_length: raw == null ? null : String(raw).length,
    DEBUG_CHAT_PROMPT_equals_1: raw === '1',
    DEBUG_CHAT_PROMPT_charcodes: raw == null ? null : String(raw).split('').map(c => c.charCodeAt(0)),
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    deployment_url: process.env.VERCEL_URL || null,
    timestamp: new Date().toISOString(),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
