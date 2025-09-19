import express from 'express';
import { getLiveCrmService } from '../services/liveCrmService.js';
import { Logger } from '../utils/logger.js';
import { statusService } from '../services/statusService.js';

export function createCRMAPI(config) {
  const router = express.Router();
  const logger = new Logger(config);

  // Get CRM connection status
  router.get('/status', async (req, res) => {
    try {
      const liveCrmService = getLiveCrmService(config);
      await liveCrmService.initialize();

      const status = liveCrmService.getConnectionStatus();
      const validation = await liveCrmService.validateCRMConfiguration();

      res.json({
        success: true,
        data: {
          ...status,
          configuration: validation
        }
      });
    } catch (error) {
      logger.error('Failed to get CRM status', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Test CRM connections
  router.post('/test', async (req, res) => {
    try {
      const liveCrmService = getLiveCrmService(config);
      await liveCrmService.initialize();

      const results = await liveCrmService.testAllConnections();

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to test CRM connections', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Create tasks in all connected CRMs
  router.post('/tasks/create', async (req, res) => {
    try {
      const { accountPlan, config: taskConfig, context } = req.body;

      if (!accountPlan || !context?.accountName) {
        return res.status(400).json({
          success: false,
          error: 'accountPlan and context.accountName are required'
        });
      }

      const liveCrmService = getLiveCrmService(config);
      await liveCrmService.initialize();

      const results = await liveCrmService.createTasksInAllCRMs(
        accountPlan,
        taskConfig || {},
        context
      );

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to create CRM tasks', {
        error: error.message,
        accountName: req.body?.context?.accountName
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Update account in all connected CRMs
  router.post('/accounts/update', async (req, res) => {
    try {
      const { accountPlan, config: updateConfig, context } = req.body;

      if (!accountPlan || !context?.accountName) {
        return res.status(400).json({
          success: false,
          error: 'accountPlan and context.accountName are required'
        });
      }

      const liveCrmService = getLiveCrmService(config);
      await liveCrmService.initialize();

      const results = await liveCrmService.updateAccountInAllCRMs(
        accountPlan,
        updateConfig || {},
        context
      );

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to update CRM accounts', {
        error: error.message,
        accountName: req.body?.context?.accountName
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Find account across all CRMs
  router.get('/accounts/find/:accountName', async (req, res) => {
    try {
      const { accountName } = req.params;

      if (!accountName) {
        return res.status(400).json({
          success: false,
          error: 'accountName is required'
        });
      }

      const liveCrmService = getLiveCrmService(config);
      await liveCrmService.initialize();

      const results = await liveCrmService.findAccountAcrossAllCRMs(accountName);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to find account in CRMs', {
        error: error.message,
        accountName: req.params.accountName
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get task verification report
  router.get('/tasks/verify/:accountName/:executionId', async (req, res) => {
    try {
      const { accountName, executionId } = req.params;

      if (!accountName || !executionId) {
        return res.status(400).json({
          success: false,
          error: 'accountName and executionId are required'
        });
      }

      const liveCrmService = getLiveCrmService(config);
      await liveCrmService.initialize();

      const report = await liveCrmService.getTaskVerificationReport(accountName, executionId);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Failed to get task verification report', {
        error: error.message,
        accountName: req.params.accountName,
        executionId: req.params.executionId
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get CRM configuration validation
  router.get('/config/validate', async (req, res) => {
    try {
      const liveCrmService = getLiveCrmService(config);
      const validation = await liveCrmService.validateCRMConfiguration();

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      logger.error('Failed to validate CRM configuration', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get CRM metrics and analytics
  router.get('/metrics', async (req, res) => {
    try {
      const { hours = 24 } = req.query;
      const timeRange = parseInt(hours) * 60 * 60 * 1000;

      const crmMetrics = statusService.getRecentMetrics('crmLive', timeRange);
      const taskMetrics = statusService.getRecentMetrics('crmTasks', timeRange);

      const summary = {
        timeRange: `${hours} hours`,
        crmOperations: {
          total: crmMetrics.length,
          successful: crmMetrics.filter(m => m.ok).length,
          failed: crmMetrics.filter(m => !m.ok).length,
          successRate: crmMetrics.length > 0 ? Math.round((crmMetrics.filter(m => m.ok).length / crmMetrics.length) * 100) : 0
        },
        taskCreation: {
          total: taskMetrics.length,
          successful: taskMetrics.filter(m => m.ok).length,
          failed: taskMetrics.filter(m => !m.ok).length,
          successRate: taskMetrics.length > 0 ? Math.round((taskMetrics.filter(m => m.ok).length / taskMetrics.length) * 100) : 0
        },
        byAccount: groupByAccount(taskMetrics),
        byCRM: groupByCRM([...crmMetrics, ...taskMetrics]),
        lastUpdated: new Date().toISOString()
      };

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Failed to get CRM metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Trigger bulk CRM operation
  router.post('/bulk/sync', async (req, res) => {
    try {
      const { accounts, operations = ['updateAccount', 'createTasks'] } = req.body;

      if (!Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'accounts array is required'
        });
      }

      const liveCrmService = getLiveCrmService(config);
      await liveCrmService.initialize();

      const results = {};
      let totalSuccess = 0;
      let totalFailed = 0;

      for (const accountData of accounts) {
        const { accountName, accountPlan, context } = accountData;

        if (!accountName || !accountPlan) {
          results[accountName || 'unknown'] = {
            status: 'failed',
            error: 'accountName and accountPlan are required'
          };
          totalFailed++;
          continue;
        }

        try {
          const accountResults = {};

          if (operations.includes('updateAccount')) {
            accountResults.updateAccount = await liveCrmService.updateAccountInAllCRMs(
              accountPlan,
              {},
              { ...context, accountName }
            );
          }

          if (operations.includes('createTasks')) {
            accountResults.createTasks = await liveCrmService.createTasksInAllCRMs(
              accountPlan,
              {},
              { ...context, accountName }
            );
          }

          results[accountName] = {
            status: 'success',
            operations: accountResults,
            timestamp: new Date().toISOString()
          };
          totalSuccess++;

        } catch (error) {
          results[accountName] = {
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          };
          totalFailed++;
        }
      }

      res.json({
        success: true,
        data: {
          summary: {
            total: accounts.length,
            successful: totalSuccess,
            failed: totalFailed,
            successRate: Math.round((totalSuccess / accounts.length) * 100)
          },
          results,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to execute bulk CRM sync', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

function groupByAccount(metrics) {
  const grouped = {};
  for (const metric of metrics) {
    if (!metric.account) continue;
    if (!grouped[metric.account]) {
      grouped[metric.account] = { total: 0, successful: 0, failed: 0 };
    }
    grouped[metric.account].total++;
    if (metric.ok) {
      grouped[metric.account].successful++;
    } else {
      grouped[metric.account].failed++;
    }
  }
  return grouped;
}

function groupByCRM(metrics) {
  const grouped = {};
  for (const metric of metrics) {
    const crm = metric.crm || 'unknown';
    if (!grouped[crm]) {
      grouped[crm] = { total: 0, successful: 0, failed: 0 };
    }
    grouped[crm].total++;
    if (metric.ok) {
      grouped[crm].successful++;
    } else {
      grouped[crm].failed++;
    }
  }
  return grouped;
}