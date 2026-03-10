const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const BG = '#131210';
const CARD = '#1A1714';
const BORDER = '#302B25';
const INK = '#E8E2D6';
const INK2 = '#A09888';
const ACCENT = '#D4956B';

const CAT_COLORS = {
  watch: '#8E80B5', listen: '#4B92CC', read: '#CC6658', visit: '#5E9E82',
  get: '#C27850', wear: '#CC7090', play: '#D4B340', other: '#B08860',
};

function emailWrapper(content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding-bottom:32px;">
<span style="font-size:16px;font-weight:700;color:${ACCENT};letter-spacing:0.02em;">curators.ai</span>
</td></tr>
<tr><td>${content}</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

function emailFooter(unsubUrl, settingsUrl, footerNote) {
  return `
<tr><td style="padding-top:32px;border-top:1px solid ${BORDER};">
<p style="font-size:12px;color:${INK2};line-height:1.6;margin:0 0 8px;">
${footerNote}
</p>
<p style="font-size:12px;margin:0 0 12px;">
<a href="${unsubUrl}" style="color:${INK2};text-decoration:underline;">Unsubscribe</a>
<span style="color:${BORDER};"> &nbsp;|&nbsp; </span>
<a href="https://curators.ai/settings" style="color:${INK2};text-decoration:underline;">Manage notification settings</a>
</p>
<p style="font-size:11px;color:${BORDER};margin:0;">
curators.ai
</p>
</td></tr>`;
}

export function newSubscriberEmail({ subscriberName, subscriberHandle, subscriberCount, unsubscribeUrl }) {
  const hasProfile = !!subscriberHandle;
  const profileLink = hasProfile
    ? `<p style="font-size:14px;color:${INK2};line-height:1.6;margin:16px 0 0;">
They're a curator too &mdash; check out their taste.<br/>
<a href="https://curators.ai/${subscriberHandle}" style="color:${ACCENT};text-decoration:none;">curators.ai/${subscriberHandle}</a>
</p>`
    : '';

  const content = `
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="font-size:18px;font-weight:600;color:${INK};line-height:1.4;margin:0 0 4px;">
${subscriberName} just subscribed to you.
</p>
${profileLink}
<p style="font-size:14px;color:${INK2};margin:24px 0 0;">
You now have ${subscriberCount} subscriber${subscriberCount === 1 ? '' : 's'}.
</p>
</td></tr>
${emailFooter(
  unsubscribeUrl,
  'https://curators.ai/settings',
  "You're receiving this because you're a curator on Curators.AI."
)}
</table>`;

  return emailWrapper(content);
}

export function weeklyDigestEmail({ recs, subscribedCount, unsubscribeUrl }) {
  const recRows = recs.map(rec => {
    const catColor = CAT_COLORS[rec.category] || CAT_COLORS.other;
    const contentTag = (rec.tags && rec.tags[0]) || '';
    const contextSnippet = rec.context
      ? (rec.context.length > 120 ? rec.context.slice(0, 120) + '...' : rec.context)
      : '';
    const recUrl = `https://curators.ai/${rec.curatorHandle}/${rec.slug}`;
    const saveUrl = rec.saveUrl || '#';

    return `
<tr><td style="padding:16px 0;border-bottom:1px solid ${BORDER};">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td>
<span style="font-size:13px;font-weight:600;color:${INK};">${rec.curatorName}</span>
<span style="color:${BORDER};">&nbsp;&middot;&nbsp;</span>
<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:${catColor};">${rec.category}</span>
${contentTag ? `<span style="color:${BORDER};">&nbsp;&middot;&nbsp;</span><span style="font-size:11px;color:${INK2};">${contentTag}</span>` : ''}
</td></tr>
<tr><td style="padding-top:8px;">
<a href="${recUrl}" style="font-size:15px;font-weight:600;color:${ACCENT};text-decoration:none;line-height:1.4;">${rec.title}</a>
</td></tr>
${contextSnippet ? `<tr><td style="padding-top:4px;">
<p style="font-size:13px;color:${INK2};line-height:1.5;margin:0;font-style:italic;">"${contextSnippet}"</p>
</td></tr>` : ''}
<tr><td style="padding-top:8px;">
<a href="${saveUrl}" style="font-size:12px;color:${ACCENT};text-decoration:none;">Save</a>
</td></tr>
</table>
</td></tr>`;
  }).join('');

  const content = `
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="font-size:18px;font-weight:600;color:${INK};line-height:1.4;margin:0 0 4px;">
${recs.length} new recommendation${recs.length === 1 ? '' : 's'} from curators you subscribe to this week.
</p>
</td></tr>
${recRows}
${emailFooter(
  unsubscribeUrl,
  'https://curators.ai/settings',
  `You're receiving this because you subscribe to ${subscribedCount} curator${subscribedCount === 1 ? '' : 's'} on Curators.AI.`
)}
</table>`;

  return emailWrapper(content);
}
