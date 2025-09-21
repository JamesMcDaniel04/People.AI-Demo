import { templateRegistry } from './templateRegistry.js';
import { profileCatalog } from './profileCatalog.js';

const mergeObjects = (base = {}, extras = {}) => {
  const result = { ...base };
  for (const [key, value] of Object.entries(extras || {})) {
    if (Array.isArray(value)) {
      result[key] = value.slice();
    } else if (value && typeof value === 'object') {
      result[key] = mergeObjects(base[key] || {}, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const DEFAULT_PROFILE_ID = 'enterprise-saas-expansion';

export class TemplateManager {
  constructor(options = {}) {
    this.options = options;
    this.defaultProfileId = options.defaultProfileId || process.env.DEMO_DEFAULT_PROFILE || DEFAULT_PROFILE_ID;
  }

  listTemplates() {
    return templateRegistry.listMetadata();
  }

  listProfiles() {
    return profileCatalog.list();
  }

  getProfile(profileId) {
    if (!profileId) return null;
    return profileCatalog.get(profileId);
  }

  getProfilesByIndustry(industry) {
    if (!industry) return [];
    return profileCatalog.findByIndustry(industry);
  }

  getTemplate(templateId) {
    const template = templateRegistry.get(templateId);
    return template ? template : null;
  }

  resolveProfile(preferredId, industry) {
    if (preferredId && profileCatalog.has(preferredId)) {
      return profileCatalog.get(preferredId);
    }
    if (industry) {
      const matches = profileCatalog.findByIndustry(industry);
      if (matches.length > 0) {
        return matches[0];
      }
    }
    if (profileCatalog.has(this.defaultProfileId)) {
      return profileCatalog.get(this.defaultProfileId);
    }
    const all = profileCatalog.list();
    return all.length > 0 ? all[0] : null;
  }

  buildSeed(accountName, options = {}) {
    const { profileId, industry, overrides = {} } = options;
    const profile = this.resolveProfile(profileId, industry);
    if (!profile) {
      throw new Error('No matching profile available');
    }

    const template = templateRegistry.get(profile.templateId);
    if (!template) {
      throw new Error(`Template not found: ${profile.templateId}`);
    }

    const combinedOverrides = mergeObjects(profile.defaults || {}, overrides);
    const seed = template.buildSeedData(accountName, combinedOverrides);

    return {
      ...seed,
      profile: {
        id: profile.id,
        name: profile.name,
        industry: profile.industry,
        description: profile.description
      },
      datasetConfig: clone(profile.datasetConfig || {})
    };
  }

  getProfileDatasetConfig(profileId) {
    const profile = this.getProfile(profileId) || this.resolveProfile(profileId);
    return profile?.datasetConfig ? clone(profile.datasetConfig) : null;
  }
}
