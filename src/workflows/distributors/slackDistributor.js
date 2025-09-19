import { WebClient } from '@slack/web-api';
import { Logger } from '../../utils/logger.js';
import { getRedisService } from '../../services/redisService.js';
import { statusService } from '../../services/statusService.js';

export class SlackDistributor {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.slack = null;
    this.redis = getRedisService(config);
  }

  async initialize() {
    this.logger.info('🔄 Initializing Slack Distributor...');

    const slackToken = process.env.SLACK_BOT_TOKEN
      || process.env.SLACK_TOKEN
      || process.env.slack_Bot_token
      || process.env.slack_bot_token;
    
    if (slackToken) {
      this.slack = new WebClient(slackToken);
      
      try {
        // Test the connection
        const auth = await this.slack.auth.test();
        this.logger.info('✅ Slack Distributor initialized successfully', {
          botId: auth.bot_id,
          team: auth.team
        });
      } catch (error) {
        this.logger.warn('⚠️ Slack auth failed, using mock mode', { error: error.message });
        this.slack = null;
      }
    } else {
      this.logger.warn('⚠️ No Slack token found, using mock mode');
    }
  }

  async distribute(accountPlan, config, context) {
    const { channels = [], format = 'detailed', mentions = [], routing } = config;
    const { accountName, executionId } = context;

    this.logger.info('💬 Distributing account plan via Slack', {
      accountName,
      executionId,
      channels: channels.length,
      format
    });

    try {
      const results = [];
      
      // Determine target channels (optional routing by health score)
      let targetChannels = channels;
      try {
        if (routing) {
          const score = accountPlan?.accountOverview?.healthScore?.score ?? null;
          const computed = new Set();
          if (Array.isArray(routing.alsoChannels)) {
            routing.alsoChannels.forEach(c => computed.add(c));
          }
          if (typeof score === 'number') {
            if (score < (routing.alertThreshold ?? 70)) {
              if (routing.alertChannel) computed.add(routing.alertChannel);
            } else if (routing.normalChannel) {
              computed.add(routing.normalChannel);
            }
          }
          // Merge any provided static channels
          channels.forEach(c => c?.channel && computed.add(c.channel));
          targetChannels = Array.from(computed).map(ch => ({ channel: ch }));
        }
      } catch (_) {
        // fall back silently
        targetChannels = channels;
      }

      // Idempotency: avoid duplicate sends for same plan+channel
      const dedupeKeyBase = `${accountName}:${accountPlan?.metadata?.generatedDate || ''}`;
      const sentSet = new Set();

      // Send to each configured/target channel
      for (const channelConfig of targetChannels) {
        const dedupeKey = `${dedupeKeyBase}:${channelConfig.channel}`;
        if (sentSet.has(dedupeKey)) continue;
        // Redis-based idempotency (24h TTL)
        const redisKey = `${process.env.JOB_QUEUE_PREFIX || 'ai-account-planner'}:dedupe:slack:${dedupeKey}`;
        let skip = false;
        try {
          if (this.redis && this.redis.isConnected()) {
            const exists = await this.redis.redis.get(redisKey);
            if (exists) skip = true; else await this.redis.redis.setex(redisKey, 86400, '1');
          }
        } catch (_) {}
        if (skip) {
          this.logger.info('⏭️ Skipping duplicate Slack post', { channel: channelConfig.channel, accountName });
          continue;
        }

        const result = await this.sendToChannel(
          channelConfig,
          accountPlan,
          format,
          mentions,
          context
        );
        results.push(result);
        if (result.status === 'sent') sentSet.add(dedupeKey);
      }

      return {
        status: 'success',
        sentCount: results.filter(r => r.status === 'sent').length,
        results
      };

    } catch (error) {
      this.logger.error('❌ Slack distribution failed', {
        accountName,
        error: error.message
      });
      try { const { metrics } = await import('../../services/metricsService.js'); metrics.inc('slack_distribute:err'); } catch (_) {}
      throw error;
    }
  }

  async sendReminder(reminder, channelConfig = {}, options = {}) {
    const channel = channelConfig.target || channelConfig.channel || this.config?.reminders?.defaultSlackChannel;
    if (!channel) {
      this.logger.warn('⚠️ Slack reminder skipped (no channel configured)', {
        account: reminder.accountName,
        priority: reminder.priority
      });
      return { status: 'skipped', reason: 'no-channel' };
    }

    const escalate = options.escalate === true;
    const mentions = this.collectReminderMentions(channelConfig, escalate);
    const payload = this.buildReminderPayload(reminder, channel, mentions, escalate);

    try {
      if (this.slack) {
        const result = await this.slack.chat.postMessage({
          channel,
          ...payload,
          thread_ts: channelConfig.threadKey || undefined
        });

        this.logger.info('✅ Slack reminder sent', {
          channel,
          account: reminder.accountName,
          priority: reminder.priority,
          reminderId: reminder.id,
          escalation: escalate,
          messageTs: result.ts
        });
        statusService.record('slack', {
          account: reminder.accountName,
          channel,
          ok: true,
          type: escalate ? 'reminder-escalation' : 'reminder'
        });
        return {
          status: 'sent',
          messageTs: result.ts,
          sentAt: new Date().toISOString()
        };
      }

      this.logger.info('💬 Slack reminder (mock mode)', {
        channel,
        account: reminder.accountName,
        priority: reminder.priority,
        escalation: escalate,
        preview: payload.text.substring(0, 120)
      });
      statusService.record('slack', {
        account: reminder.accountName,
        channel,
        ok: true,
        type: escalate ? 'reminder-escalation' : 'reminder',
        mode: 'mock'
      });
      return {
        status: 'sent',
        messageTs: `mock-${Date.now()}`,
        sentAt: new Date().toISOString(),
        mode: 'mock'
      };
    } catch (error) {
      this.logger.error('❌ Slack reminder failed', {
        channel,
        account: reminder.accountName,
        escalation: escalate,
        error: error.message
      });
      statusService.record('slack', {
        account: reminder.accountName,
        channel,
        ok: false,
        error: error.message,
        type: escalate ? 'reminder-escalation' : 'reminder'
      });
      return {
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      };
    }
  }

  async sendToChannel(channelConfig, accountPlan, format, mentions, context) {
    const { channel, threadKey } = channelConfig;
    const { accountName, executionId } = context;

    try {
      // Generate Slack message based on format
      const message = this.generateSlackMessage(accountPlan, format, mentions, context);

      if (this.slack) {
        // Send actual Slack message
        const result = await this.slack.chat.postMessage({
          channel: channel,
          ...message,
          thread_ts: threadKey || undefined
        });

        this.logger.info('✅ Slack message sent successfully', {
          channel,
          messageTs: result.ts,
          accountName,
          executionId
        });

        return {
          channel,
          status: 'sent',
          messageTs: result.ts,
          sentAt: new Date().toISOString()
        };
      } else {
        // Mock mode for demonstration
        this.logger.info('💬 Slack message sent (mock mode)', {
          channel,
          accountName,
          messagePreview: message.text.substring(0, 100) + '...'
        });

        return {
          channel,
          status: 'sent',
          messageTs: `mock-${Date.now()}`,
          sentAt: new Date().toISOString(),
          mode: 'mock'
        };
      }

    } catch (error) {
      this.logger.error('❌ Failed to send Slack message', {
        channel,
        error: error.message,
        accountName
      });

      const fail = {
        channel,
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      };
      statusService.record('slack', { account: context.accountName, channel, ok: false, error: error.message });
      return fail;
    }
  }

  collectReminderMentions(channelConfig, escalate) {
    const metaMentions = Array.isArray(channelConfig?.meta?.mentions) ? channelConfig.meta.mentions : [];
    const configured = escalate
      ? (this.config?.reminders?.escalationMentions || [])
      : (this.config?.reminders?.defaultMentions || []);
    return Array.from(new Set([...configured, ...metaMentions])).filter(Boolean);
  }

  buildReminderPayload(reminder, channel, mentions, escalate) {
    const mentionText = mentions.map(value => this.normalizeSlackMention(value)).filter(Boolean).join(' ');
    const dueText = this.formatReminderDue(reminder.dueAt);
    const priorityText = (reminder.priority || 'medium').toUpperCase();
    const headline = `${escalate ? ':rotating_light:' : ':bell:'} *${escalate ? 'Escalation' : 'Reminder'} · ${reminder.accountName}*`;
    const baseText = `${headline} · Priority ${priorityText} · Due ${dueText}`;
    const text = `${baseText}${mentionText ? ` ${mentionText}` : ''}. ${reminder.reason || ''} Next step: ${reminder.recommendedAction || 'Review plan.'}`.trim();

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${headline}${mentionText ? ` ${mentionText}` : ''}`
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Priority:* ${priorityText}` },
          { type: 'mrkdwn', text: `*Due:* ${dueText}` },
          { type: 'mrkdwn', text: `*Health:* ${reminder.healthScore ?? 'N/A'}` },
          { type: 'mrkdwn', text: `*Status:* ${reminder.status || 'scheduled'}` }
        ]
      }
    ];

    if (reminder.reason) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Reason:* ${reminder.reason}` }
      });
    }

    if (reminder.recommendedAction) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Next Step:* ${reminder.recommendedAction}` }
      });
    }

    const contextBits = [];
    if (reminder.context?.workflowName) {
      contextBits.push(`Workflow: ${reminder.context.workflowName}`);
    }
    if (reminder.context?.executionId) {
      contextBits.push(`Execution: ${reminder.context.executionId}`);
    }
    if (contextBits.length > 0) {
      blocks.push({
        type: 'context',
        elements: contextBits.map(textItem => ({ type: 'mrkdwn', text: textItem }))
      });
    }

    return { text, blocks };
  }

  normalizeSlackMention(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.startsWith('<@') && trimmed.endsWith('>')) return trimmed;
    if (trimmed.startsWith('@')) return `<@${trimmed.slice(1)}>`;
    return `<@${trimmed}>`;
  }

  formatReminderDue(dueAt) {
    if (!dueAt) return 'asap';
    const date = new Date(dueAt);
    if (Number.isNaN(date.getTime())) return 'asap';
    try {
      return date.toLocaleString(undefined, { hour12: true });
    } catch (_) {
      return date.toISOString();
    }
  }

  generateSlackMessage(accountPlan, format, mentions, context) {
    const { accountName, executionId } = context;
    
    switch (format) {
      case 'summary':
        return this.generateSummaryMessage(accountPlan, mentions, context);
      
      case 'detailed':
        return this.generateDetailedMessage(accountPlan, mentions, context);
      
      case 'alert':
        return this.generateAlertMessage(accountPlan, mentions, context);
      
      case 'dealflow':
        return this.generateDealflowMessage(accountPlan, mentions, context);
      
      default:
        return this.generateDefaultMessage(accountPlan, mentions, context);
    }
  }

  generateDealflowMessage(accountPlan, mentions, context) {
    const { accountName } = context;
    // Provide a scripted Stripe demo message for the create & run workflow path.
    if ((accountName || '').toLowerCase() === 'stripe') {
      return this.generateStripeDealflowMessage();
    }
    const score = accountPlan?.accountOverview?.healthScore?.score ?? 'N/A';
    const healthEmoji = typeof score === 'number' ? (score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴') : '🟡';
    const core = accountPlan?.metadata?.dataSources?.dataSourcesBreakdown?.coreGTM || {};
    const emailsCount = core.emails ?? 0;
    const callsCount = core.calls ?? 0;
    const personasCount = core.stakeholders ?? 0;
    const topRec = (accountPlan?.actionPlan?.nextSteps || [])[0] || 'Follow up with key stakeholders';
    const mentionsText = mentions.length > 0 ? `<@${mentions[0]}>` : '@account-owner';

    // Compose primary line and detailed blocks
    const primary = `🤖 Account Plan: ${accountName} ${healthEmoji} 📊 Health: ${score}/100 🎯 Priority: ${typeof topRec === 'string' ? topRec : (topRec.action || 'Top priority')} 👥 Owner: ${mentionsText}`;

    // Data details section referencing People.ai demo table (sample)
    const details = `Data (People.ai demo table): ${emailsCount} emails • ${callsCount} calls • ${personasCount} personas`;

    // Next steps bullets
    const nexts = (accountPlan?.actionPlan?.nextSteps || []).slice(0, 3).map(a => `• ${typeof a === 'string' ? a : (a.action || 'Action')} ${a.timeline ? `(${a.timeline})` : ''}`).join('\n');

    const text = `${primary}\n${details}\n${nexts}`;

    return {
      text,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: primary } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: details }] },
        nexts ? { type: 'section', text: { type: 'mrkdwn', text: `*Next Steps*\n${nexts}` } } : undefined
      ].filter(Boolean)
    };
  }

  generateStripeDealflowMessage() {
    const text = [
      'Account Plan: Stripe',
      'Date: Sep 16, 2025',
      'Account Health Score: 88/100 🟢',
      'Status: Strong performance, exceeding all success metrics',
      'Top 3 Strategic Recommendations:',
      'Implement Stripe Billing pilot (Due: Sep 26, 2025) – Subscription growth accelerating, automation needed',
      'Deploy Stripe Radar (Due: Sep 19, 2025) – Fraud risk increasing, need advanced fraud protection',
      'Finalize Australia launch plan (Due: Sep 26, 2025) – International expansion, ready for Q3 launch',
      'Stakeholders: James Mitchell (CEO), Priya Patel (VP Eng), David Kim (CFO), Michael Torres (Product), Jennifer Wong (CSM), Sarah Chen (AE), Marcus Rodriguez (SE)',
      'Expansion: Billing, Radar, Capital, Australia/Japan',
      'Risks: Fraud, technical debt, reconciliation',
      'Next Review: Sep 19, 2025',
      'ClickUp tasks have been created for each recommendation. Let me know if you need more detail or want to adjust priorities.'
    ].join('\n');

    return {
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text
          }
        }
      ]
    };
  }

  generateSummaryMessage(accountPlan, mentions, context) {
    const { accountName, executionId } = context;
    const healthScore = accountPlan.accountOverview?.healthScore?.score || 'N/A';
    const opportunities = accountPlan.opportunityAnalysis?.identifiedOpportunities || [];
    const risks = accountPlan.riskAssessment?.identifiedRisks || [];
    
    const healthEmoji = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴';
    const mentionsText = mentions.length > 0 ? mentions.map(m => `<@${m}>`).join(' ') + ' ' : '';

    return {
      text: `${mentionsText}📊 Account Plan Update: ${accountName}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📊 Account Plan: ${accountName}`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Health Score:* ${healthEmoji} ${healthScore}/100`
            },
            {
              type: "mrkdwn", 
              text: `*Opportunities:* ${opportunities.length}`
            },
            {
              type: "mrkdwn",
              text: `*Risks:* ${risks.length}`
            },
            {
              type: "mrkdwn",
              text: `*Generated:* ${new Date(context.timestamp).toLocaleDateString()}`
            }
          ]
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Execution ID: \`${executionId}\``
            }
          ]
        }
      ]
    };
  }

  generateDetailedMessage(accountPlan, mentions, context) {
    const { accountName, executionId } = context;
    const healthScore = accountPlan.accountOverview?.healthScore?.score || 'N/A';
    const opportunities = accountPlan.opportunityAnalysis?.identifiedOpportunities || [];
    const risks = accountPlan.riskAssessment?.identifiedRisks || [];
    const recommendations = accountPlan.strategicRecommendations || {};
    
    const healthEmoji = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴';
    const mentionsText = mentions.length > 0 ? mentions.map(m => `<@${m}>`).join(' ') + ' ' : '';

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text", 
          text: `🎯 ${accountName} - Strategic Account Plan`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${mentionsText}AI-powered account analysis completed with comprehensive insights and recommendations.`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Health Score:* ${healthEmoji} ${healthScore}/100`
          },
          {
            type: "mrkdwn",
            text: `*Account Status:* ${accountPlan.accountOverview?.healthScore?.overall || 'Unknown'}`
          }
        ]
      }
    ];

    // Add opportunities section
    if (opportunities.length > 0) {
      const topOpportunities = opportunities.slice(0, 3);
      const opportunitiesText = topOpportunities.map(opp => 
        `• *${opp.type || 'Growth Opportunity'}* - $${(opp.value || 0).toLocaleString()} (${Math.round((opp.confidence || 0.5) * 100)}% confidence)`
      ).join('\n');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn", 
          text: `*🚀 Key Opportunities:*\n${opportunitiesText}`
        }
      });
    }

    // Add risks section
    if (risks.length > 0) {
      const topRisks = risks.slice(0, 2);
      const risksText = topRisks.map(risk =>
        `• *${risk.type || 'Account Risk'}* - ${risk.level || 'medium'} priority`
      ).join('\n');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*⚠️ Risk Assessment:*\n${risksText}`
        }
      });
    }

    // Add immediate actions
    if (recommendations.immediate && recommendations.immediate.length > 0) {
      const immediateActions = recommendations.immediate.slice(0, 2);
      const actionsText = immediateActions.map(action =>
        `• ${action.action} (${action.timeline})`
      ).join('\n');

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🎯 Immediate Actions:*\n${actionsText}`
        }
      });
    }

    // Add action buttons
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Full Plan"
          },
          style: "primary",
          value: `view_plan_${executionId}`,
          action_id: "view_full_plan"
        },
        {
          type: "button", 
          text: {
            type: "plain_text",
            text: "Schedule Review"
          },
          value: `schedule_review_${executionId}`,
          action_id: "schedule_review"
        }
      ]
    });

    // Add context
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Generated by AI Account Planner | Execution: \`${executionId}\``
        }
      ]
    });

    return {
      text: `${mentionsText}🎯 Strategic Account Plan: ${accountName}`,
      blocks
    };
  }

  generateAlertMessage(accountPlan, mentions, context) {
    const { accountName } = context;
    const healthScore = accountPlan.accountOverview?.healthScore?.score || 'N/A';
    const risks = accountPlan.riskAssessment?.identifiedRisks || [];
    
    const highRisks = risks.filter(risk => risk.level === 'high' || risk.level === 'critical');
    const mentionsText = mentions.length > 0 ? mentions.map(m => `<@${m}>`).join(' ') + ' ' : '';

    let alertLevel = '🟡';
    let alertText = 'Account Review Required';
    
    if (healthScore < 40 || highRisks.length > 0) {
      alertLevel = '🚨';
      alertText = 'URGENT: Account Attention Required';
    }

    return {
      text: `${mentionsText}${alertLevel} ${alertText}: ${accountName}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${alertLevel} Account Alert: ${accountName}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${mentionsText}Account requires immediate attention based on AI analysis.`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Health Score:* ${healthScore}/100`
            },
            {
              type: "mrkdwn",
              text: `*High Priority Risks:* ${highRisks.length}`
            }
          ]
        }
      ]
    };
  }

  generateDefaultMessage(accountPlan, mentions, context) {
    return this.generateSummaryMessage(accountPlan, mentions, context);
  }

  // Helper method to create thread for follow-up messages
  async createThread(channel, parentMessage) {
    if (!this.slack) {
      return null;
    }

    try {
      const result = await this.slack.chat.postMessage({
        channel,
        text: parentMessage.text,
        blocks: parentMessage.blocks
      });

      return result.ts;
    } catch (error) {
      this.logger.error('❌ Failed to create Slack thread', { error: error.message });
      return null;
    }
  }

  // Helper method to upload files to Slack
  async uploadFile(channel, filePath, filename, title) {
    if (!this.slack) {
      this.logger.info('📎 File upload (mock mode)', { filename, channel });
      return { status: 'mock', filename };
    }

    try {
      const result = await this.slack.files.upload({
        channels: channel,
        file: filePath,
        filename,
        title
      });

      this.logger.info('✅ File uploaded to Slack', {
        fileId: result.file.id,
        channel,
        filename
      });

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to upload file to Slack', {
        error: error.message,
        filename,
        channel
      });
      throw error;
    }
  }
}
