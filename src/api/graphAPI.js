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

  // Populate knowledge graph for a specific account
  router.post('/accounts/:accountName/populate', async (req, res) => {
    const { accountName } = req.params;
    
    try {
      const graphService = workflowOrchestrator.graphService;
      
      if (!graphService || !graphService.isConnected()) {
        return res.status(503).json({
          success: false,
          error: 'Graph service not available'
        });
      }

      // Get account data from data manager
      console.log(`🔄 Fetching account data for ${accountName}...`);
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
        timestamp: new Date().toISOString()
      });
      
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