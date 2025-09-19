import axios from 'axios';
import { createHash } from 'crypto';
import { Logger } from '../../utils/logger.js';
import { getRedisService } from '../../services/redisService.js';
import { statusService } from '../../services/statusService.js';

export class CRMDistributor {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.crmClient = null;
    this.crmType = process.env.CRM_TYPE || 'salesforce'; // salesforce, hubspot, pipedrive
    this.redis = getRedisService(config);
    this.crmDefaults = config.crm || {};
    this.taskNamespace = `${process.env.JOB_QUEUE_PREFIX || 'ai-account-planner'}:crm-tasks`;
    this.verificationConfig = this.crmDefaults.verification || { enabled: true, maxAttempts: 1, delayMs: 2000 };
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
      try { const { metrics } = await import('../../services/metricsService.js'); metrics.inc('crm_distribute:err'); } catch (_) {}
      throw error;
    }
  }

  async sendReminder(reminder, channelConfig = {}, options = {}) {
    const escalate = options.escalate === true;
    const subject = channelConfig.subject
      || `[Reminder${escalate ? ' Escalation' : ''}] ${reminder.accountName}`;
    const description = this.buildReminderDescription(reminder, escalate);

    const payload = {
      account: reminder.accountName,
      subject,
      description,
      dueAt: reminder.dueAt,
      priority: reminder.priority,
      escalation: escalate
    };

    try {
      if (this.mockMode || !this.crmClient) {
        this.logger.info('🗂️ CRM reminder logged (mock mode)', payload);
        statusService.record('crm', {
          account: reminder.accountName,
          ok: true,
          type: escalate ? 'reminder-escalation' : 'reminder',
          mode: 'mock'
        });
        return { status: 'queued', mode: 'mock' };
      }

      // In production this would create a CRM task/ticket. For the demo we log and acknowledge the queueing.
      this.logger.info('🗂️ CRM reminder queued', payload);
      statusService.record('crm', {
        account: reminder.accountName,
        ok: true,
        type: escalate ? 'reminder-escalation' : 'reminder',
        mode: 'api'
      });
      return { status: 'queued', mode: 'api' };
    } catch (error) {
      this.logger.error('❌ CRM reminder failed', {
        account: reminder.accountName,
        error: error.message
      });
      statusService.record('crm', {
        account: reminder.accountName,
        ok: false,
        error: error.message,
        type: escalate ? 'reminder-escalation' : 'reminder'
      });
      return { status: 'failed', error: error.message };
    }
  }

  buildReminderDescription(reminder, escalate) {
    const due = reminder.dueAt ? new Date(reminder.dueAt).toISOString() : 'as soon as possible';
    const reason = reminder.reason || 'Follow up required based on latest analysis.';
    const nextStep = reminder.recommendedAction || 'Review the account plan and engage stakeholders.';
    return `${escalate ? 'Escalated reminder' : 'Reminder'} for ${reminder.accountName}\nPriority: ${reminder.priority || 'medium'}\nDue: ${due}\nReason: ${reason}\nNext Step: ${nextStep}`;
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

      const ok = {
        action: 'updateAccount',
        status: 'success',
        accountId,
        updatedFields: Object.keys(updateData),
        result,
        updatedAt: new Date().toISOString()
      };
      statusService.record('crm', { account: accountName, action: 'updateAccount', ok: true });
      return ok;
    } else {
      // Mock mode
      this.logger.info('🔄 Account record updated (mock mode)', {
        accountName,
        updateData
      });

      const ok = {
        action: 'updateAccount',
        status: 'success',
        accountId: `mock-${accountName}`,
        updatedFields: Object.keys(updateData),
        updatedAt: new Date().toISOString(),
        mode: 'mock'
      };
      statusService.record('crm', { account: accountName, action: 'updateAccount', ok: true, mode: 'mock' });
      return ok;
    }
  }

  async createTasks(accountPlan, config, context) {
    const { accountName, executionId } = context;
    const maxTasks = config.maxTasks || 5;

    let accountId = `mock-account-${accountName}`;
    if (this.crmClient) {
      try {
        const resolvedAccountId = await this.findAccountId(accountName);
        if (resolvedAccountId) {
          accountId = resolvedAccountId;
        } else {
          this.logger.warn('⚠️ Account not found in CRM for task creation', {
            accountName,
            crmType: this.crmType
          });
        }
      } catch (error) {
        this.logger.warn('⚠️ Failed to resolve account ID for CRM tasks', {
          accountName,
          crmType: this.crmType,
          error: error.message
        });
      }
    }

    const tasks = await this.buildTaskPayloads(
      accountPlan,
      config,
      { ...context, accountId },
      maxTasks
    );

    if (tasks.length === 0) {
      this.logger.info('ℹ️ No actionable recommendations generated for CRM task creation', {
        accountName,
        executionId
      });

      return {
        action: 'createTasks',
        status: 'success',
        taskCount: 0,
        createdTasks: [],
        accountId,
        createdAt: new Date().toISOString()
      };
    }

    if (this.crmClient) {
      const createdTasks = [];
      const failedTasks = [];

      for (const task of tasks) {
        try {
          const crmResult = await this.createCRMTask(task);
          await this.recordTaskLifecycle(accountName, task, 'created', crmResult);

          let verification = { verified: false, status: 'skipped' };
          if (this.verificationConfig.enabled !== false) {
            verification = await this.verifyTaskCreation(crmResult);
            if (verification.verified) {
              await this.recordTaskLifecycle(accountName, task, 'verified', verification);
            }
          }

          createdTasks.push(
            this.sanitizeTaskForResponse(task, {
              id: crmResult.id,
              status: crmResult.status || task.status,
              verification
            })
          );
        } catch (error) {
          failedTasks.push({
            clientReferenceId: task.clientReferenceId,
            subject: task.subject,
            error: error.message
          });
          await this.recordTaskLifecycle(accountName, task, 'failed', { error: error.message });
        }
      }

      const successCount = createdTasks.length;
      const responseStatus = successCount > 0 ? 'success' : 'failed';
      const partialFailure = successCount > 0 && failedTasks.length > 0;

      const response = {
        action: 'createTasks',
        status: responseStatus,
        partialFailure,
        taskCount: successCount,
        failedTaskCount: failedTasks.length,
        createdTasks,
        failedTasks,
        accountId,
        createdAt: new Date().toISOString()
      };

      statusService.record('crm', {
        account: accountName,
        action: 'createTasks',
        ok: successCount > 0,
        count: successCount,
        failed: failedTasks.length,
        mode: 'live'
      });

      return response;
    } else {
      const mockTasks = [];
      const timestamp = Date.now();

      for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        const mockId = `mock-task-${timestamp}-${index}`;
        mockTasks.push(
          this.sanitizeTaskForResponse(task, {
            id: mockId,
            verification: { verified: false, status: 'mock-mode' }
          })
        );
        await this.recordTaskLifecycle(accountName, task, 'created', {
          id: mockId,
          status: task.status,
          mode: 'mock'
        });
      }

      statusService.record('crm', {
        account: accountName,
        action: 'createTasks',
        ok: true,
        count: mockTasks.length,
        mode: 'mock'
      });

      return {
        action: 'createTasks',
        status: 'success',
        taskCount: mockTasks.length,
        tasks: mockTasks,
        accountId,
        createdAt: new Date().toISOString(),
        mode: 'mock'
      };
    }
  }

  async buildTaskPayloads(accountPlan, config, context, maxTasks = 5) {
    const recommendations = accountPlan.strategicRecommendations || {};
    const phasesToInclude = new Set(
      Array.isArray(config.taskPhases) && config.taskPhases.length > 0
        ? config.taskPhases
        : ['immediate']
    );

    if (config.includeShortTerm) phasesToInclude.add('shortTerm');
    if (config.includeLongTerm) phasesToInclude.add('longTerm');

    const phaseSettings = [
      { key: 'immediate', items: recommendations.immediate || [], limit: config.maxImmediateTasks ?? 3 },
      { key: 'shortTerm', items: recommendations.shortTerm || [], limit: config.maxShortTermTasks ?? 3 },
      { key: 'longTerm', items: recommendations.longTerm || [], limit: config.maxLongTermTasks ?? 2 }
    ];

    const tasks = [];
    const tasksByAction = new Map();
    let sequence = 1;

    for (const phase of phaseSettings) {
      if (!phasesToInclude.has(phase.key)) continue;

      const phaseItems = phase.items.slice(0, phase.limit);
      for (const rec of phaseItems) {
        if (!rec || typeof rec !== 'object' || !rec.action) continue;
        if (tasks.length >= maxTasks) break;

        const priorityInfo = this.determineTaskPriority(rec, accountPlan);
        const ownerInfo = await this.resolveTaskOwner(rec, config, priorityInfo.priority);
        const dependencies = this.determineDependencies(
          rec,
          config,
          tasks,
          tasksByAction,
          phase.key
        );

        const clientReferenceId = this.generateClientReferenceId(
          context.accountName,
          context.executionId,
          rec.action,
          sequence
        );

        const task = {
          subject: `AI Recommendation: ${rec.action}`,
          description: this.buildTaskDescription(
            context.accountName,
            rec,
            priorityInfo,
            dependencies,
            context.executionId,
            clientReferenceId
          ),
          priority: priorityInfo.priority,
          priorityScore: priorityInfo.score,
          priorityReason: priorityInfo.reason,
          dueDate: this.calculateDueDate(rec.timeline),
          status: this.crmDefaults.defaultStatus || 'Not Started',
          ownerId: ownerInfo.ownerId,
          ownerSource: ownerInfo.source,
          ownerFallbackId: ownerInfo.fallbackOwnerId,
          accountId: context.accountId,
          accountName: context.accountName,
          type: rec.type || this.crmDefaults.defaultType || 'AI Generated Task',
          dependencies,
          relatedRisks: priorityInfo.relatedRisks,
          relatedOpportunities: priorityInfo.relatedOpportunities,
          escalation: this.buildEscalationPlan(priorityInfo.priority, ownerInfo, config),
          rationale: rec.rationale,
          expectedOutcome: rec.expectedOutcome,
          resources: Array.isArray(rec.resources) ? rec.resources : [],
          timeline: rec.timeline,
          phase: phase.key,
          sequence,
          executionId: context.executionId,
          clientReferenceId
        };

        tasks.push(task);
        tasksByAction.set(this.normalizeKey(rec.action), clientReferenceId);
        sequence += 1;
      }
    }

    return tasks;
  }

  determineTaskPriority(recommendation, accountPlan) {
    const defaultPriority = this.crmDefaults.defaultPriority || 'Medium';
    let priority = this.normalizePriority(recommendation.priority) || defaultPriority;

    if (!priority) {
      priority = this.derivePriorityFromTimeline(recommendation.timeline) || defaultPriority;
    }

    const relatedRisks = this.matchRisks(recommendation, accountPlan);
    const relatedOpportunities = this.matchOpportunities(recommendation, accountPlan);

    if (relatedRisks.some(risk => (risk.level || '').toLowerCase() === 'critical')) {
      priority = this.escalatePriority(priority, 'Critical');
    } else if (relatedRisks.some(risk => (risk.level || '').toLowerCase() === 'high')) {
      priority = this.escalatePriority(priority, 'High');
    }

    if (this.containsUrgencyKeywords(recommendation)) {
      priority = this.escalatePriority(priority, 'High');
    }

    const score = this.priorityToScore(priority);
    const reasonParts = [];

    if (relatedRisks.length > 0) {
      reasonParts.push(`Linked risks: ${relatedRisks.map(r => `${r.type} (${r.level || 'medium'})`).join(', ')}`);
    }

    if (recommendation.timeline) {
      reasonParts.push(`Timeline: ${recommendation.timeline}`);
    }

    if (recommendation.rationale) {
      reasonParts.push(recommendation.rationale);
    }

    if (reasonParts.length === 0) {
      reasonParts.push('Priority derived from recommendation heuristics');
    }

    return {
      priority,
      score,
      reason: reasonParts.join(' | '),
      relatedRisks,
      relatedOpportunities
    };
  }

  derivePriorityFromTimeline(timeline) {
    if (!timeline || typeof timeline !== 'string') return null;
    const text = timeline.toLowerCase();
    if (/(hour|day|now|immediate|48|24|urgent|asap)/.test(text)) return 'Critical';
    if (/(7|week)/.test(text)) return 'High';
    if (/(14|2 weeks|30|month|quarter)/.test(text)) return 'Medium';
    return 'Low';
  }

  containsUrgencyKeywords(recommendation) {
    const text = `${recommendation.action || ''} ${recommendation.rationale || ''}`.toLowerCase();
    return /(renewal|churn|risk|escalat|critical|urgent|breach|compliance)/.test(text);
  }

  matchRisks(recommendation, accountPlan) {
    const text = `${recommendation.action || ''} ${recommendation.rationale || ''} ${recommendation.expectedOutcome || ''}`.toLowerCase();
    const risks = accountPlan.riskAssessment?.identifiedRisks || [];

    return risks
      .filter(risk => {
        const riskText = `${risk.type || ''} ${risk.description || ''}`.toLowerCase();
        if (!riskText) return false;
        const typeMatch = (risk.type || '') && text.includes((risk.type || '').toLowerCase());
        const descriptionMatch = (risk.description || '') && text.includes((risk.description || '').toLowerCase());
        return typeMatch || descriptionMatch;
      })
      .slice(0, 5)
      .map(risk => ({
        type: risk.type || 'Account Risk',
        level: risk.level || 'medium',
        description: risk.description
      }));
  }

  matchOpportunities(recommendation, accountPlan) {
    const text = `${recommendation.action || ''} ${recommendation.rationale || ''} ${recommendation.expectedOutcome || ''}`.toLowerCase();
    const opportunities = accountPlan.opportunityAnalysis?.identifiedOpportunities || [];

    return opportunities
      .filter(opp => {
        const oppText = `${opp.type || ''} ${opp.reasoning || ''}`.toLowerCase();
        if (!oppText) return false;
        const typeMatch = (opp.type || '') && text.includes((opp.type || '').toLowerCase());
        const reasoningMatch = (opp.reasoning || '') && text.includes((opp.reasoning || '').toLowerCase());
        return typeMatch || reasoningMatch;
      })
      .slice(0, 5)
      .map(opp => ({
        type: opp.type || 'Opportunity',
        value: opp.value,
        confidence: opp.confidence
      }));
  }

  priorityToScore(priority) {
    const rank = this.priorityRank(priority);
    return rank * 25; // Normalize to 100 scale
  }

  escalatePriority(current, target) {
    const currentRank = this.priorityRank(current);
    const targetRank = this.priorityRank(target);
    return targetRank > currentRank ? this.normalizePriority(target) || target : this.normalizePriority(current) || current;
  }

  priorityRank(priority) {
    const normalized = this.normalizePriority(priority) || 'Medium';
    const order = { Low: 1, Medium: 2, High: 3, Critical: 4 };
    return order[normalized] || 2;
  }

  normalizePriority(priority) {
    if (!priority || typeof priority !== 'string') return null;
    const normalized = this.normalizeKey(priority);
    if (!normalized) return null;
    if (normalized.startsWith('crit')) return 'Critical';
    if (normalized.startsWith('high')) return 'High';
    if (normalized.startsWith('med')) return 'Medium';
    if (normalized.startsWith('low')) return 'Low';
    const mapped = this.crmDefaults.priorityMappings?.[priority] || this.crmDefaults.priorityMappings?.[normalized];
    return mapped || priority;
  }

  async resolveTaskOwner(recommendation, runtimeConfig, priority) {
    const ownerMappings = {
      ...(this.crmDefaults.ownerMappings || {}),
      ...(runtimeConfig.ownerMappings || {}),
      ...(runtimeConfig.owners || {})
    };

    const normalizedMappings = new Map();
    for (const [key, value] of Object.entries(ownerMappings)) {
      normalizedMappings.set(this.normalizeKey(key), value);
    }

    const candidateKeys = [
      recommendation.owner,
      recommendation.ownerRole,
      recommendation.assignedTo,
      recommendation.team
    ];

    let ownerId = null;
    let source = null;

    for (const candidate of candidateKeys) {
      if (!candidate) continue;
      const normalized = this.normalizeKey(candidate);
      if (normalized && normalizedMappings.has(normalized)) {
        ownerId = normalizedMappings.get(normalized);
        source = 'mapping';
        break;
      }
      if (typeof candidate === 'string' && /^[a-z0-9]{12,}$/i.test(candidate)) {
        ownerId = candidate;
        source = 'direct';
        break;
      }
    }

    const fallbackOwnerId = runtimeConfig.defaultOwnerId || this.crmDefaults.defaultOwnerId || null;

    if (!ownerId && fallbackOwnerId) {
      ownerId = fallbackOwnerId;
      source = 'fallback';
    }

    if (!ownerId) {
      ownerId = await this.getDefaultOwnerId();
      source = 'auto';
    }

    const escalationConfig = {
      ...(this.crmDefaults.escalation || {}),
      ...(runtimeConfig.escalation || {})
    };

    const threshold = escalationConfig.threshold || this.crmDefaults.escalation?.threshold || 'High';
    const shouldEscalate = escalationConfig.enabled !== false && this.shouldEscalate(priority, threshold);

    const escalationOwnerId = escalationConfig.ownerId || this.crmDefaults.escalationOwnerId || null;
    const notify = escalationConfig.notify || [];

    let assignedOwnerId = ownerId;
    let escalated = false;

    if (shouldEscalate) {
      escalated = true;
      if ((source === 'fallback' || source === 'auto') && escalationOwnerId) {
        assignedOwnerId = escalationOwnerId;
        source = 'escalation';
      }
    }

    return {
      ownerId: assignedOwnerId,
      originalOwnerId: ownerId,
      fallbackOwnerId: fallbackOwnerId || ownerId,
      source,
      escalated,
      escalationOwnerId,
      notify
    };
  }

  shouldEscalate(priority, threshold) {
    const priorityRank = this.priorityRank(priority);
    const thresholdRank = this.priorityRank(threshold);
    return priorityRank >= thresholdRank;
  }

  determineDependencies(recommendation, runtimeConfig, currentTasks, tasksByAction, phase) {
    const dependencies = new Set();

    const fromRecommendation = Array.isArray(recommendation.dependencies)
      ? recommendation.dependencies
      : [];

    for (const dep of fromRecommendation) {
      const key = this.normalizeKey(dep);
      if (key && tasksByAction.has(key)) {
        dependencies.add(tasksByAction.get(key));
      }
    }

    const configDeps = runtimeConfig.dependencies || {};
    const mappedDeps = configDeps[recommendation.action] || configDeps[this.normalizeKey(recommendation.action)] || [];
    for (const dep of mappedDeps) {
      const key = this.normalizeKey(dep);
      if (key && tasksByAction.has(key)) {
        dependencies.add(tasksByAction.get(key));
      }
    }

    const autoLink = runtimeConfig?.dependency?.autoLinkPhases === true || this.crmDefaults.dependency?.autoLinkPhases;
    if (autoLink && phase !== 'immediate') {
      currentTasks
        .filter(task => task.phase === 'immediate')
        .forEach(task => dependencies.add(task.clientReferenceId));
    }

    return Array.from(dependencies);
  }

  buildTaskDescription(accountName, recommendation, priorityInfo, dependencies, executionId, clientReferenceId) {
    const details = [
      `Account: ${accountName}`,
      `Rationale: ${recommendation.rationale || 'AI generated recommendation'}`,
      recommendation.expectedOutcome ? `Expected Outcome: ${recommendation.expectedOutcome}` : null,
      recommendation.timeline ? `Timeline: ${recommendation.timeline}` : null,
      dependencies.length > 0 ? `Dependencies: ${dependencies.join(', ')}` : 'Dependencies: None',
      priorityInfo.reason ? `Priority Driver: ${priorityInfo.reason}` : null,
      priorityInfo.relatedRisks && priorityInfo.relatedRisks.length > 0
        ? `Related Risks: ${priorityInfo.relatedRisks.map(r => r.type).join(', ')}`
        : null,
      priorityInfo.relatedOpportunities && priorityInfo.relatedOpportunities.length > 0
        ? `Related Opportunities: ${priorityInfo.relatedOpportunities.map(o => o.type).join(', ')}`
        : null,
      clientReferenceId ? `Client Reference: ${clientReferenceId}` : null,
      executionId ? `Execution ID: ${executionId}` : null
    ];

    return details.filter(Boolean).join('\n');
  }

  generateClientReferenceId(accountName, executionId, action, sequence) {
    const base = `${accountName}:${executionId || 'manual'}:${action}:${sequence}`;
    return createHash('sha1').update(base).digest('hex').slice(0, 16);
  }

  normalizeKey(value) {
    if (!value || typeof value !== 'string') return '';
    return value.toLowerCase().trim();
  }

  buildEscalationPlan(priority, ownerInfo, runtimeConfig) {
    if (!ownerInfo.escalated && !(ownerInfo.notify && ownerInfo.notify.length > 0)) {
      return null;
    }

    const escalationConfig = {
      ...(this.crmDefaults.escalation || {}),
      ...(runtimeConfig.escalation || {})
    };

    return {
      triggered: ownerInfo.escalated,
      threshold: escalationConfig.threshold || this.crmDefaults.escalation?.threshold || 'High',
      escalationOwnerId: ownerInfo.escalationOwnerId,
      previousOwnerId: ownerInfo.originalOwnerId,
      notify: ownerInfo.notify || [],
      reason: ownerInfo.escalated ? `Priority ${priority} met escalation threshold` : undefined
    };
  }

  sanitizeTaskForResponse(task, overrides = {}) {
    return {
      id: overrides.id,
      clientReferenceId: task.clientReferenceId,
      subject: task.subject,
      description: task.description,
      priority: task.priority,
      priorityScore: task.priorityScore,
      status: overrides.status || task.status,
      ownerId: task.ownerId,
      ownerSource: task.ownerSource,
      dueDate: task.dueDate,
      dependencies: task.dependencies,
      phase: task.phase,
      accountId: task.accountId,
      accountName: task.accountName,
      escalation: task.escalation,
      relatedRisks: task.relatedRisks,
      relatedOpportunities: task.relatedOpportunities,
      verification: overrides.verification || null
    };
  }

  async recordTaskLifecycle(accountName, task, stage, data = {}) {
    try {
      statusService.record('crmTasks', {
        account: accountName,
        stage,
        task: task.subject,
        priority: task.priority,
        owner: task.ownerId,
        clientReferenceId: task.clientReferenceId,
        crmType: this.crmType,
        status: data.status || task.status,
        id: data.id
      });

      if (this.redis?.isConnected()) {
        const ttl = this.crmDefaults.progressTTLSeconds || 604800;
        const key = `${this.taskNamespace}:${accountName}:${task.clientReferenceId}`;
        const payload = {
          stage,
          crmType: this.crmType,
          task: {
            clientReferenceId: task.clientReferenceId,
            subject: task.subject,
            priority: task.priority,
            ownerId: task.ownerId,
            status: data.status || task.status,
            dueDate: task.dueDate,
            dependencies: task.dependencies,
            phase: task.phase
          },
          data: this.sanitizeLifecycleData(data),
          updatedAt: new Date().toISOString()
        };
        await this.redis.setCache(key, payload, ttl);
      }
    } catch (error) {
      this.logger.warn('⚠️ Failed to record task lifecycle event', {
        stage,
        error: error.message
      });
    }
  }

  sanitizeLifecycleData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const allowedKeys = ['id', 'status', 'mode', 'verified', 'error'];
    const sanitized = {};
    for (const key of allowedKeys) {
      if (key in data) {
        sanitized[key] = data[key];
      }
    }
    return sanitized;
  }

  async verifyTaskCreation(taskRecord) {
    if (!this.crmClient || !taskRecord?.id) {
      return { verified: false, status: 'skipped' };
    }

    try {
      switch (this.crmType) {
        case 'salesforce': {
          const { data } = await this.crmClient.get(`/services/data/v61.0/sobjects/Task/${taskRecord.id}`);
          return {
            verified: !!data?.Id,
            status: data?.Status || 'Unknown'
          };
        }
        case 'hubspot': {
          const { data } = await this.crmClient.get(`/crm/v3/objects/tasks/${taskRecord.id}`);
          return {
            verified: !!data?.id,
            status: data?.properties?.hs_task_status || 'Unknown'
          };
        }
        case 'pipedrive': {
          const { data } = await this.crmClient.get(`/activities/${taskRecord.id}`);
          return {
            verified: !!data?.data?.id,
            status: data?.data?.done === true ? 'Completed' : 'Not Started'
          };
        }
        default:
          return { verified: false, status: 'unsupported' };
      }
    } catch (error) {
      this.logger.warn('⚠️ Task verification failed', {
        taskId: taskRecord.id,
        crmType: this.crmType,
        error: error.message
      });
      return { verified: false, status: 'error', error: error.message };
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
    if (!this.crmClient) {
      return `mock-account-${accountName}`;
    }

    try {
      switch (this.crmType) {
        case 'salesforce': {
          const escaped = accountName.replace(/'/g, "\\'");
          const query = encodeURIComponent(`SELECT Id FROM Account WHERE Name = '${escaped}' LIMIT 1`);
          const { data } = await this.crmClient.get(`/services/data/v61.0/query?q=${query}`);
          return data?.records?.[0]?.Id || null;
        }
        case 'hubspot': {
          const payload = {
            filterGroups: [{ filters: [{ propertyName: 'name', operator: 'EQ', value: accountName }] }],
            limit: 1
          };
          const { data } = await this.crmClient.post('/crm/v3/objects/companies/search', payload);
          return data?.results?.[0]?.id || null;
        }
        case 'pipedrive': {
          const { data } = await this.crmClient.get(`/organizations/search?term=${encodeURIComponent(accountName)}&limit=1`);
          return data?.data?.items?.[0]?.item?.id || null;
        }
        default:
          return null;
      }
    } catch (error) {
      this.logger.warn('⚠️ Account lookup failed', {
        accountName,
        crmType: this.crmType,
        error: error.message
      });
      return null;
    }
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
    if (!this.crmClient) {
      return { id: `mock-task-${Date.now()}`, status: taskData.status, clientReferenceId: taskData.clientReferenceId };
    }

    try {
      switch (this.crmType) {
        case 'salesforce': {
          const payload = {
            Subject: taskData.subject,
            Description: taskData.description,
            Priority: this.mapPriorityToSalesforce(taskData.priority),
            Status: this.mapStatusToSalesforce(taskData.status),
            ActivityDate: taskData.dueDate ? taskData.dueDate.split('T')[0] : undefined,
            OwnerId: taskData.ownerId,
            WhatId: taskData.accountId,
            Type: taskData.type || 'Task'
          };

          Object.keys(payload).forEach(key => {
            if (payload[key] === undefined || payload[key] === null) {
              delete payload[key];
            }
          });

          const { data } = await this.crmClient.post('/services/data/v61.0/sobjects/Task', payload);
          return {
            id: data?.id,
            status: payload.Status,
            ownerId: payload.OwnerId,
            priority: payload.Priority,
            clientReferenceId: taskData.clientReferenceId
          };
        }

        case 'hubspot': {
          const payload = {
            properties: {
              hs_task_subject: taskData.subject,
              hs_task_body: taskData.description,
              hs_task_priority: this.mapPriorityToHubspot(taskData.priority),
              hs_task_status: this.mapStatusToHubspot(taskData.status),
              hs_timestamp: taskData.dueDate || new Date().toISOString()
            }
          };

          if (taskData.ownerId) {
            payload.properties.hubspot_owner_id = taskData.ownerId;
          }

          const { data } = await this.crmClient.post('/crm/v3/objects/tasks', payload);
          return {
            id: data?.id,
            status: data?.properties?.hs_task_status || payload.properties.hs_task_status,
            ownerId: payload.properties.hubspot_owner_id,
            priority: payload.properties.hs_task_priority,
            clientReferenceId: taskData.clientReferenceId
          };
        }

        case 'pipedrive': {
          const payload = {
            subject: taskData.subject,
            type: 'task',
            note: taskData.description,
            due_date: taskData.dueDate ? taskData.dueDate.split('T')[0] : undefined,
            due_time: '09:00',
            duration: '00:30',
            user_id: taskData.ownerId,
            org_id: taskData.accountId,
            done: 0,
            priority: this.mapPriorityToPipedrive(taskData.priority)
          };

          const { data } = await this.crmClient.post('/activities', payload);
          return {
            id: data?.data?.id,
            status: data?.data?.done ? 'Completed' : taskData.status,
            ownerId: payload.user_id,
            priority: taskData.priority,
            clientReferenceId: taskData.clientReferenceId
          };
        }

        default:
          return { id: `mock-task-${Date.now()}`, status: taskData.status, clientReferenceId: taskData.clientReferenceId };
      }
    } catch (error) {
      throw new Error(`Failed to create ${this.crmType} task: ${error.message}`);
    }
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

  mapPriorityToSalesforce(priority) {
    const normalized = this.normalizePriority(priority) || 'Medium';
    const mapping = {
      Critical: 'High',
      High: 'High',
      Medium: 'Normal',
      Low: 'Low'
    };
    return mapping[normalized] || 'Normal';
  }

  mapStatusToSalesforce(status) {
    const normalized = this.normalizeStatus(status);
    const mapping = {
      Completed: 'Completed',
      'In Progress': 'In Progress',
      Waiting: 'Waiting on someone else',
      Deferred: 'Deferred',
      'Not Started': 'Not Started'
    };
    return mapping[normalized] || 'Not Started';
  }

  mapPriorityToHubspot(priority) {
    const normalized = this.normalizePriority(priority) || 'Medium';
    const mapping = {
      Critical: 'HIGH',
      High: 'HIGH',
      Medium: 'MEDIUM',
      Low: 'LOW'
    };
    return mapping[normalized] || 'MEDIUM';
  }

  mapStatusToHubspot(status) {
    const normalized = this.normalizeStatus(status);
    const mapping = {
      Completed: 'COMPLETED',
      'In Progress': 'IN_PROGRESS',
      Waiting: 'WAITING',
      Deferred: 'DEFERRED',
      'Not Started': 'NOT_STARTED'
    };
    return mapping[normalized] || 'NOT_STARTED';
  }

  mapPriorityToPipedrive(priority) {
    const normalized = this.normalizePriority(priority) || 'Medium';
    const mapping = {
      Critical: 2,
      High: 2,
      Medium: 1,
      Low: 0
    };
    return mapping[normalized] ?? 1;
  }

  normalizeStatus(status) {
    if (!status || typeof status !== 'string') return 'Not Started';
    const normalized = this.normalizeKey(status);
    if (normalized.includes('complete') || normalized.includes('done')) return 'Completed';
    if (normalized.includes('progress')) return 'In Progress';
    if (normalized.includes('wait')) return 'Waiting';
    if (normalized.includes('defer')) return 'Deferred';
    return 'Not Started';
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
    if (this.crmDefaults?.defaultOwnerId) {
      return this.crmDefaults.defaultOwnerId;
    }

    if (process.env.CRM_TASK_DEFAULT_OWNER_ID) {
      return process.env.CRM_TASK_DEFAULT_OWNER_ID;
    }

    if (!this.crmClient) {
      return 'default-owner-id';
    }

    try {
      switch (this.crmType) {
        case 'salesforce': {
          const query = encodeURIComponent("SELECT Id FROM User WHERE IsActive = true ORDER BY LastLoginDate DESC LIMIT 1");
          const { data } = await this.crmClient.get(`/services/data/v61.0/query?q=${query}`);
          return data?.records?.[0]?.Id || 'default-owner-id';
        }
        case 'hubspot': {
          const { data } = await this.crmClient.get('/crm/v3/owners?limit=1');
          return data?.results?.[0]?.id || 'default-owner-id';
        }
        case 'pipedrive': {
          const { data } = await this.crmClient.get('/users/me');
          return data?.data?.id || 'default-owner-id';
        }
        default:
          return 'default-owner-id';
      }
    } catch (error) {
      this.logger.warn('⚠️ Unable to resolve default owner from CRM', {
        crmType: this.crmType,
        error: error.message
      });
      return 'default-owner-id';
    }
  }
}
