import express from 'express';
import { Logger } from '../utils/logger.js';

export function createDemoAPI(workflowOrchestrator) {
  const router = express.Router();
  const logger = new Logger();

  // Trigger demo workflow for account (production: run real planning + optional distribution)
  router.post('/demo/:accountName', async (req, res) => {
    try {
      const { accountName } = req.params;
      const { recipients = [], subject, template = 'executive', slackChannel, slackFormat } = req.body || {};

      logger.info('🎯 Demo workflow triggered', { accountName });

      // Build ephemeral workflow config
      const distributors = [];
      if (Array.isArray(recipients) && recipients.length > 0) {
        const normalized = recipients.map(r => typeof r === 'string' ? { email: r } : r).filter(r => r && r.email);
        if (normalized.length > 0) {
          distributors.push({
            type: 'email',
            config: {
              recipients: normalized,
              subject: subject || `Account Plan: ${accountName}`,
              template: template || 'executive'
            }
          });
        }
      }
      if (slackChannel) {
        distributors.push({
          type: 'slack',
          config: { channels: [{ channel: slackChannel }], format: slackFormat || 'summary' }
        });
      }

      // Create a temporary workflow, execute, then clean up
      const wf = workflowOrchestrator.createWorkflow({
        name: `Quick Plan: ${accountName}`,
        description: 'One-time account plan generation (Demo API)',
        trigger: { type: 'manual' },
        accounts: [{ accountName }],
        distributors,
        enabled: true
      });

      const execution = await workflowOrchestrator.executeWorkflow(wf.id, {
        triggeredBy: 'demo_api',
        apiRequest: true
      });

      // Best-effort cleanup (ignore errors)
      try { await workflowOrchestrator.deleteWorkflow(wf.id); } catch (_) {}

      return res.json({ success: true, status: 'success', execution });
    } catch (error) {
      logger.error('❌ Demo API execution failed', { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
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
