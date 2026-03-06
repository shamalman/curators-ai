import { createClient } from '@supabase/supabase-js';
import { resend } from '@/lib/resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const { profileId, handle, originalMessage, elaboration, summary } = await req.json();

  const { error } = await supabase.from('feedback').insert({
    profile_id: profileId,
    handle,
    original_message: originalMessage,
    elaboration: elaboration || null,
    summary: summary || null,
  });

  if (error) {
    console.error('FEEDBACK DB ERROR:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder') {
    try {
      await resend.emails.send({
        from: 'Curators AI <noreply@curators.ai>',
        to: process.env.FEEDBACK_EMAIL,
        subject: `Feedback from @${handle}`,
        text: `Handle: @${handle}\n\nSummary: ${summary}\n\nOriginal message: ${originalMessage}\n\nElaboration: ${elaboration || 'None provided'}\n\nTimestamp: ${new Date().toISOString()}`,
      });
    } catch (emailError) {
      console.error('FEEDBACK EMAIL ERROR:', emailError);
    }
  }

  return Response.json({ success: true });
}
