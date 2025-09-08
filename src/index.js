import { AccountPlannerApp } from './ai/planning/accountPlanner.js';
import { DataIntegrationManager } from './data/dataIntegrationManager.js';
import { config } from './config/config.js';

async function main() {
  console.log('🚀 AI Account Planner Starting...');
  
  try {
    // Initialize data integration
    const dataManager = new DataIntegrationManager(config);
    await dataManager.initialize();
    
    // Initialize account planner
    const accountPlanner = new AccountPlannerApp(dataManager, config);
    
    // Generate account plan for Stripe (example)
    const accountPlan = await accountPlanner.generateAccountPlan('stripe');
    
    console.log('✅ Account Plan Generated Successfully');
    console.log(JSON.stringify(accountPlan, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();