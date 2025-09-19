import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { ReminderService } from '../../src/services/reminderService.js';

class StubDistributor {
  constructor() {
    this.sent = [];
  }

  async sendReminder(reminder, channelConfig, options = {}) {
    this.sent.push({
      id: reminder.id,
      type: channelConfig.type,
      target: channelConfig.target,
      recipients: channelConfig.recipients,
      escalate: options.escalate === true
    });
    return { status: 'sent', mode: 'stub' };
  }
}

test('ReminderService schedules, dispatches, and tracks reminders', async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'reminders-'));
  const storagePath = path.join(tmpDir, 'reminders.json');

  const slack = new StubDistributor();
  const email = new StubDistributor();
  const crm = new StubDistributor();

  const config = {
    reminders: {
      enabled: true,
      storagePath,
      evaluationIntervalMs: 10,
      defaultSlackChannel: '#reminders',
      defaultEmailRecipients: ['team@example.com'],
      defaultMentions: ['@owner'],
      escalationEmailRecipients: ['leaders@example.com'],
      maxEscalations: 1,
      thresholds: { critical: 80, high: 90, medium: 95 },
      timings: {
        critical: { dueMinutes: 0, escalationMinutes: 0.01 },
        high: { dueMinutes: 0, escalationMinutes: 0.01 },
        medium: { dueMinutes: 0, escalationMinutes: 0.01 }
      }
    }
  };

  const orchestrator = { distributors: { slack, email, crm } };
  const service = new ReminderService(config, orchestrator);
  await service.initialize();

  try {
    const accountPlan = {
      metadata: { accountName: 'acme' },
      accountOverview: {
        healthScore: {
          score: 30,
          overall: 'critical'
        }
      },
      riskAssessment: {
        identifiedRisks: [{ level: 'high' }]
      },
      actionPlan: {
        nextSteps: [{ action: 'Schedule urgent review' }]
      }
    };

    await service.handleAccountPlanResult({
      accountPlan,
      distributionResults: [],
      accountConfig: { accountName: 'acme' },
      workflowContext: { workflowId: 'wf-1', workflowName: 'Test Workflow' },
      executionId: 'exec-1'
    });

    const reminders = service.getReminders({});
    assert.equal(reminders.length, 1);

    await service.evaluateReminders();

    const dispatched = slack.sent.length + email.sent.length + crm.sent.length;
    assert.ok(dispatched > 0);

    const reminderId = reminders[0].id;
    await service.acknowledgeReminder(reminderId, { user: 'tester' });
    const summary = service.getSummary();
    assert.ok((summary.byStatus.acknowledged || 0) >= 1);
  } finally {
    await service.shutdown();
    await rm(tmpDir, { recursive: true, force: true });
  }
});
