import { Logger } from '../../utils/logger.js';

/**
 * Bridge service that connects Klavis MCP tools with n8n workflows
 * Enables n8n workflows to access Klavis data sources seamlessly
 */
export class KlavisN8nBridge {
  constructor(config, klavisProvider) {
    this.config = config;
    this.klavisProvider = klavisProvider;
    this.logger = new Logger(config);
    this.initialized = false;
    this.toolRegistry = new Map();
  }

  async initialize() {
    this.logger.info('🔄 Initializing Klavis-n8n Bridge...');
    
    try {
      if (!this.klavisProvider || !this.klavisProvider.initialized) {
        throw new Error('Klavis provider not initialized');
      }

      // Register Klavis tools for n8n access
      await this.registerKlavisTools();
      
      // Set up global access for n8n workflows
      this.setupGlobalAccess();
      
      this.initialized = true;
      this.logger.info('✅ Klavis-n8n Bridge initialized successfully', {
        registeredTools: this.toolRegistry.size
      });
    } catch (error) {
      this.logger.error('❌ Failed to initialize Klavis-n8n Bridge:', error.message);
      throw error;
    }
  }

  // Register all available Klavis tools for n8n access
  async registerKlavisTools() {
    try {
      // Get OpenAI format tools (easier to work with in n8n)
      const tools = this.klavisProvider.getToolsForFormat('openai');
      
      for (const tool of tools) {
        const toolKey = `${tool.server}_${tool.function.name}`;
        this.toolRegistry.set(toolKey, {
          name: tool.function.name,
          description: tool.function.description,
          server: tool.server,
          parameters: tool.function.parameters,
          handler: this.createToolHandler(tool.function.name, tool.server)
        });
      }

      this.logger.info('📝 Registered Klavis tools for n8n', {
        toolCount: this.toolRegistry.size,
        servers: [...new Set(tools.map(t => t.server))]
      });
    } catch (error) {
      this.logger.error('❌ Failed to register Klavis tools:', error.message);
      throw error;
    }
  }

  // Create a tool handler function
  createToolHandler(toolName, serverName) {
    return async (parameters) => {
      try {
        this.logger.info('🔧 Executing Klavis tool via n8n', {
          toolName,
          serverName,
          parameters: Object.keys(parameters)
        });

        const result = await this.klavisProvider.callTool(toolName, parameters, serverName);
        
        this.logger.info('✅ Klavis tool execution completed', {
          toolName,
          serverName,
          resultType: typeof result
        });

        return result;
      } catch (error) {
        this.logger.error('❌ Klavis tool execution failed', {
          toolName,
          serverName,
          error: error.message
        });
        throw error;
      }
    };
  }

  // Set up global access for n8n workflows
  setupGlobalAccess() {
    // Make Klavis provider and tools available globally for n8n
    global.klavisProvider = this.klavisProvider;
    global.klavisTools = this.toolRegistry;
    global.klavisBridge = this;

    // Create helper functions for common operations
    global.getAccountEmails = async (accountName) => {
      return await this.klavisProvider.getEmailData(accountName);
    };

    global.getAccountCalendar = async (accountName) => {
      return await this.klavisProvider.getCalendarData(accountName);
    };

    global.getAccountDocuments = async (accountName) => {
      return await this.klavisProvider.getDocuments(accountName);
    };

    global.executeKlavisTool = async (toolName, parameters, serverName) => {
      const toolKey = `${serverName}_${toolName}`;
      const tool = this.toolRegistry.get(toolKey);
      
      if (!tool) {
        throw new Error(`Tool ${toolKey} not found`);
      }

      return await tool.handler(parameters);
    };

    this.logger.info('🌐 Global Klavis functions available for n8n workflows');
  }

  // Create n8n-specific workflow nodes that leverage Klavis
  createKlavisAccountDataNode() {
    return {
      id: 'klavis_account_data',
      name: 'Klavis Account Data Collection',
      type: 'n8n-nodes-base.function',
      parameters: {
        functionCode: `
          // Collect comprehensive account data using Klavis MCP
          const accountName = items[0].json.accountName || 'default';
          
          try {
            const [emails, calendar, documents] = await Promise.all([
              global.getAccountEmails(accountName),
              global.getAccountCalendar(accountName), 
              global.getAccountDocuments(accountName)
            ]);

            return [{
              json: {
                accountName,
                dataSource: 'klavis_mcp',
                timestamp: new Date().toISOString(),
                emails: emails || [],
                calendar: calendar || [],
                documents: documents || [],
                summary: {
                  emailCount: (emails || []).length,
                  meetingCount: (calendar || []).length,
                  documentCount: (documents || []).length
                }
              }
            }];
          } catch (error) {
            console.error('Klavis data collection failed:', error.message);
            return [{
              json: {
                accountName,
                error: error.message,
                dataSource: 'klavis_mcp_error',
                timestamp: new Date().toISOString()
              }
            }];
          }
        `
      }
    };
  }

