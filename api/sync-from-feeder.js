const { requireAdmin } = require('./_auth');

const FEEDER_BASE = 'appd5oK1wLVPYZeia';
const FEEDER_TABLE = 'tblsMjkasibHeXwhM';
const LOCAL_BASE = 'appd1hcbJXgvVXF05';
const LOCAL_TABLE = 'tblw0a2r2buhiqLAs';

const DEPT_TO_SOURCE = {
  'Client Services': 'CS team',
  'Marketing': 'Marketing team',
  'MEX': 'MEX team',
  'Member Experience': 'MEX team',
  'Sales': 'Sales team',
};
const TEAM_FILTER = Object.keys(DEPT_TO_SOURCE);

function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

async function fetchAll(url, headers) {
  const records = [];
  let next = url;
  while (next) {
    const r = await fetch(next, { headers });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Airtable ${r.status}: ${t}`);
    }
    const data = await r.json();
    records.push(...(data.records || []));
    if (!data.offset) break;
    const u = new URL(url);
    u.searchParams.set('offset', data.offset);
    next = u.toString();
  }
  return records;
}

module.exports = async function handler(req, res) {
  // Allow Vercel cron (Bearer CRON_SECRET) OR an authenticated admin session
  const cronAuth = process.env.CRON_SECRET &&
    req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronAuth) {
    if (!(await requireAdmin(req, res))) return;
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const airHeaders = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    const deptOr = TEAM_FILTER.map(t => `{Department}="${t.replace(/"/g, '\\"')}"`).join(',');
    const feederFormula = `OR(${deptOr})`;
    const feederUrl = `https://api.airtable.com/v0/${FEEDER_BASE}/${FEEDER_TABLE}?filterByFormula=${encodeURIComponent(feederFormula)}&pageSize=100`;
    const feederRecords = await fetchAll(feederUrl, airHeaders);

    const localUrl = `https://api.airtable.com/v0/${LOCAL_BASE}/${LOCAL_TABLE}?filterByFormula=${encodeURIComponent("NOT({Source record ID}='')")}&fields%5B%5D=${encodeURIComponent('Source record ID')}&pageSize=100`;
    const localExisting = await fetchAll(localUrl, airHeaders);
    const existingIds = new Set(localExisting.map(r => r.fields['Source record ID']));

    const toCreate = feederRecords.filter(r => !existingIds.has(r.id));
    const today = new Date().toISOString().split('T')[0];

    const added = [];
    const errors = [];
    for (let i = 0; i < toCreate.length; i += 10) {
      const batch = toCreate.slice(i, i + 10).map(r => {
        const f = r.fields;
        return {
          fields: compact({
            'Idea': f['Name'],
            'Description': f['Description'],
            'Intake source': 'Manual entry',
            'Status': 'Triage',
            'Submitter status': 'Acknowledged',
            'Submitted on': today,
            'Source': DEPT_TO_SOURCE[f['Department']],
            'Internal submitter name': f['Submitted By — Name'],
            'Internal submitter email': f['Submitted By — Email'],
            'Source base': 'NSLS Automation Tracker',
            'Source record ID': r.id,
          }),
        };
      });

      const createRes = await fetch(
        `https://api.airtable.com/v0/${LOCAL_BASE}/${LOCAL_TABLE}`,
        { method: 'POST', headers: airHeaders, body: JSON.stringify({ records: batch, typecast: true }) }
      );
      if (createRes.ok) {
        const data = await createRes.json();
        added.push(...data.records.map(r => r.id));
      } else {
        errors.push(await createRes.text());
      }
    }

    res.json({
      ok: true,
      feederMatched: feederRecords.length,
      alreadyMirrored: feederRecords.length - toCreate.length,
      added: added.length,
      errors,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
