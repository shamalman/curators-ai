import { createClient } from '@supabase/supabase-js';
import { resend } from '@/lib/resend';
import { generateEmailToken } from '@/lib/email-tokens';
import { weeklyDigestEmail } from '@/lib/email-templates';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// TEST ENDPOINT — no auth check. Delete before launch.
export async function GET() {
  const supabase = getServiceClient();
  const results = { sent: 0, skipped: 0, errors: 0 };

  try {
    // TEST: only send to @shamal
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, name, handle, auth_user_id')
      .eq('handle', 'shamal')
      .limit(1);

    if (profErr) {
      console.error('Failed to fetch profiles:', profErr);
      return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), { status: 500 });
    }

    for (const profile of (profiles || [])) {
      try {
        // Reset last_notified_at so we always pick up recs
        await supabase
          .from('subscriptions')
          .update({ last_notified_at: null })
          .eq('subscriber_id', profile.id)
          .is('unsubscribed_at', null);

        // Get active subscriptions
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('id, curator_id, last_notified_at')
          .eq('subscriber_id', profile.id)
          .is('unsubscribed_at', null);

        if (!subs || subs.length === 0) {
          results.skipped++;
          continue;
        }

        const curatorIds = subs.map(s => s.curator_id);

        // Determine since when to fetch recs
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const sinceDate = subs.reduce((earliest, s) => {
          if (!s.last_notified_at) return earliest;
          return s.last_notified_at < earliest ? s.last_notified_at : earliest;
        }, sevenDaysAgo);

        // Get new recs from subscribed curators
        const { data: recs } = await supabase
          .from('recommendations')
          .select('id, title, context, category, tags, slug, profile_id, created_at')
          .in('profile_id', curatorIds)
          .eq('status', 'approved')
          .eq('visibility', 'public')
          .gt('created_at', sinceDate)
          .order('created_at', { ascending: false });

        if (!recs || recs.length === 0) {
          results.skipped++;
          continue;
        }

        // Get curator profiles for the recs
        const recCuratorIds = [...new Set(recs.map(r => r.profile_id))];
        const { data: curatorProfiles } = await supabase
          .from('profiles')
          .select('id, name, handle')
          .in('id', recCuratorIds);

        const curatorMap = {};
        (curatorProfiles || []).forEach(p => { curatorMap[p.id] = p; });

        // Get curator email
        const { data: { user } } = await supabase.auth.admin.getUserById(profile.auth_user_id);
        if (!user?.email) {
          console.error('No email for profile:', profile.id);
          results.errors++;
          continue;
        }

        // Generate unsubscribe token
        const unsubToken = await generateEmailToken(profile.id, 'unsubscribe', { type: 'weekly_digest' });
        const unsubscribeUrl = `https://curators.ai/api/email-action?token=${unsubToken}`;

        // Generate save tokens for each rec
        const recsWithUrls = await Promise.all(recs.map(async (rec) => {
          const saveToken = await generateEmailToken(profile.id, 'save_rec', { rec_id: rec.id });
          const curator = curatorMap[rec.profile_id];
          return {
            title: rec.title,
            context: rec.context,
            category: rec.category,
            tags: rec.tags,
            slug: rec.slug,
            curatorName: curator?.name || 'Unknown',
            curatorHandle: curator?.handle || '',
            saveUrl: `https://curators.ai/api/email-action?token=${saveToken}`,
          };
        }));

        // Build and send email
        const html = weeklyDigestEmail({
          recs: recsWithUrls,
          subscribedCount: subs.length,
          unsubscribeUrl,
        });

        const { error: sendErr } = await resend.emails.send({
          from: 'Curators.AI <notifications@curators.ai>',
          to: user.email,
          subject: `Your week in taste — ${recs.length} new rec${recs.length === 1 ? '' : 's'}`,
          html,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });

        if (sendErr) {
          console.error('Failed to send digest to:', user.email, sendErr);
          results.errors++;
          continue;
        }

        // Log to notification_log
        await supabase.from('notification_log').insert({
          type: 'new_rec_digest',
          recipient_id: profile.id,
          recipient_email: user.email,
          rec_ids: recs.map(r => r.id),
        });

        // Update last_notified_at on subscriptions
        const now = new Date().toISOString();
        await supabase
          .from('subscriptions')
          .update({ last_notified_at: now })
          .eq('subscriber_id', profile.id)
          .in('curator_id', curatorIds)
          .is('unsubscribed_at', null);

        results.sent++;
      } catch (err) {
        console.error('Digest error for profile:', profile.id, err);
        results.errors++;
      }
    }

    return new Response(JSON.stringify(results));
  } catch (err) {
    console.error('Weekly digest cron error:', err);
    return new Response(JSON.stringify({ error: 'Cron failed' }), { status: 500 });
  }
}
