const { put } = require('@vercel/blob');

const BASE = 'appd1hcbJXgvVXF05';
const TABLE = 'Ideas';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recordId, filename, contentType, data } = req.body;
  if (!recordId || !data || !filename) {
    return res.status(400).json({ error: 'Missing recordId, filename, or data' });
  }

  const recordUrl = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${encodeURIComponent(recordId)}`;
  const airtableHeaders = {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    const buffer = Buffer.from(data, 'base64');
    const blob = await put(`submissions/${recordId}/${filename}`, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });

    // Fetch existing attachments so we append rather than overwrite
    const getRes = await fetch(recordUrl, { headers: airtableHeaders });
    if (!getRes.ok) return res.status(502).json({ error: 'Failed to fetch existing record attachments' });
    const existing = await getRes.json();
    const existingAttachments = (existing.fields?.Attachments || []).map(a => ({ url: a.url }));

    const patchRes = await fetch(recordUrl, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({
          fields: { Attachments: [...existingAttachments, { url: blob.url, filename }] },
        }),
      });

    const result = await patchRes.json();
    res.status(patchRes.status).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
