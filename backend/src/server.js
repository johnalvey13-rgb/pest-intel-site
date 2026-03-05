import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 8787;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const TRIAGE_FILE = path.join(DATA_DIR, 'triage.json');

app.use(cors());
app.use(express.json());

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

app.get('/health', (_, res) => res.json({ ok: true, service: 'pest-intel-backend' }));

app.post('/api/leads', (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.email) return res.status(400).json({ error: 'name and email required' });
  const all = read(LEADS_FILE);
  const row = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...body };
  all.push(row);
  write(LEADS_FILE, all);
  res.status(201).json({ ok: true, id: row.id });
});

app.get('/api/leads', (_, res) => {
  const all = read(LEADS_FILE);
  res.json({ count: all.length, items: all.slice(-200).reverse() });
});

app.post('/api/triage', (req, res) => {
  const body = req.body || {};
  if (!body.siteName || !body.issue) return res.status(400).json({ error: 'siteName and issue required' });
  const all = read(TRIAGE_FILE);
  const row = { id: Date.now().toString(), createdAt: new Date().toISOString(), status: 'new', ...body };
  all.push(row);
  write(TRIAGE_FILE, all);
  res.status(201).json({ ok: true, id: row.id });
});

app.get('/api/triage', (_, res) => {
  const all = read(TRIAGE_FILE);
  res.json({ count: all.length, items: all.slice(-200).reverse() });
});

app.listen(PORT, () => console.log(`Pest Intel backend running on :${PORT}`));
