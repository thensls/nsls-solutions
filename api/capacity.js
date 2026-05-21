const { requireAdmin } = require('./_auth');

const BASE = 'appd1hcbJXgvVXF05';
const TABLE = 'Builders';

module.exports = async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireAdmin(req, res))) return;

  const { id, signal } = req.body;
  if (!id || !signal) return res.status(400).json({ error: 'id and signal required' });

  const allowed = ['Available', 'Booked', 'Slammed'];
  if (!allowed.includes(signal)) return res.status(400).json({ error: 'signal must be Available, Booked, or Slammed' });

  const today = new Date().toISOString().split('T')[0];

  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Capacity signal': signal,
            'Capacity last updated': today,
          },
        }),
      }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
