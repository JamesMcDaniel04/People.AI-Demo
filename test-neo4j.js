#!/usr/bin/env node

// Test Neo4j Aura connection
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

async function testNeo4jConnection() {
  console.log('🔄 Testing Neo4j Aura connection...');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
    { 
      maxConnectionLifetime: 30 * 60 * 1000, // 30 minutes
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
      connectionTimeout: 30 * 1000 // 30 seconds
    }
  );

  try {
    // Test basic connectivity
    const session = driver.session({ database: 'neo4j' });
    
    console.log('🌐 Connecting to Neo4j Aura...');
    const result = await session.run('RETURN "Hello Neo4j!" as message, datetime() as timestamp');
    const record = result.records[0];
    
    console.log('✅ Connection successful!');
    console.log(`📧 Message: ${record.get('message')}`);
    console.log(`⏰ Timestamp: ${record.get('timestamp')}`);
    
    // Test database info
    const dbInfo = await session.run('CALL db.info()');
    const dbRecord = dbInfo.records[0];
    console.log(`📊 Database: ${dbRecord.get('name')} (${dbRecord.get('edition')})`);
    
    await session.close();
    await driver.close();
    
    console.log('🎉 Neo4j Aura connection test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Neo4j connection failed:', error.message);
    if (error.code) {
      console.error(`🔍 Error code: ${error.code}`);
    }
    await driver.close();
    return false;
  }
}

// Run the test
testNeo4jConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });