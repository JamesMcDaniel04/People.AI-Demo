import { Queue, Worker } from 'bullmq';
import { getRedisService } from './redisService.js';
import { Logger } from '../utils/logger.js';

export class JobQueueService {
  constructor(config, workflowOrchestrator) {
    this.config = config;
    this.workflowOrchestrator = workflowOrchestrator;
    this.logger = new Logger(config);
    this.redisService = getRedisService(config);
    
    this.queues = new Map();
    this.workers = new Map();
    this.enabled = process.env.BULLMQ_ENABLED === 'true';
  }

  async initialize() {
    this.logger.info('🔄 Initializing Job Queue Service...');

    if (!this.enabled) {
      this.logger.warn('⚠️ BullMQ disabled, using fallback scheduling');
      return false;
    }

    try {
      // Initialize Redis connection
      const redisConnected = await this.redisService.initialize();
      if (!redisConnected) {
        this.logger.warn('⚠️ Redis unavailable, disabling job queue');
        this.enabled = false;
        return false;
      }

      // Create Redis connection config for BullMQ
      const redisConnection = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: null, // Required by BullMQ
      };
      
      // Add password if provided
      if (process.env.REDIS_PASSWORD) {
        redisConnection.password = process.env.REDIS_PASSWORD;
      }
      
      // Initialize main workflow queue
      await this.createQueue('workflow-execution', {
        defaultJobOptions: {
          removeOnComplete: 50, // Keep last 50 completed jobs
          removeOnFail: 100,    // Keep last 100 failed jobs
          attempts: 3,          // Retry failed jobs 3 times
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      });

      // Initialize scheduled workflow queue
      await this.createQueue('scheduled-workflows', {
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
        }
      });

      // Initialize recurring job scheduler
      await this.createQueue('recurring-workflows', {
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 25,
          attempts: 1, // Don't retry recurring jobs
        }
      });

      this.logger.info('✅ Job Queue Service initialized successfully', {
        queues: Array.from(this.queues.keys()),
        workers: Array.from(this.workers.keys())
      });

