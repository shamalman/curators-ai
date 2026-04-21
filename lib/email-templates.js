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

export function agentCompletionEmail({ curatorName, sourceType }) {
  const sourceName = sourceType === 'spotify' ? 'Spotify'
    : sourceType === 'apple_music' ? 'Apple Music'
    : sourceType === 'google_maps' ? 'Google Maps'
    : sourceType || 'your source';

  const content = `
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td>
<p style="font-size:18px;font-weight:600;color:${INK};line-height:1.4;margin:0 0 16px;">
Your AI finished studying your ${sourceName}.
</p>
<p style="font-size:14px;color:${INK2};line-height:1.6;margin:0 0 24px;">
I went through everything and found some interesting patterns in your taste. Come see what I found.
</p>
<a href="https://curators.ai/myai" style="display:inline-block;padding:12px 24px;background:${ACCENT};color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
See your taste read
</a>
</td></tr>
<tr><td style="padding-top:32px;border-top:1px solid ${BORDER};margin-top:32px;">
<p style="font-size:12px;color:${INK2};line-height:1.6;margin:0;">
You're receiving this because you're a curator on Curators.AI.
</p>
<p style="font-size:11px;color:${BORDER};margin:8px 0 0;">
curators.ai
</p>
</td></tr>
</table>`;

  return emailWrapper(content);
}

