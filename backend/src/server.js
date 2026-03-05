import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 8787;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const TRIAGE_FILE = path.join(DATA_DIR, 'triage.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');
const SITES_FILE = path.join(DATA_DIR, 'sites.json');
const EVENTS_FILE = path.join(DATA_DIR, 'workflow-events.json');

app.use(cors({ origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

function ensure(file) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
}
function read(file) {
  ensure(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function id() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
function now() {
  return new Date().toISOString();
}
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'admin key not configured' });
  if (req.header('x-admin-key') !== ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}
function appendEvent(type, payload = {}) {
  const all = read(EVENTS_FILE);
  all.push({ id: id(), createdAt: now(), type, payload });
  write(EVENTS_FILE, all);
}

function normalizeSiteName(value = '') {
  return value.toString().trim().toLowerCase();
}

function getOrCreateSite(siteName) {
  const name = (siteName || '').trim();
  const normalized = normalizeSiteName(name);
  if (!name) return null;

  const all = read(SITES_FILE);
  let site = all.find((x) => normalizeSiteName(x.siteName) === normalized);
  if (!site) {
    site = {
      id: id(),
      siteName: name,
      createdAt: now(),
      monitoringPoints: [],
    };
    all.push(site);
    write(SITES_FILE, all);
    appendEvent('site.created', { siteId: site.id, siteName: site.siteName });
  }
  return site;
}

function upsertMonitoringPoint(siteName, pointName, type = 'general') {
  const name = (pointName || '').trim();
  if (!name) return null;

  const all = read(SITES_FILE);
  const siteIdx = all.findIndex((x) => normalizeSiteName(x.siteName) === normalizeSiteName(siteName));
  if (siteIdx < 0) return null;

  const existing = all[siteIdx].monitoringPoints || [];
  const pointIdx = existing.findIndex((p) => (p.name || '').trim().toLowerCase() === name.toLowerCase());
  if (pointIdx >= 0) return existing[pointIdx];

  const point = { id: id(), name, type, createdAt: now() };
  existing.push(point);
  all[siteIdx].monitoringPoints = existing;
  all[siteIdx].updatedAt = now();
  write(SITES_FILE, all);
  appendEvent('monitoring-point.created', { siteName: all[siteIdx].siteName, pointName: name, type });
  return point;
}

function shouldEscalate(findingType = '', severity = '') {
  const f = findingType.toLowerCase();
  const s = severity.toLowerCase();
  if (s === 'high' || s === 'critical') return true;
  return [
    'droppings',
    'gnaw',
    'bait consumption',
    'bait take',
    'trap activation',
    'multiple insect sightings',
    'smear marks',
  ].some((x) => f.includes(x));
}

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'pest-intel-backend', time: now() });
});

app.post('/api/leads', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.email || !body.business) {
    return res.status(400).json({ error: 'name, email, business are required' });
  }

  const all = read(LEADS_FILE);
  const row = {
    id: id(),
    createdAt: now(),
    status: 'new',
    source: body.source || 'website',
    ...body,
  };
  all.push(row);
  write(LEADS_FILE, all);
  appendEvent('lead.created', { leadId: row.id, source: row.source });
  res.status(201).json({ ok: true, id: row.id });
});

app.get('/api/leads', requireAdmin, (_, res) => {
  const all = read(LEADS_FILE);
  res.json({ count: all.length, items: all.slice(-500).reverse() });
});

app.post('/api/triage', (req, res) => {
  const body = req.body || {};
  if (!body.siteName || !body.issue) {
    return res.status(400).json({ error: 'siteName and issue required' });
  }

  const all = read(TRIAGE_FILE);
  const row = {
    id: id(),
    createdAt: now(),
    status: 'new',
    priority: body.priority || 'normal',
    source: body.source || 'manual',
    ...body,
  };
  all.push(row);
  write(TRIAGE_FILE, all);
  appendEvent('triage.created', { triageId: row.id, priority: row.priority, source: row.source });
  res.status(201).json({ ok: true, id: row.id });
});

app.get('/api/triage', requireAdmin, (_, res) => {
  const all = read(TRIAGE_FILE);
  res.json({ count: all.length, items: all.slice(-500).reverse() });
});

app.patch('/api/triage/:id', requireAdmin, (req, res) => {
  const all = read(TRIAGE_FILE);
  const idx = all.findIndex((x) => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });

  all[idx] = {
    ...all[idx],
    ...req.body,
    updatedAt: now(),
  };
  write(TRIAGE_FILE, all);
  appendEvent('triage.updated', { triageId: all[idx].id, status: all[idx].status, priority: all[idx].priority });
  res.json({ ok: true, item: all[idx] });
});

