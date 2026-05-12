const BASE = 'appd1hcbJXgvVXF05';
const TABLE = 'Builders';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const params = new URLSearchParams();
  params.append('fields[]', 'Name');
  params.append('fields[]', 'Email');
  params.append('fields[]', 'Builder level');
  params.append('fields[]', 'Department');
  params.append('fields[]', 'Capacity signal');
  params.append('fields[]', 'Capacity last updated');
  params.set('sort[0][field]', 'Name');
  params.set('sort[0][direction]', 'asc');

  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}?${params}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
