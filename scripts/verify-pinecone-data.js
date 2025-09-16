#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

async function verifyPineconeData() {
  console.log('🔍 Verifying Pinecone data...');

  try {
    // Import Pinecone
    const { Pinecone } = await import('@pinecone-database/pinecone');

    // Initialize client
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = 'peopleai';
    console.log(`🔗 Connecting to index: ${indexName}`);
    const index = pinecone.index(indexName);

    // Get index stats
    console.log('📊 Getting index statistics...');
    const stats = await index.describeIndexStats();
    console.log('📈 Index stats:', {
      totalVectorCount: stats.totalVectorCount,
      dimension: stats.dimension,
      indexFullness: stats.indexFullness,
      namespaces: stats.namespaces
    });

    // Try to fetch a specific vector to verify it exists
    console.log('🔍 Attempting to fetch a specific vector...');
    try {
      const fetchResult = await index.fetch(['stripe-overview-001']);
      if (fetchResult.vectors && Object.keys(fetchResult.vectors).length > 0) {
        console.log('✅ Vector found successfully!');
        const vector = fetchResult.vectors['stripe-overview-001'];
        console.log('📋 Vector details:', {
          id: vector.id,
          hasValues: !!vector.values,
          valuesLength: vector.values?.length,
          metadata: vector.metadata
        });
      } else {
        console.log('⚠️ Vector not found in fetch result');
      }
    } catch (fetchError) {
      console.log('⚠️ Fetch operation failed:', fetchError.message);
    }

    // Try a different query approach - query with metadata filter
    console.log('🔍 Attempting query with metadata filter...');
    try {
      const queryWithFilter = await index.query({
        vector: Array.from({ length: 1024 }, () => 0), // Zero vector
        topK: 10,
        includeMetadata: true,
        filter: {
          account: { $eq: 'Stripe' }
        }
      });

      console.log(`🎯 Filtered query returned ${queryWithFilter.matches.length} matches:`);
      queryWithFilter.matches.forEach((match, i) => {
        console.log(`  ${i + 1}. ID: ${match.id}`);
        console.log(`     Account: ${match.metadata?.account}`);
        console.log(`     Type: ${match.metadata?.type}`);
        console.log('');
      });
    } catch (queryError) {
      console.log('⚠️ Filtered query failed:', queryError.message);
    }

    // Simple query without filter
    console.log('🔍 Attempting simple query...');
    const simpleQuery = await index.query({
      vector: Array.from({ length: 1024 }, () => Math.random() * 0.1), // Small random vector
      topK: 5,
      includeMetadata: true
    });

    console.log(`🎯 Simple query returned ${simpleQuery.matches.length} matches:`);
    simpleQuery.matches.forEach((match, i) => {
      console.log(`  ${i + 1}. ID: ${match.id}`);
      console.log(`     Score: ${match.score?.toFixed(4)}`);
      console.log(`     Account: ${match.metadata?.account}`);
      console.log(`     Type: ${match.metadata?.type}`);
      console.log('');
    });

    console.log('✅ Verification completed!');

  } catch (error) {
    console.error('❌ Error verifying Pinecone data:', error.message);
    console.error(error);
  }
}

// Run verification
verifyPineconeData();