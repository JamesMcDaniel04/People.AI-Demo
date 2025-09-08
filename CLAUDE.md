# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Production-Ready AI Account Planner** - Enterprise-grade AI-powered account planning system with Klavis MCP orchestration, Groq AI models, and comprehensive GTM data integration for strategic account planning demonstrations.

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
- `GROQ_API_KEY` - Production Groq API key for AI models
- `KLAVIS_API_KEY` - Klavis MCP orchestration key: `zSbY9YysFRHxwfkLiV4y8aEf/oxHdyWS88LnYAMUriU=`
- `MCP_ENABLED=true` - Required for production

## Production Architecture

### AI-First Design
- **Groq AI Models**: Kimi K2, Qwen 3, Llama 3.1 70B for multi-model analysis
- **No Fallbacks**: Production system requires AI availability
- **Model Assignment**:
  - Health Analysis: Kimi K2
  - Opportunities: Kimi K2  
  - Risk Assessment: Gemma2 9B
  - Strategic Recommendations: Kimi K2
  - Insights Generation: Kimi K2

### Data Integration (Production)
- **Primary**: Klavis MCP Provider (`src/data/mcp/klavisProvider.js`)
- **Capabilities**: Email, Calendar, CRM, Documents, Real-time sync
- **No Mock Data**: All data sourced from live Klavis MCP endpoints

### Key Production Components
- **KlavisProvider**: Enterprise MCP integration with full API coverage
- **GroqService**: Multi-model AI service with error handling
- **Logger**: Production logging with file and console output
- **Configuration**: Environment-driven with validation

## Production Configuration

### Required Environment Variables
```env
NODE_ENV=production
GROQ_API_KEY=your_groq_key
KLAVIS_API_KEY=zSbY9YysFRHxwfkLiV4y8aEf/oxHdyWS88LnYAMUriU=
MCP_ENABLED=true
MCP_SERVER_URL=https://api.klavis.com/mcp/v1
AI_ANALYSIS_ENABLED=true
AI_RECOMMENDATIONS_ENABLED=true
```

### AI Model Configuration
- **Kimi K2**: Primary model for health, opportunities, recommendations, insights
- **Gemma2 9B**: Specialized for risk assessment
- **Temperature**: 0.1 (production optimized)
- **Max Tokens**: 4000

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
- Valid Groq API key
- Klavis MCP access credentials
- Production environment variables

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