import { CompanyTemplate } from './baseTemplate.js';

const definition = {
  id: 'healthcare_platform',
  label: 'Healthcare Platform Trust Network',
  industry: 'Healthcare',
  description: 'Healthcare SaaS modernizing patient payments, compliance, and provider experience.',
  tags: ['healthcare', 'compliance', 'platform'],
  trustBaseline: 0.85,
  defaults: {
    segment: 'Enterprise',
    region: 'United States',
    companySize: '5000+ providers onboarded',
    pipelineStage: 'Security Review',
    productFocus: ['Payments + Identity', 'Billing Automation', 'Embedded Financing'],
    strategy: {
      narrative: 'Stripe enables compliant, secure patient experiences across providers and payers.',
      valueDrivers: ['Faster patient collections', 'HIPAA compliant workflows', 'Provider satisfaction'],
      proofPoints: ['Reduced bad debt by 22%', 'Time to payout down to 2 days'],
      executiveThemes: ['Regulatory Compliance', 'Patient Experience']
    },
    lifecycle: {
      renewalRisk: 'Medium',
      expansionPotential: 'High',
      landDate: '2024-03-12',
      renewalDate: '2026-03-31',
      healthSignals: ['Security champion active', 'Pilot provider NPS positive'],
      riskSignals: ['Legal review backlog around data residency']
    },
    communicationMix: {
      email: 0.38,
      calls: 0.2,
      documents: 0.18,
      calendar: 0.12,
      crm: 0.12
    },
    metrics: {
      baselineArr: 3200000,
      growthTarget: 0.28,
      patientCollectionTarget: 0.25,
      providerAdoptionGoal: 0.6
    },
    notes: 'Highlight compliance posture, HITRUST, and patient experience metrics.'
  },
  personas: {
    internalTeam: [
      { role: 'Healthcare Strategist', focus: 'Compliance and provider workflows' },
      { role: 'Security Architect', focus: 'Data residency, HIPAA scopes' },
      { role: 'Implementation Lead', focus: 'Provider onboarding and change management' }
    ],
    customerStakeholders: [
      { archetype: 'Chief Compliance Officer', priorities: ['HIPAA, PCI scope reduction'], objections: ['Data retention policies'] },
      { archetype: 'VP Revenue Cycle', priorities: ['Collections speed', 'Automation'], objections: ['Provider disruption'] },
      { archetype: 'Chief Medical Officer', priorities: ['Provider experience', 'Patient satisfaction'], objections: ['Change fatigue'] },
      { archetype: 'CIO', priorities: ['Security posture', 'Integration velocity'], objections: ['Legacy EHR coupling'] }
    ]
  },
  opportunityThemes: [
    {
      id: 'secure-payments',
      name: 'Secure Patient Payments',
      value: 'Accelerate patient collections with verified identity and saved payment methods.',
      proofPoints: ['Collection window reduced from 38 to 16 days'],
      priority: 'High'
    },
    {
      id: 'provider-onboarding',
      name: 'Provider Onboarding Automation',
      value: 'Streamline onboarding with KYC orchestration and payout visibility.',
      proofPoints: ['Provider activation time down by 40%'],
      priority: 'High'
    },
    {
      id: 'embedded-financing',
      name: 'Patient Financing Experience',
      value: 'Offer Stripe Capital partners for patient payment plans.',
      proofPoints: ['Patient satisfaction up by 18 points'],
      priority: 'Medium'
    }
  ],
  riskSignals: [
    { id: 'security-review', label: 'Extended security review cycles', severity: 'High', mitigation: 'Provide compliance documentation hub and joint workshops.' },
    { id: 'ehr-integration', label: 'EHR integration dependencies', severity: 'Medium', mitigation: 'Use HL7/FHIR connectors with phased rollout.' },
    { id: 'provider-change', label: 'Provider adoption fatigue', severity: 'Medium', mitigation: 'Launch provider ambassador program and feedback loops.' }
  ],
  engagementPlaybooks: [
    {
      id: 'compliance-weekly',
      channel: 'call',
      cadence: 'Weekly',
      persona: 'Chief Compliance Officer',
      objective: 'Advance HIPAA and security sign-off with documented controls.',
      recommendedTouchpoints: ['Security posture review', 'Data residency alignment', 'Third-party audit summary']
    },
    {
      id: 'provider-forum',
      channel: 'calendar',
      cadence: 'Monthly',
      persona: 'Chief Medical Officer',
      objective: 'Gather provider feedback, share adoption metrics.',
      recommendedTouchpoints: ['Provider panel session', 'Product roadmap briefing']
    },
    {
      id: 'rev-cycle-digest',
      channel: 'email',
      cadence: 'Bi-weekly',
      persona: 'VP Revenue Cycle',
      objective: 'Share collection metrics, automation insights, next steps.',
      recommendedTouchpoints: ['ARR dashboard snapshot', 'Automation backlog update']
    }
  ],
  recommendedAssets: [
    { type: 'Whitepaper', title: 'HIPAA Controls with Stripe', usage: 'Security review' },
    { type: 'Checklist', title: 'Provider Onboarding Readiness', usage: 'Implementation planning' },
    { type: 'Case Study', title: 'Health Platform Collections Acceleration', usage: 'Executive validation' }
  ]
};

export class HealthcarePlatformTemplate extends CompanyTemplate {
  constructor() {
    super(definition);
  }
}
