import { DataAnalyzer } from '../analysis/dataAnalyzer.js';
import { RecommendationEngine } from './recommendationEngine.js';
import { GraphRAGService } from '../../services/graphRAGService.js';

export class AccountPlannerApp {
  constructor(dataManager, config) {
    this.dataManager = dataManager;
    this.config = config;
    // Pass the Klavis provider to enable tool calling in AI services
    const klavisProvider = dataManager.getKlavisProvider();
    this.analyzer = new DataAnalyzer(config, klavisProvider);
    this.recommendationEngine = new RecommendationEngine(config, klavisProvider);
    
    // Initialize GraphRAG Service
    this.graphRAG = new GraphRAGService(config);
    this.graphRAGInitialized = false;
  }

  async generateAccountPlan(accountName) {
    console.log(`📋 Generating account plan for ${accountName}...`);
    
    try {
      // Step 1: Initialize GraphRAG if not already done
      if (!this.graphRAGInitialized) {
        await this.graphRAG.initialize();
        this.graphRAGInitialized = true;
      }
      
      // Step 2: Gather all account data
      const accountData = await this.dataManager.getAccountData(accountName);
      
      // Step 3: Process data through GraphRAG for enhanced insights
      console.log(`🧠 Processing ${accountName} through GraphRAG...`);
      const graphRAGResults = await this.graphRAG.generateAccountPlanningInsights(
        accountName, 
        accountData
      );
      
      // Step 4: Analyze the data (enhanced with GraphRAG insights)
      const analysis = await this.analyzer.analyzeAccountData(accountData, graphRAGResults);
      
      // Step 5: Generate recommendations (enhanced with GraphRAG context)
      const recommendations = await this.recommendationEngine.generateRecommendations(
        accountData, 
        analysis,
        graphRAGResults
      );
      
      // Step 6: Create comprehensive account plan with GraphRAG insights
      const accountPlan = await this.createAccountPlan(
        accountName,
        accountData,
        analysis,
        recommendations,
        graphRAGResults
      );
      
      return accountPlan;
      
    } catch (error) {
      console.error(`Failed to generate account plan: ${error.message}`);
      throw error;
    }
  }

