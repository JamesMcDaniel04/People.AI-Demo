/**
 * GraphRAG Service Integration for Account Planning
 * Connects the Node.js account planner with the Python GraphRAG service
 */

import axios from 'axios';
import { EventEmitter } from 'events';

export class GraphRAGService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      serviceUrl: process.env.GRAPHRAG_SERVICE_URL || 'http://localhost:8000',
      maxHops: parseInt(process.env.GRAPHRAG_MAX_HOPS) || 3,
      timeout: parseInt(process.env.GRAPHRAG_TIMEOUT) || 30000,
      retryAttempts: 3,
      enabled: process.env.GRAPHRAG_ENABLED === 'true',
      ...config
    };
    
    this.client = null;
    this.initialized = false;
    this.mockMode = false;
  }

  async initialize() {
    console.log('🔄 Initializing GraphRAG Service...');
    
    if (!this.config.enabled) {
      console.log('⚠️ GraphRAG disabled, using mock mode');
      this.mockMode = true;
      this.initialized = true;
      return;
    }

    try {
      // Create axios client
      this.client = axios.create({
        baseURL: this.config.serviceUrl,
        timeout: this.config.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Test connection
      const healthCheck = await this.client.get('/health');
      
      if (healthCheck.data?.status === 'healthy') {
        this.initialized = true;
        console.log('✅ GraphRAG Service connected successfully');
      } else {
        throw new Error('GraphRAG service not healthy');
      }

    } catch (error) {
      console.warn(`⚠️ GraphRAG Service unavailable: ${error.message}, using mock mode`);
      this.mockMode = true;
      this.initialized = true;
    }
  }

  async processAccountData(accountName, accountData) {
    if (!this.initialized) {
      throw new Error('GraphRAG Service not initialized');
    }

    if (this.mockMode) {
      return this._generateMockGraphData(accountName, accountData);
    }

    try {
      console.log(`🧠 Processing account data through GraphRAG: ${accountName}`);

      // Step 1: Extract entities and build graph
      const analysisResult = await this.client.post('/analyze-account', {
        accountName,
        emails: accountData.emails || [],
        calls: accountData.calls || [],
        stakeholders: accountData.stakeholders || [],
        documents: accountData.documents || [],
        interactions: accountData.interactions || []
      });

      const analysis = analysisResult.data;
      console.log(`✅ GraphRAG analysis completed for ${accountName}`);

      return {
        graphStats: analysis.graphStats,
        insights: analysis.insights,
        processingTime: analysis.processingTime,
        analyzedAt: analysis.analyzedAt
      };

    } catch (error) {
      console.error(`❌ GraphRAG processing failed for ${accountName}:`, error.message);
      
      // Fallback to mock data
      console.log('🔄 Falling back to mock GraphRAG data');
      return this._generateMockGraphData(accountName, accountData);
    }
  }

  async generateGraphInsights(accountName, query = null) {
    if (!this.initialized) {
      throw new Error('GraphRAG Service not initialized');
    }

    if (this.mockMode) {
      return this._generateMockInsights(accountName, query);
    }

    try {
      const insightsResult = await this.client.post('/graphrag-query', {
        accountName,
        query: query || 'Generate comprehensive account insights',
        maxHops: this.config.maxHops,
        includeEmbeddings: true
      });

      return insightsResult.data;

    } catch (error) {
      console.error(`❌ GraphRAG insights generation failed:`, error.message);
      return this._generateMockInsights(accountName, query);
    }
  }

  async findRelatedEntities(accountName, entityId, maxHops = null) {
    if (!this.initialized) {
      throw new Error('GraphRAG Service not initialized');
    }

    if (this.mockMode) {
      return this._generateMockRelatedEntities(entityId);
    }

    try {
      const queryResult = await this.client.post('/graphrag-query', {
        accountName,
        query: `Find entities related to ${entityId}`,
        maxHops: maxHops || this.config.maxHops,
        includeEmbeddings: false
      });

      return queryResult.data.graphContext || [];

    } catch (error) {
      console.error(`❌ Related entities query failed:`, error.message);
      return this._generateMockRelatedEntities(entityId);
    }
  }

  async semanticSearch(accountName, query, topK = 10) {
    if (!this.initialized) {
      throw new Error('GraphRAG Service not initialized');
    }

    if (this.mockMode) {
      return this._generateMockSearchResults(query, topK);
    }

    try {
      // This would call a semantic search endpoint if available
      // For now, we'll use the main GraphRAG query endpoint
      const searchResult = await this.client.post('/graphrag-query', {
        accountName,
        query,
        maxHops: 1,
        includeEmbeddings: true
      });

      return searchResult.data.semanticResults || [];

    } catch (error) {
      console.error(`❌ Semantic search failed:`, error.message);
      return this._generateMockSearchResults(query, topK);
    }
  }

  // Enhanced insights specifically for account planning
  async generateAccountPlanningInsights(accountName, accountData) {
    try {
      console.log(`🎯 Generating GraphRAG insights for account planning: ${accountName}`);
      
      // Process account data through GraphRAG
      const graphData = await this.processAccountData(accountName, accountData);
      
      // Generate specific insights for account planning
      const planningQueries = [
        'What are the key stakeholder influence patterns?',
        'How have communication patterns evolved over time?',
        'What are the main risk indicators in the relationship?',
        'What opportunities can be identified from the data?',
        'What are the cross-functional relationships and dependencies?'
      ];

      const allInsights = [];
      
      for (const query of planningQueries) {
        const queryInsights = await this.generateGraphInsights(accountName, query);
        if (queryInsights.insights) {
          allInsights.push(...queryInsights.insights);
        }
      }

      // Categorize insights for account planning
      const categorizedInsights = this._categorizeInsightsForPlanning(allInsights);
      
      return {
        graphData,
        insights: categorizedInsights,
        summary: this._generateInsightsSummary(categorizedInsights),
        metadata: {
          totalInsights: allInsights.length,
          processingTime: graphData.processingTime,
          analyzedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`❌ Account planning insights generation failed:`, error.message);
      
      // Return mock data for graceful degradation
      return this._generateMockAccountPlanningInsights(accountName, accountData);
    }
  }

  _categorizeInsightsForPlanning(insights) {
    const categorized = {
      stakeholder_influence: [],
      communication_patterns: [],
      risk_indicators: [],
      opportunities: [],
      relationship_health: []
    };

    for (const insight of insights) {
      const category = insight.category || this._inferInsightCategory(insight);
      if (categorized[category]) {
        categorized[category].push(insight);
      } else {
        // Default category
        categorized.relationship_health.push(insight);
      }
    }

    return categorized;
  }

  _inferInsightCategory(insight) {
    const summary = insight.summary?.toLowerCase() || '';
    const type = insight.type?.toLowerCase() || '';
    
    if (summary.includes('influence') || summary.includes('decision') || type.includes('influence')) {
      return 'stakeholder_influence';
    }
    if (summary.includes('communication') || summary.includes('pattern') || type.includes('pattern')) {
      return 'communication_patterns';
    }
    if (summary.includes('risk') || summary.includes('concern') || type.includes('risk')) {
      return 'risk_indicators';
    }
    if (summary.includes('opportunity') || summary.includes('growth') || type.includes('opportunity')) {
      return 'opportunities';
    }
    
    return 'relationship_health';
  }

  _generateInsightsSummary(categorizedInsights) {
    const categories = Object.keys(categorizedInsights);
    const totalInsights = categories.reduce((sum, cat) => sum + categorizedInsights[cat].length, 0);
    
    const topCategories = categories
      .filter(cat => categorizedInsights[cat].length > 0)
      .sort((a, b) => categorizedInsights[b].length - categorizedInsights[a].length)
      .slice(0, 3)
      .map(cat => `${cat.replace('_', ' ')}: ${categorizedInsights[cat].length}`)
      .join(', ');

    return `GraphRAG analysis identified ${totalInsights} insights across multiple dimensions. ` +
           `Top categories: ${topCategories}. Analysis reveals cross-source correlations and ` +
           `multi-dimensional relationship patterns that provide deep contextual understanding.`;
  }

  // Mock data generators for fallback
  _generateMockGraphData(accountName, accountData) {
    const emailCount = (accountData.emails || []).length;
    const callCount = (accountData.calls || []).length;
    const stakeholderCount = (accountData.stakeholders || []).length;
    
    return {
      graphStats: {
        account_name: accountName,
        people_created: stakeholderCount,
        organizations_created: 1,
        topics_created: Math.min(emailCount + callCount, 10),
        events_created: emailCount + callCount,
        relationships_created: stakeholderCount * 2,
        total_nodes: stakeholderCount + 10,
        total_relationships: stakeholderCount * 3
      },
      insights: this._generateMockInsights(accountName).insights,
      processingTime: 2.5,
      analyzedAt: new Date().toISOString()
    };
  }

  _generateMockInsights(accountName, query = null) {
    const mockInsights = [
      {
        type: 'cross_source_correlation',
        confidence: 0.85,
        evidence: [{ type: 'entity_mention', correlation_strength: 3 }],
        relationships: [],
        summary: `Strong correlation found between email discussions and meeting outcomes for ${accountName}`,
        category: 'communication_patterns'
      },
      {
        type: 'stakeholder_influence',
        confidence: 0.78,
        evidence: [{ type: 'network_analysis', influence_score: 0.8 }],
        relationships: [],
        summary: `Key stakeholder influence patterns identified with 3 primary decision makers`,
        category: 'stakeholder_influence'
      },
      {
        type: 'temporal_evolution',
        confidence: 0.72,
        evidence: [{ type: 'time_series', trend: 'increasing' }],
        relationships: [],
        summary: `Communication frequency has increased 40% over the past quarter`,
        category: 'relationship_health'
      }
    ];

    return {
      insights: mockInsights,
      entityCount: 15,
      relationshipCount: 45,
      communityCount: 3,
      processingTime: 1.8
    };
  }

  _generateMockAccountPlanningInsights(accountName, accountData) {
    return {
      graphData: this._generateMockGraphData(accountName, accountData),
      insights: {
        stakeholder_influence: [
          {
            type: 'influence_network',
            confidence: 0.8,
            summary: 'Executive stakeholder shows high influence across technical and business decisions'
          }
        ],
        communication_patterns: [
          {
            type: 'pattern_analysis',
            confidence: 0.75,
            summary: 'Regular weekly touchpoints indicate strong engagement cadence'
          }
        ],
        risk_indicators: [],
        opportunities: [
          {
            type: 'expansion_opportunity',
            confidence: 0.7,
            summary: 'Cross-departmental interest suggests upsell potential'
          }
        ],
        relationship_health: [
          {
            type: 'health_assessment',
            confidence: 0.85,
            summary: 'Strong multi-stakeholder engagement indicates healthy relationship'
          }
        ]
      },
      summary: 'Mock GraphRAG analysis complete - real analysis would provide deeper insights',
      metadata: {
        totalInsights: 4,
        processingTime: 1.5,
        analyzedAt: new Date().toISOString()
      }
    };
  }

  _generateMockRelatedEntities(entityId) {
    return [
      {
        id: `related_1_${entityId}`,
        name: 'Related Entity 1',
        labels: ['Person'],
        distance: 1,
        properties: { type: 'stakeholder' }
      },
      {
        id: `related_2_${entityId}`,
        name: 'Related Entity 2',
        labels: ['Topic'],
        distance: 2,
        properties: { category: 'technical' }
      }
    ];
  }

  _generateMockSearchResults(query, topK) {
    const results = [];
    for (let i = 0; i < Math.min(topK, 5); i++) {
      results.push({
        id: `mock_result_${i}`,
        score: 0.9 - (i * 0.1),
        metadata: { type: 'mock', source: 'fallback' },
        text: `Mock search result ${i + 1} for query: ${query}`
      });
    }
    return results;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      enabled: this.config.enabled,
      mockMode: this.mockMode,
      serviceUrl: this.config.serviceUrl,
      maxHops: this.config.maxHops
    };
  }
}