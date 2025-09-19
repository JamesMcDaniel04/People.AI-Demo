import { EventEmitter } from 'events';
import { metrics } from './metricsService.js';
import { statusService } from './statusService.js';
import { Logger } from '../utils/logger.js';

const DEGRADED_STATES = new Set(['degraded', 'warn']);
const DOWN_STATES = new Set(['unhealthy', 'critical', 'down']);

export class MonitoringService extends EventEmitter {
  constructor(config = {}, { alertService, postgresService, getPostgresService } = {}) {
    super();
    this.config = config;
    this.logger = new Logger(config);
    this.alertService = alertService;
    this.postgresService = postgresService || null;
    this.getPostgresService = typeof getPostgresService === 'function' ? getPostgresService : null;
    this.components = new Map();
    this.incidents = [];
    this.errorCounts = new Map();
    this.timer = null;
    this.startedAt = Date.now();
    this.pipelineSummary = null;
  }

  registerComponent(name, { description, check, slaTarget, tags = [], critical = false }) {
    if (!name || typeof check !== 'function') {
      throw new Error('Component name and check function are required');
    }
    const entry = {
      name,
      description,
      check,
      slaTarget: typeof slaTarget === 'number' ? slaTarget : this.config.monitoring?.defaultSlaTarget || 0.995,
      tags,
      critical,
      state: {
        status: 'unknown',
        lastChecked: null,
        lastChange: Date.now(),
        responseTimeMs: null,
        uptimeMs: 0,
        downtimeMs: 0,
        consecutiveFailures: 0,
        availability: 1,
        details: {}
      }
    };
    this.components.set(name, entry);
    return entry;
  }

  async evaluateComponent(name) {
    const entry = this.components.get(name);
    if (!entry) {
      throw new Error(`Component ${name} not registered`);
    }
    const started = Date.now();
    let result;
    let status = 'healthy';
    try {
      result = await entry.check();
      if (!result || typeof result !== 'object') {
        result = { status: 'healthy', details: { raw: result } };
      }
      status = (result.status || (result.connected === false ? 'unhealthy' : 'healthy')).toLowerCase();
    } catch (error) {
      status = 'unhealthy';
      result = {
        status,
        error: error.message,
        details: { error: error.message }
      };
    }

    const elapsed = Date.now() - started;
    const prev = entry.state;
    const now = Date.now();
    const since = now - (prev.lastChecked || now);

    if (prev.status !== 'unknown') {
      const bucket = DOWN_STATES.has(prev.status) || DEGRADED_STATES.has(prev.status) ? 'downtimeMs' : 'uptimeMs';
      entry.state[bucket] += since;
    }

    entry.state = {
      ...entry.state,
      status,
      lastChecked: now,
      responseTimeMs: result.responseTimeMs || result.latencyMs || result.latency || elapsed,
      details: result.details || result,
      availability: this.#availability(entry.state.uptimeMs, entry.state.downtimeMs),
      lastChange: prev.status === status ? prev.lastChange : now,
      consecutiveFailures: DOWN_STATES.has(status) || DEGRADED_STATES.has(status) ? prev.consecutiveFailures + (prev.status === status ? 1 : 0) + 1 : 0
    };

    statusService.record('health', {
      component: name,
      status,
      responseTimeMs: entry.state.responseTimeMs,
      checkedAt: new Date(now).toISOString()
    });

    this.emit('update', { type: 'component', component: name, state: entry.state });

    if ((DOWN_STATES.has(status) || DEGRADED_STATES.has(status)) && prev.status !== status) {
      this.#recordIncident(name, status, result.details || result, entry);
    }

    return entry.state;
  }

