import Redis from 'ioredis';
import { Logger } from '../utils/logger.js';

export class RedisService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.redis = null;
    this.connected = false;
  }

  async initialize() {
    this.logger.info('🔄 Initializing Redis connection...');

    if (!process.env.BULLMQ_ENABLED || process.env.BULLMQ_ENABLED !== 'true') {
      this.logger.warn('⚠️ BullMQ disabled, skipping Redis connection');
      return false;
    }

    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        db: parseInt(process.env.REDIS_DB) || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: true,
      };

      // Add password if provided
      if (process.env.REDIS_PASSWORD) {
        redisConfig.password = process.env.REDIS_PASSWORD;
      }

      // Create Redis connection
      this.redis = new Redis(redisConfig);

      // Set up event listeners
      this.setupEventListeners();

      // Test connection
      await this.redis.ping();
      
      this.connected = true;
      this.logger.info('✅ Redis connection established successfully', {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db
      });

      return true;
    } catch (error) {
      this.logger.error('❌ Redis connection failed', { error: error.message });
      this.connected = false;
      return false;
    }
  }

  setupEventListeners() {
    this.redis.on('connect', () => {
      this.logger.info('🔗 Redis connected');
      this.connected = true;
    });

    this.redis.on('ready', () => {
      this.logger.info('🚀 Redis ready to accept commands');
    });

    this.redis.on('error', (error) => {
      this.logger.error('❌ Redis error', { error: error.message });
      this.connected = false;
    });

    this.redis.on('close', () => {
      this.logger.warn('⚠️ Redis connection closed');
      this.connected = false;
    });

    this.redis.on('reconnecting', (delay) => {
      this.logger.info('🔄 Redis reconnecting', { delay });
    });
  }

  getConnection() {
    if (!this.redis || !this.connected) {
      throw new Error('Redis connection not available');
    }
    return this.redis;
  }

  isConnected() {
    return this.connected && this.redis;
  }

  async healthCheck() {
    if (!this.redis) {
      return { status: 'disconnected', error: 'No Redis connection' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        status: 'connected',
        latency: `${latency}ms`,
        connected: this.connected
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        connected: false
      };
    }
  }

  // Utility methods for job scheduling data
  async setSchedule(workflowId, scheduleData) {
    if (!this.isConnected()) {
      throw new Error('Redis not connected');
    }

    const key = `${process.env.JOB_QUEUE_PREFIX || 'ai-account-planner'}:schedule:${workflowId}`;
    await this.redis.setex(key, 86400, JSON.stringify(scheduleData)); // 24 hour TTL
  }

  async getSchedule(workflowId) {
    if (!this.isConnected()) {
      throw new Error('Redis not connected');
    }

    const key = `${process.env.JOB_QUEUE_PREFIX || 'ai-account-planner'}:schedule:${workflowId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteSchedule(workflowId) {
    if (!this.isConnected()) {
      throw new Error('Redis not connected');
    }

    const key = `${process.env.JOB_QUEUE_PREFIX || 'ai-account-planner'}:schedule:${workflowId}`;
    await this.redis.del(key);
  }

  async getAllSchedules() {
    if (!this.isConnected()) {
      throw new Error('Redis not connected');
    }

    const pattern = `${process.env.JOB_QUEUE_PREFIX || 'ai-account-planner'}:schedule:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    const schedules = await this.redis.mget(keys);
    return keys.map((key, index) => ({
      workflowId: key.split(':').pop(),
      ...JSON.parse(schedules[index])
    }));
  }

  // Cache utility methods
  async setCache(key, data, ttl = 3600) {
    if (!this.isConnected()) {
      return false;
    }

    try {
      const cacheKey = `${process.env.JOB_QUEUE_PREFIX || 'ai-account-planner'}:cache:${key}`;
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      this.logger.error('Cache set failed', { key, error: error.message });
      return false;
    }
  }

  async getCache(key) {
    if (!this.isConnected()) {
      return null;
    }

    try {
      const cacheKey = `${process.env.JOB_QUEUE_PREFIX || 'ai-account-planner'}:cache:${key}`;
      const data = await this.redis.get(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error('Cache get failed', { key, error: error.message });
      return null;
    }
  }

  async disconnect() {
    if (this.redis) {
      this.logger.info('🛑 Disconnecting from Redis...');
      await this.redis.quit();
      this.connected = false;
      this.logger.info('✅ Redis disconnected');
    }
  }
}

// Singleton instance
let redisServiceInstance = null;

export function getRedisService(config) {
  if (!redisServiceInstance) {
    redisServiceInstance = new RedisService(config);
  }
  return redisServiceInstance;
}