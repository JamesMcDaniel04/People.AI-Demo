# Neo4j Aura Setup Guide

## Step 1: Configure Environment Variables

In your `.env` file, you need to replace the placeholder with your actual Neo4j Aura instance URI:

```env
# Replace "your-instance-id" with your actual instance ID from Neo4j Aura
NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=JGskejcz031Othy9b4qJ6LMWZEbfG1DrSsa9xmAbnDc
```

## Step 2: Import Sample Data

You have two options to import the sample data into Neo4j Aura:

### Option A: Use Cypher Queries (Recommended)

1. Open your Neo4j Aura instance in the browser
2. Go to the Query tab
3. Copy and paste the queries from `setup-queries.cypher`
4. Run each query section one by one

### Option B: CSV Import via Neo4j Browser

1. Upload the CSV files to your Neo4j Aura instance:
   - `accounts.csv`
   - `stakeholders.csv` 
   - `relationships.csv`

2. Use these import commands in the Neo4j browser:

```cypher
// Import accounts
LOAD CSV WITH HEADERS FROM 'file:///accounts.csv' AS row
CREATE (a:Account {
  id: row.accountId,
  name: row.name,
  industry: row.industry,
  revenue: toInteger(row.revenue),
  employees: toInteger(row.employees),
  tier: row.tier,
  health_score: toFloat(row.health_score),
  region: row.region
});

// Import stakeholders
LOAD CSV WITH HEADERS FROM 'file:///stakeholders.csv' AS row
CREATE (s:Stakeholder {
  id: row.stakeholderId,
  name: row.name,
  role: row.role,
  email: row.email,
  engagement_score: toFloat(row.engagement_score),
  influence_level: row.influence_level,
  department: row.department
});

// Create relationships between stakeholders and accounts
LOAD CSV WITH HEADERS FROM 'file:///stakeholders.csv' AS row
MATCH (s:Stakeholder {id: row.stakeholderId})
MATCH (a:Account {id: row.accountId})
CREATE (s)-[:WORKS_AT]->(a);

// Import stakeholder relationships
LOAD CSV WITH HEADERS FROM 'file:///relationships.csv' AS row
MATCH (from:Stakeholder {id: row.fromId})
MATCH (to:Stakeholder {id: row.toId})
CALL apoc.create.relationship(from, row.relationship_type, {
  strength: toFloat(row.strength),
  last_interaction: row.last_interaction,
  notes: row.notes
}, to) YIELD rel
RETURN rel;
```

## Step 3: Verify Data Import

Run this query to verify your data was imported correctly:

```cypher
MATCH (a:Account) 
RETURN count(a) as total_accounts;

MATCH (s:Stakeholder) 
RETURN count(s) as total_stakeholders;

MATCH ()-[r]->() 
RETURN count(r) as total_relationships;
```

Expected results:
- Accounts: 10
- Stakeholders: 10
- Relationships: ~15

## Step 4: Test GraphRAG Connection

Once the data is imported, you can test the GraphRAG service:

```bash
# Start GraphRAG service with Aura connection
docker-compose up graphrag-service

# Or run locally if you have Python environment set up
cd services/graphrag
python main.py
```

## Step 5: Verify Connection

The GraphRAG service should log:
```
🌐 Connecting to Neo4j Aura Cloud...
✅ Connected to Neo4j successfully
🏗️ Neo4j schema initialized
```

## Sample Data Overview

The sample dataset includes:
- **Accounts**: 10 enterprise companies (Stripe, Snowflake, Databricks, etc.)
- **Stakeholders**: Key decision makers and influencers
- **Relationships**: Professional connections and collaboration patterns
- **Health Scores**: Account engagement metrics
- **Influence Mapping**: Stakeholder importance and decision-making power

This data creates a realistic network for GraphRAG analysis and relationship discovery.

## Troubleshooting

**Connection Issues:**
- Verify your NEO4J_URI includes `neo4j+s://` prefix for Aura
- Check that your Aura instance is running and accessible
- Ensure your IP is whitelisted in Neo4j Aura security settings

**Import Issues:**
- If using CSV import, make sure files are uploaded to Aura first
- For large datasets, consider using batch import utilities
- Check Cypher syntax if queries fail

**Performance:**
- Neo4j Aura free tier has limitations on concurrent connections
- Consider upgrading if you encounter rate limiting
- Use connection pooling for production workloads