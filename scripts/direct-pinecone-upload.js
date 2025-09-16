#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Stripe-focused account data
const stripeAccountData = [
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
      key_people: 'Patrick Collison, John Collison, David Singleton, Dhivya Suryadevara, Mike Clayville',
      decision_makers: 5,
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
      budget: 50000000,
      opportunity_areas: 'monitoring, observability, devops',
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
      attendees: 'Mike Clayville, Enterprise Team',
      focus: 'fortune_500_expansion',
      investment: 25000000,
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
      compliance: 'PCI',
      peak_traffic_multiplier: 100,
      existing_tools: 'Datadog, PagerDuty',
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
      competitors: 'Square, PayPal, Adyen, Paddle',
      threats: 'AWS Payment Cryptography, Google Pay',
      differentiators: 'developer_experience, global_infrastructure, embedded_finance',
      our_opportunity: 'enterprise_monitoring',
      last_updated: new Date().toISOString()
    }
  }
];

// Generate mock embedding vectors (1024 dimensions for peopleai index)
function generateEmbedding() {
  return Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
}

async function uploadToPinecone() {
  console.log('🚀 Starting direct Pinecone upload...');

  try {
    // Import Pinecone
    const { Pinecone } = await import('@pinecone-database/pinecone');

    // Initialize client
    console.log('🔧 Initializing Pinecone client...');
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = 'peopleai'; // Use the existing index
    console.log(`🔗 Connecting to index: ${indexName}`);
    const index = pinecone.index(indexName);

    // Prepare vectors
    console.log('📝 Preparing Stripe account vectors...');
    const vectors = stripeAccountData.map(item => ({
      id: item.id,
      values: generateEmbedding(),
      metadata: {
        text: item.text,
        ...item.metadata
      }
    }));

    console.log(`📊 Generated ${vectors.length} vectors for Stripe account data`);

    // Upload vectors in batches
    const batchSize = 5;
    let totalUpserted = 0;

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      console.log(`⬆️ Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)} (${batch.length} vectors)...`);

      const upsertResult = await index.upsert(batch);
      totalUpserted += batch.length;

      console.log(`✅ Batch uploaded successfully (Total: ${totalUpserted}/${vectors.length})`);

      // Small delay between batches
      if (i + batchSize < vectors.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎉 Successfully uploaded ${totalUpserted} Stripe account vectors to Pinecone!`);

    // Wait a moment for indexing
    console.log('⏳ Waiting for indexing to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test query
    console.log('🔍 Testing query with sample vector...');
    const queryVector = generateEmbedding();
    const queryResult = await index.query({
      vector: queryVector,
      topK: 5,
      includeMetadata: true
    });

    console.log(`🎯 Query returned ${queryResult.matches.length} matches:`);
    queryResult.matches.forEach((match, i) => {
      console.log(`  ${i + 1}. ID: ${match.id}`);
      console.log(`     Score: ${match.score?.toFixed(4)}`);
      console.log(`     Account: ${match.metadata?.account}`);
      console.log(`     Type: ${match.metadata?.type}`);
      console.log(`     Text preview: ${match.metadata?.text?.substring(0, 100)}...`);
      console.log('');
    });

    // Get final stats
    console.log('📊 Getting final index statistics...');
    const stats = await index.describeIndexStats();
    console.log('📈 Final index stats:', {
      totalVectorCount: stats.totalVectorCount,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness
    });

    console.log('✅ Pinecone upload completed successfully!');

  } catch (error) {
    console.error('❌ Error uploading to Pinecone:', error.message);
    console.error(error.stack);
  }
}

// Run the upload
uploadToPinecone();