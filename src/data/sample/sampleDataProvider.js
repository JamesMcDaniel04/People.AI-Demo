import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DemoDataGenerator } from '../templates/demoDataGenerator.js';
import { DemoDataQualityService } from '../../services/demoDataQualityService.js';
import { DemoDataAuditService } from '../../services/demoDataAuditService.js';
import { DemoDataLifecycleService } from '../../services/demoDataLifecycleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SampleDataProvider {
  constructor(config = {}) {
    this.config = config;
    this.emails = [];
    this.personas = {};
    this.calls = [];
    this.initialized = false;
    this.datasetCache = new Map(); // accountName -> dataset
    this.demoGenerator = new DemoDataGenerator({
      defaultProfileId: config.demo?.defaultProfile,
      anonymize: config.demo?.anonymizeByDefault !== false,
      maskNames: config.demo?.maskNames === true
    });
    this.qualityService = new DemoDataQualityService(config);
    this.auditService = new DemoDataAuditService(config);
    this.lifecycleService = new DemoDataLifecycleService(config);
  }

  getStatus() {
    return {
      initialized: !!this.initialized,
      emails: this.emails.length,
      calls: this.calls.length,
      stakeholders: (this.personas?.customer_stakeholders || []).length,
      stripeTeam: (this.personas?.stripe_team || []).length,
      templates: this.demoGenerator.listTemplates().length,
      profiles: this.demoGenerator.listProfiles().length
    };
  }

  async initialize() {
    console.log('🔄 Loading sample GTM data...');
    
    try {
      // Load emails data
      const emailsData = await readFile(join(__dirname, 'emails.json'), 'utf-8');
      this.emails = JSON.parse(emailsData).emails;

      // Load personas data
      const personasData = await readFile(join(__dirname, 'personas.json'), 'utf-8');
      const personasJson = JSON.parse(personasData);
      this.personas = {
        stripe_team: personasJson.stripe_team,
        customer_stakeholders: personasJson.customer_stakeholders
      };

      // Load calls data
      const callsData = await readFile(join(__dirname, 'calls.json'), 'utf-8');
      this.calls = JSON.parse(callsData).calls;

      this.initialized = true;
      console.log(`✅ Sample data loaded: ${this.emails.length} email threads, ${this.personas.customer_stakeholders.length} stakeholders, ${this.calls.length} calls`);

    } catch (error) {
      console.error('❌ Failed to load sample data:', error.message);
      throw error;
    }
  }

  async getAccountInfo(accountName) {
    if (!this.initialized) {
      throw new Error('SampleDataProvider not initialized');
    }

    // Extract account info from email and call interactions
    let accountEmails = this.emails.filter(thread => 
      thread.messages.some(msg => 
        msg.to.includes(accountName.toLowerCase()) || 
        msg.from.includes(accountName.toLowerCase()) ||
        msg.body.toLowerCase().includes(accountName.toLowerCase())
      )
    );

    let accountCalls = this.calls.filter(call =>
      call.transcript.some(turn =>
        turn.text.toLowerCase().includes(accountName.toLowerCase())
      )
    );

    const dataset = await this.getOrGenerateDemoDataset(accountName);

    const combinedEmails = accountEmails.length > 0 ? accountEmails : (dataset.emails || []);
    const combinedCalls = accountCalls.length > 0 ? accountCalls : (dataset.calls || []);

    const datasetHealth = dataset?.accountInfo?.healthScore;
    const fallbackScore = this.calculateHealthScore(combinedEmails, combinedCalls);
    const normalized = typeof datasetHealth?.score === 'number' ? datasetHealth.score : Math.min(0.99, fallbackScore / 100);
    const numericScore = Math.round(normalized * 100);

    return {
      accountName,
      status: dataset?.accountInfo?.status || 'Active Program',
      healthScore: numericScore,
      healthScoreDetails: {
        score: Number(normalized.toFixed(2)),
        trend: datasetHealth?.trend || 'steady'
      },
      lastActivity: dataset?.accountInfo?.lastActivity || this.getLastActivityDate(combinedEmails, combinedCalls),
      totalInteractions: dataset?.interactions?.length || (combinedEmails.length + combinedCalls.length),
      stage: dataset?.accountInfo?.stage || this.determineAccountStage(combinedEmails, combinedCalls),
      revenue: dataset?.accountInfo?.revenue || {
        current: 0,
        potential: this.estimatePotentialRevenue(combinedEmails, combinedCalls)
      },
      datasetProfile: dataset?.profile,
      datasetMetadata: dataset?.metadata
    };
  }

  async getInteractionHistory(accountName) {
    if (!this.initialized) {
      throw new Error('SampleDataProvider not initialized');
    }

    const dataset = await this.getOrGenerateDemoDataset(accountName);
    const interactions = dataset?.interactions ? dataset.interactions.map(item => ({ ...item })) : [];

    if (interactions.length === 0) {
      const fallbackEmails = this.emails.filter(thread => 
        thread.messages.some(msg => 
          msg.to.includes(accountName.toLowerCase()) || 
          msg.from.includes(accountName.toLowerCase()) ||
          msg.body.toLowerCase().includes(accountName.toLowerCase())
        )
      );

      fallbackEmails.forEach(thread => {
        const lastMessage = thread.messages[thread.messages.length - 1];
        if (!lastMessage) return;
        interactions.push({
          type: 'email',
          date: lastMessage.timestamp,
          subject: lastMessage.subject,
          participants: [lastMessage.from, lastMessage.to],
          summary: this.extractEmailSummary(lastMessage.body),
          sentiment: this.analyzeSentiment(lastMessage.body),
          threadId: thread.thread_id
        });
      });

      const fallbackCalls = this.calls.filter(call =>
        call.transcript.some(turn =>
          turn.text.toLowerCase().includes(accountName.toLowerCase())
        )
      );

      fallbackCalls.forEach(call => {
        interactions.push({
          type: 'call',
          date: call.date || '2025-01-15T14:00:00.000Z',
          subject: call.type,
          participants: call.participants,
          duration: call.duration || '45 minutes',
          summary: this.extractCallSummary(call.transcript),
          keyTopics: this.extractKeyTopics(call.transcript),
          callId: call.call_id
        });
      });
    }

    return interactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getStakeholders(accountName) {
    if (!this.initialized) {
      throw new Error('SampleDataProvider not initialized');
    }

    const dataset = await this.getOrGenerateDemoDataset(accountName);

    // Filter stakeholders based on account involvement
    let accountStakeholders = this.personas.customer_stakeholders.filter(stakeholder => {
      // Check if stakeholder appears in emails or calls for this account
      const appearsInEmails = this.emails.some(thread =>
        thread.messages.some(msg => 
          msg.from.includes(stakeholder.name.toLowerCase().replace(' ', '.')) ||
          msg.to.includes(stakeholder.name.toLowerCase().replace(' ', '.')) ||
          msg.body.toLowerCase().includes(stakeholder.name.toLowerCase())
        )
      );

      const appearsInCalls = this.calls.some(call =>
        call.participants.some(participant =>
          participant.toLowerCase().includes(stakeholder.name.toLowerCase())
        ) ||
        call.transcript.some(turn =>
          turn.speaker.toLowerCase().includes(stakeholder.name.toLowerCase())
        )
      );

      return appearsInEmails || appearsInCalls;
    });

    const datasetStakeholders = dataset?.stakeholders || [];
    const merged = new Map();

    datasetStakeholders.forEach(stakeholder => {
      const key = (stakeholder.email || stakeholder.id || stakeholder.name || '').toLowerCase();
      merged.set(key, { ...stakeholder });
    });

    accountStakeholders.forEach(stakeholder => {
      const key = (stakeholder.email || stakeholder.name || '').toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, { ...stakeholder });
      }
    });

    const emails = dataset?.emails || [];
    const calls = dataset?.calls || [];

    return Array.from(merged.values()).map(stakeholder => ({
      ...stakeholder,
      relationshipStrength: this.calculateRelationshipStrength(stakeholder.email || stakeholder.name, emails, calls),
      lastEngagement: this.getLastEngagementDate(stakeholder.email || stakeholder.name, emails, calls),
      engagementFrequency: this.calculateEngagementFrequency(stakeholder.email || stakeholder.name, emails, calls),
      influence: this.assessInfluenceLevel(stakeholder.persona_type || stakeholder.role),
      sentiment: this.calculateStakeholderSentiment(stakeholder.email || stakeholder.name, emails, calls)
    }));
  }

  async getEmailData(accountName) {
    const dataset = await this.getOrGenerateDemoDataset(accountName);
    const matches = this.emails.filter(thread => 
      thread.messages.some(msg => 
        msg.body.toLowerCase().includes(accountName.toLowerCase()) ||
        thread.topic.toLowerCase().includes(accountName.toLowerCase())
      )
    );
    const datasetEmails = dataset?.emails || [];
    if (matches.length > 0 && datasetEmails.length > 0) {
      return [...matches, ...datasetEmails];
    }
    if (matches.length > 0) return matches;
    return datasetEmails;
  }

  async getCallData(accountName) {
    const dataset = await this.getOrGenerateDemoDataset(accountName);
    const matches = this.calls.filter(call =>
      call.transcript.some(turn =>
        turn.text.toLowerCase().includes(accountName.toLowerCase())
      )
    );
    const datasetCalls = dataset?.calls || [];
    if (matches.length > 0 && datasetCalls.length > 0) {
      return [...matches, ...datasetCalls];
    }
    if (matches.length > 0) return matches;
    return datasetCalls;
  }

  async getDocuments(accountName) {
    const dataset = await this.getOrGenerateDemoDataset(accountName);
    return dataset?.documents || [];
  }

  async getCalendarData(accountName) {
    const dataset = await this.getOrGenerateDemoDataset(accountName);
    return dataset?.calendar || [];
  }

  async getCRMData(accountName) {
    const dataset = await this.getOrGenerateDemoDataset(accountName);
    return dataset?.crm || [];
  }

  async getAuditHistory(accountName) {
    if (!this.auditService) return [];
    try {
      return await this.auditService.getHistory(accountName);
    } catch (error) {
      console.warn('⚠️ Failed to read audit history', { accountName, error: error.message });
      return [];
    }
  }

  async getLatestDataset(accountName, options = {}) {
    let dataset = null;
    if (this.auditService && !options.forceRefresh) {
      try {
        dataset = await this.auditService.getLatestDataset(accountName);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('⚠️ Failed to load cached dataset', { accountName, error: error.message });
        }
      }
    }
    if (!dataset || options.forceRefresh) {
      dataset = await this.getOrGenerateDemoDataset(accountName, options);
    }
    return dataset;
  }

  invalidateGeneratedData(accountName) {
    if (!accountName) return;
    this.datasetCache.delete(accountName);
  }

  clearGeneratedCache() {
    this.datasetCache.clear();
  }

  // Helper methods
  calculateHealthScore(emails, calls) {
    let score = 50; // Base score
    
    // Positive indicators
    score += emails.length * 5; // Email engagement
    score += calls.length * 10; // Call engagement (more valuable)
    
    // Check for positive keywords in recent interactions
    const recentContent = [
      ...emails.flatMap(e => e.messages.map(m => m.body)),
      ...calls.flatMap(c => c.transcript.map(t => t.text))
    ].join(' ').toLowerCase();

    if (recentContent.includes('interested') || recentContent.includes('excited')) score += 10;
    if (recentContent.includes('budget') || recentContent.includes('pricing')) score += 15;
    if (recentContent.includes('timeline') || recentContent.includes('implementation')) score += 20;
    
    return Math.min(100, Math.max(0, score));
  }

  getLastActivityDate(emails, calls) {
    const emailDates = emails.flatMap(e => e.messages.map(m => new Date(m.timestamp)));
    const callDates = calls.map(c => new Date(c.date || '2025-01-15'));
    
    const allDates = [...emailDates, ...callDates];
    return allDates.length > 0 ? new Date(Math.max(...allDates)).toISOString() : null;
  }

  determineAccountStage(emails, calls) {
    const content = [
      ...emails.flatMap(e => e.messages.map(m => m.body)),
      ...calls.flatMap(c => c.transcript.map(t => t.text))
    ].join(' ').toLowerCase();

    if (content.includes('contract') || content.includes('signature')) return 'Closing';
    if (content.includes('demo') || content.includes('technical')) return 'Evaluation';
    if (content.includes('pricing') || content.includes('proposal')) return 'Proposal';
    if (content.includes('discovery') || content.includes('requirement')) return 'Discovery';
    return 'Initial Contact';
  }

  estimatePotentialRevenue(emails, calls) {
    const content = [
      ...emails.flatMap(e => e.messages.map(m => m.body)),
      ...calls.flatMap(c => c.transcript.map(t => t.text))
    ].join(' ').toLowerCase();

    // Look for revenue indicators
    if (content.includes('enterprise') || content.includes('global')) return 500000;
    if (content.includes('million') || content.includes('scale')) return 250000;
    if (content.includes('expand') || content.includes('grow')) return 100000;
    return 50000; // Default estimate
  }

  extractEmailSummary(body) {
    const sentences = body.split('.').filter(s => s.trim().length > 10);
    return sentences[0]?.trim() + '...' || 'Email interaction';
  }

  analyzeSentiment(text) {
    const positive = ['interested', 'excited', 'great', 'perfect', 'love', 'excellent'];
    const negative = ['concerned', 'issue', 'problem', 'delay', 'difficult'];
    
    const words = text.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(w => positive.includes(w)).length;
    const negativeCount = words.filter(w => negative.includes(w)).length;
    
    if (positiveCount > negativeCount) return 'Positive';
    if (negativeCount > positiveCount) return 'Negative';
    return 'Neutral';
  }

  extractCallSummary(transcript) {
    const mainPoints = transcript
      .filter(turn => turn.text.length > 50)
      .slice(0, 3)
      .map(turn => turn.text.substring(0, 100) + '...');
    
    return mainPoints.join(' | ');
  }

  extractKeyTopics(transcript) {
    const topics = new Set();
    const content = transcript.map(t => t.text).join(' ').toLowerCase();
    
    if (content.includes('payment') || content.includes('stripe')) topics.add('Payments');
    if (content.includes('integration') || content.includes('api')) topics.add('Technical Integration');
    if (content.includes('pricing') || content.includes('cost')) topics.add('Pricing');
    if (content.includes('security') || content.includes('compliance')) topics.add('Security & Compliance');
    if (content.includes('global') || content.includes('international')) topics.add('Global Expansion');
    
    return Array.from(topics);
  }

  calculateRelationshipStrength(identifier, emails = [], calls = []) {
    const target = String(identifier || '').toLowerCase();
    if (!target) return 'None';

    const emailMentions = emails
      .flatMap(e => e.messages || [])
      .filter(m => {
        const from = String(m.from || '').toLowerCase();
        const recipients = Array.isArray(m.to) ? m.to.join(' ') : String(m.to || '');
        return from.includes(target) || recipients.toLowerCase().includes(target);
      })
      .length;

    const callMentions = calls.filter(c =>
      (c.participants || []).some(p => String(p || '').toLowerCase().includes(target))
    ).length;

    const totalInteractions = emailMentions + callMentions * 2; // Calls weighted higher

    if (totalInteractions >= 5) return 'Strong';
    if (totalInteractions >= 3) return 'Medium';
    if (totalInteractions >= 1) return 'Weak';
    return 'None';
  }

  getLastEngagementDate(identifier, emails = [], calls = []) {
    const target = String(identifier || '').toLowerCase();
    const emailDates = emails
      .flatMap(e => e.messages || [])
      .filter(m => {
        const from = String(m.from || '').toLowerCase();
        const recipients = Array.isArray(m.to) ? m.to.join(' ') : String(m.to || '');
        return from.includes(target) || recipients.toLowerCase().includes(target);
      })
      .map(m => new Date(m.timestamp));

    const callDates = calls
      .filter(c => (c.participants || []).some(p => String(p || '').toLowerCase().includes(target)))
      .map(c => new Date(c.date || '2025-01-15T00:00:00.000Z'));

    const allDates = [...emailDates, ...callDates];
    return allDates.length > 0 ? new Date(Math.max(...allDates)).toISOString() : null;
  }

  calculateEngagementFrequency(identifier, emails = [], calls = []) {
    const target = String(identifier || '').toLowerCase();
    const emailInteractions = emails
      .flatMap(e => e.messages || [])
      .filter(m => {
        const from = String(m.from || '').toLowerCase();
        const recipients = Array.isArray(m.to) ? m.to.join(' ') : String(m.to || '');
        return from.includes(target) || recipients.toLowerCase().includes(target);
      }).length;

    const callInteractions = calls.filter(c =>
      (c.participants || []).some(p => String(p || '').toLowerCase().includes(target))
    ).length;

    const interactions = emailInteractions + callInteractions;

    if (interactions >= 5) return 'High';
    if (interactions >= 3) return 'Medium';
    if (interactions >= 1) return 'Low';
    return 'None';
  }

  assessInfluenceLevel(personaType) {
    const influenceMap = {
      'Economic Buyer': 'High',
      'Technical Champion': 'High',
      'Economic Buyer / Procurement Gatekeeper': 'High',
      'End User': 'Medium',
      'Influencer': 'Medium'
    };
    return influenceMap[personaType] || 'Medium';
  }

  calculateStakeholderSentiment(identifier, emails = [], calls = []) {
    const target = String(identifier || '').toLowerCase();
    const emailBodies = emails
      .flatMap(e => e.messages || [])
      .filter(m => {
        const from = String(m.from || '').toLowerCase();
        const recipients = Array.isArray(m.to) ? m.to.join(' ') : String(m.to || '');
        return from.includes(target) || recipients.toLowerCase().includes(target);
      })
      .map(m => m.body || '');

    const callBodies = calls
      .flatMap(c => c.transcript || [])
      .filter(t => String(t.speaker || '').toLowerCase().includes(target))
      .map(t => t.text || '');

    const allContent = [...emailBodies, ...callBodies].join(' ');
    return this.analyzeSentiment(allContent);
  }

  // Multi-modal fallback powered by templates
  async getOrGenerateDemoDataset(accountName, options = {}) {
    const cached = this.datasetCache.get(accountName);
    if (cached && !this.lifecycleService.shouldRefresh(accountName, cached)) {
      return cached;
    }

    let dataset = this.demoGenerator.generateAccount(accountName, {
      profileId: options.profileId || this.config.demo?.defaultProfile,
      industry: options.industry,
      overrides: options.overrides,
      anonymize: options.anonymize ?? this.config.demo?.anonymizeByDefault !== false
    });

    const quality = this.qualityService.evaluate(dataset);
    dataset.metadata = {
      ...(dataset.metadata || {}),
      quality
    };
    dataset.quality = quality;

    const lifecycle = this.lifecycleService.markRefreshed(accountName, dataset);
    dataset.metadata.lifecycle = lifecycle;

    try {
      const versionInfo = await this.auditService.record(accountName, dataset, quality);
      dataset.metadata.version = versionInfo;
    } catch (error) {
      console.warn('⚠️ Demo data audit recording failed', { accountName, error: error.message });
    }

    this.datasetCache.set(accountName, dataset);
    return dataset;
  }
}
