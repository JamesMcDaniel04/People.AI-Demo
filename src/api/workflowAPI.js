import express from 'express';
import cors from 'cors';
import { WorkflowOrchestrator } from '../workflows/workflowOrchestrator.js';
import { MixedAIService } from '../ai/services/mixedAIService.js';
import { createDemoAPI } from './demoAPI.js';
import { createGraphAPI } from './graphAPI.js';
import { createAuthAPI } from './authAPI.js';
import { createSettingsAPI } from './settingsAPI.js';
import { createPeopleAIAPI } from './peopleAIAPI.js';
import { createInstructorAPI } from './instructorAPI.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Logger } from '../utils/logger.js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { metrics } from '../services/metricsService.js';
import { createMonitoringService } from '../services/monitoringService.js';
import { createAlertService } from '../services/alertService.js';
import { v4 as uuidv4 } from 'uuid';

export class WorkflowAPI {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.app = express();
    this.orchestrator = new WorkflowOrchestrator(config);
    this.alertService = createAlertService(config);
    this.monitoringService = createMonitoringService(config, {
      alertService: this.alertService,
      getPostgresService: () => this.orchestrator.postgresService
    });
    this.monitoringInitialized = false;
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

    // Correlation ID + Request logging + latency
    this.app.use((req, res, next) => {
      const correlationId = req.headers['x-correlation-id'] || uuidv4();
      res.setHeader('x-correlation-id', correlationId);
      req.correlationId = correlationId;
      const t = metrics.time(`http:${req.method}:${req.path}`);
      res.on('finish', () => {
        t.finish(res.statusCode < 500);
      });
      this.logger.info('API Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        correlationId
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
    // Homepage: Unified Dashboard (includes Demo + Chat)
    this.app.get('/', (req, res) => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      res.sendFile(join(__dirname, '../../public/dashboard.html'));
    });
    // Alias for direct dashboard path
    this.app.get('/dashboard', (req, res) => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      res.sendFile(join(__dirname, '../../public/dashboard.html'));
    });
    this.app.get('/monitoring', (req, res) => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      res.sendFile(join(__dirname, '../../public/monitoring.html'));
    });
    this.app.get('/dataset', (req, res) => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      res.sendFile(join(__dirname, '../../public/dataset.html'));
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
        version: this.config.app.version,
        correlationId: req.correlationId
      });
    });

    // Simple metrics snapshot
    this.app.get('/metrics', (_req, res) => {
      res.json(metrics.snapshot());
    });

    // QA metrics evaluation
    this.app.get('/metrics/qa', (req, res) => {
      const snap = metrics.snapshot();
      const p95Threshold = parseInt(process.env.LATENCY_P95_THRESHOLD_MS || '8000');
      const hardFail = parseInt(process.env.LATENCY_P95_HARD_FAIL_MS || '12000');
      const keys = [
        'http:GET:/health',
        'http:GET:/instructor',
        'http:POST:/instructor/run'
      ];
      const results = {};
      let pass = true; let hard = false;
      for (const k of keys) {
        const t = snap.timings[k] || {};
        const p95 = t.p95 || 0;
        const ok = p95 === 0 || p95 <= p95Threshold;
        const hf = p95 > hardFail;
        pass = pass && ok;
        hard = hard || hf;
        results[k] = { p95, pass: ok, hardFail: hf };
      }
      res.json({ pass: pass && !hard, hardFail: hard, thresholdMs: p95Threshold, hardFailMs: hardFail, results });
    });

    // Monitoring endpoints
    this.app.get('/monitoring/dashboard', (req, res) => {
      if (!this.monitoringService) {
        return res.status(503).json({ error: 'Monitoring service not available' });
      }
      res.json(this.monitoringService.getDashboardSnapshot());
    });

    this.app.get('/monitoring/pipeline', (req, res) => {
      if (!this.monitoringService) {
        return res.status(503).json({ error: 'Monitoring service not available' });
      }
      const summary = this.monitoringService.getPipelineSnapshot();
      if (!summary) {
        return res.status(204).end();
      }
      res.json(summary);
    });

    this.app.get('/monitoring/health', (req, res) => {
      if (!this.monitoringService) {
        return res.status(503).json({ error: 'Monitoring service not available' });
      }
      const snapshot = this.monitoringService.getDashboardSnapshot();
      res.json({
        status: snapshot.overallStatus,
        generatedAt: snapshot.generatedAt,
        components: snapshot.components.map(item => ({
          name: item.name,
          status: item.state.status,
          lastChecked: item.state.lastChecked,
          responseTimeMs: item.state.responseTimeMs,
          availability: item.state.availability,
          slaTarget: item.slaTarget
        })),
        performance: snapshot.performance
      });
    });

    this.app.get('/monitoring/incidents', (req, res) => {
      if (!this.monitoringService) {
        return res.status(503).json({ error: 'Monitoring service not available' });
      }
      const limit = parseInt(req.query.limit || '50');
      res.json({
        incidents: this.monitoringService.getIncidents(Number.isNaN(limit) ? 50 : limit)
      });
    });

    this.app.post('/monitoring/trigger', async (req, res) => {
      if (!this.monitoringService) {
        return res.status(503).json({ error: 'Monitoring service not available' });
      }
      try {
        const component = req.body?.component;
        let state = null;
        if (component) {
          state = await this.monitoringService.evaluateComponent(component);
        } else {
          await this.monitoringService.evaluateAll();
        }
        res.json({
          status: 'ok',
          checkedAt: new Date().toISOString(),
          component: component || null,
          state
        });
      } catch (error) {
        this.logger.error('Manual monitoring trigger failed', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/monitoring/stream', (req, res) => {
      if (!this.monitoringService) {
        return res.status(503).end();
      }
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (res.flushHeaders) {
        res.flushHeaders();
      }

      const send = (payload) => {
        try {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (err) {
          this.logger.warn('SSE send failed', { error: err.message });
        }
      };

      send({ type: 'snapshot', snapshot: this.monitoringService.getDashboardSnapshot() });

      const unsubscribe = this.monitoringService.subscribe(send);
      const heartbeat = setInterval(() => {
        try {
          res.write(': keep-alive\n\n');
        } catch (err) {
          this.logger.warn('SSE heartbeat failed', { error: err.message });
          clearInterval(heartbeat);
          unsubscribe();
          res.end();
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
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
    this.app.post('/external/sync', this.syncExternal.bind(this));
    this.app.get('/data/:account/summary', this.getDataSummary.bind(this));
    this.app.get('/status/distribution', this.getDistributionStatus.bind(this));

    // Reminder coordination
    this.app.get('/reminders', this.listReminders.bind(this));
    this.app.get('/reminders/summary', this.getReminderSummary.bind(this));
    this.app.post('/reminders', this.createReminder.bind(this));
    this.app.post('/reminders/:id/acknowledge', this.acknowledgeReminder.bind(this));
    this.app.post('/reminders/:id/snooze', this.snoozeReminder.bind(this));
    this.app.post('/reminders/:id/escalate', this.escalateReminder.bind(this));
    this.app.post('/reminders/evaluate', this.evaluateReminders.bind(this));

    // Minimal Klavis OAuth (demo stub)
    this.app.get('/auth/klavis/start', this.startKlavisAuth.bind(this));
    this.app.get('/auth/klavis/callback', this.klavisAuthCallback.bind(this));

    // Template routes
    this.app.get('/templates', this.getWorkflowTemplates.bind(this));
    this.app.post('/templates/:templateId/create', this.createFromTemplate.bind(this));

    // Instructor API and simple UI
    this.app.use('/instructor', createInstructorAPI(this.orchestrator, this.config));
    this.app.get('/instructor', (req, res) => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      res.sendFile(join(__dirname, '../../public/instructor.html'));
    });

    // Job queue management routes
    this.app.get('/queue/stats', this.getQueueStats.bind(this));
    this.app.get('/queue/schedules', this.getAllSchedules.bind(this));
    this.app.put('/queue/schedules/:workflowName', this.updateSchedule.bind(this));
    this.app.delete('/queue/schedules/:workflowName', this.removeSchedule.bind(this));

    // Demo API routes
    this.app.use('/api', createDemoAPI(this.orchestrator));
    
    // Authentication API routes (Supabase Auth)
    this.app.use('/auth', createAuthAPI(this.orchestrator.supabaseService, this.config));
    
    // Graph API routes (Neo4j Knowledge Graph)
    this.app.use('/graph', createGraphAPI(this.orchestrator, this.orchestrator.dataManager, this.config));

    // Settings API (UI configuration, prompts, scheduling preferences)
    this.app.use('/settings', createSettingsAPI(this.orchestrator, this.config));
    // People.ai Demo Integration API (mocked orchestrator integration)
    this.app.use('/peopleai', createPeopleAIAPI(this.orchestrator, this.config));
    // Simple chat endpoint backed by configured LLMs
    this.app.post('/settings/chat', async (req, res) => {
      try {
        const { messages = [], system, provider, modelName, useTools } = req.body || {};
        const configOverride = { ...this.config, ai: { ...this.config.ai } };
        if (provider && ['openai', 'anthropic', 'mixed'].includes(provider)) {
          configOverride.ai.provider = provider;
        }
        const ai = new MixedAIService(configOverride, this.orchestrator?.dataManager?.getKlavisProvider?.() || null);
        // Compose prompt from chat messages
        const text = messages.map(m => `${m.role || 'user'}: ${m.content || ''}`).join('\n');
        const opts = { systemOverride: system || this.config.ai.systemPrompt, temperature: this.config.ai.temperature, max_tokens: this.config.ai.maxTokens };
        let content;
        if (useTools) {
          content = await ai.generateCompletionWithTools(text, modelName || (configOverride.ai.provider === 'openai' ? configOverride.ai.models.opportunities : configOverride.ai.models.health), opts);
        } else {
          content = await ai.generateCompletion(text, modelName || (configOverride.ai.provider === 'openai' ? configOverride.ai.models.opportunities : configOverride.ai.models.health), opts);
        }
        res.json({ ok: true, reply: content });
      } catch (err) {
        this.logger.error('Chat error', { error: err.message });
        res.status(500).json({ ok: false, error: err.message });
      }
    });

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

    await this.setupMonitoring().catch(error => {
      this.logger.warn('⚠️ Monitoring setup skipped', { error: error.message });
    });

    // Preload assessment-focused scheduled workflows if enabled by env
    try {
      await this.setupAssessmentDefaults();
    } catch (e) {
      this.logger.warn('⚠️ Assessment defaults setup skipped', { error: e.message });
    }
  }

  async setupMonitoring() {
    if (!this.monitoringService || this.monitoringInitialized) {
      return;
    }

    const register = (name, config) => {
      try {
        this.monitoringService.registerComponent(name, config);
      } catch (error) {
        this.logger.warn('Monitoring component registration failed', { component: name, error: error.message });
      }
    };

    register('api-server', {
      description: 'Workflow API server',
      critical: true,
      tags: ['api'],
      check: async () => ({
        status: 'healthy',
        details: {
          uptimeSeconds: Math.round(process.uptime()),
          memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
          pid: process.pid
        }
      })
    });

    const jobQueueService = this.orchestrator.jobQueueService;
    if (jobQueueService) {
      register('job-queue', {
        description: 'BullMQ job queue',
        critical: true,
        tags: ['queue'],
        check: async () => jobQueueService.healthCheck()
      });

      if (jobQueueService.redisService) {
        register('redis', {
          description: 'Redis connection',
          critical: true,
          tags: ['cache', 'queue'],
          check: async () => jobQueueService.redisService.healthCheck()
        });
      }
    }

    if (this.orchestrator.postgresService) {
      register('postgres', {
        description: 'PostgreSQL backing store',
        critical: true,
        tags: ['database'],
        check: async () => this.orchestrator.postgresService.healthCheck()
      });
    }

    if (this.orchestrator.supabaseService) {
      register('supabase', {
        description: 'Supabase authentication',
        tags: ['auth'],
        check: async () => this.orchestrator.supabaseService.healthCheck()
      });
    }

    if (this.orchestrator.graphService) {
      register('neo4j', {
        description: 'Neo4j knowledge graph',
        tags: ['graph'],
        check: async () => this.orchestrator.graphService.healthCheck()
      });
    }

    if (this.orchestrator.n8nEnabled && this.orchestrator.n8nService) {
      register('n8n', {
        description: 'n8n workflow runner',
        tags: ['automation'],
        check: async () => {
          try {
            const ok = await this.orchestrator.n8nService.healthCheck();
            return ok === true ? { status: 'healthy' } : ok;
          } catch (error) {
            return { status: 'unhealthy', error: error.message };
          }
        }
      });
    }

    if (this.orchestrator.dataManager?.getStatus) {
      register('data-integration', {
        description: 'Data integration providers',
        tags: ['data'],
        check: async () => {
          try {
            const status = await this.orchestrator.dataManager.getStatus();
            return { status: 'healthy', details: status };
          } catch (error) {
            return { status: 'degraded', error: error.message };
          }
        }
      });
    }

    this.monitoringService.start();
    await this.monitoringService.evaluateAll();
    this.monitoringInitialized = true;
  }

  // Pre-install a minimal set of workflows that directly map to the assessment requirements
  async setupAssessmentDefaults() {
    const preload = process.env.ASSESSMENT_PRELOAD === 'true';
    if (!preload) return;

    const accountsEnv = process.env.ASSESSMENT_ACCOUNTS || 'stripe,acme retail,healthtrack.io';
    const accounts = accountsEnv.split(',').map(a => a.trim()).filter(Boolean).map(a => ({ accountName: a }));
    const slackChannel = process.env.ASSESSMENT_SLACK_CHANNEL || process.env.SLACK_DEFAULT_CHANNEL || '#account-planning';
    const execEmail = process.env.ASSESSMENT_EXEC_EMAIL || 'executives@company.com';

    const daily = {
      name: 'Daily Account Health (Assessment)',
      description: 'Daily health summary to Slack for key accounts',
      trigger: { type: 'schedule' },
      schedule: '0 9 * * *',
      accounts,
      distributors: [
        { type: 'slack', config: { channels: [{ channel: slackChannel }], format: 'summary', mentions: [] } }
      ],
      enabled: true,
      engine: 'internal'
    };

    const weekly = {
      name: 'Weekly Executive Report (Assessment)',
      description: 'Weekly detailed account plan to executives via email',
      trigger: { type: 'schedule' },
      schedule: '0 8 * * 1',
      accounts: accounts.slice(0, 1),
      distributors: [
        { type: 'email', config: { recipients: [{ email: execEmail }], template: 'executive', subject: 'Weekly Executive Account Report' } }
      ],
      enabled: true,
      engine: 'internal'
    };

    const ensure = async (wf) => {
      try {
        const created = await this.orchestrator.createWorkflow(wf);
        this.logger.info('✅ Assessment workflow created', { name: created.name, schedule: created.schedule });
      } catch (err) {
        this.logger.warn('⚠️ Could not create assessment workflow', { name: wf.name, error: err.message });
      }
    };

    await ensure(daily);
    await ensure(weekly);
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

      const workflow = await this.orchestrator.createWorkflow(workflowConfig);
      
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
      const waitForCompletion = req.body?.waitForCompletion === true;
      const context = req.body.context || {};
      if (req.correlationId) context.correlationId = req.correlationId;

      const workflow = this.orchestrator.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      const executionPromise = this.orchestrator.executeWorkflow(workflowId, {
        ...context,
        triggeredBy: 'api',
        apiRequest: true
      });

      if (waitForCompletion) {
        const result = await executionPromise;
        return res.json({
          status: 'success',
          execution: result
        });
      }

      executionPromise.catch(error => {
        this.logger.error('❌ Workflow execution failed (async)', {
          workflowId,
          error: error.message
        });
      });

      res.json({
        status: 'accepted',
        message: 'Workflow execution started in the background'
      });

    } catch (error) {
      this.logger.error('❌ Workflow execution request failed', { error: error.message });
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
        apiRequest: true,
        correlationId: req.correlationId
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
        triggeredBy: 'quick_distribute',
        correlationId: req.correlationId
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

  async syncExternal(req, res) {
    try {
      const accountName = (req.body && req.body.accountName) || 'stripe';
      const data = await this.orchestrator.dataManager.getAccountData(accountName);
      const externalCount = (data.external?.[0]?.data?.news || []).length || 0;
      res.json({ status: 'success', accountName, externalNews: externalCount, lastSync: new Date().toISOString() });
    } catch (error) {
      this.logger.error('External sync failed', { error: error.message });
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getDataSummary(req, res) {
    try {
      const accountName = req.params.account || 'stripe';
      const data = await this.orchestrator.dataManager.getAccountData(accountName);
      const emails = (data.emails?.[0]?.data || data.emails || []).length || 0;
      const calls = (data.calls?.[0]?.data || data.calls || []).length || 0;
      const stakeholders = (data.stakeholders?.[0]?.data || data.stakeholders || []).length || 0;
      const interactions = (data.interactions?.[0]?.data || data.interactions || []).length || 0;
      const external = (data.external?.[0]?.data?.news || []).length || 0;
      res.json({ status: 'success', accountName, counts: { emails, calls, stakeholders, interactions, external } });
    } catch (error) {
      this.logger.error('Failed to get data summary', { error: error.message });
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getDistributionStatus(req, res) {
    try {
      const { statusService } = await import('../services/statusService.js');
      const recent = statusService.getAll(20);
      res.json({ status: 'success', recent });
    } catch (error) {
      this.logger.error('Failed to get distribution status', { error: error.message });
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  getReminderService() {
    return this.orchestrator?.reminderService;
  }

  async listReminders(req, res) {
    const service = this.getReminderService();
    if (!service || !service.isEnabled()) {
      return res.json({ status: 'disabled', reminders: [], summary: { total: 0 } });
    }

    try {
      const filters = {
        accountName: req.query.account || req.query.accountName,
        status: req.query.status,
        priority: req.query.priority
      };
      const reminders = service.getReminders(filters);
      res.json({ status: 'success', reminders, summary: service.getSummary() });
    } catch (error) {
      this.logger.error('Failed to list reminders', { error: error.message });
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async getReminderSummary(req, res) {
    const service = this.getReminderService();
    if (!service || !service.isEnabled()) {
      return res.json({ status: 'disabled', summary: { total: 0 } });
    }

    try {
      res.json({ status: 'success', summary: service.getSummary() });
    } catch (error) {
      this.logger.error('Failed to get reminder summary', { error: error.message });
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async createReminder(req, res) {
    const service = this.getReminderService();
    if (!service || !service.isEnabled()) {
      return res.status(400).json({ status: 'error', message: 'Reminder service disabled' });
    }

    try {
      const reminder = await service.createManualReminder(req.body || {});
      res.status(201).json({ status: 'success', reminder });
    } catch (error) {
      this.logger.error('Failed to create reminder', { error: error.message });
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  async acknowledgeReminder(req, res) {
    const service = this.getReminderService();
    if (!service || !service.isEnabled()) {
      return res.status(400).json({ status: 'error', message: 'Reminder service disabled' });
    }

    try {
      const reminder = await service.acknowledgeReminder(req.params.id, req.body || {});
      res.json({ status: 'success', reminder });
    } catch (error) {
      this.logger.error('Failed to acknowledge reminder', { id: req.params.id, error: error.message });
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  async snoozeReminder(req, res) {
    const service = this.getReminderService();
    if (!service || !service.isEnabled()) {
      return res.status(400).json({ status: 'error', message: 'Reminder service disabled' });
    }

    try {
      const reminder = await service.snoozeReminder(req.params.id, req.body || {});
      res.json({ status: 'success', reminder });
    } catch (error) {
      this.logger.error('Failed to snooze reminder', { id: req.params.id, error: error.message });
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  async escalateReminder(req, res) {
    const service = this.getReminderService();
    if (!service || !service.isEnabled()) {
      return res.status(400).json({ status: 'error', message: 'Reminder service disabled' });
    }

    try {
      const reminder = await service.forceEscalation(req.params.id, req.body || {});
      res.json({ status: 'success', reminder });
    } catch (error) {
      this.logger.error('Failed to escalate reminder', { id: req.params.id, error: error.message });
      res.status(400).json({ status: 'error', message: error.message });
    }
  }

  async evaluateReminders(req, res) {
    const service = this.getReminderService();
    if (!service || !service.isEnabled()) {
      return res.status(400).json({ status: 'error', message: 'Reminder service disabled' });
    }

    try {
      await service.evaluateReminders();
      res.json({ status: 'success', summary: service.getSummary() });
    } catch (error) {
      this.logger.error('Failed to evaluate reminders', { error: error.message });
      res.status(500).json({ status: 'error', message: error.message });
    }
  }

  async startKlavisAuth(req, res) {
    try {
      const { server, userId, redirectUri, mode } = req.query;
      if (!server) {
        return res.status(400).json({ error: 'server query param is required' });
      }
      const klavis = this.orchestrator.dataManager.getKlavisProvider?.();
      if (!klavis) {
        return res.status(400).json({ error: 'Klavis provider not initialized' });
      }
      const flow = await klavis.startOAuthFlow(server, {
        userId,
        redirectUri
      });
      const shouldRedirect = (mode || '').toLowerCase() === 'redirect' || (req.query.redirect || '').toLowerCase() === 'true';
      if (shouldRedirect) {
        return res.redirect(flow.oauthUrl);
      }
      res.json({
        status: 'success',
        ...flow
      });
    } catch (error) {
      this.logger.error('❌ Failed to start Klavis auth', { error: error.message });
      res.status(500).json({ error: 'Failed to start Klavis auth', message: error.message });
    }
  }

  async klavisAuthCallback(req, res) {
    try {
      const klavis = this.orchestrator.dataManager.getKlavisProvider?.();
      if (!klavis) {
        return res.status(400).json({ error: 'Klavis provider not initialized' });
      }
      const { state } = req.query;
      if (!state) {
        return res.status(400).json({ error: 'state query param is required' });
      }
      const result = await klavis.completeOAuthFlow({
        state,
        server: req.query.server,
        instanceId: req.query.instance_id,
        code: req.query.code,
        token: req.query.token,
        params: req.query
      });
      const acceptsHtml = req.accepts(['html', 'json']) === 'html';
      if (acceptsHtml) {
        res.type('html').send(`
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Klavis Connection Complete</title>
              <style>body{font-family:-apple-system,system-ui,Segoe UI,Roboto,Arial,sans-serif;padding:32px;background:#f9fafb;color:#111}</style>
            </head>
            <body>
              <h1>Connection Successful</h1>
              <p>Connected <strong>${result.server}</strong> via Klavis MCP.</p>
              <p>You may close this window.</p>
            </body>
          </html>
        `);
        return;
      }
      res.json({ status: 'success', ...result });
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

    if (this.monitoringService) {
      this.monitoringService.recordError('api-server', error, { url: req.url, method: req.method });
    }

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

  async updateSchedule(req, res) {
    try {
      const { workflowName } = req.params;
      const { cronExpression } = req.body || {};

      if (!cronExpression || typeof cronExpression !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'cronExpression is required'
        });
      }

      const result = await this.orchestrator.jobQueueService.updateScheduledWorkflow(workflowName, cronExpression);

      res.json({
        success: true,
        workflowName,
        cronExpression,
        job: result
      });
    } catch (error) {
      this.logger.error('Failed to update schedule', {
        workflowName: req.params.workflowName,
        error: error.message
      });
      const status = /not found/i.test(error.message) ? 404 : 500;
      res.status(status).json({
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
      if (this.monitoringService) {
        this.monitoringService.stop();
      }
      await this.orchestrator.shutdown();
      this.logger.info('🛑 Workflow API server stopped');
    }
  }
}
