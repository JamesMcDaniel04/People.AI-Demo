import { createHash } from 'crypto';

const DEFAULT_PRIORITY = ['klavis', 'sample', 'news', 'external'];
const DEFAULT_RECENCY_TOLERANCE_MS = 30_000;

export class ConflictResolutionService {
  constructor(config = {}) {
    const configured = config?.data?.pipeline?.sourcePriority;
    this.priorityOrder = Array.isArray(configured) && configured.length > 0 ? configured : DEFAULT_PRIORITY;
    this.priorityMap = new Map(this.priorityOrder.map((name, index) => [String(name).toLowerCase(), index]));
    this.recencyToleranceMs = Number(config?.data?.pipeline?.recencyToleranceMs || DEFAULT_RECENCY_TOLERANCE_MS);
  }

  resolve(domain, records = []) {
    if (domain === 'accountInfo') {
      return this.resolveAccountInfo(records);
    }

    const winners = new Map();
    const conflicts = [];

    for (const rawEntry of records) {
      const entry = this.ensureNormalized(domain, rawEntry);
      if (!entry.identifier) {
        continue;
      }

      const existing = winners.get(entry.identifier);
      if (!existing) {
        winners.set(entry.identifier, entry);
        continue;
      }

      const decision = this.compare(existing, entry);
      if (decision.winner === 'incoming') {
        conflicts.push({
          domain,
          identifier: entry.identifier,
          chosen: entry.provider,
          discarded: existing.provider,
          reason: decision.reason
        });
        winners.set(entry.identifier, {
          ...entry,
          mergedFrom: this.mergeOrigins(existing, entry)
        });
      } else {
        conflicts.push({
          domain,
          identifier: entry.identifier,
          chosen: existing.provider,
          discarded: entry.provider,
          reason: decision.reason
        });
        winners.set(entry.identifier, {
          ...existing,
          mergedFrom: this.mergeOrigins(existing, entry)
        });
      }
    }

    return {
      records: Array.from(winners.values()),
      conflicts
    };
  }

  resolveAccountInfo(records = []) {
    if (records.length === 0) {
      return { records: [], conflicts: [] };
    }

    // Sort by priority then recency (newest last so reduceRight works)
    const sorted = records
      .map(entry => this.ensureNormalized('accountInfo', entry))
      .sort((a, b) => {
        const priorityDiff = this.getPriority(a.provider) - this.getPriority(b.provider);
        if (priorityDiff !== 0) return priorityDiff;
        return (a.timestamp || 0) - (b.timestamp || 0);
      });

    const merged = {};
    const provenance = [];

    for (const entry of sorted) {
      provenance.push({ provider: entry.provider, source: entry.source, timestamp: entry.timestamp });
      for (const [key, value] of Object.entries(entry.record || {})) {
        if (value === undefined || value === null || value === '') continue;
        if (merged[key] === undefined || merged[key] === null || merged[key] === '') {
          merged[key] = value;
          continue;
        }

        const decision = this.compareField(merged[key], value, entry);
        if (decision.replace) {
          merged[key] = value;
        }
      }
    }

    const identifier = sorted[0]?.identifier || this.generateFallbackIdentifier('accountInfo', merged, sorted[0]);

    return {
      records: [
        {
          provider: provenance[provenance.length - 1]?.provider || sorted[0]?.provider || 'aggregated',
          source: 'aggregated_account',
          domain: 'accountInfo',
          identifier,
          timestamp: provenance[provenance.length - 1]?.timestamp || Date.now(),
          checksum: this.computeChecksum(merged),
          record: merged,
          mergedFrom: provenance
        }
      ],
      conflicts: []
    };
  }

  compare(existing, incoming) {
    const { timestamp: tsA = 0 } = existing;
    const { timestamp: tsB = 0 } = incoming;

    if (tsA && tsB) {
      const diff = tsB - tsA;
      if (Math.abs(diff) > this.recencyToleranceMs) {
        return diff > 0
          ? { winner: 'incoming', reason: 'newer_record' }
          : { winner: 'existing', reason: 'newer_record' };
      }
    }

    const priorityA = this.getPriority(existing.provider);
    const priorityB = this.getPriority(incoming.provider);

    if (priorityA !== priorityB) {
      return priorityB < priorityA
        ? { winner: 'incoming', reason: 'source_priority' }
        : { winner: 'existing', reason: 'source_priority' };
    }

    const qualityA = existing.qualityScore ?? 1;
    const qualityB = incoming.qualityScore ?? 1;
    if (qualityA !== qualityB) {
      return qualityB > qualityA
        ? { winner: 'incoming', reason: 'quality_score' }
        : { winner: 'existing', reason: 'quality_score' };
    }

    if (existing.checksum !== incoming.checksum) {
      return tsB >= tsA
        ? { winner: 'incoming', reason: 'checksum_change' }
        : { winner: 'existing', reason: 'checksum_change' };
    }

    return { winner: 'existing', reason: 'stable' };
  }

