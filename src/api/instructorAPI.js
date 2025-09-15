import express from 'express';
import { MixedAIService } from '../ai/services/mixedAIService.js';
import { metrics } from '../services/metricsService.js';

export function createInstructorAPI(orchestrator, baseConfig) {
  const router = express.Router();

  // Health for instructor API
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Run an instructor-driven plan generation flow
  // Body: { accountName, instructions, prompt?, provider?, modelName?, distributors? }
  router.post('/run', async (req, res) => {
    const { accountName, instructions, prompt, provider, modelName, distributors } = req.body || {};
    if (!accountName || !instructions) {
      return res.status(400).json({ error: 'accountName and instructions are required' });
    }

    try {
      const timer = metrics.time('instructor:run');
      // Gather account data (sample/MCP/external based on config)
      const dataManager = orchestrator.dataManager;
      const accountData = await dataManager.getAccountData(accountName);

      // Prepare AI service with selected provider
      const config = { ...baseConfig, ai: { ...baseConfig.ai } };
      if (provider && ['openai', 'anthropic', 'mixed'].includes(provider)) {
        config.ai.provider = provider;
      }

      const ai = new MixedAIService(config, dataManager.getKlavisProvider?.() || null);

      // Compose system override from instructor text
      const systemOverride = `Agent Instructor Directives:\n${instructions}\n\nYou must follow these directives while producing the requested output.`;

      // Build a single-shot prompt to produce a complete plan document
      const basePrompt = prompt || `
Generate a comprehensive, JSON-only account plan for the account below.\nFollow the schema used by this system and keep values realistic and consistent with the provided data.\n
Account Information:\n${JSON.stringify(accountData.basic?.data || {}, null, 2)}\n\nInteractions (sample):\n${JSON.stringify(accountData.interactions?.[0]?.data?.slice(0, 10) || [], null, 2)}\n\nStakeholders:\n${JSON.stringify(accountData.stakeholders?.[0]?.data || [], null, 2)}\n\nEmails:\n${JSON.stringify(accountData.emails?.[0]?.data?.slice(0, 5) || [], null, 2)}\n\nCalls:\n${JSON.stringify(accountData.calls?.[0]?.data?.slice(0, 5) || [], null, 2)}\n\nExternal Signals:\n${JSON.stringify(accountData.external?.[0]?.data || {}, null, 2)}\n\nReturn strictly valid JSON matching this shape (no markdown):\n{
  "metadata": {"accountName": string, "generatedDate": string},
  "executiveSummary": {"overview": string, "keyHighlights": [string], "recommendation": string},
  "accountOverview": {"currentStatus": object, "healthScore": object, "keyMetrics": object, "relationshipHealth": string},
  "opportunityAnalysis": {"identifiedOpportunities": [object], "potentialValue": number, "prioritization": [object], "timeframe": object},
  "stakeholderMap": {"visualization": object, "keyRelationships": [object], "engagementStrategy": object, "riskAssessment": object},
  "strategicRecommendations": {"immediate": [object], "shortTerm": [object], "longTerm": [object], "resourceRequirements": [string]},
  "riskAssessment": {"identifiedRisks": [object], "mitigationStrategies": [object], "contingencyPlans": [object], "monitoringPlan": object},
  "actionPlan": {"nextSteps": [object], "timeline": object, "successMetrics": object, "reviewSchedule": object},
  "dataInsights": {"keyInsights": [object], "trends": object, "dataQuality": object, "recommendations": [string]}
}`;

      const model = modelName || (config.ai.provider === 'openai' ? config.ai.models.opportunities : config.ai.models.health);

      // Prefer tool calling when available
      let content;
      try {
        content = await ai.generateCompletionWithTools(basePrompt, model, { systemOverride, temperature: 0.2, max_tokens: 4000 });
      } catch (_e) {
        content = await ai.generateCompletion(basePrompt, model, { systemOverride, temperature: 0.2, max_tokens: 4000 });
      }

      // Parse plan JSON
      let plan;
      try {
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        const slice = jsonStart >= 0 ? content.slice(jsonStart, jsonEnd + 1) : content;
        plan = JSON.parse(slice);
      } catch (err) {
        return res.status(502).json({ error: 'AI response parse error', detail: err.message, raw: content?.slice(0, 500) });
      }

      // Validate plan schema
      try {
        const { default: Ajv } = await import('ajv');
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const ajv = new Ajv({ allErrors: true });
        const schema = JSON.parse(readFileSync(join(process.cwd(), 'schemas', 'account_plan.schema.json'), 'utf8'));
        const validate = ajv.compile(schema);
        if (!validate(plan)) {
          return res.status(422).json({ error: 'Plan schema invalid', details: validate.errors });
        }
      } catch (e) {
        // Non-fatal: continue without schema block
      }

      // Attach minimal citations (grounding) and sanitize existing sources
      try {
        const emails = (accountData.emails?.[0]?.data || accountData.emails || []).map(e => e.thread_id || e.id).filter(Boolean);
        const calls = (accountData.calls?.[0]?.data || accountData.calls || []).map(c => c.call_id || c.id).filter(Boolean);
        const cite = () => {
          const arr = [];
          if (emails[0]) arr.push({ type: 'email', id: emails[0] });
          if (calls[0]) arr.push({ type: 'call', id: calls[0] });
          return arr;
        };
        const filterSources = (arr) => (arr || []).filter(s => (s.type === 'email' && emails.includes(s.id)) || (s.type === 'call' && calls.includes(s.id)));
        if (Array.isArray(plan?.dataInsights?.keyInsights)) {
          plan.dataInsights.keyInsights = plan.dataInsights.keyInsights.map(ins => ({ ...ins, sources: filterSources(ins.sources) || cite() }));
        }
        if (Array.isArray(plan?.opportunityAnalysis?.identifiedOpportunities)) {
          plan.opportunityAnalysis.identifiedOpportunities = plan.opportunityAnalysis.identifiedOpportunities.map(o => ({ ...o, sources: filterSources(o.sources) || cite() }));
        }
        if (Array.isArray(plan?.riskAssessment?.identifiedRisks)) {
          plan.riskAssessment.identifiedRisks = plan.riskAssessment.identifiedRisks.map(r => ({ ...r, sources: filterSources(r.sources) || cite() }));
        }
      } catch (_) {}

      // Optional distribution via orchestrator
      let distributionResults = null;
      if (Array.isArray(distributors) && distributors.length > 0) {
        const context = {
          accountName,
          executionId: `instructor-${Date.now()}`,
          timestamp: new Date().toISOString(),
          triggeredBy: 'instructor_api',
          correlationId: req.headers['x-correlation-id'] || req.correlationId || `corr-${Date.now()}`
        };
        distributionResults = await orchestrator.distributeAccountPlan(plan, distributors, accountName, context.executionId);
      }
      metrics.inc('plan_generated');
      timer.finish(true);
      res.json({ status: 'success', accountName, plan, distributionResults });
    } catch (error) {
      metrics.inc('instructor:run:err');
      res.status(500).json({ error: 'Instructor run failed', message: error.message });
    }
  });

  return router;
}
