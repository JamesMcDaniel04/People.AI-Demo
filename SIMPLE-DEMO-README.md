# Simple AI Account Planning Demo

A lightweight demo version demonstrating AI-powered account planning with daily coaching workflow. Built following demo engineering principles with hardcoded responses for consistent, reliable demonstrations.

## Overview

This simplified demo illustrates the core concepts from the original project but focuses on **demo engineering** rather than production complexity:

- **Hardcoded responses** that work the same every time
- **No external dependencies** - runs completely offline
- **Realistic sample data** for Stripe GTM scenarios
- **Daily coaching workflow** (the "Slack message" concept)
- **Multi-channel distribution** simulation

## Demo Engineering Philosophy

> *"In the world of demo engineering, the request that I gave you is actually not all that different with the type of work you need. And what matters is that we can illustrate how what it would be like. We don't actually need to build them."*

This demo prioritizes:
1. **Consistent results** - Same output every demo
2. **Quick setup** - No API keys or complex configuration
3. **Compelling story** - Realistic Stripe account scenario
4. **Clear value demonstration** - Shows "how it would work"

## What's Included

### 1. Hardcoded GTM Sample Data
- **Email Communications**: 5 realistic email threads between Stripe sales and TechForward Solutions
- **Call Transcripts**: 3 detailed call transcripts (Discovery, Technical, Executive)
- **Key Personas**: Stripe team members + customer stakeholders
- **Opportunities & Challenges**: Current account state and competitive dynamics

### 2. AI-Powered Analysis (Simulated)
- **Account Health Scoring**: 87/100 with trend analysis
- **Opportunity Identification**: $1.15M-$1.75M pipeline potential
- **Risk Assessment**: Competitive threats and mitigation strategies
- **Strategic Recommendations**: Immediate actions and timelines

### 3. Daily Coaching Workflow
- **Daily coaching messages** (like the Slack example from conversation)
- **Priority action identification**
- **Talk track suggestions**
- **Success metrics tracking**

### 4. Automated Distribution
- **Email delivery** simulation (multiple templates)
- **Slack notifications** (summary, detailed, alert formats)
- **CRM updates** (account updates, task creation)

## Quick Start

```bash
# Run the complete demo
node simple-demo.js

# Show sample data overview
node simple-demo.js data

# Run interactive demo
node simple-demo.js interactive

# Email distribution only
node simple-demo.js run stripe email

# Slack coaching only
node simple-demo.js run stripe slack
```

## Demo Output Example

```
🎯 AI ACCOUNT PLANNER - SIMPLIFIED DEMO
   Daily Coaching Workflow with Hardcoded Responses
================================================================================
📋 Account: STRIPE
📅 Demo Date: 12/16/2024
🔧 Mode: Demo Engineering (Consistent Results)
📊 Data Source: Hardcoded GTM Sample Data
🤖 AI Engine: Simplified (No External API Calls)

🔄 STEP 1: Simulating External Data Integration...
   ✅ Fetched 5 email threads
   ✅ Fetched 3 call transcripts
   ✅ Identified 5 key stakeholders

🧠 STEP 2: Generating AI-Powered Account Plan...
   ✅ Account health analyzed: 87/100
   ✅ Opportunities identified: 3
   ✅ Risks assessed: 3
   ✅ Strategic recommendations: 3

💡 STEP 3: Generating Daily Coaching Message...
📱 DAILY COACHING MESSAGE (Slack/Email):
────────────────────────────────────────────────────────
🎯 **Daily Account Coaching - Stripe (TechForward Solutions)**

🚨 PRIORITY ACTIONS (Next 48 hours):
1. Schedule European Expansion Call - TechForward CFO is evaluating EU expansion...
2. Prepare Volume Pricing Proposal - Their 40% growth qualifies for enterprise tier...
3. Follow up on Technical Deep-dive - Marcus completed technical review...

💡 KEY INSIGHTS:
• Relationship Health: 87/100 (↗️ Improving)
• Expansion Pipeline: $1.15M-$1.75M ARR potential
• Champion Strength: High (David Thompson + Emma Davis)
• Risk Level: Medium (Adyen competitive threat)
────────────────────────────────────────────────────────

📤 STEP 4: Automated Workflow Distribution...
📧 EMAIL SENT:
   To: demo@example.com
   Subject: [DEMO] Daily Account Coaching - Stripe
   Status: ✅ Delivered

💬 SLACK MESSAGE POSTED:
   Channels: #demo-coaching
   Format: summary
   Status: ✅ Posted

🔄 CRM UPDATED:
   Account: Stripe
   Actions: updateAccount
   Status: ✅ Updated

✅ DEMO EXECUTION COMPLETED
================================================================================
⏱️  Total Execution Time: 2.85 seconds
📋 Account Analyzed: Stripe (TechForward Solutions)
🏥 Health Score: 87/100
💰 Pipeline Value: $1.15M-$1.75M ARR
⚠️  Risk Level: Low-Medium
```

