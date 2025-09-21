import EventEmitter from 'events';
import { DataValidationService } from './dataValidationService.js';
import { ConflictResolutionService } from './conflictResolutionService.js';
import { Logger } from '../utils/logger.js';
import { statusService as defaultStatusService } from './statusService.js';
import { PostgresService } from './postgresService.js';
import { DemoDataQualityService } from './demoDataQualityService.js';

const DOMAIN_KEYS = [
  'accountInfo',
  'stakeholders',
  'interactions',
  'emails',
  'calls',
  'documents',
  'calendar',
  'crm',
  'external'
];

export class ProductionDataPipeline extends EventEmitter {
  constructor(config, dataManager, options = {}) {
    super();
    this.config = config;
    this.dataManager = dataManager;
    this.logger = new Logger(config);
    this.statusService = options.statusService || defaultStatusService;
    this.postgresService = options.postgresService || null;
    this.validationService = new DataValidationService(config);
    this.conflictResolver = new ConflictResolutionService(config);
    this.demoQualityService = new DemoDataQualityService(config);
    this.realtimeConfig = {
      enabled: options.realtime?.enabled ?? (config?.data?.pipeline?.realtime?.enabled !== false),
      intervalMs: Number(options.realtime?.intervalMs || config?.data?.pipeline?.realtime?.intervalMs || 60_000),
      warmupMs: Number(options.realtime?.warmupMs || config?.data?.pipeline?.realtime?.warmupMs || 5_000)
    };

    this.persistToPostgres = options.persistToPostgres ?? (config?.data?.pipeline?.persistToPostgres !== false);
    this.pollingHandles = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    if (!this.postgresService && this.persistToPostgres) {
      try {
        this.postgresService = new PostgresService(this.config);
        await this.postgresService.initialize();
        this.logger.info('✅ Production data pipeline persistence enabled via PostgreSQL');
      } catch (error) {
        this.logger.warn('⚠️ Failed to initialize PostgreSQL for pipeline persistence, continuing without it', {
          error: error.message
        });
        this.postgresService = null;
      }
    }

    this.initialized = true;
    this.logger.info('✅ Production data pipeline initialized', {
      realtimeEnabled: this.realtimeConfig.enabled,
      refreshIntervalMs: this.realtimeConfig.intervalMs
    });
  }

  isInitialized() {
    return this.initialized;
  }

  async shutdown() {
    for (const [, handle] of this.pollingHandles.entries()) {
      clearInterval(handle);
    }
    this.pollingHandles.clear();

    if (this.postgresService?.isConnected()) {
      await this.postgresService.close();
    }

    this.initialized = false;
    this.logger.info('✅ Production data pipeline shut down');
  }

  ensureRealtime(accountName) {
    if (!this.realtimeConfig.enabled) {
      return;
    }
    if (this.pollingHandles.has(accountName)) {
      return;
    }

    const interval = setInterval(() => {
      this.ingestAccount(accountName, { reason: 'realtime-refresh', storeOnly: true })
        .catch((error) => {
          this.logger.warn('⚠️ Realtime ingestion refresh failed', {
            accountName,
            error: error.message
          });
        });
    }, this.realtimeConfig.intervalMs);

    if (typeof interval.unref === 'function') {
      interval.unref();
    }

    this.pollingHandles.set(accountName, interval);
    this.logger.debug('🔁 Realtime ingestion enabled', {
      accountName,
      intervalMs: this.realtimeConfig.intervalMs
    });
  }

  stopRealtime(accountName) {
    const handle = this.pollingHandles.get(accountName);
    if (handle) {
      clearInterval(handle);
      this.pollingHandles.delete(accountName);
      this.logger.info('🛑 Realtime ingestion disabled for account', { accountName });
    }
  }

  async getAccountData(accountName, options = {}) {
    await this.initialize();
    const result = await this.ingestAccount(accountName, { reason: 'on-demand', ...options });
    if (!options.skipRealtime) {
      this.ensureRealtime(accountName);
    }
    return result.data;
  }