  async createAccountPlan(accountName, accountData, analysis, recommendations, graphRAGResults = null) {
    const dataSources = this.summarizeDataSources(accountData);
    const plan = {
      metadata: {
        accountName,
        generatedDate: new Date().toISOString(),
        planPeriod: 'Q2-Q4 2024',
        lastUpdated: new Date().toISOString(),
        version: '1.1',
        dataSources,
        graphRAG: graphRAGResults?.metadata || { enabled: false }
      },
      
      executiveSummary: this.generateExecutiveSummary(accountData, analysis, graphRAGResults),
      
      dataSources: {
        coreGTMData: dataSources.dataSourcesBreakdown.coreGTM,
        externalEnrichment: dataSources.dataSourcesBreakdown.external,
        mcpLiveData: dataSources.dataSourcesBreakdown.mcpLive,
        graphRAG: {
          title: "Graph RAG Intelligence",
          enabled: !!graphRAGResults,
          entityCount: graphRAGResults?.graphData?.graphStats?.total_nodes || 0,
          relationshipCount: graphRAGResults?.graphData?.graphStats?.total_relationships || 0,
          insightCategories: graphRAGResults?.insights ? Object.keys(graphRAGResults.insights).length : 0,
          processingTime: graphRAGResults?.metadata?.processingTime || 0,
          total: (graphRAGResults?.graphData?.graphStats?.total_nodes || 0) + 
                 (graphRAGResults?.graphData?.graphStats?.total_relationships || 0)
        },
        summary: {
          totalSources: dataSources.sources.length + (graphRAGResults ? 1 : 0),
          totalDataPoints: dataSources.dataSourcesBreakdown.coreGTM.total + 
                          dataSources.dataSourcesBreakdown.external.total + 
                          dataSources.dataSourcesBreakdown.mcpLive.total +
                          (graphRAGResults?.graphData?.graphStats?.total_nodes || 0),
          enrichmentLevel: graphRAGResults ? 'GraphRAG Enhanced' : 
                          (dataSources.dataSourcesBreakdown.external.total > 0 ? 'Enhanced' : 'Standard'),
          liveDataEnabled: dataSources.dataSourcesBreakdown.mcpLive.isLive,
          graphRAGEnabled: !!graphRAGResults
        }
      },
      
      accountOverview: {
        currentStatus: await this.generateCurrentStatus(accountData, analysis),
        healthScore: analysis.healthScore,
        keyMetrics: this.extractKeyMetrics(accountData),
        relationshipHealth: this.assessRelationshipHealth(analysis.stakeholderMap)
      },
      
      opportunityAnalysis: {
        identifiedOpportunities: analysis.opportunities,
        potentialValue: this.calculateTotalOpportunityValue(analysis.opportunities),
        prioritization: this.prioritizeOpportunities(analysis.opportunities),
        timeframe: this.createOpportunityTimeline(analysis.opportunities)
      },
      
      stakeholderMap: {
        visualization: this.createStakeholderVisualization(analysis.stakeholderMap),
        keyRelationships: this.identifyKeyRelationships(analysis.stakeholderMap),
        engagementStrategy: this.developEngagementStrategy(analysis.stakeholderMap),
        riskAssessment: this.assessStakeholderRisks(analysis.stakeholderMap)
      },
      
      strategicRecommendations: {
        immediate: recommendations.immediate,
        shortTerm: recommendations.shortTerm,
        longTerm: recommendations.longTerm,
        resourceRequirements: recommendations.resources
      },
      
      graphRAGInsights: {
        enabled: !!graphRAGResults,
        summary: graphRAGResults?.summary || 'GraphRAG analysis not available',
        categorizedInsights: graphRAGResults?.insights || {},
        graphStatistics: graphRAGResults?.graphData?.graphStats || {},
        processingMetadata: graphRAGResults?.metadata || {},
        keyFindings: this.extractGraphRAGKeyFindings(graphRAGResults),
        crossSourceCorrelations: this.identifyCorrelations(graphRAGResults),
        communityInsights: this.summarizeCommunityPatterns(graphRAGResults)
      },
      
      riskAssessment: {
        identifiedRisks: analysis.risks,
        mitigationStrategies: this.developMitigationStrategies(analysis.risks),
        contingencyPlans: this.createContingencyPlans(analysis.risks),
        monitoringPlan: this.createRiskMonitoringPlan(analysis.risks)
      },
      
      actionPlan: {
        nextSteps: this.generateNextSteps(recommendations),
        timeline: this.createActionTimeline(recommendations),
        successMetrics: this.defineSuccessMetrics(analysis.opportunities),
        reviewSchedule: this.createReviewSchedule()
      },
      
      dataInsights: {
        keyInsights: analysis.insights,
        trends: analysis.trends,
        dataQuality: this.assessDataQuality(accountData),
        recommendations: this.generateDataRecommendations(accountData)
      }
    };

    return plan;
  }

