const { notifyNewIdea } = require('./_notify');

const BASE = 'appd1hcbJXgvVXF05';
const TABLE = 'Ideas';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name, email, org, role,
    idea, description,
    reference_links, nsls_contact, urgency,
  } = req.body;

  if (!name || !email || !org || !role || !idea || !description) {
    return res.status(400).json({ error: 'Name, email, org, role, idea title, and description are required' });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const today = new Date().toISOString().split('T')[0];

  const fields = {
    'Idea': idea,
    'Description': description,
    'Intake source': 'External form',
    'Source': 'Partner school',
    'Status': 'Triage',
    'Submitter status': 'Acknowledged',
    'Submitted on': today,
    'Notify submitter on next status change?': true,
    'External submitter name': name,
    'External submitter email': email,
    'External submitter org': org,
    'External submitter role': role,
    'Source base': 'Local',
  };

  if (reference_links) fields['Reference links'] = reference_links;
  if (nsls_contact) fields['Related NSLS contact'] = nsls_contact;
  if (urgency) fields['Notes'] = urgency;

  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    );
    const data = await r.json();
    if (r.ok && data?.id) {
      // Fire-and-forget — never let notification errors fail a successful submit
      notifyNewIdea({ recordId: data.id, fields, kind: 'external' })
        .catch(err => console.error('Notify error (external):', err.message));
    }
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
