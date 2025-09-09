import axios from 'axios';
import { Logger } from '../../utils/logger.js';

export class N8nService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.n8nUrl = config.n8n?.baseUrl || 'http://localhost:5678';
    this.apiKey = config.n8n?.apiKey;
    this.client = null;
    this.initialized = false;
  }

  async initialize() {
    this.logger.info('🔄 Initializing n8n Service...');
    
    try {
      // Create HTTP client for n8n API
      this.client = axios.create({
        baseURL: `${this.n8nUrl}/api/v1`,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-N8N-API-KEY': this.apiKey })
        },
        timeout: 30000
      });

      // Test connection to n8n
      await this.healthCheck();
      
      // Register account planning workflow templates
      await this.registerAccountPlanningWorkflows();
      
      this.initialized = true;
      this.logger.info('✅ n8n Service initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize n8n Service:', error.message);
      throw new Error(`n8n Service initialization failed: ${error.message}`);
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/workflows');
      this.logger.info('✅ n8n connection verified', {
        workflowCount: response.data?.data?.length || 0
      });
      return true;
    } catch (error) {
      throw new Error(`n8n health check failed: ${error.message}`);
    }
  }

  // Create a new workflow in n8n
  async createWorkflow(workflowConfig) {
    if (!this.initialized) {
      throw new Error('n8n Service not initialized');
    }

    try {
      const n8nWorkflow = this.convertToN8nFormat(workflowConfig);
      
      const response = await this.client.post('/workflows', n8nWorkflow);
      
      this.logger.info('✅ n8n workflow created', {
        workflowId: response.data.data.id,
        name: workflowConfig.name
      });
      
      return {
        n8nId: response.data.data.id,
        name: response.data.data.name,
        active: response.data.data.active,
        nodes: response.data.data.nodes?.length || 0
      };
    } catch (error) {
      this.logger.error('❌ Failed to create n8n workflow:', error.message);
      throw error;
    }
  }

  // Execute a workflow in n8n
  async executeWorkflow(workflowId, inputData = {}) {
    if (!this.initialized) {
      throw new Error('n8n Service not initialized');
    }

    try {
      const response = await this.client.post(`/workflows/${workflowId}/execute`, {
        runData: inputData
      });
      
      this.logger.info('🚀 n8n workflow execution started', {
        workflowId,
        executionId: response.data.data.executionId
      });
      
      return {
        executionId: response.data.data.executionId,
        status: 'running',
        startedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('❌ Failed to execute n8n workflow:', error.message);
      throw error;
    }
  }

  // Get execution status and results
  async getExecutionStatus(executionId) {
    try {
      const response = await this.client.get(`/executions/${executionId}`);
      const execution = response.data.data;
      
      return {
        executionId,
        status: execution.finished ? 'completed' : 'running',
        success: execution.success,
        startedAt: execution.startedAt,
        stoppedAt: execution.stoppedAt,
        data: execution.data,
        error: execution.data?.resultData?.error?.message
      };
    } catch (error) {
      this.logger.error('❌ Failed to get execution status:', error.message);
      throw error;
    }
  }

  // Convert workflow config to n8n format
  convertToN8nFormat(workflowConfig) {
    const nodes = [];
    let nodePosition = { x: 240, y: 300 };

    // 1. Start node (trigger)
    const triggerNode = this.createTriggerNode(workflowConfig.trigger, nodePosition);
    nodes.push(triggerNode);
    nodePosition.x += 300;

    // 2. Account data collection node
    const dataCollectionNode = this.createDataCollectionNode(nodePosition);
    nodes.push(dataCollectionNode);
    nodePosition.x += 300;

    // 3. AI analysis node
    const aiAnalysisNode = this.createAIAnalysisNode(nodePosition);
    nodes.push(aiAnalysisNode);
    nodePosition.x += 300;

    // 4. Distribution nodes
    const distributionNodes = this.createDistributionNodes(
      workflowConfig.distributors || [],
      nodePosition
    );
    nodes.push(...distributionNodes);

    // Create connections between nodes
    const connections = this.createConnections(nodes);

    return {
      name: workflowConfig.name,
      notes: workflowConfig.description || '',
      nodes,
      connections,
      active: workflowConfig.enabled || false,
      settings: {
        executionOrder: 'v1'
      }
    };
  }

  // Create trigger node based on configuration
  createTriggerNode(triggerConfig, position) {
    const baseNode = {
      id: 'trigger',
      name: 'Account Planning Trigger',
      type: 'n8n-nodes-base.cronTrigger',
      position: [position.x, position.y],
      parameters: {}
    };

    switch (triggerConfig.type) {
      case 'schedule':
        return {
          ...baseNode,
          type: 'n8n-nodes-base.cronTrigger',
          parameters: {
            rule: {
              interval: [
                {
                  field: 'cronExpression',
                  expression: triggerConfig.schedule || '0 9 * * 1' // Default: Monday 9 AM
                }
              ]
            }
          }
        };
      
      case 'webhook':
        return {
          ...baseNode,
          type: 'n8n-nodes-base.webhook',
          parameters: {
            path: triggerConfig.path || 'account-planning-webhook',
            httpMethod: 'POST',
            responseMode: 'onReceived'
          }
        };
      
      case 'manual':
      default:
        return {
          ...baseNode,
          type: 'n8n-nodes-base.manualTrigger',
          parameters: {}
        };
    }
  }

  // Create data collection node
  createDataCollectionNode(position) {
    return {
      id: 'dataCollection',
      name: 'Collect Account Data',
      type: 'n8n-nodes-base.httpRequest',
      position: [position.x, position.y],
      parameters: {
        url: `${this.config.app.baseUrl || 'http://localhost:3000'}/api/data/account/{{ $json.accountName }}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.api?.token || 'demo-token'}`,
          'Content-Type': 'application/json'
        },
        options: {
          timeout: 30000
        }
      }
    };
  }

  // Create AI analysis node
  createAIAnalysisNode(position) {
    return {
      id: 'aiAnalysis',
      name: 'AI Account Analysis',
      type: 'n8n-nodes-base.httpRequest',
      position: [position.x, position.y],
      parameters: {
        url: `${this.config.app.baseUrl || 'http://localhost:3000'}/api/ai/analyze`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.api?.token || 'demo-token'}`,
          'Content-Type': 'application/json'
        },
        body: {
          accountData: '={{ $json }}',
          enableTools: true,
          provider: 'mixed'
        },
        options: {
          timeout: 120000 // 2 minutes for AI processing
        }
      }
    };
  }

  // Create distribution nodes
  createDistributionNodes(distributors, startPosition) {
    const nodes = [];
    let position = { ...startPosition };

    distributors.forEach((distributor, index) => {
      let node;
      
      switch (distributor.type) {
        case 'email':
          node = {
            id: `email_${index}`,
            name: 'Email Distribution',
            type: 'n8n-nodes-base.emailSend',
            position: [position.x, position.y + (index * 150)],
            parameters: {
              fromEmail: distributor.config.from || 'noreply@company.com',
              toEmail: distributor.config.to || '{{ $json.recipients }}',
              subject: 'Account Plan: {{ $json.accountName }}',
              text: '={{ $json.emailContent }}',
              html: '={{ $json.htmlContent }}',
              attachments: 'report'
            }
          };
          break;

        case 'slack':
          node = {
            id: `slack_${index}`,
            name: 'Slack Notification',
            type: 'n8n-nodes-base.slack',
            position: [position.x, position.y + (index * 150)],
            parameters: {
              operation: 'postMessage',
              channel: distributor.config.channel || '#account-planning',
              text: '{{ $json.slackMessage }}',
              attachments: []
            }
          };
          break;

        case 'webhook':
          node = {
            id: `webhook_${index}`,
            name: 'Webhook Distribution',
            type: 'n8n-nodes-base.httpRequest',
            position: [position.x, position.y + (index * 150)],
            parameters: {
              url: distributor.config.url,
              method: 'POST',
              body: '={{ $json }}',
              headers: distributor.config.headers || {}
            }
          };
          break;

        default:
          node = {
            id: `custom_${index}`,
            name: `${distributor.type} Distribution`,
            type: 'n8n-nodes-base.function',
            position: [position.x, position.y + (index * 150)],
            parameters: {
              functionCode: `
                // Custom distribution logic for ${distributor.type}
                return items.map(item => ({
                  json: {
                    ...item.json,
                    distributorType: '${distributor.type}',
                    processedAt: new Date().toISOString()
                  }
                }));
              `
            }
          };
      }
      
      nodes.push(node);
    });

    return nodes;
  }

  // Create connections between nodes
  createConnections(nodes) {
    const connections = {};
    
    if (nodes.length < 2) return connections;

    // Connect trigger to data collection
    connections[nodes[0].id] = {
      main: [[{ node: nodes[1].id, type: 'main', index: 0 }]]
    };

    // Connect data collection to AI analysis
    if (nodes.length >= 3) {
      connections[nodes[1].id] = {
        main: [[{ node: nodes[2].id, type: 'main', index: 0 }]]
      };
    }

    // Connect AI analysis to distribution nodes
    if (nodes.length > 3) {
      const distributionConnections = [];
      for (let i = 3; i < nodes.length; i++) {
        distributionConnections.push({
          node: nodes[i].id,
          type: 'main',
          index: 0
        });
      }
      
      if (distributionConnections.length > 0) {
        connections[nodes[2].id] = {
          main: [distributionConnections]
        };
      }
    }

    return connections;
  }

  // Register predefined account planning workflows
  async registerAccountPlanningWorkflows() {
    const templates = [
      {
        name: 'Daily Account Health Check',
        description: 'Automated daily health monitoring for key accounts',
        trigger: { type: 'schedule', schedule: '0 9 * * *' }, // Daily at 9 AM
        distributors: [
          { type: 'email', config: { to: 'account-managers@company.com' } },
          { type: 'slack', config: { channel: '#account-health' } }
        ]
      },
      {
        name: 'Weekly Executive Report',
        description: 'Comprehensive weekly account analysis',
        trigger: { type: 'schedule', schedule: '0 9 * * 1' }, // Monday at 9 AM
        distributors: [
          { type: 'email', config: { to: 'executives@company.com' } }
        ]
      },
      {
        name: 'Risk Alert Workflow',
        description: 'Immediate alerts for high-risk accounts',
        trigger: { type: 'webhook', path: 'risk-alert' },
        distributors: [
          { type: 'email', config: { to: 'urgent@company.com' } },
          { type: 'slack', config: { channel: '#urgent-alerts' } }
        ]
      }
    ];

    for (const template of templates) {
      try {
        await this.createWorkflowTemplate(template);
      } catch (error) {
        this.logger.warn(`Failed to register template: ${template.name}`, error.message);
      }
    }
  }

  // Create workflow template
  async createWorkflowTemplate(template) {
    // Check if template already exists
    const existing = await this.findWorkflowByName(template.name);
    if (existing) {
      this.logger.info(`Template already exists: ${template.name}`);
      return existing;
    }

    return await this.createWorkflow({
      ...template,
      enabled: false // Templates start disabled
    });
  }

  // Find workflow by name
  async findWorkflowByName(name) {
    try {
      const response = await this.client.get('/workflows');
      const workflows = response.data.data || [];
      return workflows.find(workflow => workflow.name === name);
    } catch (error) {
      this.logger.error('Failed to search workflows:', error.message);
      return null;
    }
  }

  // List all workflows
  async listWorkflows() {
    try {
      const response = await this.client.get('/workflows');
      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to list workflows:', error.message);
      return [];
    }
  }

  // Activate/deactivate workflow
  async toggleWorkflow(workflowId, active) {
    try {
      const response = await this.client.patch(`/workflows/${workflowId}`, {
        active
      });
      
      this.logger.info(`Workflow ${active ? 'activated' : 'deactivated'}`, {
        workflowId
      });
      
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to toggle workflow:', error.message);
      throw error;
    }
  }

  // Delete workflow
  async deleteWorkflow(workflowId) {
    try {
      await this.client.delete(`/workflows/${workflowId}`);
      this.logger.info('Workflow deleted', { workflowId });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete workflow:', error.message);
      throw error;
    }
  }

  // Get workflow executions
  async getWorkflowExecutions(workflowId, limit = 10) {
    try {
      const response = await this.client.get('/executions', {
        params: {
          filter: JSON.stringify({ workflowId }),
          limit
        }
      });
      
      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to get executions:', error.message);
      return [];
    }
  }

  // Integration with Klavis MCP
  async createKlavisIntegratedWorkflow(workflowConfig) {
    // Enhanced workflow that leverages Klavis MCP tools
    const enhancedConfig = {
      ...workflowConfig,
      nodes: [
        ...this.createKlavisMCPNodes(),
        ...(workflowConfig.nodes || [])
      ]
    };

    return await this.createWorkflow(enhancedConfig);
  }

  // Create Klavis MCP-specific nodes
  createKlavisMCPNodes() {
    return [
      {
        id: 'klavis_email_data',
        name: 'Klavis Email Data',
        type: 'n8n-nodes-base.function',
        parameters: {
          functionCode: `
            // Leverage Klavis MCP for email data
            const klavisProvider = global.klavisProvider;
            if (klavisProvider) {
              const emails = await klavisProvider.getEmailData(items[0].json.accountName);
              return [{ json: { emails, dataSource: 'klavis_mcp' } }];
            }
            return items;
          `
        }
      },
      {
        id: 'klavis_calendar_data',
        name: 'Klavis Calendar Data',
        type: 'n8n-nodes-base.function',
        parameters: {
          functionCode: `
            // Leverage Klavis MCP for calendar data
            const klavisProvider = global.klavisProvider;
            if (klavisProvider) {
              const calendar = await klavisProvider.getCalendarData(items[0].json.accountName);
              return [{ json: { calendar, dataSource: 'klavis_mcp' } }];
            }
            return items;
          `
        }
      }
    ];
  }

  // Shutdown service
  async shutdown() {
    this.logger.info('🛑 Shutting down n8n Service...');
    this.initialized = false;
    this.logger.info('✅ n8n Service shutdown complete');
  }
}