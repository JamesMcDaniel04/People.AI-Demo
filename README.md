# AI Account Planner

A comprehensive AI-powered account planning system that integrates external data sources to generate strategic account plans, identify opportunities, and assess risks.

## Overview

This system demonstrates integration with external data sources and AI-powered analysis to create comprehensive account plans that include:

- **Account Overview**: Current relationship status and health score
- **Opportunity Analysis**: Identified expansion opportunities
- **Stakeholder Map**: Visual representation of key relationships  
- **Strategic Recommendations**: Next best actions for account teams
- **Risk Assessment**: Potential challenges and mitigation strategies

## Project Structure

```
ai-account-planner/
├── src/
│   ├── data/                    # Data integration layer
│   │   ├── mcp/                # MCP (Model Context Protocol) connectors
│   │   ├── external/           # External API connectors
│   │   └── mock/               # Mock data providers for testing
│   ├── ai/                     # AI analysis and planning
│   │   ├── analysis/           # Data analysis components
│   │   └── planning/           # Account planning logic
│   ├── types/                  # Type definitions and enums
│   ├── config/                 # Configuration management
│   └── utils/                  # Utility functions
├── tests/                      # Test files
├── examples/                   # Example usage
└── docs/                       # Documentation
```

## Features

### Data Integration Options

**Option A: MCP Server Integration**
- Connect to email, calendar, or CRM data via MCP
- Real-time data synchronization
- Secure authentication handling

**Option B: External API Integration** 
- Connect to public APIs (news, financial data)
- Custom data source integration
- Rate limiting and error handling

### AI-Powered Analysis

- **Health Score Calculation**: Multi-factor account health assessment
- **Opportunity Identification**: AI-driven opportunity discovery
- **Risk Assessment**: Automated risk detection and prioritization
- **Stakeholder Mapping**: Relationship analysis and visualization
- **Strategic Recommendations**: Actionable next steps and timelines

## Quick Start

1. **Install dependencies**:
   ```bash
   cd ai-account-planner
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and settings
   ```

3. **Run the application**:
   ```bash
   npm start
   ```

4. **Run in development mode**:
   ```bash
   npm run dev
   ```

## Configuration

The system supports multiple configuration options through environment variables:

- **MCP Integration**: Enable MCP server connections for internal data
- **External APIs**: Configure external data source connections  
- **AI Settings**: Configure AI provider and model parameters
- **Data Processing**: Set cache duration and batch sizes
- **Account Planning**: Customize health score weights and thresholds

See `.env.example` for all available configuration options.

## Example Usage

The system currently includes a complete example for Stripe as a target account, demonstrating:

- Mock data integration (can be replaced with real MCP or API data)
- Comprehensive account health analysis
- Opportunity identification and prioritization
- Risk assessment with mitigation strategies
- Strategic recommendations with timelines
- Stakeholder relationship mapping

## Data Sources

### Mock Data Provider (Default)
- Pre-configured with realistic Stripe account data
- Includes financial metrics, stakeholder information, interaction history
- Perfect for testing and demonstration

### MCP Integration (Configurable)
- Email system integration
- Calendar data access
- CRM system connections
- Document repository access

### External API Integration (Configurable)
- Company news and market data
- Financial information
- Industry trend analysis
- Competitive intelligence

## Account Plan Output

The generated account plan includes:

1. **Executive Summary**: Key highlights and recommendations
2. **Account Overview**: Current status and health metrics
3. **Opportunity Analysis**: Prioritized growth opportunities
4. **Stakeholder Map**: Relationship visualization and risk assessment
5. **Strategic Recommendations**: Immediate, short-term, and long-term actions
6. **Risk Assessment**: Identified risks with mitigation strategies
7. **Action Plan**: Next steps with timelines and success metrics

## Extending the System

### Adding New Data Sources
1. Create a new connector in `src/data/`
2. Implement required methods: `getAccountInfo`, `getInteractionHistory`, etc.
3. Register the connector in `DataIntegrationManager`

### Customizing AI Analysis
1. Modify analysis logic in `src/ai/analysis/dataAnalyzer.js`
2. Adjust recommendation engine in `src/ai/planning/recommendationEngine.js`
3. Update configuration weights and thresholds

### Adding New Account Types
1. Add mock data for new accounts in `src/data/mock/mockDataProvider.js`
2. Customize analysis rules for different industries or company sizes
3. Update opportunity and risk assessment logic

## Development

### Running Tests
```bash
npm test
```

### Development with Live Reload
```bash
npm run dev
```

### Linting and Type Checking
The project uses ESM modules and includes comprehensive error handling. Add linting tools as needed:
```bash
# Add your preferred linting tools
npm install --save-dev eslint
```

## Next Steps

1. **Connect Real Data Sources**: Replace mock data with actual MCP or API integrations
2. **Add AI Service Integration**: Connect to Claude, GPT-4, or other AI services for enhanced analysis
3. **Build Web Interface**: Create a web dashboard for interactive account planning
4. **Add Export Features**: Generate PDF reports, presentations, or CRM integration
5. **Implement Monitoring**: Add real-time account health monitoring and alerts

## License

MIT License - See LICENSE file for details.