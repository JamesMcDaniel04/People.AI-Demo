# 🎯 AI Account Planner - Workflow Automation Demo

## Quick Start Commands

Set data source for the demo (no external credentials needed):
```bash
export DATA_SOURCE=sample
```

### 1. Start API Server Only
```bash
npm run workflow
# Server runs on http://localhost:3001
```

### 2. Run Automated Demo (Recommended for 30-min presentation)
```bash
npm run workflow -- --demo
```

### 3. Run Interactive Demo (Custom scenarios)
```bash
npm run workflow -- --interactive
```

## API Endpoints for Live Demo

### Health Check
```bash
curl http://localhost:3001/health
```

### Quick Account Plan Generation
```bash
curl -X POST http://localhost:3001/quick/account-plan \
  -H "Content-Type: application/json" \
  -d '{
    "accountName": "stripe",
    "distributors": [
      {
        "type": "email",
        "config": {
          "recipients": [{"email": "demo@company.com"}],
          "template": "executive",
          "subject": "Strategic Account Plan - Stripe"
        }
      },
      {
        "type": "slack",
        "config": {
          "channels": [{"channel": "#demo"}],
          "format": "detailed"
        }
      }
    ]
  }'
```

### Get Workflow Templates
```bash
curl http://localhost:3001/templates
```

## Demo Scenarios Included

### 1. **Scheduled Health Monitoring**
- **Trigger**: Every 5 minutes (demo speed)
- **Processing**: AI health score analysis
- **Distribution**: Slack summary notifications
- **Purpose**: Show automated monitoring capabilities

### 2. **Executive Report Generation** 
- **Trigger**: Manual execution
- **Processing**: Comprehensive account analysis
- **Distribution**: HTML email with JSON attachment
- **Purpose**: Demonstrate detailed reporting

### 3. **Multi-Channel Risk Alerts**
- **Trigger**: Event-based (health score drop)
- **Processing**: Risk assessment with AI
- **Distribution**: Email + Slack + CRM updates
- **Purpose**: Show integrated alert system

### 4. **Bulk Account Processing**
- **Trigger**: Manual batch execution
- **Processing**: Multiple accounts simultaneously
- **Distribution**: Consolidated reporting
- **Purpose**: Demonstrate scalability

## Key Features Demonstrated

### ✅ AI Integration
- **Claude 3.5 Sonnet**: Health analysis, risk assessment, insights
- **GPT-4o**: Opportunity identification, strategic recommendations
- **Mixed AI Strategy**: Best model for each task type
- **Production-Ready**: Real API keys configured

### ✅ Multi-Channel Distribution
- **Email**: HTML templates with attachments
- **Slack**: Rich block formatting with buttons
- **CRM**: Salesforce/HubSpot integration
- **File Export**: JSON/CSV data exports

### ✅ Production Features
- **Error Handling**: Graceful degradation
- **Logging**: Structured JSON logs
- **Validation**: Input/output verification
- **Security**: Environment-based configuration

### ✅ Customization Options
- **Templates**: Pre-built workflow patterns
- **Scheduling**: Flexible cron expressions
- **Routing**: Conditional distribution logic
- **Formatting**: Multiple output formats

## Environment Setup for Full Demo

Required variables (configure in your `.env` file):
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
KLAVIS_API_KEY=your_klavis_api_key_here
MCP_ENABLED=true
```

Optional for enhanced demo:
```env
SMTP_HOST=smtp.gmail.com
SMTP_USER=demo@company.com
SMTP_PASS=your_app_password
SLACK_BOT_TOKEN=xoxb-your-slack-token
CRM_TYPE=salesforce
CRM_ACCESS_TOKEN=your_crm_token
```

## Demo Flow Recommendation (30 minutes)

### Phase 1: System Overview (5 minutes)
1. Show workflow server startup
2. Display API health check
3. Review available templates
4. Explain architecture briefly

### Phase 2: Quick Account Plan (10 minutes)
1. Execute quick account plan for Stripe
2. Show real-time AI processing
3. Demonstrate multi-channel distribution
4. Review generated content quality

### Phase 3: Automated Workflows (10 minutes)
1. Start automated demo scenario
2. Show scheduled execution
3. Monitor real-time processing
4. Display distribution results

### Phase 4: Interactive Customization (5 minutes)
1. Create custom workflow via API
2. Modify distribution settings
3. Execute with different parameters
4. Show error handling capabilities

## Success Metrics

- ✅ AI models responding correctly
- ✅ Account plans generated with realistic data
- ✅ Multi-channel distribution working
- ✅ Error handling graceful
- ✅ API endpoints responsive
- ✅ Logging comprehensive
- ✅ Demo scenarios complete

## Troubleshooting

### Common Issues:
1. **Port 3001 in use**: Change WORKFLOW_PORT in .env
2. **AI API limits**: Rate limiting handled gracefully
3. **Slack/Email failures**: Falls back to mock mode
4. **Permission errors**: Check file system access

### Debug Mode:
```bash
DEBUG=true npm run workflow -- --demo
```

This system demonstrates a complete production-ready workflow automation platform with AI-powered account planning and intelligent distribution capabilities.
