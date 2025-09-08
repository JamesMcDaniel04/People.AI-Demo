import Groq from 'groq-sdk';

export class GroqService {
  constructor(config) {
    this.config = config;
    this.client = new Groq({
      apiKey: config.ai.apiKey
    });
    
    // Production AI models - no fallbacks
    this.models = {
      'llama-3.1-8b': 'llama-3.1-8b-instant',
      'llama-3.2': 'llama-3.2-11b-text-preview',
      'qwen-3': 'qwen2.5-72b-instruct',
      'kimi-k2': 'qwen2.5-72b-instruct', // Kimi K2 maps to Qwen2.5-72B
      'gemma': 'gemma2-9b-it'
    };
    
    this.defaultModel = this.models['kimi-k2'];
  }

  async generateCompletion(prompt, model = null, options = {}) {
    const selectedModel = model || this.defaultModel;
    
    try {
      const response = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI assistant specialized in B2B account planning, sales strategy, and business analysis. Provide detailed, actionable insights based on the data provided.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: selectedModel,
        max_tokens: options.max_tokens || 4000,
        temperature: options.temperature || 0.1,
        top_p: options.top_p || 0.9
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error(`Groq API Error (${selectedModel}):`, error.message);
      throw error;
    }
  }

  async analyzeAccountHealth(accountData) {
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

    const response = await this.generateCompletion(prompt, this.models['kimi-k2']);
    
    const parsedResponse = JSON.parse(response);
    if (!parsedResponse || typeof parsedResponse !== 'object') {
      throw new Error('Invalid AI response format for health analysis');
    }
    return parsedResponse;
  }

  async identifyOpportunities(accountData, healthAnalysis) {
    const prompt = `
    Based on the account data and health analysis, identify specific growth opportunities:

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

    Health Analysis:
    ${JSON.stringify(healthAnalysis, null, 2)}

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
    - Supporting evidence from the data

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
        "reasoning": "Why this opportunity exists"
      }
    ]
    `;

    const response = await this.generateCompletion(prompt, this.models['kimi-k2']);
    
    const opportunities = JSON.parse(response);
    if (!Array.isArray(opportunities)) {
      throw new Error('AI response must be an array of opportunities');
    }
    return opportunities;
  }

  async assessRisks(accountData, healthAnalysis, opportunities) {
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

    const response = await this.generateCompletion(prompt, this.models['gemma']);
    
    const risks = JSON.parse(response);
    if (!Array.isArray(risks)) {
      throw new Error('AI response must be an array of risks');
    }
    return risks;
  }

  async generateStrategicRecommendations(accountData, healthAnalysis, opportunities, risks) {
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

    const response = await this.generateCompletion(prompt, this.models['llama-3.1-8b'], {
      max_tokens: 4000,
      temperature: 0.2
    });
    
    const parsedResponse = JSON.parse(response);
    if (!parsedResponse || typeof parsedResponse !== 'object') {
      throw new Error('Invalid AI response format for strategic recommendations');
    }
    return parsedResponse;
  }

  async generateInsights(accountData, analysis) {
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

    const response = await this.generateCompletion(prompt, this.models['mixtral'], {
      temperature: 0.3
    });
    
    const insights = JSON.parse(response);
    if (!Array.isArray(insights)) {
      throw new Error('AI response must be an array of insights');
    }
    return insights;
  }

  getAvailableModels() {
    return Object.keys(this.models);
  }
}