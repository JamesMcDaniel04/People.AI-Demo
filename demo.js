#!/usr/bin/env node
import { config } from 'dotenv';
import { WorkflowOrchestrator } from './src/workflows/workflowOrchestrator.js';
import { Logger } from './src/utils/logger.js';

// Load environment variables
config();

const logger = new Logger();

async function runDemo() {
  const accountName = process.argv[2] || 'Stripe';
  const recipientEmail = process.argv[3] || 'demo@example.com';

  console.log('\n' + '='.repeat(80));
  console.log('🚀 AI ACCOUNT PLANNER - DEMO MODE');
  console.log('='.repeat(80));
  console.log(`📋 Account: ${accountName}`);
  console.log(`📧 Email: ${recipientEmail}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Data Source: ${process.env.DATA_SOURCE || 'sample'}`);
  console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'mixed'}`);
  console.log(`📮 Email Mode: ${process.env.DEMO_MODE === 'true' ? 'Mock' : 'Real (Postmark)'}`);
  console.log('─'.repeat(80));

  try {
    // Initialize workflow orchestrator
    console.log('🔄 Initializing AI Account Planner...');
    const orchestrator = new WorkflowOrchestrator({
      env: process.env.NODE_ENV,
      dataSource: process.env.DATA_SOURCE,
      aiProvider: process.env.AI_PROVIDER,
      n8n: { enabled: false }
    });
    
    await orchestrator.initialize();
    console.log('✅ AI Account Planner initialized successfully\n');

    // Create demo workflow
    console.log('🎯 Creating demo workflow...');
    const demoWorkflow = {
      name: `CLI Demo: ${accountName} Account Plan`,
      description: 'CLI-triggered demo account plan generation',
      trigger: { type: 'manual' },
      accounts: [
        {
          accountName,
          customization: {
            focusAreas: ['growth', 'retention', 'expansion', 'competitive_analysis']
          }
        }
      ],
      distributors: [
        {
          type: 'email',
          config: {
            recipients: [{ email: recipientEmail }],
            subject: `[DEMO] Account Plan: ${accountName}`,
            template: 'default'
          }
        }
      ],
      enabled: true,
      engine: 'internal'
    };

    const workflow = await orchestrator.createWorkflow(demoWorkflow);
    console.log(`✅ Demo workflow created: ${workflow.id}\n`);

    // Execute workflow
    console.log('🚀 Executing account plan generation...');
    const startTime = Date.now();
    
    const execution = await orchestrator.executeWorkflow(workflow.id, {
      trigger: 'cli-demo',
      requestedBy: 'command-line',
      timestamp: new Date().toISOString()
    });

    const executionTime = Date.now() - startTime;

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('✅ DEMO EXECUTION COMPLETED');
    console.log('='.repeat(80));
    console.log(`⏱️  Execution Time: ${(executionTime / 1000).toFixed(2)} seconds`);
    console.log(`🆔 Execution ID: ${execution.executionId}`);
    console.log(`📊 Status: ${execution.status}`);
    
    if (execution.results && execution.results.length > 0) {
      const result = execution.results[0];
      console.log(`📋 Account: ${result.accountName}`);
      console.log(`✅ Account Plan Generated: ${result.status === 'success' ? 'Yes' : 'No'}`);
      
      if (result.distributionResults) {
        console.log('\n📧 Distribution Results:');
        result.distributionResults.forEach(dist => {
          console.log(`   ${dist.type}: ${dist.status} ${dist.result?.sentCount ? `(${dist.result.sentCount} sent)` : ''}`);
        });
      }

      if (result.accountPlan) {
        const plan = result.accountPlan;
        console.log('\n📊 Account Plan Summary:');
        console.log(`   Health Score: ${plan.accountOverview?.healthScore?.score || 'N/A'}/100`);
        console.log(`   Opportunities: ${plan.opportunityAnalysis?.identifiedOpportunities?.length || 0}`);
        console.log(`   Risks: ${plan.riskAssessment?.identifiedRisks?.length || 0}`);
        console.log(`   Stakeholders: ${plan.stakeholderMap?.keyStakeholders?.length || 0}`);
        
        if (plan.executiveSummary?.keyHighlights?.length > 0) {
          console.log('\n🎯 Key Highlights:');
          plan.executiveSummary.keyHighlights.slice(0, 3).forEach((highlight, i) => {
            console.log(`   ${i + 1}. ${highlight}`);
          });
        }
      }
    }

    console.log('\n' + '─'.repeat(80));
    console.log('🎉 Demo completed successfully!');
    
    if (process.env.DEMO_MODE !== 'true') {
      console.log(`📧 Check your email at ${recipientEmail} for the full account plan.`);
    }
    
    console.log('='.repeat(80) + '\n');

    // Cleanup
    await orchestrator.shutdown();
    process.exit(0);

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ DEMO EXECUTION FAILED');
    console.error('='.repeat(80));
    console.error(`Error: ${error.message}`);
    
    // Provide specific troubleshooting based on error type
    if (error.message.includes('API key')) {
      console.error('\n🔑 API Key Issue:');
      console.error('   • Check ANTHROPIC_API_KEY in .env file');
      console.error('   • Check OPENAI_API_KEY in .env file');
      console.error('   • Verify SMTP_API_KEY for email delivery');
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      console.error('\n🌐 Network Issue:');
      console.error('   • Check internet connectivity');
      console.error('   • Verify API endpoints are accessible');
      console.error('   • Try running with DEMO_MODE=true for offline demo');
    } else if (error.message.includes('data') || error.message.includes('file')) {
      console.error('\n📊 Data Issue:');
      console.error('   • Ensure sample data files exist in src/data/sample/');
      console.error('   • Try running `npm run workflow` first to verify data loading');
    } else {
      console.error('\n🔧 General Troubleshooting:');
      console.error('   • Check your .env file configuration');
      console.error('   • Ensure all required dependencies are installed');
      console.error('   • Run `npm run validate` to check system health');
      console.error('   • Check the logs for detailed error information');
    }
    
    console.error('\n📋 Configuration Check:');
    console.error(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.error(`   DATA_SOURCE: ${process.env.DATA_SOURCE || 'not set'}`);
    console.error(`   AI_PROVIDER: ${process.env.AI_PROVIDER || 'not set'}`);
    console.error(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET'}`);
    console.error(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'set' : 'NOT SET'}`);
    console.error(`   SMTP_API_KEY: ${process.env.SMTP_API_KEY ? 'set' : 'NOT SET'}`);
    console.error('\n' + '='.repeat(80) + '\n');
    
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.length < 3) {
  console.log('\n🚀 AI Account Planner Demo');
  console.log('Usage: node demo.js <account-name> [recipient-email]');
  console.log('\nExamples:');
  console.log('  node demo.js "Stripe"');
  console.log('  node demo.js "Acme Retail" "john@example.com"');
  console.log('\nAvailable sample accounts:');
  console.log('  • Stripe');
  console.log('  • Acme Retail');
  console.log('  • NorthStar Logistics');
  console.log('  • TechForward Solutions');
  console.log('  • GlobalCorp Industries\n');
  process.exit(0);
}

// Run the demo
runDemo();