const densityTargets = {
  high: 16,
  'medium-high': 12,
  medium: 9,
  low: 6
};

const cadenceDaysMap = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  'bi-weekly': 14,
  monthly: 30,
  quarterly: 90
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const slugify = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'account';

export class DemoDataQualityService {
  constructor(config = {}) {
    this.config = config;
    this.targetScore = Number(config.demo?.quality?.targetScore || 85);
    const baselineWeight = config.demo?.quality?.baselineWeight;
    this.baselineWeight = typeof baselineWeight === 'number'
      ? baselineWeight
      : Math.min(0.8, Math.max(0.2, Number(baselineWeight) || 0.4));
    this.defaultFreshnessDays = Number(config.demo?.quality?.freshnessWindowDays || 14);
  }

  evaluate(dataset) {
    if (!dataset) {
      return this.emptyResult();
    }

    const baseline = typeof dataset?.metadata?.trustBaseline === 'number'
      ? dataset.metadata.trustBaseline
      : 0.8;

    const completeness = this.computeCompleteness(dataset);
    const freshness = this.computeFreshness(dataset);
    const consistency = this.computeConsistency(dataset);

    const computedAverage = (completeness.normalized * 0.4) + (freshness.normalized * 0.3) + (consistency.normalized * 0.3);
    const overallNormalized = clamp(
      (baseline * this.baselineWeight) + (computedAverage * (1 - this.baselineWeight)),
      0,
      1
    );
    const overallScore = Number((overallNormalized * 100).toFixed(1));

    const quality = {
      overall: {
        score: overallScore,
        normalized: Number(overallNormalized.toFixed(3)),
        status: this.status(overallScore)
      },
      components: {
        completeness,
        freshness,
        consistency
      },
      baseline: Number((baseline * 100).toFixed(1)),
      target: this.targetScore,
      issues: [].concat(completeness.issues, freshness.issues, consistency.issues)
    };

    return quality;
  }

  computeCompleteness(dataset) {
    const density = dataset?.datasetConfig?.interactionDensity || 'medium';
    const base = densityTargets[density] || densityTargets.medium;
    const actuals = {
      emails: dataset?.emails?.length || 0,
      calls: dataset?.calls?.length || 0,
      documents: dataset?.documents?.length || 0,
      calendar: dataset?.calendar?.length || 0,
      crm: dataset?.crm?.length || 0
    };
    const targets = {
      emails: Math.max(5, Math.round(base * 0.7)),
      calls: Math.max(3, Math.round(base * 0.3)),
      documents: 3,
      calendar: 3,
      crm: 1
    };

    const ratios = Object.keys(actuals).map(key => {
      const ratio = targets[key] === 0 ? 1 : actuals[key] / targets[key];
      return clamp(ratio, 0, 1);
    });
    const normalized = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;

    const issues = [];
    Object.keys(actuals).forEach(key => {
      if (actuals[key] < targets[key]) {
        issues.push(`Insufficient ${key}: ${actuals[key]} of ${targets[key]} expected.`);
      }
    });

    return {
      score: Number((normalized * 100).toFixed(1)),
      normalized: Number(normalized.toFixed(3)),
      actuals,
      targets,
      issues
    };
  }

  computeFreshness(dataset) {
    const lastActivity = dataset?.accountInfo?.lastActivity ? new Date(dataset.accountInfo.lastActivity) : null;
    const generatedAt = dataset?.metadata?.generatedAt ? new Date(dataset.metadata.generatedAt) : null;
    const referenceDate = generatedAt || lastActivity || new Date();
    const now = new Date();
    const ageMs = now.getTime() - referenceDate.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    const cadence = dataset?.datasetConfig?.refresh?.cadence;
    const cadenceWindow = cadenceDaysMap[cadence] || this.defaultFreshnessDays;
    const normalized = clamp(1 - (ageDays / cadenceWindow), 0, 1);

    const issues = [];
    if (ageDays > cadenceWindow) {
      issues.push(`Data is stale: ${ageDays.toFixed(1)} days old (cadence ${cadenceWindow} days).`);
    }

    return {
      score: Number((normalized * 100).toFixed(1)),
      normalized: Number(normalized.toFixed(3)),
      ageDays: Number(ageDays.toFixed(1)),
      cadenceDays: cadenceWindow,
      issues
    };
  }

  computeConsistency(dataset) {
    const accountInfo = dataset?.accountInfo || {};
    const crm = dataset?.crm?.[0] || {};
    const profile = dataset?.profile || {};

    const checks = [];
    const issues = [];

    checks.push(this.compare(accountInfo.industry, profile.industry, 'Industry mismatch', issues));
    checks.push(this.compare(accountInfo.stage, crm.stage, 'Pipeline stage mismatch', issues));
    checks.push(this.checkArray(dataset?.stakeholders, 'Stakeholders missing', issues));
    checks.push(this.checkArray(dataset?.emails, 'Email threads missing', issues));
    checks.push(this.checkArray(dataset?.calls, 'Call records missing', issues));

    const valid = checks.filter(Boolean).length;
    const normalized = checks.length === 0 ? 1 : clamp(valid / checks.length, 0, 1);

    return {
      score: Number((normalized * 100).toFixed(1)),
      normalized: Number(normalized.toFixed(3)),
      issues
    };
  }

  compare(value, expected, issueMessage, issues) {
    if (!value || !expected) {
      return false;
    }
    if (String(value).toLowerCase() !== String(expected).toLowerCase()) {
      issues.push(`${issueMessage}: expected "${expected}" got "${value}".`);
      return false;
    }
    return true;
  }

  checkArray(arr, issueMessage, issues) {
    if (!Array.isArray(arr) || arr.length === 0) {
      issues.push(issueMessage);
      return false;
    }
    return true;
  }

  status(score) {
    if (score >= this.targetScore) return 'green';
    if (score >= this.targetScore - 10) return 'yellow';
    return 'red';
  }

  emptyResult() {
    return {
      overall: { score: 0, normalized: 0, status: 'red' },
      components: {
        completeness: { score: 0, normalized: 0, issues: ['No dataset provided'] },
        freshness: { score: 0, normalized: 0, issues: ['No dataset provided'] },
        consistency: { score: 0, normalized: 0, issues: ['No dataset provided'] }
      },
      baseline: 0,
      target: this.targetScore,
      issues: ['Dataset missing']
    };
  }
}

export const slugAccount = slugify;
