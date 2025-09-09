import { AccountPlannerApp } from './ai/planning/accountPlanner.js';
import { DataIntegrationManager } from './data/dataIntegrationManager.js';
import { Logger } from './utils/logger.js';
import { config } from './config/config.js';

// Initialize logger
const logger = new Logger(config);

async function main() {
  logger.info('🚀 Production AI Account Planner Starting...', {
    environment: config.app.environment,
    version: config.app.version
  });
  
  try {
    // Validate required configuration
    validateConfiguration();
    
    // Initialize data integration with Klavis MCP
    const dataManager = new DataIntegrationManager(config);
    await dataManager.initialize();
    
    // Initialize AI-powered account planner
    const accountPlanner = new AccountPlannerApp(dataManager, config);
    
    // Get account name from command line arguments or use default
    const accountName = process.argv[2] || 'stripe';
    
    logger.info(`🎯 Generating account plan for: ${accountName}`);
    
    // Generate comprehensive account plan
    const accountPlan = await accountPlanner.generateAccountPlan(accountName);
    
    logger.info('✅ Production Account Plan Generated Successfully', {
      accountName,
      opportunitiesCount: accountPlan.opportunityAnalysis.identifiedOpportunities.length,
      risksCount: accountPlan.riskAssessment.identifiedRisks.length,
      healthScore: accountPlan.accountOverview.healthScore.score
    });
    
    // Output the account plan
    console.log(JSON.stringify(accountPlan, null, 2));
    
  } catch (error) {
    logger.error('❌ Production Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

function validateConfiguration() {
  const required = [
    { key: 'KLAVIS_API_KEY', value: config.mcp.klavisApiKey },
    { key: 'MCP_ENABLED', value: config.mcp.enabled }
  ];

  // Check AI provider requirements
  if (config.ai.provider === 'mixed') {
    required.push(
      { key: 'OPENAI_API_KEY', value: config.ai.openai.apiKey },
      { key: 'ANTHROPIC_API_KEY', value: config.ai.anthropic.apiKey }
    );
  } else if (config.ai.provider === 'openai') {
    required.push({ key: 'OPENAI_API_KEY', value: config.ai.openai.apiKey });
  } else if (config.ai.provider === 'anthropic') {
    required.push({ key: 'ANTHROPIC_API_KEY', value: config.ai.anthropic.apiKey });
  }

  const missing = required.filter(item => !item.value);
  
  if (missing.length > 0) {
    const missingKeys = missing.map(item => item.key).join(', ');
    throw new Error(`Missing required environment variables: ${missingKeys}`);
  }

  if (!config.mcp.enabled) {
    throw new Error('MCP must be enabled for production use');
  }
  
  logger.info('✅ Configuration validated successfully');
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('🛑 Graceful shutdown initiated');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

main();