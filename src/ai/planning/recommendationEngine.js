import { MixedAIService } from '../services/mixedAIService.js';

export class RecommendationEngine {
  constructor(config, klavisProvider = null) {
    this.config = config;
    this.aiService = new MixedAIService(config, klavisProvider);
  }

  async generateRecommendations(accountData, analysis, graphRAGResults = null) {
    console.log('🤖 AI-powered strategic recommendations...');
    
    const aiRecommendations = await this.aiService.generateStrategicRecommendations(
      accountData, 
      analysis.healthScore, 
      analysis.opportunities, 
      analysis.risks,
      graphRAGResults
    );

    // Production-ready AI recommendations
    const recommendations = {
      immediate: aiRecommendations.immediate,
      shortTerm: aiRecommendations.shortTerm,
      longTerm: aiRecommendations.longTerm,
      resources: await this.identifyResourceRequirements(analysis, graphRAGResults),
      executiveSummary: aiRecommendations.executiveSummary,
      keyPriorities: aiRecommendations.keyPriorities,
      graphRAG: this.summarizeGraphRAGForRecommendations(graphRAGResults)
    };

    const enriched = this.mergeGraphRAGActions(recommendations, graphRAGResults);

    console.log('✅ AI-powered recommendations generated');
    return enriched;
  }

  mergeGraphRAGActions(recommendations, graphRAGResults) {
    if (!graphRAGResults?.insights) {
      return recommendations;
    }

    const merged = {
      ...recommendations,
      immediate: [...(recommendations.immediate || [])],
      shortTerm: [...(recommendations.shortTerm || [])],
      longTerm: [...(recommendations.longTerm || [])],
      keyPriorities: [...(recommendations.keyPriorities || [])],
      graphRAG: recommendations.graphRAG || {}
    };

    const addAction = (bucket, action) => {
      if (!action) return;
      const list = merged[bucket];
      if (!list.find(item => item.action === action.action && item.owner === action.owner)) {
        list.push(action);
      }
    };

    const opportunities = graphRAGResults.insights.opportunities || [];
    opportunities.forEach((insight, index) => {
      const priority = (insight.priority || '').toLowerCase();
      const bucket = priority === 'high'
        ? 'immediate'
        : priority === 'low'
          ? 'longTerm'
          : 'shortTerm';
      const amount = insight.estimated_value || insight.value;
      addAction(bucket, {
        action: `Activate graph opportunity: ${insight.title || insight.summary || `Insight ${index + 1}`}`,
        rationale: insight.summary || 'GraphRAG detected expansion potential across connected stakeholders',
        outcome: insight.detail || 'Validated and progressed graph-sourced opportunity',
        resources: insight.recommendations || ['Opportunity task force'],
        owner: 'Account Manager',
        timeline: insight.timeline || (bucket === 'immediate' ? 'Next 30 days' : 'Next 90 days'),
        metrics: [amount ? `Capture $${Math.round(amount).toLocaleString()} value` : 'Opportunity advancement'],
        source: 'graphrag'
      });
    });

    const risks = graphRAGResults.insights.risk_indicators || [];
    risks.forEach((insight, index) => {
      const severity = (insight.severity || '').toLowerCase();
      const bucket = severity === 'critical' || severity === 'high' ? 'immediate' : 'shortTerm';
      addAction(bucket, {
        action: `Neutralize graph risk: ${insight.title || insight.summary || `Risk ${index + 1}`}`,
        rationale: insight.summary || 'GraphRAG exposed relationship or process risk',
        outcome: 'Risk mitigated through targeted intervention',
        resources: Array.isArray(insight.recommendations) ? insight.recommendations : ['Risk mitigation squad'],
        owner: 'Customer Success Manager',
        timeline: bucket === 'immediate' ? 'Next 21 days' : 'Within 60 days',
        metrics: ['Risk indicator reduction'],
        source: 'graphrag'
      });
      merged.keyPriorities.push('Resolve GraphRAG-identified risks');
    });

    const relationshipHealth = graphRAGResults.insights.relationship_health || [];
    relationshipHealth.forEach((insight, index) => {
      addAction('shortTerm', {
        action: `Leverage relationship cluster: ${insight.title || `Cluster ${index + 1}`}`,
        rationale: insight.summary || 'GraphRAG highlights influential relationship patterns',
        outcome: 'Improved multi-threaded engagement',
        resources: ['Executive sponsor', 'Relationship mapping'],
        owner: 'Executive Sponsor',
        timeline: 'Next 60 days',
        metrics: ['Stakeholder sentiment improvement'],
        source: 'graphrag'
      });
    });

    merged.keyPriorities = [...new Set(merged.keyPriorities)];
    merged.graphRAG = {
      ...(merged.graphRAG || {}),
      actionCount: {
        opportunities: opportunities.length,
        risks: risks.length,
        relationshipHealth: relationshipHealth.length
      }
    };

    return merged;
  }

