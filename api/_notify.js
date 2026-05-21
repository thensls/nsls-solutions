function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function notifyNewIdea({ recordId, fields, kind }) {
  if (!process.env.RESEND_API_KEY) return; // not configured, skip silently

  const to = (process.env.NOTIFY_EMAIL || 'chigbee@nsls.org')
    .split(',').map(s => s.trim()).filter(Boolean);
  const from = process.env.NOTIFY_FROM || 'NSLS Solutions <onboarding@resend.dev>';
  const host = process.env.PUBLIC_BASE_URL || 'https://nsls-solutions.vercel.app';

  const idea = fields['Idea'] || '(no title)';
  const desc = fields['Description'] || '';
  const source = fields['Intake source'] || '';
  const submitter = kind === 'external'
    ? `${fields['External submitter name'] || '?'} (${fields['External submitter email'] || '?'}) — ${fields['External submitter org'] || '?'}`
    : (fields['Internal submitter name']
        ? `${fields['Internal submitter name']}${fields['Internal submitter email'] ? ` (${fields['Internal submitter email']})` : ''}`
        : 'Unknown');

  const meta = [
    fields['Source'] && `Team: ${fields['Source']}`,
    fields['Solution type'] && `Type: ${fields['Solution type']}`,
    fields['Affected teams']?.length && `Affects: ${fields['Affected teams'].join(', ')}`,
    fields['Notes'] && `Notes: ${fields['Notes']}`,
  ].filter(Boolean).join(' · ');

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;max-width:600px;color:#222">
      <p style="color:#888;margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">${escHtml(source)}</p>
      <h2 style="margin:0 0 6px;font-size:20px">${escHtml(idea)}</h2>
      <p style="color:#666;margin:0 0 16px;font-size:13px">From: ${escHtml(submitter)}</p>
      <div style="white-space:pre-wrap;border-left:3px solid #ddd;padding:4px 0 4px 12px;margin:0 0 16px">${escHtml(desc)}</div>
      ${meta ? `<p style="color:#666;font-size:13px;margin:0 0 16px">${escHtml(meta)}</p>` : ''}
      ${recordId ? `<p><a href="${host}/triage.html?id=${encodeURIComponent(recordId)}" style="display:inline-block;padding:8px 14px;background:#0a2540;color:#fff;border-radius:6px;text-decoration:none;font-size:14px">Open in triage →</a></p>` : ''}
    </div>
  `;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `[NSLS Solutions] ${idea}`,
        html,
      }),
    });
    if (!r.ok) console.error('Resend notify failed:', r.status, await r.text());
  } catch (e) {
    console.error('Resend notify error:', e.message);
  }
}

module.exports = { notifyNewIdea };
