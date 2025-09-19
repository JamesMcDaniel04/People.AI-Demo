import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger.js';
import { statusService } from './statusService.js';

const PRIORITY_RANK = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0
};

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function minutesToMs(minutes, fallback) {
  if (typeof minutes === 'number' && Number.isFinite(minutes)) {
    return minutes * 60 * 1000;
  }
  return fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class ReminderService {
  constructor(config, orchestrator) {
    this.config = config || {};
    this.orchestrator = orchestrator || null;
    this.logger = new Logger(config);
    this.enabled = this.config?.reminders?.enabled !== false;
    this.storagePath = this.resolveStoragePath();
    this.reminders = new Map();
    this.evaluationInterval = this.resolveEvaluationInterval();
    this.persistQueue = Promise.resolve();
    this.evaluationTimer = null;
    this.initialized = false;
  }

  isEnabled() {
    return this.enabled;
  }

  resolveStoragePath() {
    const custom = this.config?.reminders?.storagePath;
    if (custom) {
      return path.resolve(custom);
    }
    return path.resolve(process.cwd(), 'data', 'reminders.json');
  }

  resolveEvaluationInterval() {
    const val = parseInt(this.config?.reminders?.evaluationIntervalMs, 10);
    return Number.isFinite(val) && val > 0 ? val : 60000;
  }

  async initialize() {
    if (!this.enabled) {
      this.logger.info('Reminder service disabled; skipping initialization.');
      return false;
    }

    await this.loadFromDisk();
    this.startEvaluationLoop();
    this.initialized = true;
    this.logger.info('✅ Reminder Service initialized', {
      reminders: this.reminders.size,
      storagePath: this.storagePath,
      evaluationIntervalMs: this.evaluationInterval
    });
    return true;
  }

  async shutdown() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
    await this.persist();
    this.initialized = false;
    this.logger.info('✅ Reminder Service shutdown complete');
  }

  async loadFromDisk() {
    try {
      const raw = await fs.readFile(this.storagePath, 'utf8');
      const data = JSON.parse(raw);
      const list = Array.isArray(data?.reminders) ? data.reminders : Array.isArray(data) ? data : [];
      for (const item of list) {
        if (item && item.id) {
          this.reminders.set(item.id, item);
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
        await fs.writeFile(this.storagePath, JSON.stringify({ reminders: [] }, null, 2));
        return;
      }
      this.logger.warn('⚠️ Failed to load reminders from disk', { error: error.message });
    }
  }

  startEvaluationLoop() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
    this.evaluationTimer = setInterval(() => {
      this.evaluateReminders().catch(error => {
        this.logger.error('❌ Reminder evaluation failed', { error: error.message });
      });
    }, this.evaluationInterval);
  }

  async persist() {
    const payload = { updatedAt: new Date().toISOString(), reminders: Array.from(this.reminders.values()) };
    this.persistQueue = this.persistQueue
      .then(async () => {
        await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
        await fs.writeFile(this.storagePath, JSON.stringify(payload, null, 2));
      })
      .catch(error => {
        this.logger.error('❌ Failed to persist reminders', { error: error.message });
      });
    return this.persistQueue;
  }

  getSummary() {
    const summary = {
      total: this.reminders.size,
      byStatus: {},
      byPriority: {},
      overdue: 0,
      awaitingAck: 0,
      escalationsDue: 0
    };

    const now = Date.now();

    for (const reminder of this.reminders.values()) {
      const status = reminder.status || 'unknown';
      const priority = reminder.priority || 'unknown';
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
      summary.byPriority[priority] = (summary.byPriority[priority] || 0) + 1;

      if (status === 'scheduled' && reminder.dueAt && new Date(reminder.dueAt).getTime() < now) {
        summary.overdue += 1;
      }
      if (status === 'awaiting_ack' || status === 'escalated') {
        summary.awaitingAck += 1;
      }
      if (reminder.escalation?.nextEscalationAt) {
        const ts = new Date(reminder.escalation.nextEscalationAt).getTime();
        if (!Number.isNaN(ts) && ts <= now && (reminder.escalation.level || 0) < (reminder.escalation.maxLevel || 0)) {
          summary.escalationsDue += 1;
        }
      }
    }

    return summary;
  }

  getReminders(filter = {}) {
    const reminders = Array.from(this.reminders.values()).filter(reminder => {
      if (filter.accountName && reminder.accountName !== filter.accountName) {
        return false;
      }
      if (filter.status && reminder.status !== filter.status) {
        return false;
      }
      if (filter.priority && reminder.priority !== filter.priority) {
        return false;
      }
      return true;
    });

    reminders.sort((a, b) => {
      const aTime = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    return reminders.map(reminder => clone(reminder));
  }

  async createManualReminder(payload = {}) {
    if (!this.enabled) {
      throw new Error('Reminder service disabled');
    }
    const accountName = payload.accountName;
    if (!accountName) {
      throw new Error('accountName is required');
    }

    const now = new Date();
    const priority = payload.priority || 'medium';
    const dueMinutes = parseNumber(payload.dueInMinutes, 60);
    const dueAt = payload.dueAt ? new Date(payload.dueAt) : new Date(now.getTime() + dueMinutes * 60000);

    const reminder = {
      id: uuidv4(),
      type: payload.type || 'manual',
      accountName,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: 'scheduled',
      priority,
      reason: payload.reason || 'Manual reminder',
      recommendedAction: payload.recommendedAction || 'Follow up with account stakeholders',
      dueAt: dueAt.toISOString(),
      healthScore: payload.healthScore ?? null,
      healthStatus: payload.healthStatus || null,
      context: payload.context || {},
      channels: [],
      followUps: [],
      history: [],
      snoozedUntil: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      escalation: {
        level: 0,
        maxLevel: payload.maxEscalations || this.getMaxEscalations(priority),
        delayMs: minutesToMs(payload.escalationMinutes, this.getEscalationDelayMs(priority)),
        nextEscalationAt: null,
        channels: []
      }
    };

    const baseChannels = Array.isArray(payload.channels) && payload.channels.length > 0
      ? payload.channels
      : [...this.buildBaseChannels(priority)];
    const escalationChannels = Array.isArray(payload.escalationChannels)
      ? payload.escalationChannels
      : [...this.buildEscalationChannels(priority)];

    for (const descriptor of baseChannels) {
      this.ensureChannel(reminder, descriptor);
    }
    for (const descriptor of escalationChannels) {
      const channel = this.ensureChannel(reminder, { ...descriptor, escalation: true });
      reminder.escalation.channels.push({ type: channel.type, target: channel.target, escalation: true, recipients: channel.recipients, meta: channel.meta });
    }

    if (reminder.escalation.delayMs) {
      reminder.escalation.nextEscalationAt = new Date(dueAt.getTime() + reminder.escalation.delayMs).toISOString();
    }

    this.recordHistory(reminder, 'created', payload.reason || 'manual');
    this.reminders.set(reminder.id, reminder);
    statusService.record('reminder', {
      id: reminder.id,
      account: accountName,
      event: 'created',
      priority: reminder.priority,
      dueAt: reminder.dueAt,
      type: reminder.type
    });
    await this.persist();
    return clone(reminder);
  }

  async handleAccountPlanResult({ accountPlan, distributionResults, accountConfig, workflowContext, executionId }) {
    if (!this.enabled) {
      return null;
    }

    const accountName = accountPlan?.metadata?.accountName || accountConfig?.accountName;
    if (!accountName) {
      return null;
    }

    const healthScore = accountPlan?.accountOverview?.healthScore?.score;
    const healthStatus = accountPlan?.accountOverview?.healthScore?.overall || null;
    if (typeof healthScore !== 'number') {
      return null;
    }

    const riskInfo = this.extractRiskInfo(accountPlan);
    const schedule = this.computeSchedule(healthScore, riskInfo.level);
    const existing = this.findOpenReminder(accountName, 'health_followup');

    if (!schedule) {
      if (existing) {
        this.completeReminder(existing, `Health recovered (${healthScore})`);
        await this.persist();
      }
      return null;
    }

    const reasonParts = [`Health score ${healthScore}/100 (${healthStatus || 'unknown'})`];
    if (riskInfo.highRisks.length > 0) {
      reasonParts.push(`${riskInfo.highRisks.length} high risk item(s)`);
    } else if (riskInfo.total > 0) {
      reasonParts.push(`${riskInfo.total} risk item(s)`);
    }

    const recommendation = accountPlan?.actionPlan?.nextSteps?.[0]?.action
      || accountPlan?.strategicRecommendations?.immediate?.[0]?.action
      || 'Review account plan and engage stakeholders';

    const nowIso = new Date().toISOString();

    if (existing) {
      let updated = false;
      const existingRank = PRIORITY_RANK[existing.priority] ?? 0;
      const newRank = PRIORITY_RANK[schedule.priority] ?? 0;
      if (newRank > existingRank) {
        existing.priority = schedule.priority;
        existing.dueAt = schedule.dueAt;
        existing.escalation = {
          ...existing.escalation,
          level: existing.escalation?.level || 0,
          delayMs: schedule.escalationDelayMs,
          maxLevel: schedule.maxEscalations,
          nextEscalationAt: schedule.nextEscalationAt,
          channels: schedule.escalationChannels.map(descriptor => ({ ...descriptor }))
        };
        this.recordHistory(existing, 'updated', `Reminder severity increased to ${schedule.priority}`);
        updated = true;
      }
      existing.healthScore = healthScore;
      existing.healthStatus = healthStatus;
      existing.reason = reasonParts.join(' • ');
      existing.recommendedAction = recommendation;
      existing.context = {
        ...(existing.context || {}),
        workflowId: workflowContext?.workflowId,
        workflowName: workflowContext?.workflowName,
        executionId,
        trigger: workflowContext?.trigger,
        riskLevel: riskInfo.level,
        highRisks: riskInfo.highRisks,
        distributionResults
      };
      existing.updatedAt = nowIso;
      if (updated) {
        statusService.record('reminder', {
          id: existing.id,
          account: accountName,
          event: 'updated',
          priority: existing.priority,
          dueAt: existing.dueAt
        });
      }
      await this.persist();
      return clone(existing);
    }

    const reminder = {
      id: uuidv4(),
      type: 'health_followup',
      accountName,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: 'scheduled',
      priority: schedule.priority,
      reason: reasonParts.join(' • '),
      recommendedAction: recommendation,
      dueAt: schedule.dueAt,
      healthScore,
      healthStatus,
      context: {
        workflowId: workflowContext?.workflowId,
        workflowName: workflowContext?.workflowName,
        executionId,
        trigger: workflowContext?.trigger,
        riskLevel: riskInfo.level,
        highRisks: riskInfo.highRisks,
        distributionResults
      },
      channels: [],
      followUps: [],
      history: [],
      snoozedUntil: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      escalation: {
        level: 0,
        maxLevel: schedule.maxEscalations,
        delayMs: schedule.escalationDelayMs,
        nextEscalationAt: schedule.nextEscalationAt,
        channels: schedule.escalationChannels.map(descriptor => ({ ...descriptor }))
      }
    };

    for (const descriptor of schedule.channels) {
      this.ensureChannel(reminder, descriptor);
    }
    for (const descriptor of schedule.escalationChannels) {
      const channel = this.ensureChannel(reminder, { ...descriptor, escalation: true });
      reminder.escalation.channels.push({ type: channel.type, target: channel.target, escalation: true, recipients: channel.recipients, meta: channel.meta });
    }

    this.recordHistory(reminder, 'created', reminder.reason);
    this.reminders.set(reminder.id, reminder);
    statusService.record('reminder', {
      id: reminder.id,
      account: accountName,
      event: 'created',
      priority: reminder.priority,
      dueAt: reminder.dueAt,
      type: reminder.type
    });
    await this.persist();
    return clone(reminder);
  }

  findOpenReminder(accountName, type) {
    for (const reminder of this.reminders.values()) {
      if (reminder.accountName === accountName && reminder.type === type) {
        if (!['completed', 'cancelled'].includes(reminder.status)) {
          return reminder;
        }
      }
    }
    return null;
  }

  extractRiskInfo(accountPlan) {
    const risks = Array.isArray(accountPlan?.riskAssessment?.identifiedRisks)
      ? accountPlan.riskAssessment.identifiedRisks
      : [];
    const highRisks = risks.filter(risk => (risk.level || '').toLowerCase() === 'high');
    const mediumRisks = risks.filter(risk => (risk.level || '').toLowerCase() === 'medium');
    let level = 'low';
    if (highRisks.length > 0) {
      level = 'high';
    } else if (mediumRisks.length > 0) {
      level = 'medium';
    }
    return { level, highRisks, mediumRisks, total: risks.length };
  }

  computeSchedule(healthScore, riskLevel) {
    const thresholds = this.config?.reminders?.thresholds || {};
    const critThreshold = parseNumber(thresholds.critical, 40);
    const highThreshold = parseNumber(thresholds.high, 60);
    const mediumThreshold = parseNumber(thresholds.medium, 75);

    let priority = null;
    if (healthScore < critThreshold || riskLevel === 'high') {
      priority = 'critical';
    } else if (healthScore < highThreshold || riskLevel === 'medium') {
      priority = 'high';
    } else if (healthScore < mediumThreshold) {
      priority = 'medium';
    } else {
      return null;
    }

    const timings = this.config?.reminders?.timings || {};
    const timingConfig = timings[priority] || {};
    const dueMinutes = parseNumber(timingConfig.dueMinutes, priority === 'critical' ? 60 : priority === 'high' ? 240 : 1440);
    const escalationMinutes = parseNumber(timingConfig.escalationMinutes, priority === 'critical' ? 120 : priority === 'high' ? 480 : 2880);

    const now = Date.now();
    const dueDate = new Date(now + dueMinutes * 60000);
    const escalationDelayMs = escalationMinutes * 60000;
    const nextEscalationAt = escalationDelayMs
      ? new Date(dueDate.getTime() + escalationDelayMs).toISOString()
      : null;

    return {
      priority,
      dueAt: dueDate.toISOString(),
      channels: this.buildBaseChannels(priority),
      escalationChannels: this.buildEscalationChannels(priority),
      escalationDelayMs,
      nextEscalationAt,
      maxEscalations: this.getMaxEscalations(priority)
    };
  }

  buildBaseChannels(priority) {
    const defaults = this.config?.reminders || {};
    const channels = [];

    if (defaults.defaultSlackChannel) {
      channels.push({
        type: 'slack',
        target: defaults.defaultSlackChannel,
        escalation: false,
        meta: { mentions: defaults.defaultMentions || [] }
      });
    }

    if ((priority === 'critical' || priority === 'high') && Array.isArray(defaults.defaultEmailRecipients) && defaults.defaultEmailRecipients.length > 0) {
      channels.push({
        type: 'email',
        recipients: defaults.defaultEmailRecipients,
        escalation: false
      });
    }

    return channels;
  }

  buildEscalationChannels(priority) {
    const defaults = this.config?.reminders || {};
    const channels = [];

    if (defaults.escalationSlackChannel) {
      channels.push({
        type: 'slack',
        target: defaults.escalationSlackChannel,
        escalation: true,
        meta: { mentions: defaults.escalationMentions || [] }
      });
    }

    if (priority === 'critical' && Array.isArray(defaults.escalationEmailRecipients) && defaults.escalationEmailRecipients.length > 0) {
      channels.push({
        type: 'email',
        recipients: defaults.escalationEmailRecipients,
        escalation: true
      });
    }

    if (priority === 'critical') {
      channels.push({
        type: 'crm',
        escalation: true,
        meta: { actions: ['createTasks'] }
      });
    }

    return channels;
  }

  getMaxEscalations(priority) {
    const configured = parseNumber(this.config?.reminders?.maxEscalations, 2);
    if (priority === 'critical') return Math.max(configured, 2);
    if (priority === 'high') return Math.max(configured - 1, 1);
    return Math.max(configured - 1, 1);
  }

  getEscalationDelayMs(priority) {
    const timings = this.config?.reminders?.timings || {};
    const timingConfig = timings[priority] || {};
    const escalationMinutes = parseNumber(timingConfig.escalationMinutes, priority === 'critical' ? 120 : priority === 'high' ? 480 : 2880);
    return escalationMinutes * 60000;
  }

  ensureChannel(reminder, descriptor) {
    if (!descriptor) return null;
    const type = descriptor.type;
    const target = descriptor.target;
    const escalation = descriptor.escalation === true;

    const existing = reminder.channels.find(channel => {
      if (channel.type !== type) return false;
      if ((channel.target || null) !== (target || null)) return false;
      if ((channel.escalation || false) !== escalation) return false;
      if (channel.recipients && descriptor.recipients) {
        const normalizedExisting = channel.recipients.slice().sort().join(',');
        const normalizedNew = descriptor.recipients.slice().sort().join(',');
        return normalizedExisting === normalizedNew;
      }
      return true;
    });

    if (existing) {
      existing.meta = descriptor.meta || existing.meta || {};
      return existing;
    }

    const channel = {
      id: uuidv4(),
      type,
      target: target || null,
      escalation,
      recipients: descriptor.recipients ? Array.from(new Set(descriptor.recipients)) : undefined,
      status: 'pending',
      attempts: 0,
      lastSentAt: null,
      lastResult: null,
      meta: descriptor.meta || {},
      error: null
    };
    reminder.channels.push(channel);
    return channel;
  }

  recordHistory(reminder, action, details = null) {
    if (!Array.isArray(reminder.history)) {
      reminder.history = [];
    }
    reminder.history.push({
      ts: new Date().toISOString(),
      action,
      details
    });
    if (reminder.history.length > 50) {
      reminder.history.splice(0, reminder.history.length - 50);
    }
  }

  completeReminder(reminder, note) {
    reminder.status = 'completed';
    reminder.completedAt = new Date().toISOString();
    reminder.updatedAt = reminder.completedAt;
    this.recordHistory(reminder, 'completed', note || null);
    statusService.record('reminder', {
      id: reminder.id,
      account: reminder.accountName,
      event: 'completed',
      note
    });
  }

  async acknowledgeReminder(id, { user, note } = {}) {
    const reminder = this.reminders.get(id);
    if (!reminder) {
      throw new Error('Reminder not found');
    }
    if (reminder.status === 'completed' || reminder.status === 'cancelled') {
      return clone(reminder);
    }
    const now = new Date().toISOString();
    reminder.status = 'acknowledged';
    reminder.acknowledgedAt = now;
    reminder.acknowledgedBy = user || null;
    reminder.completedAt = now;
    reminder.updatedAt = now;
    reminder.escalation.nextEscalationAt = null;
    reminder.followUps.push({ ts: now, type: 'acknowledged', user: user || 'system', note: note || null });
    this.recordHistory(reminder, 'acknowledged', note || null);
    statusService.record('reminder', {
      id: reminder.id,
      account: reminder.accountName,
      event: 'acknowledged',
      user: user || null
    });
    await this.persist();
    return clone(reminder);
  }

  async snoozeReminder(id, { until, minutes, user, note } = {}) {
    const reminder = this.reminders.get(id);
    if (!reminder) {
      throw new Error('Reminder not found');
    }
    if (reminder.status === 'completed' || reminder.status === 'cancelled') {
      return clone(reminder);
    }

    let snoozeUntil;
    if (until) {
      snoozeUntil = new Date(until);
    } else {
      const delta = parseNumber(minutes, 60) * 60000;
      snoozeUntil = new Date(Date.now() + delta);
    }

    reminder.status = 'snoozed';
    reminder.snoozedUntil = snoozeUntil.toISOString();
    reminder.updatedAt = new Date().toISOString();
    reminder.followUps.push({ ts: reminder.updatedAt, type: 'snoozed', user: user || 'system', note: note || null, until: reminder.snoozedUntil });
    this.recordHistory(reminder, 'snoozed', `until ${reminder.snoozedUntil}`);
    statusService.record('reminder', {
      id: reminder.id,
      account: reminder.accountName,
      event: 'snoozed',
      until: reminder.snoozedUntil
    });
    await this.persist();
    return clone(reminder);
  }

  async forceEscalation(id, options = {}) {
    const reminder = this.reminders.get(id);
    if (!reminder) {
      throw new Error('Reminder not found');
    }
    await this.dispatchReminder(reminder, { escalate: true, reason: options.reason || 'manual escalation' });
    return clone(reminder);
  }

  async evaluateReminders() {
    if (!this.initialized || !this.enabled) {
      return;
    }

    const now = Date.now();
    for (const reminder of this.reminders.values()) {
      if (['completed', 'cancelled', 'acknowledged'].includes(reminder.status)) {
        continue;
      }

      if (reminder.status === 'snoozed') {
        if (reminder.snoozedUntil && new Date(reminder.snoozedUntil).getTime() <= now) {
          reminder.status = 'scheduled';
          reminder.snoozedUntil = null;
          reminder.updatedAt = new Date().toISOString();
          this.recordHistory(reminder, 'snooze-expired');
          await this.persist();
        } else {
          continue;
        }
      }

      if (reminder.status === 'scheduled') {
        if (reminder.dueAt && new Date(reminder.dueAt).getTime() <= now) {
          await this.dispatchReminder(reminder, { escalate: false });
        }
        continue;
      }

      if (reminder.escalation?.nextEscalationAt) {
        const next = new Date(reminder.escalation.nextEscalationAt).getTime();
        if (!Number.isNaN(next) && next <= now && (reminder.escalation.level || 0) < (reminder.escalation.maxLevel || 0)) {
          await this.dispatchReminder(reminder, { escalate: true });
        }
      }
    }
  }

  async dispatchReminder(reminder, { escalate = false, reason = null } = {}) {
    const nowIso = new Date().toISOString();
    const results = [];

    if (escalate) {
      if (!Array.isArray(reminder.escalation?.channels)) {
        reminder.escalation.channels = [];
      }
      for (const descriptor of reminder.escalation.channels) {
        this.ensureChannel(reminder, { ...descriptor, escalation: true });
      }
    }

    for (const channel of reminder.channels) {
      const result = await this.sendViaChannel(reminder, channel, { escalate, reason });
      channel.attempts += 1;
      channel.lastSentAt = nowIso;
      channel.lastResult = result;
      channel.status = result?.status || channel.status;
      channel.error = result?.error || null;
      results.push({
        type: channel.type,
        target: channel.target || null,
        status: channel.status,
        escalation: channel.escalation === true,
        error: channel.error || null
      });
    }

    reminder.status = escalate ? 'escalated' : 'awaiting_ack';
    reminder.lastNotificationAt = nowIso;
    reminder.updatedAt = nowIso;
    reminder.followUps.push({
      ts: nowIso,
      type: escalate ? 'escalation' : 'notification',
      channels: results,
      reason: reason || null
    });

    if (!reminder.escalation) {
      reminder.escalation = { level: 0, maxLevel: 0, delayMs: 0, nextEscalationAt: null, channels: [] };
    }

    if (escalate) {
      reminder.escalation.level = (reminder.escalation.level || 0) + 1;
    } else if (!reminder.escalation.level) {
      reminder.escalation.level = 0;
    }

    if (reminder.escalation.delayMs && (reminder.escalation.level || 0) < (reminder.escalation.maxLevel || 0)) {
      reminder.escalation.nextEscalationAt = new Date(Date.now() + reminder.escalation.delayMs).toISOString();
    } else {
      reminder.escalation.nextEscalationAt = null;
    }

    this.recordHistory(reminder, escalate ? 'escalated' : 'notified', `Channels: ${results.length}`);
    statusService.record('reminder', {
      id: reminder.id,
      account: reminder.accountName,
      event: escalate ? 'escalated' : 'notified',
      channels: results.map(r => `${r.type}${r.target ? `:${r.target}` : ''}`)
    });
    await this.persist();
    return results;
  }

  async sendViaChannel(reminder, channel, options = {}) {
    const distributors = this.orchestrator?.distributors || {};
    const escalate = options.escalate === true;

    try {
      if (channel.type === 'slack') {
        if (distributors.slack?.sendReminder) {
          return await distributors.slack.sendReminder(reminder, channel, { escalate });
        }
        return this.mockChannel('slack', reminder, channel);
      }

      if (channel.type === 'email') {
        if (distributors.email?.sendReminder) {
          return await distributors.email.sendReminder(reminder, channel, { escalate });
        }
        return this.mockChannel('email', reminder, channel);
      }

      if (channel.type === 'crm') {
        if (distributors.crm?.sendReminder) {
          return await distributors.crm.sendReminder(reminder, channel, { escalate });
        }
        return this.mockChannel('crm', reminder, channel);
      }

      this.logger.warn('⚠️ Unknown reminder channel type', { type: channel.type });
      return { status: 'skipped', error: 'unknown channel' };
    } catch (error) {
      this.logger.error('❌ Reminder channel dispatch failed', {
        channel: channel.type,
        target: channel.target,
        account: reminder.accountName,
        error: error.message
      });
      return { status: 'failed', error: error.message };
    }
  }

  mockChannel(type, reminder, channel) {
    this.logger.info(`📎 Reminder recorded for ${type} (mock mode)`, {
      account: reminder.accountName,
      target: channel.target || channel.recipients || null,
      priority: reminder.priority
    });
    statusService.record(type, {
      account: reminder.accountName,
      target: channel.target || null,
      ok: true,
      mode: 'reminder-mock'
    });
    return { status: 'sent', mode: 'mock' };
  }
}