## Key Features Demonstrated

### 1. External Data Integration (Simulated)
- **MCP-like functionality** without actual integrations
- **Data aggregation** from multiple sources
- **Real-time processing** simulation

### 2. AI-Powered Analysis
- **Multi-model approach** (simulated Claude 3.5 + GPT-4o)
- **Comprehensive account insights**
- **Strategic recommendations**

### 3. Daily Coaching Workflow
- **Consistent coaching messages** (the Slack concept)
- **Priority action identification**
- **Talk track suggestions**

### 4. Workflow Automation
- **Trigger-based execution**
- **Multi-channel distribution**
- **Error handling and validation**

## Demo vs. Production

| Feature | Demo Version | Production Version |
|---------|--------------|-------------------|
| Data Source | Hardcoded GTM data | Live MCP integration (Klavis) |
| AI Processing | Hardcoded responses | Claude 3.5 + GPT-4o APIs |
| Distribution | Simulated delivery | Real email/Slack/CRM |
| Triggers | Manual execution | Schedule/event-based |
| Reliability | 100% consistent | Dependent on external APIs |
| Setup Time | Immediate | Configuration required |

## 30-Minute Presentation Structure

1. **Demo Overview** (5 min)
   - Problem statement and solution approach
   - Demo engineering philosophy

2. **Live Demo Execution** (15 min)
   - Run complete workflow demo
   - Show daily coaching message generation
   - Demonstrate multi-channel distribution

3. **Technical Deep-dive** (7 min)
   - Sample data structure walkthrough
   - Hardcoded response strategy
   - Production differences explanation

4. **Q&A and Discussion** (3 min)
   - Implementation approach
   - Scaling considerations
   - Production roadmap

## Files Overview

- `simple-demo.js` - Main demo orchestrator
- `simple-demo-data.js` - Hardcoded Stripe GTM sample data
- `simple-coaching-engine.js` - AI simulation with hardcoded responses
- `simple-distribution.js` - Email/Slack/CRM distribution simulation
- `SIMPLE-DEMO-README.md` - This documentation

## Requirements Met

### PDF Requirements Compliance:
- ✅ **Realistic GTM Sample Data**: Comprehensive Stripe dataset
- ✅ **External Data Integration**: MCP simulation
- ✅ **AI-Powered Account Plan**: Complete account analysis
- ✅ **Automated Workflow Distribution**: Email, Slack, CRM

### Conversation Requirements Compliance:
- ✅ **Daily coaching workflow** (the Slack message concept)
- ✅ **Hardcoded responses** for consistent demos
- ✅ **Demo engineering approach** over production complexity
- ✅ **30-minute presentation** format
- ✅ **"How it would work"** vs. "making it fully work"

## Next Steps for Production

1. **Real MCP Integration**: Connect to actual Klavis MCP servers
2. **Live AI Models**: Integrate Claude 3.5 Sonnet + GPT-4o APIs
3. **Actual Integrations**: Email (Postmark), Slack, CRM (Salesforce)
4. **Scheduling System**: Cron jobs or event-driven triggers
5. **Configuration Management**: Environment-based settings
6. **Error Handling**: Production-grade retry and fallback logic

---

*Built for demo engineering - consistent, compelling, and quick to demonstrate.*