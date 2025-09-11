#!/usr/bin/env node

// Simple AI Account Planning Demo
// Lightweight version demonstrating daily coaching workflow with hardcoded responses
// Based on conversation requirements for demo engineering approach

import SimplifiedCoachingEngine from './simple-coaching-engine.js';
import SimplifiedDistribution from './simple-distribution.js';
import { stripeGTMData } from './simple-demo-data.js';

class SimpleAccountPlanningDemo {
  constructor() {
    this.coachingEngine = new SimplifiedCoachingEngine();
    this.distribution = new SimplifiedDistribution();
    this.demoStartTime = Date.now();
  }

  async runCompleteDemo(accountName = 'stripe', distributionMode = 'all') {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 AI ACCOUNT PLANNER - SIMPLIFIED DEMO');
    console.log('   Daily Coaching Workflow with Hardcoded Responses');
    console.log('='.repeat(80));
    console.log(`📋 Account: ${accountName.toUpperCase()}`);
    console.log(`📅 Demo Date: ${new Date().toLocaleDateString()}`);
    console.log(`🔧 Mode: Demo Engineering (Consistent Results)`);
    console.log(`📊 Data Source: Hardcoded GTM Sample Data`);
    console.log(`🤖 AI Engine: Simplified (No External API Calls)`);
    console.log('─'.repeat(80));

    try {
      // Step 1: Simulate External Data Integration (MCP-like)
      console.log('\n🔄 STEP 1: Simulating External Data Integration...');
      console.log('   (In production: Klavis MCP → Gmail, Calendar, Slack, CRM)');
      
      const externalData = await this.coachingEngine.fetchExternalData(accountName);
      console.log(`   ✅ Fetched ${externalData.dataPoints.emailThreads} email threads`);
      console.log(`   ✅ Fetched ${externalData.dataPoints.callTranscripts} call transcripts`);
      console.log(`   ✅ Identified ${externalData.dataPoints.stakeholders} key stakeholders`);
      console.log(`   ✅ Last activity: ${externalData.dataPoints.lastActivity}`);

      // Step 2: Generate AI-Powered Account Plan
      console.log('\n🧠 STEP 2: Generating AI-Powered Account Plan...');
      console.log('   (In production: Mixed AI models - Claude 3.5 + GPT-4o)');
      
      const accountPlan = await this.coachingEngine.generateAccountPlan(accountName);
      console.log(`   ✅ Account health analyzed: ${accountPlan.accountOverview.healthScore.score}/100`);
      console.log(`   ✅ Opportunities identified: ${accountPlan.opportunityAnalysis.identifiedOpportunities.length}`);
      console.log(`   ✅ Risks assessed: ${accountPlan.riskAssessment.identifiedRisks.length}`);
      console.log(`   ✅ Strategic recommendations: ${accountPlan.strategicRecommendations.immediateActions.length}`);

      // Step 3: Generate Daily Coaching Message
      console.log('\n💡 STEP 3: Generating Daily Coaching Message...');
      console.log('   (The "Slack message" concept from conversation)');
      
      const dailyCoaching = await this.coachingEngine.generateDailyCoaching(accountName);
      
      // Display the coaching message (like the Slack example from conversation)
      this.displayDailyCoaching(dailyCoaching);

      // Step 4: Automated Workflow Distribution
      console.log('\n📤 STEP 4: Automated Workflow Distribution...');
      console.log('   (Email, Slack, CRM integrations)');
      
      const distributionConfig = this.getDistributionConfig(distributionMode);
      const distributionResults = await this.distribution.distributeAccountPlan(accountPlan, distributionConfig);

      // Step 5: Show Results Summary
      console.log('\n📊 STEP 5: Demo Results Summary');
      this.displayDemoSummary(accountPlan, distributionResults);

      // Show what this accomplishes (from conversation context)
      this.displayDemoValue();

      return {
        status: 'success',
        account: accountName,
        executionTime: Date.now() - this.demoStartTime,
        accountPlan: accountPlan,
        dailyCoaching: dailyCoaching,
        distributionResults: distributionResults
      };

    } catch (error) {
      console.error('\n❌ DEMO EXECUTION FAILED');
      console.error(`Error: ${error.message}`);
      
      this.showTroubleshooting();
      
      return {
        status: 'failed',
        error: error.message,
        executionTime: Date.now() - this.demoStartTime
      };
    }
  }

