// Neo4j Aura Data Import Queries
// Run these queries in your Neo4j Aura browser interface

// 1. Create Account nodes
CREATE (stripe:Account {
  id: 'ACC001', 
  name: 'Stripe', 
  industry: 'Financial Services', 
  revenue: 7500000000, 
  employees: 4000, 
  tier: 'Enterprise', 
  health_score: 0.85, 
  region: 'North America'
})

CREATE (snowflake:Account {
  id: 'ACC002', 
  name: 'Snowflake', 
  industry: 'Data & Analytics', 
  revenue: 2100000000, 
  employees: 6000, 
  tier: 'Enterprise', 
  health_score: 0.78, 
  region: 'North America'
})

CREATE (databricks:Account {
  id: 'ACC003', 
  name: 'Databricks', 
  industry: 'Machine Learning', 
  revenue: 1800000000, 
  employees: 5000, 
  tier: 'Enterprise', 
  health_score: 0.92, 
  region: 'North America'
})

CREATE (figma:Account {
  id: 'ACC004', 
  name: 'Figma', 
  industry: 'Design & Collaboration', 
  revenue: 400000000, 
  employees: 800, 
  tier: 'Growth', 
  health_score: 0.88, 
  region: 'North America'
})

CREATE (notion:Account {
  id: 'ACC005', 
  name: 'Notion', 
  industry: 'Productivity Software', 
  revenue: 1000000000, 
  employees: 450, 
  tier: 'Growth', 
  health_score: 0.73, 
  region: 'North America'
});

// 2. Create Stakeholder nodes
CREATE (sarah:Stakeholder {
  id: 'STK001', 
  name: 'Sarah Chen', 
  role: 'Chief Technology Officer', 
  email: 'sarah.chen@stripe.com', 
  engagement_score: 0.92, 
  influence_level: 'High', 
  department: 'Engineering'
})

CREATE (marcus:Stakeholder {
  id: 'STK002', 
  name: 'Marcus Johnson', 
  role: 'VP of Engineering', 
  email: 'marcus.johnson@stripe.com', 
  engagement_score: 0.88, 
  influence_level: 'High', 
  department: 'Engineering'
})

CREATE (emily:Stakeholder {
  id: 'STK003', 
  name: 'Emily Rodriguez', 
  role: 'Product Manager', 
  email: 'emily.rodriguez@stripe.com', 
  engagement_score: 0.75, 
  influence_level: 'Medium', 
  department: 'Product'
})

CREATE (david:Stakeholder {
  id: 'STK004', 
  name: 'David Kim', 
  role: 'Chief Data Officer', 
  email: 'david.kim@snowflake.com', 
  engagement_score: 0.95, 
  influence_level: 'High', 
  department: 'Data'
})

CREATE (lisa:Stakeholder {
  id: 'STK005', 
  name: 'Lisa Wang', 
  role: 'VP of Analytics', 
  email: 'lisa.wang@snowflake.com', 
  engagement_score: 0.83, 
  influence_level: 'High', 
  department: 'Data'
});

// 3. Create relationships between stakeholders and accounts
MATCH (s:Stakeholder {id: 'STK001'}), (a:Account {id: 'ACC001'})
CREATE (s)-[:WORKS_AT]->(a);

MATCH (s:Stakeholder {id: 'STK002'}), (a:Account {id: 'ACC001'})
CREATE (s)-[:WORKS_AT]->(a);

MATCH (s:Stakeholder {id: 'STK003'}), (a:Account {id: 'ACC001'})
CREATE (s)-[:WORKS_AT]->(a);

MATCH (s:Stakeholder {id: 'STK004'}), (a:Account {id: 'ACC002'})
CREATE (s)-[:WORKS_AT]->(a);

MATCH (s:Stakeholder {id: 'STK005'}), (a:Account {id: 'ACC002'})
CREATE (s)-[:WORKS_AT]->(a);

// 4. Create stakeholder relationships
MATCH (s1:Stakeholder {id: 'STK001'}), (s2:Stakeholder {id: 'STK002'})
CREATE (s1)-[:COLLABORATES_WITH {strength: 0.95, last_interaction: '2024-01-15'}]->(s2);

MATCH (s1:Stakeholder {id: 'STK001'}), (s2:Stakeholder {id: 'STK003'})
CREATE (s1)-[:WORKS_WITH {strength: 0.78, last_interaction: '2024-01-12'}]->(s2);

MATCH (s1:Stakeholder {id: 'STK004'}), (s2:Stakeholder {id: 'STK005'})
CREATE (s1)-[:MANAGES {strength: 0.92, last_interaction: '2024-01-16'}]->(s2);

// 5. Create indexes for better query performance
CREATE INDEX account_id FOR (a:Account) ON (a.id);
CREATE INDEX stakeholder_id FOR (s:Stakeholder) ON (s.id);
CREATE INDEX account_name FOR (a:Account) ON (a.name);
CREATE INDEX stakeholder_email FOR (s:Stakeholder) ON (s.email);

// 6. Verify data import
MATCH (a:Account) 
RETURN count(a) as total_accounts;

MATCH (s:Stakeholder) 
RETURN count(s) as total_stakeholders;

MATCH ()-[r]->() 
RETURN count(r) as total_relationships;