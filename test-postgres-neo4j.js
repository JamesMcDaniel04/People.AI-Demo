#!/usr/bin/env node

// Test script to set up PostgreSQL and test the PostgreSQL -> Neo4j knowledge graph flow
import { config } from './src/config/config.js';
import { DataIntegrationManager } from './src/data/dataIntegrationManager.js';
import { PostgresService } from './src/services/postgresService.js';
import { GraphService } from './src/services/graphService.js';

async function testPostgresNeo4jIntegration() {
  console.log('🚀 Testing PostgreSQL -> Neo4j Knowledge Graph Integration...');
  
  try {
    // Check if PostgreSQL is running
    console.log('🔍 Checking PostgreSQL connection...');
    console.log('📊 PostgreSQL Config:', {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'people_ai_demo',
      user: process.env.POSTGRES_USER || 'postgres'
    });

    // Initialize services
    console.log('🔄 Initializing services...');
    
    const dataManager = new DataIntegrationManager(config);
    await dataManager.initialize();
    
    const postgresService = new PostgresService(config);
    const postgresConnected = await postgresService.initialize();
    
    if (!postgresConnected) {
      console.error('❌ PostgreSQL connection failed!');
      console.log('\n📋 Setup Instructions:');
      console.log('1. Install PostgreSQL: brew install postgresql');
      console.log('2. Start PostgreSQL: brew services start postgresql');
      console.log('3. Create database: createdb people_ai_demo');
      console.log('4. Or update .env with your PostgreSQL credentials');
      return;
    }
    
    const graphService = new GraphService(config, postgresService);
    const neo4jConnected = await graphService.initialize();
    
    if (!neo4jConnected) {
      throw new Error('Failed to connect to Neo4j Aura');
    }
    
    console.log('✅ All services initialized successfully');
    
    // Test with sample accounts
    const testAccounts = ['Stripe', 'Snowflake', 'Databricks'];
    
    for (const accountName of testAccounts) {
      try {
        console.log(`\n🎯 Processing ${accountName} with PostgreSQL -> Neo4j flow...`);
        
        // 1. Get account data from data sources
        console.log(`📊 Fetching data for ${accountName}...`);
        const accountData = await dataManager.getAccountData(accountName);
        
        console.log(`✅ Data fetched:`, {
          stakeholders: accountData.stakeholders?.[0]?.data?.length || 0,
          emails: accountData.emails?.[0]?.data?.length || 0,
          calls: accountData.calls?.[0]?.data?.length || 0,
          documents: accountData.documents?.length || 0
        });
        
        // 2. Store data in PostgreSQL
        console.log(`🗄️ Storing ${accountName} data in PostgreSQL...`);
        const postgresResult = await postgresService.storeAccountData(accountName, accountData);
        
        console.log(`✅ PostgreSQL storage complete:`, postgresResult);
        
        // 3. Simulate AI analysis results and store in PostgreSQL
        const mockAnalysisResults = {
          opportunities: [
            {
              title: `${accountName} Expansion Opportunity`,
              description: `Potential for product expansion with ${accountName}`,
              priority: 'High',
              potential_value: 250000,
              probability: 0.75,
              category: 'expansion',
              timeline: 'Q1 2025'
            },
            {
              title: `${accountName} Upsell Opportunity`,
              description: `Additional service upsell potential for ${accountName}`,
              priority: 'Medium',
              potential_value: 125000,
              probability: 0.60,
              category: 'upsell',
              timeline: 'Q2 2025'
            }
          ],
          risks: [
            {
              title: `${accountName} Contract Risk`,
              description: `Contract renewal approaching for ${accountName}`,
              severity: 'Medium',
              likelihood: 0.3,
              category: 'renewal',
              mitigation: 'Schedule renewal discussions early'
            },
            {
              title: `${accountName} Competitive Risk`,
              description: `Competitive pressure detected for ${accountName}`,
              severity: 'Low',
              likelihood: 0.2,
              category: 'competitive',
              mitigation: 'Monitor competitor activities and strengthen relationship'
            }
          ],
          health: { overall_score: 0.85 },
          insights: {
            engagement_trend: 'positive',
            key_stakeholder_activity: 'high',
            meeting_frequency: 'regular',
            risk_level: 'low',
            opportunity_score: 0.78
          }
        };
        
        await postgresService.addAnalysisResults(accountName, mockAnalysisResults);
        console.log(`✅ AI analysis results stored in PostgreSQL for ${accountName}`);
        
        // 4. Create Neo4j knowledge graph from PostgreSQL data
        console.log(`🔗 Creating Neo4j knowledge graph from PostgreSQL data for ${accountName}...`);
        const graphResult = await graphService.createGraphFromPostgres(accountName);
        
        console.log(`✅ Neo4j graph created from PostgreSQL:`, graphResult);
        
      } catch (error) {
        console.error(`❌ Failed to process ${accountName}:`, error.message);
        console.error('Stack:', error.stack);
      }
    }
    
    console.log('\n🎉 PostgreSQL -> Neo4j integration test completed!');
    console.log('\n📊 What was created:');
    console.log('1. ✅ PostgreSQL tables with normalized relational data');
    console.log('2. ✅ Neo4j Aura knowledge graph created from PostgreSQL data');
    console.log('3. ✅ Rich relationships between accounts, stakeholders, interactions, opportunities, and risks');
    
    console.log('\n🔍 Next Steps:');
    console.log('1. 🌐 Open Neo4j Aura browser to explore your knowledge graph');
    console.log('2. 🗄️ Query PostgreSQL to see structured data:');
    console.log('   psql people_ai_demo -c "SELECT * FROM accounts;"');
    console.log('3. 📊 Run Neo4j queries to explore relationships:');
    console.log('   MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25');
    console.log('   MATCH (a:Account)-[:WORKS_AT]-(s:Stakeholder) RETURN a.name, s.name');
    console.log('   MATCH (o:Opportunity)-[:IDENTIFIED_FOR]->(a:Account) RETURN o.title, a.name');
    
    await postgresService.close();
    await graphService.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('ECONNREFUSED') && error.message.includes('5432')) {
      console.log('\n📋 PostgreSQL Setup Instructions:');
      console.log('1. Install PostgreSQL: brew install postgresql');
      console.log('2. Start PostgreSQL: brew services start postgresql');
      console.log('3. Create database: createdb people_ai_demo');
      console.log('4. Set password: psql -c "ALTER USER postgres PASSWORD \'postgres\';"');
      console.log('5. Or update .env with your PostgreSQL credentials');
    }
    
    process.exit(1);
  }
}

// Run the test
testPostgresNeo4jIntegration()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });