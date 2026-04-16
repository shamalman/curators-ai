// Per-lambda in-memory cache. 10-min TTL. Keyed by curatorId.
// Vercel warm instances will reuse; cold starts recompute.

const cache = new Map();
const TTL_MS = 10 * 60 * 1000;

export async function getCuratorStats(supabase, curatorId) {
  const now = Date.now();
  const cached = cache.get(curatorId);
  if (cached && cached.expiresAt > now) {
    return { ...cached.data, cache_hit: true };
  }

  const stats = await computeStats(supabase, curatorId);
  cache.set(curatorId, { data: stats, expiresAt: now + TTL_MS });
  return { ...stats, cache_hit: false };
}

async function computeStats(supabase, curatorId) {
  const ONE_WEEK_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const TWO_WEEKS_AGO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: myRecs, error: recsErr } = await supabase
    .from('recommendations')
    .select('id, title, created_at')
    .eq('profile_id', curatorId);
  if (recsErr) throw new Error(`[CURATOR_STATS] fetch recs failed: ${recsErr.message}`);

  const myRecIds = (myRecs || []).map(r => r.id);
  const totalRecs = myRecs?.length || 0;
  const lastRecPostedAt = myRecs?.length
    ? myRecs.map(r => r.created_at).filter(Boolean).sort().slice(-1)[0] || null
    : null;

  let saves = [];
  if (myRecIds.length > 0) {
    const { data: saveRows, error: savesErr } = await supabase
      .from('saved_recs')
      .select('id, user_id, recommendation_id, saved_at')
      .in('recommendation_id', myRecIds);
    if (savesErr) throw new Error(`[CURATOR_STATS] fetch saves failed: ${savesErr.message}`);
    saves = saveRows || [];
  }

  const totalSaves = saves.length;
  const uniqueSavers = new Set(saves.map(s => s.user_id)).size;

  const savesByRec = new Map();
  for (const s of saves) {
    savesByRec.set(s.recommendation_id, (savesByRec.get(s.recommendation_id) || 0) + 1);
  }
  const recTitles = new Map((myRecs || []).map(r => [r.id, r.title]));
  const topAllTime = [...savesByRec.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([recId, count]) => ({ title: recTitles.get(recId) || '(untitled)', saves: count }));

  const recentSaves = saves.filter(s => s.saved_at && s.saved_at >= THIRTY_DAYS_AGO);
  const recentSavesByRec = new Map();
  for (const s of recentSaves) {
    recentSavesByRec.set(s.recommendation_id, (recentSavesByRec.get(s.recommendation_id) || 0) + 1);
  }
  const topThisMonth = [...recentSavesByRec.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([recId, count]) => ({ title: recTitles.get(recId) || '(untitled)', saves: count }));

  const recsWithSaves = new Set(saves.map(s => s.recommendation_id));
  const zeroSaveRecs = myRecIds.filter(id => !recsWithSaves.has(id)).length;

  const { data: activeSubs, error: subsErr } = await supabase
    .from('subscriptions')
    .select('id, subscribed_at')
    .eq('curator_id', curatorId)
    .is('unsubscribed_at', null);
  if (subsErr) throw new Error(`[CURATOR_STATS] fetch subs failed: ${subsErr.message}`);

  const activeSubCount = activeSubs?.length || 0;
  const newSubsThisWeek = (activeSubs || []).filter(s => s.subscribed_at && s.subscribed_at >= ONE_WEEK_AGO).length;
  const newSubsLastWeek = (activeSubs || []).filter(
    s => s.subscribed_at && s.subscribed_at >= TWO_WEEKS_AGO && s.subscribed_at < ONE_WEEK_AGO
  ).length;
  const subGrowthVsLastWeek = newSubsThisWeek - newSubsLastWeek;

  const { count: newCuratorsThisWeek, error: profsErr } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', ONE_WEEK_AGO);
  if (profsErr) throw new Error(`[CURATOR_STATS] fetch new curators failed: ${profsErr.message}`);

  return {
    reach: {
      total_saves: totalSaves,
      unique_savers: uniqueSavers,
      active_subscribers: activeSubCount,
    },
    top_recs: {
      all_time: topAllTime,
      this_month: topThisMonth,
      note_if_tied: totalSaves > 0 && topAllTime.length > 0 && topAllTime.every(r => r.saves === topAllTime[0].saves)
        ? 'All top recs currently tied, ranking not meaningful yet'
        : null,
    },
    cadence: {
      total_recs_posted: totalRecs,
      last_rec_posted_at: lastRecPostedAt,
      zero_save_recs_count: zeroSaveRecs,
    },
    growth: {
      new_subscribers_this_week: newSubsThisWeek,
      new_subscribers_last_week: newSubsLastWeek,
      subscriber_growth_vs_last_week: subGrowthVsLastWeek,
      new_curators_in_network_this_week: newCuratorsThisWeek || 0,
    },
    computed_at: new Date().toISOString(),
  };
}
