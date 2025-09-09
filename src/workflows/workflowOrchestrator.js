import { AccountPlannerApp } from '../ai/planning/accountPlanner.js';
import { DataIntegrationManager } from '../data/dataIntegrationManager.js';
import { EmailDistributor } from './distributors/emailDistributor.js';
import { SlackDistributor } from './distributors/slackDistributor.js';
import { CRMDistributor } from './distributors/crmDistributor.js';
import { N8nService } from './services/n8nService.js';
import { KlavisN8nBridge } from './services/klavisN8nBridge.js';
import { Logger } from '../utils/logger.js';
import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowOrchestrator {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.workflows = new Map();
    this.activeJobs = new Map();
    
    // Initialize distributors
    this.distributors = {
      email: new EmailDistributor(config),
      slack: new SlackDistributor(config),
      crm: new CRMDistributor(config)
    };
    
    // Initialize n8n service and bridge
    this.n8nService = new N8nService(config);
    this.klavisN8nBridge = null;
    this.n8nEnabled = config.n8n?.enabled !== false;
    
    // Initialize AI components
    this.dataManager = null;
    this.accountPlanner = null;
  }

  async initialize() {
    this.logger.info('🔄 Initializing Workflow Orchestrator...');
    
    try {
      // Initialize data integration
      this.dataManager = new DataIntegrationManager(this.config);
      await this.dataManager.initialize();
      
      // Initialize account planner
      this.accountPlanner = new AccountPlannerApp(this.dataManager, this.config);
      
      // Initialize all distributors
      await Promise.all([
        this.distributors.email.initialize(),
        this.distributors.slack.initialize(), 
        this.distributors.crm.initialize()
      ]);

      // Initialize n8n service if enabled
      if (this.n8nEnabled) {
        try {
          await this.n8nService.initialize();
          
          // Initialize Klavis-n8n bridge if MCP is available
          if (this.config.n8n?.integration?.klavisEnabled !== false) {
            this.klavisN8nBridge = new KlavisN8nBridge(this.config, this.dataManager.getKlavisProvider());
            await this.klavisN8nBridge.initialize();
            this.logger.info('✅ Klavis-n8n Bridge integrated successfully');
          }
          
          this.logger.info('✅ n8n Service integrated successfully');
        } catch (error) {
          this.logger.warn('⚠️ n8n Service initialization failed, continuing without n8n', {
            error: error.message
          });
          this.n8nEnabled = false;
        }
      }
      
      this.logger.info('✅ Workflow Orchestrator initialized successfully', {
        n8nEnabled: this.n8nEnabled
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize Workflow Orchestrator', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Create a new workflow
  async createWorkflow(workflowConfig) {
    const workflowId = uuidv4();
    
    const workflow = {
      id: workflowId,
      name: workflowConfig.name,
      description: workflowConfig.description,
      trigger: workflowConfig.trigger,
      accounts: workflowConfig.accounts || [],
      distributors: workflowConfig.distributors || [],
      schedule: workflowConfig.schedule,
      enabled: workflowConfig.enabled || true,
      createdAt: new Date().toISOString(),
      lastRun: null,
      status: 'created',
      engine: workflowConfig.engine || 'internal' // 'internal' or 'n8n'
    };

    this.workflows.set(workflowId, workflow);
    
    // Create in n8n if n8n engine is requested and available
    if (workflow.engine === 'n8n' && this.n8nEnabled) {
      try {
        const n8nWorkflow = await this.n8nService.createWorkflow(workflowConfig);
        workflow.n8nId = n8nWorkflow.n8nId;
        workflow.n8nActive = n8nWorkflow.active;
        this.logger.info('✅ n8n workflow created', { 
          workflowId, 
          n8nId: n8nWorkflow.n8nId 
        });
      } catch (error) {
        this.logger.warn('⚠️ Failed to create n8n workflow, using internal engine', {
          workflowId,
          error: error.message
        });
        workflow.engine = 'internal';
      }
    }
    
    // Schedule if it's a cron workflow and using internal engine
    if (workflow.engine === 'internal' && workflow.trigger.type === 'schedule' && workflow.schedule) {
      this.scheduleWorkflow(workflowId);
    }
    
    this.logger.info('✅ Workflow created', { 
      workflowId, 
      name: workflow.name,
      engine: workflow.engine
    });
    return workflow;
  }

  // Schedule a workflow with cron
  scheduleWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (this.activeJobs.has(workflowId)) {
      this.activeJobs.get(workflowId).destroy();
    }

    const job = new CronJob(
      workflow.schedule,
      () => this.executeWorkflow(workflowId),
      null,
      workflow.enabled,
      'UTC'
    );

    this.activeJobs.set(workflowId, job);
    this.logger.info('📅 Workflow scheduled', { workflowId, schedule: workflow.schedule });
  }

  // Execute a workflow
  async executeWorkflow(workflowId, context = {}) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = uuidv4();
    
    this.logger.info('🚀 Starting workflow execution', {
      workflowId,
      executionId,
      workflowName: workflow.name,
      engine: workflow.engine
    });

    try {
      workflow.status = 'running';
      workflow.lastRun = new Date().toISOString();

      let results;

      // Execute based on engine type
      if (workflow.engine === 'n8n' && this.n8nEnabled && workflow.n8nId) {
        results = await this.executeN8nWorkflow(workflow, context, executionId);
      } else {
        results = await this.executeInternalWorkflow(workflow, context, executionId);
      }

      workflow.status = 'completed';
      
      this.logger.info('✅ Workflow execution completed', {
        workflowId,
        executionId,
        engine: workflow.engine,
        processedAccounts: Array.isArray(results) ? results.length : 1
      });

      return {
        executionId,
        workflowId,
        engine: workflow.engine,
        status: 'success',
        results,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      workflow.status = 'failed';
      
      this.logger.error('❌ Workflow execution failed', {
        workflowId,
        executionId,
        engine: workflow.engine,
        error: error.message
      });

      throw error;
    }
  }

  // Execute workflow using internal engine
  async executeInternalWorkflow(workflow, context, executionId) {
    const results = [];

    // Process each account in the workflow
    for (const accountConfig of workflow.accounts) {
      const accountResult = await this.processAccount(
        accountConfig, 
        workflow.distributors,
        executionId,
        context
      );
      results.push(accountResult);
    }

    return results;
  }

  // Execute workflow using n8n engine
  async executeN8nWorkflow(workflow, context, executionId) {
    try {
      // Prepare input data for n8n
      const inputData = {
        workflowId: workflow.id,
        executionId,
        accounts: workflow.accounts,
        distributors: workflow.distributors,
        context,
        timestamp: new Date().toISOString()
      };

      // Execute n8n workflow
      const n8nExecution = await this.n8nService.executeWorkflow(workflow.n8nId, inputData);
      
      // Monitor execution status
      let executionStatus;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5-second intervals

      do {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        executionStatus = await this.n8nService.getExecutionStatus(n8nExecution.executionId);
        attempts++;
      } while (executionStatus.status === 'running' && attempts < maxAttempts);

      if (executionStatus.status === 'completed' && executionStatus.success) {
        this.logger.info('✅ n8n workflow completed successfully', {
          workflowId: workflow.id,
          n8nExecutionId: n8nExecution.executionId
        });
        
        return {
          n8nExecutionId: n8nExecution.executionId,
          results: executionStatus.data || [],
          executionTime: new Date(executionStatus.stoppedAt) - new Date(executionStatus.startedAt)
        };
      } else {
        throw new Error(`n8n execution failed: ${executionStatus.error || 'Unknown error'}`);
      }

    } catch (error) {
      this.logger.error('❌ n8n workflow execution failed', {
        workflowId: workflow.id,
        n8nId: workflow.n8nId,
        error: error.message
      });
      
      // Fallback to internal execution
      this.logger.info('🔄 Falling back to internal execution', {
        workflowId: workflow.id
      });
      
      return await this.executeInternalWorkflow(workflow, context, executionId);
    }
  }

  // Process a single account through the workflow
  async processAccount(accountConfig, distributorConfigs, executionId, context) {
    const { accountName, customization = {} } = accountConfig;
    
    this.logger.info('🎯 Processing account', { accountName, executionId });

    try {
      // Generate account plan using AI
      this.logger.info('🤖 Starting AI account plan generation', { accountName });
      const accountPlan = await this.accountPlanner.generateAccountPlan(accountName);
      this.logger.info('✅ AI account plan generated successfully', { accountName });
      
      // Add execution metadata
      accountPlan.execution = {
        executionId,
        processedAt: new Date().toISOString(),
        workflowContext: context
      };

      // Apply customizations
      const customizedPlan = this.applyCustomizations(accountPlan, customization);

      // Distribute through configured channels
      const distributionResults = await this.distributeAccountPlan(
        customizedPlan,
        distributorConfigs,
        accountName,
        executionId
      );

      return {
        accountName,
        status: 'success',
        accountPlan: customizedPlan,
        distributionResults,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('❌ Account processing failed', {
        accountName,
        executionId,
        error: error.message,
        stack: error.stack
      });

      return {
        accountName,
        status: 'failed',
        error: error.message,
        processedAt: new Date().toISOString()
      };
    }
  }

  // Apply customizations to account plan
  applyCustomizations(accountPlan, customization) {
    if (!customization || Object.keys(customization).length === 0) {
      return accountPlan;
    }

    const customized = { ...accountPlan };

    // Apply executive summary customization
    if (customization.executiveSummary) {
      customized.executiveSummary = {
        ...customized.executiveSummary,
        ...customization.executiveSummary
      };
    }

    // Apply focus areas
    if (customization.focusAreas) {
      customized.customization = {
        focusAreas: customization.focusAreas,
        appliedAt: new Date().toISOString()
      };
    }

    return customized;
  }

  // Distribute account plan through multiple channels
  async distributeAccountPlan(accountPlan, distributorConfigs, accountName, executionId) {
    const results = [];

    for (const distConfig of distributorConfigs) {
      try {
        const distributor = this.distributors[distConfig.type];
        if (!distributor) {
          throw new Error(`Unknown distributor type: ${distConfig.type}`);
        }

        const result = await distributor.distribute(
          accountPlan,
          distConfig.config,
          {
            accountName,
            executionId,
            timestamp: new Date().toISOString()
          }
        );

        results.push({
          type: distConfig.type,
          status: 'success',
          result,
          distributedAt: new Date().toISOString()
        });

        this.logger.info('✅ Distribution successful', {
          type: distConfig.type,
          accountName,
          executionId
        });

      } catch (error) {
        results.push({
          type: distConfig.type,
          status: 'failed',
          error: error.message,
          failedAt: new Date().toISOString()
        });

        this.logger.error('❌ Distribution failed', {
          type: distConfig.type,
          accountName,
          executionId,
          error: error.message
        });
      }
    }

    return results;
  }

  // Manual workflow trigger
  async triggerWorkflow(workflowId, context = {}) {
    return await this.executeWorkflow(workflowId, { 
      ...context, 
      trigger: 'manual',
      triggeredAt: new Date().toISOString() 
    });
  }

  // Get workflow status
  getWorkflow(workflowId) {
    return this.workflows.get(workflowId);
  }

  // List all workflows
  listWorkflows() {
    return Array.from(this.workflows.values());
  }

  // Enable/disable workflow
  toggleWorkflow(workflowId, enabled) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.enabled = enabled;

    if (workflow.trigger.type === 'schedule' && workflow.schedule) {
      if (enabled) {
        this.scheduleWorkflow(workflowId);
      } else {
        const job = this.activeJobs.get(workflowId);
        if (job) {
          job.destroy();
          this.activeJobs.delete(workflowId);
        }
      }
    }

    this.logger.info(`🔄 Workflow ${enabled ? 'enabled' : 'disabled'}`, { workflowId });
    return workflow;
  }

  // Delete workflow
  deleteWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Stop scheduled job if exists
    const job = this.activeJobs.get(workflowId);
    if (job) {
      job.destroy();
      this.activeJobs.delete(workflowId);
    }

    this.workflows.delete(workflowId);
    this.logger.info('🗑️ Workflow deleted', { workflowId });
  }

  // Get workflow execution history (stub for future implementation)
  getExecutionHistory(workflowId, limit = 10) {
    // This would typically fetch from a database
    return {
      workflowId,
      executions: [],
      message: 'Execution history would be stored in database for production'
    };
  }

  // n8n-specific workflow management methods
  async createN8nWorkflow(workflowConfig) {
    workflowConfig.engine = 'n8n';
    return await this.createWorkflow(workflowConfig);
  }

  async syncWithN8n() {
    if (!this.n8nEnabled) {
      throw new Error('n8n service not enabled');
    }

    try {
      const n8nWorkflows = await this.n8nService.listWorkflows();
      const syncResults = {
        total: n8nWorkflows.length,
        synced: 0,
        created: 0,
        errors: []
      };

      for (const n8nWorkflow of n8nWorkflows) {
        try {
          // Check if workflow exists locally
          const existingWorkflow = Array.from(this.workflows.values())
            .find(w => w.n8nId === n8nWorkflow.id);

          if (!existingWorkflow) {
            // Create local representation of n8n workflow
            const localWorkflow = {
              id: uuidv4(),
              name: n8nWorkflow.name,
              description: 'Synced from n8n',
              trigger: { type: 'external' },
              accounts: [],
              distributors: [],
              enabled: n8nWorkflow.active,
              createdAt: new Date().toISOString(),
              lastRun: null,
              status: 'synced',
              engine: 'n8n',
              n8nId: n8nWorkflow.id,
              n8nActive: n8nWorkflow.active
            };

            this.workflows.set(localWorkflow.id, localWorkflow);
            syncResults.created++;
          } else {
            syncResults.synced++;
          }
        } catch (error) {
          syncResults.errors.push({
            n8nId: n8nWorkflow.id,
            error: error.message
          });
        }
      }

      this.logger.info('🔄 n8n sync completed', syncResults);
      return syncResults;
    } catch (error) {
      this.logger.error('❌ n8n sync failed', { error: error.message });
      throw error;
    }
  }

  // Get n8n workflow execution history
  async getN8nExecutionHistory(workflowId, limit = 10) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.n8nId) {
      throw new Error('Workflow not found or not an n8n workflow');
    }

    try {
      const executions = await this.n8nService.getWorkflowExecutions(workflow.n8nId, limit);
      return executions.map(exec => ({
        executionId: exec.id,
        status: exec.finished ? (exec.success ? 'completed' : 'failed') : 'running',
        startedAt: exec.startedAt,
        stoppedAt: exec.stoppedAt,
        executionTime: exec.stoppedAt ? 
          new Date(exec.stoppedAt) - new Date(exec.startedAt) : null
      }));
    } catch (error) {
      this.logger.error('❌ Failed to get n8n execution history', {
        workflowId,
        error: error.message
      });
      throw error;
    }
  }

  // Toggle n8n workflow activation
  async toggleN8nWorkflow(workflowId, active) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.n8nId) {
      throw new Error('Workflow not found or not an n8n workflow');
    }

    try {
      await this.n8nService.toggleWorkflow(workflow.n8nId, active);
      workflow.enabled = active;
      workflow.n8nActive = active;
      
      this.logger.info(`🔄 n8n workflow ${active ? 'activated' : 'deactivated'}`, {
        workflowId,
        n8nId: workflow.n8nId
      });
      
      return workflow;
    } catch (error) {
      this.logger.error('❌ Failed to toggle n8n workflow', {
        workflowId,
        error: error.message
      });
      throw error;
    }
  }

  // Create Klavis-integrated n8n workflow
  async createKlavisN8nWorkflow(workflowConfig) {
    if (!this.n8nEnabled) {
      throw new Error('n8n service not enabled');
    }

    try {
      // Make Klavis provider available to n8n
      global.klavisProvider = this.dataManager.getKlavisProvider();
      
      const n8nWorkflow = await this.n8nService.createKlavisIntegratedWorkflow(workflowConfig);
      
      const workflow = {
        id: uuidv4(),
        name: workflowConfig.name,
        description: workflowConfig.description + ' (Klavis MCP Integrated)',
        trigger: workflowConfig.trigger,
        accounts: workflowConfig.accounts || [],
        distributors: workflowConfig.distributors || [],
        enabled: workflowConfig.enabled || true,
        createdAt: new Date().toISOString(),
        lastRun: null,
        status: 'created',
        engine: 'n8n',
        klavisIntegrated: true,
        n8nId: n8nWorkflow.n8nId,
        n8nActive: n8nWorkflow.active
      };

      this.workflows.set(workflow.id, workflow);
      
      this.logger.info('✅ Klavis-integrated n8n workflow created', {
        workflowId: workflow.id,
        n8nId: n8nWorkflow.n8nId
      });
      
      return workflow;
    } catch (error) {
      this.logger.error('❌ Failed to create Klavis n8n workflow', {
        error: error.message
      });
      throw error;
    }
  }

  // Shutdown orchestrator
  async shutdown() {
    this.logger.info('🛑 Shutting down Workflow Orchestrator...');
    
    // Stop all active jobs
    for (const [workflowId, job] of this.activeJobs.entries()) {
      job.destroy();
      this.logger.info('⏹️ Stopped workflow job', { workflowId });
    }
    
    this.activeJobs.clear();

    // Shutdown n8n service and bridge
    if (this.n8nEnabled) {
      if (this.klavisN8nBridge) {
        await this.klavisN8nBridge.shutdown();
      }
      await this.n8nService.shutdown();
    }
    
    this.logger.info('✅ Workflow Orchestrator shutdown complete');
  }
}