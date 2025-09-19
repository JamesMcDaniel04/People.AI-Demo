import axios from 'axios';
import nodemailer from 'nodemailer';
import { Logger } from '../utils/logger.js';

export class AlertService {
  constructor(config = {}) {
    this.config = config;
    this.logger = new Logger(config);
    const monitoringCfg = config.monitoring?.alerting || {};
    this.slackWebhook = process.env.ALERT_SLACK_WEBHOOK || monitoringCfg.slackWebhook;
    this.emailRecipients = this.#parseCsv(process.env.ALERT_EMAIL_RECIPIENTS || monitoringCfg.emailRecipients);
    this.emailFrom = process.env.ALERT_EMAIL_FROM || monitoringCfg.emailFrom || process.env.SMTP_FROM;
    this.minRepeatMs = (parseInt(process.env.ALERT_SUPPRESS_MINUTES) || monitoringCfg.minRepeatMinutes || 15) * 60000;
    this.transporter = null;
    this.sentCache = new Map();
  }

  async sendAlert({ severity = 'info', title, summary, component, details = {}, dedupeKey }) {
    if (!title) {
      throw new Error('Alert title is required');
    }
    const key = dedupeKey || `${component || 'system'}:${severity}:${title}`;
    if (!this.#canSend(key)) {
      return { sent: false, throttled: true };
    }

    const payload = {
      severity,
      title,
      summary,
      component,
      details,
      timestamp: new Date().toISOString()
    };

    const results = [];
    if (this.slackWebhook) {
      results.push(await this.#sendSlack(payload));
    }
    if (this.emailRecipients.length > 0) {
      results.push(await this.#sendEmail(payload));
    }

    if (results.length === 0) {
      this.logger.warn('Alert not delivered, no channels configured', payload);
    }

    this.sentCache.set(key, Date.now());
    return { sent: true, channels: results.filter(Boolean) };
  }

  #parseCsv(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map(v => v.trim());
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
  }

  #canSend(key) {
    if (this.minRepeatMs <= 0) return true;
    const last = this.sentCache.get(key);
    if (!last) return true;
    return (Date.now() - last) >= this.minRepeatMs;
  }

  async #sendSlack(payload) {
    try {
      await axios.post(this.slackWebhook, {
        text: this.#formatSlackText(payload),
        attachments: [
          {
            color: this.#slackColor(payload.severity),
            fields: Object.entries(payload.details || {}).slice(0, 10).map(([title, value]) => ({
              title,
              value: this.#formatValue(value),
              short: true
            }))
          }
        ]
      }, { timeout: 5000 });
      return 'slack';
    } catch (error) {
      this.logger.error('Slack alert failed', { error: error.message });
      return null;
    }
  }

  async #sendEmail(payload) {
    try {
      if (!this.transporter) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          } : undefined
        });
      }

      await this.transporter.sendMail({
        from: this.emailFrom || process.env.SMTP_FROM,
        to: this.emailRecipients.join(','),
        subject: `[${(payload.component || 'system').toUpperCase()}] ${payload.title}`,
        text: this.#formatEmailText(payload)
      });

      return 'email';
    } catch (error) {
      this.logger.error('Email alert failed', { error: error.message });
      return null;
    }
  }

  #formatSlackText(payload) {
    const prefix = payload.severity === 'critical' ? ':rotating_light:' : payload.severity === 'high' ? ':warning:' : ':information_source:';
    return `${prefix} *${payload.title}*\n${payload.summary || ''}\nComponent: ${payload.component || 'system'}\nTime: ${payload.timestamp}`;
  }

  #formatEmailText(payload) {
    const lines = [
      `Severity: ${payload.severity}`,
      `Component: ${payload.component || 'system'}`,
      `Time: ${payload.timestamp}`,
      '',
      payload.summary || 'No summary provided.',
      ''
    ];
    for (const [key, value] of Object.entries(payload.details || {})) {
      lines.push(`${key}: ${this.#formatValue(value)}`);
    }
    return lines.join('\n');
  }

  #formatValue(value) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  #slackColor(severity) {
    switch (severity) {
      case 'critical':
        return '#d63649';
      case 'high':
        return '#f59e0b';
      case 'medium':
        return '#2563eb';
      default:
        return '#6b7280';
    }
  }
}

export function createAlertService(config) {
  return new AlertService(config);
}