  compareField(currentValue, incomingValue, incomingEntry) {
    if (currentValue === incomingValue) {
      return { replace: false };
    }

    if (incomingEntry && typeof incomingValue === 'string' && incomingValue.length > 0) {
      const priorityIncoming = this.getPriority(incomingEntry.provider);
      if (priorityIncoming === 0) {
        return { replace: true, reason: 'higher_priority_source' };
      }
    }

    return { replace: false };
  }

  ensureNormalized(domain, entry) {
    if (entry.identifier && entry.timestamp && entry.checksum) {
      return entry;
    }

    const provider = String(entry.provider || entry.source || 'unknown').toLowerCase();
    const record = entry.record || entry;
    const identifier = entry.identifier || this.generateIdentifier(domain, record, provider);

    return {
      ...entry,
      provider,
      identifier,
      checksum: entry.checksum || this.computeChecksum(record),
      timestamp: this.extractTimestamp(domain, record),
      record,
      mergedFrom: entry.mergedFrom || []
    };
  }

  generateIdentifier(domain, record, provider) {
    if (!record || typeof record !== 'object') {
      return null;
    }

    if (record.id) return String(record.id);
    if (record.identifier) return String(record.identifier);

    if (domain === 'emails') {
      if (record.thread_id) return String(record.thread_id);
      if (record.subject && record.date) return `${record.subject}:${record.date}`;
    }

    if (domain === 'calls') {
      if (record.callId) return String(record.callId);
      if (record.date && Array.isArray(record.participants)) {
        return `${record.date}:${record.participants.join('|')}`;
      }
    }

    if (domain === 'stakeholders') {
      if (record.email) return record.email.toLowerCase();
      if (record.name) return `${record.name.toLowerCase()}:${record.role || 'role'}`;
    }

    if (domain === 'documents') {
      if (record.title && record.date) return `${record.title}:${record.date}`;
      if (record.title) return `${record.title}:${provider}`;
    }

    if (domain === 'calendar') {
      if (record.id) return String(record.id);
      if (record.start && record.title) return `${record.start}:${record.title}`;
    }

    if (domain === 'crm') {
      if (record.opportunityId) return String(record.opportunityId);
      if (record.stage && record.value) return `${record.stage}:${record.value}`;
    }

    return this.generateFallbackIdentifier(domain, record, { provider });
  }

  generateFallbackIdentifier(domain, record, context = {}) {
    const base = `${domain}:${context.provider || 'unknown'}:${Date.now()}`;
    return `${base}:${this.computeChecksum(record).slice(0, 12)}`;
  }

  extractTimestamp(domain, record) {
    const dateCandidate = record?.date || record?.timestamp || record?.lastUpdated || record?.start;
    const value = dateCandidate ? Date.parse(dateCandidate) : NaN;
    return Number.isNaN(value) ? Date.now() : value;
  }

  computeChecksum(payload) {
    try {
      const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
      return createHash('sha1').update(serialized).digest('hex');
    } catch (e) {
      return createHash('sha1').update(String(payload)).digest('hex');
    }
  }

  getPriority(provider) {
    const key = String(provider || '').toLowerCase();
    if (this.priorityMap.has(key)) {
      return this.priorityMap.get(key);
    }
    // Prioritise configured providers; unknown providers get lower priority by default
    const fallbackIndex = this.priorityOrder.length;
    this.priorityMap.set(key, fallbackIndex);
    return fallbackIndex;
  }

  mergeOrigins(existing, incoming) {
    const sources = new Map();
    const list = [...(existing.mergedFrom || []), ...(incoming.mergedFrom || [])];
    for (const item of list) {
      const key = `${item.provider}:${item.source}`;
      sources.set(key, item);
    }
    sources.set(`${existing.provider}:${existing.source || existing.domain}`, {
      provider: existing.provider,
      source: existing.source || existing.domain,
      timestamp: existing.timestamp
    });
    sources.set(`${incoming.provider}:${incoming.source || incoming.domain}`, {
      provider: incoming.provider,
      source: incoming.source || incoming.domain,
      timestamp: incoming.timestamp
    });
    return Array.from(sources.values());
  }
}
