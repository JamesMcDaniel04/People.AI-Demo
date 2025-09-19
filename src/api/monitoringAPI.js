import express from 'express';
import { createMonitoringService } from '../services/monitoringService.js';
import { Logger } from '../utils/logger.js';
import { statusService } from '../services/statusService.js';

export function createMonitoringAPI(config, options = {}) {
  const router = express.Router();
  const logger = new Logger(config);
  const monitoringService = createMonitoringService(config, options);

  // Initialize monitoring components
  monitoringService.registerComponent('ai-service', {
    description: 'AI model providers (OpenAI, Anthropic)',
    check: async () => {
      // This would check AI service connectivity
      return { status: 'healthy', responseTimeMs: 150 };
    },
    slaTarget: 0.99,
    tags: ['core', 'ai'],
    critical: true
  });

  monitoringService.registerComponent('mcp-integration', {
    description: 'Klavis MCP data integration',
    check: async () => {
      // This would check MCP connectivity
      return { status: 'healthy', responseTimeMs: 200 };
    },
    slaTarget: 0.95,
    tags: ['integration', 'data'],
    critical: false
  });

  monitoringService.registerComponent('redis-cache', {
    description: 'Redis caching and session storage',
    check: async () => {
      // This would check Redis connectivity
      return { status: 'healthy', responseTimeMs: 10 };
    },
    slaTarget: 0.99,
    tags: ['infrastructure', 'cache'],
    critical: true
  });

  // Get overall system health
  router.get('/health', async (req, res) => {
    try {
      const health = await monitoringService.getSystemHealth();

      const statusCode = health.status === 'operational' ? 200 :
                        health.status === 'warning' || health.status === 'degraded' ? 206 : 503;

      res.status(statusCode).json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Failed to get system health', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get detailed component status
  router.get('/components', async (req, res) => {
    try {
      const components = await monitoringService.evaluateAll();

      res.json({
        success: true,
        data: {
          components,
          summary: {
            total: Object.keys(components).length,
            healthy: Object.values(components).filter(c => c.state?.status === 'healthy').length,
            degraded: Object.values(components).filter(c => ['degraded', 'warn'].includes(c.state?.status)).length,
            unhealthy: Object.values(components).filter(c => ['unhealthy', 'critical', 'down'].includes(c.state?.status)).length
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get component status', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get CRM-specific monitoring data
  router.get('/crm', async (req, res) => {
    try {
      const crmStatus = await monitoringService.getCRMStatus();
      const crmMetrics = await monitoringService.getCRMMetrics();

      res.json({
        success: true,
        data: {
          status: crmStatus,
          metrics: crmMetrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get CRM monitoring data', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get real-time metrics
  router.get('/metrics', async (req, res) => {
    try {
      const { component, hours = 24 } = req.query;
      const timeRange = parseInt(hours) * 60 * 60 * 1000;

      let metrics;
      if (component) {
        metrics = statusService.getRecentMetrics(component, timeRange);
      } else {
        // Get all metrics
        const allTypes = ['health', 'crmLive', 'crmTasks', 'workflow', 'ai'];
        metrics = {};
        for (const type of allTypes) {
          metrics[type] = statusService.getRecentMetrics(type, timeRange);
        }
      }

      res.json({
        success: true,
        data: {
          metrics,
          timeRange: `${hours} hours`,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get metrics', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get performance analytics
  router.get('/analytics', async (req, res) => {
    try {
      const { period = '24h' } = req.query;
      const timeRange = parseTimeRange(period);

      const healthMetrics = statusService.getRecentMetrics('health', timeRange);
      const crmMetrics = statusService.getRecentMetrics('crmLive', timeRange);
      const taskMetrics = statusService.getRecentMetrics('crmTasks', timeRange);

      const analytics = {
        period,
        systemHealth: analyzeHealthMetrics(healthMetrics),
        crmPerformance: analyzeCRMMetrics(crmMetrics),
        taskCreation: analyzeTaskMetrics(taskMetrics),
        trends: calculateTrends([...healthMetrics, ...crmMetrics, ...taskMetrics]),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Failed to get performance analytics', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get incident history
  router.get('/incidents', async (req, res) => {
    try {
      const { limit = 50, severity } = req.query;

      // This would typically come from a persistent incident store
      const incidents = monitoringService.incidents
        .filter(incident => !severity || incident.severity === severity)
        .slice(0, parseInt(limit))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      res.json({
        success: true,
        data: {
          incidents,
          total: incidents.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get incident history', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Trigger manual health check
  router.post('/check', async (req, res) => {
    try {
      const { component } = req.body;

      let results;
      if (component) {
        results = await monitoringService.evaluateComponent(component);
      } else {
        results = await monitoringService.evaluateAll();
      }

      res.json({
        success: true,
        data: {
          results,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to execute health check', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get system uptime and statistics
  router.get('/uptime', async (req, res) => {
    try {
      const uptime = Date.now() - monitoringService.startedAt;
      const components = await monitoringService.evaluateAll();

      const stats = {
        systemUptime: uptime,
        systemUptimeFormatted: formatUptime(uptime),
        components: Object.fromEntries(
          Object.entries(components).map(([name, comp]) => [
            name,
            {
              availability: comp.state?.availability || 0,
              uptime: comp.state?.uptimeMs || 0,
              downtime: comp.state?.downtimeMs || 0,
              responseTime: comp.state?.responseTimeMs || 0,
              lastChecked: comp.state?.lastChecked
            }
          ])
        ),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get uptime statistics', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

function parseTimeRange(period) {
  const multipliers = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  const match = period.match(/^(\d+)([hdw])$/);
  if (!match) return 24 * 60 * 60 * 1000; // Default to 24 hours

  const [, amount, unit] = match;
  return parseInt(amount) * multipliers[unit];
}

function analyzeHealthMetrics(metrics) {
  const total = metrics.length;
  const healthy = metrics.filter(m => m.status === 'healthy').length;
  const degraded = metrics.filter(m => ['degraded', 'warn'].includes(m.status)).length;
  const unhealthy = metrics.filter(m => ['unhealthy', 'critical', 'down'].includes(m.status)).length;

  return {
    total,
    healthy,
    degraded,
    unhealthy,
    healthyPercentage: total > 0 ? Math.round((healthy / total) * 100) : 100,
    avgResponseTime: calculateAverageResponseTime(metrics)
  };
}

function analyzeCRMMetrics(metrics) {
  const total = metrics.length;
  const successful = metrics.filter(m => m.ok).length;
  const failed = metrics.filter(m => !m.ok).length;

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
    avgDuration: calculateAverageDuration(metrics),
    byCRM: groupByCRM(metrics)
  };
}

function analyzeTaskMetrics(metrics) {
  const total = metrics.length;
  const successful = metrics.filter(m => m.ok).length;
  const failed = metrics.filter(m => !m.ok).length;

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
    byAccount: groupByAccount(metrics),
    byCRM: groupByCRM(metrics)
  };
}

function calculateTrends(metrics) {
  // Simple trend calculation - more sophisticated analysis could be added
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const twoHoursAgo = now - (2 * 60 * 60 * 1000);

  const recent = metrics.filter(m => new Date(m.timestamp).getTime() > oneHourAgo);
  const previous = metrics.filter(m => {
    const time = new Date(m.timestamp).getTime();
    return time > twoHoursAgo && time <= oneHourAgo;
  });

  const recentSuccess = recent.filter(m => m.ok).length;
  const previousSuccess = previous.filter(m => m.ok).length;

  const recentRate = recent.length > 0 ? recentSuccess / recent.length : 0;
  const previousRate = previous.length > 0 ? previousSuccess / previous.length : 0;

  return {
    successRateChange: recentRate - previousRate,
    volumeChange: recent.length - previous.length,
    direction: recentRate > previousRate ? 'improving' : recentRate < previousRate ? 'declining' : 'stable'
  };
}

function calculateAverageResponseTime(metrics) {
  const withResponseTime = metrics.filter(m => typeof m.responseTimeMs === 'number');
  if (withResponseTime.length === 0) return 0;
  const total = withResponseTime.reduce((sum, m) => sum + m.responseTimeMs, 0);
  return Math.round(total / withResponseTime.length);
}

function calculateAverageDuration(metrics) {
  const withDuration = metrics.filter(m => typeof m.duration === 'number');
  if (withDuration.length === 0) return 0;
  const total = withDuration.reduce((sum, m) => sum + m.duration, 0);
  return Math.round(total / withDuration.length);
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

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}