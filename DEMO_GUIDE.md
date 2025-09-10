# 🚀 AI Account Planner - Demo Guide

## Quick Start Demo

### Option 1: CLI Demo (Recommended)
```bash
# Demo with Stripe account
npm run demo:stripe

# Demo with custom account and email
node demo.js "Acme Retail" "your-email@example.com"

# Show demo help
npm run demo
```

### Option 2: API Demo
```bash
# Start the workflow server
npm run workflow

# Trigger demo via API (in another terminal)
curl -X POST http://localhost:3001/api/demo/Stripe \
  -H "Content-Type: application/json" \
  -d '{"recipients": ["demo@example.com"], "template": "default"}'

# Check demo status
curl http://localhost:3001/api/status
```

### Option 3: Web Interface
```bash
# Start workflow server
npm run workflow

# Open browser to http://localhost:3001
# Use the web interface to trigger demos
```

## What the Demo Shows

### ✅ **Complete Exercise Requirements Coverage**

1. **Realistic GTM Sample Data for Stripe** ✅
   - 13+ email threads with authentic sales scenarios
   - 5+ detailed call transcripts (discovery, technical, executive)
   - Rich stakeholder profiles (AE, SE, CSM + customer personas)

2. **External Data Integration (Klavis MCP)** ✅
   - Live Gmail, Calendar, CRM, Document access
   - Real OAuth 2.0 authentication
   - AI tool calling with live data

3. **AI-Powered Account Plan Generation** ✅
   - Multi-model AI (Claude 3.5 Sonnet + GPT-4o)
   - Account health scoring
   - Opportunity identification
   - Risk assessment
   - Stakeholder mapping
   - Strategic recommendations

4. **Automated Workflow Distribution** ✅
   - Real Postmark email delivery
   - Professional HTML templates
   - JSON account plan attachments
   - Error handling & fallback modes

## Demo Flow (2-3 minutes)

1. **Initialization** (15 seconds)
   - Validates environment configuration
   - Initializes AI services & data integration
   - Confirms email distributor setup

2. **Data Collection** (30 seconds)
   - Loads realistic Stripe GTM data
   - Analyzes email threads & call transcripts
   - Maps stakeholder relationships

3. **AI Analysis** (60-90 seconds)
   - Multi-model AI analysis pipeline
   - Health score calculation
   - Opportunity & risk identification
   - Strategic recommendations generation

4. **Distribution** (15 seconds)
   - Sends formatted account plan email
   - Provides execution summary
   - Shows success metrics

## Sample Accounts Available

- **Stripe** (Primary demo account)
- **Acme Retail** (E-commerce expansion)
- **NorthStar Logistics** (B2B operations)
- **TechForward Solutions** (SaaS integration)
- **GlobalCorp Industries** (Enterprise)

## Configuration Status

### ✅ Production Ready
- **AI Models**: Claude 3.5 Sonnet + GPT-4o
- **Email**: Postmark API configured
- **Data**: Rich sample data + MCP integration
- **Workflow**: Internal engine (n8n disabled)

### 🔧 Environment Variables
```env
NODE_ENV=production
DATA_SOURCE=sample
AI_PROVIDER=mixed
ANTHROPIC_API_KEY=configured ✅
OPENAI_API_KEY=configured ✅
KLAVIS_API_KEY=configured ✅
SMTP_API_KEY=configured ✅
N8N_ENABLED=false
```

## Troubleshooting

### Common Issues

**Email not sending?**
- Check SMTP_API_KEY in .env
- Verify Postmark sender signature
- System falls back to mock mode automatically

**AI analysis slow?**
- Multi-model pipeline takes 60-90 seconds
- Progress shown in real-time logs
- Normal for production-quality analysis

**Missing sample data?**
- Ensure src/data/sample/*.json files exist
- Run `npm run workflow` to verify data loading

### Demo Commands

```bash
# Quick health check
npm run workflow &
curl http://localhost:3001/health

# Validate configuration
npm run validate

# Check integration status
curl http://localhost:3001/integration/status
```

## Architecture Highlights

- **No External Dependencies**: n8n removed for demo simplicity
- **Production Email**: Real Postmark integration
- **Multi-Model AI**: Claude + GPT-4o specialized assignment
- **Live Data**: MCP integration for real-time data access
- **Graceful Fallbacks**: Mock modes for network issues

## Success Metrics

**Demo shows:**
- ✅ Full account plan generation in <3 minutes
- ✅ Professional email delivery with attachments
- ✅ Real AI analysis with specific insights
- ✅ Error handling and status reporting
- ✅ Production-ready system architecture