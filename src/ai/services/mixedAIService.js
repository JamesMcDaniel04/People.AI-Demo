import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ToolIntegrationService } from './toolIntegrationService.js';

export class MixedAIService {
  constructor(config, klavisProvider = null) {
    this.config = config;
    
    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: config.ai.anthropic.apiKey
    });
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: config.ai.openai.apiKey
    });
    
    this.models = config.ai.models;
    
    // Initialize tool integration if Klavis provider is available
    if (klavisProvider) {
      this.toolIntegration = new ToolIntegrationService(klavisProvider);
      this.toolsEnabled = true;
    } else {
      this.toolsEnabled = false;
    }
  }

  async generateCompletion(prompt, modelName, options = {}) {
    if (process.env.SIMULATE_AI_401 === 'true') {
      throw new Error('Simulated AI 401: primary provider auth failed');
    }
    const isClaudeModel = modelName && modelName.startsWith('claude');
    const primary = isClaudeModel ? 'anthropic' : 'openai';
    const secondary = isClaudeModel ? 'openai' : 'anthropic';

    try {
      return isClaudeModel
        ? await this.generateClaudeCompletion(prompt, modelName, options)
        : await this.generateOpenAICompletion(prompt, modelName, options);
    } catch (error) {
      console.warn(`Primary provider failed (${primary}:${modelName}). Falling back to ${secondary}.`, error.message);
      try {
        if (isClaudeModel) {
          const fallbackModel = this.models.opportunities || 'gpt-4o';
          return await this.generateOpenAICompletion(prompt, fallbackModel, options);
        } else {
          const fallbackModel = this.models.health || 'claude-3-5-sonnet-20241022';
          return await this.generateClaudeCompletion(prompt, fallbackModel, options);
        }
      } catch (e2) {
        console.error('AI fallback failed:', e2.message);
        throw error; // surface original
      }
    }
  }

  // Enhanced completion with tool calling support
  async generateCompletionWithTools(prompt, modelName, options = {}) {
    if (process.env.SIMULATE_AI_401 === 'true') {
      throw new Error('Simulated AI 401: primary provider auth failed');
    }
    const isClaudeModel = modelName && modelName.startsWith('claude');

    if (!this.toolsEnabled) {
      console.warn('Tools not available, falling back to standard completion');
      return await this.generateCompletion(prompt, modelName, options);
    }

    try {
      return isClaudeModel
        ? await this.generateClaudeCompletionWithTools(prompt, modelName, options)
        : await this.generateOpenAICompletionWithTools(prompt, modelName, options);
    } catch (error) {
      console.warn(`Primary tool-call failed (${isClaudeModel ? 'anthropic' : 'openai'}:${modelName}). Trying cross-provider.`);
      try {
        if (isClaudeModel) {
          const fallbackModel = this.models.opportunities || 'gpt-4o';
          return await this.generateOpenAICompletionWithTools(prompt, fallbackModel, options);
        } else {
          const fallbackModel = this.models.health || 'claude-3-5-sonnet-20241022';
          return await this.generateClaudeCompletionWithTools(prompt, fallbackModel, options);
        }
      } catch (e2) {
        console.warn('Cross-provider tool-call failed. Falling back to standard completion.');
        return await this.generateCompletion(prompt, modelName, options);
      }
    }
  }

  async generateClaudeCompletion(prompt, model, options = {}) {
    const systemMessage = options.systemOverride || this.config?.ai?.systemPrompt || 'You are an expert AI assistant specialized in B2B account planning, sales strategy, and business analysis. Provide detailed, actionable insights based on the data provided. Always respond with valid JSON when requested.';
    
    const response = await this.anthropic.messages.create({
      model: model,
      max_tokens: options.max_tokens || this.config.ai.maxTokens,
      temperature: options.temperature || this.config.ai.temperature,
      system: systemMessage,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return response.content[0].text;
  }

  async generateOpenAICompletion(prompt, model, options = {}) {
    const response = await this.openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: options.systemOverride || this.config?.ai?.systemPrompt || 'You are an expert AI assistant specialized in B2B account planning, sales strategy, and business analysis. Provide detailed, actionable insights based on the data provided. Always respond with valid JSON when requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.max_tokens || this.config.ai.maxTokens,
      temperature: options.temperature || this.config.ai.temperature,
      top_p: options.top_p || 0.9
    });

    return response.choices[0].message.content;
  }

  // OpenAI completion with tool calling
  async generateOpenAICompletionWithTools(prompt, model, options = {}) {
    const tools = await this.toolIntegration.getOpenAITools();
    
    const messages = [
      {
        role: 'system',
        content: options.systemOverride || this.config?.ai?.toolSystemPrompt || 'You are an expert AI assistant specialized in B2B account planning, sales strategy, and business analysis. You have access to various tools for accessing email, calendar, documents, and other data sources. Use these tools when relevant to provide comprehensive insights.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    let response = await this.openai.chat.completions.create({
      model: model,
      messages: messages,
      tools: tools.map(tool => ({ type: 'function', function: tool.function })),
      tool_choice: 'auto',
      max_tokens: options.max_tokens || this.config.ai.maxTokens,
      temperature: options.temperature || this.config.ai.temperature,
      top_p: options.top_p || 0.9
    });

    let finalResponse = response.choices[0].message;
    
    // Handle tool calls if present
    if (finalResponse.tool_calls && finalResponse.tool_calls.length > 0) {
      messages.push(finalResponse);
      
      // Execute tool calls
      const toolResults = await this.toolIntegration.executeToolCalls(finalResponse.tool_calls, 'openai');
      messages.push(...toolResults);
      
      // Get final response with tool results
      const finalCompletion = await this.openai.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: options.max_tokens || this.config.ai.maxTokens,
        temperature: options.temperature || this.config.ai.temperature
      });
      
      finalResponse = finalCompletion.choices[0].message;
    }

    return finalResponse.content;
  }

  // Claude completion with tool calling
  async generateClaudeCompletionWithTools(prompt, model, options = {}) {
    const tools = await this.toolIntegration.getClaudeTools();
    
    const systemMessage = options.systemOverride || this.config?.ai?.toolSystemPrompt || 'You are an expert AI assistant specialized in B2B account planning, sales strategy, and business analysis. You have access to various tools for accessing email, calendar, documents, and other data sources. Use these tools when relevant to provide comprehensive insights.';

    let response = await this.anthropic.messages.create({
      model: model,
      max_tokens: options.max_tokens || this.config.ai.maxTokens,
      temperature: options.temperature || this.config.ai.temperature,
      system: systemMessage,
      tools: tools,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Handle tool use if present
    while (response.content.some(block => block.type === 'tool_use')) {
      const toolUses = response.content.filter(block => block.type === 'tool_use');
      
      // Execute tool calls
      const toolResults = await this.toolIntegration.executeToolCalls(toolUses, 'claude');
      
      // Continue conversation with tool results
      const messages = [
        {
          role: 'user',
          content: prompt
        },
        {
          role: 'assistant',
          content: response.content
        },
        {
          role: 'user',
          content: toolResults
        }
      ];

      response = await this.anthropic.messages.create({
        model: model,
        max_tokens: options.max_tokens || this.config.ai.maxTokens,
        temperature: options.temperature || this.config.ai.temperature,
        system: systemMessage,
        tools: tools,
        messages: messages
      });
    }

    // Extract text content from response
    const textBlocks = response.content.filter(block => block.type === 'text');
    return textBlocks.map(block => block.text).join('\n');
  }

  async analyzeAccountHealth(accountData, graphRAGResults = null) {
    const graphragContext = this._summarizeGraphRAGForPrompt(graphRAGResults, {
      includeSummary: true,
      categories: ['relationship_health', 'stakeholder_influence', 'communication_patterns', 'risk_indicators'],
      maxPerCategory: 5
    });

    const prompt = `
    Analyze the account health based on the following data and provide a comprehensive assessment:

    Account Information:
    ${JSON.stringify(accountData.basic?.data || {}, null, 2)}

    Financial Data:
    ${JSON.stringify(accountData.financial?.[0]?.data || {}, null, 2)}

    Recent Interactions (last 10):
    ${JSON.stringify(accountData.interactions?.[0]?.data?.slice(0, 10) || [], null, 2)}

    Stakeholder Information:
    ${JSON.stringify(accountData.stakeholders?.[0]?.data || [], null, 2)}

    External Signals (News/Market):
    ${JSON.stringify(accountData.external?.[0]?.data || {}, null, 2)}

    GraphRAG Relationship Intelligence:
    ${graphragContext}

    Please provide:
    1. Overall health score (0-100) with detailed reasoning
    2. Key strengths and weaknesses
    3. Critical success factors
    4. Health trend analysis
    5. Specific recommendations to improve account health

    Format your response as a structured JSON with the following schema:
    {
      "overallScore": number,
      "healthStatus": "excellent|good|at_risk|critical",
      "factors": {
        "financial": number,
        "engagement": number,
        "growth": number,
        "satisfaction": number
      },
      "strengths": ["strength1", "strength2", ...],
      "weaknesses": ["weakness1", "weakness2", ...],
      "criticalFactors": ["factor1", "factor2", ...],
      "trend": "improving|stable|declining",
      "recommendations": ["rec1", "rec2", ...]
    }
    `;

    const useTools = this.toolsEnabled && (this.config.data?.source === 'mcp');
    try {
      const response = useTools
        ? await this.generateCompletionWithTools(prompt, this.models.health)
        : await this.generateCompletion(prompt, this.models.health);
      const parsedResponse = JSON.parse(response);
      if (!parsedResponse || typeof parsedResponse !== 'object') throw new Error('Invalid AI response format for health analysis');
      return parsedResponse;
    } catch (err) {
      console.warn('Health analysis using fallback due to AI error:', err.message);
      const fallback = {
        overallScore: 75,
        healthStatus: 'good',
        factors: { financial: 80, engagement: 75, growth: 70, satisfaction: 75 },
        strengths: ['Strong financial performance', 'Active engagement'],
        weaknesses: ['Growth opportunities exist'],
        criticalFactors: ['Maintain engagement', 'Explore expansion'],
        trend: 'stable',
        recommendations: ['Continue current strategy', 'Explore new opportunities']
      };

      if (graphRAGResults?.insights?.relationship_health?.length) {
        const avgConfidence = this._averageConfidence(graphRAGResults.insights.relationship_health);
        if (!Number.isNaN(avgConfidence)) {
          const modifier = (avgConfidence - 0.5) * 20;
          fallback.overallScore = Math.max(0, Math.min(100, Math.round(fallback.overallScore + modifier)));
          fallback.healthStatus = fallback.overallScore >= 85 ? 'excellent' : (fallback.overallScore >= 70 ? 'good' : fallback.healthStatus);
          fallback.trend = avgConfidence >= 0.65 ? 'improving' : fallback.trend;
        }

        fallback.strengths = [...new Set([
          ...(fallback.strengths || []),
          'GraphRAG indicates resilient relationship clusters'
        ])];

        const topInsight = graphRAGResults.insights.relationship_health[0];
        if (topInsight?.summary) {
          fallback.recommendations.push(`Capitalize on relationship insight: ${topInsight.summary}`);
        }
      }

      if (graphRAGResults?.insights?.risk_indicators?.length) {
        fallback.weaknesses = [...new Set([
          ...(fallback.weaknesses || []),
          'Graph analytics surfaced relationship risks'
        ])];
        fallback.recommendations.push('Initiate mitigation plan for GraphRAG risk indicators');
      }

      if (graphRAGResults?.summary) {
        fallback.recommendations.push(`Incorporate GraphRAG findings: ${graphRAGResults.summary}`);
      }

      return fallback;
    }
  }

  async identifyOpportunities(accountData, healthAnalysis, graphRAGResults = null) {
    const graphragContext = this._summarizeGraphRAGForPrompt(graphRAGResults, {
      includeSummary: true,
      categories: ['opportunities', 'stakeholder_influence', 'communication_patterns'],
      maxPerCategory: 5
    });

    const prompt = `
    Based on the account data, health analysis, and graph intelligence, identify specific growth opportunities:

    Account Data:
    ${JSON.stringify(accountData.basic?.data || {}, null, 2)}

    Financial Information:
    ${JSON.stringify(accountData.financial?.[0]?.data || {}, null, 2)}

    Email Communications:
    ${JSON.stringify(accountData.emails?.[0]?.data || [], null, 2)}

    Call Transcripts:
    ${JSON.stringify(accountData.calls?.[0]?.data || [], null, 2)}

    Stakeholder Map:
    ${JSON.stringify(accountData.stakeholders?.[0]?.data || [], null, 2)}

    External Signals (News/Market):
    ${JSON.stringify(accountData.external?.[0]?.data || {}, null, 2)}

    Health Analysis:
    ${JSON.stringify(healthAnalysis, null, 2)}

    GraphRAG Insights:
    ${graphragContext}

    Identify specific opportunities for:
    1. Account expansion (new products/services)
    2. Upselling (upgrading existing services)
    3. Cross-selling (additional complementary services)
    4. Geographic expansion
    5. Strategic partnerships

    For each opportunity, provide:
    - Type and description
    - Estimated value (USD)
    - Confidence level (0-1)
    - Timeline for realization
    - Key requirements for success
    - Supporting evidence from the combined tabular + graph data

    Return as JSON array with this schema:
    [
      {
        "type": "expansion|upsell|cross_sell|geographic|partnership",
        "title": "Opportunity title",
        "description": "Detailed description",
        "value": number,
        "confidence": number,
        "timeline": "Q1 2025|Q2 2025|etc",
        "priority": "high|medium|low",
        "requirements": ["req1", "req2", ...],
        "evidence": ["evidence1", "evidence2", ...],
        "reasoning": "Why this opportunity exists",
        "graphSignals": ["GraphRAG evidence identifiers"]
      }
    ]
    `;

    const useTools = this.toolsEnabled && (this.config.data?.source === 'mcp');
    try {
      const response = useTools
        ? await this.generateCompletionWithTools(prompt, this.models.opportunities)
        : await this.generateCompletion(prompt, this.models.opportunities);
      const opportunities = JSON.parse(response);
      if (!Array.isArray(opportunities)) throw new Error('AI response must be an array of opportunities');
      return opportunities;
    } catch (err) {
      console.warn('Opportunities using fallback due to AI error:', err.message);

      if (graphRAGResults?.insights?.opportunities?.length) {
        return graphRAGResults.insights.opportunities.map((insight, index) => ({
          type: insight.category || 'graph_opportunity',
          title: insight.title || insight.summary || `GraphRAG Opportunity ${index + 1}`,
          description: insight.detail || insight.summary || 'Opportunity surfaced by relationship analysis',
          value: insight.estimated_value || insight.value || 0,
          confidence: this._normalizeConfidence(insight.confidence, 0.6),
          timeline: insight.timeline || 'Next 2 quarters',
          priority: (insight.priority || '').toLowerCase() || (this._normalizeConfidence(insight.confidence, 0.6) >= 0.7 ? 'high' : 'medium'),
          requirements: Array.isArray(insight.recommendations) ? insight.recommendations : [],
          evidence: insight.evidence || [],
          reasoning: insight.summary || 'Identified via GraphRAG analytics',
          graphSignals: insight.graph_signals || []
        }));
      }

      return [
        {
          type: 'expansion',
          title: 'Product Line Expansion',
          description: 'Opportunity to introduce additional products',
          value: 250000,
          confidence: 0.7,
          timeline: 'Q2 2025',
          priority: 'high',
          requirements: ['Product readiness', 'Client approval'],
          evidence: ['Strong current performance'],
          reasoning: 'Account shows growth potential',
          graphSignals: []
        }
      ];
    }
  }

  async assessRisks(accountData, healthAnalysis, opportunities, graphRAGResults = null) {
    const graphragContext = this._summarizeGraphRAGForPrompt(graphRAGResults, {
      includeSummary: true,
      categories: ['risk_indicators', 'stakeholder_influence', 'communication_patterns'],
      maxPerCategory: 5
    });

    const prompt = `
    Conduct a comprehensive risk assessment for this account:

    Account Overview:
    ${JSON.stringify(accountData.basic?.data || {}, null, 2)}

    Financial Status:
    ${JSON.stringify(accountData.financial?.[0]?.data || {}, null, 2)}

    Recent Interactions:
    ${JSON.stringify(accountData.interactions?.[0]?.data?.slice(0, 5) || [], null, 2)}

    Stakeholder Dynamics:
    ${JSON.stringify(accountData.stakeholders?.[0]?.data || [], null, 2)}

    Health Analysis:
    ${JSON.stringify(healthAnalysis, null, 2)}

    Identified Opportunities:
    ${JSON.stringify(opportunities, null, 2)}

    External Signals (News/Market):
    ${JSON.stringify(accountData.external?.[0]?.data || {}, null, 2)}

    GraphRAG Risk & Relationship Signals:
    ${graphragContext}

    Identify and assess risks in these categories:
    1. Churn risk (likelihood of losing the account)
    2. Contract renewal risk
    3. Competitive threats
    4. Stakeholder risks (key person dependency, relationship gaps)
    5. Financial risks (payment issues, budget cuts)
    6. Operational risks (service delivery, technical issues)
    7. Market risks (industry changes, regulatory)

    For each risk, provide:
    - Risk type and description
    - Probability (0-1) and impact level
    - Early warning indicators
    - Mitigation strategies
    - Monitoring requirements

    Return as JSON array:
    [
      {
        "type": "churn|renewal|competitive|stakeholder|financial|operational|market",
        "title": "Risk title",
        "description": "Detailed risk description",
        "probability": number,
        "impact": "high|medium|low",
        "level": "high|medium|low|critical",
        "indicators": ["indicator1", "indicator2", ...],
        "mitigation": ["strategy1", "strategy2", ...],
        "monitoring": ["monitor1", "monitor2", ...],
        "timeline": "When risk might materialize"
      }
    ]
    `;

    try {
      const response = await this.generateCompletion(prompt, this.models.risks);
      const risks = JSON.parse(response);
      if (!Array.isArray(risks)) throw new Error('AI response must be an array of risks');
      return risks;
    } catch (err) {
      console.warn('Risks using fallback due to AI error:', err.message);
      if (graphRAGResults?.insights?.risk_indicators?.length) {
        return graphRAGResults.insights.risk_indicators.map((insight, index) => {
          const confidence = this._normalizeConfidence(insight.confidence, 0.5);
          return {
            type: insight.category || 'graph_risk',
            title: insight.title || insight.summary || `GraphRAG Risk ${index + 1}`,
            description: insight.detail || insight.summary || 'Risk surfaced by graph analysis',
            probability: confidence,
            impact: insight.impact || this._impactFromSeverity(insight.severity),
            level: (insight.severity || '').toLowerCase() || this._severityFromConfidence(confidence),
            indicators: insight.indicators || insight.signals || [],
            mitigation: Array.isArray(insight.recommendations) ? insight.recommendations : (insight.mitigation ? [insight.mitigation] : []),
            monitoring: insight.monitoring || ['Monitor stakeholder engagement'],
            timeline: insight.timeline || 'Next 2 quarters'
          };
        });
      }

      return [
        {
          type: 'competitive',
          title: 'Competitive Pressure',
          description: 'Potential competitive threats in the market',
          probability: 0.3,
          impact: 'medium',
          level: 'medium',
          indicators: ['Price sensitivity', 'Competitor activity'],
          mitigation: ['Value demonstration', 'Relationship strengthening'],
          monitoring: ['Regular check-ins', 'Market analysis'],
          timeline: 'Q3 2025'
        }
      ];
    }
  }

  async generateStrategicRecommendations(accountData, healthAnalysis, opportunities, risks, graphRAGResults = null) {
    const graphragContext = this._summarizeGraphRAGForPrompt(graphRAGResults, {
      includeSummary: true,
      categories: ['opportunities', 'risk_indicators', 'relationship_health'],
      maxPerCategory: 5
    });

    const prompt = `
    Generate comprehensive strategic recommendations for this account:

    Account Context:
    ${JSON.stringify(accountData.basic?.data || {}, null, 2)}

    Health Analysis Summary:
    - Score: ${healthAnalysis.overallScore}/100
    - Status: ${healthAnalysis.healthStatus}
    - Trend: ${healthAnalysis.trend}
    - Key Strengths: ${healthAnalysis.strengths?.join(', ') || 'N/A'}
    - Key Weaknesses: ${healthAnalysis.weaknesses?.join(', ') || 'N/A'}

    Top Opportunities:
    ${opportunities.slice(0, 3).map(opp => 
      `- ${opp.title}: $${opp.value?.toLocaleString()} (${Math.round((opp.confidence || 0.5) * 100)}% confidence)`
    ).join('\n')}

    Critical Risks:
    ${risks.filter(risk => risk.level === 'high' || risk.level === 'critical').map(risk =>
      `- ${risk.title}: ${risk.probability ? Math.round(risk.probability * 100) : 30}% probability, ${risk.impact} impact`
    ).join('\n')}

    GraphRAG Insights:
    ${graphragContext}

    Provide strategic recommendations organized by timeline:

    IMMEDIATE (Next 30 days):
    - High-priority actions to address critical risks
    - Quick wins to strengthen relationship
    - Urgent opportunity pursuit actions

    SHORT-TERM (30-90 days):
    - Stakeholder engagement initiatives
    - Value demonstration activities
    - Competitive positioning actions

    LONG-TERM (3-12 months):
    - Strategic partnership development
    - Innovation collaboration opportunities  
    - Account transformation initiatives

    For each recommendation, include:
    - Specific action
    - Rationale/business case
    - Expected outcome
    - Resource requirements
    - Success metrics

    Return as structured JSON:
    {
      "immediate": [
        {
          "action": "Specific action to take",
          "rationale": "Why this is important",
          "outcome": "Expected result",
          "resources": ["resource1", "resource2"],
          "owner": "Who should execute",
          "timeline": "Specific timeframe",
          "metrics": ["success metric1", "metric2"]
        }
      ],
      "shortTerm": [...],
      "longTerm": [...],
      "executiveSummary": "High-level strategic direction",
      "keyPriorities": ["priority1", "priority2", "priority3"]
    }
    `;

    const useTools = this.toolsEnabled && (this.config.data?.source === 'mcp');
    try {
      const response = useTools
        ? await this.generateCompletionWithTools(prompt, this.models.recommendations, { max_tokens: 4000, temperature: 0.2 })
        : await this.generateCompletion(prompt, this.models.recommendations, { max_tokens: 4000, temperature: 0.2 });
      const parsedResponse = JSON.parse(response);
      if (!parsedResponse || typeof parsedResponse !== 'object') throw new Error('Invalid AI response format for strategic recommendations');
      return parsedResponse;
    } catch (err) {
      console.warn('Recommendations using fallback due to AI error:', err.message);
      const fallback = {
        immediate: [
          {
            action: 'Schedule quarterly business review',
            rationale: 'Strengthen relationship and identify opportunities',
            outcome: 'Improved client satisfaction and visibility',
            resources: ['Account manager', 'Technical team'],
            owner: 'Account Manager',
            timeline: 'Next 30 days',
            metrics: ['Meeting completion', 'Client feedback score'],
            source: 'ai_fallback'
          }
        ],
        shortTerm: [],
        longTerm: [],
        executiveSummary: 'Focus on relationship strengthening and value demonstration',
        keyPriorities: ['Maintain engagement', 'Explore opportunities', 'Mitigate risks']
      };

      if (graphRAGResults) {
        const graphActions = this._graphRAGFallbackRecommendations(graphRAGResults);
        fallback.immediate.push(...graphActions.immediate);
        fallback.shortTerm.push(...graphActions.shortTerm);
        fallback.longTerm.push(...graphActions.longTerm);
        fallback.keyPriorities = [...new Set([...fallback.keyPriorities, ...graphActions.keyPriorities])];
        if (graphRAGResults.summary) {
          fallback.executiveSummary = `${fallback.executiveSummary}. GraphRAG: ${graphRAGResults.summary}`;
        }
      }

      return fallback;
    }
  }

  async generateInsights(accountData, analysis, graphRAGResults = null) {
    const graphragContext = this._summarizeGraphRAGForPrompt(graphRAGResults, {
      includeSummary: true,
      maxPerCategory: 4
    });

    const prompt = `
    Generate key insights and actionable intelligence from this account analysis:

    Account Summary:
    - Health Score: ${analysis.healthScore?.overallScore || 'N/A'}/100
    - Status: ${analysis.healthScore?.healthStatus || 'unknown'}
    - Opportunities: ${analysis.opportunities?.length || 0} identified
    - Risks: ${analysis.risks?.length || 0} identified

    Email Communications Patterns:
    ${accountData.emails?.[0]?.data?.map(thread => 
      `- ${thread.topic}: ${thread.messages?.length || 0} messages`
    ).join('\n') || 'No email data available'}

    Call Analysis:
    ${accountData.calls?.[0]?.data?.map(call => 
      `- ${call.type}: ${call.participants?.join(', ') || 'Unknown participants'}`
    ).join('\n') || 'No call data available'}

    Stakeholder Engagement:
    ${accountData.stakeholders?.[0]?.data?.map(stakeholder =>
      `- ${stakeholder.name} (${stakeholder.role}): ${stakeholder.sentiment || 'neutral'} sentiment`
    ).join('\n') || 'No stakeholder data available'}

    External Signals (News/Market):
    ${JSON.stringify(accountData.external?.[0]?.data || {}, null, 2)}

    GraphRAG Cross-Source Intelligence:
    ${graphragContext}

    Generate insights about:
    1. Communication patterns and sentiment trends
    2. Stakeholder dynamics and influence mapping
    3. Decision-making processes and buying signals
    4. Competitive positioning and market dynamics
    5. Growth trajectory and expansion readiness
    6. Relationship health and engagement quality

    Return as JSON array of insights:
    [
      {
        "type": "communication|stakeholder|decision|competitive|growth|relationship",
        "title": "Insight title",
        "description": "Detailed insight explanation",
        "priority": "high|medium|low",
        "actionable": true/false,
        "evidence": ["supporting evidence 1", "evidence 2"],
        "implications": ["implication 1", "implication 2"],
        "recommendations": ["recommendation 1", "recommendation 2"]
      }
    ]
    `;

    const useTools = this.toolsEnabled && (this.config.data?.source === 'mcp');
    try {
      const response = useTools
        ? await this.generateCompletionWithTools(prompt, this.models.insights, { temperature: 0.3 })
        : await this.generateCompletion(prompt, this.models.insights, { temperature: 0.3 });
      const insights = JSON.parse(response);
      if (!Array.isArray(insights)) throw new Error('AI response must be an array of insights');
      return insights;
    } catch (err) {
      console.warn('Insights using fallback due to AI error:', err.message);
      const baseInsights = [
        {
          type: 'relationship',
          title: 'Strong Client Relationship',
          description: 'Account shows positive engagement patterns',
          priority: 'medium',
          actionable: true,
          evidence: ['Regular communications', 'Positive feedback'],
          implications: ['Good retention likelihood'],
          recommendations: ['Continue current approach', 'Look for expansion opportunities'],
          source: 'ai_fallback'
        }
      ];

      if (graphRAGResults?.insights) {
        const graphInsights = this._graphRAGInsightsToNarratives(graphRAGResults);
        baseInsights.push(...graphInsights);
      }

      return baseInsights;
    }
  }

  _summarizeGraphRAGForPrompt(graphRAGResults, options = {}) {
    const { includeSummary = false, categories = null, maxPerCategory = 3 } = options;
    if (!graphRAGResults) {
      return 'No GraphRAG insights available.';
    }

    const lines = [];
    if (includeSummary && graphRAGResults.summary) {
      lines.push(`Summary: ${graphRAGResults.summary}`);
    }

    const insightMap = graphRAGResults.insights || {};
    const targetCategories = categories?.length
      ? categories.filter(cat => Array.isArray(insightMap[cat]) && insightMap[cat].length)
      : Object.keys(insightMap).filter(cat => Array.isArray(insightMap[cat]) && insightMap[cat].length);

    targetCategories.forEach(category => {
      const items = insightMap[category].slice(0, maxPerCategory);
      if (items.length === 0) return;
      lines.push(`${category.replace(/_/g, ' ')}:`);
      items.forEach(item => {
        const description = item.summary || item.title || item.detail || 'Insight';
        const confidence = this._formatConfidence(item.confidence);
        const suffix = confidence ? ` (confidence ${confidence})` : '';
        lines.push(`- ${description}${suffix}`);
      });
    });

    if (graphRAGResults.graphData?.graphStats) {
      const stats = graphRAGResults.graphData.graphStats;
      const statParts = [];
      if (typeof stats.total_nodes === 'number') statParts.push(`nodes=${stats.total_nodes}`);
      if (typeof stats.total_relationships === 'number') statParts.push(`relationships=${stats.total_relationships}`);
      if (statParts.length) {
        lines.push(`Graph Stats: ${statParts.join(', ')}`);
      }
    }

    return lines.length ? lines.join('\n') : 'GraphRAG insights available but no matching categories.';
  }

  _graphRAGFallbackRecommendations(graphRAGResults = {}) {
    const buckets = {
      immediate: [],
      shortTerm: [],
      longTerm: [],
      keyPriorities: []
    };

    if (!graphRAGResults?.insights) {
      return buckets;
    }

    const { opportunities = [], risk_indicators = [], relationship_health = [] } = graphRAGResults.insights;

    const addAction = (bucketName, action) => {
      if (!action) return;
      const bucket = buckets[bucketName];
      if (!bucket.find(item => item.action === action.action && item.owner === action.owner)) {
        bucket.push(action);
      }
    };

    opportunities.slice(0, 5).forEach((insight, index) => {
      const priority = (insight.priority || '').toLowerCase();
      const confidence = this._normalizeConfidence(insight.confidence, 0.6);
      const bucket = priority === 'high'
        ? 'immediate'
        : (priority === 'low' ? 'longTerm' : (confidence >= 0.7 ? 'immediate' : 'shortTerm'));

      addAction(bucket, {
        action: insight.title || insight.summary || `Activate GraphRAG opportunity ${index + 1}`,
        rationale: insight.summary || 'GraphRAG surfaced an expansion opportunity',
        outcome: insight.detail || 'Capture quantified value from identified stakeholders',
        resources: insight.recommendations || ['Account team'],
        owner: 'Account Manager',
        timeline: insight.timeline || (bucket === 'immediate' ? 'Next 30 days' : 'Next 90 days'),
        metrics: ['Opportunity advancement'],
        source: 'graphrag'
      });
    });

    risk_indicators.slice(0, 5).forEach((insight, index) => {
      const confidence = this._normalizeConfidence(insight.confidence, 0.5);
      const severity = (insight.severity || '').toLowerCase();
      const bucket = severity === 'critical' || severity === 'high' || confidence >= 0.7 ? 'immediate' : 'shortTerm';
      addAction(bucket, {
        action: insight.title || insight.summary || `Mitigate GraphRAG risk ${index + 1}`,
        rationale: insight.summary || 'Graph relationship analysis surfaced a risk signal',
        outcome: 'Risk mitigated using targeted intervention',
        resources: Array.isArray(insight.recommendations) ? insight.recommendations : ['Risk task force'],
        owner: 'Customer Success Manager',
        timeline: bucket === 'immediate' ? 'Next 14 days' : 'Next 60 days',
        metrics: ['Risk indicator reduction'],
        source: 'graphrag'
      });
      buckets.keyPriorities.push('Stabilize GraphRAG-identified risks');
    });

    relationship_health.slice(0, 3).forEach((insight, index) => {
      const priority = this._normalizeConfidence(insight.confidence, 0.5) >= 0.7 ? 'immediate' : 'shortTerm';
      addAction(priority, {
        action: insight.title || insight.summary || `Reinforce relationship cluster ${index + 1}`,
        rationale: insight.summary || 'GraphRAG highlights pivotal stakeholder relationships',
        outcome: 'Stronger multi-threaded engagement',
        resources: ['Executive sponsor', 'Relationship mapping'],
        owner: 'Executive Sponsor',
        timeline: priority === 'immediate' ? 'Next 30 days' : 'Next 90 days',
        metrics: ['Stakeholder engagement score'],
        source: 'graphrag'
      });
    });

    if (graphRAGResults.summary) {
      buckets.keyPriorities.push(graphRAGResults.summary);
    }

    buckets.keyPriorities = [...new Set(buckets.keyPriorities.filter(Boolean))];
    return buckets;
  }

  _graphRAGInsightsToNarratives(graphRAGResults = {}) {
    const narratives = [];
    if (!graphRAGResults?.insights) {
      return narratives;
    }

    Object.entries(graphRAGResults.insights).forEach(([category, items = []]) => {
      items.slice(0, 4).forEach((insight, index) => {
        const confidence = this._formatConfidence(insight.confidence);
        narratives.push({
          type: category,
          title: insight.title || insight.summary || `${category} insight ${index + 1}`,
          description: insight.detail || insight.summary || 'GraphRAG derived insight',
          priority: confidence && parseInt(confidence, 10) >= 70 ? 'high' : 'medium',
          actionable: true,
          evidence: insight.evidence || [],
          implications: insight.implications || [],
          recommendations: Array.isArray(insight.recommendations) ? insight.recommendations : [],
          source: 'graphrag'
        });
      });
    });

    return narratives;
  }

  _averageConfidence(items = []) {
    const values = items
      .map(item => this._normalizeConfidence(item.confidence, NaN))
      .filter(value => Number.isFinite(value));
    if (values.length === 0) {
      return NaN;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  _normalizeConfidence(value, fallback = 0.5) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(1, value));
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(1, parsed));
    }
    return fallback;
  }

  _formatConfidence(value) {
    const normalized = this._normalizeConfidence(value, NaN);
    if (Number.isFinite(normalized)) {
      return `${Math.round(normalized * 100)}%`;
    }
    return null;
  }

  _impactFromSeverity(severity) {
    if (!severity) return 'medium';
    const value = `${severity}`.toLowerCase();
    if (value.includes('critical') || value.includes('high')) return 'high';
    if (value.includes('low')) return 'low';
    return 'medium';
  }

  _severityFromConfidence(confidence) {
    const value = this._normalizeConfidence(confidence, 0.5);
    if (value >= 0.75) return 'high';
    if (value <= 0.35) return 'low';
    return 'medium';
  }

  getAvailableModels() {
    return Object.keys(this.models);
  }
}