  // Display the daily coaching message (key concept from conversation)
  displayDailyCoaching(coaching) {
    console.log('\n📱 DAILY COACHING MESSAGE (Slack/Email):');
    console.log('─'.repeat(60));
    
    // Show it as it would appear in Slack (from conversation example)
    const lines = coaching.coachingMessage.split('\n');
    lines.forEach(line => {
      console.log(line);
    });
    
    console.log('─'.repeat(60));
    console.log(`   📅 Generated: ${coaching.date}`);
    console.log(`   🎯 Focus Areas: ${coaching.focusAreas.join(', ')}`);
    console.log(`   📈 Success Metrics: ${coaching.successMetrics.length} defined`);
  }

  // Get distribution configuration based on mode
  getDistributionConfig(mode) {
    const configs = {
      email: [
        {
          type: 'email',
          recipients: ['sales-manager@example.com', 'account-team@example.com'],
          subject: '[DAILY COACHING] Stripe Account - Priority Actions Required',
          template: 'coaching'
        }
      ],
      slack: [
        {
          type: 'slack',
          channels: ['#account-coaching', '#sales-team'],
          format: 'summary',
          mentions: ['@sales-manager', '@account-owner']
        }
      ],
      crm: [
        {
          type: 'crm',
          actions: ['updateAccount', 'createTasks', 'logActivity']
        }
      ],
      all: [
        {
          type: 'email',
          recipients: ['demo@example.com'],
          subject: '[DEMO] Daily Account Coaching - Stripe',
          template: 'default'
        },
        {
          type: 'slack',
          channels: ['#demo-coaching'],
          format: 'summary',
          mentions: []
        },
        {
          type: 'crm',
          actions: ['updateAccount']
        }
      ]
    };

    return configs[mode] || configs.all;
  }

  // Display demo summary
  displayDemoSummary(accountPlan, distributionResults) {
    const executionTime = (Date.now() - this.demoStartTime) / 1000;
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ DEMO EXECUTION COMPLETED');
    console.log('='.repeat(80));
    console.log(`⏱️  Total Execution Time: ${executionTime.toFixed(2)} seconds`);
    console.log(`📋 Account Analyzed: ${accountPlan.accountName || 'Stripe'}`);
    console.log(`🏥 Health Score: ${accountPlan.accountOverview.healthScore.score}/100`);
    console.log(`💰 Pipeline Value: ${accountPlan.opportunityAnalysis.totalPipelineValue}`);
    console.log(`⚠️  Risk Level: ${accountPlan.riskAssessment.overallRiskLevel}`);
    
    console.log('\n📤 Distribution Results:');
    distributionResults.forEach(result => {
      const status = result.status === 'sent' || result.status === 'posted' || result.status === 'updated' ? '✅' : '❌';
      console.log(`   ${status} ${result.type.toUpperCase()}: ${result.status}`);
    });

    console.log('\n🎯 Key Opportunities:');
    accountPlan.opportunityAnalysis.identifiedOpportunities.slice(0, 3).forEach((opp, i) => {
      console.log(`   ${i + 1}. ${opp.title} (${opp.value})`);
    });

    console.log('\n⚠️  Top Risks:');
    accountPlan.riskAssessment.identifiedRisks.slice(0, 2).forEach((risk, i) => {
      console.log(`   ${i + 1}. ${risk.risk} (${risk.severity})`);
    });
  }

  // Display the demo value proposition (from conversation context)
  displayDemoValue() {
    console.log('\n' + '─'.repeat(80));
    console.log('💡 WHAT THIS DEMO ACCOMPLISHES:');
    console.log('─'.repeat(80));
    console.log('✅ Simulates daily coaching workflow (like Slack example from conversation)');
    console.log('✅ Demonstrates AI-powered account planning with external data integration');
    console.log('✅ Shows automated distribution to multiple channels (Email, Slack, CRM)');
    console.log('✅ Provides consistent, hardcoded responses for reliable demos');
    console.log('✅ Illustrates end-to-end GTM workflow automation');
    console.log('✅ Focuses on demo engineering approach vs. production complexity');
    
    console.log('\n🎯 DEMO ENGINEERING PHILOSOPHY:');
    console.log('• Hardcoded responses ensure same result every time');
    console.log('• Realistic data that tells a compelling story');
    console.log('• Focus on "how it would work" vs. "making it fully work"');
    console.log('• Quick to set up and demonstrate core value proposition');
    console.log('• No external dependencies or API failures during demos');
    
    console.log('\n🚀 PRODUCTION DIFFERENCES:');
    console.log('• Real MCP integration with Klavis (Gmail, Calendar, Slack, etc.)');
    console.log('• Live AI models (Claude 3.5 Sonnet + GPT-4o)');
    console.log('• Actual email/Slack/CRM integrations');
    console.log('• Dynamic data processing and real-time insights');
    console.log('• Configurable triggers (schedule, events, manual)');
    
    console.log('\n' + '='.repeat(80) + '\n');
  }

