import express from 'express';
import { Logger } from '../utils/logger.js';

export function createDemoAPI(workflowOrchestrator) {
  const router = express.Router();
  const logger = new Logger();

  // Trigger demo workflow for account
  router.post('/demo/:accountName', async (req, res) => {
    const { accountName } = req.params;
    const { recipients = ['demo@example.com'], template = 'default' } = req.body;

    logger.info('🎯 Demo workflow triggered', { accountName });

    try {
      // Create demo workflow configuration
      const demoWorkflow = {
        name: `Demo: ${accountName} Account Plan`,
        description: 'Automated demo account plan generation',
        trigger: { type: 'manual' },
        accounts: [
          {
            accountName,
            customization: {
              focusAreas: ['growth', 'retention', 'expansion']
            }
          }
        ],
        distributors: [
          {
            type: 'email',
            config: {
              recipients: recipients.map(email => ({ email })),
              subject: `Demo Account Plan: ${accountName}`,
              template
            }
          }
        ],
        enabled: true,
        engine: 'internal'
      };

      // Create and execute workflow
      const workflow = await workflowOrchestrator.createWorkflow(demoWorkflow);
      const execution = await workflowOrchestrator.executeWorkflow(workflow.id, {
        trigger: 'demo-api',
        requestedBy: req.ip,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Demo account plan generated for ${accountName}`,
        workflowId: workflow.id,
        executionId: execution.executionId,
        results: execution.results,
        timestamp: execution.completedAt
      });

    } catch (error) {
      logger.error('❌ Demo workflow failed', {
        accountName,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Demo workflow execution failed',
        details: error.message,
        accountName
      });
    }
  });

  // Get demo status
  router.get('/status', async (req, res) => {
    try {
      const workflows = workflowOrchestrator.listWorkflows();
      const demoWorkflows = workflows.filter(w => w.name.startsWith('Demo:'));
      
      res.json({
        success: true,
        status: 'ready',
        totalWorkflows: workflows.length,
        demoWorkflows: demoWorkflows.length,
        availableAccounts: [
          'Acme Retail',
          'NorthStar Logistics', 
          'TechForward Solutions',
          'GlobalCorp Industries',
          'Stripe'
        ],
        capabilities: {
          emailDistribution: true,
          aiAnalysis: true,
          dataIntegration: true,
          realTimeExecution: true
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Status check failed',
        details: error.message
      });
    }
  });

  // List recent executions
  router.get('/executions', async (req, res) => {
    try {
      const workflows = workflowOrchestrator.listWorkflows();
      const executions = workflows
        .filter(w => w.name.startsWith('Demo:'))
        .map(w => ({
          workflowId: w.id,
          accountName: w.accounts[0]?.accountName,
          status: w.status,
          lastRun: w.lastRun,
          createdAt: w.createdAt
        }))
        .sort((a, b) => new Date(b.lastRun || b.createdAt) - new Date(a.lastRun || a.createdAt))
        .slice(0, 10);

      res.json({
        success: true,
        executions,
        total: executions.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch executions',
        details: error.message
      });
    }
  });

  return router;
}