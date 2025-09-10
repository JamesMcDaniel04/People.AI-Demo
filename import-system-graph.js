#!/usr/bin/env node

// Import complete system topology into Neo4j Aura
import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

dotenv.config();

async function importSystemGraph() {
  console.log('🚀 Starting system graph import to Neo4j Aura...');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
    { 
      maxConnectionLifetime: 30 * 60 * 1000,
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 2 * 60 * 1000,
      connectionTimeout: 30 * 1000
    }
  );

  try {
    const session = driver.session({ database: 'neo4j' });
    
    // Clear existing system graph
    console.log('🧹 Clearing existing system graph...');
    await session.run('MATCH (n) WHERE n.id STARTS WITH "SVC" OR n.id STARTS WITH "AI" OR n.id STARTS WITH "DEMO" DETACH DELETE n');
    
    // Read CSV data
    console.log('📊 Reading system topology CSV...');
    const csvData = fs.readFileSync('/Users/jamesmcdaniel/Desktop/complete_system_topology.csv', 'utf8');
    const records = parse(csvData, { 
      columns: true, 
      skip_empty_lines: true,
      comment: '#',
      relax_column_count: true,
      trim: true
    });
    
    // Process entities first
    console.log('🏗️ Creating system entities...');
    let entityCount = 0;
    
    for (const record of records) {
      if (record.entity_type && record.id && record.entity_type !== '') {
        const query = `
          MERGE (n:${record.entity_type} {id: $id})
          SET n.name = $name,
              n.category = $category,
              n.description = $description,
              n.version = $version,
              n.status = $status,
              n.host = $host,
              n.port = $port,
              n.api_key_required = $api_key_required,
              n.provider = $provider,
              n.model_type = $model_type,
              n.capabilities = $capabilities,
              n.updated_at = datetime()
        `;
        
        await session.run(query, {
          id: record.id,
          name: record.name || '',
          category: record.category || '',
          description: record.description || '',
          version: record.version || '',
          status: record.status || '',
          host: record.host || '',
          port: record.port || '',
          api_key_required: record.api_key_required === 'true',
          provider: record.provider || '',
          model_type: record.model_type || '',
          capabilities: record.capabilities || ''
        });
        
        entityCount++;
      }
    }
    
    console.log(`✅ Created ${entityCount} system entities`);
    
    // Process relationships
    console.log('🔗 Creating relationships...');
    let relationshipCount = 0;
    
    for (const record of records) {
      if (record.from_id && record.to_id && record.relationship_type) {
        const query = `
          MATCH (from) WHERE from.id = $from_id
          MATCH (to) WHERE to.id = $to_id
          MERGE (from)-[r:${record.relationship_type.replace(/[^A-Z_]/g, '_')}]->(to)
          SET r.strength = toFloat($strength),
              r.dependency_level = $dependency_level,
              r.created_at = datetime()
        `;
        
        await session.run(query, {
          from_id: record.from_id,
          to_id: record.to_id,
          strength: record.strength || 0.5,
          dependency_level: record.dependency_level || 'medium'
        });
        
        relationshipCount++;
      }
    }
    
    console.log(`✅ Created ${relationshipCount} relationships`);
    
    // Create indexes for performance
    console.log('🔍 Creating performance indexes...');
    const indexes = [
      'CREATE INDEX service_id IF NOT EXISTS FOR (s:Service) ON (s.id)',
      'CREATE INDEX aimodel_id IF NOT EXISTS FOR (a:AIModel) ON (a.id)',
      'CREATE INDEX demodata_id IF NOT EXISTS FOR (d:DemoData) ON (d.id)',
      'CREATE INDEX service_status IF NOT EXISTS FOR (s:Service) ON (s.status)',
      'CREATE INDEX service_category IF NOT EXISTS FOR (s:Service) ON (s.category)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await session.run(indexQuery);
      } catch (error) {
        // Index might already exist
        console.log(`⚠️ Index creation warning: ${error.message}`);
      }
    }
    
    // Generate statistics
    console.log('📈 Generating graph statistics...');
    
    const stats = await session.run(`
      MATCH (n) 
      WITH labels(n) as nodeLabels
      UNWIND nodeLabels as label
      RETURN label, count(*) as count
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Node Statistics:');
    for (const record of stats.records) {
      console.log(`   ${record.get('label')}: ${record.get('count')} nodes`);
    }
    
    const relStats = await session.run(`
      MATCH ()-[r]->()
      RETURN type(r) as relationship_type, count(r) as count
      ORDER BY count DESC
    `);
    
    console.log('\n🔗 Relationship Statistics:');
    for (const record of relStats.records) {
      console.log(`   ${record.get('relationship_type')}: ${record.get('count')} relationships`);
    }
    
    // Sample queries for verification
    console.log('\n🔍 Sample Graph Queries:');
    
    // Find all AI models
    const aiModels = await session.run('MATCH (ai:AIModel) RETURN ai.name, ai.provider ORDER BY ai.provider');
    console.log('   AI Models:');
    for (const record of aiModels.records) {
      console.log(`     - ${record.get('ai.name')} (${record.get('ai.provider')})`);
    }
    
    // Find critical dependencies
    const criticalDeps = await session.run(`
      MATCH (from)-[r]->(to) 
      WHERE r.dependency_level = 'critical'
      RETURN from.name, type(r), to.name, r.strength
      ORDER BY r.strength DESC
    `);
    
    console.log('\n   Critical Dependencies:');
    for (const record of criticalDeps.records) {
      console.log(`     ${record.get('from.name')} → ${record.get('to.name')} (${record.get('r.strength')})`);
    }
    
    await session.close();
    await driver.close();
    
    console.log('\n🎉 System graph import completed successfully!');
    console.log('🌐 You can now explore your complete system topology in Neo4j Aura');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    await driver.close();
    throw error;
  }
}

// Run the import
importSystemGraph()
  .then(() => {
    console.log('✅ Import process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Import failed:', error);
    process.exit(1);
  });