export function newRecEmail({ curatorDisplayName, curatorHandle, recTitle, category, why, recUrl, unsubUrl }) {
  const SERIF = "Newsreader, Georgia, 'Times New Roman', serif";
  const SANS = "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  const PAGE_BG = '#F5F2EC';
  const CARD_BG = '#FAF8F3';
  const INK = '#2C2C2A';
  const INK2 = '#6B6B66';
  const INK3 = '#888780';
  const DIVIDER = '#D3D1C7';
  const ACCENT = '#D4956B';
  const CREAM = '#FAF8F3';

  const escapeHtml = (s) => s == null ? '' : String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const displayNameValid = curatorDisplayName && String(curatorDisplayName).trim().length > 0;
  const displayForName = displayNameValid ? curatorDisplayName : `@${curatorHandle}`;

  // Avatar initials: displayName → first-letter + last-word first-letter (or single letter);
  // no displayName → first letter of handle. Lowercase.
  let initials;
  if (displayNameValid) {
    const words = String(curatorDisplayName).trim().split(/\s+/);
    initials = words.length === 1
      ? words[0][0].toLowerCase()
      : (words[0][0] + words[words.length - 1][0]).toLowerCase();
  } else {
    initials = curatorHandle[0].toLowerCase();
  }

  // Why: 600-char word-boundary cap
  const whyRaw = why || '';
  let whyCapped = whyRaw;
  if (whyCapped.length > 600) {
    const cut = whyCapped.slice(0, 600);
    const lastSpace = cut.lastIndexOf(' ');
    whyCapped = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
  }

  // Preheader: normalize whitespace → collapse runs → trim → 90-char word-boundary cap
  let preheader = whyRaw.replace(/[\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (preheader.length > 90) {
    const cut = preheader.slice(0, 90);
    const lastSpace = cut.lastIndexOf(' ');
    preheader = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…';
  }

  const subject = `${displayForName} recommends ${recTitle}`;

  const categoryBlock = category ? `
              <tr><td style="font-family:${SANS};font-size:11px;color:${INK3};letter-spacing:0.12em;text-transform:uppercase;font-weight:500;">${escapeHtml(category)}</td></tr>
              <tr><td style="height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>` : '';

  const whyHtml = escapeHtml(whyCapped).replace(/\n/g, '<br/>');
  const whyBlock = whyCapped ? `
        <!-- Why quote with 2px accent bar -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td width="2" bgcolor="${ACCENT}" style="width:2px;min-width:2px;background-color:${ACCENT};line-height:1px;font-size:1px;">&nbsp;</td>
            <td width="14" style="width:14px;font-size:0;line-height:0;">&nbsp;</td>
            <td style="font-family:${SERIF};font-style:italic;font-size:16px;line-height:1.55;color:${INK};">${whyHtml}</td>
          </tr>
        </table>

        <!-- 24px spacer -->
        <div style="line-height:24px;font-size:0;">&nbsp;</div>` : '';

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<meta name="supported-color-schemes" content="light"/>
<title>${escapeHtml(subject)}</title>
<style>
  @media only screen and (max-width: 480px) {
    .card-pad { padding: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE_BG};">${escapeHtml(preheader)}</div>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:${PAGE_BG};">
  <tr><td align="center" style="padding:24px 16px;">
    <!--[if mso]>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" align="center"><tr><td>
    <![endif]-->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">
      <tr><td class="card-pad" style="background:${CARD_BG};border-radius:12px;padding:32px;">

        <!-- Wordmark -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="font-family:${SERIF};font-size:13px;color:${INK2};letter-spacing:0.08em;text-transform:uppercase;">curators.ai</td></tr>
        </table>

        <!-- 24px spacer -->
        <div style="line-height:24px;font-size:0;">&nbsp;</div>

        <!-- Curator row: avatar + greeting -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td width="32" height="32" align="center" valign="middle" style="width:32px;height:32px;background-color:${INK};color:${CREAM};border-radius:50%;font-family:${SANS};font-size:13px;font-weight:500;line-height:32px;text-align:center;mso-line-height-rule:exactly;">${escapeHtml(initials)}</td>
            <td width="12" style="width:12px;font-size:0;line-height:0;">&nbsp;</td>
            <td valign="middle" style="font-family:${SANS};font-size:15px;line-height:1.4;color:${INK2};">
              <span style="color:${INK};font-weight:500;">${escapeHtml(displayForName)}</span> sent you a recommendation
            </td>
          </tr>
        </table>

        <!-- 20px spacer -->
        <div style="line-height:20px;font-size:0;">&nbsp;</div>

        <!-- Category / title -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">${categoryBlock}
              <tr><td style="font-family:${SERIF};font-size:26px;font-weight:500;color:${INK};line-height:1.25;"><a href="${escapeHtml(recUrl)}" style="font-family:${SERIF};font-size:26px;font-weight:500;color:${INK};line-height:1.25;text-decoration:none;">${escapeHtml(recTitle)}</a></td></tr>
        </table>

        <!-- 20px spacer -->
        <div style="line-height:20px;font-size:0;">&nbsp;</div>
${whyBlock}
        <!-- Open recommendation link -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
          <tr><td>
            <a href="${escapeHtml(recUrl)}" style="font-family:${SANS};font-size:14px;font-weight:500;color:${INK};text-decoration:none;border-bottom:1px solid ${INK};padding-bottom:2px;">Open recommendation →</a>
          </td></tr>
        </table>

        <!-- 32px spacer -->
        <div style="line-height:32px;font-size:0;">&nbsp;</div>

        <!-- Divider -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${DIVIDER};">&nbsp;</td></tr>
        </table>

        <!-- 20px spacer -->
        <div style="line-height:20px;font-size:0;">&nbsp;</div>

        <!-- Footer -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="font-family:${SANS};font-size:12px;color:${INK3};line-height:1.6;">
            You get these because you subscribe to @${escapeHtml(curatorHandle)} on Curators.AI.
          </td></tr>
          <tr><td style="font-family:${SANS};font-size:12px;color:${INK3};line-height:1.6;">
            <a href="${escapeHtml(unsubUrl)}" style="color:${INK3};text-decoration:underline;">Unsubscribe from @${escapeHtml(curatorHandle)}</a> · <a href="https://curators.ai/settings" style="color:${INK3};text-decoration:underline;">Notification settings</a>
          </td></tr>
        </table>

      </td></tr>
    </table>
    <!--[if mso]>
    </td></tr></table>
    <![endif]-->
  </td></tr>
</table>
</body>
</html>`;

  // Plain-text version
  const textLines = [
    `${displayForName} sent you a recommendation on Curators.AI`,
    '',
  ];
  if (category) textLines.push(category.toUpperCase());
  textLines.push(recTitle);
  textLines.push('');
  if (whyCapped) {
    textLines.push(`"${whyCapped}"`);
    textLines.push('');
  }
  textLines.push(`Open recommendation: ${recUrl}`);
  textLines.push('');
  textLines.push('---');
  textLines.push(`You get these because you subscribe to @${curatorHandle} on Curators.AI.`);
  textLines.push(`Unsubscribe: ${unsubUrl}`);
  textLines.push(`Notification settings: https://curators.ai/settings`);
  const text = textLines.join('\n');

  return { subject, html, text };
}
