const defaultMerge = (base = {}, extras = {}) => {
  const result = { ...base };
  for (const [key, value] of Object.entries(extras || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      result[key] = defaultMerge(base[key], value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

export class CompanyTemplate {
  constructor(definition) {
    if (!definition?.id) {
      throw new Error('Template id required');
    }
    this.definition = Object.freeze({
      version: definition.version || '1.0.0',
      tags: definition.tags || [],
      trustBaseline: definition.trustBaseline ?? 0.82,
      defaults: definition.defaults || {},
      personas: definition.personas || {},
      opportunityThemes: definition.opportunityThemes || [],
      riskSignals: definition.riskSignals || [],
      engagementPlaybooks: definition.engagementPlaybooks || [],
      recommendedAssets: definition.recommendedAssets || [],
      ...definition
    });
  }

  get id() {
    return this.definition.id;
  }

  get label() {
    return this.definition.label;
  }

  get industry() {
    return this.definition.industry;
  }

  get description() {
    return this.definition.description;
  }

  get version() {
    return this.definition.version;
  }

  get metadata() {
    return {
      id: this.id,
      label: this.label,
      industry: this.industry,
      version: this.version,
      description: this.description,
      tags: this.definition.tags,
      trustBaseline: this.definition.trustBaseline
    };
  }

  buildContext(accountName, overrides = {}) {
    const defaults = this.definition.defaults;
    return {
      accountName,
      industry: overrides.industry || this.industry,
      region: overrides.region || defaults.region || 'North America',
      segment: overrides.segment || defaults.segment || 'Mid-Market',
      companySize: overrides.companySize || defaults.companySize || 'Mid-Market',
      pipelineStage: overrides.pipelineStage || defaults.pipelineStage || 'Evaluation',
      strategy: defaultMerge(defaults.strategy || {}, overrides.strategy),
      lifecycle: defaultMerge(defaults.lifecycle || {}, overrides.lifecycle),
      communicationMix: defaultMerge(defaults.communicationMix || {}, overrides.communicationMix),
      productFocus: overrides.productFocus || defaults.productFocus || [],
      metrics: defaultMerge(defaults.metrics || {}, overrides.metrics),
      notes: overrides.notes || defaults.notes || ''
    };
  }

  getPersonaArchetypes(context) {
    return JSON.parse(JSON.stringify(this.definition.personas || {}));
  }

  getOpportunityThemes(context) {
    return (this.definition.opportunityThemes || []).map(item => ({ ...item }));
  }

  getRiskSignals(context) {
    return (this.definition.riskSignals || []).map(item => ({ ...item }));
  }

  getEngagementPlaybooks(context) {
    return (this.definition.engagementPlaybooks || []).map(item => ({ ...item }));
  }

  getRecommendedAssets(context) {
    return (this.definition.recommendedAssets || []).map(item => ({ ...item }));
  }

  buildSeedData(accountName, overrides = {}) {
    const context = this.buildContext(accountName, overrides);
    return {
      templateId: this.id,
      metadata: this.metadata,
      context,
      personas: this.getPersonaArchetypes(context),
      opportunityThemes: this.getOpportunityThemes(context),
      riskSignals: this.getRiskSignals(context),
      engagementPlaybooks: this.getEngagementPlaybooks(context),
      recommendedAssets: this.getRecommendedAssets(context)
    };
  }
}