  summarizeDataSources(accountData) {
    const sections = ['emails', 'calls', 'interactions', 'stakeholders', 'documents', 'calendar', 'crm', 'financial', 'external'];
    const summary = { bySection: {}, sourcesPresent: new Set() };
    for (const key of sections) {
      const arr = Array.isArray(accountData[key]) ? accountData[key] : [];
      const total = arr.reduce((acc, src) => acc + (Array.isArray(src.data) ? src.data.length : (src.data ? 1 : 0)), 0);
      summary.bySection[key] = { sources: arr.map(s => s.source), count: total };
      arr.forEach(s => summary.sourcesPresent.add(s.source));
    }

    // Enhanced data sources breakdown for demo visibility
    const coreGTMData = {
      emails: summary.bySection.emails?.count || 0,
      calls: summary.bySection.calls?.count || 0,
      stakeholders: summary.bySection.stakeholders?.count || 0,
      interactions: summary.bySection.interactions?.count || 0
    };

    const externalEnrichment = {
      newsItems: 0,
      financialSignals: 0,
      socialMentions: 0,
      marketData: 0
    };

    const mcpLiveData = {
      calendarEvents: summary.bySection.calendar?.count || 0,
      documentUpdates: summary.bySection.documents?.count || 0,
      slackMentions: 0,
      crmRecords: summary.bySection.crm?.count || 0
    };

    // Parse external data sources
    if (accountData.external && Array.isArray(accountData.external)) {
      accountData.external.forEach(source => {
        if (source.source === 'news_api' && source.data?.news) {
          externalEnrichment.newsItems = source.data.news.length;
        }
        if (source.source === 'financial_api' && source.data?.signals) {
          externalEnrichment.financialSignals = source.data.signals.length;
        }
        if (source.source === 'social_api' && source.data?.mentions) {
          externalEnrichment.socialMentions = source.data.mentions.length;
        }
      });
    }

    // Parse MCP data sources for live data indicators
    const klavisSources = Array.from(summary.sourcesPresent).filter(s => s.includes('klavis'));
    if (klavisSources.length > 0) {
      // If using Klavis MCP, data is live
      mcpLiveData.isLive = true;
    }

    return {
      sources: Array.from(summary.sourcesPresent),
      sections: summary.bySection,
      // Enhanced breakdown for demo presentation
      dataSourcesBreakdown: {
        coreGTM: {
          title: "Core GTM Data",
          emails: coreGTMData.emails,
          calls: coreGTMData.calls,
          stakeholders: coreGTMData.stakeholders,
          interactions: coreGTMData.interactions,
          total: coreGTMData.emails + coreGTMData.calls + coreGTMData.stakeholders + coreGTMData.interactions
        },
        external: {
          title: "External Enrichment",
          newsItems: externalEnrichment.newsItems,
          financialSignals: externalEnrichment.financialSignals,
          socialMentions: externalEnrichment.socialMentions,
          marketData: externalEnrichment.marketData,
          total: externalEnrichment.newsItems + externalEnrichment.financialSignals + externalEnrichment.socialMentions + externalEnrichment.marketData
        },
        mcpLive: {
          title: "MCP Live Data",
          calendarEvents: mcpLiveData.calendarEvents,
          documentUpdates: mcpLiveData.documentUpdates,
          slackMentions: mcpLiveData.slackMentions,
          crmRecords: mcpLiveData.crmRecords,
          isLive: mcpLiveData.isLive || false,
          total: mcpLiveData.calendarEvents + mcpLiveData.documentUpdates + mcpLiveData.slackMentions + mcpLiveData.crmRecords
        }
      }
    };
  }

  generateExecutiveSummary(accountData, analysis) {
    const basic = accountData.basic?.data || { name: 'Unknown Account' };
    const healthStatus = analysis.healthScore?.overall || 'unknown';
    const opportunityCount = analysis.opportunities?.length || 0;
    const totalValue = this.calculateTotalOpportunityValue(analysis.opportunities);

    return {
      overview: `${basic.name} is a ${basic.tier || 'enterprise'} account in ${basic.industry || 'technology'} sector with ${healthStatus} health status.`,
      keyHighlights: [
        `Account health score: ${analysis.healthScore?.score || 'N/A'}/100`,
        `${opportunityCount} growth opportunities identified`,
        `Total opportunity value: $${totalValue.toLocaleString()}`,
        `${analysis.risks?.length || 0} risks require attention`
      ],
      recommendation: opportunityCount > 0 
        ? 'Immediate focus on high-priority expansion opportunities' 
        : 'Focus on relationship strengthening and value demonstration'
    };
  }

  async generateCurrentStatus(accountData, analysis) {
    const basic = accountData.basic?.data || {};
    const financial = accountData.financial?.[0]?.data || {};
    
    return {
      relationship: {
        duration: this.calculateRelationshipDuration(basic.founded),
        strength: analysis.healthScore?.overall || 'unknown',
        lastInteraction: this.getLastInteractionDate(accountData.interactions),
        primaryContact: this.getPrimaryContact(accountData.stakeholders)
      },
      business: {
        currentARR: financial.currentARR || 0,
        growthRate: financial.growthRate || 0,
        contractStatus: this.getContractStatus(financial.contractEndDate),
        paymentHealth: financial.paymentHistory || 'unknown'
      },
      engagement: {
        level: this.calculateEngagementLevel(accountData.interactions),
        recentActivity: this.getRecentActivity(accountData.interactions),
        stakeholderCoverage: this.calculateStakeholderCoverage(analysis.stakeholderMap)
      }
    };
  }

  extractKeyMetrics(accountData) {
    const financial = accountData.financial?.[0]?.data || {};
    const basic = accountData.basic?.data || {};
    
    return {
      revenue: {
        current: financial.currentARR || 0,
        previous: financial.lastYearARR || 0,
        growth: financial.growthRate || 0
      },
      engagement: {
        interactions30Days: this.countRecentInteractions(accountData.interactions, 30),
        stakeholderCount: this.countTotalStakeholders(accountData.stakeholders),
        lastContact: this.getLastInteractionDate(accountData.interactions)
      },
      company: {
        size: basic.employees || 0,
        industry: basic.industry || 'Unknown',
        region: basic.region || 'Unknown'
      }
    };
  }

  // Helper methods for data processing
  calculateTotalOpportunityValue(opportunities) {
    return opportunities?.reduce((total, opp) => total + (opp.value || 0), 0) || 0;
  }

  prioritizeOpportunities(opportunities) {
    if (!opportunities) return [];
    
    return opportunities
      .map(opp => ({
        ...opp,
        score: (opp.value || 0) * (opp.confidence || 0.5)
      }))
      .sort((a, b) => b.score - a.score);
  }

  createStakeholderVisualization(stakeholderMap) {
    const visualization = {
      totalStakeholders: 0,
      byRole: {},
      byEngagement: { high: 0, medium: 0, low: 0 },
      riskDistribution: { high: 0, medium: 0, low: 0 }
    };

    Object.entries(stakeholderMap).forEach(([role, stakeholders]) => {
      visualization.byRole[role] = stakeholders.length;
      visualization.totalStakeholders += stakeholders.length;
      
      stakeholders.forEach(stakeholder => {
        if (stakeholder.engagement) {
          visualization.byEngagement[stakeholder.engagement]++;
        }
        if (stakeholder.riskLevel) {
          visualization.riskDistribution[stakeholder.riskLevel]++;
        }
      });
    });

    return visualization;
  }

  generateNextSteps(recommendations) {
    const nextSteps = [];
    
    if (recommendations.immediate) {
      nextSteps.push(...recommendations.immediate.map(rec => ({
        action: rec.action,
        timeline: 'Next 30 days',
        owner: rec.owner || 'Account Manager',
        priority: 'High'
      })));
    }
    
    return nextSteps.slice(0, 5); // Top 5 next steps
  }

  createActionTimeline(recommendations) {
    return {
      immediate: recommendations.immediate?.length || 0,
      shortTerm: recommendations.shortTerm?.length || 0,
      longTerm: recommendations.longTerm?.length || 0,
      totalActions: (recommendations.immediate?.length || 0) + 
                   (recommendations.shortTerm?.length || 0) + 
                   (recommendations.longTerm?.length || 0)
    };
  }

  defineSuccessMetrics(opportunities) {
    return {
      financial: {
        revenueGrowth: '20% increase in ARR',
        opportunityConversion: '70% of identified opportunities',
        contractRenewal: '100% renewal rate'
      },
      relationship: {
        stakeholderEngagement: 'Increase high-engagement stakeholders by 50%',
        interactionFrequency: 'Monthly touchpoints with key stakeholders',
        satisfactionScore: 'Maintain 90%+ satisfaction rating'
      }
    };
  }

  createReviewSchedule() {
    return {
      weekly: 'Progress review and next step updates',
      monthly: 'Full account health assessment',
      quarterly: 'Strategic plan review and adjustment',
      annually: 'Comprehensive account planning refresh'
    };
  }