  showTroubleshooting() {
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('• This is a simplified demo with no external dependencies');
    console.log('• All responses are hardcoded for consistency');
    console.log('• Check that you\'re using Node.js with ES module support');
    console.log('• Try: node --version (should be 18+)');
  }

  // Interactive demo mode
  async runInteractiveDemo() {
    console.log('\n🎮 INTERACTIVE DEMO MODE');
    console.log('Choose your demo scenario:\n');
    console.log('1. 📧 Email Distribution Demo');
    console.log('2. 💬 Slack Coaching Demo'); 
    console.log('3. 🔄 CRM Integration Demo');
    console.log('4. 🎯 Complete Workflow Demo');
    console.log('5. 📊 Account Analysis Only\n');

    // For demo purposes, we'll run the complete workflow
    console.log('Running complete workflow demo...\n');
    return await this.runCompleteDemo('stripe', 'all');
  }

  // Show sample data (for presentation purposes)
  showSampleData() {
    console.log('\n📊 SAMPLE GTM DATA OVERVIEW:');
    console.log('─'.repeat(60));
    console.log(`Email Threads: ${stripeGTMData.emailThreads.length}`);
    console.log(`Call Transcripts: ${stripeGTMData.callTranscripts.length}`);
    console.log(`Stripe Team Members: ${stripeGTMData.personas.stripeTeam.length}`);
    console.log(`Customer Stakeholders: ${stripeGTMData.personas.customerStakeholders.length}`);
    console.log(`Current Opportunities: ${stripeGTMData.currentState.opportunities.length}`);
    console.log(`Current Challenges: ${stripeGTMData.currentState.challenges.length}`);
    
    console.log('\n📧 Sample Email Threads:');
    stripeGTMData.emailThreads.slice(0, 3).forEach((thread, i) => {
      console.log(`   ${i + 1}. ${thread.subject} (${thread.type})`);
    });

    console.log('\n📞 Sample Call Transcripts:');
    stripeGTMData.callTranscripts.forEach((call, i) => {
      console.log(`   ${i + 1}. ${call.title} (${call.type})`);
    });
  }
}

// Main execution
async function main() {
  const demo = new SimpleAccountPlanningDemo();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  const account = args[1] || 'stripe';
  const mode = args[2] || 'all';

  switch (command) {
    case 'interactive':
      await demo.runInteractiveDemo();
      break;
    case 'data':
      demo.showSampleData();
      break;
    case 'run':
    default:
      await demo.runCompleteDemo(account, mode);
      break;
  }
}

// Handle command line help
if (process.argv.length === 2 || process.argv.includes('--help')) {
  console.log('\n🎯 Simple AI Account Planning Demo');
  console.log('Usage: node simple-demo.js [command] [account] [mode]');
  console.log('\nCommands:');
  console.log('  run         Run complete demo (default)');
  console.log('  interactive Run interactive demo');
  console.log('  data        Show sample data overview');
  console.log('\nAccounts:');
  console.log('  stripe      Stripe account demo (default)');
  console.log('\nModes:');
  console.log('  all         Email + Slack + CRM (default)');
  console.log('  email       Email distribution only');
  console.log('  slack       Slack coaching only');
  console.log('  crm         CRM updates only');
  console.log('\nExamples:');
  console.log('  node simple-demo.js');
  console.log('  node simple-demo.js run stripe slack');
  console.log('  node simple-demo.js interactive');
  console.log('  node simple-demo.js data\n');
  process.exit(0);
}

// Run the demo
main().catch(error => {
  console.error('\n❌ Demo failed:', error.message);
  process.exit(1);
});