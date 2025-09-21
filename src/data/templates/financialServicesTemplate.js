import { CompanyTemplate } from './baseTemplate.js';

const definition = {
  id: 'financial_services_modernization',
  label: 'Financial Services Modernization',
  industry: 'Financial Services',
  description: 'Modern bank digitizing onboarding, lending, and treasury payments experiences.',
  tags: ['financial-services', 'banking', 'payments'],
  trustBaseline: 0.83,
  defaults: {
    segment: 'Enterprise',
    region: 'Global',
    companySize: 'Tier 1 bank',
    pipelineStage: 'Pilot',
    productFocus: ['Treasury', 'Issuing', 'KYC/KYB'],
    strategy: {
      narrative: 'Stripe modernizes legacy banking workflows with real-time onboarding and payouts.',
      valueDrivers: ['Faster merchant onboarding', 'Reduced operational cost', 'Innovation velocity'],
      proofPoints: ['Digital onboarding time reduced from days to minutes', 'Operational expense savings of 18%'],
      executiveThemes: ['Regulatory agility', 'Platform innovation']
    },
    lifecycle: {
      renewalRisk: 'Medium',
      expansionPotential: 'Very High',
      landDate: '2024-06-05',
      renewalDate: '2026-06-30',
      healthSignals: ['Innovation lab sponsoring rollout', 'Treasury ops engagement high'],
      riskSignals: ['Legacy compliance process backlog']
    },
    communicationMix: {
      email: 0.28,
      calls: 0.25,
      documents: 0.2,
      calendar: 0.1,
      crm: 0.17
    },
    metrics: {
      baselineArr: 4100000,
      growthTarget: 0.35,
      onboardingTimeReduction: 0.65,
      operationalCostSavings: 0.18
    },
    notes: 'Leverage compliance references, emphasize resiliency and regional coverage.'
  },
  personas: {
    internalTeam: [
      { role: 'Industry Principal', focus: 'Bank transformation and regulatory roadmap' },
      { role: 'Solutions Architect', focus: 'Core banking integration, resiliency' },
      { role: 'Program Manager', focus: 'Pilot rollout, executive comms' }
    ],
    customerStakeholders: [
      { archetype: 'Chief Digital Officer', priorities: ['Digital onboarding', 'Fintech competition'], objections: ['Vendor lock-in'] },
      { archetype: 'Head of Compliance', priorities: ['Regulatory adherence', 'Auditability'], objections: ['Data residency'] },
      { archetype: 'Treasury Operations Lead', priorities: ['Operational efficiency', 'Visibility'], objections: ['Change management'] },
      { archetype: 'CIO', priorities: ['Core integration', 'Security posture'], objections: ['Legacy dependencies'] }
    ]
  },
  opportunityThemes: [
    {
      id: 'digital-onboarding',
      name: 'Digital Merchant Onboarding',
      value: 'Automate KYC/KYB with instant decisioning and pre-built workflows.',
      proofPoints: ['Onboarding cycle down 72% for comparable bank'],
      priority: 'High'
    },
    {
      id: 'treasury-modernization',
      name: 'Treasury Modernization',
      value: 'Real-time payouts, reconciliation, and cash visibility using Stripe Treasury.',
      proofPoints: ['Payment operations cost reduced 21%'],
      priority: 'Medium'
    },
    {
      id: 'card-issuing',
      name: 'Card Issuing Innovation',
      value: 'Launch instant issue commercial cards with granular controls.',
      proofPoints: ['Time to launch new card program cut from 12 to 4 months'],
      priority: 'Medium'
    }
  ],
  riskSignals: [
    { id: 'regulatory-oversight', label: 'Central bank regulatory oversight timeline', severity: 'High', mitigation: 'Align regulatory workshops with Stripe policy team.' },
    { id: 'core-integration', label: 'Core banking integration complexity', severity: 'Medium', mitigation: 'Sequence integration through ISO 20022 connectors and pilots.' },
    { id: 'change-management', label: 'Operations change resistance', severity: 'Medium', mitigation: 'Introduce training academy and executive sponsorship plan.' }
  ],
  engagementPlaybooks: [
    {
      id: 'regulatory-steering',
      channel: 'calendar',
      cadence: 'Monthly',
      persona: 'Head of Compliance',
      objective: 'Progress regulatory alignment with formal checkpoints.',
      recommendedTouchpoints: ['Policy alignment review', 'Audit readiness workshop']
    },
    {
      id: 'innovation-sprint',
      channel: 'call',
      cadence: 'Weekly',
      persona: 'Chief Digital Officer',
      objective: 'Drive sprint outcomes for digital onboarding pilots.',
      recommendedTouchpoints: ['Sprint planning', 'Retrospective', 'Product showcase']
    },
    {
      id: 'ops-scorecard',
      channel: 'email',
      cadence: 'Bi-weekly',
      persona: 'Treasury Operations Lead',
      objective: 'Share KPIs, incident status, and optimization backlog.',
      recommendedTouchpoints: ['Operational scorecard', 'Incident summary', 'Next iteration plan']
    }
  ],
  recommendedAssets: [
    { type: 'Workbook', title: 'Bank Modernization Blueprint', usage: 'Program planning' },
    { type: 'Whitepaper', title: 'Stripe Compliance Controls Overview', usage: 'Regulatory validation' },
    { type: 'Case Study', title: 'Tier 1 Bank Digital Transformation', usage: 'Executive proof' }
  ]
};

export class FinancialServicesTemplate extends CompanyTemplate {
  constructor() {
    super(definition);
  }
}
