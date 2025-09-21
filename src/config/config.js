import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
// Ensure .env values take precedence over any pre-exported shell vars
// This avoids cases where placeholder keys exported in the shell shadow your .env
dotenv.config({ override: true });

// Load optional settings overrides from data/settings.json
function loadSettingsFile() {
  try {
    const p = path.resolve(process.cwd(), 'data/settings.json');
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore parse or fs errors, fall back to env/defaults
  }
  return {};
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (Array.isArray(srcVal)) {
      target[key] = srcVal.slice();
    } else if (srcVal && typeof srcVal === 'object') {
      target[key] = deepMerge(tgtVal && typeof tgtVal === 'object' ? { ...tgtVal } : {}, srcVal);
    } else {
      target[key] = srcVal;
    }
  }
  return target;
}

function parseJSONEnv(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    // Allow simple key:value,key:value fallback syntax
    const entries = value.split(',').map(pair => pair.trim()).filter(Boolean);
    if (entries.length === 0) return fallback;
    const parsed = {};
    for (const entry of entries) {
      const [k, v] = entry.split(':');
      if (k && v) parsed[k.trim()] = v.trim();
    }
    return Object.keys(parsed).length > 0 ? parsed : fallback;
  }
}

function parseStringSetEnv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

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
    userId: process.env.MCP_USER_ID,
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

    rateLimits: {
      default: {
        perMinute: parseInt(process.env.MCP_RATE_LIMIT_PER_MINUTE) || 60,
        perHour: parseInt(process.env.MCP_RATE_LIMIT_PER_HOUR) || 1000,
        perDay: parseInt(process.env.MCP_RATE_LIMIT_PER_DAY) || 20000,
        maxConcurrent: parseInt(process.env.MCP_RATE_LIMIT_MAX_CONCURRENT) || 1
      },
      servers: {
        gmail: {
          perMinute: process.env.MCP_GMAIL_RATE_LIMIT_PER_MINUTE ? parseInt(process.env.MCP_GMAIL_RATE_LIMIT_PER_MINUTE) : undefined,
          perHour: process.env.MCP_GMAIL_RATE_LIMIT_PER_HOUR ? parseInt(process.env.MCP_GMAIL_RATE_LIMIT_PER_HOUR) : undefined,
          perDay: process.env.MCP_GMAIL_RATE_LIMIT_PER_DAY ? parseInt(process.env.MCP_GMAIL_RATE_LIMIT_PER_DAY) : undefined
        },
        google_calendar: {
          perMinute: process.env.MCP_CALENDAR_RATE_LIMIT_PER_MINUTE ? parseInt(process.env.MCP_CALENDAR_RATE_LIMIT_PER_MINUTE) : undefined,
          perHour: process.env.MCP_CALENDAR_RATE_LIMIT_PER_HOUR ? parseInt(process.env.MCP_CALENDAR_RATE_LIMIT_PER_HOUR) : undefined,
          perDay: process.env.MCP_CALENDAR_RATE_LIMIT_PER_DAY ? parseInt(process.env.MCP_CALENDAR_RATE_LIMIT_PER_DAY) : undefined
        },
        google_drive: {
          perMinute: process.env.MCP_DRIVE_RATE_LIMIT_PER_MINUTE ? parseInt(process.env.MCP_DRIVE_RATE_LIMIT_PER_MINUTE) : undefined,
          perHour: process.env.MCP_DRIVE_RATE_LIMIT_PER_HOUR ? parseInt(process.env.MCP_DRIVE_RATE_LIMIT_PER_HOUR) : undefined,
          perDay: process.env.MCP_DRIVE_RATE_LIMIT_PER_DAY ? parseInt(process.env.MCP_DRIVE_RATE_LIMIT_PER_DAY) : undefined
        },
        slack: {
          perMinute: process.env.MCP_SLACK_RATE_LIMIT_PER_MINUTE ? parseInt(process.env.MCP_SLACK_RATE_LIMIT_PER_MINUTE) : undefined,
          perHour: process.env.MCP_SLACK_RATE_LIMIT_PER_HOUR ? parseInt(process.env.MCP_SLACK_RATE_LIMIT_PER_HOUR) : undefined,
          perDay: process.env.MCP_SLACK_RATE_LIMIT_PER_DAY ? parseInt(process.env.MCP_SLACK_RATE_LIMIT_PER_DAY) : undefined
        },
        notion: {
          perMinute: process.env.MCP_NOTION_RATE_LIMIT_PER_MINUTE ? parseInt(process.env.MCP_NOTION_RATE_LIMIT_PER_MINUTE) : undefined,
          perHour: process.env.MCP_NOTION_RATE_LIMIT_PER_HOUR ? parseInt(process.env.MCP_NOTION_RATE_LIMIT_PER_HOUR) : undefined,
          perDay: process.env.MCP_NOTION_RATE_LIMIT_PER_DAY ? parseInt(process.env.MCP_NOTION_RATE_LIMIT_PER_DAY) : undefined
        }
      }
    },

    // OAuth configurations
    oauth: {
      redirectUri: process.env.MCP_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
      stateSecret: process.env.MCP_OAUTH_STATE_SECRET || 'your-state-secret',
      tokenStorage: process.env.MCP_TOKEN_STORAGE || 'file' // 'file' or 'database'
    },

    tokenRefresh: {
      bufferSeconds: parseInt(process.env.MCP_TOKEN_REFRESH_BUFFER) || 120
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

  demo: {
    defaultProfile: process.env.DEMO_DEFAULT_PROFILE || 'enterprise-saas-expansion',
    anonymizeByDefault: process.env.DEMO_AUTO_ANONYMIZE !== 'false',
    maskNames: process.env.DEMO_MASK_NAMES === 'true',
    templateOverrides: parseJSONEnv(process.env.DEMO_TEMPLATE_OVERRIDES, {}),
    profiles: {
      include: parseStringSetEnv(process.env.DEMO_PROFILE_INCLUDE),
      exclude: parseStringSetEnv(process.env.DEMO_PROFILE_EXCLUDE)
    },
    dataset: {
      outputDir: process.env.DEMO_DATA_OUTPUT_DIR || path.resolve(process.cwd(), 'data/generated'),
      auditDir: process.env.DEMO_AUDIT_DIR || path.resolve(process.cwd(), 'logs/demo-audit'),
      retentionDays: parseInt(process.env.DEMO_DATA_RETENTION_DAYS) || 90
    },
    scheduling: {
      queue: process.env.DEMO_QUEUE_NAME || 'demo-data-pipeline',
      cron: process.env.DEMO_REFRESH_CRON || '0 * * * *',
      bulkBatchSize: parseInt(process.env.DEMO_BULK_BATCH_SIZE) || 5
    },
    quality: {
      targetScore: parseInt(process.env.DEMO_QUALITY_TARGET || '85'),
      baselineWeight: parseFloat(process.env.DEMO_QUALITY_BASELINE_WEIGHT || '0.4'),
      freshnessWindowDays: parseInt(process.env.DEMO_FRESHNESS_WINDOW_DAYS || '14')
    },
    lifecycle: {
      defaultCadenceDays: parseInt(process.env.DEMO_LIFECYCLE_DEFAULT_DAYS || '14')
    }
  },

  security: {
    okta: {
      enabled: process.env.OKTA_ENABLED === 'true',
      domain: process.env.OKTA_DOMAIN,
      authServerId: process.env.OKTA_AUTH_SERVER_ID || 'default',
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      redirectUri: process.env.OKTA_REDIRECT_URI || 'http://localhost:3001/auth/okta/callback',
      scopes: parseStringSetEnv(process.env.OKTA_SCOPES).length > 0 ? parseStringSetEnv(process.env.OKTA_SCOPES) : ['openid', 'profile', 'email'],
      audience: process.env.OKTA_AUDIENCE || 'api://default'
    }
  },

  integrations: {
    pipedream: {
      enabled: process.env.PIPEDREAM_ENABLED === 'true',
      clientId: process.env.PIPEDREAM_CLIENT_ID,
      clientSecret: process.env.PIPEDREAM_CLIENT_SECRET,
      authUrl: process.env.PIPEDREAM_AUTH_URL || 'https://oauth.pipedream.com/authorize',
      tokenUrl: process.env.PIPEDREAM_TOKEN_URL || 'https://oauth.pipedream.com/token',
      baseUrl: process.env.PIPEDREAM_BASE_URL || 'https://api.pipedream.com',
      defaultSource: process.env.PIPEDREAM_DEFAULT_SOURCE,
      eventWebhookUrl: process.env.PIPEDREAM_EVENT_WEBHOOK_URL,
      redirectUri: process.env.PIPEDREAM_REDIRECT_URI || 'http://localhost:3001/integration/oauth/pipedream/callback',
      scopes: parseStringSetEnv(process.env.PIPEDREAM_SCOPES || 'openid,profile,email')
    },
    peopleAI: {
      enabled: process.env.PEOPLE_AI_ENABLED === 'true',
      baseUrl: process.env.PEOPLE_AI_BASE_URL || 'https://api.people.ai',
      apiKey: process.env.PEOPLE_AI_API_KEY,
      connectorId: process.env.PEOPLE_AI_CONNECTOR_ID,
      pipedreamDestination: process.env.PEOPLE_AI_PIPEDREAM_DESTINATION
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
    // Optional customizable prompts (overridable via settings file)
    systemPrompt: process.env.AI_SYSTEM_PROMPT,
    toolSystemPrompt: process.env.AI_TOOL_SYSTEM_PROMPT,
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
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10,
    pipeline: {
      qualityThreshold: parseFloat(process.env.DATA_PIPELINE_QUALITY_THRESHOLD) || 0.75,
      recencyToleranceMs: parseInt(process.env.DATA_PIPELINE_RECENCY_MS) || 30_000,
      persistToPostgres: process.env.DATA_PIPELINE_PERSIST_TO_POSTGRES !== 'false',
      sourcePriority: process.env.DATA_PIPELINE_SOURCE_PRIORITY
        ? process.env.DATA_PIPELINE_SOURCE_PRIORITY.split(',').map(s => s.trim()).filter(Boolean)
        : ['klavis', 'sample', 'news', 'external'],
      realtime: {
        enabled: process.env.DATA_PIPELINE_REALTIME_ENABLED !== 'false',
        intervalMs: parseInt(process.env.DATA_PIPELINE_REALTIME_INTERVAL_MS) || 60_000,
        warmupMs: parseInt(process.env.DATA_PIPELINE_REALTIME_WARMUP_MS) || 5_000
      }
    }
  },

  // CRM distribution defaults and task orchestration
  crm: {
    enabled: process.env.CRM_ENABLED !== 'false',
    type: process.env.CRM_TYPE || 'salesforce',
    defaultOwnerId: process.env.CRM_TASK_DEFAULT_OWNER_ID || null,
    fallbackOwnerId: process.env.CRM_TASK_FALLBACK_OWNER_ID || null,
    escalationOwnerId: process.env.CRM_TASK_ESCALATION_OWNER_ID || null,
    ownerMappings: parseJSONEnv(process.env.CRM_TASK_OWNER_MAP),
    priorityMappings: parseJSONEnv(process.env.CRM_TASK_PRIORITY_MAP),
    statusMappings: parseJSONEnv(process.env.CRM_TASK_STATUS_MAP),
    defaultPriority: process.env.CRM_TASK_DEFAULT_PRIORITY || 'Medium',
    defaultStatus: process.env.CRM_TASK_DEFAULT_STATUS || 'Not Started',
    defaultType: process.env.CRM_TASK_DEFAULT_TYPE || 'AI Generated Task',
    escalation: {
      enabled: process.env.CRM_TASK_ESCALATION_ENABLED === 'true',
      threshold: process.env.CRM_TASK_ESCALATION_THRESHOLD || 'High',
      ownerId: process.env.CRM_TASK_ESCALATION_OWNER_ID || null,
      notify: parseStringSetEnv(process.env.CRM_TASK_ESCALATION_NOTIFY)
    },
    verification: {
      enabled: process.env.CRM_TASK_VERIFICATION_ENABLED !== 'false',
      maxAttempts: parseInt(process.env.CRM_TASK_VERIFICATION_ATTEMPTS) || 1,
      delayMs: parseInt(process.env.CRM_TASK_VERIFICATION_DELAY_MS) || 2000
    },
    dependency: {
      autoLinkPhases: process.env.CRM_TASK_AUTO_LINK_PHASES === 'true'
    },
    progressTTLSeconds: parseInt(process.env.CRM_TASK_PROGRESS_TTL) || 604800 // 7 days
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.LOG_CONSOLE_ENABLED !== 'false',
    enableFile: process.env.LOG_FILE_ENABLED === 'true' || false,
    filePath: process.env.LOG_FILE_PATH || './logs/app.log'
  },

  // Monitoring & alerting configuration
  monitoring: {
    pollInterval: parseInt(process.env.MONITORING_POLL_INTERVAL_MS) || 30000,
    defaultSlaTarget: parseFloat(process.env.MONITORING_DEFAULT_SLA_TARGET || '0.995'),
    alerting: {
      slackWebhook: process.env.ALERT_SLACK_WEBHOOK,
      emailRecipients: parseStringSetEnv(process.env.ALERT_EMAIL_RECIPIENTS),
      emailFrom: process.env.ALERT_EMAIL_FROM || process.env.SMTP_FROM,
      minRepeatMinutes: parseInt(process.env.ALERT_SUPPRESS_MINUTES) || 15
    },
    performance: {
      latencyP95Target: parseInt(process.env.PERF_LATENCY_P95_TARGET_MS) || 5000,
      latencyP99Target: parseInt(process.env.PERF_LATENCY_P99_TARGET_MS) || 10000,
      errorRateTarget: parseFloat(process.env.PERF_ERROR_RATE_TARGET || '0.01')
    }
  },

  reminders: {
    enabled: process.env.REMINDERS_ENABLED !== 'false',
    evaluationIntervalMs: parseInt(process.env.REMINDER_EVALUATION_INTERVAL_MS) || 60000,
    defaultSlackChannel: process.env.REMINDER_DEFAULT_SLACK_CHANNEL || '#account-health',
    escalationSlackChannel: process.env.REMINDER_ESCALATION_SLACK_CHANNEL || '#sales-leadership',
    defaultMentions: parseStringSetEnv(process.env.REMINDER_SLACK_MENTIONS),
    escalationMentions: parseStringSetEnv(process.env.REMINDER_ESCALATION_MENTIONS),
    defaultEmailRecipients: parseStringSetEnv(process.env.REMINDER_DEFAULT_EMAIL || 'account-team@example.com'),
    escalationEmailRecipients: parseStringSetEnv(process.env.REMINDER_ESCALATION_EMAIL || ''),
    maxEscalations: parseInt(process.env.REMINDER_MAX_ESCALATIONS) || 2,
    storagePath: process.env.REMINDER_STORAGE_PATH,
    thresholds: {
      critical: parseFloat(process.env.REMINDER_THRESHOLD_CRITICAL) || 40,
      high: parseFloat(process.env.REMINDER_THRESHOLD_HIGH) || 60,
      medium: parseFloat(process.env.REMINDER_THRESHOLD_MEDIUM) || 75
    },
    timings: {
      critical: {
        dueMinutes: parseInt(process.env.REMINDER_CRITICAL_DUE_MINUTES) || 60,
        escalationMinutes: parseInt(process.env.REMINDER_CRITICAL_ESCALATION_MINUTES) || 120
      },
      high: {
        dueMinutes: parseInt(process.env.REMINDER_HIGH_DUE_MINUTES) || 240,
        escalationMinutes: parseInt(process.env.REMINDER_HIGH_ESCALATION_MINUTES) || 480
      },
      medium: {
        dueMinutes: parseInt(process.env.REMINDER_MEDIUM_DUE_MINUTES) || 1440,
        escalationMinutes: parseInt(process.env.REMINDER_MEDIUM_ESCALATION_MINUTES) || 2880
      }
    }
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

// Apply settings overrides from file (if present)
const fileOverrides = loadSettingsFile();
deepMerge(config, fileOverrides);
