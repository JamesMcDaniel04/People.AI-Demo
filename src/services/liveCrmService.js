import { CRMDistributor } from '../workflows/distributors/crmDistributor.js';
import { Logger } from '../utils/logger.js';
import { statusService } from './statusService.js';

export class LiveCRMService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.distributors = new Map();
    this.connectionStatus = new Map();
    this.activeConnections = new Set();
  }

  async initialize() {
    this.logger.info('🔄 Initializing Live CRM Service...');

    const crmTypes = ['salesforce', 'hubspot', 'pipedrive'];

    for (const crmType of crmTypes) {
      try {
        const distributor = new CRMDistributor({ ...this.config, crmType });
        distributor.crmType = crmType;

        await distributor.initialize();

        this.distributors.set(crmType, distributor);

        if (!distributor.mockMode) {
          this.activeConnections.add(crmType);
          this.connectionStatus.set(crmType, {
            status: 'connected',
            lastTest: new Date().toISOString(),
            error: null
          });
          this.logger.info(`✅ ${crmType.toUpperCase()} CRM connected successfully`);
        } else {
          this.connectionStatus.set(crmType, {
            status: 'mock',
            lastTest: new Date().toISOString(),
            error: 'No credentials provided'
          });
        }
      } catch (error) {
        this.connectionStatus.set(crmType, {
          status: 'failed',
          lastTest: new Date().toISOString(),
          error: error.message
        });
        this.logger.warn(`⚠️ ${crmType.toUpperCase()} CRM connection failed: ${error.message}`);
      }
    }

    this.logger.info(`✅ Live CRM Service initialized. Active connections: ${this.activeConnections.size}`);
    return this.activeConnections.size > 0;
  }

  async createTasksInAllCRMs(accountPlan, config, context) {
    const results = new Map();
    const { accountName } = context;

    this.logger.info('🔄 Creating tasks in all connected CRMs', {
      accountName,
      activeCRMs: Array.from(this.activeConnections)
    });

    for (const crmType of this.activeConnections) {
      try {
        const distributor = this.distributors.get(crmType);
        if (!distributor) continue;

        const startTime = Date.now();
        const result = await distributor.createTasks(accountPlan, config, context);
        const duration = Date.now() - startTime;

        results.set(crmType, {
          ...result,
          duration,
          crmType,
          timestamp: new Date().toISOString()
        });

        this.logger.info(`✅ Tasks created in ${crmType.toUpperCase()}`, {
          accountName,
          taskCount: result.taskCount,
          duration: `${duration}ms`
        });

        // Record metrics
        statusService.record('crmLive', {
          account: accountName,
          crm: crmType,
          action: 'createTasks',
          ok: result.status === 'success',
          count: result.taskCount,
          duration
        });

      } catch (error) {
        results.set(crmType, {
          status: 'failed',
          error: error.message,
          crmType,
          timestamp: new Date().toISOString()
        });

        this.logger.error(`❌ Task creation failed in ${crmType.toUpperCase()}`, {
          accountName,
          error: error.message
        });

        statusService.record('crmLive', {
          account: accountName,
          crm: crmType,
          action: 'createTasks',
          ok: false,
          error: error.message
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      accountName,
      results: Object.fromEntries(results),
      totalCRMs: this.activeConnections.size,
      successfulCRMs: Array.from(results.values()).filter(r => r.status === 'success').length
    };
  }

  async updateAccountInAllCRMs(accountPlan, config, context) {
    const results = new Map();
    const { accountName } = context;

    for (const crmType of this.activeConnections) {
      try {
        const distributor = this.distributors.get(crmType);
        if (!distributor) continue;

        const result = await distributor.updateAccountRecord(accountPlan, config, context);
        results.set(crmType, { ...result, crmType });

        this.logger.info(`✅ Account updated in ${crmType.toUpperCase()}`, {
          accountName,
          accountId: result.accountId
        });

      } catch (error) {
        results.set(crmType, {
          status: 'failed',
          error: error.message,
          crmType
        });

        this.logger.error(`❌ Account update failed in ${crmType.toUpperCase()}`, {
          accountName,
          error: error.message
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      accountName,
      results: Object.fromEntries(results),
      totalCRMs: this.activeConnections.size
    };
  }

  async testAllConnections() {
    this.logger.info('🔄 Testing all CRM connections...');
    const results = new Map();

    for (const [crmType, distributor] of this.distributors) {
      try {
        const startTime = Date.now();
        await distributor.testConnection();
        const duration = Date.now() - startTime;

        results.set(crmType, {
          status: 'success',
          duration,
          timestamp: new Date().toISOString()
        });

        this.connectionStatus.set(crmType, {
          status: 'connected',
          lastTest: new Date().toISOString(),
          error: null,
          duration
        });

      } catch (error) {
        results.set(crmType, {
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });

        this.connectionStatus.set(crmType, {
          status: 'failed',
          lastTest: new Date().toISOString(),
          error: error.message
        });
      }
    }

    return Object.fromEntries(results);
  }

  getConnectionStatus() {
    return {
      activeConnections: Array.from(this.activeConnections),
      totalConfigured: this.distributors.size,
      status: Object.fromEntries(this.connectionStatus),
      lastUpdated: new Date().toISOString()
    };
  }

  async findAccountAcrossAllCRMs(accountName) {
    const results = new Map();

    for (const crmType of this.activeConnections) {
      try {
        const distributor = this.distributors.get(crmType);
        if (!distributor) continue;

        const accountId = await distributor.findAccountId(accountName);

        results.set(crmType, {
          accountId,
          found: !!accountId,
          crmType
        });

      } catch (error) {
        results.set(crmType, {
          accountId: null,
          found: false,
          error: error.message,
          crmType
        });
      }
    }

    return {
      accountName,
      results: Object.fromEntries(results),
      foundIn: Array.from(results.entries())
        .filter(([_, result]) => result.found)
        .map(([crmType]) => crmType)
    };
  }

  async getTaskVerificationReport(accountName, executionId) {
    const results = new Map();

    for (const crmType of this.activeConnections) {
      try {
        const distributor = this.distributors.get(crmType);
        if (!distributor || !distributor.redis?.isConnected()) continue;

        // Get all tasks for this account and execution
        const pattern = `${distributor.taskNamespace}:${accountName}:*`;
        const keys = await distributor.redis.scanKeys(pattern);

        const tasks = [];
        for (const key of keys) {
          const task = await distributor.redis.getCache(key);
          if (task && task.task?.executionId === executionId) {
            tasks.push(task);
          }
        }

        results.set(crmType, {
          taskCount: tasks.length,
          tasks: tasks.map(t => ({
            clientReferenceId: t.task.clientReferenceId,
            subject: t.task.subject,
            status: t.task.status,
            stage: t.stage,
            priority: t.task.priority,
            owner: t.task.ownerId
          })),
          crmType
        });

      } catch (error) {
        results.set(crmType, {
          taskCount: 0,
          tasks: [],
          error: error.message,
          crmType
        });
      }
    }

    return {
      accountName,
      executionId,
      results: Object.fromEntries(results),
      timestamp: new Date().toISOString()
    };
  }

  async validateCRMConfiguration() {
    const validation = {
      salesforce: {
        required: ['SALESFORCE_INSTANCE_URL', 'SALESFORCE_ACCESS_TOKEN'],
        optional: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET']
      },
      hubspot: {
        required: ['HUBSPOT_ACCESS_TOKEN'],
        optional: ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET']
      },
      pipedrive: {
        required: ['PIPEDRIVE_API_TOKEN'],
        optional: ['PIPEDRIVE_COMPANY_DOMAIN']
      }
    };

    const results = {};

    for (const [crmType, config] of Object.entries(validation)) {
      const missing = config.required.filter(env => !process.env[env]);
      const present = config.required.filter(env => !!process.env[env]);

      results[crmType] = {
        configured: missing.length === 0,
        missing,
        present,
        optional: config.optional.filter(env => !!process.env[env])
      };
    }

    return results;
  }
}

// Export singleton instance
let liveCrmService = null;

export function getLiveCrmService(config) {
  if (!liveCrmService) {
    liveCrmService = new LiveCRMService(config);
  }
  return liveCrmService;
}