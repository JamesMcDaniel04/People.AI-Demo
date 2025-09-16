import { Logger } from '../utils/logger.js';

export class PineconeService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config);
    this.client = null;
    this.index = null;
    this.connected = false;
    this.mockMode = false;
  }

  async initialize() {
    this.logger.info('🔄 Initializing Pinecone Vector Database...');

    // Check if Pinecone is configured
    if (!process.env.PINECONE_API_KEY) {
      this.logger.warn('⚠️ PINECONE_API_KEY not configured, using mock mode');
      this.mockMode = true;
      return true; // Return success for mock mode
    }

    try {
      // Dynamic import of Pinecone SDK (may not be installed)
      let Pinecone;
      try {
        const pineconeModule = await import('@pinecone-database/pinecone');
        Pinecone = pineconeModule.Pinecone;
      } catch (importError) {
        this.logger.warn('⚠️ Pinecone SDK not installed, using mock mode', {
          error: importError.message
        });
        this.mockMode = true;
        return true;
      }

      // Initialize Pinecone client
      this.client = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws'
      });

      // Test connection by listing indexes
      const indexName = process.env.PINECONE_INDEX_NAME || 'people-ai-demo';

      try {
        // Check if index exists
        const indexes = await this.client.listIndexes();
        const indexExists = indexes.some(idx => idx.name === indexName);

        if (!indexExists) {
          this.logger.warn(`⚠️ Pinecone index '${indexName}' not found, attempting to create...`);

          // Create index if it doesn't exist
          await this.client.createIndex({
            name: indexName,
            dimension: 1536, // OpenAI embedding dimension
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'aws',
                region: process.env.PINECONE_ENVIRONMENT || 'us-east-1'
              }
            }
          });

          this.logger.info(`✅ Pinecone index '${indexName}' created successfully`);
        }

        // Connect to the index
        this.index = this.client.index(indexName);

        // Test the index with a simple stats call
        await this.index.describeIndexStats();

        this.connected = true;
        this.logger.info('✅ Pinecone Vector Database connected successfully', {
          indexName,
          environment: process.env.PINECONE_ENVIRONMENT
        });

        return true;

      } catch (indexError) {
        this.logger.warn('⚠️ Pinecone index operations failed, using mock mode', {
          error: indexError.message,
          indexName
        });
        this.mockMode = true;
        return true;
      }

    } catch (error) {
      this.logger.error('❌ Pinecone initialization failed', {
        error: error.message
      });
      this.mockMode = true;
      return true; // Still return success but in mock mode
    }
  }

  async upsert(vectors, namespace = '') {
    if (this.mockMode) {
      this.logger.info('📝 Pinecone upsert (mock mode)', {
        vectorCount: vectors.length,
        namespace
      });
      return { upsertedCount: vectors.length };
    }

    if (!this.connected || !this.index) {
      throw new Error('Pinecone not connected');
    }

    try {
      const result = await this.index.namespace(namespace).upsert(vectors);
      this.logger.info('✅ Vectors upserted to Pinecone', {
        upsertedCount: result.upsertedCount,
        namespace
      });
      return result;
    } catch (error) {
      this.logger.error('❌ Pinecone upsert failed', { error: error.message });
      throw error;
    }
  }

  async query(vector, options = {}) {
    const { topK = 10, namespace = '', includeValues = false, includeMetadata = true } = options;

    if (this.mockMode) {
      this.logger.info('🔍 Pinecone query (mock mode)', { topK, namespace });

      // Return mock results
      return {
        matches: Array.from({ length: Math.min(topK, 3) }, (_, i) => ({
          id: `mock-${i}`,
          score: 0.9 - i * 0.1,
          values: includeValues ? new Array(1536).fill(0) : undefined,
          metadata: includeMetadata ? {
            text: `Mock result ${i + 1}`,
            account: 'stripe',
            type: 'email'
          } : undefined
        }))
      };
    }

    if (!this.connected || !this.index) {
      throw new Error('Pinecone not connected');
    }

    try {
      const result = await this.index.namespace(namespace).query({
        vector,
        topK,
        includeValues,
        includeMetadata
      });

      this.logger.info('✅ Pinecone query completed', {
        matchCount: result.matches.length,
        namespace
      });

      return result;
    } catch (error) {
      this.logger.error('❌ Pinecone query failed', { error: error.message });
      throw error;
    }
  }

  async deleteVectors(ids, namespace = '') {
    if (this.mockMode) {
      this.logger.info('🗑️ Pinecone delete (mock mode)', {
        idCount: ids.length,
        namespace
      });
      return { deletedCount: ids.length };
    }

    if (!this.connected || !this.index) {
      throw new Error('Pinecone not connected');
    }

    try {
      await this.index.namespace(namespace).deleteMany(ids);
      this.logger.info('✅ Vectors deleted from Pinecone', {
        deletedCount: ids.length,
        namespace
      });
      return { deletedCount: ids.length };
    } catch (error) {
      this.logger.error('❌ Pinecone delete failed', { error: error.message });
      throw error;
    }
  }

  async getStats(namespace = '') {
    if (this.mockMode) {
      return {
        totalVectorCount: 1000,
        dimension: 1536,
        indexFullness: 0.1,
        namespaces: {
          [namespace || 'default']: { vectorCount: 100 }
        }
      };
    }

    if (!this.connected || !this.index) {
      throw new Error('Pinecone not connected');
    }

    try {
      const stats = await this.index.describeIndexStats();
      return stats;
    } catch (error) {
      this.logger.error('❌ Pinecone stats failed', { error: error.message });
      throw error;
    }
  }

  isConnected() {
    return this.connected || this.mockMode;
  }

  isMockMode() {
    return this.mockMode;
  }

  async healthCheck() {
    if (this.mockMode) {
      return {
        status: 'mock',
        connected: true,
        indexName: process.env.PINECONE_INDEX_NAME || 'people-ai-demo'
      };
    }

    if (!this.connected) {
      return {
        status: 'disconnected',
        connected: false
      };
    }

    try {
      const stats = await this.getStats();
      return {
        status: 'connected',
        connected: true,
        indexName: process.env.PINECONE_INDEX_NAME,
        totalVectors: stats.totalVectorCount,
        dimension: stats.dimension
      };
    } catch (error) {
      return {
        status: 'error',
        connected: false,
        error: error.message
      };
    }
  }

  async disconnect() {
    this.connected = false;
    this.client = null;
    this.index = null;
    this.logger.info('✅ Pinecone service disconnected');
  }
}

// Singleton instance
let pineconeServiceInstance = null;

export function getPineconeService(config) {
  if (!pineconeServiceInstance) {
    pineconeServiceInstance = new PineconeService(config);
  }
  return pineconeServiceInstance;
}