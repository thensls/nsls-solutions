const BASE = 'appd1hcbJXgvVXF05';
const TABLE = 'Ideas';

module.exports = async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${encodeURIComponent(id)}`;
  const headers = {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    if (req.method === 'GET') {
      const r = await fetch(url, { headers });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (req.method === 'PATCH') {
      const r = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: req.body }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (req.method === 'DELETE') {
      const r = await fetch(url, { method: 'DELETE', headers });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
