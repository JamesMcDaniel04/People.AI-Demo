import { AccountHealth, OpportunityType, RiskLevel } from '../../types/index.js';
import { MixedAIService } from '../services/mixedAIService.js';

export class DataAnalyzer {
  constructor(config, klavisProvider = null) {
    this.config = config;
    this.aiService = new MixedAIService(config, klavisProvider);
  }

  async analyzeAccountData(accountData, graphRAGResults = null) {
    console.log('🤖 AI-powered account analysis starting...');
    
    // AI-powered health analysis
    const healthScore = await this.aiService.analyzeAccountHealth(accountData, graphRAGResults);
    
    // AI-powered opportunity identification
    const opportunities = await this.aiService.identifyOpportunities(accountData, healthScore, graphRAGResults);
    
    // AI-powered risk assessment
    const risks = await this.aiService.assessRisks(accountData, healthScore, opportunities, graphRAGResults);
    
    // Generate AI insights
    const insights = await this.aiService.generateInsights(
      accountData,
      { healthScore, opportunities, risks },
      graphRAGResults
    );

    const analysis = {
      healthScore: this.mapHealthScoreToLegacyFormat(healthScore),
      opportunities: opportunities.map(opp => this.mapOpportunityToLegacyFormat(opp)),
      risks: risks.map(risk => this.mapRiskToLegacyFormat(risk)),
      stakeholderMap: await this.mapStakeholders(accountData),
      trends: await this.analyzeTrends(accountData),
      insights: insights
    };

    const augmented = this.augmentAnalysisWithGraphRAG(analysis, graphRAGResults);

    console.log('✅ AI-powered analysis completed');
    return augmented;
  }

  // Map AI response formats to legacy formats for compatibility
  mapHealthScoreToLegacyFormat(aiHealthScore) {
    return {
      overall: aiHealthScore.healthStatus || AccountHealth.GOOD,
      score: aiHealthScore.overallScore || 75,
      overallScore: aiHealthScore.overallScore || 75,
      healthStatus: aiHealthScore.healthStatus || AccountHealth.GOOD,
      factors: aiHealthScore.factors || {
        financial: 75,
        engagement: 75,
        growth: 75,
        satisfaction: 75
      },
      strengths: aiHealthScore.strengths || [],
      weaknesses: aiHealthScore.weaknesses || [],
      trend: aiHealthScore.trend || 'stable'
    };
  }

  mapOpportunityToLegacyFormat(aiOpportunity) {
    return {
      id: aiOpportunity.id,
      type: aiOpportunity.type || OpportunityType.EXPANSION,
      priority: aiOpportunity.priority || 'medium',
      value: aiOpportunity.value || 100000,
      confidence: aiOpportunity.confidence || 0.5,
      reasoning: aiOpportunity.reasoning || aiOpportunity.description || 'AI-identified opportunity',
      timeline: aiOpportunity.timeline || 'Q2 2024',
      requirements: aiOpportunity.requirements || [],
      title: aiOpportunity.title || aiOpportunity.name || this.deriveOpportunityTitle(aiOpportunity),
      description: aiOpportunity.description || aiOpportunity.reasoning || 'AI-identified opportunity',
      source: aiOpportunity.source || 'ai_analysis'
    };
  }

  mapRiskToLegacyFormat(aiRisk) {
    return {
      id: aiRisk.id,
      type: aiRisk.type || 'general',
      level: aiRisk.level || RiskLevel.MEDIUM,
      probability: aiRisk.probability || 0.3,
      impact: aiRisk.impact || 'medium',
      description: aiRisk.description || aiRisk.title || 'AI-identified risk',
      mitigation: Array.isArray(aiRisk.mitigation) ? aiRisk.mitigation.join(', ') : (aiRisk.mitigation || 'Monitor and assess'),
      title: aiRisk.title || this.deriveRiskTitle(aiRisk),
      source: aiRisk.source || 'ai_analysis'
    };
  }

