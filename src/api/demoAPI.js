import express from 'express';
import { Logger } from '../utils/logger.js';

export function createDemoAPI(workflowOrchestrator) {
  const router = express.Router();
  const logger = new Logger();

  // Trigger demo workflow for account (mock: returns hardcoded message)
  router.post('/demo/:accountName', async (req, res) => {
    const { accountName } = req.params;
    logger.info('🎯 Demo workflow (mock) triggered', { accountName });

    const mockMessage = `:robot_face: Account Plan: TechFlow Dynamics :bar_chart: Health: 90/100 :large_green_circle:
**Summary:**
- Emails, calls, and meeting notes show strong engagement between TechFlow Dynamics and Stripe. Implementation is on track, with Q1 performance exceeding targets (23% conversion improvement, $890K cost savings, international launches in UK/Germany).
- Key personas: Priya Patel (VP Eng), David Kim (CFO), James Mitchell (CEO), Michael Torres (Product), Lisa Johnson (Finance), Jennifer Wong (CSM, Stripe), Sarah Chen (AE, Stripe), Marcus Rodriguez (SE, Stripe).
- Recent calls: Executive briefing, QBR, technical deep dives, implementation reviews—all show alignment and momentum.
**Top 3 Strategic Recommendations:**
1. Launch Stripe Billing for subscription automation by 2025-09-18
2. Expand to Australia/Japan by 2025-10-15
3. Implement Stripe Radar for fraud reduction by 2025-09-25
**Expansion Opportunities:**
- Stripe Capital for revenue-based financing
- Deeper product adoption (Radar, Billing)
- APAC market entry
**Risks:**
- Integration complexity, resource allocation, competitive pressure
**Next Actions:**
- Schedule Q2 planning call by 2025-09-13
- Assign technical lead for APAC launch by 2025-09-20
- Review fraud metrics post-Radar by 2025-09-30
:busts_in_silhouette: Owner: @jennifer.wong@stripe.com`;

    console.log('\n===== MOCK ACCOUNT PLAN (HARD-CODED) =====\n');
    console.log(mockMessage);
    console.log('\n==========================================\n');

    return res.json({ success: true, message: mockMessage, accountName });
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
