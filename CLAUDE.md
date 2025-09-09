# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Production-Ready AI Account Planner** - Enterprise-grade AI-powered account planning system with Klavis MCP orchestration, mixed AI models (OpenAI + Anthropic), and comprehensive GTM data integration for strategic account planning demonstrations.

## Production Commands

### Core Commands
- `npm start` - Production mode with environment validation
- `npm run start:prod` - Optimized production mode with memory allocation
- `npm run dev` - Development mode with file watching
- `npm run validate` - Run full validation suite (typecheck, lint, test)
- `npm run deploy` - Production deployment pipeline

### Account Planning Usage
```bash
npm start [account-name]  # Generate plan for specific account
npm start stripe          # Example: Generate plan for Stripe
```

### Environment Setup
**CRITICAL**: Use the production `.env` file with real API keys:
- `OPENAI_API_KEY` - OpenAI API key for GPT models
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude models
- `KLAVIS_API_KEY` - Klavis MCP orchestration key
- `MCP_ENABLED=true` - Required when using MCP data source

## Production Architecture

### AI-First Design
- **Mixed AI Models**: Claude 3.5 Sonnet + GPT‑4o for multi-model analysis
- **Model Assignment**:
  - Health Analysis: Claude 3.5 Sonnet
  - Opportunities: GPT‑4o
  - Risk Assessment: Claude 3.5 Sonnet
  - Strategic Recommendations: GPT‑4o
  - Insights Generation: Claude 3.5 Sonnet

### Data Integration (Production)
- **Primary**: Klavis MCP Provider (`src/data/mcp/klavisProvider.js`)
- **Capabilities**: Gmail, Google Calendar, Google Drive, Slack, Notion
- **Tool Integration**: AI function calling with MCP tools
- **Authentication**: OAuth 2.0 for all services
- **Real-time**: Live data access via Klavis MCP servers

### Key Production Components
- **KlavisProvider**: Enterprise MCP integration with official SDK
- **MixedAIService**: Multi-provider AI with OpenAI and Anthropic
- **ToolIntegrationService**: Function calling coordination layer
- **Logger**: Production logging with file and console output
- **Configuration**: Environment-driven with validation

## Production Configuration

### Required Environment Variables
```env
NODE_ENV=production
DATA_SOURCE=mcp # or sample|external
AI_PROVIDER=mixed
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
KLAVIS_API_KEY=your_klavis_api_key_here
MCP_ENABLED=true
```

### AI Model Configuration
- **Claude 3.5 Sonnet**: Health analysis, risk assessment, insights generation
- **GPT-4o**: Opportunity identification, strategic recommendations
- **Temperature**: 0.1 (production optimized)
- **Max Tokens**: 4000
- **Tool Calling**: Enabled with Klavis MCP integration

### Data Processing (Production)
- **Cache Duration**: 30 minutes (1800000ms)
- **Batch Size**: 50 (optimized for performance)
- **Max Concurrent**: 5 (rate limiting)
- **Timeout**: 30 seconds

## Production Features

### Account Plan Generation
1. **Live Data**: Real email, calendar, CRM, document data via Klavis
2. **AI Analysis**: Multi-model analysis pipeline
3. **Comprehensive Output**: Health scores, opportunities, risks, recommendations
4. **Real-time Processing**: No cached or dummy responses

### Error Handling
- **Graceful Shutdown**: SIGINT handling
- **Unhandled Rejection**: Process termination with logging
- **Validation**: Environment and API key verification
- **Production Logging**: JSON structured logs with file output

## Production Monitoring

### Logging
- **File**: `./logs/production.log` (JSON format)
- **Console**: Structured production logs
- **Metrics**: Performance and error tracking
- **Level**: INFO (configurable)

### Health Checks
- Configuration validation on startup
- API connectivity verification  
- MCP provider initialization checks
- Model availability confirmation

## Deployment Requirements

### Prerequisites
- Node.js 18+ with ESM support
- OpenAI and/or Anthropic API keys
- Klavis MCP access credentials (if using MCP)
- Appropriate environment variables configured

### Security
- **No Hardcoded Keys**: All secrets via environment
- **CORS Enabled**: For web dashboard integration
- **Rate Limiting**: Built-in protection
- **Encryption**: Optional data encryption support

## GTM Demo Structure

### Real Data Integration
- **Emails**: Live email thread analysis
- **Calls**: Meeting transcripts and analysis  
- **Stakeholders**: Real relationship mapping
- **Documents**: Contract and proposal analysis
- **Calendar**: Meeting pattern analysis

### AI-Generated Insights
- **Health Scoring**: Multi-factor account health
- **Opportunity Detection**: AI-identified growth areas
- **Risk Assessment**: Predictive risk analysis
- **Strategic Recommendations**: Actionable next steps
- **Executive Summary**: AI-generated highlights

This system is optimized for production demonstrations and enterprise deployment without any mock data or fallback mechanisms.