  assessDataQuality(accountData) {
    const quality = {
      completeness: 0,
      freshness: 0,
      accuracy: 0,
      overall: 0
    };

    // Calculate completeness
    const requiredFields = ['basic', 'financial', 'stakeholders', 'interactions'];
    const presentFields = requiredFields.filter(field => 
      accountData[field] && accountData[field].length > 0
    );
    quality.completeness = (presentFields.length / requiredFields.length) * 100;

    // Calculate freshness based on interaction dates
    if (accountData.interactions?.length > 0) {
      const latestInteraction = Math.max(
        ...accountData.interactions
          .flatMap(source => source.data)
          .map(interaction => new Date(interaction.date).getTime())
      );
      const daysSinceLatest = (Date.now() - latestInteraction) / (1000 * 60 * 60 * 24);
      quality.freshness = Math.max(0, 100 - (daysSinceLatest * 2));
    }

    quality.accuracy = 85; // Placeholder for accuracy assessment
    quality.overall = (quality.completeness + quality.freshness + quality.accuracy) / 3;

    return quality;
  }

  // Additional helper methods
  calculateRelationshipDuration(foundedDate) {
    if (!foundedDate) return 'Unknown duration';
    const founded = new Date(foundedDate);
    const now = new Date();
    const years = Math.floor((now - founded) / (365 * 24 * 60 * 60 * 1000));
    return `${years} years`;
  }

  getContractStatus(contractEndDate) {
    if (!contractEndDate) return 'No active contract';
    const endDate = new Date(contractEndDate);
    const now = new Date();
    const daysUntilExpiry = Math.floor((endDate - now) / (24 * 60 * 60 * 1000));
    
    if (daysUntilExpiry < 0) return 'Expired';
    if (daysUntilExpiry < 30) return 'Expiring soon';
    if (daysUntilExpiry < 90) return 'Renewal required';
    return 'Active';
  }

  calculateEngagementLevel(interactions) {
    if (!interactions || interactions.length === 0) return 'Low';
    const totalInteractions = interactions.flatMap(source => source.data).length;
    
    if (totalInteractions >= 10) return 'High';
    if (totalInteractions >= 5) return 'Medium';
    return 'Low';
  }

  getRecentActivity(interactions) {
    if (!interactions || interactions.length === 0) return 'No recent activity';
    const recentInteractions = interactions
      .flatMap(source => source.data)
      .filter(interaction => {
        const daysSince = (Date.now() - new Date(interaction.date)) / (1000 * 60 * 60 * 24);
        return daysSince <= 7;
      });
    
    if (recentInteractions.length === 0) return 'No activity this week';
    return `${recentInteractions.length} interactions this week`;
  }

  calculateStakeholderCoverage(stakeholderMap) {
    const totalStakeholders = Object.values(stakeholderMap || {})
      .reduce((total, stakeholders) => total + stakeholders.length, 0);
    
    if (totalStakeholders >= 10) return 'Excellent';
    if (totalStakeholders >= 5) return 'Good';
    if (totalStakeholders >= 3) return 'Adequate';
    return 'Limited';
  }

  countTotalStakeholders(stakeholders) {
    if (!stakeholders || stakeholders.length === 0) return 0;
    return stakeholders.flatMap(source => source.data).length;
  }

  getPrimaryContact(stakeholders) {
    if (!stakeholders || stakeholders.length === 0) return 'None identified';
    const allStakeholders = stakeholders.flatMap(source => source.data);
    const primaryContact = allStakeholders.find(s => s.relationshipStrength === 'Strong');
    return primaryContact ? primaryContact.name : (allStakeholders[0]?.name || 'None identified');
  }

  assessRelationshipHealth(stakeholderMap) {
    const stakeholders = Object.values(stakeholderMap || {}).flat();
    if (stakeholders.length === 0) return 'No relationships';
    
    const strongRelationships = stakeholders.filter(s => s.relationshipStrength === 'Strong').length;
    const totalRelationships = stakeholders.length;
    const ratio = strongRelationships / totalRelationships;
    
    if (ratio >= 0.5) return 'Strong';
    if (ratio >= 0.3) return 'Good';
    if (ratio >= 0.1) return 'Developing';
    return 'Weak';
  }

  createOpportunityTimeline(opportunities) {
    if (!opportunities || opportunities.length === 0) return {};
    
    const timeline = {};
    opportunities.forEach(opp => {
      const period = opp.timeline || 'Q2 2024';
      if (!timeline[period]) timeline[period] = [];
      timeline[period].push(opp);
    });
    
    return timeline;
  }

