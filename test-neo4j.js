#!/usr/bin/env node

import { config } from 'dotenv';
import { getGraphService } from './src/services/graphService.js';

config();

async function testNeo4j() {
  console.log('Testing Neo4j connection...');

  const graphService = getGraphService({
    logLevel: 'info'
  });

  try {
    // Initialize the service
    const initialized = await graphService.initialize();
    console.log('Neo4j initialized:', initialized);

    // Check connection status
    const isConnected = graphService.isConnected();
    const isMockMode = graphService.isMockMode();
    console.log('Connected:', isConnected);
    console.log('Mock mode:', isMockMode);

    // Get health check
    const healthCheck = await graphService.healthCheck();
    console.log('Health check:', JSON.stringify(healthCheck, null, 2));

    // Test basic operations
    if (isConnected && !isMockMode) {
      console.log('\nTesting basic database operations...');

      // Test simple query
      const result = await graphService.runQuery('RETURN 1 as test');
      console.log('Simple query result:', result);

      // Test version info
      const version = await graphService.runQuery('CALL dbms.components() YIELD name, versions, edition');
      console.log('Database version:', version);
    }

    console.log('\n✅ Neo4j test completed successfully!');
  } catch (error) {
    console.error('❌ Neo4j test failed:', error.message);
    process.exit(1);
  }
}

testNeo4j();
