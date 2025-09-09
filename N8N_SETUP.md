# n8n Integration Setup Guide

This guide explains how to set up n8n workflow automation with the AI Account Planner system, including Klavis MCP integration.

## Prerequisites

1. **n8n Installation**
   ```bash
   # Install n8n globally
   npm install n8n -g
   
   # Or run with Docker
   docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
   ```

2. **Required Environment Variables**
   ```env
   # n8n Configuration
   N8N_ENABLED=true
   N8N_BASE_URL=http://localhost:5678
   N8N_API_KEY=your_n8n_api_key_here
   
   # Integration Settings
   N8N_KLAVIS_INTEGRATION=true
   N8N_AI_INTEGRATION=true
   
   # Workflow Engine
   WORKFLOW_ENGINE=hybrid
   WORKFLOW_DEFAULT_ENGINE=internal
   ```

## Setup Steps

### 1. Start n8n Server

```bash
# Start n8n (will be available at http://localhost:5678)
n8n start

# Or with Docker
docker run -it --rm --name n8n -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### 2. Configure n8n API Access

1. Open n8n at http://localhost:5678
2. Go to Settings → API
3. Generate an API key
4. Add the API key to your `.env` file as `N8N_API_KEY`

### 3. Start the AI Account Planner with n8n

```bash
# Start the workflow server with n8n integration
npm run workflow

# Or start with demo
npm run workflow -- --demo
```

## Workflow Types

### 1. Internal Workflows
- Managed by the internal WorkflowOrchestrator
- Scheduled with cron jobs
- Direct integration with Klavis MCP and AI services

### 2. n8n Workflows
- Visual workflow builder
- Advanced integrations and connectors
- Webhook triggers and complex automation

### 3. Hybrid Workflows
- Best of both worlds
- Fallback mechanisms
- Seamless switching between engines

## Available Templates

The system automatically registers these n8n workflow templates:

### Daily Account Health Check
- **Trigger**: Daily at 9 AM
- **Actions**: 
  - Collect account data via Klavis MCP
  - Analyze email and meeting patterns
  - Generate health score
  - Distribute via email and Slack

### Weekly Executive Report
- **Trigger**: Monday at 9 AM
- **Actions**:
  - Comprehensive account analysis
  - Multi-account comparison
  - Executive summary generation
  - PDF report distribution

### Risk Alert Workflow
- **Trigger**: Webhook/API call
- **Actions**:
  - Immediate risk assessment
  - Urgent notifications
  - Escalation procedures

## Klavis MCP Integration

### Available Functions in n8n

```javascript
// Get account emails
const emails = await global.getAccountEmails('stripe');

// Get calendar data
const calendar = await global.getAccountCalendar('stripe');

// Get documents
const documents = await global.getAccountDocuments('stripe');

// Execute specific Klavis tool
const result = await global.executeKlavisTool('search_messages', {
  query: 'stripe',
  maxResults: 10
}, 'GMAIL');
```

### Klavis-Powered n8n Nodes

The system provides pre-built n8n nodes:

1. **Klavis Account Data Collection**
   - Aggregates email, calendar, and document data
   - Provides unified account view

2. **Klavis Email Analysis**
   - Analyzes communication patterns
   - Extracts key contacts and sentiment

3. **Klavis Meeting Insights**
   - Meeting frequency analysis
   - Stakeholder identification
   - Engagement scoring

## API Endpoints

### Create n8n Workflow
```bash
POST /workflows
{
  "name": "Custom Account Workflow",
  "engine": "n8n",
  "trigger": { "type": "schedule", "schedule": "0 9 * * 1" },
  "accounts": [{ "accountName": "stripe" }],
  "distributors": [
    { "type": "email", "config": { "to": "team@company.com" } }
  ]
}
```

### Execute Workflow
```bash
POST /workflows/{workflowId}/execute
{
  "context": {
    "trigger": "manual",
    "accountName": "stripe"
  }
}
```

### Sync with n8n
```bash
POST /workflows/sync-n8n
# Synchronizes local workflows with n8n instance
```

## Troubleshooting

### Common Issues

1. **n8n Connection Failed**
   - Check if n8n is running on correct port
   - Verify API key is correct
   - Check firewall settings

2. **Klavis Tools Not Available**
   - Ensure Klavis API key is valid
   - Check MCP server initialization
   - Verify OAuth permissions for services

3. **Workflow Execution Timeout**
   - Increase `N8N_EXECUTION_TIMEOUT`
   - Check AI service response times
   - Monitor resource usage

### Debug Mode

```bash
# Start with debug logging
LOG_LEVEL=debug npm run workflow

# Check n8n execution logs
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  http://localhost:5678/api/v1/executions
```

## Examples

### Create Klavis-Integrated Workflow

```javascript
// In your application code
const workflow = await orchestrator.createKlavisN8nWorkflow({
  name: 'Advanced Account Analysis',
  description: 'Deep analysis using Klavis MCP tools',
  trigger: { type: 'manual' },
  accounts: [{ accountName: 'stripe' }],
  distributors: [
    { type: 'email', config: { to: 'analysis@company.com' } },
    { type: 'slack', config: { channel: '#insights' } }
  ]
});
```

### Custom n8n Node Function

```javascript
// In n8n Function node
const accountName = items[0].json.accountName;

// Use Klavis bridge to get comprehensive data
const accountData = await global.klavisBridge.getAccountAssessment(accountName);

// Process with AI
const aiInsights = await global.processWithAI(accountData);

return [{
  json: {
    accountName,
    assessment: accountData,
    insights: aiInsights,
    processedAt: new Date().toISOString()
  }
}];
```

## Production Considerations

1. **Security**
   - Use secure API keys
   - Configure proper CORS settings
   - Enable SSL/TLS in production

2. **Scalability**
   - Monitor n8n resource usage
   - Configure appropriate timeouts
   - Use workflow queuing for high volume

3. **Monitoring**
   - Set up n8n execution monitoring
   - Track workflow success rates
   - Monitor API usage and limits

4. **Backup**
   - Export n8n workflows regularly
   - Backup workflow execution history
   - Document custom nodes and functions

## Next Steps

1. Explore n8n's visual workflow editor
2. Create custom workflows for your use cases
3. Set up monitoring and alerting
4. Integrate with additional services as needed

For more information, see the main documentation in `CLAUDE.md` and the n8n official documentation at https://docs.n8n.io/