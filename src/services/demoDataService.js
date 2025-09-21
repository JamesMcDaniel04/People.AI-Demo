const normalizeAccountEntry = (entry) => {
  if (typeof entry === 'string') {
    return { accountName: entry };
  }
  return entry || {};
};

export class DemoDataService {
  constructor(config, options = {}) {
    this.config = config;
    this.sampleProvider = options.sampleProvider;
    this.templateManager = options.templateManager;
    this.jobQueueService = options.jobQueueService;
    this.bulkConcurrency = Math.max(1, Number(config.demo?.scheduling?.bulkBatchSize || 5));
  }

  async initialize() {
    if (!this.jobQueueService?.enabled) {
      return false;
    }
    try {
      const profiles = this.templateManager?.listProfiles?.() || [];
      const cron = this.config.demo?.scheduling?.cron;
      if (cron && profiles.length > 0) {
        await this.jobQueueService.scheduleDemoDataRefresh({
          profiles: profiles.map((profile) => profile.id),
          anonymize: this.config.demo?.anonymizeByDefault !== false
        }, {
          repeat: { pattern: cron },
          jobName: 'demo-data-default'
        });
      }
      return true;
    } catch (error) {
      console.warn('⚠️ Failed to initialize demo data scheduling', { error: error.message });
      return false;
    }
  }

  getDefaultAccounts(profileIds = []) {
    const profiles = profileIds.length > 0
      ? profileIds.map((id) => this.templateManager?.getProfile(id) || { id, name: id })
      : this.templateManager?.listProfiles?.() || [];
    return profiles.map((profile) => ({
      accountName: `${profile.name} Demo`,
      profileId: profile.id,
      anonymize: this.config.demo?.anonymizeByDefault !== false
    }));
  }

  async generateDataset(accountName, options = {}) {
    if (!this.sampleProvider) {
      throw new Error('Sample data provider unavailable');
    }
    if (options.forceRefresh && this.sampleProvider.invalidateGeneratedData) {
      this.sampleProvider.invalidateGeneratedData(accountName);
    }
    const dataset = await this.sampleProvider.getOrGenerateDemoDataset(accountName, {
      profileId: options.profileId,
      overrides: options.overrides,
      anonymize: options.anonymize
    });
    return dataset;
  }

  async bulkGenerate(accountEntries = [], options = {}) {
    const accounts = accountEntries.map(normalizeAccountEntry);
    if (accounts.length === 0) {
      return { startedAt: new Date().toISOString(), durationMs: 0, results: [] };
    }
    const concurrency = Math.max(1, Number(options.concurrency || this.bulkConcurrency));
    const startedAt = Date.now();
    const results = [];

    for (let i = 0; i < accounts.length; i += concurrency) {
      const batch = accounts.slice(i, i + concurrency);
      const settled = await Promise.allSettled(batch.map(async (entry) => {
        const accountName = entry.accountName || entry.name;
        const profileId = entry.profileId || options.profileId;
        const started = Date.now();
        const dataset = await this.generateDataset(accountName, {
          profileId,
          overrides: entry.overrides || options.overrides,
          anonymize: entry.anonymize ?? options.anonymize ?? (this.config.demo?.anonymizeByDefault !== false),
          forceRefresh: entry.forceRefresh || options.forceRefresh
        });
        return {
          accountName,
          profileId: profileId || dataset?.profile?.id,
          durationMs: Date.now() - started,
          quality: dataset?.metadata?.quality?.overall,
          version: dataset?.metadata?.version,
          metadata: dataset?.metadata
        };
      }));

      settled.forEach((result, index) => {
        const entry = batch[index];
        const accountName = entry.accountName || entry.name;
        if (result.status === 'fulfilled') {
          results.push({
            status: 'fulfilled',
            accountName,
            profileId: result.value.profileId,
            durationMs: result.value.durationMs,
            quality: result.value.quality,
            version: result.value.version
          });
        } else {
          results.push({
            status: 'rejected',
            accountName,
            error: result.reason?.message || String(result.reason)
          });
        }
      });
    }

    return {
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      results
    };
  }

  async handleRefreshJob(payload = {}) {
    const accounts = Array.isArray(payload.accounts) && payload.accounts.length > 0
      ? payload.accounts.map(normalizeAccountEntry)
      : this.getDefaultAccounts(payload.profileIds || []);

    const summary = await this.bulkGenerate(accounts, payload.options || {});
    return {
      ...summary,
      accounts: accounts.map((entry) => entry.accountName)
    };
  }

  async enqueueRefresh(accounts, options = {}) {
    if (!this.jobQueueService?.enabled) {
      return this.bulkGenerate(accounts, options);
    }
    return await this.jobQueueService.enqueueDemoDataRefresh({ accounts, options });
  }

  async scheduleRefresh(payload, options = {}) {
    if (!this.jobQueueService?.enabled) {
      throw new Error('Job queue not enabled');
    }
    return await this.jobQueueService.scheduleDemoDataRefresh(payload, options);
  }
}
