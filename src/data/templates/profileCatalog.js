const clone = (value) => JSON.parse(JSON.stringify(value));

const profiles = [
  {
    id: 'enterprise-saas-expansion',
    name: 'Enterprise SaaS Expansion',
    industry: 'Technology',
    description: 'Global SaaS platform consolidating payments, billing, and revenue intelligence.',
    templateId: 'tech_saas_expansion',
    defaults: {
      region: 'North America',
      pipelineStage: 'Negotiation',
      communicationMix: { email: 0.36, calls: 0.22, documents: 0.16, calendar: 0.1, crm: 0.16 },
      strategy: {
        executiveThemes: ['Operational efficiency', 'Platform scale'],
        valueDrivers: ['Developer velocity', 'Consolidated analytics']
      },
      lifecycle: {
        renewalRisk: 'Medium',
        expansionPotential: 'Very High'
      }
    },
    datasetConfig: {
      interactionDensity: 'high',
      timelineMonths: 9,
      personas: 8,
      anonymize: true,
      trustTarget: 0.9,
      refresh: { cadence: 'weekly', policy: 'rolling-90-days' }
    }
  },
  {
    id: 'retail-omni-modernization',
    name: 'Retail Omnichannel Modernization',
    industry: 'Retail',
    description: 'Retail brand aligning store and digital checkouts with Stripe Terminal + Link.',
    templateId: 'retail_omnichannel',
    defaults: {
      region: 'North America',
      pipelineStage: 'Business Case',
      communicationMix: { email: 0.28, calls: 0.18, documents: 0.22, calendar: 0.14, crm: 0.18 },
      lifecycle: {
        renewalRisk: 'Low',
        expansionPotential: 'Medium'
      }
    },
    datasetConfig: {
      interactionDensity: 'medium',
      timelineMonths: 6,
      personas: 7,
      anonymize: true,
      trustTarget: 0.84,
      refresh: { cadence: 'biweekly', policy: 'rolling-60-days' }
    }
  },
  {
    id: 'healthcare-trust-network',
    name: 'Healthcare Platform Trust Network',
    industry: 'Healthcare',
    description: 'Healthcare SaaS enhancing patient billing, provider onboarding, and compliance.',
    templateId: 'healthcare_platform',
    defaults: {
      region: 'United States',
      pipelineStage: 'Security Review',
      communicationMix: { email: 0.4, calls: 0.2, documents: 0.2, calendar: 0.1, crm: 0.1 },
      lifecycle: {
        renewalRisk: 'Medium',
        expansionPotential: 'High'
      }
    },
    datasetConfig: {
      interactionDensity: 'high',
      timelineMonths: 10,
      personas: 9,
      anonymize: true,
      trustTarget: 0.88,
      refresh: { cadence: 'monthly', policy: 'rolling-120-days' }
    }
  },
  {
    id: 'banking-modernization',
    name: 'Banking Modernization Program',
    industry: 'Financial Services',
    description: 'Tier 1 bank modernizing treasury, issuing, and KYB onboarding.',
    templateId: 'financial_services_modernization',
    defaults: {
      region: 'Global',
      pipelineStage: 'Pilot',
      communicationMix: { email: 0.26, calls: 0.26, documents: 0.22, calendar: 0.12, crm: 0.14 },
      lifecycle: {
        renewalRisk: 'Medium',
        expansionPotential: 'Very High'
      }
    },
    datasetConfig: {
      interactionDensity: 'medium-high',
      timelineMonths: 12,
      personas: 10,
      anonymize: true,
      trustTarget: 0.86,
      refresh: { cadence: 'monthly', policy: 'rolling-180-days' }
    }
  },
  {
    id: 'scaleup-growth-acceleration',
    name: 'Digital Native Scale-Up Growth',
    industry: 'Technology',
    description: 'High growth scale-up optimizing conversion and international expansion.',
    templateId: 'tech_saas_expansion',
    defaults: {
      region: 'EMEA',
      pipelineStage: 'Evaluation',
      communicationMix: { email: 0.4, calls: 0.2, documents: 0.15, calendar: 0.08, crm: 0.17 },
      lifecycle: {
        renewalRisk: 'Low',
        expansionPotential: 'High'
      },
      strategy: {
        executiveThemes: ['Launch velocity', 'Reduced complexity']
      }
    },
    datasetConfig: {
      interactionDensity: 'medium',
      timelineMonths: 7,
      personas: 6,
      anonymize: true,
      trustTarget: 0.85,
      refresh: { cadence: 'biweekly', policy: 'rolling-75-days' }
    }
  }
];

const index = new Map(profiles.map(profile => [profile.id, profile]));

export const profileCatalog = {
  list() {
    return profiles.map(profile => clone(profile));
  },
  get(profileId) {
    const profile = index.get(profileId);
    return profile ? clone(profile) : null;
  },
  findByIndustry(industry) {
    return profiles.filter(profile => profile.industry.toLowerCase() === String(industry || '').toLowerCase()).map(profile => clone(profile));
  },
  has(profileId) {
    return index.has(profileId);
  }
};
