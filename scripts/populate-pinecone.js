#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getPineconeService } from '../src/services/pineconeService.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Simple config object
const config = {
  logLevel: process.env.LOG_LEVEL || 'info',
  logConsoleEnabled: true,
  logFileEnabled: false
};

// Stripe-focused account data to embed and store
const sampleAccountData = [
  {
    id: 'stripe-overview-001',
    text: 'Stripe is the leading payment infrastructure platform valued at $95B, processing $817B annually. Founded by Patrick and John Collison in 2010. Headquarters in San Francisco with 8,000+ employees globally. Core products: Payments, Billing, Connect, Terminal, Radar (fraud detection). Recent expansion into crypto, embedded finance, and issuing. Developer-first approach with 4M+ developers using APIs.',
    metadata: {
      account: 'Stripe',
      type: 'company_overview',
      health_score: 94,
      valuation: 95000000000,
      annual_volume: 817000000000,
      employees: 8000,
      founded: 2010,
      headquarters: 'San Francisco',
      ceos: ['Patrick Collison', 'John Collison'],
      last_updated: new Date().toISOString()
    }
  },
  {
    id: 'stripe-stakeholder-001',
    text: 'Key Stripe stakeholders: Patrick Collison (CEO) - Product strategy and vision, John Collison (President) - Business operations and partnerships, David Singleton (CTO) - Technical architecture and platform, Dhivya Suryadevara (CFO) - Financial strategy from GM, Mike Clayville (Chief Revenue Officer) - Enterprise sales and growth.',
    metadata: {
      account: 'Stripe',
      type: 'stakeholder_mapping',
      stakeholders: [
        { name: 'Patrick Collison', role: 'CEO', influence: 'high', focus: 'product_strategy' },
        { name: 'John Collison', role: 'President', influence: 'high', focus: 'business_ops' },
        { name: 'David Singleton', role: 'CTO', influence: 'high', focus: 'technical' },
        { name: 'Dhivya Suryadevara', role: 'CFO', influence: 'high', focus: 'financial' },
        { name: 'Mike Clayville', role: 'CRO', influence: 'high', focus: 'enterprise_sales' }
      ],
      last_updated: new Date().toISOString()
    }
  },
  {
    id: 'stripe-email-001',
    text: 'Email from David Singleton (CTO) on 2024-09-12: "We are architecting our next-gen payment platform for 2025. Focus on 10x performance improvements, global compliance, and real-time fraud detection. Looking for enterprise tooling partners for monitoring, observability, and DevOps automation. Budget allocated: $50M for platform infrastructure."',
    metadata: {
      account: 'Stripe',
      type: 'email_communication',
      stakeholder: 'David Singleton',
      role: 'CTO',
      date: '2024-09-12',
      topics: ['platform_architecture', 'performance', 'fraud_detection', 'enterprise_tooling'],
      budget: 50000000,
      opportunity_areas: ['monitoring', 'observability', 'devops'],
      urgency: 'medium',
      last_updated: new Date().toISOString()
    }
  },
  {
    id: 'stripe-meeting-001',
    text: 'Meeting notes from Stripe Enterprise call on 2024-09-08 with Mike Clayville (CRO) and enterprise team. Discussion: Stripe expanding into Fortune 500 market, need for enhanced SLA monitoring, compliance reporting, and custom integration support. Timeline: Q4 2024 rollout. Investment: $25M in enterprise tooling. Key requirements: 99.99% uptime monitoring, real-time alerting, audit trails.',
    metadata: {
      account: 'Stripe',
      type: 'meeting_notes',
      date: '2024-09-08',
      attendees: ['Mike Clayville', 'Enterprise Team'],
      focus: 'fortune_500_expansion',
      investment: 25000000,
      requirements: ['uptime_monitoring', 'real_time_alerting', 'audit_trails', 'compliance_reporting'],
      timeline: 'Q4 2024',
      target_market: 'Fortune 500',
      last_updated: new Date().toISOString()
    }
  },
  {
    id: 'stripe-opportunity-001',
    text: 'Expansion opportunity: Stripe launching "Stripe for Enterprise" program targeting Fortune 100 companies. Need specialized monitoring and observability stack for mission-critical payment processing. Competitive advantage: Real-time anomaly detection, predictive scaling, and multi-region failover monitoring. Estimated contract value: $15M annually.',
    metadata: {
      account: 'Stripe',
      type: 'business_opportunity',
      program: 'Stripe for Enterprise',
      target_segment: 'Fortune 100',
      opportunity_value: 15000000,
      contract_type: 'annual_recurring',
      competitive_advantages: ['real_time_anomaly_detection', 'predictive_scaling', 'multi_region_failover'],
      probability: 0.75,
      close_date: '2024-12-31',
      last_updated: new Date().toISOString()
    }
  },
  {
    id: 'stripe-technical-001',
    text: 'Stripe technical requirements from architecture review: Kubernetes monitoring across 15+ global regions, payment transaction tracing with <50ms latency, fraud detection pipeline monitoring, PCI compliance dashboards, real-time capacity planning for Black Friday 100x traffic spikes. Integration with existing Datadog, PagerDuty, and internal tools required.',
    metadata: {
      account: 'Stripe',
      type: 'technical_requirements',
      infrastructure: 'kubernetes_multi_region',
      regions: 15,
      latency_requirement: 50,
      compliance: ['PCI'],
      peak_traffic_multiplier: 100,
      existing_tools: ['Datadog', 'PagerDuty'],
      monitoring_needs: ['transaction_tracing', 'fraud_detection', 'capacity_planning'],
      last_updated: new Date().toISOString()
    }
  },
  {
    id: 'stripe-financial-001',
    text: 'Stripe financial profile: $12B ARR growth trajectory, 35% year-over-year revenue increase, expanding into issuing ($2B+ opportunity), crypto infrastructure ($5B+ market), and international markets (50+ countries). Enterprise segment growing 60% annually. Budget approval process involves CFO Dhivya Suryadevara for deals >$10M.',
    metadata: {
      account: 'Stripe',
      type: 'financial_profile',
      arr: 12000000000,
      yoy_growth: 0.35,
      expansion_areas: [
        { area: 'issuing', opportunity: 2000000000 },
        { area: 'crypto', opportunity: 5000000000 },
        { area: 'international', countries: 50 }
      ],
      enterprise_growth: 0.60,
      approval_threshold: 10000000,
      approver: 'Dhivya Suryadevara',
      last_updated: new Date().toISOString()
    }
  },
  {
    id: 'stripe-competitive-001',
    text: 'Stripe competitive landscape: Primary competitors include Square (SMB focus), PayPal (consumer focus), Adyen (enterprise international), and emerging players like Paddle. Stripe differentiators: Developer experience, global infrastructure, embedded finance capabilities. Threat: AWS Payment Cryptography and Google Pay. Opportunity: Enterprise monitoring where competitors lack depth.',
    metadata: {
      account: 'Stripe',
      type: 'competitive_analysis',
      primary_competitors: [
        { name: 'Square', focus: 'SMB', strength: 'point_of_sale' },
        { name: 'PayPal', focus: 'consumer', strength: 'brand_recognition' },
        { name: 'Adyen', focus: 'enterprise_international', strength: 'global_reach' },
        { name: 'Paddle', focus: 'SaaS', strength: 'billing_simplicity' }
      ],
      emerging_threats: ['AWS Payment Cryptography', 'Google Pay'],
      differentiators: ['developer_experience', 'global_infrastructure', 'embedded_finance'],
      our_opportunity: 'enterprise_monitoring',
      last_updated: new Date().toISOString()
    }
  }
];