  summarizeGraphRAGForRecommendations(graphRAGResults) {
    if (!graphRAGResults) {
      return null;
    }

    const insightCounts = Object.fromEntries(
      Object.entries(graphRAGResults.insights || {}).map(([category, items]) => [
        category,
        Array.isArray(items) ? items.length : 0
      ])
    );

    return {
      summary: graphRAGResults.summary || null,
      insightCounts,
      metadata: graphRAGResults.metadata || {},
      graphStats: graphRAGResults.graphData?.graphStats || {}
    };
  }

  async generateImmediateActions(accountData, analysis) {
    const actions = [];

    // High-priority risk mitigation
    const highRisks = analysis.risks?.filter(risk => 
      risk.level === 'high' || risk.level === 'critical'
    ) || [];

    highRisks.forEach(risk => {
      actions.push({
        action: `Address ${risk.type} risk: ${risk.description}`,
        rationale: `High-priority risk with ${risk.probability * 100}% probability`,
        timeline: 'Next 7 days',
        owner: 'Account Manager',
        resources: ['Risk mitigation team', 'Executive support'],
        expectedOutcome: risk.mitigation
      });
    });

    // Contract renewal urgency
    if (accountData.financial?.[0]?.data?.contractEndDate) {
      const daysToExpiry = (new Date(accountData.financial[0].data.contractEndDate) - new Date()) / (1000 * 60 * 60 * 24);
      if (daysToExpiry < 90) {
        actions.push({
          action: 'Initiate contract renewal discussions',
          rationale: `Contract expires in ${Math.round(daysToExpiry)} days`,
          timeline: 'Next 7 days',
          owner: 'Account Manager',
          resources: ['Legal team', 'Contract specialist'],
          expectedOutcome: 'Secure renewal commitment'
        });
      }
    }

    // Re-engage inactive stakeholders
    const stakeholderMap = analysis.stakeholderMap || {};
    const inactiveStakeholders = Object.values(stakeholderMap)
      .flat()
      .filter(stakeholder => stakeholder.riskLevel === 'high');

    if (inactiveStakeholders.length > 0) {
      actions.push({
        action: `Re-engage ${inactiveStakeholders.length} inactive stakeholders`,
        rationale: 'Critical stakeholders haven\'t been contacted recently',
        timeline: 'Next 14 days',
        owner: 'Account Manager',
        resources: ['Relationship mapping', 'Executive outreach'],
        expectedOutcome: 'Restore stakeholder engagement'
      });
    }

    // High-confidence opportunities
    const highConfidenceOpps = analysis.opportunities?.filter(opp => 
      opp.confidence >= 0.7
    ) || [];

    highConfidenceOpps.forEach(opp => {
      actions.push({
        action: `Pursue ${opp.type} opportunity worth $${opp.value.toLocaleString()}`,
        rationale: `High-confidence opportunity (${Math.round(opp.confidence * 100)}%)`,
        timeline: 'Next 30 days',
        owner: 'Account Manager',
        resources: ['Sales engineering', 'Product team'],
        expectedOutcome: `Advance opportunity to next stage`
      });
    });

    return actions.slice(0, 5); // Top 5 immediate actions
  }