      return true;
    } catch (error) {
      this.logger.error('❌ Job Queue Service initialization failed', { error: error.message });
      this.enabled = false;
      return false;
    }
  }

  async createQueue(queueName, options = {}) {
    if (!this.enabled || !this.redisService.isConnected()) {
      throw new Error('Job queue service not available');
    }

    // Use the same Redis connection config format as in initialize
    const redisConnection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: null, // Required by BullMQ
    };
    
    // Add password if provided
    if (process.env.REDIS_PASSWORD) {
      redisConnection.password = process.env.REDIS_PASSWORD;
    }
    const queuePrefix = process.env.JOB_QUEUE_PREFIX || 'ai-account-planner';

    // Create queue
    const queue = new Queue(queueName, {
      connection: redisConnection,
      prefix: queuePrefix,
      ...options
    });

    // Create worker with proper connection configuration
    const worker = new Worker(queueName, async (job) => {
      return await this.processJob(queueName, job);
    }, {
      connection: redisConnection,
      prefix: queuePrefix,
      concurrency: 5, // Process up to 5 jobs concurrently
    });

    // Set up event listeners
    this.setupQueueEvents(queue, queueName);
    this.setupWorkerEvents(worker, queueName);

    // Store references
    this.queues.set(queueName, queue);
    this.workers.set(queueName, worker);

    this.logger.info(`✅ Queue '${queueName}' created successfully`);
  }

  setupQueueEvents(queue, queueName) {
    queue.on('waiting', (job) => {
      this.logger.info(`📋 Job waiting in ${queueName}`, { jobId: job.id });
    });

    queue.on('active', (job) => {
      this.logger.info(`🚀 Job started in ${queueName}`, { jobId: job.id });
    });

    queue.on('completed', (job, result) => {
      this.logger.info(`✅ Job completed in ${queueName}`, { 
        jobId: job.id, 
        duration: Date.now() - job.processedOn 
      });
    });

    queue.on('failed', (job, error) => {
      this.logger.error(`❌ Job failed in ${queueName}`, { 
        jobId: job?.id, 
        error: error.message,
        attempts: job?.attemptsMade
      });
    });
  }

  setupWorkerEvents(worker, queueName) {
    worker.on('error', (error) => {
      this.logger.error(`❌ Worker error in ${queueName}`, { error: error.message });
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn(`⚠️ Job stalled in ${queueName}`, { jobId });
    });
  }

  async processJob(queueName, job) {
    const { type, data } = job.data;
    const startTime = Date.now();

    this.logger.info(`🔄 Processing ${type} job`, { 
      queueName, 
      jobId: job.id, 
      data 
    });

    try {
      let result;

      switch (type) {
        case 'execute-workflow':
          result = await this.executeWorkflowJob(data);
          break;

        case 'scheduled-workflow':
          result = await this.executeScheduledWorkflow(data);
          break;

        case 'recurring-workflow':
          result = await this.executeRecurringWorkflow(data);
          break;

        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      const duration = Date.now() - startTime;
      this.logger.info(`✅ Job completed successfully`, { 
        jobId: job.id, 
        type, 
        duration: `${duration}ms` 
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Job processing failed`, { 
        jobId: job.id, 
        type, 
        error: error.message, 
        duration: `${duration}ms` 
      });
      
      throw error;
    }
  }

  async executeWorkflowJob(data) {
    const { workflowId, context } = data;
    return await this.workflowOrchestrator.executeWorkflow(workflowId, {
      ...context,
      trigger: 'job-queue',
      scheduledExecution: true
    });
  }

  async executeScheduledWorkflow(data) {
    const { workflowConfig, scheduleContext } = data;
    
    // Execute workflow directly with the provided config
    return await this.executeWorkflowJob({
      workflowId: workflowConfig.id,
      context: {
        ...scheduleContext,
        trigger: 'scheduled',
        scheduledAt: new Date().toISOString()
      }
    });
  }

  async executeRecurringWorkflow(data) {
    const { workflowId, recurringConfig } = data;
    
    // Execute the workflow
    const result = await this.executeWorkflowJob({ workflowId, context: recurringConfig.context });

    // Schedule next occurrence if still active
    if (recurringConfig.active) {
      await this.scheduleRecurringWorkflow(workflowId, recurringConfig);
    }

    return result;
  }

  // Public API methods
  async addWorkflowJob(workflowId, context = {}, options = {}) {
    if (!this.enabled) {
      throw new Error('Job queue not enabled');
    }

    const queue = this.queues.get('workflow-execution');
    if (!queue) {
      throw new Error('Workflow execution queue not available');
    }

    const job = await queue.add('execute-workflow', {
      type: 'execute-workflow',
      data: { workflowId, context }
    }, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    });

    this.logger.info('📋 Workflow job added to queue', { 
      jobId: job.id, 
      workflowId,
      delay: options.delay || 0
    });

    return job;
  }

  async scheduleWorkflow(workflowConfig, cronExpression, context = {}) {
    if (!this.enabled) {
      throw new Error('Job queue not enabled');
    }

    const queue = this.queues.get('scheduled-workflows');
    if (!queue) {
      throw new Error('Scheduled workflows queue not available');
    }

    const jobName = `scheduled-${workflowConfig.name.replace(/\s+/g, '-').toLowerCase()}`;
    
    // Remove existing scheduled job if it exists
    await queue.removeRepeatable(jobName, { pattern: cronExpression });

    // Add new repeatable job
    const job = await queue.add(jobName, {
      type: 'scheduled-workflow',
      data: { workflowConfig, scheduleContext: context }
    }, {
      repeat: { pattern: cronExpression },
      removeOnComplete: 10,
      removeOnFail: 5
    });

    // Store schedule metadata in Redis
    await this.redisService.setSchedule(workflowConfig.name, {
      cronExpression,
      workflowConfig,
      context,
      createdAt: new Date().toISOString(),
      jobName
    });

    this.logger.info('📅 Workflow scheduled successfully', { 
      jobName,
      cronExpression,
      workflowName: workflowConfig.name
    });

    return job;
  }

  async scheduleRecurringWorkflow(workflowId, recurringConfig) {
    if (!this.enabled) {
      throw new Error('Job queue not enabled');
    }

    const queue = this.queues.get('recurring-workflows');
    if (!queue) {
      throw new Error('Recurring workflows queue not available');
    }

    const { cronExpression, context, active } = recurringConfig;
    const jobName = `recurring-${workflowId}`;

    if (!active) {
      // Remove recurring job
      await queue.removeRepeatable(jobName, { pattern: cronExpression });
      return null;
    }

    const job = await queue.add(jobName, {
      type: 'recurring-workflow',
      data: { workflowId, recurringConfig }
    }, {
      repeat: { pattern: cronExpression },
      removeOnComplete: 5,
      removeOnFail: 2
    });

    this.logger.info('🔄 Recurring workflow scheduled', { 
      jobName,
      workflowId,
      cronExpression
    });

    return job;
  }

  async removeScheduledWorkflow(workflowName) {
    if (!this.enabled) {
      return false;
    }

    try {
      const scheduleData = await this.redisService.getSchedule(workflowName);
      if (!scheduleData) {
        return false;
      }

      const queue = this.queues.get('scheduled-workflows');
      await queue.removeRepeatable(scheduleData.jobName, { 
        pattern: scheduleData.cronExpression 
      });

      await this.redisService.deleteSchedule(workflowName);

      this.logger.info('🗑️ Scheduled workflow removed', { workflowName });
      return true;
    } catch (error) {
      this.logger.error('Failed to remove scheduled workflow', { 
        workflowName, 
        error: error.message 
      });
      return false;
    }
  }

  async getQueueStats() {
    if (!this.enabled) {
      return { enabled: false };
    }

    const stats = {};
    
    for (const [name, queue] of this.queues.entries()) {
      try {
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();

        stats[name] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          total: waiting.length + active.length + completed.length + failed.length
        };
      } catch (error) {
        stats[name] = { error: error.message };
      }
    }

    return { enabled: true, queues: stats };
  }

  isEnabled() {
    return this.enabled;
  }

  async shutdown() {
    this.logger.info('🛑 Shutting down Job Queue Service...');

    // Close all workers
    for (const [name, worker] of this.workers.entries()) {
      try {
        await worker.close();
        this.logger.info(`✅ Worker '${name}' closed`);
      } catch (error) {
        this.logger.error(`❌ Error closing worker '${name}'`, { error: error.message });
      }
    }

    // Note: Schedulers no longer exist in BullMQ v5+

    // Close all queues
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
        this.logger.info(`✅ Queue '${name}' closed`);
      } catch (error) {
        this.logger.error(`❌ Error closing queue '${name}'`, { error: error.message });
      }
    }

    // Disconnect Redis
    await this.redisService.disconnect();
    
    this.logger.info('✅ Job Queue Service shutdown complete');
  }
}