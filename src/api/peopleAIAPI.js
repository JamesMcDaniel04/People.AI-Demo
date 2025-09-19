import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export function createPeopleAIAPI(orchestrator, baseConfig) {
  const router = Router();

  const statePath = path.resolve(process.cwd(), 'data/peopleai.json');
  const settingsPath = path.resolve(process.cwd(), 'data/settings.json');

  function readJSON(p) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) {}
    return null;
  }
  function writeJSON(p, obj) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  }

  function maskToken(t) {
    if (!t || typeof t !== 'string') return null;
    if (t.length <= 8) return '****';
    return `${t.slice(0,4)}…${t.slice(-4)}`;
  }

  function initDefaultState() {
    const now = Date.now();
    return {
      connected: false,
      token: null,
      org: null,
      sync: { lastSync: null, contacts: 0, activities: 0, deals: 0, engagementScore: 0 },
      recentSignals: [
        { id: `sig_${now-3600e3}`, type: 'email', title: 'New email thread with CFO', detail: 'Introduced expansion proposal – 5 participants', ts: new Date(now-3600e3).toISOString(), severity: 'info' },
        { id: `sig_${now-7200e3}`, type: 'meeting', title: '30m exec sync logged', detail: 'VP Ops + AM – positive sentiment', ts: new Date(now-7200e3).toISOString(), severity: 'info' },
        { id: `sig_${now-10800e3}`, type: 'hygiene', title: 'Opportunity stuck 21 days', detail: 'EU Expansion – stage unchanged', ts: new Date(now-10800e3).toISOString(), severity: 'warn' },
        { id: `sig_${now-14400e3}`, type: 'contact', title: 'New influencer discovered', detail: 'Director, Platform – added to CRM', ts: new Date(now-14400e3).toISOString(), severity: 'info' }
      ]
    };
  }

  let state = readJSON(statePath) || initDefaultState();

  router.get('/status', (req, res) => {
    const settings = readJSON(settingsPath) || {};
    const enabled = !!settings?.peopleai?.enabled;
    const features = settings?.peopleai?.features || {};
    res.json({
      connected: !!state.connected,
      enabled,
      features,
      tokenMasked: maskToken(state.token),
      org: state.org,
      sync: state.sync,
      recentSignals: (state.recentSignals || []).slice(0, 20)
    });
  });

  router.post('/connect', (req, res) => {
    const token = (req.body && req.body.token) || `demo-token-${Date.now()}`;
    state.connected = true;
    state.token = token;
    if (!state.org) {
      state.org = { id: 'org_demo_001', name: 'DemoCo', domain: 'example.com', plan: 'Enterprise', seats: 25 };
    }
    if (!state.sync) state.sync = { lastSync: null, contacts: 0, activities: 0, deals: 0, engagementScore: 0 };
    writeJSON(statePath, state);
    res.json({ ok: true, tokenMasked: maskToken(token), org: state.org });
  });

  router.post('/disconnect', (req, res) => {
    state.connected = false;
    state.token = null;
    writeJSON(statePath, state);
    res.json({ ok: true });
  });

  router.post('/sync', async (req, res) => {
    const now = new Date();
    const ts = now.toISOString();
    if (!state.sync) state.sync = { lastSync: null, contacts: 0, activities: 0, deals: 0, engagementScore: 0 };

    // Increment mock counters and compute a simple engagement score
    const addContacts = Math.floor(Math.random() * 3);
    const addActs = Math.floor(2 + Math.random() * 5);
    const addDeals = Math.floor(Math.random() * 2);
    state.sync.contacts += addContacts;
    state.sync.activities += addActs;
    state.sync.deals += addDeals;
    state.sync.lastSync = ts;
    state.sync.engagementScore = Math.min(100, Math.max(0, Math.round(60 + Math.random() * 20)));

    // Create a few signals to reflect the sync
    const mk = (type, title, detail, severity='info') => ({ id: `sig_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, type, title, detail, ts, severity });
    const newSignals = [
      mk('email', 'Email reply from CFO', 'Requested ROI breakdown for expansion'),
      mk('meeting', 'QBR scheduled', 'Quarterly business review booked for next Tue'),
      mk('hygiene', '2 stale opportunities', 'Needs stage progression', 'warn'),
      mk('contact', 'Exec sponsor added', 'SVP Engineering associated to account')
    ];
    state.recentSignals = [...newSignals, ...(state.recentSignals || [])].slice(0, 50);
    writeJSON(statePath, state);

    res.json({ ok: true, syncedAt: ts, counts: state.sync, added: newSignals.length });
  });

  router.get('/recent', (req, res) => {
    res.json({ ok: true, signals: state.recentSignals || [] });
  });

  router.post('/webhook', async (req, res) => {
    const settings = readJSON(settingsPath) || {};
    const trigEnabled = !!settings?.peopleai?.features?.workflowTriggers;
    const ev = req.body || {};
    ev.id = ev.id || `wh_${Date.now()}`;
    ev.ts = ev.ts || new Date().toISOString();
    state.recentSignals = [ev, ...(state.recentSignals || [])].slice(0, 50);
    writeJSON(statePath, state);

    // Optional: surface a lightweight orchestrator action when triggers are enabled
    if (trigEnabled && orchestrator?.jobQueueService?.isEnabled?.()) {
      try {
        // Enqueue a no-op "PeopleAI signal processed" job in background queue if available
        await orchestrator.jobQueueService.enqueue?.('signals', { source: 'peopleai', event: ev });
      } catch (_) { /* non-fatal in demo */ }
    }
    res.json({ ok: true, received: true, triggerQueued: !!trigEnabled });
  });

  return router;
}

