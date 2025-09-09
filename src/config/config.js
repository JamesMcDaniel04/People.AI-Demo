import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Application settings
  app: {
    name: 'AI Account Planner',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // MCP (Model Context Protocol) configuration with Klavis
  mcp: {
    enabled: process.env.MCP_ENABLED === 'true',
    klavisApiKey: process.env.KLAVIS_API_KEY,
    timeout: parseInt(process.env.MCP_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.MCP_RETRY_ATTEMPTS) || 3,
    
    // MCP Server configurations
    servers: {
      gmail: {
        enabled: process.env.MCP_GMAIL_ENABLED !== 'false',
        authType: 'oauth',
        scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']
      },
      googleCalendar: {
        enabled: process.env.MCP_CALENDAR_ENABLED !== 'false',
        authType: 'oauth',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events']
      },
      googleDrive: {
        enabled: process.env.MCP_DRIVE_ENABLED !== 'false',
        authType: 'oauth',
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      },
      slack: {
        enabled: process.env.MCP_SLACK_ENABLED !== 'false',
        authType: 'oauth',
        scopes: ['channels:read', 'chat:write', 'im:read', 'im:write']
      },
      notion: {
        enabled: process.env.MCP_NOTION_ENABLED !== 'false',
        authType: 'oauth',
        scopes: ['read_content', 'insert_content']
      }
    },

    // Tool execution settings
    tools: {
      enableCaching: process.env.MCP_TOOL_CACHE_ENABLED !== 'false',
      cacheTimeout: parseInt(process.env.MCP_TOOL_CACHE_TIMEOUT) || 300000, // 5 minutes
      maxConcurrentCalls: parseInt(process.env.MCP_MAX_CONCURRENT_TOOLS) || 5,
      defaultTimeout: parseInt(process.env.MCP_TOOL_TIMEOUT) || 30000
    },

    // OAuth configurations
    oauth: {
      redirectUri: process.env.MCP_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      stateSecret: process.env.MCP_OAUTH_STATE_SECRET || 'your-state-secret',
      tokenStorage: process.env.MCP_TOKEN_STORAGE || 'file' // 'file' or 'database'
    }
  },

  // External API configuration
  external: {
    enabled: process.env.EXTERNAL_API_ENABLED === 'true',
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

  // AI configuration with Claude and OpenAI models
  ai: {
    provider: process.env.AI_PROVIDER || 'mixed',
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: 'https://api.anthropic.com'
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1'
    },
    models: {
      health: process.env.AI_HEALTH_MODEL || 'claude-3-5-sonnet-20241022',
      opportunities: process.env.AI_OPPORTUNITIES_MODEL || 'gpt-4o',
      risks: process.env.AI_RISKS_MODEL || 'claude-3-5-sonnet-20241022',
      recommendations: process.env.AI_RECOMMENDATIONS_MODEL || 'gpt-4o',
      insights: process.env.AI_INSIGHTS_MODEL || 'claude-3-5-sonnet-20241022'
    },
    maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 4000,
    temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.1,
    features: {
      analysis: process.env.AI_ANALYSIS_ENABLED !== 'false',
      recommendations: process.env.AI_RECOMMENDATIONS_ENABLED !== 'false',
      riskAssessment: process.env.AI_RISK_ASSESSMENT_ENABLED !== 'false',
      insights: process.env.AI_INSIGHTS_ENABLED !== 'false'
    }
  },

  // Data processing configuration
  data: {
    source: process.env.DATA_SOURCE || 'mcp',
    cacheEnabled: process.env.DATA_CACHE_ENABLED !== 'false',
    cacheDuration: parseInt(process.env.DATA_CACHE_DURATION) || 3600000, // 1 hour in ms
    batchSize: parseInt(process.env.DATA_BATCH_SIZE) || 100,
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.LOG_CONSOLE_ENABLED !== 'false',
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

  // n8n Workflow Automation Configuration
  n8n: {
    enabled: process.env.N8N_ENABLED !== 'false',
    baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
    apiKey: process.env.N8N_API_KEY,
    
    // Workflow execution settings
    execution: {
      timeout: parseInt(process.env.N8N_EXECUTION_TIMEOUT) || 300000, // 5 minutes
      retryAttempts: parseInt(process.env.N8N_RETRY_ATTEMPTS) || 2,
      retryDelay: parseInt(process.env.N8N_RETRY_DELAY) || 5000 // 5 seconds
    },

    // Integration settings
    integration: {
      klavisEnabled: process.env.N8N_KLAVIS_INTEGRATION !== 'false',
      aiIntegration: process.env.N8N_AI_INTEGRATION !== 'false',
      webhookBaseUrl: process.env.N8N_WEBHOOK_BASE_URL || 'http://localhost:5678/webhook'
    },

    // Workflow templates and defaults
    templates: {
      autoRegister: process.env.N8N_AUTO_REGISTER_TEMPLATES !== 'false',
      updateExisting: process.env.N8N_UPDATE_EXISTING_TEMPLATES === 'true'
    },

    // Security settings for n8n integration
    security: {
      validateSSL: process.env.N8N_VALIDATE_SSL !== 'false',
      allowedHosts: process.env.N8N_ALLOWED_HOSTS?.split(',') || ['localhost', '127.0.0.1'],
      encryptWorkflowData: process.env.N8N_ENCRYPT_WORKFLOW_DATA === 'true'
    }
  },

  // Workflow orchestration settings
  workflows: {
    engine: process.env.WORKFLOW_ENGINE || 'hybrid', // 'internal', 'n8n', or 'hybrid'
    defaultEngine: process.env.WORKFLOW_DEFAULT_ENGINE || 'internal',
    
    // Execution settings
    maxConcurrentWorkflows: parseInt(process.env.MAX_CONCURRENT_WORKFLOWS) || 5,
    workflowTimeout: parseInt(process.env.WORKFLOW_TIMEOUT) || 600000, // 10 minutes
    
    // Scheduling settings
    schedulerEnabled: process.env.WORKFLOW_SCHEDULER_ENABLED !== 'false',
    timezone: process.env.WORKFLOW_TIMEZONE || 'UTC',
    
    // Distribution settings
    distributors: {
      email: {
        enabled: process.env.EMAIL_DISTRIBUTOR_ENABLED !== 'false',
        defaultTemplate: process.env.EMAIL_DEFAULT_TEMPLATE || 'account-plan'
      },
      slack: {
        enabled: process.env.SLACK_DISTRIBUTOR_ENABLED !== 'false',
        defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || '#account-planning'
      },
      webhook: {
        enabled: process.env.WEBHOOK_DISTRIBUTOR_ENABLED !== 'false',
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 30000
      }
    }
  },

  // Security settings
  security: {
    enableRateLimit: process.env.SECURITY_RATE_LIMIT_ENABLED !== 'false',
    enableCORS: process.env.SECURITY_CORS_ENABLED === 'true' || false,
    allowedOrigins: process.env.SECURITY_ALLOWED_ORIGINS?.split(',') || ['localhost'],
    enableEncryption: process.env.SECURITY_ENCRYPTION_ENABLED === 'true' || false
  }
};
