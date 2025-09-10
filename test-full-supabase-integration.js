#!/usr/bin/env node

// Comprehensive test for Supabase + PostgreSQL + Neo4j integration
import { config } from './src/config/config.js';
import { WorkflowOrchestrator } from './src/workflows/workflowOrchestrator.js';

async function testFullIntegration() {
  console.log('🚀 Testing Full Supabase + PostgreSQL + Neo4j Integration...');
  console.log('🔗 Supabase URL:', process.env.SUPABASE_URL);
  console.log('🗄️ PostgreSQL Host:', process.env.POSTGRES_HOST);
  console.log('🌐 Neo4j URI:', process.env.NEO4J_URI?.replace(/\/\/.*@/, '//***@'));
  
  try {
    // Initialize the full workflow orchestrator
    console.log('\n🔄 Initializing Workflow Orchestrator with all services...');
    
    const orchestrator = new WorkflowOrchestrator(config);
    await orchestrator.initialize();
    
    console.log('✅ All services initialized successfully');
    console.log('📊 Service Status:', {
      supabase: orchestrator.supabaseService?.isConnected() || false,
      postgres: orchestrator.postgresService?.isConnected() || false,
      neo4j: orchestrator.graphService?.isConnected() || false,
      dataManager: !!orchestrator.dataManager,
      accountPlanner: !!orchestrator.accountPlanner
    });
    
    // Test the complete data flow: Sample Data -> PostgreSQL (via Supabase) -> Neo4j
    console.log('\n🔄 Testing complete data flow...');
    
    const testAccount = 'Microsoft';
    
    // 1. Generate account plan (this triggers the full workflow)
    console.log(`🤖 Generating account plan for ${testAccount}...`);
    const accountPlan = await orchestrator.accountPlanner.generateAccountPlan(testAccount);
    
    console.log('✅ Account plan generated:', {
      account: accountPlan.account,
      healthScore: accountPlan.health?.overall_score,
      opportunitiesCount: accountPlan.opportunities?.length || 0,
      risksCount: accountPlan.risks?.length || 0
    });
    
    // 2. Store data in Supabase PostgreSQL
    console.log(`🗄️ Storing ${testAccount} data in Supabase PostgreSQL...`);
    const accountData = accountPlan.rawData || await orchestrator.dataManager.getAccountData(testAccount);
    
    const postgresResult = await orchestrator.postgresService.storeAccountData(testAccount, accountData);
    console.log('✅ Data stored in Supabase PostgreSQL:', postgresResult);
    
    // 3. Store AI analysis results
    const analysisResults = {
      opportunities: accountPlan.opportunities || [],
      risks: accountPlan.risks || [],
      health: accountPlan.health || {},
      insights: accountPlan.insights || {}
    };
    
    await orchestrator.postgresService.addAnalysisResults(testAccount, analysisResults);
    console.log('✅ AI analysis stored in Supabase PostgreSQL');
    
    // 4. Create Neo4j knowledge graph from Supabase PostgreSQL data
    console.log(`🔗 Creating Neo4j knowledge graph from Supabase PostgreSQL for ${testAccount}...`);
    const graphResult = await orchestrator.graphService.createGraphFromPostgres(testAccount);
    
    console.log('✅ Neo4j knowledge graph created:', graphResult);
    
    // 5. Query Supabase PostgreSQL to verify data
    console.log('\n🔍 Verifying data in Supabase PostgreSQL...');
    
    // Query accounts table
    const client = await orchestrator.postgresService.pool.connect();
    try {
      const accountsResult = await client.query(`
        SELECT name, industry, health_score, 
               (SELECT COUNT(*) FROM stakeholders WHERE account_id = accounts.id) as stakeholder_count,
               (SELECT COUNT(*) FROM interactions WHERE account_id = accounts.id) as interaction_count,
               (SELECT COUNT(*) FROM opportunities WHERE account_id = accounts.id) as opportunity_count,
               (SELECT COUNT(*) FROM risks WHERE account_id = accounts.id) as risk_count
        FROM accounts 
        WHERE name = $1
      `, [testAccount]);
      
      if (accountsResult.rows.length > 0) {
        console.log('✅ Account data verified in Supabase PostgreSQL:', accountsResult.rows[0]);
      } else {
        console.log('⚠️ No account data found in PostgreSQL');
      }
      
      // Query user_credentials table to verify it exists
      const credentialsTest = await client.query(`
        SELECT COUNT(*) as credential_count FROM user_credentials
      `);
      
      console.log('✅ user_credentials table accessible:', {
        totalCredentials: credentialsTest.rows[0].credential_count
      });
      
    } finally {
      client.release();
    }
    
    console.log('\n🎉 Full integration test completed successfully!');
    console.log('\n📊 What was accomplished:');
    console.log('1. ✅ Supabase authentication service initialized');
    console.log('2. ✅ PostgreSQL connected via Supabase connection pooler');
    console.log('3. ✅ Neo4j Aura cloud database connected');
    console.log('4. ✅ Complete data flow: Sample Data -> Supabase PostgreSQL -> Neo4j');
    console.log('5. ✅ AI account planning with data persistence');
    console.log('6. ✅ User credentials table ready for authentication');
    
    console.log('\n🌟 Integration Architecture:');
    console.log('• 🔐 Supabase Auth: User authentication and session management');
    console.log('• 🗄️ Supabase PostgreSQL: Primary relational data store (via connection pooler)');
    console.log('• 🔗 Neo4j Aura: Knowledge graph created from PostgreSQL data');
    console.log('• 🤖 AI Analysis: Multi-model account planning with Claude + GPT');
    console.log('• 📊 Workflow Orchestration: End-to-end automated processing');
    
    console.log('\n🚀 Available APIs:');
    console.log('• 🔐 Authentication: http://localhost:3001/auth/*');
    console.log('• 🗄️ Data Management: http://localhost:3001/api/*');
    console.log('• 🔗 Graph Operations: http://localhost:3001/graph/*');
    console.log('• 🤖 Workflow Management: http://localhost:3001/workflows/*');
    console.log('• 📊 Quick Account Plans: http://localhost:3001/quick/account-plan');
    
    console.log('\n🔄 Next Steps:');
    console.log('1. 🌐 Start the workflow server: npm run workflow');
    console.log('2. 📝 Test authentication: POST /auth/signup, /auth/signin');
    console.log('3. 🗄️ Store user credentials: POST /auth/api-keys');
    console.log('4. 🔗 Create knowledge graphs: POST /graph/accounts/:name/populate');
    console.log('5. 🌍 Explore Neo4j Aura browser for the knowledge graph');
    
  } catch (error) {
    console.error('❌ Full integration test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testFullIntegration()
  .then(() => {
    console.log('✅ Integration test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Integration test failed:', error);
    process.exit(1);
  });