  identifyKeyRelationships(stakeholderMap) {
    const stakeholders = Object.values(stakeholderMap || {}).flat();
    return stakeholders
      .filter(s => s.relationshipStrength === 'Strong' || s.influence === 'High')
      .map(s => ({
        name: s.name,
        role: s.role,
        strength: s.relationshipStrength,
        influence: s.influence,
        riskLevel: s.riskLevel
      }));
  }

  developEngagementStrategy(stakeholderMap) {
    const strategies = [];
    const stakeholders = Object.values(stakeholderMap || {}).flat();
    
    const weakRelationships = stakeholders.filter(s => s.relationshipStrength === 'Weak');
    if (weakRelationships.length > 0) {
      strategies.push(`Strengthen ${weakRelationships.length} weak relationships`);
    }
    
    const highInfluence = stakeholders.filter(s => s.influence === 'High');
    strategies.push(`Maintain regular touchpoints with ${highInfluence.length} high-influence stakeholders`);
    
    return strategies;
  }

  assessStakeholderRisks(stakeholderMap) {
    const risks = [];
    const stakeholders = Object.values(stakeholderMap || {}).flat();
    
    const highRiskStakeholders = stakeholders.filter(s => s.riskLevel === 'high');
    if (highRiskStakeholders.length > 0) {
      risks.push({
        type: 'stakeholder_churn',
        description: `${highRiskStakeholders.length} stakeholders at high risk of disengagement`,
        mitigation: 'Immediate re-engagement required'
      });
    }
    
    return risks;
  }

  developMitigationStrategies(risks) {
    return risks.map(risk => ({
      risk: risk.type,
      strategy: risk.mitigation || 'Monitor and assess',
      timeline: '30 days',
      owner: 'Account Manager'
    }));
  }

  createContingencyPlans(risks) {
    return risks.map(risk => ({
      risk: risk.type,
      contingency: `If ${risk.description}, then escalate to management and implement crisis response`,
      triggers: ['Risk probability > 70%', 'Early warning indicators present'],
      actions: ['Executive escalation', 'Customer retention team activation']
    }));
  }

  createRiskMonitoringPlan(risks) {
    return {
      frequency: 'Weekly',
      metrics: risks.map(risk => `${risk.type} risk level`),
      alerts: 'Automated alerts for high-risk conditions',
      reporting: 'Monthly risk dashboard updates'
    };
  }

  generateDataRecommendations(accountData) {
    const recommendations = [];
    
    if (!accountData.interactions || accountData.interactions[0]?.data?.length < 5) {
      recommendations.push('Increase interaction frequency to improve data quality');
    }
    
    if (!accountData.stakeholders || accountData.stakeholders[0]?.data?.length < 3) {
      recommendations.push('Identify additional stakeholders for comprehensive mapping');
    }
    
    return recommendations;
  }

  countRecentInteractions(interactions, days) {
    if (!interactions) return 0;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return interactions
      .flatMap(source => source.data)
      .filter(interaction => new Date(interaction.date).getTime() > cutoff)
      .length;
  }

  getLastInteractionDate(interactions) {
    if (!interactions || interactions.length === 0) return null;
    const latest = Math.max(
      ...interactions
        .flatMap(source => source.data)
        .map(interaction => new Date(interaction.date).getTime())
    );
    return new Date(latest).toISOString();
  }

  // GraphRAG Analysis Helper Methods
  extractGraphRAGKeyFindings(graphRAGResults) {
    if (!graphRAGResults || !graphRAGResults.insights) {
      return ['GraphRAG analysis not available'];
    }

    const findings = [];
    
    // Extract top insights from each category
    Object.entries(graphRAGResults.insights).forEach(([category, insights]) => {
      if (insights && insights.length > 0) {
        const topInsight = insights.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
        if (topInsight.summary) {
          findings.push(`${category.replace('_', ' ').toUpperCase()}: ${topInsight.summary}`);
        }
      }
    });

    return findings.length > 0 ? findings.slice(0, 5) : ['No significant GraphRAG findings identified'];
  }