  createKlavisEmailAnalysisNode() {
    return {
      id: 'klavis_email_analysis',
      name: 'Klavis Email Analysis',
      type: 'n8n-nodes-base.function',
      parameters: {
        functionCode: `
          // Analyze email patterns and sentiment using Klavis data
          const accountData = items[0].json;
          const emails = accountData.emails || [];
          
          if (emails.length === 0) {
            return [{
              json: {
                ...accountData,
                emailAnalysis: {
                  totalEmails: 0,
                  recentActivity: 'No recent emails',
                  topContacts: [],
                  sentimentTrend: 'neutral'
                }
              }
            }];
          }

          // Extract email participants and analyze patterns
          const contacts = new Map();
          let recentEmail = null;
          let recentDate = new Date(0);

          for (const thread of emails) {
            for (const message of thread.messages || []) {
              // Track contacts
              const from = message.from;
              if (from) {
                contacts.set(from, (contacts.get(from) || 0) + 1);
              }

              // Find most recent email
              const msgDate = new Date(message.timestamp || 0);
              if (msgDate > recentDate) {
                recentDate = msgDate;
                recentEmail = message;
              }
            }
          }

          // Sort contacts by frequency
          const topContacts = Array.from(contacts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([email, count]) => ({ email, count }));

          const analysis = {
            totalEmails: emails.reduce((sum, thread) => sum + (thread.messages?.length || 0), 0),
            totalThreads: emails.length,
            recentActivity: recentEmail ? 
              \`Last email from \${recentEmail.from} on \${recentDate.toDateString()}\` :
              'No recent activity',
            topContacts,
            sentimentTrend: 'neutral', // Could integrate AI sentiment analysis here
            activityLevel: emails.length > 10 ? 'high' : emails.length > 5 ? 'medium' : 'low'
          };

          return [{
            json: {
              ...accountData,
              emailAnalysis: analysis
            }
          }];
        `
      }
    };
  }

  createKlavisMeetingInsightsNode() {
    return {
      id: 'klavis_meeting_insights',
      name: 'Klavis Meeting Insights',
      type: 'n8n-nodes-base.function',
      parameters: {
        functionCode: `
          // Generate insights from calendar/meeting data
          const accountData = items[0].json;
          const calendar = accountData.calendar || [];
          
          if (calendar.length === 0) {
            return [{
              json: {
                ...accountData,
                meetingInsights: {
                  totalMeetings: 0,
                  upcomingMeetings: 0,
                  meetingFrequency: 'none',
                  keyAttendees: []
                }
              }
            }];
          }

          const now = new Date();
          const upcoming = calendar.filter(event => new Date(event.date) > now);
          const past = calendar.filter(event => new Date(event.date) <= now);
          
          // Analyze attendee patterns
          const attendees = new Map();
          for (const event of calendar) {
            for (const attendee of event.attendees || []) {
              attendees.set(attendee, (attendees.get(attendee) || 0) + 1);
            }
          }

          const keyAttendees = Array.from(attendees.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([email, count]) => ({ email, count }));

          // Calculate meeting frequency
          let frequency = 'low';
          if (calendar.length > 10) frequency = 'high';
          else if (calendar.length > 5) frequency = 'medium';

          const insights = {
            totalMeetings: calendar.length,
            pastMeetings: past.length,
            upcomingMeetings: upcoming.length,
            meetingFrequency: frequency,
            keyAttendees,
            nextMeeting: upcoming.length > 0 ? upcoming[0] : null,
            averageDuration: calendar.length > 0 ? 
              'Various durations' : // Could calculate actual average
              'No meetings'
          };

          return [{
            json: {
              ...accountData,
              meetingInsights: insights
            }
          }];
        `
      }
    };
  }

