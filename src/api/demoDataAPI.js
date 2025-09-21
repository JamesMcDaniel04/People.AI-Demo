import express from 'express';
import { Logger } from '../utils/logger.js';

export function createDemoDataAPI(orchestrator) {
  const router = express.Router();
  const logger = new Logger(orchestrator?.config || {});

  const templateManager = orchestrator.getTemplateManager?.();
  const demoDataService = orchestrator.getDemoDataService?.();

  const getSampleProvider = () => orchestrator?.dataManager?.getProvider?.('sample') || null;

  router.get('/profiles', (req, res) => {
    try {
      const profiles = templateManager?.listProfiles?.() || [];
      res.json({ success: true, profiles });
    } catch (error) {
      logger.error('❌ Failed to list demo profiles', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/templates', (req, res) => {
    try {
      const templates = templateManager?.listTemplates?.() || [];
      res.json({ success: true, templates });
    } catch (error) {
      logger.error('❌ Failed to list demo templates', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/generate', async (req, res) => {
    if (!demoDataService) {
      return res.status(503).json({ success: false, error: 'Demo data service unavailable' });
    }

    try {
      const { accounts = [], accountName, profileId, mode = 'queue', forceRefresh, anonymize, concurrency, overrides = {} } = req.body || {};
      const entries = [...accounts];
      if (accountName) {
        entries.push({ accountName, profileId, overrides, forceRefresh, anonymize });
      }
      if (entries.length === 0) {
        return res.status(400).json({ success: false, error: 'No accounts provided' });
      }

      const normalized = entries.map((entry) => ({
        ...(typeof entry === 'string' ? { accountName: entry } : entry),
        profileId: entry.profileId || profileId,
        forceRefresh: entry.forceRefresh ?? forceRefresh,
        anonymize: entry.anonymize ?? anonymize,
        overrides: entry.overrides || overrides
      }));

      if (mode === 'sync' || !demoDataService.jobQueueService?.enabled) {
        const summary = await demoDataService.bulkGenerate(normalized, { forceRefresh, anonymize, concurrency, overrides, profileId });
        return res.json({ success: true, mode: 'sync', summary });
      }

      const job = await demoDataService.enqueueRefresh(normalized, { forceRefresh, anonymize, concurrency, overrides, profileId });
      res.json({ success: true, mode: 'queue', jobId: job?.id || null });
    } catch (error) {
      logger.error('❌ Demo data generation failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/schedule', async (req, res) => {
    if (!demoDataService) {
      return res.status(503).json({ success: false, error: 'Demo data service unavailable' });
    }
    try {
      const { cron, profiles, accounts, anonymize, jobName } = req.body || {};
      const payload = { profiles, accounts, anonymize };
      const job = await demoDataService.scheduleRefresh(payload, {
        repeat: { pattern: cron || orchestrator.config.demo?.scheduling?.cron },
        jobName
      });
      res.json({ success: true, jobId: job?.id || null, cron: cron || orchestrator.config.demo?.scheduling?.cron });
    } catch (error) {
      logger.error('❌ Failed to schedule demo data refresh', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/audits/:account', async (req, res) => {
    try {
      const provider = getSampleProvider();
      if (!provider?.getAuditHistory) {
        return res.status(503).json({ success: false, error: 'Audit history unavailable' });
      }
      const history = await provider.getAuditHistory(decodeURIComponent(req.params.account));
      res.json({ success: true, history });
    } catch (error) {
      logger.error('❌ Failed to fetch audit history', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/dataset/:account', async (req, res) => {
    try {
      const provider = getSampleProvider();
      if (!provider?.getLatestDataset) {
        return res.status(503).json({ success: false, error: 'Dataset access unavailable' });
      }
      const dataset = await provider.getLatestDataset(decodeURIComponent(req.params.account), {
        forceRefresh: req.query.force === 'true'
      });
      res.json({ success: true, dataset });
    } catch (error) {
      logger.error('❌ Failed to load latest dataset', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/quality/:account', async (req, res) => {
    try {
      const provider = getSampleProvider();
      if (!provider?.getLatestDataset) {
        return res.status(503).json({ success: false, error: 'Dataset access unavailable' });
      }
      const dataset = await provider.getLatestDataset(decodeURIComponent(req.params.account), {
        forceRefresh: req.query.force === 'true'
      });
      res.json({
        success: true,
        quality: dataset?.metadata?.quality || null,
        version: dataset?.metadata?.version || null
      });
    } catch (error) {
      logger.error('❌ Failed to load quality metrics', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/status', async (req, res) => {
    try {
      const profiles = templateManager?.listProfiles?.() || [];
      const queueEnabled = !!demoDataService?.jobQueueService?.enabled;
      res.json({
        success: true,
        profiles: profiles.length,
        templates: templateManager?.listTemplates?.().length || 0,
        queueEnabled,
        defaultCron: orchestrator.config.demo?.scheduling?.cron || null
      });
    } catch (error) {
      logger.error('❌ Failed to fetch demo data status', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