  identifyCorrelations(graphRAGResults) {
    if (!graphRAGResults || !graphRAGResults.insights) {
      return {
        crossSourceMatches: 0,
        correlationStrength: 0,
        examples: []
      };
    }

    let crossSourceMatches = 0;
    let correlationExamples = [];

    // Look for cross-source correlation insights
    Object.values(graphRAGResults.insights).flat().forEach(insight => {
      if (insight.type === 'cross_source_correlation') {
        crossSourceMatches += insight.evidence?.[0]?.correlation_strength || 0;
        if (insight.summary) {
          correlationExamples.push(insight.summary);
        }
      }
    });

    return {
      crossSourceMatches,
      correlationStrength: crossSourceMatches > 0 ? Math.min(crossSourceMatches * 0.2, 1.0) : 0,
      examples: correlationExamples.slice(0, 3)
    };
  }

  summarizeCommunityPatterns(graphRAGResults) {
    if (!graphRAGResults || !graphRAGResults.insights) {
      return {
        communitiesIdentified: 0,
        influencePatterns: [],
        networkDensity: 'Unknown'
      };
    }

    let communitiesCount = 0;
    let influencePatterns = [];

    // Extract community insights
    Object.values(graphRAGResults.insights).flat().forEach(insight => {
      if (insight.type === 'community_influence') {
        communitiesCount++;
        if (insight.summary) {
          influencePatterns.push(insight.summary);
        }
      }
    });

    const networkDensity = this.calculateNetworkDensity(graphRAGResults.graphData);

    return {
      communitiesIdentified: communitiesCount,
      influencePatterns: influencePatterns.slice(0, 3),
      networkDensity
    };
  }

  calculateNetworkDensity(graphData) {
    if (!graphData?.graphStats) return 'Unknown';
    
    const nodes = graphData.graphStats.total_nodes || 0;
    const relationships = graphData.graphStats.total_relationships || 0;
    
    if (nodes < 2) return 'Insufficient data';
    
    const maxPossibleEdges = nodes * (nodes - 1) / 2;
    const density = maxPossibleEdges > 0 ? relationships / maxPossibleEdges : 0;
    
    if (density > 0.7) return 'High';
    if (density > 0.4) return 'Medium';
    if (density > 0.1) return 'Low';
    return 'Very Low';
  }

  // Enhanced Executive Summary with GraphRAG insights
  generateExecutiveSummary(accountData, analysis, graphRAGResults = null) {
    const basic = accountData.basic?.data || { name: 'Unknown Account' };
    const healthStatus = analysis.healthScore?.overall || 'unknown';
    const opportunityCount = analysis.opportunities?.length || 0;
    const totalValue = this.calculateTotalOpportunityValue(analysis.opportunities);
    
    // Base summary
    let summary = {
      overview: `${basic.name} is a ${basic.tier || 'enterprise'} account in ${basic.industry || 'technology'} sector with ${healthStatus} health status.`,
      keyHighlights: [
        `Account health score: ${analysis.healthScore?.score || 'N/A'}/100`,
        `${opportunityCount} growth opportunities identified`,
        `Total opportunity value: $${totalValue.toLocaleString()}`,
        `Risk level: ${analysis.risks?.length || 0} identified risks`
      ],
      nextActions: [
        'Review stakeholder engagement strategy',
        'Address identified risks',
        'Pursue high-priority opportunities',
        'Monitor account health metrics'
      ]
    };

    // Enhance with GraphRAG insights if available
    if (graphRAGResults && graphRAGResults.summary) {
      summary.graphRAGEnhancement = {
        enabled: true,
        summary: graphRAGResults.summary,
        keyInsights: this.extractGraphRAGKeyFindings(graphRAGResults).slice(0, 3),
        processingTime: graphRAGResults.metadata?.processingTime || 0
      };
      
      // Add GraphRAG-specific highlights
      const correlations = this.identifyCorrelations(graphRAGResults);
      if (correlations.crossSourceMatches > 0) {
        summary.keyHighlights.push(`${correlations.crossSourceMatches} cross-source correlations identified`);
      }
      
      const communities = this.summarizeCommunityPatterns(graphRAGResults);
      if (communities.communitiesIdentified > 0) {
        summary.keyHighlights.push(`${communities.communitiesIdentified} stakeholder communities detected`);
      }
    }

    return summary;
  }
}
