const { put } = require('@vercel/blob');

const BASE = 'appd1hcbJXgvVXF05';
const TABLE = 'Ideas';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recordId, filename, contentType, data } = req.body;
  if (!recordId || !data || !filename) {
    return res.status(400).json({ error: 'Missing recordId, filename, or data' });
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    const blob = await put(`submissions/${recordId}/${filename}`, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });

    const patchRes = await fetch(
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: { Attachments: [{ url: blob.url, filename }] },
        }),
      }
    );

    const result = await patchRes.json();
    res.status(patchRes.status).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
