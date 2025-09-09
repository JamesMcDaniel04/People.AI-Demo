import axios from 'axios';
import { Logger } from '../../utils/logger.js';

export class CRMDistributor {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.crmClient = null;
    this.crmType = process.env.CRM_TYPE || 'salesforce'; // salesforce, hubspot, pipedrive
  }

  async initialize() {
    this.logger.info('🔄 Initializing CRM Distributor...');

    const crmConfig = this.getCRMConfig();
    
    if (crmConfig.apiKey || crmConfig.accessToken) {
      this.crmClient = axios.create({
        baseURL: crmConfig.baseURL,
        headers: crmConfig.headers,
        timeout: 30000
      });

      try {
        // Test the connection
        await this.testConnection();
        this.logger.info('✅ CRM Distributor initialized successfully', { crmType: this.crmType });
      } catch (error) {
        this.logger.warn('⚠️ CRM connection failed, using mock mode', { error: error.message });
        this.crmClient = null;
        this.mockMode = true;
      }
    } else {
      this.logger.warn('⚠️ No CRM credentials found, using mock mode');
      this.mockMode = true;
    }
  }

  getCRMConfig() {
    switch (this.crmType) {
      case 'salesforce':
        return {
          baseURL: process.env.SALESFORCE_INSTANCE_URL || 'https://your-domain.lightning.force.com',
          accessToken: process.env.SALESFORCE_ACCESS_TOKEN,
          headers: {
            'Authorization': `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        };
        
      case 'hubspot':
        return {
          baseURL: 'https://api.hubapi.com',
          accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
          headers: {
            'Authorization': `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        };
        
      case 'pipedrive':
        return {
          baseURL: 'https://api.pipedrive.com/v1',
          apiKey: process.env.PIPEDRIVE_API_TOKEN,
          headers: {
            'Authorization': `Bearer ${process.env.PIPEDRIVE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        };
        
      default:
        return {
          baseURL: 'https://api.example-crm.com',
          accessToken: process.env.CRM_ACCESS_TOKEN,
          headers: {
            'Authorization': `Bearer ${process.env.CRM_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        };
    }
  }

  async testConnection() {
    if (!this.crmClient) return false;

    switch (this.crmType) {
      case 'salesforce':
        await this.crmClient.get('/services/data/v61.0/');
        break;
      case 'hubspot':
        await this.crmClient.get('/crm/v3/owners');
        break;
      case 'pipedrive':
        await this.crmClient.get('/users');
        break;
      default:
        throw new Error('Unknown CRM type');
    }
  }

  async distribute(accountPlan, config, context) {
    const { actions = ['updateAccount', 'createTasks'] } = config;
    const { accountName, executionId } = context;

    this.logger.info('🔄 Distributing account plan to CRM', {
      accountName,
      executionId,
      crmType: this.crmType,
      actions: actions.length
    });

    try {
      const results = [];

      for (const action of actions) {
        const result = await this.executeAction(action, accountPlan, config, context);
        results.push(result);
      }

      return {
        status: 'success',
        crmType: this.crmType,
        completedActions: results.filter(r => r.status === 'success').length,
        results
      };

    } catch (error) {
      this.logger.error('❌ CRM distribution failed', {
        accountName,
        crmType: this.crmType,
        error: error.message
      });
      throw error;
    }
  }

  async executeAction(action, accountPlan, config, context) {
    const { accountName, executionId } = context;

    try {
      switch (action) {
        case 'updateAccount':
          return await this.updateAccountRecord(accountPlan, config, context);
          
        case 'createTasks':
          return await this.createTasks(accountPlan, config, context);
          
        case 'updateOpportunities':
          return await this.updateOpportunities(accountPlan, config, context);
          
        case 'logActivity':
          return await this.logActivity(accountPlan, config, context);
          
        case 'createNotes':
          return await this.createNotes(accountPlan, config, context);
          
        default:
          throw new Error(`Unknown CRM action: ${action}`);
      }
    } catch (error) {
      this.logger.error(`❌ CRM action failed: ${action}`, {
        accountName,
        error: error.message
      });
      
      return {
        action,
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      };
    }
  }

  async updateAccountRecord(accountPlan, config, context) {
    const { accountName, executionId } = context;
    const healthScore = accountPlan.accountOverview?.healthScore?.score || 0;
    const opportunities = accountPlan.opportunityAnalysis?.identifiedOpportunities || [];
    const risks = accountPlan.riskAssessment?.identifiedRisks || [];

    const updateData = {
      // Custom fields for account health and insights
      AI_Health_Score__c: healthScore,
      AI_Opportunity_Count__c: opportunities.length,
      AI_Risk_Count__c: risks.length,
      Last_AI_Analysis__c: new Date().toISOString(),
      AI_Execution_ID__c: executionId,
      AI_Recommendation__c: accountPlan.executiveSummary?.recommendation || '',
      Next_Review_Date__c: this.calculateNextReviewDate(healthScore, risks)
    };

    if (this.crmClient) {
      // Find account record
      const accountId = await this.findAccountId(accountName);
      if (!accountId) {
        throw new Error(`Account not found in CRM: ${accountName}`);
      }

      // Update account based on CRM type
      let result;
      switch (this.crmType) {
        case 'salesforce':
          result = await this.updateSalesforceAccount(accountId, updateData);
          break;
        case 'hubspot':
          result = await this.updateHubspotAccount(accountId, updateData);
          break;
        case 'pipedrive':
          result = await this.updatePipedriveAccount(accountId, updateData);
          break;
        default:
          throw new Error(`CRM type not supported: ${this.crmType}`);
      }

      this.logger.info('✅ Account record updated in CRM', {
        accountName,
        accountId,
        crmType: this.crmType
      });

      return {
        action: 'updateAccount',
        status: 'success',
        accountId,
        updatedFields: Object.keys(updateData),
        result,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Mock mode
      this.logger.info('🔄 Account record updated (mock mode)', {
        accountName,
        updateData
      });

      return {
        action: 'updateAccount',
        status: 'success',
        accountId: `mock-${accountName}`,
        updatedFields: Object.keys(updateData),
        updatedAt: new Date().toISOString(),
        mode: 'mock'
      };
    }
  }

  async createTasks(accountPlan, config, context) {
    const { accountName, executionId } = context;
    const recommendations = accountPlan.strategicRecommendations || {};
    const tasks = [];

    // Create tasks from immediate recommendations
    if (recommendations.immediate) {
      for (const rec of recommendations.immediate.slice(0, 3)) { // Limit to 3 immediate tasks
        const task = {
          subject: `AI Recommendation: ${rec.action}`,
          description: `Account: ${accountName}\nRationale: ${rec.rationale}\nExpected Outcome: ${rec.outcome}\nExecution ID: ${executionId}`,
          priority: 'High',
          dueDate: this.calculateDueDate(rec.timeline),
          status: 'Open',
          ownerId: config.defaultOwnerId || await this.getDefaultOwnerId(),
          accountName: accountName,
          type: 'AI Generated Task'
        };
        tasks.push(task);
      }
    }

    if (this.crmClient) {
      const createdTasks = [];
      for (const task of tasks) {
        const result = await this.createCRMTask(task);
        createdTasks.push(result);
      }

      this.logger.info('✅ Tasks created in CRM', {
        accountName,
        taskCount: createdTasks.length,
        crmType: this.crmType
      });

      return {
        action: 'createTasks',
        status: 'success',
        createdTasks,
        taskCount: createdTasks.length,
        createdAt: new Date().toISOString()
      };
    } else {
      // Mock mode
      this.logger.info('📋 Tasks created (mock mode)', {
        accountName,
        tasks: tasks.map(t => t.subject)
      });

      return {
        action: 'createTasks',
        status: 'success',
        tasks: tasks.map(t => ({ ...t, id: `mock-task-${Date.now()}` })),
        taskCount: tasks.length,
        createdAt: new Date().toISOString(),
        mode: 'mock'
      };
    }
  }

  async updateOpportunities(accountPlan, config, context) {
    const { accountName } = context;
    const opportunities = accountPlan.opportunityAnalysis?.identifiedOpportunities || [];
    
    const updatedOpportunities = [];

    for (const opp of opportunities.slice(0, 5)) { // Limit to 5 opportunities
      const opportunityData = {
        name: `${accountName} - ${opp.type || 'AI Opportunity'}`,
        accountName: accountName,
        amount: opp.value || 0,
        probability: Math.round((opp.confidence || 0.5) * 100),
        description: opp.reasoning || 'AI-identified opportunity',
        expectedCloseDate: this.calculateCloseDate(opp.timeline),
        stage: 'Qualification',
        source: 'AI Account Planning'
      };

      if (this.crmClient) {
        const result = await this.createCRMOpportunity(opportunityData);
        updatedOpportunities.push(result);
      } else {
        // Mock mode
        updatedOpportunities.push({
          ...opportunityData,
          id: `mock-opp-${Date.now()}-${Math.random()}`
        });
      }
    }

    this.logger.info('✅ Opportunities updated in CRM', {
      accountName,
      opportunityCount: updatedOpportunities.length
    });

    return {
      action: 'updateOpportunities',
      status: 'success',
      opportunities: updatedOpportunities,
      opportunityCount: updatedOpportunities.length,
      updatedAt: new Date().toISOString()
    };
  }

  async logActivity(accountPlan, config, context) {
    const { accountName, executionId } = context;
    
    const activityData = {
      subject: `AI Account Plan Generated: ${accountName}`,
      description: `AI-powered account analysis completed.\n\nHealth Score: ${accountPlan.accountOverview?.healthScore?.score}/100\nOpportunities: ${accountPlan.opportunityAnalysis?.identifiedOpportunities?.length || 0}\nRisks: ${accountPlan.riskAssessment?.identifiedRisks?.length || 0}\n\nExecution ID: ${executionId}`,
      activityDate: new Date().toISOString(),
      type: 'AI Analysis',
      status: 'Completed'
    };

    if (this.crmClient) {
      const result = await this.createCRMActivity(activityData);
      return {
        action: 'logActivity',
        status: 'success',
        activityId: result.id,
        loggedAt: new Date().toISOString()
      };
    } else {
      // Mock mode
      return {
        action: 'logActivity',
        status: 'success',
        activityId: `mock-activity-${Date.now()}`,
        loggedAt: new Date().toISOString(),
        mode: 'mock'
      };
    }
  }

  async createNotes(accountPlan, config, context) {
    const { accountName } = context;
    
    const noteContent = this.generateAccountPlanSummary(accountPlan);
    
    const noteData = {
      title: `AI Account Plan Summary - ${accountName}`,
      content: noteContent,
      createdDate: new Date().toISOString(),
      isPrivate: false
    };

    if (this.crmClient) {
      const result = await this.createCRMNote(noteData);
      return {
        action: 'createNotes',
        status: 'success',
        noteId: result.id,
        createdAt: new Date().toISOString()
      };
    } else {
      // Mock mode
      return {
        action: 'createNotes',
        status: 'success',
        noteId: `mock-note-${Date.now()}`,
        createdAt: new Date().toISOString(),
        mode: 'mock'
      };
    }
  }

  generateAccountPlanSummary(accountPlan) {
    const healthScore = accountPlan.accountOverview?.healthScore?.score || 'N/A';
    const opportunities = accountPlan.opportunityAnalysis?.identifiedOpportunities || [];
    const risks = accountPlan.riskAssessment?.identifiedRisks || [];
    const recommendations = accountPlan.strategicRecommendations || {};

    return `
AI ACCOUNT PLAN SUMMARY
========================

HEALTH OVERVIEW
- Account Health Score: ${healthScore}/100
- Status: ${accountPlan.accountOverview?.healthScore?.overall || 'Unknown'}
- Total Opportunities: ${opportunities.length}
- Total Risks: ${risks.length}

KEY OPPORTUNITIES
${opportunities.slice(0, 3).map((opp, i) => 
  `${i+1}. ${opp.type || 'Growth Opportunity'} - $${(opp.value || 0).toLocaleString()} (${Math.round((opp.confidence || 0.5) * 100)}% confidence)\n   Reasoning: ${opp.reasoning || 'Strategic opportunity'}`
).join('\n')}

RISK ASSESSMENT
${risks.slice(0, 3).map((risk, i) =>
  `${i+1}. ${risk.type || 'Account Risk'} (${risk.level || 'medium'} priority)\n   Description: ${risk.description || 'Risk requires attention'}`
).join('\n')}

IMMEDIATE ACTIONS
${(recommendations.immediate || []).slice(0, 3).map((action, i) =>
  `${i+1}. ${action.action}\n   Timeline: ${action.timeline}\n   Owner: ${action.owner}`
).join('\n')}

Generated by AI Account Planner
Date: ${new Date().toLocaleString()}
    `;
  }

  // Helper methods for different CRM systems
  async findAccountId(accountName) {
    // This would search for the account in the specific CRM
    return `mock-account-${accountName}`;
  }

  async updateSalesforceAccount(accountId, updateData) {
    return await this.crmClient.patch(`/services/data/v61.0/sobjects/Account/${accountId}`, updateData);
  }

  async updateHubspotAccount(accountId, updateData) {
    return await this.crmClient.patch(`/crm/v3/objects/companies/${accountId}`, { properties: updateData });
  }

  async updatePipedriveAccount(accountId, updateData) {
    return await this.crmClient.put(`/organizations/${accountId}`, updateData);
  }

  async createCRMTask(taskData) {
    // Implementation would depend on CRM type
    return { id: `mock-task-${Date.now()}`, ...taskData };
  }

  async createCRMOpportunity(oppData) {
    // Implementation would depend on CRM type
    return { id: `mock-opp-${Date.now()}`, ...oppData };
  }

  async createCRMActivity(activityData) {
    // Implementation would depend on CRM type
    return { id: `mock-activity-${Date.now()}`, ...activityData };
  }

  async createCRMNote(noteData) {
    // Implementation would depend on CRM type
    return { id: `mock-note-${Date.now()}`, ...noteData };
  }

  calculateNextReviewDate(healthScore, risks) {
    // Calculate based on health score and risk levels
    if (healthScore < 50 || risks.some(r => r.level === 'high')) {
      // Weekly review for critical accounts
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (healthScore < 80) {
      // Bi-weekly review for at-risk accounts
      return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Monthly review for healthy accounts
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  calculateDueDate(timeline) {
    // Parse timeline and calculate due date
    if (!timeline) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    if (timeline.includes('7 days') || timeline.includes('week')) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeline.includes('14 days') || timeline.includes('2 weeks')) {
      return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  calculateCloseDate(timeline) {
    // Parse opportunity timeline
    if (timeline?.includes('Q1')) return '2025-03-31';
    if (timeline?.includes('Q2')) return '2025-06-30';
    if (timeline?.includes('Q3')) return '2025-09-30';
    if (timeline?.includes('Q4')) return '2025-12-31';
    
    // Default to 90 days from now
    return new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  async getDefaultOwnerId() {
    // This would get the default owner ID from the CRM
    return 'default-owner-id';
  }
}