  async generateShortTermActions(accountData, analysis) {
    const actions = [];

    // Stakeholder expansion
    const stakeholderMap = analysis.stakeholderMap || {};
    const decisionMakers = stakeholderMap.decisionMakers?.length || 0;
    const technical = stakeholderMap.technical?.length || 0;

    if (decisionMakers < 2) {
      actions.push({
        action: 'Identify and engage additional decision makers',
        rationale: 'Limited decision maker coverage increases risk',
        timeline: '30-60 days',
        owner: 'Account Manager',
        resources: ['Research team', 'LinkedIn Sales Navigator'],
        expectedOutcome: 'Establish relationships with 2+ decision makers'
      });
    }

    if (technical < 2) {
      actions.push({
        action: 'Build technical stakeholder relationships',
        rationale: 'Technical buy-in crucial for expansion opportunities',
        timeline: '45-90 days',
        owner: 'Solutions Engineer',
        resources: ['Technical team', 'Product demonstrations'],
        expectedOutcome: 'Secure technical champion'
      });
    }

    // Value demonstration
    const healthScore = analysis.healthScore?.score || 0;
    if (healthScore < 70) {
      actions.push({
        action: 'Conduct comprehensive business review',
        rationale: `Account health score below optimal (${healthScore}/100)`,
        timeline: '60-90 days',
        owner: 'Customer Success Manager',
        resources: ['Business review template', 'ROI analysis'],
        expectedOutcome: 'Demonstrate clear business value'
      });
    }

    // Medium-confidence opportunities
    const mediumConfidenceOpps = analysis.opportunities?.filter(opp => 
      opp.confidence >= 0.4 && opp.confidence < 0.7
    ) || [];

    mediumConfidenceOpps.forEach(opp => {
      actions.push({
        action: `Qualify ${opp.type} opportunity (${opp.reasoning})`,
        rationale: `Medium-confidence opportunity requiring nurturing`,
        timeline: '60-90 days',
        owner: 'Account Manager',
        resources: ['Discovery sessions', 'Proof of concept'],
        expectedOutcome: 'Increase opportunity confidence to 70%+'
      });
    });

    // Competitive positioning
    const competitiveRisks = analysis.risks?.filter(risk => 
      risk.type === 'competitive'
    ) || [];

    competitiveRisks.forEach(risk => {
      actions.push({
        action: 'Strengthen competitive positioning',
        rationale: risk.description,
        timeline: '30-90 days',
        owner: 'Account Manager',
        resources: ['Competitive intelligence', 'Differentiation messaging'],
        expectedOutcome: 'Improved competitive defense'
      });
    });

    return actions;
  }

