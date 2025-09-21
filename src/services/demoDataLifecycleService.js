const cadenceDays = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  'bi-weekly': 14,
  monthly: 30,
  quarterly: 90
};

export class DemoDataLifecycleService {
  constructor(config = {}) {
    this.config = config;
    this.cache = new Map();
    const defaultCadence = config.demo?.lifecycle?.defaultCadenceDays || config.demo?.quality?.freshnessWindowDays || 14;
    this.defaultCadenceDays = Number(defaultCadence) || 14;
    this.retentionDays = Number(config.demo?.dataset?.retentionDays || 90);
  }

  shouldRefresh(accountName, dataset) {
    if (!dataset) {
      return true;
    }
    const record = this.cache.get(accountName);
    const now = Date.now();
    const nextRefresh = record?.nextRefresh ?? this.calculateNextRefresh(dataset).getTime();
    if (now >= nextRefresh) {
      return true;
    }
    const expiresAt = record?.expiresAt ?? this.calculateExpiry(dataset).getTime();
    return now >= expiresAt;
  }

  markRefreshed(accountName, dataset) {
    const nextRefreshDate = this.calculateNextRefresh(dataset);
    const expiresAtDate = this.calculateExpiry(dataset);
    const record = {
      nextRefresh: nextRefreshDate.getTime(),
      expiresAt: expiresAtDate.getTime(),
      lastGeneratedAt: new Date(dataset?.metadata?.generatedAt || Date.now()).getTime()
    };
    this.cache.set(accountName, record);
    return {
      nextRefresh: nextRefreshDate.toISOString(),
      expiresAt: expiresAtDate.toISOString()
    };
  }

  calculateNextRefresh(dataset) {
    const cadence = dataset?.datasetConfig?.refresh?.cadence;
    const days = cadenceDays[cadence] || this.defaultCadenceDays;
    const generatedAt = new Date(dataset?.metadata?.generatedAt || Date.now());
    return new Date(generatedAt.getTime() + days * 24 * 60 * 60 * 1000);
  }

  calculateExpiry(dataset) {
    const policy = dataset?.datasetConfig?.refresh?.policy;
    const match = typeof policy === 'string' ? policy.match(/([0-9]{2,})/) : null;
    const days = match ? Number(match[1]) : this.retentionDays;
    const generatedAt = new Date(dataset?.metadata?.generatedAt || Date.now());
    return new Date(generatedAt.getTime() + days * 24 * 60 * 60 * 1000);
  }
}