  async ingestAccount(accountName, options = {}) {
    const startedAt = Date.now();
    this.emit('ingestion:start', { accountName, reason: options.reason });

    const providerResults = await this.fetchFromProviders(accountName);
    const domainBuckets = this.buildDomainBuckets(providerResults);

    const validationResults = {};
    const resolvedByDomain = {};
    const conflictsByDomain = {};

    for (const domain of DOMAIN_KEYS) {
      const validation = this.validationService.validateDomain(domain, domainBuckets[domain] || []);
      validationResults[domain] = validation;
      const resolved = this.conflictResolver.resolve(domain, validation.valid);
      resolvedByDomain[domain] = resolved;
      conflictsByDomain[domain] = resolved.conflicts;
    }

    const mergedData = this.buildMergedDataset(accountName, resolvedByDomain, validationResults, providerResults);
    const qualityInput = this.buildQualitySnapshot(mergedData);
    const qualityScore = this.demoQualityService.evaluate(qualityInput);
    mergedData.metadata = mergedData.metadata || {};
    mergedData.metadata.quality = qualityScore;
    const lineageRecords = this.collectLineageRecords(accountName, resolvedByDomain);

    await this.persistAudit(accountName, providerResults, validationResults, conflictsByDomain, options);
    await this.persistLineage(accountName, lineageRecords);

    const durationMs = Date.now() - startedAt;
    const summary = {
      accountName,
      durationMs,
      providers: providerResults.map((item) => ({
        provider: item.provider,
        durationMs: item.durationMs,
        domains: Object.keys(item.data || {}),
        success: !item.error
      })),
      validation: this.validationService.summarizeResults(validationResults),
      conflicts: Object.fromEntries(
        Object.entries(conflictsByDomain).map(([domain, conflicts]) => [domain, conflicts.length])
      ),
      quality: qualityScore.overall
    };

    this.statusService?.record('pipeline_ingestion', {
      accountName,
      summary
    });

    if (!options.storeOnly) {
      this.logger.info('✅ Account data ingested successfully', summary);
    }

    this.emit('ingestion:complete', { accountName, summary });

    return {
      data: mergedData,
      validation: validationResults,
      conflicts: conflictsByDomain,
      metrics: summary
    };
  }

