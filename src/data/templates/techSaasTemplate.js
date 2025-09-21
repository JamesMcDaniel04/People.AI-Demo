import { CompanyTemplate } from './baseTemplate.js';

const definition = {
  id: 'tech_saas_expansion',
  label: 'Tech SaaS Expansion Play',
  industry: 'Technology',
  description: 'Enterprise SaaS platform consolidating global payments and billing workflows.',
  tags: ['saas', 'platform', 'enterprise'],
  trustBaseline: 0.87,
  defaults: {
    segment: 'Enterprise',
    region: 'North America',
    companySize: '1000-5000 employees',
    pipelineStage: 'Evaluation',
    productFocus: ['Unified Payments', 'Billing Automation', 'Revenue Intelligence'],
    strategy: {
      narrative: 'Stripe helps streamline expansion by consolidating payments, billing, and compliance.',
      valueDrivers: ['Faster regional launches', 'Lower total cost of ownership', 'Improved conversion'],
      proofPoints: ['Global enterprise expanded to 35 markets in 6 months', 'Reduced failed payments by 28%'],
      executiveThemes: ['Operational Efficiency', 'Developer Velocity']
    },
    lifecycle: {
      renewalRisk: 'Medium',
      expansionPotential: 'High',
      landDate: '2024-02-01',
      renewalDate: '2025-12-31',
      healthSignals: ['Strong technical alignment', 'Executive sponsor engaged'],
      riskSignals: ['Fragmented regional stack', 'Manual billing workflows']
    },
    communicationMix: {
      email: 0.35,
      calls: 0.22,
      documents: 0.18,
      calendar: 0.1,
      crm: 0.15
    },
    metrics: {
      baselineArr: 2400000,
      growthTarget: 0.32,
      conversionTarget: 0.67,
      supportTickets: 'Moderate'
    },
    notes: 'Emphasize API-first differentiation, compliance guardrails, and co-selling with cloud partners.'
  },
  personas: {
    internalTeam: [
      { role: 'Account Executive', focus: 'Executive alignment and commercial strategy' },
      { role: 'Solutions Architect', focus: 'API integration and technical validation' },
      { role: 'Customer Success Lead', focus: 'Adoption, success metrics, enablement' }
    ],
    customerStakeholders: [
      { archetype: 'CFO', priorities: ['Revenue visibility', 'Risk mitigation', 'Cash flow'], objections: ['Implementation effort', 'Compliance risk'] },
      { archetype: 'CTO', priorities: ['Platform reliability', 'Developer productivity'], objections: ['Migration complexity'] },
      { archetype: 'Head of Product', priorities: ['Global launch velocity', 'UX consistency'], objections: ['Time to value'] },
      { archetype: 'Payments Ops Lead', priorities: ['Risk monitoring', 'Chargeback reduction'], objections: ['Operational change management'] }
    ]
  },
  opportunityThemes: [
    {
      id: 'global-expansion',
      name: 'Global Market Expansion',
      value: 'Launch Stripe payments in emerging regions with unified reporting.',
      proofPoints: ['Stripe supports 195 countries with local methods'],
      priority: 'High'
    },
    {
      id: 'billing-automation',
      name: 'Automate Subscription Billing',
      value: 'Reduce manual invoicing and failed payments with Billing + Revenue Recognition.',
      proofPoints: ['Improved DSO by 19% for a comparable SaaS peer'],
      priority: 'Medium'
    },
    {
      id: 'data-platform',
      name: 'Revenue Intelligence',
      value: 'Provide real-time ARR dashboards and cohort analytics.',
      proofPoints: ['Forecast accuracy improved by 14%'],
      priority: 'Medium'
    }
  ],
  riskSignals: [
    { id: 'compliance-gap', label: 'Compliance review backlog', severity: 'Medium', mitigation: 'Align legal review with Stripe compliance specialists.' },
    { id: 'integration-fatigue', label: 'Engineering bandwidth constraints', severity: 'High', mitigation: 'Provide professional services and phased rollout plan.' },
    { id: 'procurement-delay', label: 'Procurement timeline risk', severity: 'Medium', mitigation: 'Engage executive sponsor to accelerate legal review.' }
  ],
  engagementPlaybooks: [
    {
      id: 'executive-cadence',
      channel: 'email',
      cadence: 'Bi-weekly',
      persona: 'CFO',
      objective: 'Maintain executive alignment on ROI milestones.',
      recommendedTouchpoints: ['Executive summary email', 'Quarterly business review invite', 'ROI tracker update']
    },
    {
      id: 'technical-validation',
      channel: 'call',
      cadence: 'Weekly',
      persona: 'CTO',
      objective: 'Progress API integration and sandbox validation.',
      recommendedTouchpoints: ['Architecture workshop', 'Security review', 'Performance testing recap']
    },
    {
      id: 'product-workshops',
      channel: 'calendar',
      cadence: 'Bi-weekly',
      persona: 'Head of Product',
      objective: 'Design unified checkout experience and A/B roadmap.',
      recommendedTouchpoints: ['Design session', 'Localization workshop']
    }
  ],
  recommendedAssets: [
    { type: 'Deck', title: 'Global Expansion Playbook', usage: 'Executive briefing' },
    { type: 'One-Pager', title: 'Stripe Billing ROI Overview', usage: 'Finance validation' },
    { type: 'Case Study', title: 'Enterprise SaaS 35 Market Launch', usage: 'Proof for GTM leaders' }
  ]
};

export class TechSaasTemplate extends CompanyTemplate {
  constructor() {
    super(definition);
  }
}
