#!/usr/bin/env node

// Test script to populate Neo4j Aura with live data from your People.AI project
import { config } from './src/config/config.js';
import { DataIntegrationManager } from './src/data/dataIntegrationManager.js';
import { GraphService } from './src/services/graphService.js';

async function testLiveGraphConnection() {
  console.log('🚀 Testing Live Neo4j Aura Connection...');
  console.log('🔗 Neo4j URI:', process.env.NEO4J_URI?.replace(/\/\/.*@/, '//***@'));
  
  try {
    // Initialize services
    console.log('🔄 Initializing services...');
    
    const dataManager = new DataIntegrationManager(config);
    await dataManager.initialize();
    
    const graphService = new GraphService(config);
    const connected = await graphService.initialize();
    
    if (!connected) {
      throw new Error('Failed to connect to Neo4j Aura');
    }
    
    console.log('✅ Services initialized successfully');
    
    // Test with sample accounts
    const testAccounts = ['Stripe', 'Snowflake', 'Databricks'];
    
    for (const accountName of testAccounts) {
      try {
        console.log(`\n🎯 Processing ${accountName}...`);
        
        // Get account data from your data sources
        console.log(`📊 Fetching data for ${accountName}...`);
        const accountData = await dataManager.getAccountData(accountName);
        
        console.log(`✅ Data fetched:`, {
          stakeholders: accountData.stakeholders?.[0]?.data?.length || 0,
          emails: accountData.emails?.[0]?.data?.length || 0,
          calls: accountData.calls?.[0]?.data?.length || 0,
          documents: accountData.documents?.length || 0
        });
        
        // Create knowledge graph in Neo4j Aura
        console.log(`🏗️ Creating knowledge graph for ${accountName}...`);
        const graphResult = await graphService.createAccountGraph(accountName, accountData);
        
        console.log(`✅ Graph created:`, graphResult);
        
        // Simulate some AI analysis results and add them to the graph
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
            }
          ],
          health: { overall_score: 0.85 },
          insights: {
            engagement_trend: 'positive',
            key_stakeholder_activity: 'high',
            meeting_frequency: 'regular'
          }
        };
        
        await graphService.addAnalysisResults(accountName, mockAnalysisResults);
        console.log(`✅ AI analysis added to graph for ${accountName}`);
        
      } catch (error) {
        console.error(`❌ Failed to process ${accountName}:`, error.message);
      }
    }
    
    console.log('\n🎉 Live graph population completed!');
    console.log('🌐 Open your Neo4j Aura browser to explore the knowledge graph');
    console.log('📊 Try running these queries in Neo4j Browser:');
    console.log('   MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25');
    console.log('   MATCH (a:Account) RETURN a');
    console.log('   MATCH (s:Stakeholder)-[:WORKS_AT]->(a:Account) RETURN s.name, a.name');
    
    await graphService.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testLiveGraphConnection()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });