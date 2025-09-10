import express from 'express';
import cors from 'cors';
import { WorkflowOrchestrator } from '../workflows/workflowOrchestrator.js';
import { createDemoAPI } from './demoAPI.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/logger.js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';

export class WorkflowAPI {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.app = express();
    this.orchestrator = new WorkflowOrchestrator(config);
    this.setupMiddleware();
    this.setupBullBoard();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: this.config.security?.allowedOrigins || ['http://localhost:3000'],
      credentials: true
    }));

    // JSON parsing with size limit
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve a simple static homepage for demo friendliness
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.app.use('/static', express.static(join(__dirname, '../../public')));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info('API Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupBullBoard() {
    // Initialize Bull Board for job monitoring
    try {
      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath('/admin/queues');

      this.bullBoard = createBullBoard({
        queues: [], // Will be populated after orchestrator initialization
        serverAdapter: serverAdapter,
      });

      this.app.use('/admin/queues', serverAdapter.getRouter());
      
      this.logger.info('🎯 Bull Board dashboard initialized at /admin/queues');
    } catch (error) {
      this.logger.warn('⚠️ Failed to initialize Bull Board dashboard', { error: error.message });
    }
  }

  setupRoutes() {
    // Health check
    // Dashboard route (main interface)
    this.app.get('/', (req, res) => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      res.sendFile(join(__dirname, '../../public/dashboard.html'));
    });

    // Simple ping
    this.app.get('/__ping', (_req, res) => res.type('text/plain').send('pong'));

    // Quietly ignore favicon to prevent 404 in browser console
    this.app.get('/favicon.ico', (_req, res) => res.status(204).end());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: this.config.app.version
      });
    });

    // Workflow management routes
    this.app.post('/workflows', this.createWorkflow.bind(this));
    this.app.get('/workflows', this.listWorkflows.bind(this));
    this.app.get('/workflows/:workflowId', this.getWorkflow.bind(this));
    this.app.put('/workflows/:workflowId', this.updateWorkflow.bind(this));
    this.app.delete('/workflows/:workflowId', this.deleteWorkflow.bind(this));
    
    // Workflow execution routes
    this.app.post('/workflows/:workflowId/execute', this.executeWorkflow.bind(this));
    this.app.post('/workflows/:workflowId/toggle', this.toggleWorkflow.bind(this));
    this.app.get('/workflows/:workflowId/history', this.getExecutionHistory.bind(this));
    
    // Quick action routes
    this.app.post('/quick/account-plan', this.quickAccountPlan.bind(this));
    this.app.post('/quick/distribute', this.quickDistribute.bind(this));
    
    // Integration status
    this.app.get('/integration/status', this.getIntegrationStatus.bind(this));

    // Minimal Klavis OAuth (demo stub)
    this.app.get('/auth/klavis/start', this.startKlavisAuth.bind(this));
    this.app.get('/auth/klavis/callback', this.klavisAuthCallback.bind(this));

    // Template routes
    this.app.get('/templates', this.getWorkflowTemplates.bind(this));
    this.app.post('/templates/:templateId/create', this.createFromTemplate.bind(this));

    // Job queue management routes
    this.app.get('/queue/stats', this.getQueueStats.bind(this));
    this.app.get('/queue/schedules', this.getAllSchedules.bind(this));
    this.app.delete('/queue/schedules/:workflowName', this.removeSchedule.bind(this));

    // Demo API routes
    this.app.use('/api', createDemoAPI(this.orchestrator));

    // robots.txt (avoid 404 noise in browsers/crawlers)
    this.app.get('/robots.txt', (_req, res) => {
      res.type('text/plain').send('User-agent: *\nDisallow: /');
    });

    // Catch-all for unknown GET routes: show index page instead of 404 for demo friendliness
    this.app.get(/.*/, (req, res, next) => {
      if (req.method !== 'GET') return next();
      // Avoid shadowing API routes that start with /workflows, /quick, /templates, /integration, /health, /auth
      if (/^(\/workflows|\/quick|\/templates|\/integration|\/health|\/auth|\/api\b)/.test(req.path)) return next();
      const port = process.env.WORKFLOW_PORT || 3001;
      res.type('html').send(`
        <!doctype html>
        <html>
        <head><meta charset=\"utf-8\"><title>AI Account Planner API</title></head>
        <body style=\"font-family: -apple-system, system-ui, Segoe UI, Roboto, Arial, sans-serif; padding: 20px;\">
          <h1>AI Account Planner API</h1>
          <p>Server is running. Try these endpoints:</p>
          <ul>
            <li><a href=\"/health\">/health</a></li>
            <li><a href=\"/integration/status\">/integration/status</a></li>
            <li><a href=\"/templates\">/templates</a> (GET)</li>
          </ul>
          <small>Port: ${port}</small>
        </body>
        </html>
      `);
    });

    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }

  async initialize() {
    await this.orchestrator.initialize();
    
    // Add queues to Bull Board after orchestrator initialization
    if (this.bullBoard && this.orchestrator.jobQueueService.isEnabled()) {
      try {
        const queues = this.orchestrator.jobQueueService.queues;
        for (const [queueName, queue] of queues.entries()) {
          this.bullBoard.addQueue(new BullMQAdapter(queue));
          this.logger.info('📊 Added queue to Bull Board dashboard', { queueName });
        }
      } catch (error) {
        this.logger.warn('⚠️ Failed to add queues to Bull Board', { error: error.message });
      }
    }
    
    this.logger.info('✅ Workflow API initialized');
  }

  // Workflow CRUD operations
  async createWorkflow(req, res) {
    try {
      const workflowConfig = req.body;
      
      // Validate required fields
      if (!workflowConfig.name || !workflowConfig.trigger || !workflowConfig.accounts) {
        return res.status(400).json({
          error: 'Missing required fields: name, trigger, accounts'
        });
      }

      const workflow = this.orchestrator.createWorkflow(workflowConfig);
      
      res.status(201).json({
        status: 'success',
        workflow
      });

    } catch (error) {
      this.logger.error('❌ Failed to create workflow', { error: error.message });
      res.status(500).json({
        error: 'Failed to create workflow',
        message: error.message
      });
    }
  }

  async listWorkflows(req, res) {
    try {
      const workflows = this.orchestrator.listWorkflows();
      
      res.json({
        status: 'success',
        workflows,
        count: workflows.length
      });

    } catch (error) {
      this.logger.error('❌ Failed to list workflows', { error: error.message });
      res.status(500).json({
        error: 'Failed to list workflows',
        message: error.message
      });
    }
  }

  async getWorkflow(req, res) {
    try {
      const { workflowId } = req.params;
      const workflow = this.orchestrator.getWorkflow(workflowId);
      
      if (!workflow) {
        return res.status(404).json({
          error: 'Workflow not found'
        });
      }

      res.json({
        status: 'success',
        workflow
      });

    } catch (error) {
      this.logger.error('❌ Failed to get workflow', { error: error.message });
      res.status(500).json({
        error: 'Failed to get workflow',
        message: error.message
      });
    }
  }

  async updateWorkflow(req, res) {
    try {
      const { workflowId } = req.params;
      const updates = req.body;
      
      const workflow = this.orchestrator.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({
          error: 'Workflow not found'
        });
      }

      // Update workflow properties
      Object.assign(workflow, updates);
      workflow.updatedAt = new Date().toISOString();

      res.json({
        status: 'success',
        workflow
      });

    } catch (error) {
      this.logger.error('❌ Failed to update workflow', { error: error.message });
      res.status(500).json({
        error: 'Failed to update workflow',
        message: error.message
      });
    }
  }

  async deleteWorkflow(req, res) {
    try {
      const { workflowId } = req.params;
      
      this.orchestrator.deleteWorkflow(workflowId);
      
      res.json({
        status: 'success',
        message: 'Workflow deleted successfully'
      });

    } catch (error) {
      this.logger.error('❌ Failed to delete workflow', { error: error.message });
      res.status(500).json({
        error: 'Failed to delete workflow',
        message: error.message
      });
    }
  }

  // Workflow execution
  async executeWorkflow(req, res) {
    try {
      const { workflowId } = req.params;
      const context = req.body.context || {};
      
      const result = await this.orchestrator.executeWorkflow(workflowId, {
        ...context,
        triggeredBy: 'api',
        apiRequest: true
      });

      res.json({
        status: 'success',
        execution: result
      });

    } catch (error) {
      this.logger.error('❌ Workflow execution failed', { error: error.message });
      res.status(500).json({
        error: 'Workflow execution failed',
        message: error.message
      });
    }
  }

  async toggleWorkflow(req, res) {
    try {
      const { workflowId } = req.params;
      const { enabled } = req.body;
      
      const workflow = this.orchestrator.toggleWorkflow(workflowId, enabled);
      
      res.json({
        status: 'success',
        workflow,
        message: `Workflow ${enabled ? 'enabled' : 'disabled'}`
      });

    } catch (error) {
      this.logger.error('❌ Failed to toggle workflow', { error: error.message });
      res.status(500).json({
        error: 'Failed to toggle workflow',
        message: error.message
      });
    }
  }

  async getExecutionHistory(req, res) {
    try {
      const { workflowId } = req.params;
      const { limit = 10 } = req.query;
      
      const history = this.orchestrator.getExecutionHistory(workflowId, parseInt(limit));
      
      res.json({
        status: 'success',
        history
      });

    } catch (error) {
      this.logger.error('❌ Failed to get execution history', { error: error.message });
      res.status(500).json({
        error: 'Failed to get execution history',
        message: error.message
      });
    }
  }

  // Quick actions for demonstrations
  async quickAccountPlan(req, res) {
    try {
      const { accountName, distributors = [] } = req.body;
      
      if (!accountName) {
        return res.status(400).json({
          error: 'accountName is required'
        });
      }

      // Create temporary workflow for quick execution
      const quickWorkflow = this.orchestrator.createWorkflow({
        name: `Quick Plan: ${accountName}`,
        description: 'One-time account plan generation',
        trigger: { type: 'manual' },
        accounts: [{ accountName }],
        distributors: distributors,
        enabled: true
      });

      // Execute immediately
      const result = await this.orchestrator.executeWorkflow(quickWorkflow.id, {
        triggeredBy: 'quick_action',
        apiRequest: true
      });

      // Clean up temporary workflow
      this.orchestrator.deleteWorkflow(quickWorkflow.id);

      res.json({
        status: 'success',
        accountName,
        execution: result
      });

    } catch (error) {
      this.logger.error('❌ Quick account plan failed', { error: error.message });
      res.status(500).json({
        error: 'Quick account plan failed',
        message: error.message
      });
    }
  }

  async quickDistribute(req, res) {
    try {
      const { accountName, accountPlan, distributors } = req.body;
      
      if (!accountName || !accountPlan || !distributors) {
        return res.status(400).json({
          error: 'accountName, accountPlan, and distributors are required'
        });
      }

      const context = {
        accountName,
        executionId: `quick-${Date.now()}`,
        timestamp: new Date().toISOString(),
        triggeredBy: 'quick_distribute'
      };

      const distributionResults = await this.orchestrator.distributeAccountPlan(
        accountPlan,
        distributors,
        accountName,
        context.executionId
      );

      res.json({
        status: 'success',
        accountName,
        distributionResults
      });

    } catch (error) {
      this.logger.error('❌ Quick distribute failed', { error: error.message });
      res.status(500).json({
        error: 'Quick distribute failed',
        message: error.message
      });
    }
  }

  // Workflow templates for easy setup
  async getWorkflowTemplates(req, res) {
    try {
      const templates = this.getBuiltInTemplates();
      
      res.json({
        status: 'success',
        templates
      });

    } catch (error) {
      this.logger.error('❌ Failed to get templates', { error: error.message });
      res.status(500).json({
        error: 'Failed to get templates',
        message: error.message
      });
    }
  }

  async createFromTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const { customizations = {} } = req.body;
      
      const template = this.getBuiltInTemplates().find(t => t.id === templateId);
      if (!template) {
        return res.status(404).json({
          error: 'Template not found'
        });
      }

      // Apply customizations to template
      const workflowConfig = {
        ...template.config,
        ...customizations,
        name: customizations.name || `${template.name} - ${new Date().toLocaleDateString()}`
      };

      const workflow = this.orchestrator.createWorkflow(workflowConfig);
      
      res.status(201).json({
        status: 'success',
        template: template.name,
        workflow
      });

    } catch (error) {
      this.logger.error('❌ Failed to create from template', { error: error.message });
      res.status(500).json({
        error: 'Failed to create from template',
        message: error.message
      });
    }
  }

  getBuiltInTemplates() {
    return [
      {
        id: 'daily-health-check',
        name: 'Daily Account Health Check',
        description: 'Monitor key accounts daily with Slack notifications',
        category: 'monitoring',
        config: {
          trigger: { type: 'schedule' },
          schedule: '0 9 * * *', // Daily at 9 AM
          accounts: [
            { accountName: 'stripe' },
            { accountName: 'microsoft' },
            { accountName: 'salesforce' }
          ],
          distributors: [
            {
              type: 'slack',
              config: {
                channels: [{ channel: '#account-health' }],
                format: 'summary',
                mentions: []
              }
            }
          ]
        }
      },
      {
        id: 'weekly-executive-report',
        name: 'Weekly Executive Account Report',
        description: 'Weekly comprehensive account plans via email',
        category: 'reporting',
        config: {
          trigger: { type: 'schedule' },
          schedule: '0 8 * * 1', // Monday at 8 AM
          accounts: [
            { accountName: 'stripe' }
          ],
          distributors: [
            {
              type: 'email',
              config: {
                recipients: [
                  { email: 'executives@company.com' }
                ],
                template: 'executive',
                subject: 'Weekly Executive Account Report'
              }
            },
            {
              type: 'crm',
              config: {
                actions: ['updateAccount', 'logActivity']
              }
            }
          ]
        }
      },
      {
        id: 'quarterly-strategic-review',
        name: 'Quarterly Strategic Account Review',
        description: 'Comprehensive quarterly analysis with all distributions',
        category: 'strategic',
        config: {
          trigger: { type: 'schedule' },
          schedule: '0 9 1 */3 *', // First day of quarter at 9 AM
          accounts: [
            { accountName: 'stripe' }
          ],
          distributors: [
            {
              type: 'email',
              config: {
                recipients: [
                  { email: 'strategy@company.com' }
                ],
                template: 'detailed',
                subject: 'Quarterly Strategic Account Review'
              }
            },
            {
              type: 'slack',
              config: {
                channels: [{ channel: '#strategy' }],
                format: 'detailed',
                mentions: ['U000STRAT']
              }
            },
            {
              type: 'crm',
              config: {
                actions: ['updateAccount', 'createTasks', 'updateOpportunities', 'logActivity']
              }
            }
          ]
        }
      },
      {
        id: 'risk-alert-workflow',
        name: 'Account Risk Alert Workflow',
        description: 'Immediate alerts when account health drops',
        category: 'alerts',
        config: {
          trigger: { type: 'event', event: 'health_score_drop' },
          accounts: [
            { accountName: 'stripe' }
          ],
          distributors: [
            {
              type: 'slack',
              config: {
                channels: [{ channel: '#alerts' }],
                format: 'alert',
                mentions: ['U000ACCTM']
              }
            },
            {
              type: 'email',
              config: {
                recipients: [
                  { email: 'alerts@company.com' }
                ],
                template: 'summary',
                subject: 'ALERT: Account Requires Attention'
              }
            }
          ]
        }
      }
    ];
  }

  async getIntegrationStatus(req, res) {
    try {
      const status = await this.orchestrator.dataManager.getStatus();
      res.json({ status: 'success', integration: status });
    } catch (error) {
      this.logger.error('❌ Failed to get integration status', { error: error.message });
      res.status(500).json({ error: 'Failed to get integration status', message: error.message });
    }
  }

  async startKlavisAuth(req, res) {
    try {
      const redirectUri = this.config.mcp?.oauth?.redirectUri || 'http://localhost:3001/auth/klavis/callback';
      const state = Buffer.from(JSON.stringify({ t: Date.now() })).toString('base64');
      res.json({
        status: 'success',
        message: 'Use your Klavis console to connect services, then return with code/token to callback.',
        redirectUri,
        state,
        callbackExample: `${redirectUri}?server=gmail&token=demo-token&state=${state}`
      });
    } catch (error) {
      this.logger.error('❌ Failed to start Klavis auth', { error: error.message });
      res.status(500).json({ error: 'Failed to start Klavis auth', message: error.message });
    }
  }

  async klavisAuthCallback(req, res) {
    try {
      const { server, token } = req.query;
      if (!server || !token) {
        return res.status(400).json({ error: 'server and token query params are required' });
      }
      const klavis = this.orchestrator.dataManager.getKlavisProvider?.();
      if (!klavis) {
        return res.status(400).json({ error: 'Klavis provider not initialized' });
      }
      await klavis.connectServer(server, { token });
      res.json({ status: 'success', connected: server });
    } catch (error) {
      this.logger.error('❌ Klavis auth callback failed', { error: error.message });
      res.status(500).json({ error: 'Klavis auth callback failed', message: error.message });
    }
  }

  // Error handling middleware
  errorHandler(error, req, res, next) {
    this.logger.error('❌ API Error', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      requestId: req.headers['x-request-id'] || 'unknown'
    });
  }

  // Job Queue Management Routes
  async getQueueStats(req, res) {
    try {
      const stats = await this.orchestrator.jobQueueService.getQueueStats();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('Failed to get queue stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllSchedules(req, res) {
    try {
      const schedules = await this.orchestrator.jobQueueService.redisService.getAllSchedules();
      res.json({
        success: true,
        data: schedules
      });
    } catch (error) {
      this.logger.error('Failed to get schedules', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async removeSchedule(req, res) {
    try {
      const { workflowName } = req.params;
      const result = await this.orchestrator.jobQueueService.removeScheduledWorkflow(workflowName);
      
      if (result) {
        res.json({
          success: true,
          message: `Schedule for ${workflowName} removed successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Schedule for ${workflowName} not found`
        });
      }
    } catch (error) {
      this.logger.error('Failed to remove schedule', { 
        workflowName: req.params.workflowName, 
        error: error.message 
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async start(port = 3001) {
    await this.initialize();
    
    this.server = this.app.listen(port, () => {
      this.logger.info(`🚀 Workflow API server started on port ${port}`);
    });

    return this.server;
  }

  async stop() {
    if (this.server) {
      this.server.close();
      await this.orchestrator.shutdown();
      this.logger.info('🛑 Workflow API server stopped');
    }
  }
}
