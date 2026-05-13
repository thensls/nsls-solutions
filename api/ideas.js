const BASE = 'appd1hcbJXgvVXF05';
const TABLE = 'Ideas';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { status, source, limit = '200', offset } = req.query;

  function escAirtable(s) {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  const filters = [];
  if (status) filters.push(`{Status} = "${escAirtable(status)}"`);
  if (source) filters.push(`{Intake source} = "${escAirtable(source)}"`);

  const params = new URLSearchParams();
  if (filters.length === 1) params.set('filterByFormula', filters[0]);
  if (filters.length > 1) params.set('filterByFormula', `AND(${filters.join(',')})`);
  params.set('sort[0][field]', 'Submitted on');
  params.set('sort[0][direction]', 'asc');
  params.set('maxRecords', limit);
  if (offset) params.set('offset', offset);

  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}?${params}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    );
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