  async evaluateAll() {
    const promises = [];
    for (const name of this.components.keys()) {
      promises.push(this.evaluateComponent(name).catch(error => {
        this.logger.error('Component evaluation failed', { component: name, error: error.message });
      }));
    }
    promises.push(this.#refreshPipelineSummary().catch(error => {
      this.logger.warn('Pipeline summary refresh failed', { error: error.message });
    }));
    await Promise.all(promises);
    this.emit('update', { type: 'heartbeat', generatedAt: new Date().toISOString() });
  }

  start() {
    if (this.timer) return;
    const interval = parseInt(process.env.MONITORING_POLL_INTERVAL_MS) || this.config.monitoring?.pollInterval || 30000;
    this.timer = setInterval(() => {
      this.evaluateAll().catch(error => {
        this.logger.error('Periodic monitoring failed', { error: error.message });
      });
    }, Math.max(interval, 5000));
    this.evaluateAll().catch(() => {});
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getDashboardSnapshot() {
    const components = Array.from(this.components.values()).map(entry => ({
      name: entry.name,
      description: entry.description,
      tags: entry.tags,
      critical: entry.critical,
      slaTarget: entry.slaTarget,
      state: entry.state
    }));

    const metricsSnapshot = metrics.snapshot();
    const performance = this.#calculatePerformance(metricsSnapshot);

    return {
      generatedAt: new Date().toISOString(),
      startedAt: new Date(this.startedAt).toISOString(),
      overallStatus: this.#overallStatus(components),
      components,
      metrics: metricsSnapshot,
      performance,
      dataPipeline: this.pipelineSummary || {
        status: 'unknown',
        source: 'unavailable',
        generatedAt: new Date().toISOString()
      },
      incidents: this.getIncidents(10)
    };
  }

  getIncidents(limit = 50) {
    return this.incidents.slice(-limit).map(item => ({ ...item }));
  }

  recordError(component, error, context = {}) {
    const key = component || 'system';
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    statusService.record('incident', {
      component: key,
      error: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
    this.emit('update', {
      type: 'error',
      component: key,
      error: error.message || String(error),
      context
    });
  }

  subscribe(listener) {
    const handler = (payload) => listener(payload);
    this.on('update', handler);
    return () => this.off('update', handler);
  }

  getPipelineSnapshot() {
    return this.pipelineSummary;
  }

  #availability(uptimeMs, downtimeMs) {
    const total = uptimeMs + downtimeMs;
    if (total <= 0) return 1;
    return uptimeMs / total;
  }

  #overallStatus(components) {
    let critical = false;
    let degraded = false;
    for (const item of components) {
      const status = item.state.status;
      if (DOWN_STATES.has(status)) {
        critical = true;
        break;
      }
      if (DEGRADED_STATES.has(status)) {
        degraded = true;
      }
    }
    if (critical) return 'unhealthy';
    if (degraded) return 'degraded';
    return 'healthy';
  }

  #calculatePerformance(snapshot) {
    const httpTimings = Object.entries(snapshot.timings || {})
      .filter(([key]) => key.startsWith('http:'))
      .map(([key, stats]) => ({ key, ...stats }));

    const counters = snapshot.counters || {};
    const totalRequests = Object.entries(counters)
      .filter(([key]) => key.startsWith('http:') && key.endsWith(':ok'))
      .reduce((sum, [, value]) => sum + value, 0);
    const totalErrors = Object.entries(counters)
      .filter(([key]) => key.startsWith('http:') && key.endsWith(':err'))
      .reduce((sum, [, value]) => sum + value, 0);

    const targetP95 = parseInt(process.env.PERF_LATENCY_P95_TARGET_MS) || this.config.monitoring?.performance?.latencyP95Target || 5000;
    const targetP99 = parseInt(process.env.PERF_LATENCY_P99_TARGET_MS) || this.config.monitoring?.performance?.latencyP99Target || 10000;
    const targetErrorRate = parseFloat(process.env.PERF_ERROR_RATE_TARGET) || this.config.monitoring?.performance?.errorRateTarget || 0.01;

    const p95Breaches = httpTimings.filter(item => (item.p95 || 0) > targetP95).map(item => item.key);
    const p99Breaches = httpTimings.filter(item => (item.p99 || 0) > targetP99).map(item => item.key);
    const errorRate = totalRequests + totalErrors === 0 ? 0 : totalErrors / (totalRequests + totalErrors);

    return {
      httpTimings,
      totalRequests,
      totalErrors,
      errorRate,
      targets: {
        p95: targetP95,
        p99: targetP99,
        errorRate: targetErrorRate
      },
      breaches: {
        p95: p95Breaches,
        p99: p99Breaches,
        errorRate: errorRate > targetErrorRate
      }
    };
  }

  #recordIncident(component, status, details, entry) {
    const incident = {
      component,
      status,
      details,
      timestamp: new Date().toISOString(),
      slaTarget: entry.slaTarget,
      availability: entry.state.availability
    };
    this.incidents.push(incident);
    if (this.incidents.length > 200) {
      this.incidents.splice(0, this.incidents.length - 200);
    }
    statusService.record('incident', incident);
    this.emit('update', { type: 'incident', incident });

    if (this.alertService) {
      const severity = DOWN_STATES.has(status) ? 'critical' : 'high';
      this.alertService.sendAlert({
        severity,
        title: `Component ${component} ${status}`,
        summary: `Health status changed to ${status}`,
        component,
        dedupeKey: `${component}:${status}`,
        details: {
          slaTarget: incident.slaTarget,
          availability: incident.availability,
          ...(details || {})
        }
      }).catch(error => {
        this.logger.error('Alert dispatch failed', { component, error: error.message });
      });
    }
  }

  #resolvePostgresService() {
    if (this.postgresService?.isConnected?.()) {
      return this.postgresService;
    }
    if (this.getPostgresService) {
      try {
        const service = this.getPostgresService();
        if (service?.isConnected?.()) {
          this.postgresService = service;
          return service;
        }
        return service;
      } catch (error) {
        this.logger.warn('Postgres resolver failed', { error: error.message });
      }
    }
    return this.postgresService;
  }

  async #refreshPipelineSummary() {
    const lookback = parseInt(process.env.MONITORING_PIPELINE_LOOKBACK_MINUTES) ||
      this.config.monitoring?.pipeline?.lookbackMinutes || 60;
    const recentLimit = parseInt(process.env.MONITORING_PIPELINE_RECENT_LIMIT) ||
      this.config.monitoring?.pipeline?.recentLimit || 20;

    let summary = null;
    try {
      const postgres = this.#resolvePostgresService();
      if (postgres?.getPipelineAuditSummary) {
        summary = await postgres.getPipelineAuditSummary({
          sinceMinutes: lookback,
          recentLimit
        });
      }
    } catch (error) {
      this.logger.warn('Pipeline summary query failed', { error: error.message });
    }

    if (!summary) {
      summary = this.#buildInMemoryPipelineSummary(lookback);
    }

    if (!summary) {
      return;
    }

    this.pipelineSummary = {
      ...summary,
      generatedAt: summary.generatedAt || new Date().toISOString(),
      lookbackMinutes: summary.lookbackMinutes || lookback
    };

    this.#maybeAlertOnPipeline(this.pipelineSummary);
    this.emit('update', { type: 'pipeline', summary: this.pipelineSummary });
  }

  #buildInMemoryPipelineSummary(lookbackMinutes) {
    const events = statusService.getRecent('pipeline_ingestion', 50) || [];
    if (events.length === 0) {
      return {
        source: 'status-service',
        status: 'unknown',
        statusCounts: {},
        providerCounts: [],
        recentEvents: [],
        conflictByDomain: [],
        lineageTotals: [],
        lookbackMinutes
      };
    }

    const statusCounts = { ok: 0, warning: 0, failed: 0 };
    const providerCounts = new Map();
    const recentEvents = [];

    for (const item of events) {
      const summary = item.summary || {};
      const providerList = summary.providers || [];
      providerList.forEach(provider => {
        providerCounts.set(provider.provider, (providerCounts.get(provider.provider) || 0) + 1);
      });

      const failedProviders = providerList.filter(p => p.success === false);
      const hasWarnings = Object.values(summary.validation || {}).some(v => (v.thresholdBreached));

      if (failedProviders.length > 0) {
        statusCounts.failed += 1;
      } else if (hasWarnings) {
        statusCounts.warning += 1;
      } else {
        statusCounts.ok += 1;
      }

      recentEvents.push({
        accountName: summary.accountName || item.accountName,
        status: failedProviders.length > 0 ? 'failed' : hasWarnings ? 'warning' : 'ok',
        providers: providerList,
        generatedAt: item.summary?.generatedAt || item.ts || item.timestamp
      });
    }

    const providerActivity = Array.from(providerCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const status = statusCounts.failed > 0 ? 'failed' : statusCounts.warning > 0 ? 'warning' : 'ok';

    return {
      source: 'status-service',
      status,
      statusCounts,
      providerCounts: providerActivity,
      recentEvents,
      conflictByDomain: [],
      lineageTotals: [],
      lookbackMinutes
    };
  }

  #maybeAlertOnPipeline(summary) {
    if (!this.alertService) {
      return;
    }

    const failures = summary.statusCounts?.failed || 0;
    const warnings = summary.statusCounts?.warning || summary.statusCounts?.warn || 0;

    if (failures <= 0 && warnings <= 0) {
      return;
    }

    const severity = failures > 0 ? 'critical' : 'high';
    const title = failures > 0 ? 'Data pipeline ingestion failures detected' : 'Data pipeline quality warnings';
    const summaryText = failures > 0
      ? `${failures} ingestion runs failed in the last ${summary.lookbackMinutes} minutes.`
      : `${warnings} ingestion runs breached quality thresholds.`;

    this.alertService.sendAlert({
      severity,
      title,
      summary: summaryText,
      component: 'data-pipeline',
      dedupeKey: `data-pipeline:${severity}`,
      details: {
        statusCounts: summary.statusCounts,
        topProviders: (summary.providerCounts || []).slice(0, 3)
      }
    }).catch(error => {
      this.logger.error('Pipeline alert dispatch failed', { error: error.message });
    });
  }
}

export function createMonitoringService(config, options) {
  return new MonitoringService(config, options);
}