  async fetchFromProviders(accountName) {
    const providers = this.getProviders();
    const tasks = providers.map(({ name, provider }) =>
      this.fetchFromProvider(name, provider, accountName)
    );

    const results = await Promise.allSettled(tasks);
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const providerName = providers[index]?.name || 'unknown';
      this.logger.warn('⚠️ Provider ingestion failed', {
        provider: providerName,
        error: result.reason?.message || String(result.reason)
      });
      this.statusService?.record('pipeline_error', {
        accountName,
        provider: providerName,
        error: result.reason?.message || String(result.reason)
      });
      return {
        provider: providerName,
        durationMs: 0,
        data: {},
        error: result.reason?.message || String(result.reason)
      };
    });
  }

  getProviders() {
    if (typeof this.dataManager.getProviders === 'function') {
      return this.dataManager.getProviders();
    }

    const providerNames = this.dataManager.getAvailableProviders?.() || [];
    return providerNames
      .map((name) => ({
        name,
        provider: this.dataManager.providers?.get?.(name)
      }))
      .filter((item) => !!item.provider);
  }

  async fetchFromProvider(name, provider, accountName) {
    const capture = {
      provider: name,
      accountName,
      startedAt: Date.now(),
      durationMs: 0,
      data: {}
    };

    const calls = [
      ['accountInfo', 'getAccountInfo'],
      ['stakeholders', 'getStakeholders'],
      ['interactions', 'getInteractionHistory'],
      ['emails', 'getEmailData'],
      ['calls', 'getCallData'],
      ['documents', 'getDocuments'],
      ['calendar', 'getCalendarData'],
      ['crm', 'getCRMData'],
      ['external', 'getNews']
    ];

    for (const [domain, method] of calls) {
      const fn = provider?.[method];
      if (typeof fn !== 'function') {
        continue;
      }
      try {
        const value = await fn.call(provider, accountName);
        if (value !== undefined && value !== null) {
          capture.data[domain] = value;
        }
      } catch (error) {
        this.logger.debug('Provider domain fetch failed', {
          provider: name,
          domain,
          error: error.message
        });
        capture.data[domain] = capture.data[domain] || [];
        if (!capture.errors) capture.errors = [];
        capture.errors.push({ domain, message: error.message });
      }
    }

    capture.durationMs = Date.now() - capture.startedAt;
    return capture;
  }

  buildDomainBuckets(providerResults) {
    const buckets = Object.fromEntries(DOMAIN_KEYS.map((domain) => [domain, []]));

    for (const providerResult of providerResults) {
      const provider = providerResult.provider;
      for (const domain of DOMAIN_KEYS) {
        const raw = providerResult.data?.[domain];
        if (raw === undefined || raw === null) {
          continue;
        }

        if (domain === 'accountInfo') {
          buckets.accountInfo.push({
            provider,
            source: `${provider}_${domain}`,
            domain,
            record: raw
          });
          continue;
        }

        if (Array.isArray(raw)) {
          raw.forEach((item) => {
            buckets[domain].push({
              provider,
              source: `${provider}_${domain}`,
              domain,
              record: item
            });
          });
        } else if (raw && Array.isArray(raw.data)) {
          raw.data.forEach((item) => {
            buckets[domain].push({
              provider,
              source: `${provider}_${domain}`,
              domain,
              record: item
            });
          });
        } else if (raw && typeof raw === 'object') {
          buckets[domain].push({
            provider,
            source: `${provider}_${domain}`,
            domain,
            record: raw
          });
        }
      }
    }

    return buckets;
  }

  buildMergedDataset(accountName, resolvedByDomain, validationResults, providerResults) {
    const now = new Date().toISOString();
    const dataset = {
      basic: { source: 'aggregated', data: {} },
      interactions: [],
      stakeholders: [],
      emails: [],
      calls: [],
      documents: [],
      calendar: [],
      crm: [],
      external: [],
      metadata: {
        pipeline: {
          ingestedAt: now,
          providers: providerResults.map((p) => ({
            provider: p.provider,
            durationMs: p.durationMs,
            domains: Object.keys(p.data || {})
          })),
          validation: this.validationService.summarizeResults(validationResults)
        }
      }
    };

    const accountRecords = resolvedByDomain.accountInfo?.records || [];
    if (accountRecords.length > 0) {
      const account = accountRecords[accountRecords.length - 1];
      dataset.basic = {
        source: account.source || account.provider || 'aggregated',
        data: account.record || {},
        metadata: {
          lineage: account.mergedFrom || []
        }
      };
    }

    const domainsToCopy = ['stakeholders', 'interactions', 'emails', 'calls', 'documents', 'calendar', 'crm', 'external'];
    for (const domain of domainsToCopy) {
      const resolved = resolvedByDomain[domain] || { records: [], conflicts: [] };
      const validation = validationResults[domain] || { invalid: [], qualityScore: 1 };
      const records = resolved.records.map((entry) => entry.record || entry);
      const lineage = resolved.records.map((entry) => ({
        provider: entry.provider,
        source: entry.source,
        identifier: entry.identifier
      }));
      dataset[domain] = [{
        source: 'reconciled',
        data: records,
        metadata: {
          qualityScore: validation.qualityScore,
          invalidCount: validation.invalid.length,
          conflicts: resolved.conflicts.length,
          lineage
        }
      }];
    }

    if (typeof this.dataManager.generateFinancialData === 'function') {
      const financial = this.dataManager.generateFinancialData(accountName);
      if (financial) {
        dataset.financial = [{ source: 'generated', data: financial }];
      }
    }

    return dataset;
  }

  buildQualitySnapshot(mergedData) {
    const extract = (domain) => {
      const entries = Array.isArray(mergedData?.[domain]) ? mergedData[domain] : [];
      return entries.flatMap((entry) => entry?.data || []);
    };

    const validationSummary = mergedData?.metadata?.pipeline?.validation || {};
    const domainScores = Object.values(validationSummary)
      .map((item) => (typeof item?.qualityScore === 'number' ? item.qualityScore : 1));
    const baseline = domainScores.length > 0
      ? domainScores.reduce((sum, value) => sum + value, 0) / domainScores.length
      : 0.85;

    return {
      accountInfo: mergedData?.basic?.data || {},
      emails: extract('emails'),
      calls: extract('calls'),
      documents: extract('documents'),
      calendar: extract('calendar'),
      crm: extract('crm'),
      stakeholders: extract('stakeholders'),
      datasetConfig: mergedData?.metadata?.datasetConfig || {},
      metadata: { trustBaseline: baseline },
      profile: mergedData?.basic?.data?.datasetProfile || mergedData?.basic?.data?.profile
    };
  }

  collectLineageRecords(accountName, resolvedByDomain) {
    const lineage = [];
    for (const [domain, resolved] of Object.entries(resolvedByDomain)) {
      if (!resolved || !Array.isArray(resolved.records)) continue;
      for (const entry of resolved.records) {
        if (!entry.identifier) continue;
        lineage.push({
          accountName,
          domain,
          identifier: entry.identifier,
          provider: entry.provider,
          source: entry.source,
          checksum: entry.checksum,
          record: entry.record,
          mergedFrom: entry.mergedFrom || [],
          timestamp: entry.timestamp
        });
      }
    }
    return lineage;
  }

  async persistAudit(accountName, providerResults, validationResults, conflictsByDomain, options = {}) {
    if (!this.postgresService?.recordIngestionEvent) {
      return;
    }

    const events = [];

    for (const providerResult of providerResults) {
      events.push(this.postgresService.recordIngestionEvent({
        accountName,
        source: providerResult.provider,
        recordType: 'provider_sync',
        action: options.reason || 'ingest',
        status: providerResult.error ? 'failed' : 'success',
        metadata: {
          durationMs: providerResult.durationMs,
          domains: Object.keys(providerResult.data || {}),
          errors: providerResult.errors || []
        }
      }));
    }

    for (const [domain, validation] of Object.entries(validationResults)) {
      if (!validation) continue;
      events.push(this.postgresService.recordIngestionEvent({
        accountName,
        source: 'validator',
        recordType: domain,
        action: 'quality_check',
        status: validation.thresholdBreached ? 'warning' : 'ok',
        qualityScore: validation.qualityScore,
        metadata: {
          valid: validation.valid.length,
          invalid: validation.invalid.length
        },
        errors: validation.invalid.slice(0, 5).map((item) => ({
          provider: item.provider,
          errors: item.errors
        }))
      }));
    }

    for (const [domain, conflicts] of Object.entries(conflictsByDomain)) {
      if (!conflicts || conflicts.length === 0) continue;
      events.push(this.postgresService.recordIngestionEvent({
        accountName,
        source: 'conflict_resolver',
        recordType: domain,
        action: 'conflict_resolution',
        status: 'resolved',
        metadata: {
          conflictCount: conflicts.length
        }
      }));
    }

    await Promise.allSettled(events);
  }

  async persistLineage(accountName, lineageRecords) {
    if (!this.postgresService?.upsertDataLineage) {
      return;
    }

    const tasks = [];
    for (const record of lineageRecords) {
      tasks.push(this.postgresService.upsertDataLineage({
        accountName,
        recordType: record.domain,
        recordIdentifier: record.identifier,
        source: record.provider,
        checksum: record.checksum,
        payload: record.record,
        metadata: {
          source: record.source,
          mergedFrom: record.mergedFrom,
          timestamp: record.timestamp
        }
      }));
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }
}
