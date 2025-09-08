import { DataAnalyzer } from '../analysis/dataAnalyzer.js';
import { RecommendationEngine } from './recommendationEngine.js';

export class AccountPlannerApp {
  constructor(dataManager, config) {
    this.dataManager = dataManager;
    this.config = config;
    this.analyzer = new DataAnalyzer(config);
    this.recommendationEngine = new RecommendationEngine(config);
  }

  async generateAccountPlan(accountName) {
    console.log(`📋 Generating account plan for ${accountName}...`);
    
    try {
      // Step 1: Gather all account data
      const accountData = await this.dataManager.getAccountData(accountName);
      
      // Step 2: Analyze the data
      const analysis = await this.analyzer.analyzeAccountData(accountData);
      
      // Step 3: Generate recommendations
      const recommendations = await this.recommendationEngine.generateRecommendations(
        accountData, 
        analysis
      );
      
      // Step 4: Create comprehensive account plan
      const accountPlan = await this.createAccountPlan(
        accountName,
        accountData,
        analysis,
        recommendations
      );
      
      return accountPlan;
      
    } catch (error) {
      console.error(`Failed to generate account plan: ${error.message}`);
      throw error;
    }
  }

  async createAccountPlan(accountName, accountData, analysis, recommendations) {
    const plan = {
      metadata: {
        accountName,
        generatedDate: new Date().toISOString(),
        planPeriod: 'Q2-Q4 2024',
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      },
      
      executiveSummary: this.generateExecutiveSummary(accountData, analysis),
      
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
}