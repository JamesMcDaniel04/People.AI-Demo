import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Application settings
  app: {
    name: 'AI Account Planner',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // MCP (Model Context Protocol) configuration
  mcp: {
    enabled: process.env.MCP_ENABLED === 'true' || false,
    serverUrl: process.env.MCP_SERVER_URL || 'ws://localhost:3001',
    apiKey: process.env.MCP_API_KEY || '',
    timeout: parseInt(process.env.MCP_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.MCP_RETRY_ATTEMPTS) || 3,
    capabilities: {
      email: process.env.MCP_EMAIL_ENABLED === 'true',
      calendar: process.env.MCP_CALENDAR_ENABLED === 'true',
      crm: process.env.MCP_CRM_ENABLED === 'true',
      documents: process.env.MCP_DOCUMENTS_ENABLED === 'true'
    }
  },

  // External API configuration
  external: {
    enabled: process.env.EXTERNAL_API_ENABLED === 'true' || false,
    baseURL: process.env.EXTERNAL_API_BASE_URL || 'https://api.example.com',
    apiKey: process.env.EXTERNAL_API_KEY || '',
    endpoints: {
      news: process.env.NEWS_API_ENDPOINT || '/news',
      financial: process.env.FINANCIAL_API_ENDPOINT || '/financial',
      company: process.env.COMPANY_API_ENDPOINT || '/company'
    },
    rateLimits: {
      requestsPerMinute: parseInt(process.env.API_RATE_LIMIT) || 100,
      requestsPerHour: parseInt(process.env.API_HOURLY_LIMIT) || 1000
    }
  },

  // AI configuration (for future AI service integration)
  ai: {
    provider: process.env.AI_PROVIDER || 'claude', // claude, openai, gemini
    model: process.env.AI_MODEL || 'claude-3-sonnet',
    apiKey: process.env.AI_API_KEY || '',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 4096,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.1,
    features: {
      analysis: process.env.AI_ANALYSIS_ENABLED === 'true' || true,
      recommendations: process.env.AI_RECOMMENDATIONS_ENABLED === 'true' || true,
      riskAssessment: process.env.AI_RISK_ASSESSMENT_ENABLED === 'true' || true
    }
  },

  // Data processing configuration
  data: {
    cacheEnabled: process.env.DATA_CACHE_ENABLED === 'true' || true,
    cacheDuration: parseInt(process.env.DATA_CACHE_DURATION) || 3600000, // 1 hour in ms
    batchSize: parseInt(process.env.DATA_BATCH_SIZE) || 100,
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.LOG_CONSOLE_ENABLED === 'true' || true,
    enableFile: process.env.LOG_FILE_ENABLED === 'true' || false,
    filePath: process.env.LOG_FILE_PATH || './logs/app.log'
  },

  // Account planning specific settings
  planning: {
    defaultPlanPeriod: process.env.PLAN_PERIOD || 'Q2-Q4 2024',
    healthScoreWeights: {
      financial: parseFloat(process.env.HEALTH_WEIGHT_FINANCIAL) || 0.3,
      engagement: parseFloat(process.env.HEALTH_WEIGHT_ENGAGEMENT) || 0.3,
      growth: parseFloat(process.env.HEALTH_WEIGHT_GROWTH) || 0.2,
      satisfaction: parseFloat(process.env.HEALTH_WEIGHT_SATISFACTION) || 0.2
    },
    opportunityThresholds: {
      high: parseFloat(process.env.OPPORTUNITY_THRESHOLD_HIGH) || 0.7,
      medium: parseFloat(process.env.OPPORTUNITY_THRESHOLD_MEDIUM) || 0.4,
      low: parseFloat(process.env.OPPORTUNITY_THRESHOLD_LOW) || 0.2
    },
    riskThresholds: {
      contractExpiry: parseInt(process.env.RISK_CONTRACT_EXPIRY_DAYS) || 90,
      stakeholderInactivity: parseInt(process.env.RISK_STAKEHOLDER_INACTIVE_DAYS) || 60,
      engagementDrop: parseFloat(process.env.RISK_ENGAGEMENT_DROP) || 0.5
    }
  },

  // Security settings
  security: {
    enableRateLimit: process.env.SECURITY_RATE_LIMIT_ENABLED === 'true' || true,
    enableCORS: process.env.SECURITY_CORS_ENABLED === 'true' || false,
    allowedOrigins: process.env.SECURITY_ALLOWED_ORIGINS?.split(',') || ['localhost'],
    enableEncryption: process.env.SECURITY_ENCRYPTION_ENABLED === 'true' || false
  }
};