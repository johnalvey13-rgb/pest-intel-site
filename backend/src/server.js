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
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'admin key not configured' });
  if (req.header('x-admin-key') !== ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.get('/health', (_, res) => {
  res.json({ ok: true, service: 'pest-intel-backend', time: new Date().toISOString() });
});

app.post('/api/leads', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.email || !body.business) {
    return res.status(400).json({ error: 'name, email, business are required' });
  }

  const all = read(LEADS_FILE);
  const row = {
    id: id(),
    createdAt: new Date().toISOString(),
    status: 'new',
    source: body.source || 'website',
    ...body,
  };
  all.push(row);
  write(LEADS_FILE, all);
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
    createdAt: new Date().toISOString(),
    status: 'new',
    priority: body.priority || 'normal',
    ...body,
  };
  all.push(row);
  write(TRIAGE_FILE, all);
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
    updatedAt: new Date().toISOString(),
  };
  write(TRIAGE_FILE, all);
  res.json({ ok: true, item: all[idx] });
});

app.get('/api/dashboard/summary', requireAdmin, (_, res) => {
  const leads = read(LEADS_FILE);
  const triage = read(TRIAGE_FILE);
  const openTriage = triage.filter((x) => !['resolved', 'closed'].includes((x.status || '').toLowerCase()));
  res.json({
    leadsTotal: leads.length,
    triageTotal: triage.length,
    triageOpen: openTriage.length,
    latestLead: leads[leads.length - 1] || null,
    latestTriage: triage[triage.length - 1] || null,
  });
});

app.listen(PORT, () => {
  console.log(`Pest Intel backend running on :${PORT}`);
  console.log(`ALLOWED_ORIGIN=${ALLOWED_ORIGIN}`);
});
