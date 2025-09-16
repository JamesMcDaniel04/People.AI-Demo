#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

async function testPineconeConnection() {
  console.log('🔍 Testing direct Pinecone connection...');

  // Check environment variables
  console.log('📋 Environment check:');
  console.log(`- PINECONE_API_KEY: ${process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`- PINECONE_ENVIRONMENT: ${process.env.PINECONE_ENVIRONMENT || 'Not set'}`);
  console.log(`- PINECONE_INDEX_NAME: ${process.env.PINECONE_INDEX_NAME || 'Not set'}`);

  if (!process.env.PINECONE_API_KEY) {
    console.log('❌ PINECONE_API_KEY is required');
    return;
  }

  try {
    // Import Pinecone SDK
    console.log('📦 Importing Pinecone SDK...');
    const { Pinecone } = await import('@pinecone-database/pinecone');

    // Initialize client
    console.log('🔧 Initializing Pinecone client...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // List indexes
    console.log('📋 Listing existing indexes...');
    const indexes = await pinecone.listIndexes();
    console.log(`📊 Found ${indexes.indexes.length} indexes:`, indexes.indexes.map(idx => idx.name));

    const indexName = process.env.PINECONE_INDEX_NAME || 'people-ai-demo';
    const indexExists = indexes.indexes.some(idx => idx.name === indexName);

    if (!indexExists) {
      console.log(`🏗️ Creating index '${indexName}'...`);
      await pinecone.createIndex({
        name: indexName,
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      console.log(`✅ Index '${indexName}' created successfully`);

      // Wait a bit for index to be ready
      console.log('⏳ Waiting for index to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      console.log(`✅ Index '${indexName}' already exists`);
    }

    // Connect to index
    console.log(`🔗 Connecting to index '${indexName}'...`);
    const index = pinecone.index(indexName);

    // Get index stats
    console.log('📊 Getting index statistics...');
    const stats = await index.describeIndexStats();
    console.log('📈 Index stats:', {
      totalVectorCount: stats.totalVectorCount,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness
    });

    // Test upsert with sample vector
    console.log('📝 Testing upsert with sample vector...');
    const sampleVector = {
      id: 'test-vector-1',
      values: Array.from({ length: 1536 }, () => Math.random()),
      metadata: {
        text: 'This is a test vector for Stripe account data',
        account: 'Stripe',
        type: 'test',
        timestamp: new Date().toISOString()
      }
    };

    const upsertResult = await index.upsert([sampleVector]);
    console.log('✅ Upsert successful:', upsertResult);

    // Test query
    console.log('🔍 Testing query...');
    const queryResult = await index.query({
      vector: Array.from({ length: 1536 }, () => Math.random()),
      topK: 5,
      includeMetadata: true
    });
    console.log(`🎯 Query returned ${queryResult.matches.length} results`);

    console.log('🎉 Pinecone connection test completed successfully!');

  } catch (error) {
    console.error('❌ Pinecone connection test failed:', error.message);
    console.error('🔍 Error details:', error);
  }
}

// Run the test
testPineconeConnection();