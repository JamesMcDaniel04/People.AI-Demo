#!/usr/bin/env node

import { config } from 'dotenv';
import { getPineconeService } from './src/services/pineconeService.js';

config();

async function testPinecone() {
  console.log('Testing Pinecone connection...');

  const pineconeService = getPineconeService({
    logLevel: 'info'
  });

  try {
    // Initialize the service
    const initialized = await pineconeService.initialize();
    console.log('Pinecone initialized:', initialized);

    // Check connection status
    const isConnected = pineconeService.isConnected();
    const isMockMode = pineconeService.isMockMode();
    console.log('Connected:', isConnected);
    console.log('Mock mode:', isMockMode);

    // Get health check
    const healthCheck = await pineconeService.healthCheck();
    console.log('Health check:', JSON.stringify(healthCheck, null, 2));

    // Test basic operations
    if (isConnected) {
      console.log('\nTesting basic operations...');

      // Test stats
      const stats = await pineconeService.getStats();
      console.log('Stats:', JSON.stringify(stats, null, 2));

      // Test query with mock vector
      const mockVector = new Array(1536).fill(0.1);
      const queryResult = await pineconeService.query(mockVector, { topK: 3 });
      console.log('Query result:', JSON.stringify(queryResult, null, 2));
    }

    console.log('\n✅ Pinecone test completed successfully!');
  } catch (error) {
    console.error('❌ Pinecone test failed:', error.message);
    process.exit(1);
  }
}

testPinecone();