  async generateLongTermActions(accountData, analysis) {
    const actions = [];

    // Strategic partnership development
    const financial = accountData.financial?.[0]?.data || {};
    if (financial.currentARR > 1000000) {
      actions.push({
        action: 'Explore strategic partnership opportunities',
        rationale: 'High-value account suitable for strategic alignment',
        timeline: '6-12 months',
        owner: 'VP Sales',
        resources: ['Strategic partnerships team', 'Executive sponsor'],
        expectedOutcome: 'Establish strategic partnership agreement'
      });
    }

    // Market expansion
    const basic = accountData.basic?.data || {};
    if (basic.region && basic.region !== 'Global') {
      actions.push({
        action: 'Identify global expansion opportunities',
        rationale: 'Account has potential for geographic expansion',
        timeline: '9-18 months',
        owner: 'Global Account Manager',
        resources: ['Market research', 'Local partners'],
        expectedOutcome: 'Expand to 2+ new regions'
      });
    }

    // Innovation collaboration
    const highEngagement = Object.values(analysis.stakeholderMap || {})
      .flat()
      .filter(stakeholder => stakeholder.engagement === 'high').length;

    if (highEngagement >= 3) {
      actions.push({
        action: 'Establish innovation partnership program',
        rationale: 'Strong relationships enable co-innovation opportunities',
        timeline: '12-24 months',
        owner: 'Product Partnership Manager',
        resources: ['Product team', 'R&D budget'],
        expectedOutcome: 'Joint product development initiative'
      });
    }

    // Account transformation
    if (financial.growthRate > 0.3) {
      actions.push({
        action: 'Position for enterprise transformation',
        rationale: 'Rapid growth indicates readiness for strategic upgrade',
        timeline: '18-36 months',
        owner: 'Strategic Account Director',
        resources: ['Enterprise solutions team', 'Executive alignment'],
        expectedOutcome: 'Upgrade to strategic enterprise relationship'
      });
    }

    return actions;
  }

  async identifyResourceRequirements(analysis, graphRAGResults = null) {
    const resources = {
      personnel: [],
      tools: [],
      budget: [],
      timeline: []
    };

    // Personnel requirements based on opportunities
    const totalOpportunityValue = this.calculateTotalOpportunityValue(analysis.opportunities);
    
    if (totalOpportunityValue > 500000) {
      this._pushUnique(resources.personnel, 'Dedicated account manager');
      this._pushUnique(resources.personnel, 'Solutions engineer');
    }

    if (totalOpportunityValue > 1000000) {
      this._pushUnique(resources.personnel, 'Customer success manager');
      this._pushUnique(resources.personnel, 'Executive sponsor');
    }

    // Tools and systems
    this._pushUnique(resources.tools, 'CRM system updates');
    this._pushUnique(resources.tools, 'Account planning platform');
    
    const stakeholderCount = Object.values(analysis.stakeholderMap || {})
      .reduce((total, stakeholders) => total + stakeholders.length, 0);
    
    if (stakeholderCount > 10) {
      this._pushUnique(resources.tools, 'Relationship mapping tool');
    }

    // Budget considerations
    const highValueOpportunities = analysis.opportunities?.filter(opp => 
      opp.value > 250000
    ).length || 0;

    if (highValueOpportunities > 0) {
      this._pushUnique(resources.budget, 'Proof of concept funding');
      this._pushUnique(resources.budget, 'Executive event budget');
    }

    // Timeline resources
    this._pushUnique(resources.timeline, 'Quarterly business reviews');
    this._pushUnique(resources.timeline, 'Monthly stakeholder touchpoints');
    
    const highRisks = analysis.risks?.filter(risk => 
      risk.level === 'high'
    ).length || 0;
    
    if (highRisks > 0) {
      this._pushUnique(resources.timeline, 'Weekly risk monitoring');
    }

    if (graphRAGResults?.insights?.opportunities?.length) {
      this._pushUnique(resources.personnel, 'Graph insights analyst');
      this._pushUnique(resources.tools, 'GraphRAG insights workspace');
      this._pushUnique(resources.timeline, 'Bi-weekly graph insight review');
    }

    if (graphRAGResults?.insights?.risk_indicators?.length) {
      this._pushUnique(resources.personnel, 'Risk mitigation squad');
      this._pushUnique(resources.timeline, 'Graph risk watchlist updates');
    }

    if (graphRAGResults?.graphData?.graphStats?.total_nodes > 0) {
      this._pushUnique(resources.tools, 'Knowledge graph visualization suite');
    }

    return resources;
  }

  calculateTotalOpportunityValue(opportunities) {
    return opportunities?.reduce((total, opp) => total + (opp.value || 0), 0) || 0;
  }

  _pushUnique(collection, value) {
    if (!value) return;
    if (!collection.includes(value)) {
      collection.push(value);
    }
  }
}