  // Create a complete Klavis-powered account assessment workflow
  createAccountAssessmentWorkflow() {
    return {
      name: 'Klavis Account Assessment',
      description: 'Comprehensive account assessment using Klavis MCP data sources',
      nodes: [
        // Trigger node
        {
          id: 'trigger',
          name: 'Manual Trigger',
          type: 'n8n-nodes-base.manualTrigger',
          position: [240, 300],
          parameters: {}
        },
        
        // Klavis data collection node
        this.createKlavisAccountDataNode(),
        
        // Email analysis node
        this.createKlavisEmailAnalysisNode(),
        
        // Meeting insights node
        this.createKlavisMeetingInsightsNode(),
        
        // Final processing node
        {
          id: 'final_assessment',
          name: 'Generate Assessment',
          type: 'n8n-nodes-base.function',
          parameters: {
            functionCode: `
              // Combine all insights into final assessment
              const data = items[0].json;
              
              const assessment = {
                accountName: data.accountName,
                assessmentDate: new Date().toISOString(),
                dataSource: 'klavis_mcp',
                
                // Raw data summary
                dataSummary: data.summary,
                
                // Email insights
                emailHealth: {
                  activityLevel: data.emailAnalysis?.activityLevel || 'unknown',
                  totalCommunications: data.emailAnalysis?.totalEmails || 0,
                  keyContacts: data.emailAnalysis?.topContacts || []
                },
                
                // Meeting insights
                meetingHealth: {
                  frequency: data.meetingInsights?.meetingFrequency || 'unknown',
                  totalMeetings: data.meetingInsights?.totalMeetings || 0,
                  upcomingEngagements: data.meetingInsights?.upcomingMeetings || 0,
                  keyStakeholders: data.meetingInsights?.keyAttendees || []
                },
                
                // Overall health score (simple calculation)
                healthScore: Math.min(100, 
                  (data.emailAnalysis?.totalEmails || 0) * 2 + 
                  (data.meetingInsights?.totalMeetings || 0) * 5 + 
                  (data.summary?.documentCount || 0) * 3
                ),
                
                // Recommendations based on data
                recommendations: [
                  data.emailAnalysis?.activityLevel === 'low' ? 
                    'Increase email engagement frequency' : null,
                  data.meetingInsights?.upcomingMeetings === 0 ? 
                    'Schedule upcoming meetings to maintain relationship' : null,
                  data.summary?.documentCount === 0 ? 
                    'Create shared documents for collaboration' : null
                ].filter(Boolean),
                
                // Next actions
                nextActions: [
                  'Review email communication patterns',
                  'Analyze meeting outcomes and follow-ups', 
                  'Update account planning strategy based on insights'
                ]
              };
              
              return [{ json: assessment }];
            `
          }
        }
      ],
      
      connections: {
        'trigger': {
          main: [['klavis_account_data']]
        },
        'klavis_account_data': {
          main: [['klavis_email_analysis']]
        },
        'klavis_email_analysis': {
          main: [['klavis_meeting_insights']]
        },
        'klavis_meeting_insights': {
          main: [['final_assessment']]
        }
      }
    };
  }

  // Get tool information for n8n node documentation
  getToolDocumentation() {
    const docs = [];
    
    for (const [toolKey, tool] of this.toolRegistry.entries()) {
      docs.push({
        name: tool.name,
        server: tool.server,
        description: tool.description,
        parameters: tool.parameters,
        usage: `await global.executeKlavisTool('${tool.name}', parameters, '${tool.server}')`
      });
    }
    
    return docs;
  }

  // Create n8n custom node definitions for Klavis tools
  generateN8nNodeDefinitions() {
    const nodeDefinitions = [];
    
    for (const [toolKey, tool] of this.toolRegistry.entries()) {
      nodeDefinitions.push({
        name: `Klavis ${tool.name}`,
        type: `n8n-nodes-base.klavis${tool.name}`,
        category: ['Klavis MCP'],
        description: tool.description,
        defaults: {
          name: `Klavis ${tool.name}`
        },
        properties: this.convertParametersToN8nProperties(tool.parameters)
      });
    }
    
    return nodeDefinitions;
  }

  // Convert OpenAI parameters to n8n node properties
  convertParametersToN8nProperties(parameters) {
    const properties = [];
    
    for (const [paramName, paramDef] of Object.entries(parameters.properties || {})) {
      properties.push({
        displayName: paramName.charAt(0).toUpperCase() + paramName.slice(1),
        name: paramName,
        type: this.mapParameterTypeToN8n(paramDef.type),
        description: paramDef.description || `Parameter: ${paramName}`,
        required: (parameters.required || []).includes(paramName),
        default: paramDef.default || ''
      });
    }
    
    return properties;
  }

  // Map OpenAI parameter types to n8n types
  mapParameterTypeToN8n(type) {
    switch (type) {
      case 'string': return 'string';
      case 'number': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return 'collection';
      case 'object': return 'json';
      default: return 'string';
    }
  }

  // Shutdown bridge
  async shutdown() {
    this.logger.info('🛑 Shutting down Klavis-n8n Bridge...');
    
    // Clean up global references
    delete global.klavisProvider;
    delete global.klavisTools;
    delete global.klavisBridge;
    delete global.getAccountEmails;
    delete global.getAccountCalendar;
    delete global.getAccountDocuments;
    delete global.executeKlavisTool;
    
    this.toolRegistry.clear();
    this.initialized = false;
    
    this.logger.info('✅ Klavis-n8n Bridge shutdown complete');
  }
}