  deriveOpportunityTitle(aiOpportunity) {
    if (aiOpportunity?.title) return aiOpportunity.title;
    const base = aiOpportunity?.type || 'Opportunity';
    const timeline = aiOpportunity?.timeline ? ` (${aiOpportunity.timeline})` : '';
    return `${base}${timeline}`.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  deriveRiskTitle(aiRisk) {
    if (aiRisk?.title) return aiRisk.title;
    const descriptor = aiRisk?.type || 'Risk';
    return descriptor.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  augmentAnalysisWithGraphRAG(analysis, graphRAGResults) {
    if (!graphRAGResults) {
      return analysis;
    }

    const augmented = {
      ...analysis,
      healthScore: { ...analysis.healthScore },
      opportunities: [...analysis.opportunities],
      risks: [...analysis.risks],
      insights: Array.isArray(analysis.insights) ? [...analysis.insights] : []
    };

    // Merge opportunities derived from GraphRAG insights
    if (graphRAGResults.insights?.opportunities?.length) {
      for (const insight of graphRAGResults.insights.opportunities) {
        const mapped = this.mapGraphOpportunityToLegacyFormat(insight);
        if (!augmented.opportunities.find(opp => opp.id === mapped.id)) {
          augmented.opportunities.push(mapped);
        }
      }
    }

    // Merge risks derived from GraphRAG analysis
    if (graphRAGResults.insights?.risk_indicators?.length) {
      for (const insight of graphRAGResults.insights.risk_indicators) {
        const mapped = this.mapGraphRiskToLegacyFormat(insight);
        if (!augmented.risks.find(risk => risk.id === mapped.id)) {
          augmented.risks.push(mapped);
        }
      }
    }

    // Improve health score using relationship health signals
    if (graphRAGResults.insights?.relationship_health?.length) {
      const confidenceValues = graphRAGResults.insights.relationship_health
        .map(item => (typeof item.confidence === 'number' ? item.confidence : Number(item.confidence)))
        .filter(value => !Number.isNaN(value));

      if (confidenceValues.length > 0) {
        const averageConfidence = confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
        const modifier = (averageConfidence - 0.5) * 20; // Adjust between -10 and +10
        const healthScore = augmented.healthScore.score ?? augmented.healthScore.overallScore ?? 0;
        const adjustedScore = Math.max(0, Math.min(100, Math.round(healthScore + modifier)));
        augmented.healthScore.score = adjustedScore;
        augmented.healthScore.overallScore = adjustedScore;
        augmented.healthScore.graphModifier = modifier;
        augmented.healthScore.overall = this.recalculateHealthStatus(adjustedScore);
        augmented.healthScore.healthStatus = augmented.healthScore.overall;
        augmented.healthScore.trend = this.recalculateTrend(adjustedScore, augmented.healthScore.trend);
        augmented.healthScore.graphInsights = graphRAGResults.insights.relationship_health.map(item => ({
          summary: item.summary,
          confidence: item.confidence,
          category: item.category || 'relationship_health'
        }));
      }
    }

    // Append GraphRAG summary insights for downstream consumers
    if (graphRAGResults.summary) {
      augmented.insights.push({
        type: 'graph_rag_summary',
        title: 'GraphRAG Summary',
        description: graphRAGResults.summary,
        priority: 'medium',
        actionable: false,
        source: 'graphrag'
      });
    }

    augmented.graphRAG = {
      summary: graphRAGResults.summary,
      metadata: graphRAGResults.metadata,
      graphStats: graphRAGResults.graphData?.graphStats
    };

    return augmented;
  }

  recalculateTrend(score, currentTrend = 'stable') {
    if (score >= 85) return 'improving';
    if (score >= 60) return currentTrend && currentTrend !== 'declining' ? currentTrend : 'stable';
    return 'declining';
  }

  recalculateHealthStatus(score) {
    if (score >= 85) return AccountHealth.EXCELLENT;
    if (score >= 70) return AccountHealth.GOOD;
    if (score >= 50) return AccountHealth.AT_RISK;
    return AccountHealth.CRITICAL;
  }

  mapGraphOpportunityToLegacyFormat(graphInsight) {
    return {
      id: graphInsight.id || `graphrag_opp_${graphInsight.summary?.slice(0, 20) || Date.now()}`,
      type: graphInsight.category || 'graph_insight',
      priority: graphInsight.priority || this.derivePriorityFromConfidence(graphInsight.confidence),
      value: graphInsight.estimated_value || graphInsight.value || 0,
      confidence: typeof graphInsight.confidence === 'number'
        ? graphInsight.confidence
        : Number(graphInsight.confidence) || 0.5,
      reasoning: graphInsight.summary || graphInsight.detail || 'Identified via GraphRAG analysis',
      timeline: graphInsight.timeline || 'TBD',
      requirements: graphInsight.recommendations || [],
      title: graphInsight.title || graphInsight.summary || 'GraphRAG Opportunity',
      description: graphInsight.detail || graphInsight.summary || 'Graph-derived opportunity',
      source: 'graphrag'
    };
  }

  mapGraphRiskToLegacyFormat(graphInsight) {
    const confidence = typeof graphInsight.confidence === 'number'
      ? graphInsight.confidence
      : Number(graphInsight.confidence) || 0.5;

    return {
      id: graphInsight.id || `graphrag_risk_${graphInsight.summary?.slice(0, 20) || Date.now()}`,
      type: graphInsight.category || 'graph_insight',
      level: graphInsight.severity || this.deriveSeverityFromConfidence(confidence),
      probability: confidence,
      impact: graphInsight.impact || this.deriveImpactFromSeverity(graphInsight.severity),
      description: graphInsight.summary || graphInsight.detail || 'Graph-derived risk',
      mitigation: Array.isArray(graphInsight.recommendations) ? graphInsight.recommendations.join(', ') : (graphInsight.mitigation || ''),
      title: graphInsight.title || graphInsight.summary || 'GraphRAG Risk',
      source: 'graphrag'
    };
  }

  derivePriorityFromConfidence(confidence) {
    const value = typeof confidence === 'number' ? confidence : Number(confidence) || 0;
    if (value >= 0.75) return 'high';
    if (value >= 0.5) return 'medium';
    return 'low';
  }

  deriveImpactFromSeverity(severity) {
    if (!severity) return 'medium';
    const normalized = `${severity}`.toLowerCase();
    if (normalized.includes('high') || normalized.includes('critical')) return 'high';
    if (normalized.includes('medium')) return 'medium';
    return 'low';
  }

  async calculateHealthScore(accountData) {
    const factors = {
      financial: 0,
      engagement: 0,
      growth: 0,
      satisfaction: 0
    };

    // Financial health
    if (accountData.financial?.length > 0) {
      const financial = accountData.financial[0].data;
      if (financial.growthRate > 0.2) factors.financial = 100;
      else if (financial.growthRate > 0.1) factors.financial = 75;
      else if (financial.growthRate > 0) factors.financial = 50;
      else factors.financial = 25;
    }

    // Engagement health based on interactions
    if (accountData.interactions?.length > 0) {
      const recentInteractions = accountData.interactions
        .flatMap(source => source.data)
        .filter(interaction => {
          const daysSince = (Date.now() - new Date(interaction.date)) / (1000 * 60 * 60 * 24);
          return daysSince <= 30;
        });

      if (recentInteractions.length >= 3) factors.engagement = 100;
      else if (recentInteractions.length >= 2) factors.engagement = 75;
      else if (recentInteractions.length >= 1) factors.engagement = 50;
      else factors.engagement = 25;
    }

    const overallScore = (factors.financial + factors.engagement + factors.growth + factors.satisfaction) / 4;
    
    let health = AccountHealth.CRITICAL;
    if (overallScore >= 80) health = AccountHealth.EXCELLENT;
    else if (overallScore >= 60) health = AccountHealth.GOOD;
    else if (overallScore >= 40) health = AccountHealth.AT_RISK;

    return {
      overall: health,
      score: Math.round(overallScore),
      factors
    };
  }

  async identifyOpportunities(accountData) {
    const opportunities = [];

    // Analyze growth patterns for expansion opportunities
    if (accountData.financial?.length > 0) {
      const financial = accountData.financial[0].data;
      if (financial.growthRate > 0.15) {
        opportunities.push({
          type: OpportunityType.EXPANSION,
          priority: 'high',
          value: Math.round(financial.currentARR * 0.3),
          confidence: 0.8,
          reasoning: 'Strong growth trajectory indicates readiness for expansion',
          timeline: 'Q2 2024',
          requirements: ['Technical capacity review', 'Customer success alignment']
        });
      }
    }

    // Analyze stakeholder engagement for upsell opportunities
    if (accountData.stakeholders?.length > 0) {
      const highEngagement = accountData.stakeholders
        .flatMap(source => source.data)
        .filter(stakeholder => stakeholder.engagement === 'high');

      if (highEngagement.length >= 2) {
        opportunities.push({
          type: OpportunityType.UPSELL,
          priority: 'medium',
          value: 250000,
          confidence: 0.6,
          reasoning: 'Multiple highly engaged stakeholders suggest openness to additional services',
          timeline: 'Q3 2024',
          requirements: ['ROI demonstration', 'Technical integration plan']
        });
      }
    }

    return opportunities;
  }

  async assessRisks(accountData) {
    const risks = [];

    // Contract expiry risk
    if (accountData.financial?.length > 0) {
      const financial = accountData.financial[0].data;
      if (financial.contractEndDate) {
        const daysToExpiry = (new Date(financial.contractEndDate) - new Date()) / (1000 * 60 * 60 * 24);
        if (daysToExpiry < 180) {
          risks.push({
            type: 'contract_renewal',
            level: daysToExpiry < 90 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
            probability: 0.3,
            impact: 'high',
            description: `Contract expires in ${Math.round(daysToExpiry)} days`,
            mitigation: 'Initiate renewal discussions immediately'
          });
        }
      }
    }

    // Engagement risk
    if (accountData.interactions?.length > 0) {
      const allInteractions = accountData.interactions.flatMap(source => source.data);
      const recentInteractions = allInteractions.filter(interaction => {
        const daysSince = (Date.now() - new Date(interaction.date)) / (1000 * 60 * 60 * 24);
        return daysSince <= 60;
      });

      if (recentInteractions.length < 2) {
        risks.push({
          type: 'engagement',
          level: RiskLevel.MEDIUM,
          probability: 0.4,
          impact: 'medium',
          description: 'Low recent engagement with account stakeholders',
          mitigation: 'Schedule regular check-ins and value demonstration'
        });
      }
    }

    return risks;
  }

  async mapStakeholders(accountData) {
    const stakeholderMap = {
      decisionMakers: [],
      influencers: [],
      champions: [],
      technical: [],
      financial: []
    };

    if (accountData.stakeholders?.length > 0) {
      accountData.stakeholders.forEach(source => {
        source.data.forEach(stakeholder => {
          const category = this.categorizeStakeholder(stakeholder);
          if (stakeholderMap[category]) {
            stakeholderMap[category].push({
              ...stakeholder,
              source: source.source,
              riskLevel: this.assessStakeholderRisk(stakeholder)
            });
          }
        });
      });
    }

    return stakeholderMap;
  }

  categorizeStakeholder(stakeholder) {
    const roleMapping = {
      'decision_maker': 'decisionMakers',
      'influencer': 'influencers',
      'champion': 'champions',
      'technical': 'technical',
      'financial': 'financial'
    };
    return roleMapping[stakeholder.role] || 'influencers';
  }

  assessStakeholderRisk(stakeholder) {
    const daysSinceContact = (Date.now() - new Date(stakeholder.lastContact)) / (1000 * 60 * 60 * 24);
    
    if (daysSinceContact > 90) return RiskLevel.HIGH;
    if (daysSinceContact > 60) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  async analyzeTrends(accountData) {
    const trends = {
      engagement: 'stable',
      financial: 'positive',
      stakeholder: 'stable'
    };

    // Analyze interaction trends
    if (accountData.interactions?.length > 0) {
      const allInteractions = accountData.interactions.flatMap(source => source.data);
      const last30Days = allInteractions.filter(i => 
        (Date.now() - new Date(i.date)) / (1000 * 60 * 60 * 24) <= 30
      ).length;
      const previous30Days = allInteractions.filter(i => {
        const days = (Date.now() - new Date(i.date)) / (1000 * 60 * 60 * 24);
        return days > 30 && days <= 60;
      }).length;

      if (last30Days > previous30Days) trends.engagement = 'increasing';
      else if (last30Days < previous30Days) trends.engagement = 'decreasing';
    }

    return trends;
  }

  async generateInsights(accountData) {
    const insights = [];

    // Financial insights
    if (accountData.financial?.length > 0) {
      const financial = accountData.financial[0].data;
      if (financial.growthRate > 0.2) {
        insights.push({
          type: 'opportunity',
          priority: 'high',
          message: `Account shows strong growth (${Math.round(financial.growthRate * 100)}%), ideal for expansion discussions`,
          actionable: true,
          nextSteps: ['Schedule growth planning session', 'Prepare expansion proposal']
        });
      }
    }

    // Stakeholder insights
    if (accountData.stakeholders?.length > 0) {
      const allStakeholders = accountData.stakeholders.flatMap(source => source.data);
      const highInfluenceStakeholders = allStakeholders.filter(s => s.influence >= 8);
      
      if (highInfluenceStakeholders.length >= 2) {
        insights.push({
          type: 'relationship',
          priority: 'medium',
          message: `Strong relationships with ${highInfluenceStakeholders.length} high-influence stakeholders`,
          actionable: true,
          nextSteps: ['Leverage relationships for expansion', 'Request referrals']
        });
      }
    }

    return insights;
  }
}
