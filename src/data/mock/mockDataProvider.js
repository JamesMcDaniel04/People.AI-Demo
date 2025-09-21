export class MockDataProvider {
  constructor() {
    this.mockData = {
      stripe: {
        accountInfo: {
          accountName: 'Stripe',
          status: 'Active Customer',
          healthScore: 85,
          lastActivity: '2025-01-10T10:30:00Z',
          totalInteractions: 24,
          stage: 'Customer Success',
          revenue: {
            current: 2500000,
            potential: 5000000
          }
        },
        stakeholders: [
          {
            name: 'Patrick Collison',
            role: 'CEO',
            persona_type: 'Economic Buyer',
            relationshipStrength: 'Strong',
            lastEngagement: '2025-01-08T15:00:00Z',
            sentiment: 'Positive'
          },
          {
            name: 'John Collison', 
            role: 'President',
            persona_type: 'Economic Buyer',
            relationshipStrength: 'Medium',
            lastEngagement: '2025-01-05T11:30:00Z',
            sentiment: 'Neutral'
          }
        ]
      }
    };
    this.initialized = false;
  }

  async initialize() {
    console.log('🔄 Initializing Mock Data Provider...');
    this.initialized = true;
    console.log('✅ Mock Data Provider initialized');
  }

  async getAccountInfo(accountName) {
    if (!this.initialized) {
      throw new Error('MockDataProvider not initialized');
    }

    const key = accountName.toLowerCase();
    return this.mockData[key]?.accountInfo || null;
  }

  async getInteractionHistory(accountName) {
    if (!this.initialized) {
      throw new Error('MockDataProvider not initialized');
    }

    // Return mock interaction history
    return [
      {
        type: 'email',
        date: '2025-01-10T10:30:00Z',
        subject: 'Q1 Business Review Follow-up',
        participants: ['alex.chen@stripe.com', 'patrick@stripe.com'],
        summary: 'Discussion about Q1 expansion opportunities...',
        sentiment: 'Positive'
      },
      {
        type: 'call',
        date: '2025-01-08T15:00:00Z',
        callType: 'Quarterly Business Review',
        participants: ['Alex Chen - AE', 'Patrick Collison - CEO'],
        duration: '60 minutes',
        summary: 'Quarterly performance review and strategic planning...',
        keyTopics: ['Performance Review', 'Strategic Planning', 'Expansion']
      }
    ];
  }

  async getStakeholders(accountName) {
    if (!this.initialized) {
      throw new Error('MockDataProvider not initialized');
    }

    const key = accountName.toLowerCase();
    return this.mockData[key]?.stakeholders || [];
  }

  async getEmailData(accountName) {
    return [];
  }

  async getCallData(accountName) {
    return [];
  }
}