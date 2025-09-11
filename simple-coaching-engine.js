// Simplified AI Coaching Engine - Hardcoded responses for consistent demos
// This simulates AI-powered account planning with predictable results

import { stripeGTMData } from './simple-demo-data.js';

export class SimplifiedCoachingEngine {
  constructor() {
    this.hardcodedResponses = this.initializeHardcodedResponses();
  }

  initializeHardcodedResponses() {
    return {
      stripe: {
        accountPlan: {
          accountOverview: {
            accountName: 'Stripe (TechForward Solutions)',
            currentStatus: 'Strategic Partnership',
            relationshipHealth: 'Excellent',
            healthScore: {
              score: 87,
              trend: 'Improving',
              factors: [
                'Strong technical relationship (+15)',
                'Growing transaction volume (+20)',
                'Active feature adoption (+12)',
                'Expansion discussions in progress (+10)',
                'Minor pricing concerns (-5)'
              ]
            },
            keyMetrics: {
              currentARR: '$2.4M',
              growthRate: '40% QoQ',
              transactionVolume: '$150M annually',
              lastInteraction: '2024-12-16',
              contractRenewal: '2025-12-31'
            }
          },
          
          stakeholderMap: {
            keyStakeholders: [
              {
                name: 'Lisa Wang',
                role: 'CFO',
                influence: 'Very High',
                sentiment: 'Cautious but Positive',
                lastContact: '2024-12-12',
                keyInterests: ['Cost optimization', 'ROI analysis', 'International expansion']
              },
              {
                name: 'David Thompson', 
                role: 'VP Engineering',
                influence: 'High',
                sentiment: 'Very Positive',
                lastContact: '2024-12-15',
                keyInterests: ['Technical capabilities', 'Developer experience', 'Scaling challenges']
              },
              {
                name: 'Alex Chen',
                role: 'Product Manager',
                influence: 'Medium',
                sentiment: 'Enthusiastic',
                lastContact: '2024-12-13',
                keyInterests: ['Feature velocity', 'User experience', 'Market expansion']
              }
            ],
            championScore: 'Strong',
            decisionMakingProcess: 'Collaborative between CFO and VP Engineering'
          },

          opportunityAnalysis: {
            identifiedOpportunities: [
              {
                title: 'European Market Expansion Partnership',
                description: 'TechForward is planning Q2 2025 European expansion and needs comprehensive payment infrastructure',
                value: '$800K - $1.2M ARR',
                probability: '85%',
                timeline: 'Q1 2025 decision, Q2 implementation',
                nextSteps: [
                  'Prepare European compliance and payment methods presentation',
                  'Coordinate with international team for demo',
                  'Provide GDPR and data residency documentation'
                ],
                stakeholders: ['Lisa Wang', 'Michael Brown'],
                priority: 'High'
              },
              {
                title: 'Enterprise Volume Pricing Tier Upgrade',
                description: 'Current volume justifies enterprise pricing tier with better rates',
                value: '$200K - $300K savings opportunity (retention play)',
                probability: '95%',
                timeline: 'Immediate - contract renewal discussion',
                nextSteps: [
                  'Prepare volume-based pricing proposal',
                  'Calculate ROI and present cost savings',
                  'Schedule pricing negotiation meeting'
                ],
                stakeholders: ['Lisa Wang', 'Sarah Chen'],
                priority: 'High'
              },
              {
                title: 'Advanced Fraud Prevention (Radar for Fraud Teams)',
                description: 'Growing transaction volume increases fraud risk - opportunity for Radar expansion',
                value: '$150K - $250K ARR',
                probability: '70%',
                timeline: 'Q1 2025',
                nextSteps: [
                  'Analyze current fraud patterns and costs',
                  'Demo Radar features and ROI calculations',
                  'Connect with fraud/risk management team'
                ],
                stakeholders: ['David Thompson', 'Risk Management Team'],
                priority: 'Medium'
              }
            ],
            totalPipelineValue: '$1.15M - $1.75M ARR',
            quarterlyForecast: 'Strong expansion potential'
          },

          riskAssessment: {
            identifiedRisks: [
              {
                risk: 'Competitive Pressure from Adyen',
                severity: 'Medium',
                probability: 'Medium',
                description: 'Adyen is actively pursuing TechForward with aggressive pricing for international expansion',
                impact: 'Could lose European expansion opportunity ($800K ARR)',
                mitigation: [
                  'Accelerate European expansion proposal',
                  'Emphasize Stripe\'s superior developer experience',
                  'Leverage existing relationship strength',
                  'Provide competitive pricing for international tier'
                ],
                owner: 'Sarah Chen',
                timeline: 'Next 30 days'
              },
              {
                risk: 'Price Sensitivity on Volume Growth',
                severity: 'Low',
                probability: 'Medium',
                description: 'CFO increasingly focused on transaction cost optimization as volume scales',
                impact: 'Potential downward pressure on pricing ($100K-200K ARR impact)',
                mitigation: [
                  'Proactively offer volume-based pricing tiers',
                  'Demonstrate value beyond pricing (features, reliability)',
                  'Calculate total cost of ownership vs. competitors',
                  'Position as strategic growth partnership'
                ],
                owner: 'Sarah Chen',
                timeline: 'Contract renewal (Q4 2025)'
              },
              {
                risk: 'Technical Integration Complexity',
                severity: 'Low',
                probability: 'Low',
                description: 'Potential delays in international expansion due to technical complexity',
                impact: 'Delayed revenue recognition, potential competitor advantage',
                mitigation: [
                  'Assign dedicated Solutions Engineer for implementation',
                  'Provide comprehensive technical documentation',
                  'Offer migration support and testing environments',
                  'Create detailed implementation timeline'
                ],
                owner: 'Marcus Rodriguez',
                timeline: 'Implementation phase (Q1-Q2 2025)'
              }
            ],
            overallRiskLevel: 'Low-Medium',
            keyMitigationFocus: 'Competitive positioning and proactive pricing strategy'
          },

          strategicRecommendations: {
            immediateActions: [
              {
                action: 'Schedule European Expansion Strategy Session',
                timeline: 'Next 7 days',
                owner: 'Sarah Chen',
                description: 'Present comprehensive European market entry strategy with Stripe as payment partner',
                expectedOutcome: 'Secure European expansion partnership commitment'
              },
              {
                action: 'Prepare Volume-Based Pricing Proposal',
                timeline: 'Next 10 days',
                owner: 'Sarah Chen + Pricing Team',
                description: 'Create custom enterprise pricing tier reflecting current volume and growth trajectory',
                expectedOutcome: 'Demonstrate Stripe commitment to partnership, prevent competitive pricing pressure'
              },
              {
                action: 'Technical Architecture Review',
                timeline: 'Next 14 days',
                owner: 'Marcus Rodriguez',
                description: 'Deep-dive technical session on international expansion implementation',
                expectedOutcome: 'Build technical confidence and timeline clarity for European expansion'
              }
            ],
            strategicInitiatives: [
              {
                initiative: 'Establish Quarterly Business Reviews',
                description: 'Regular strategic alignment meetings with executive stakeholders',
                timeline: 'Q1 2025 implementation',
                value: 'Strengthen relationship, early opportunity identification, risk mitigation'
              },
              {
                initiative: 'Co-Marketing Partnership',
                description: 'Joint case study and conference speaking opportunities',
                timeline: 'Q2 2025',
                value: 'Increase switching costs, demonstrate partnership value, competitive differentiation'
              }
            ]
          },

          executiveSummary: {
            keyHighlights: [
              'Strong account health (87/100) with expanding relationship across technical and business teams',
              'Significant expansion opportunity ($1.15M-$1.75M ARR) driven by European market entry and volume growth',
              'Competitive threat from Adyen requires proactive pricing and European expansion strategy',
              'High-value strategic partnership with strong technical champions and growing business impact'
            ],
            criticalSuccess: 'Securing European expansion partnership within next 30 days',
            nextQuarterFocus: 'International expansion implementation and enterprise pricing optimization',
            relationshipStrength: 'Strong with expansion potential'
          }
        },

        dailyCoaching: {
          date: new Date().toISOString().split('T')[0],
          coachingMessage: `🎯 **Daily Account Coaching - Stripe (TechForward Solutions)**

**🚨 PRIORITY ACTIONS (Next 48 hours):**
1. **Schedule European Expansion Call** - TechForward CFO Lisa Wang is evaluating EU expansion. Adyen is actively competing. Need to present Stripe's European capabilities ASAP.
2. **Prepare Volume Pricing Proposal** - Their 40% growth qualifies for enterprise tier. Proactive pricing move prevents competitive pressure.
3. **Follow up on Technical Deep-dive** - Marcus completed technical review. Emma (Senior Dev) is enthusiastic - capitalize on technical momentum.

**💡 KEY INSIGHTS:**
• **Relationship Health: 87/100** (↗️ Improving)
• **Expansion Pipeline: $1.15M-$1.75M ARR** potential
• **Champion Strength: High** (David Thompson + Emma Davis)
• **Risk Level: Medium** (Adyen competitive threat)

**📊 RECENT ACTIVITY:**
• ✅ Technical deep-dive completed (Dec 10) - very positive response
• ✅ Pricing discussion initiated by CFO (Dec 5) - ready to negotiate
• ⏳ European expansion research in progress (high urgency)
• ⏳ API optimization discussions ongoing

**🎯 THIS WEEK'S FOCUS:**
1. **Tuesday:** Send European market capabilities deck to Lisa Wang
2. **Wednesday:** Technical follow-up call with Marcus & Emma
3. **Thursday:** Pricing proposal delivery and discussion
4. **Friday:** European expansion strategy session (if scheduled)

**⚠️ COMPETITIVE ALERT:**
Adyen is pursuing TechForward aggressively for EU expansion. Our advantages: existing relationship, superior developer experience, technical momentum. Act quickly on European proposal.

**💼 COACH RECOMMENDATION:**
This is a make-or-break moment for expanding this strategic partnership. The combination of volume growth, international expansion, and competitive pressure creates perfect storm for major account growth OR loss. Focus 80% of week on this account.`,

          suggestedTalkTrack: `"Hi Lisa, I know European expansion is a top priority for Q2. I've prepared a comprehensive overview of Stripe's European capabilities - including GDPR compliance, local payment methods, and implementation timeline. Given the strategic importance and competitive landscape, I'd love to schedule 30 minutes this week to review how Stripe can power your European growth. Would Wednesday or Thursday work better for you?"`,

          focusAreas: [
            'European expansion opportunity capture',
            'Competitive defense against Adyen',
            'Volume-based pricing optimization',
            'Technical relationship deepening'
          ],

          successMetrics: [
            'European expansion partnership commitment',
            'Enterprise pricing tier upgrade',
            'Technical implementation timeline agreed',
            'Quarterly business review scheduled'
          ]
        }
      }
    };
  }

