import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resend } from '@/lib/resend';
import { generateEmailToken } from '@/lib/email-tokens';
import { newSubscriberEmail } from '@/lib/email-templates';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    // Session check — this endpoint is only callable by the authed subscriber
    const cookieStore = cookies();
    const authedSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* no-op: route handler, response cookies unused */ },
        },
      }
    );
    const { data: { session } } = await authedSupabase.auth.getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { curatorId, subscriberId } = await request.json();
    if (!curatorId || !subscriberId) {
      return new Response(JSON.stringify({ error: 'Missing curatorId or subscriberId' }), { status: 400 });
    }

    const supabase = getServiceClient();

    // Ownership check — caller must be the subscriber initiating the subscribe action
    const { data: callerProfile, error: callerErr } = await supabase
      .from('profiles')
      .select('id, handle')
      .eq('auth_user_id', session.user.id)
      .single();
    if (callerErr || !callerProfile || callerProfile.id !== subscriberId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    // Dev/founder skip list — suppress notifications when the subscriber's handle matches
    const skipHandles = (process.env.NOTIFICATION_SKIP_HANDLES || '')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean);
    if (callerProfile.handle && skipHandles.includes(callerProfile.handle.toLowerCase())) {
      console.log('[NOTIFY_SKIPPED]', { handle: callerProfile.handle, route: 'new-subscriber' });
      return new Response(JSON.stringify({ skipped: true, reason: 'handle_in_skip_list' }), { status: 200 });
    }

    // Get curator profile
    const { data: curator, error: curatorErr } = await supabase
      .from('profiles')
      .select('id, name, handle, auth_user_id, new_subscriber_email_enabled')
      .eq('id', curatorId)
      .single();

    if (curatorErr || !curator) {
      console.error('Curator not found:', curatorErr);
      return new Response(JSON.stringify({ error: 'Curator not found' }), { status: 404 });
    }

    // Check if notifications are enabled
    if (curator.new_subscriber_email_enabled === false) {
      return new Response(JSON.stringify({ skipped: true, reason: 'notifications_disabled' }));
    }

    // Get curator email from auth
    const { data: { user }, error: authErr } = await supabase.auth.admin.getUserById(curator.auth_user_id);
    if (authErr || !user?.email) {
      console.error('Failed to get curator email:', authErr);
      return new Response(JSON.stringify({ error: 'Could not get curator email' }), { status: 500 });
    }

    // Get subscriber profile
    const { data: subscriber } = await supabase
      .from('profiles')
      .select('id, name, handle')
      .eq('id', subscriberId)
      .single();

    const subscriberName = subscriber?.name || 'Someone';
    const subscriberHandle = subscriber?.handle || null;

    // Count total subscribers
    const { count: subscriberCount } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('curator_id', curatorId)
      .is('unsubscribed_at', null);

    // Generate unsubscribe token
    const unsubToken = await generateEmailToken(curator.id, 'unsubscribe', { type: 'new_subscriber_email' });
    const unsubscribeUrl = `https://curators.ai/api/email-action?token=${unsubToken}`;

    // Build email
    const html = newSubscriberEmail({
      subscriberName,
      subscriberHandle,
      subscriberCount: subscriberCount || 0,
      unsubscribeUrl,
    });

    // Send via Resend
    const { error: sendErr } = await resend.emails.send({
      from: 'Curators.AI <notifications@curators.ai>',
      to: user.email,
      subject: `${subscriberName} subscribed to your taste`,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (sendErr) {
      console.error('Resend send error:', sendErr);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 });
    }

    // Log to notification_log
    await supabase.from('notification_log').insert({
      type: 'new_subscriber',
      recipient_id: curator.id,
      recipient_email: user.email,
      curator_id: subscriberId,
    });

    return new Response(JSON.stringify({ sent: true }));
  } catch (err) {
    console.error('New subscriber notification error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}