// Site setup + reusable monitoring points
app.post('/api/sites/setup', (req, res) => {
  const body = req.body || {};
  if (!body.siteName) return res.status(400).json({ error: 'siteName is required' });

  const site = getOrCreateSite(body.siteName);
  const points = Array.isArray(body.monitoringPoints) ? body.monitoringPoints : [];

  let created = 0;
  points.forEach((p) => {
    if (!p) return;
    const pointName = typeof p === 'string' ? p : p.name;
    const pointType = typeof p === 'string' ? 'general' : (p.type || 'general');
    const point = upsertMonitoringPoint(site.siteName, pointName, pointType);
    if (point) created += 1;
  });

  const refreshed = read(SITES_FILE).find((x) => normalizeSiteName(x.siteName) === normalizeSiteName(site.siteName));
  appendEvent('site.setup_completed', {
    siteName: site.siteName,
    pointsTotal: (refreshed?.monitoringPoints || []).length,
  });

  res.status(201).json({
    ok: true,
    siteName: site.siteName,
    pointsTotal: (refreshed?.monitoringPoints || []).length,
    pointsAdded: created,
    monitoringPoints: refreshed?.monitoringPoints || [],
  });
});

app.get('/api/sites/:siteName/monitoring-points', (req, res) => {
  const siteName = decodeURIComponent(req.params.siteName || '');
  const all = read(SITES_FILE);
  const site = all.find((x) => normalizeSiteName(x.siteName) === normalizeSiteName(siteName));
  if (!site) return res.status(404).json({ error: 'site not found' });
  res.json({ siteName: site.siteName, monitoringPoints: site.monitoringPoints || [] });
});

app.get('/api/sites', requireAdmin, (_, res) => {
  const all = read(SITES_FILE);
  res.json({ count: all.length, items: all.slice(-300).reverse() });
});

// Client activity logging (foundation for app workflow)
app.post('/api/activity', (req, res) => {
  const body = req.body || {};
  if (!body.siteName || !body.location || !body.findingType) {
    return res.status(400).json({ error: 'siteName, location, findingType are required' });
  }

  const site = getOrCreateSite(body.siteName);
  const monitoringPointName = (body.monitoringPointName || body.monitoringPoint || '').toString().trim();
  let monitoringPoint = null;
  if (monitoringPointName) {
    monitoringPoint = upsertMonitoringPoint(site.siteName, monitoringPointName, body.monitoringPointType || 'general');
  }

  const activity = read(ACTIVITY_FILE);
  const row = {
    id: id(),
    createdAt: now(),
    severity: body.severity || 'normal',
    status: 'logged',
    source: body.source || 'client-app',
    ...body,
    siteId: site?.id || null,
    monitoringPointId: monitoringPoint?.id || null,
    monitoringPointName: monitoringPoint?.name || monitoringPointName || null,
  };
  activity.push(row);
  write(ACTIVITY_FILE, activity);
  appendEvent('activity.logged', { activityId: row.id, siteName: row.siteName, findingType: row.findingType });

  let triageId = null;
  if (shouldEscalate(row.findingType, row.severity)) {
    const triage = read(TRIAGE_FILE);
    const triageRow = {
      id: id(),
      createdAt: now(),
      status: 'new',
      priority: row.severity === 'critical' ? 'urgent' : row.severity,
      source: 'auto-from-activity',
      siteName: row.siteName,
      issue: `${row.findingType} at ${row.location}`,
      activityId: row.id,
      notes: row.notes || '',
    };
    triage.push(triageRow);
    write(TRIAGE_FILE, triage);
    triageId = triageRow.id;
    appendEvent('triage.auto_created', { activityId: row.id, triageId });
  }

  res.status(201).json({ ok: true, id: row.id, triageCreated: Boolean(triageId), triageId });
});

app.get('/api/activity', requireAdmin, (req, res) => {
  const all = read(ACTIVITY_FILE);
  const site = (req.query.siteName || '').toString().toLowerCase();
  const items = site ? all.filter((x) => (x.siteName || '').toLowerCase().includes(site)) : all;
  res.json({ count: items.length, items: items.slice(-1000).reverse() });
});

app.get('/api/workflow-events', requireAdmin, (_, res) => {
  const all = read(EVENTS_FILE);
  res.json({ count: all.length, items: all.slice(-1000).reverse() });
});

app.get('/api/dashboard/summary', requireAdmin, (_, res) => {
  const leads = read(LEADS_FILE);
  const triage = read(TRIAGE_FILE);
  const activity = read(ACTIVITY_FILE);
  const sites = read(SITES_FILE);
  const openTriage = triage.filter((x) => !['resolved', 'closed'].includes((x.status || '').toLowerCase()));
  res.json({
    leadsTotal: leads.length,
    triageTotal: triage.length,
    triageOpen: openTriage.length,
    activityTotal: activity.length,
    sitesTotal: sites.length,
    latestLead: leads[leads.length - 1] || null,
    latestTriage: triage[triage.length - 1] || null,
    latestActivity: activity[activity.length - 1] || null,
  });
});

app.listen(PORT, () => {
  console.log(`Pest Intel backend running on :${PORT}`);
  console.log(`ALLOWED_ORIGIN=${ALLOWED_ORIGIN}`);
});