  // Simulate AI analysis with hardcoded results
  async generateAccountPlan(accountName = 'stripe') {
    // Simulate processing time
    await this.sleep(1000);
    
    const normalizedAccount = accountName.toLowerCase();
    
    if (!this.hardcodedResponses[normalizedAccount]) {
      throw new Error(`Demo data not available for account: ${accountName}`);
    }

    return {
      generatedAt: new Date().toISOString(),
      account: normalizedAccount,
      dataSource: 'sample_gtm_data',
      aiProvider: 'demo_engine',
      ...this.hardcodedResponses[normalizedAccount].accountPlan
    };
  }

  // Generate daily coaching message (like Slack notification mentioned in conversation)
  async generateDailyCoaching(accountName = 'stripe') {
    // Simulate AI processing
    await this.sleep(500);
    
    const normalizedAccount = accountName.toLowerCase();
    
    if (!this.hardcodedResponses[normalizedAccount]) {
      throw new Error(`Coaching data not available for account: ${accountName}`);
    }

    return {
      generatedAt: new Date().toISOString(),
      account: normalizedAccount,
      type: 'daily_coaching',
      ...this.hardcodedResponses[normalizedAccount].dailyCoaching
    };
  }

  // Simulate external data integration (MCP-like functionality)
  async fetchExternalData(accountName = 'stripe') {
    // Simulate data fetching delay
    await this.sleep(800);
    
    return {
      dataSource: 'klavis_mcp_simulation',
      fetchedAt: new Date().toISOString(),
      account: accountName,
      dataPoints: {
        emailThreads: stripeGTMData.emailThreads.length,
        callTranscripts: stripeGTMData.callTranscripts.length,
        stakeholders: stripeGTMData.personas.customerStakeholders.length,
        lastActivity: '2024-12-16T10:30:00Z'
      },
      status: 'success',
      note: 'Demo mode: Using hardcoded sample data representing real MCP integration'
    };
  }

  // Utility method to simulate async operations
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get available demo accounts
  getAvailableAccounts() {
    return Object.keys(this.hardcodedResponses);
  }

  // Health check for demo system
  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      availableAccounts: this.getAvailableAccounts(),
      features: [
        'Account plan generation',
        'Daily coaching messages',
        'External data simulation',
        'Workflow distribution'
      ]
    };
  }
}

export default SimplifiedCoachingEngine;