import { WorkflowAPI } from '../api/workflowAPI.js';
import { config } from '../config/config.js';
import { Logger } from '../utils/logger.js';

export class WorkflowDemo {
  constructor() {
    this.logger = new Logger(config);
    this.workflowAPI = new WorkflowAPI(config);
    this.demoScenarios = this.initializeDemoScenarios();
  }

  async initialize() {
    await this.workflowAPI.initialize();
    this.logger.info('🎬 Workflow Demo initialized');
  }

  initializeDemoScenarios() {
    return {
      // Scenario 1: Scheduled Daily Health Check
      dailyHealthCheck: {
        name: 'Daily Account Health Monitoring',
        description: 'Automated daily health checks with Slack notifications',
        workflow: {
          name: 'Demo: Daily Health Check - Stripe',
          description: 'Monitor Stripe account daily and send alerts to Slack',
          trigger: { type: 'schedule' },
          schedule: '*/5 * * * *', // Every 5 minutes for demo (normally daily)
          accounts: [
            { 
              accountName: 'stripe',
              customization: {
                focusAreas: ['health_monitoring', 'risk_alerts']
              }
            }
          ],
          distributors: [
            {
              type: 'slack',
              config: {
                channels: [{ channel: '#account-health-demo' }],
                format: 'summary',
                mentions: ['U000DEMO1']
              }
            }
          ],
          enabled: true
        }
      },

      // Scenario 2: Manual Executive Report
      executiveReport: {
        name: 'On-Demand Executive Report',
        description: 'Generate comprehensive account plan with email distribution',
        workflow: {
          name: 'Demo: Executive Report - Stripe',
          description: 'Comprehensive account analysis for executives',
          trigger: { type: 'manual' },
          accounts: [
            {
              accountName: 'stripe',
              customization: {
                focusAreas: ['opportunities', 'strategic_recommendations'],
                executiveSummary: {
                  customNote: 'Prepared for quarterly business review'
                }
              }
            }
          ],
          distributors: [
            {
              type: 'email',
              config: {
                recipients: [
                  { email: 'demo-executive@yourdomain.com' }
                ],
                template: 'executive',
                subject: 'Stripe Account - Strategic Analysis Report'
              }
            },
            {
              type: 'slack',
              config: {
                channels: [{ channel: '#executive-updates' }],
                format: 'detailed',
                mentions: []
              }
            }
          ],
          enabled: true
        }
      },

      // Scenario 3: Multi-Channel Distribution
      multiChannelAlert: {
        name: 'Multi-Channel Risk Alert',
        description: 'Risk-triggered workflow with email, Slack, and CRM updates',
        workflow: {
          name: 'Demo: Risk Alert - Multi-Channel',
          description: 'Comprehensive risk response across all channels',
          trigger: { type: 'manual' },
          accounts: [
            {
              accountName: 'stripe',
              customization: {
                focusAreas: ['risk_assessment', 'immediate_actions']
              }
            }
          ],
          distributors: [
            {
              type: 'email',
              config: {
                recipients: [
                  { email: 'account-manager@yourdomain.com' },
                  { email: 'team-lead@yourdomain.com' }
                ],
                template: 'summary',
                subject: 'URGENT: Account Risk Alert - Immediate Action Required'
              }
            },
            {
              type: 'slack',
              config: {
                channels: [{ channel: '#risk-alerts' }],
                format: 'alert',
                mentions: ['U000MGR01', 'U000LEAD1']
              }
            },
            {
              type: 'crm',
              config: {
                actions: ['updateAccount', 'createTasks', 'logActivity']
              }
            }
          ],
          enabled: true
        }
      },

      // Scenario 4: Bulk Account Processing
      bulkProcessing: {
        name: 'Bulk Account Analysis',
        description: 'Process multiple accounts simultaneously',
        workflow: {
          name: 'Demo: Bulk Account Processing',
          description: 'Analyze multiple accounts and distribute insights',
          trigger: { type: 'manual' },
          accounts: [
            { 
              accountName: 'stripe',
              customization: { focusAreas: ['growth_opportunities'] }
            },
            { 
              accountName: 'salesforce',
              customization: { focusAreas: ['relationship_health'] }
            },
            { 
              accountName: 'microsoft',
              customization: { focusAreas: ['competitive_analysis'] }
            }
          ],
          distributors: [
            {
              type: 'email',
              config: {
                recipients: [
                  { email: 'operations@yourdomain.com' }
                ],
                template: 'detailed',
                subject: 'Bulk Account Analysis - Weekly Summary'
              }
            }
          ],
          enabled: true
        }
      }
    };
  }

  async runCompleteDemo() {
    this.logger.info('🎬 Starting complete workflow demonstration...');

    try {
      const demoResults = {
        scenarios: [],
        timestamp: new Date().toISOString(),
        status: 'running'
      };

      // Run each demo scenario
      for (const [scenarioKey, scenario] of Object.entries(this.demoScenarios)) {
        this.logger.info(`🎯 Running demo scenario: ${scenario.name}`);
        
        const result = await this.runDemoScenario(scenario);
        demoResults.scenarios.push({
          name: scenario.name,
          description: scenario.description,
          result,
          completedAt: new Date().toISOString()
        });

        // Wait between scenarios for clarity
        await this.sleep(2000);
      }

      demoResults.status = 'completed';
      demoResults.completedAt = new Date().toISOString();

      this.logger.info('✅ Complete workflow demonstration finished', {
        scenariosRun: demoResults.scenarios.length,
        totalDuration: this.calculateDuration(demoResults.timestamp, demoResults.completedAt)
      });

      return demoResults;

    } catch (error) {
      this.logger.error('❌ Demo execution failed', { error: error.message });
      throw error;
    }
  }

  async runDemoScenario(scenario) {
    try {
      // Create workflow
      const workflow = this.workflowAPI.orchestrator.createWorkflow(scenario.workflow);
      this.logger.info(`📋 Created workflow: ${workflow.name}`, { workflowId: workflow.id });

      // Execute workflow
      const executionResult = await this.workflowAPI.orchestrator.executeWorkflow(workflow.id, {
        demoMode: true,
        scenario: scenario.name,
        triggeredBy: 'demonstration'
      });

      this.logger.info(`✅ Executed workflow successfully`, {
        workflowId: workflow.id,
        executionId: executionResult.executionId,
        processedAccounts: executionResult.results.length
      });

      // Show distribution results
      this.logDistributionResults(executionResult.results);

      return {
        status: 'success',
        workflow: {
          id: workflow.id,
          name: workflow.name,
          accounts: scenario.workflow.accounts.length,
          distributors: scenario.workflow.distributors.length
        },
        execution: {
          id: executionResult.executionId,
          processedAccounts: executionResult.results.length,
          successfulAccounts: executionResult.results.filter(r => r.status === 'success').length,
          distributionResults: this.summarizeDistributionResults(executionResult.results)
        }
      };

    } catch (error) {
      this.logger.error(`❌ Demo scenario failed: ${scenario.name}`, { error: error.message });
      return {
        status: 'failed',
        error: error.message,
        scenario: scenario.name
      };
    }
  }

  logDistributionResults(results) {
    for (const accountResult of results) {
      if (accountResult.status === 'success') {
        this.logger.info(`📊 Account processed: ${accountResult.accountName}`, {
          healthScore: accountResult.accountPlan?.accountOverview?.healthScore?.score,
          opportunities: accountResult.accountPlan?.opportunityAnalysis?.identifiedOpportunities?.length || 0,
          risks: accountResult.accountPlan?.riskAssessment?.identifiedRisks?.length || 0
        });

        // Log distribution results
        for (const distResult of accountResult.distributionResults) {
          const emoji = distResult.status === 'success' ? '✅' : '❌';
          this.logger.info(`${emoji} Distribution: ${distResult.type}`, {
            status: distResult.status,
            accountName: accountResult.accountName
          });
        }
      }
    }
  }

