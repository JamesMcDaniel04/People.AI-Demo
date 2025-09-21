import { KlavisProvider } from './mcp/klavisProvider.js';
import { SampleDataProvider } from './sample/sampleDataProvider.js';
import { NewsProvider } from './external/newsProvider.js';
import { ProductionDataPipeline } from '../services/productionDataPipeline.js';

export class DataIntegrationManager {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.providers = new Map();
    this.initialized = false;
    this.pipeline = null;
    this.primaryProvider = null;
  }

  async initialize() {
    console.log('🔄 Initializing Data Integration Manager...');

    const source = (this.config.data?.source || 'mcp').toLowerCase();

    if (source === 'sample') {
      // Initialize sample provider for offline/demo use
      const sampleProvider = new SampleDataProvider(this.config);
      await sampleProvider.initialize();
      this.providers.set('sample', sampleProvider);
      this.primaryProvider = 'sample';
    } else if (source === 'external') {
      // Use sample for core GTM signals and enrich with external data
      const sampleProvider = new SampleDataProvider(this.config);
      await sampleProvider.initialize();
      this.providers.set('sample', sampleProvider);

      const newsProvider = new NewsProvider(this.config);
      await newsProvider.initialize();
      this.providers.set('news', newsProvider);

      this.primaryProvider = 'sample';
    } else {
      // Default to MCP (Klavis)
      const klavisProvider = new KlavisProvider(this.config);
      await klavisProvider.initialize();
      this.providers.set('klavis', klavisProvider);
      this.primaryProvider = 'klavis';
    }

    // Enable additional providers alongside the primary source when configured
    if (!this.providers.has('sample') && this.config.data?.enableSampleFallback) {
      const sampleProvider = new SampleDataProvider(this.config);
      await sampleProvider.initialize();
      this.providers.set('sample', sampleProvider);
    }

    try {
      this.pipeline = new ProductionDataPipeline(this.config, this, {
        statusService: this.options.statusService,
        postgresService: this.options.postgresService,
        realtime: this.options.realtime,
        persistToPostgres: this.options.persistToPostgres
      });
      await this.pipeline.initialize();
    } catch (error) {
      console.warn('⚠️ Production data pipeline failed to initialize, using legacy data assembly only', error.message);
      this.pipeline = null;
    }

    this.initialized = true;
    console.log('✅ Production Data Integration Manager initialized', {
      providers: this.getAvailableProviders(),
      pipelineEnabled: !!this.pipeline,
      primaryProvider: this.primaryProvider
    });
  }

  // Get the Klavis provider for AI services
  getKlavisProvider() {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }
    return this.providers.get('klavis');
  }

  getProvider(name) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }
    return this.providers.get(name);
  }

  getProviders() {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({ name, provider }));
  }

  async getAccountInfo(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    const provider = this.providers.get(this.primaryProvider);
    return await provider.getAccountInfo(accountName);
  }

  async getInteractionHistory(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    const provider = this.providers.get(this.primaryProvider);
    return await provider.getInteractionHistory(accountName);
  }

  async getStakeholders(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    const provider = this.providers.get(this.primaryProvider);
    return await provider.getStakeholders(accountName);
  }

  async getEmailData(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    const provider = this.providers.get(this.primaryProvider);
    return await provider.getEmailData(accountName);
  }

  async getCallData(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    const provider = this.providers.get(this.primaryProvider);
    return await provider.getCallData(accountName);
  }

  async getDocuments(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    const provider = this.providers.get(this.primaryProvider);
    return await provider.getDocuments(accountName);
  }

  async getCalendarData(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    const provider = this.providers.get(this.primaryProvider);
    return await provider.getCalendarData(accountName);
  }

  async getCRMData(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    const provider = this.providers.get(this.primaryProvider);
    return await provider.getCRMData(accountName);
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  async getStatus() {
    const source = (this.config.data?.source || 'mcp').toLowerCase();
    const status = { source, providers: this.getAvailableProviders() };
    const klavis = this.providers.get('klavis');
    const sample = this.providers.get('sample');
    const news = this.providers.get('news');

    if (klavis?.getStatus) status.klavis = klavis.getStatus();
    if (sample?.getStatus) status.sample = sample.getStatus();
    if (news?.getStatus) status.external = news.getStatus();

    return status;
  }

  async getAccountData(accountName) {
    if (!this.initialized) {
      throw new Error('DataIntegrationManager not initialized');
    }

    if (this.pipeline) {
      try {
        return await this.pipeline.getAccountData(accountName);
      } catch (error) {
        console.warn('⚠️ Production pipeline failed, falling back to legacy data assembly', error.message);
      }
    }

    return await this.legacyAccountData(accountName);
  }

  async legacyAccountData(accountName) {
    const source = (this.config.data?.source || 'mcp').toLowerCase();

    if (source === 'sample') {
      console.log(`📊 Gathering comprehensive data for ${accountName} from Sample Provider...`);
      const provider = this.providers.get('sample');
      const [accountInfo, interactions, stakeholders, emails, calls, documents, calendar, crm] = await Promise.all([
        provider.getAccountInfo(accountName),
        provider.getInteractionHistory(accountName),
        provider.getStakeholders(accountName),
        provider.getEmailData(accountName),
        provider.getCallData(accountName),
        provider.getDocuments?.(accountName) || [],
        provider.getCalendarData?.(accountName) || [],
        provider.getCRMData?.(accountName) || []
      ]);

      const accountData = {
        basic: { source: 'sample', data: accountInfo },
        interactions: [{ source: 'sample_interactions', data: interactions }],
        stakeholders: [{ source: 'sample_stakeholders', data: stakeholders }],
        emails: [{ source: 'sample_emails', data: emails }],
        calls: [{ source: 'sample_calls', data: calls }],
        documents: [{ source: 'sample_documents', data: documents }],
        calendar: [{ source: 'sample_calendar', data: calendar }],
        crm: [{ source: 'sample_crm', data: crm }],
        quality: accountInfo?.datasetMetadata?.quality ? [{ source: 'sample_quality', data: accountInfo.datasetMetadata.quality }] : [],
        financial: [{ source: 'generated', data: this.generateFinancialData(accountName) }]
      };
      console.log(`✅ Sample data gathered: ${interactions.length} interactions, ${stakeholders.length} stakeholders, ${emails.length} email threads, ${calls.length} calls`);
      return accountData;
    }

    if (source === 'external') {
      console.log(`📊 Gathering data for ${accountName}: Sample core + External news...`);
      const sample = this.providers.get('sample');
      const news = this.providers.get('news');

      const [accountInfo, interactions, stakeholders, emails, calls, documents, calendar, crm, newsItems] = await Promise.all([
        sample.getAccountInfo(accountName),
        sample.getInteractionHistory(accountName),
        sample.getStakeholders(accountName),
        sample.getEmailData(accountName),
        sample.getCallData(accountName),
        sample.getDocuments?.(accountName) || [],
        sample.getCalendarData?.(accountName) || [],
        sample.getCRMData?.(accountName) || [],
        news.getNews(accountName)
      ]);

      const accountData = {
        basic: { source: 'sample', data: accountInfo },
        interactions: [{ source: 'sample_interactions', data: interactions }],
        stakeholders: [{ source: 'sample_stakeholders', data: stakeholders }],
        emails: [{ source: 'sample_emails', data: emails }],
        calls: [{ source: 'sample_calls', data: calls }],
        documents: [{ source: 'sample_documents', data: documents }],
        calendar: [{ source: 'sample_calendar', data: calendar }],
        crm: [{ source: 'sample_crm', data: crm }],
        financial: [{ source: 'generated', data: this.generateFinancialData(accountName) }],
        quality: accountInfo?.datasetMetadata?.quality ? [{ source: 'sample_quality', data: accountInfo.datasetMetadata.quality }] : [],
        external: [{ source: 'news_api', data: { news: newsItems } }]
      };

      console.log(`✅ External enrichment added: ${newsItems.length} news items`);
      return accountData;
    }

    // Default: MCP via Klavis
    console.log(`📊 Gathering comprehensive data for ${accountName} via Klavis MCP...`);
    const provider = this.providers.get(this.primaryProvider);
    const [
      accountInfo,
      interactions,
      stakeholders,
      emails,
      calls,
      documents,
      calendar,
      crmData
    ] = await Promise.all([
      provider.getAccountInfo(accountName),
      provider.getInteractionHistory(accountName),
      provider.getStakeholders(accountName),
      provider.getEmailData(accountName),
      provider.getCallData(accountName),
      provider.getDocuments(accountName),
      provider.getCalendarData(accountName),
      provider.getCRMData(accountName)
    ]);

    const accountData = {
      basic: { source: 'klavis_mcp', data: accountInfo },
      interactions: [{ source: 'klavis_interactions', data: interactions }],
      stakeholders: [{ source: 'klavis_stakeholders', data: stakeholders }],
      emails: [{ source: 'klavis_emails', data: emails }],
      calls: [{ source: 'klavis_calls', data: calls }],
      documents: [{ source: 'klavis_documents', data: documents }],
      calendar: [{ source: 'klavis_calendar', data: calendar }],
      crm: [{ source: 'klavis_crm', data: crmData }],
      financial: [{ source: 'klavis_financial', data: accountInfo.revenue || {} }]
    };

    console.log(`✅ Klavis MCP data gathered: ${interactions.length} interactions, ${stakeholders.length} stakeholders, ${emails.length} email threads, ${calls.length} calls`);
    return accountData;
  }

  generateFinancialData(accountName) {
    // Generate estimated financial metrics based on account size and activity
    return {
      currentARR: 150000, // Estimated based on account tier
      lastYearARR: 120000,
      growthRate: 25,
      contractEndDate: '2025-12-31',
      paymentHistory: 'Excellent',
      employees: 500,
      industry: 'Technology',
      region: 'North America'
    };
  }

  async shutdown() {
    if (this.pipeline?.isInitialized()) {
      try {
        await this.pipeline.shutdown();
      } catch (error) {
        console.warn('⚠️ Failed to shut down production data pipeline cleanly', error.message);
      }
    }
    this.initialized = false;
  }
}
