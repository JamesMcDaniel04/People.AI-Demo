import { Router } from 'express';

export function createGraphAPI(workflowOrchestrator, dataManager, config) {
  const router = Router();

  // Test the graph service connection
  router.get('/status', async (req, res) => {
    try {
      const graphService = workflowOrchestrator.graphService;
      
      const status = {
        connected: graphService?.isConnected() || false,
        neo4j_uri: process.env.NEO4J_URI?.replace(/\/\/.*@/, '//***@') || 'not configured',
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Populate knowledge graph for a specific account (PostgreSQL -> Neo4j flow)
  router.post('/accounts/:accountName/populate', async (req, res) => {
    const { accountName } = req.params;
    
    try {
      const graphService = workflowOrchestrator.graphService;
      const postgresService = workflowOrchestrator.postgresService;
      
      if (!graphService || !graphService.isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Neo4j Graph service not available'
        });
      }

      // PostgreSQL -> Neo4j flow (preferred)
      if (postgresService && postgresService.isConnected()) {
        console.log(`🔄 PostgreSQL -> Neo4j flow for ${accountName}...`);
        
        // Get account data from data manager
        console.log(`📊 Fetching account data for ${accountName}...`);
        const accountData = await dataManager.getAccountData(accountName);
        
        // Store in PostgreSQL first
        console.log(`🗄️ Storing ${accountName} data in PostgreSQL...`);
        await postgresService.storeAccountData(accountName, accountData);
        
        // Create knowledge graph from PostgreSQL
        console.log(`🔗 Creating Neo4j knowledge graph from PostgreSQL for ${accountName}...`);
        const graphResult = await graphService.createGraphFromPostgres(accountName);
      
        // Generate AI analysis and store in PostgreSQL too
        try {
          const accountPlanner = workflowOrchestrator.accountPlanner;
          if (accountPlanner) {
            console.log(`🤖 Generating AI analysis for ${accountName}...`);
            const accountPlan = await accountPlanner.generateAccountPlan(accountName);
            
            const analysisResults = {
              opportunities: accountPlan.opportunities || [],
              risks: accountPlan.risks || [],
              health: accountPlan.health || {},
              insights: accountPlan.insights || {}
            };
            
            // Store AI results in PostgreSQL
            await postgresService.addAnalysisResults(accountName, analysisResults);
            
            // Recreate Neo4j graph with AI results
            await graphService.createGraphFromPostgres(accountName);
            
            console.log(`✅ AI analysis stored in PostgreSQL and Neo4j graph updated for ${accountName}`);
          }
        } catch (aiError) {
          console.warn(`⚠️ AI analysis failed for ${accountName}:`, aiError.message);
        }

        res.json({
          success: true,
          message: `Knowledge graph created from PostgreSQL for ${accountName}`,
          result: graphResult,
          source: 'postgresql',
          timestamp: new Date().toISOString()
        });

      } else {
        // Fallback to direct Neo4j creation if PostgreSQL is not available
        console.log(`🔄 Direct Neo4j creation for ${accountName} (PostgreSQL not available)...`);
        
        // Get account data from data manager
        console.log(`📊 Fetching account data for ${accountName}...`);
        const accountData = await dataManager.getAccountData(accountName);
        
        // Create knowledge graph
        console.log(`🏗️ Creating knowledge graph for ${accountName}...`);
        const graphResult = await graphService.createAccountGraph(accountName, accountData);

        // If we have AI analysis results, add them too
        try {
          const accountPlanner = workflowOrchestrator.accountPlanner;
          if (accountPlanner) {
            console.log(`🤖 Generating AI analysis for ${accountName}...`);
            const accountPlan = await accountPlanner.generateAccountPlan(accountName);
            
            const analysisResults = {
              opportunities: accountPlan.opportunities || [],
              risks: accountPlan.risks || [],
              health: accountPlan.health || {},
              insights: accountPlan.insights || {}
            };
            
            await graphService.addAnalysisResults(accountName, analysisResults);
            console.log(`✅ AI analysis added to graph for ${accountName}`);
          }
        } catch (aiError) {
          console.warn(`⚠️ AI analysis failed for ${accountName}:`, aiError.message);
        }

        res.json({
          success: true,
          message: `Knowledge graph created for ${accountName}`,
          result: graphResult,
          source: 'direct',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error(`❌ Failed to populate graph for ${accountName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message,
        accountName
      });
    }
  });

  // Get knowledge graph data for an account
  router.get('/accounts/:accountName/graph', async (req, res) => {
    const { accountName } = req.params;
    
    try {
      const graphService = workflowOrchestrator.graphService;
      
      if (!graphService || !graphService.isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Graph service not available'
        });
      }

      const graphData = await graphService.getAccountGraph(accountName);
      
      if (!graphData) {
        return res.status(404).json({
          success: false,
          message: `No graph data found for account: ${accountName}`
        });
      }

      res.json({
        success: true,
        accountName,
        graphData,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        accountName
      });
    }
  });

  // Batch populate graphs for multiple accounts
  router.post('/populate-batch', async (req, res) => {
    const { accounts } = req.body;
    
    if (!accounts || !Array.isArray(accounts)) {
      return res.status(400).json({
        success: false,
        error: 'accounts array is required'
      });
    }

    try {
      const graphService = workflowOrchestrator.graphService;
      
      if (!graphService || !graphService.isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Graph service not available'
        });
      }

      const results = [];
      
      for (const accountName of accounts) {
        try {
          console.log(`🔄 Processing ${accountName}...`);
          
          // Get account data
          const accountData = await dataManager.getAccountData(accountName);
          
          // Create knowledge graph
          const graphResult = await graphService.createAccountGraph(accountName, accountData);
          
          results.push({
            accountName,
            success: true,
            result: graphResult
          });
          
        } catch (error) {
          console.error(`❌ Failed to process ${accountName}:`, error.message);
          results.push({
            accountName,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Processed ${accounts.length} accounts`,
        results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}