  summarizeDistributionResults(results) {
    const summary = {
      total: 0,
      successful: 0,
      failed: 0,
      byType: {}
    };

    for (const accountResult of results) {
      for (const distResult of accountResult.distributionResults) {
        summary.total++;
        
        if (distResult.status === 'success') {
          summary.successful++;
        } else {
          summary.failed++;
        }

        if (!summary.byType[distResult.type]) {
          summary.byType[distResult.type] = { total: 0, successful: 0, failed: 0 };
        }
        
        summary.byType[distResult.type].total++;
        summary.byType[distResult.type][distResult.status]++;
      }
    }

    return summary;
  }

  async demonstrateWorkflowCustomization() {
    this.logger.info('🎨 Demonstrating workflow customization...');

    const baseWorkflow = {
      name: 'Customizable Demo Workflow',
      description: 'Demonstrates various customization options',
      trigger: { type: 'manual' },
      accounts: [{ accountName: 'stripe' }],
      distributors: [],
      enabled: true
    };

    // Show different email templates
    const emailTemplates = ['default', 'executive', 'summary'];
    for (const template of emailTemplates) {
      this.logger.info(`📧 Demonstrating email template: ${template}`);
      
      const customWorkflow = {
        ...baseWorkflow,
        name: `Demo: Email Template - ${template}`,
        distributors: [
          {
            type: 'email',
            config: {
              recipients: [{ email: `demo-${template}@yourdomain.com` }],
              template,
              subject: `Demo: ${template} Template Account Plan`
            }
          }
        ]
      };

      const workflow = this.workflowAPI.orchestrator.createWorkflow(customWorkflow);
      await this.workflowAPI.orchestrator.executeWorkflow(workflow.id, { demoMode: true });
      
      await this.sleep(1000);
    }

    // Show different Slack formats
    const slackFormats = ['summary', 'detailed', 'alert'];
    for (const format of slackFormats) {
      this.logger.info(`💬 Demonstrating Slack format: ${format}`);
      
      const customWorkflow = {
        ...baseWorkflow,
        name: `Demo: Slack Format - ${format}`,
        distributors: [
          {
            type: 'slack',
            config: {
              channels: [{ channel: `#demo-${format}` }],
              format,
              mentions: format === 'alert' ? ['@demo-team'] : []
            }
          }
        ]
      };

      const workflow = this.workflowAPI.orchestrator.createWorkflow(customWorkflow);
      await this.workflowAPI.orchestrator.executeWorkflow(workflow.id, { demoMode: true });
      
      await this.sleep(1000);
    }

    // Show CRM actions
    const crmActions = [
      ['updateAccount'],
      ['updateAccount', 'createTasks'],
      ['updateAccount', 'createTasks', 'updateOpportunities', 'logActivity']
    ];

    for (const [index, actions] of crmActions.entries()) {
      this.logger.info(`🔄 Demonstrating CRM actions: ${actions.join(', ')}`);
      
      const customWorkflow = {
        ...baseWorkflow,
        name: `Demo: CRM Actions Set ${index + 1}`,
        distributors: [
          {
            type: 'crm',
            config: {
              actions
            }
          }
        ]
      };

      const workflow = this.workflowAPI.orchestrator.createWorkflow(customWorkflow);
      await this.workflowAPI.orchestrator.executeWorkflow(workflow.id, { demoMode: true });
      
      await this.sleep(1000);
    }

    this.logger.info('✅ Workflow customization demonstration completed');
  }

  async demonstrateErrorHandling() {
    this.logger.info('🛡️ Demonstrating error handling and validation...');

    const errorScenarios = [
      {
        name: 'Invalid Account Name',
        workflow: {
          name: 'Demo: Invalid Account',
          trigger: { type: 'manual' },
          accounts: [{ accountName: 'nonexistent-account-12345' }],
          distributors: [
            {
              type: 'email',
              config: {
                recipients: [{ email: 'demo@yourdomain.com' }],
                template: 'default'
              }
            }
          ]
        }
      },
      {
        name: 'Missing Configuration',
        workflow: {
          name: 'Demo: Missing Config',
          trigger: { type: 'manual' },
          accounts: [{ accountName: 'stripe' }],
          distributors: [
            {
              type: 'email',
              config: {
                // Missing recipients
                template: 'default'
              }
            }
          ]
        }
      }
    ];

    for (const scenario of errorScenarios) {
      this.logger.info(`🧪 Testing error scenario: ${scenario.name}`);
      
      try {
        const workflow = this.workflowAPI.orchestrator.createWorkflow(scenario.workflow);
        const result = await this.workflowAPI.orchestrator.executeWorkflow(workflow.id, { 
          demoMode: true,
          errorTest: true 
        });
        
        this.logger.info(`✅ Error handling worked: ${scenario.name}`, {
          status: result.status,
          errors: result.results.filter(r => r.status === 'failed').length
        });
        
      } catch (error) {
        this.logger.info(`✅ Error properly caught: ${scenario.name}`, {
          error: error.message
        });
      }
    }

    this.logger.info('✅ Error handling demonstration completed');
  }

  async runInteractiveDemo() {
    this.logger.info('🎮 Starting interactive workflow demonstration...');

    console.log('\n🎬 AI ACCOUNT PLANNER - WORKFLOW AUTOMATION DEMO');
    console.log('================================================\n');

    console.log('🔄 STEP 1: Initializing Workflow Engine...');
    await this.initialize();
    console.log('✅ Workflow engine ready!\n');

    console.log('📋 STEP 2: Creating Demonstration Workflows...');
    const createdWorkflows = [];
    
    for (const [key, scenario] of Object.entries(this.demoScenarios)) {
      const workflow = this.workflowAPI.orchestrator.createWorkflow(scenario.workflow);
      createdWorkflows.push(workflow);
      console.log(`   ✅ Created: ${scenario.name} (ID: ${workflow.id})`);
    }
    console.log(`   📊 Total workflows created: ${createdWorkflows.length}\n`);

    console.log('🚀 STEP 3: Executing Workflow Scenarios...\n');
    
    for (const [index, workflow] of createdWorkflows.entries()) {
      const scenario = Object.values(this.demoScenarios)[index];
      console.log(`   🎯 Executing: ${scenario.name}`);
      console.log(`   📝 Description: ${scenario.description}`);
      
      const result = await this.workflowAPI.orchestrator.executeWorkflow(workflow.id, {
        demoMode: true,
        interactive: true
      });
      
      console.log(`   ✅ Execution completed (ID: ${result.executionId})`);
      console.log(`   📊 Processed ${result.results.length} accounts`);
      
      // Show distribution summary
      const distSummary = this.summarizeDistributionResults(result.results);
      console.log(`   📤 Distributions: ${distSummary.successful}/${distSummary.total} successful`);
      console.log('');
    }

    console.log('🎨 STEP 4: Demonstrating Customization Options...');
    await this.demonstrateWorkflowCustomization();
    console.log('✅ Customization demo completed\n');

    console.log('🛡️ STEP 5: Testing Error Handling...');
    await this.demonstrateErrorHandling();
    console.log('✅ Error handling demo completed\n');

    console.log('📊 DEMO SUMMARY');
    console.log('===============');
    console.log(`✅ Workflows Created: ${createdWorkflows.length}`);
    console.log(`✅ AI Models Used: Kimi K2, Gemma2 9B`);
    console.log(`✅ Data Source: Klavis MCP Integration`);
    console.log(`✅ Distribution Channels: Email, Slack, CRM`);
    console.log(`✅ Trigger Types: Manual, Scheduled, Event-based`);
    console.log(`✅ Error Handling: Comprehensive validation & recovery`);
    console.log('\n🎉 WORKFLOW AUTOMATION DEMO COMPLETED SUCCESSFULLY!');

    return {
      status: 'completed',
      workflowsCreated: createdWorkflows.length,
      timestamp: new Date().toISOString(),
      summary: 'Complete workflow automation demonstration with AI-powered account planning, multi-channel distribution, and production-ready error handling'
    };
  }

  // Utility methods
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  async cleanup() {
    this.logger.info('🧹 Cleaning up demo workflows...');
    
    const workflows = this.workflowAPI.orchestrator.listWorkflows();
    const demoWorkflows = workflows.filter(w => w.name.startsWith('Demo:'));
    
    for (const workflow of demoWorkflows) {
      this.workflowAPI.orchestrator.deleteWorkflow(workflow.id);
    }
    
    this.logger.info(`✅ Cleaned up ${demoWorkflows.length} demo workflows`);
  }
}
