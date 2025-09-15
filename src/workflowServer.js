import { WorkflowAPI } from './api/workflowAPI.js';
import { WorkflowDemo } from './demo/workflowDemo.js';
import { config } from './config/config.js';
import { Logger } from './utils/logger.js';

class WorkflowServer {
  constructor() {
    this.logger = new Logger(config);
    this.workflowAPI = new WorkflowAPI(config);
    this.demo = new WorkflowDemo();
    this.server = null;
  }

  async start() {
    this.logger.info('🚀 Starting AI Account Planner Workflow Server...');

    try {
      // Validate environment
      this.validateEnvironment();

      // Start the API server
      const port = process.env.WORKFLOW_PORT || 3001;
      this.server = await this.workflowAPI.start(port);

      this.logger.info('✅ Workflow Server started successfully', {
        port,
        environment: config.app.environment,
        apiEndpoints: [
          `http://localhost:${port}/health`,
          `http://localhost:${port}/workflows`,
          `http://localhost:${port}/templates`,
          `http://localhost:${port}/quick/account-plan`
        ]
      });

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      // Check if demo mode is requested
      if (process.argv.includes('--demo') || process.argv.includes('-d')) {
        await this.runDemo();
      }

      if (process.argv.includes('--interactive') || process.argv.includes('-i')) {
        await this.runInteractiveDemo();
      }

    } catch (error) {
      this.logger.error('❌ Failed to start Workflow Server', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  validateEnvironment() {
    const source = (config.data?.source || 'mcp').toLowerCase();
    const assessmentMode = process.env.ASSESSMENT_MODE === 'true' || process.env.ASSESSMENT_PRELOAD === 'true';
    const required = [];

    // Require AI keys based on provider
    if (!assessmentMode) {
      if (config.ai.provider === 'mixed') {
        required.push(
          { key: 'ANTHROPIC_API_KEY', value: config.ai.anthropic.apiKey },
          { key: 'OPENAI_API_KEY', value: config.ai.openai.apiKey }
        );
      } else if (config.ai.provider === 'openai') {
        required.push({ key: 'OPENAI_API_KEY', value: config.ai.openai.apiKey });
      } else if (config.ai.provider === 'anthropic') {
        required.push({ key: 'ANTHROPIC_API_KEY', value: config.ai.anthropic.apiKey });
      }
    }

    // Only require Klavis when using MCP
    if (source === 'mcp' && !assessmentMode) {
      required.push(
        { key: 'MCP_ENABLED', value: config.mcp.enabled },
        { key: 'KLAVIS_API_KEY', value: config.mcp.klavisApiKey }
      );
    }

    const missing = required.filter(item => !item.value);
    if (missing.length > 0) {
      const missingKeys = missing.map(item => item.key).join(', ');
      if (assessmentMode) {
        this.logger.warn('⚠️ Missing env vars (running in assessment mode with fallbacks)', { missingKeys });
      } else {
        throw new Error(`Missing required environment variables: ${missingKeys}`);
      }
    }

    // Log configuration status
    this.logger.info('✅ Environment validated', {
      aiProvider: config.ai.provider,
      aiModels: Object.keys(config.ai.models),
      dataSource: source,
      mcpEnabled: config.mcp.enabled,
      environment: config.app.environment,
      assessmentMode
    });
  }

  async runDemo() {
    this.logger.info('🎬 Running automated workflow demonstration...');
    
    try {
      const demoResults = await this.demo.runCompleteDemo();
      
      this.logger.info('✅ Demonstration completed successfully', {
        scenarios: demoResults.scenarios.length,
        duration: this.calculateDuration(demoResults.timestamp, demoResults.completedAt)
      });

      // Display demo summary
      console.log('\n🎉 WORKFLOW DEMONSTRATION SUMMARY');
      console.log('================================');
      
      for (const scenario of demoResults.scenarios) {
        const status = scenario.result.status === 'success' ? '✅' : '❌';
        console.log(`${status} ${scenario.name}`);
        
        if (scenario.result.status === 'success') {
          const exec = scenario.result.execution;
          console.log(`   📊 Processed: ${exec.processedAccounts} accounts`);
          console.log(`   📤 Distributions: ${exec.distributionResults.successful}/${exec.distributionResults.total}`);
        }
      }
      
      console.log(`\n🕒 Total Duration: ${this.calculateDuration(demoResults.timestamp, demoResults.completedAt)}`);
      console.log('🌐 API Server: Running for continued interaction\n');

    } catch (error) {
      this.logger.error('❌ Demo execution failed', { error: error.message });
    }
  }

  async runInteractiveDemo() {
    this.logger.info('🎮 Starting interactive demonstration...');
    
    try {
      await this.demo.runInteractiveDemo();
    } catch (error) {
      this.logger.error('❌ Interactive demo failed', { error: error.message });
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`🛑 Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.workflowAPI.stop();
        await this.demo.cleanup();
        this.logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('❌ Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', { promise, reason });
      process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', { 
        error: error.message, 
        stack: error.stack 
      });
      process.exit(1);
    });
  }

  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
}

// CLI help
function showHelp() {
  console.log(`
🎯 AI Account Planner - Workflow Automation Server

USAGE:
  npm run workflow                    # Start API server only
  npm run workflow -- --demo         # Run automated demonstration
  npm run workflow -- --interactive  # Run interactive demonstration
  npm run workflow -- --help         # Show this help

ENDPOINTS:
  GET  /health                        # Health check
  GET  /workflows                     # List workflows  
  POST /workflows                     # Create workflow
  POST /workflows/:id/execute         # Execute workflow
  GET  /templates                     # Get workflow templates
  POST /quick/account-plan            # Quick account plan generation

ENVIRONMENT VARIABLES:
  OPENAI_API_KEY                      # Required: OpenAI API key
  ANTHROPIC_API_KEY                   # Required: Anthropic API key
  KLAVIS_API_KEY                      # Required: Klavis MCP key (if DATA_SOURCE=mcp)
  WORKFLOW_PORT                       # Optional: Server port (default: 3001)
  SMTP_HOST, SMTP_USER, SMTP_PASS     # Optional: Email configuration
  SLACK_BOT_TOKEN                     # Optional: Slack integration
  CRM_TYPE, CRM_ACCESS_TOKEN          # Optional: CRM integration

DEMO SCENARIOS:
  1. Scheduled Health Monitoring      # Daily account health checks
  2. Executive Report Generation      # Comprehensive account analysis
  3. Multi-Channel Risk Alerts       # Email + Slack + CRM distribution
  4. Bulk Account Processing          # Multiple account analysis

For more information, see CLAUDE.md or visit the API endpoints.
`);
}

// Main execution
async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    return;
  }

  const server = new WorkflowServer();
  await server.start();
}

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  });
}

export { WorkflowServer };