// Simple function to generate mock embeddings (in real scenario, you'd use OpenAI API)
function generateMockEmbedding() {
  // Generate 1536-dimensional vector (OpenAI embedding size)
  return Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
}

async function populatePinecone() {
  console.log('🚀 Starting Pinecone population script...');

  try {
    // Initialize Pinecone service
    const pineconeService = getPineconeService(config);

    // Initialize Pinecone connection
    console.log('🔄 Initializing Pinecone connection...');
    await pineconeService.initialize();

    if (!pineconeService.isConnected()) {
      throw new Error('Failed to connect to Pinecone');
    }

    console.log(`✅ Connected to Pinecone (Mock mode: ${pineconeService.isMockMode()})`);

    // Prepare vectors for upsert
    console.log('📝 Preparing sample data for embedding...');
    const vectors = sampleAccountData.map(item => ({
      id: item.id,
      values: generateMockEmbedding(), // In production, use OpenAI embeddings
      metadata: {
        text: item.text,
        ...item.metadata
      }
    }));

    console.log(`📊 Generated ${vectors.length} vectors for upsert`);

    // Upsert vectors to Pinecone
    console.log('⬆️ Uploading vectors to Pinecone...');
    const result = await pineconeService.upsert(vectors, 'account-data');

    console.log(`✅ Successfully upserted ${result.upsertedCount} vectors to Pinecone`);

    // Test query to verify data
    console.log('🔍 Testing query functionality...');
    const queryVector = generateMockEmbedding();
    const queryResult = await pineconeService.query(queryVector, {
      topK: 3,
      namespace: 'account-data',
      includeMetadata: true
    });

    console.log(`🎯 Query returned ${queryResult.matches.length} matches`);
    queryResult.matches.forEach((match, index) => {
      console.log(`  ${index + 1}. ID: ${match.id}, Score: ${match.score?.toFixed(4)}, Account: ${match.metadata?.account}`);
    });

    // Get index statistics
    console.log('📈 Retrieving index statistics...');
    const stats = await pineconeService.getStats();
    console.log('📊 Index Statistics:', {
      totalVectors: stats.totalVectorCount,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness
    });

    console.log('🎉 Pinecone population completed successfully!');

  } catch (error) {
    console.error('❌ Error populating Pinecone:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the population script
if (import.meta.url === `file://${process.argv[1]}`) {
  populatePinecone()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error.message);
      process.exit(1);
    });
}

export { populatePinecone };