import { getLiveCrmService } from './src/services/liveCrmService.js';
import { config } from './src/config/config.js';
import { Logger } from './src/utils/logger.js';

const logger = new Logger(config);

async function testCRMIntegration() {
  logger.info('🔄 Testing CRM Integration...');

  try {
    // Initialize the live CRM service
    const liveCrmService = getLiveCrmService(config);
    await liveCrmService.initialize();

    // Test 1: Check connection status
    logger.info('🔍 Test 1: Checking CRM connection status...');
    const connectionStatus = liveCrmService.getConnectionStatus();
    logger.info('Connection Status:', connectionStatus);

    // Test 2: Validate configuration
    logger.info('🔍 Test 2: Validating CRM configuration...');
    const validation = await liveCrmService.validateCRMConfiguration();
    logger.info('Configuration Validation:', validation);

    // Test 3: Test all connections
    logger.info('🔍 Test 3: Testing all CRM connections...');
    const testResults = await liveCrmService.testAllConnections();
    logger.info('Connection Test Results:', testResults);

    // Test 4: Find account across CRMs (if any are connected)
    if (connectionStatus.activeConnections.length > 0) {
      logger.info('🔍 Test 4: Finding test account across CRMs...');
      const accountResults = await liveCrmService.findAccountAcrossAllCRMs('Test Account');
      logger.info('Account Search Results:', accountResults);
    } else {
      logger.info('🔍 Test 4: Skipped (no active CRM connections)');
    }

    // Test 5: Mock account plan for task creation testing
    const mockAccountPlan = {
      accountOverview: {
        healthScore: { score: 75, overall: 'healthy' }
      },
      opportunityAnalysis: {
        identifiedOpportunities: [
          { type: 'Expansion', value: 50000, confidence: 0.8, reasoning: 'Strong product fit' }
        ]
      },
      riskAssessment: {
        identifiedRisks: [
          { type: 'Churn Risk', level: 'medium', description: 'Contract renewal upcoming' }
        ]
      },
      strategicRecommendations: {
        immediate: [
          {
            action: 'Schedule renewal discussion',
            rationale: 'Proactive engagement for contract renewal',
            timeline: '7 days',
            priority: 'high',
            owner: 'account_manager'
          }
        ]
      },
      executiveSummary: {
        recommendation: 'Maintain strong relationship and prepare for renewal'
      }
    };

    const testContext = {
      accountName: 'Test Account',
      executionId: `test-${Date.now()}`
    };

    // Test 6: Create tasks in all connected CRMs (if any)
    if (connectionStatus.activeConnections.length > 0) {
      logger.info('🔍 Test 6: Creating test tasks in all CRMs...');
      const taskResults = await liveCrmService.createTasksInAllCRMs(
        mockAccountPlan,
        { maxTasks: 2 },
        testContext
      );
      logger.info('Task Creation Results:', taskResults);

      // Test 7: Update account in all connected CRMs
      logger.info('🔍 Test 7: Updating test account in all CRMs...');
      const updateResults = await liveCrmService.updateAccountInAllCRMs(
        mockAccountPlan,
        {},
        testContext
      );
      logger.info('Account Update Results:', updateResults);

      // Test 8: Get task verification report
      logger.info('🔍 Test 8: Getting task verification report...');
      const verificationReport = await liveCrmService.getTaskVerificationReport(
        testContext.accountName,
        testContext.executionId
      );
      logger.info('Task Verification Report:', verificationReport);
    } else {
      logger.info('🔍 Tests 6-8: Skipped (no active CRM connections - running in mock mode)');

      // Still test the mock functionality
      logger.info('🔍 Test 6 (Mock): Creating test tasks in mock mode...');
      const mockTaskResults = await liveCrmService.createTasksInAllCRMs(
        mockAccountPlan,
        { maxTasks: 2 },
        testContext
      );
      logger.info('Mock Task Creation Results:', mockTaskResults);
    }

    logger.info('✅ CRM Integration Test Completed Successfully');

    // Summary
    const summary = {
      totalConfiguredCRMs: connectionStatus.totalConfigured,
      activeConnections: connectionStatus.activeConnections,
      connectionTests: Object.entries(testResults).map(([crm, result]) => ({
        crm,
        status: result.status,
        duration: result.duration || 'N/A'
      })),
      configurationStatus: Object.entries(validation).map(([crm, config]) => ({
        crm,
        configured: config.configured,
        missing: config.missing.length
      }))
    };

    logger.info('📊 Test Summary:', summary);

    return summary;

  } catch (error) {
    logger.error('❌ CRM Integration Test Failed:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCRMIntegration()
    .then(summary => {
      console.log('\n🎉 CRM Integration Test Summary:');
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 CRM Integration Test Failed:', error.message);
      process.exit(1);
    });
}

export { testCRMIntegration };