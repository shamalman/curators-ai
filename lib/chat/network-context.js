import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Fetch subscribed + broader recs for standard mode ──
export async function getSubscribedRecs(profileId) {
  try {
    const sb = getSupabaseAdmin();

    // 1. Get subscribed curator IDs
    const { data: subs } = await sb
      .from("subscriptions")
      .select("curator_id")
      .eq("subscriber_id", profileId)
      .is("unsubscribed_at", null);

    const subscribedIds = (subs || []).map(s => s.curator_id);

    // 2. Fetch subscribed curators' profiles + recs (up to 50 most recent)
    let subscribedRecs = [];
    let subscribedProfiles = {};
    if (subscribedIds.length > 0) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, name, handle")
        .in("id", subscribedIds);
      (profiles || []).forEach(p => { subscribedProfiles[p.id] = p; });

      const { data: recs } = await sb
        .from("recommendations")
        .select("*")
        .in("profile_id", subscribedIds)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(50);
      subscribedRecs = recs || [];
    }

    // 3. Fetch broader platform recs (other curators, up to 100 most recent)
    const excludeIds = [profileId, ...subscribedIds];
    const { data: broaderRecs } = await sb
      .from("recommendations")
      .select("id, title, context, category, tags, slug, profile_id, created_at")
      .not("profile_id", "in", `(${excludeIds.join(",")})`)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(100);

    // Fetch profiles for broader rec curators (two-step, no join alias)
    const broaderProfiles = {};
    if (broaderRecs && broaderRecs.length > 0) {
      const broaderCuratorIds = [...new Set(broaderRecs.map(r => r.profile_id))];
      const { data: bProfiles } = await sb
        .from("profiles")
        .select("id, name, handle")
        .in("id", broaderCuratorIds);
      (bProfiles || []).forEach(p => { broaderProfiles[p.id] = p; });
    }

    // 4. Format subscribed curators block
    let subscribedBlock = "";
    if (subscribedIds.length === 0) {
      subscribedBlock = "\nSUBSCRIBED RECOMMENDATIONS:\nYou don't subscribe to any curators yet. When you do, I'll be able to surface their recommendations.";
    } else {
      // Group subscribed recs by curator
      const byCurator = {};
      subscribedIds.forEach(id => { byCurator[id] = []; });
      subscribedRecs.forEach(r => {
        if (byCurator[r.profile_id]) byCurator[r.profile_id].push(r);
      });

      const hasAnyRecs = subscribedRecs.length > 0;
      if (!hasAnyRecs) {
        const names = subscribedIds
          .map(id => subscribedProfiles[id]?.name || "Unknown")
          .join(", ");
        subscribedBlock = `\nSUBSCRIBED RECOMMENDATIONS:\nYou subscribe to ${names} but they haven't added any recommendations yet.`;
      } else {
        const sections = subscribedIds
          .filter(id => byCurator[id].length > 0)
          .map(id => {
            const p = subscribedProfiles[id];
            const recs = byCurator[id];
            const recLines = recs.map(r => {
              const ctx = r.context
                ? (r.context.length > 150 ? r.context.slice(0, 147) + "..." : r.context)
                : "No context";
              const tags = (r.tags || []).length > 0 ? ` [tags: ${r.tags.join(", ")}]` : "";
              const handle = p?.handle || "unknown";
              const slug = r.slug ? ` [link: /${handle}/${r.slug}]` : "";
              return `- ${r.title} (${r.category}) - "${ctx}"${tags}${slug}`;
            });
            return `@${p?.handle || "unknown"} (${p?.name || "Unknown"}) - ${recs.length} rec${recs.length !== 1 ? "s" : ""}:\n${recLines.join("\n")}`;
          });
        subscribedBlock = `\nSUBSCRIBED RECOMMENDATIONS (from curators you subscribe to):\n---\n${sections.join("\n---\n")}\n---`;
      }
    }

    // 5. Format broader network block
    let broaderBlock = "";
    if (broaderRecs && broaderRecs.length > 0) {
      const lines = broaderRecs.map(r => {
        const p = broaderProfiles[r.profile_id] || {};
        const ctx = r.context
          ? (r.context.length > 80 ? r.context.slice(0, 77) + "..." : r.context)
          : "";
        const handle = p?.handle || "unknown";
        const slug = r.slug ? ` [link: /${handle}/${r.slug}]` : "";
        return `@${p?.handle || "unknown"} (${p?.name || "Unknown"}): ${r.title} (${r.category})${ctx ? ` - "${ctx}"` : ""}${slug}`;
      });
      broaderBlock = `\n\nBROADER NETWORK (other curators on the platform):\n---\n${lines.join("\n")}\n---`;
    }

    return subscribedBlock + broaderBlock;
  } catch (err) {
    console.error("Failed to fetch subscribed recs:", err);
    return "\nSUBSCRIBED RECOMMENDATIONS:\nUnable to load subscription data right now.";
  }
}
