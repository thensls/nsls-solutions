const BASE = 'appd1hcbJXgvVXF05';
const TABLE = 'Ideas';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    idea, description, source, solution_type, affected_teams,
    attachments, reference_links, time_saved, cost_savings,
    revenue_impact, urgency_note, submitted_by_name,
  } = req.body;

  if (!idea || !description) {
    return res.status(400).json({ error: 'Idea title and description are required' });
  }

  const today = new Date().toISOString().split('T')[0];

  const fields = {
    'Idea': idea,
    'Description': description,
    'Intake source': 'Internal form',
    'Status': 'Triage',
    'Submitter status': 'Acknowledged',
    'Submitted on': today,
    'Notify submitter on next status change?': true,
  };

  if (source) fields['Source'] = source;
  if (solution_type) fields['Solution type'] = solution_type;
  if (affected_teams?.length) fields['Affected teams'] = affected_teams;
  if (reference_links) fields['Reference links'] = reference_links;
  if (time_saved != null && time_saved !== '') fields['Time saved'] = parseFloat(time_saved);
  if (cost_savings != null && cost_savings !== '') fields['Cost savings'] = parseInt(cost_savings);
  if (revenue_impact != null && revenue_impact !== '') fields['Revenue impact'] = parseInt(revenue_impact);
  if (urgency_note) fields['Notes'] = urgency_note;

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
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
