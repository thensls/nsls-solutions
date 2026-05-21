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

// Kevin's "Stage" → our "Status". Anything not mapped stays 'Triage'.
const STAGE_TO_STATUS = {
  'Production': 'Shipped',
  'Org-Owned': 'Shipped',
};

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

async function airtableBatch(url, headers, method, records) {
  // Airtable max 10 per request
  const results = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const r = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!r.ok) {
      throw new Error(`Airtable ${method} ${r.status}: ${await r.text()}`);
    }
    const data = await r.json();
    results.push(...(data.records || []));
  }
  return results;
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
  const localTableUrl = `https://api.airtable.com/v0/${LOCAL_BASE}/${LOCAL_TABLE}`;

  try {
    const deptOr = TEAM_FILTER.map(t => `{Department}="${t.replace(/"/g, '\\"')}"`).join(',');
    const feederFormula = `OR(${deptOr})`;
    const feederFieldParams = ['Name', 'Description', 'Department', 'Stage', 'GitHub Repo URL', 'Submitted By — Name', 'Submitted By — Email']
      .map(f => `fields%5B%5D=${encodeURIComponent(f)}`).join('&');
    const feederUrl = `https://api.airtable.com/v0/${FEEDER_BASE}/${FEEDER_TABLE}?filterByFormula=${encodeURIComponent(feederFormula)}&${feederFieldParams}&pageSize=100`;
    const feederRecords = await fetchAll(feederUrl, airHeaders);

    const localFieldParams = ['Source record ID', 'Status', 'Repo link']
      .map(f => `fields%5B%5D=${encodeURIComponent(f)}`).join('&');
    const localUrl = `${localTableUrl}?filterByFormula=${encodeURIComponent("NOT({Source record ID}='')")}&${localFieldParams}&pageSize=100`;
    const localExisting = await fetchAll(localUrl, airHeaders);
    const existingByFeederId = new Map(
      localExisting.map(r => [r.fields['Source record ID'], r])
    );

    const today = new Date().toISOString().split('T')[0];

    // Partition into creates vs updates
    const toCreate = [];
    const toUpdate = [];
    for (const feeder of feederRecords) {
      const existing = existingByFeederId.get(feeder.id);
      const f = feeder.fields;
      const mappedStatus = STAGE_TO_STATUS[f['Stage']] || 'Triage';
      const repoUrl = f['GitHub Repo URL'] || null;

      if (!existing) {
        toCreate.push({
          fields: compact({
            'Idea': f['Name'],
            'Description': f['Description'],
            'Intake source': 'Manual entry',
            'Status': mappedStatus,
            'Submitter status': 'Acknowledged',
            'Submitted on': today,
            'Source': DEPT_TO_SOURCE[f['Department']],
            'Internal submitter name': f['Submitted By — Name'],
            'Internal submitter email': f['Submitted By — Email'],
            'Source base': 'NSLS Automation Tracker',
            'Source record ID': feeder.id,
            'Repo link': repoUrl,
          }),
        });
        continue;
      }

      // Existing mirror — only update if there's something to change.
      // Preserve local Status if user has progressed it beyond 'Triage'.
      // Preserve local Repo link if user has filled it in.
      const updateFields = {};
      const localStatus = existing.fields['Status'];
      const localRepo = existing.fields['Repo link'];
      if (localStatus === 'Triage' && mappedStatus !== 'Triage') {
        updateFields['Status'] = mappedStatus;
      }
      if (!localRepo && repoUrl) {
        updateFields['Repo link'] = repoUrl;
      }
      if (Object.keys(updateFields).length) {
        toUpdate.push({ id: existing.id, fields: updateFields });
      }
    }

    const errors = [];
    let createdIds = [];
    let updatedIds = [];

    if (toCreate.length) {
      try {
        const out = await airtableBatch(localTableUrl, airHeaders, 'POST', toCreate);
        createdIds = out.map(r => r.id);
      } catch (e) {
        errors.push(`create: ${e.message}`);
      }
    }
    if (toUpdate.length) {
      try {
        const out = await airtableBatch(localTableUrl, airHeaders, 'PATCH', toUpdate);
        updatedIds = out.map(r => r.id);
      } catch (e) {
        errors.push(`update: ${e.message}`);
      }
    }

    res.json({
      ok: true,
      feederMatched: feederRecords.length,
      alreadyMirrored: feederRecords.length - toCreate.length,
      added: createdIds.length,
      updated: updatedIds.length,
      errors,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
