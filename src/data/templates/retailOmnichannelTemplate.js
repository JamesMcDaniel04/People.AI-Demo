import { CompanyTemplate } from './baseTemplate.js';

const definition = {
  id: 'retail_omnichannel',
  label: 'Retail Omnichannel Modernization',
  industry: 'Retail',
  description: 'Consumer retail brand aligning digital and in-store payments, loyalty, and fulfillment.',
  tags: ['retail', 'omnichannel', 'consumer'],
  trustBaseline: 0.81,
  defaults: {
    segment: 'Upper Mid-Market',
    region: 'North America',
    companySize: '500-2000 stores',
    pipelineStage: 'Business Case',
    productFocus: ['Terminal + Online', 'Identity and Risk', 'Loyalty Integrations'],
    strategy: {
      narrative: 'Deliver unified checkout across store and digital with Stripe for Retail.',
      valueDrivers: ['Higher conversion', 'Reduced fraud', 'Unified loyalty'],
      proofPoints: ['Reduced checkout abandonment by 18%', 'Shrink reduced by 12%'],
      executiveThemes: ['Customer Experience', 'Cost to Serve']
    },
    lifecycle: {
      renewalRisk: 'Low',
      expansionPotential: 'Medium',
      landDate: '2023-11-15',
      renewalDate: '2025-09-30',
      healthSignals: ['Pilot stores outperforming baseline', 'Ops champions engaged'],
      riskSignals: ['Legacy POS vendor pushing counter offers']
    },
    communicationMix: {
      email: 0.3,
      calls: 0.18,
      documents: 0.2,
      calendar: 0.12,
      crm: 0.2
    },
    metrics: {
      baselineArr: 1800000,
      growthTarget: 0.24,
      inStoreConversionLift: 0.12,
      fraudReductionTarget: 0.15
    },
    notes: 'Lean on customer experience metrics, highlight tokenization shared between channels.'
  },
  personas: {
    internalTeam: [
      { role: 'Retail Payments Strategist', focus: 'Store ops and omnichannel coordination' },
      { role: 'Risk Specialist', focus: 'Fraud, dispute rates, SCA compliance' },
      { role: 'Solutions Architect', focus: 'Integration with POS and OMS' }
    ],
    customerStakeholders: [
      { archetype: 'Chief Digital Officer', priorities: ['Customer journey', 'Omnichannel loyalty'], objections: ['Integration disruption'] },
      { archetype: 'VP Store Operations', priorities: ['Checkout speed', 'Staff enablement'], objections: ['Training overhead'] },
      { archetype: 'Head of Fraud', priorities: ['Chargeback reduction', 'Risk tooling'], objections: ['Data migration concerns'] },
      { archetype: 'CIO', priorities: ['System consolidation', 'Vendor reliability'], objections: ['Legacy system overlap'] }
    ]
  },
  opportunityThemes: [
    {
      id: 'single-customer-view',
      name: 'Unified Customer Identity',
      value: 'Tokenize across channels to power loyalty and personalized offers.',
      proofPoints: ['Time to re-order reduced by 23%'],
      priority: 'High'
    },
    {
      id: 'checkout-optimization',
      name: 'Frictionless Checkout',
      value: 'Leverage Tap to Pay + Link to reduce checkout latency.',
      proofPoints: ['Link conversion uplift of 6.8%'],
      priority: 'High'
    },
    {
      id: 'fraud-orchestration',
      name: 'Adaptive Fraud Management',
      value: 'Stripe Radar + Identity reduce false positives and manual reviews.',
      proofPoints: ['Manual review volume reduced by 35%'],
      priority: 'Medium'
    }
  ],
  riskSignals: [
    { id: 'pos-upgrade', label: 'POS upgrade dependency', severity: 'Medium', mitigation: 'Phase rollout with hybrid cloud connectors.' },
    { id: 'loyalty-migration', label: 'Legacy loyalty data quality issues', severity: 'Medium', mitigation: 'Introduce parallel run with data cleansing sprint.' },
    { id: 'operational-readiness', label: 'Store associate training gaps', severity: 'Low', mitigation: 'Deliver micro-learning assets and job aids.' }
  ],
  engagementPlaybooks: [
    {
      id: 'store-ops-cadence',
      channel: 'call',
      cadence: 'Weekly',
      persona: 'VP Store Operations',
      objective: 'Track pilot store conversion metrics and adoption.',
      recommendedTouchpoints: ['Pilot dashboard review', 'Store manager feedback loop']
    },
    {
      id: 'digital-briefings',
      channel: 'email',
      cadence: 'Bi-weekly',
      persona: 'Chief Digital Officer',
      objective: 'Share CX insights and loyalty roadmap alignment.',
      recommendedTouchpoints: ['Journey analytics snapshot', 'Upcoming feature updates']
    },
    {
      id: 'risk-roundtable',
      channel: 'calendar',
      cadence: 'Monthly',
      persona: 'Head of Fraud',
      objective: 'Align on fraud trends, tuning backlog, and KPIs.',
      recommendedTouchpoints: ['Radar tuning recap', 'Chargeback deep dive']
    }
  ],
  recommendedAssets: [
    { type: 'Checklist', title: 'Omnichannel Launch Runbook', usage: 'Program governance' },
    { type: 'Playbook', title: 'Fraud Team Enablement Guide', usage: 'Operational readiness' },
    { type: 'Case Study', title: 'Retailer Link Adoption Story', usage: 'Executive social proof' }
  ]
};

export class RetailOmnichannelTemplate extends CompanyTemplate {
  constructor() {
    super(definition);
  }
}
