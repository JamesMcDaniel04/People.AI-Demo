"""
Neo4j Service for GraphRAG
Handles graph database operations for entity relationships and graph traversal
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from neo4j import AsyncGraphDatabase
import os
from datetime import datetime

logger = logging.getLogger(__name__)

class Neo4jService:
    def __init__(self):
        self.driver = None
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "peopleai2024")
        self.database = os.getenv("NEO4J_DATABASE", "neo4j")
        self.is_aura = self.uri.startswith("neo4j+s://")
        
    async def connect(self):
        """Connect to Neo4j database (local or Aura)"""
        try:
            # Configure connection options based on environment
            driver_config = {}
            
            # For Neo4j Aura connections
            if self.is_aura:
                driver_config.update({
                    "max_connection_lifetime": 30 * 60,  # 30 minutes
                    "max_connection_pool_size": 50,
                    "connection_acquisition_timeout": 120,  # 2 minutes
                    "connection_timeout": 30,
                    "encrypted": True
                })
                logger.info("🌐 Connecting to Neo4j Aura Cloud...")
            else:
                logger.info("🔗 Connecting to local Neo4j...")
            
            self.driver = AsyncGraphDatabase.driver(
                self.uri, 
                auth=(self.user, self.password),
                **driver_config
            )
            
            # Test connection
            async with self.driver.session(database=self.database) as session:
                result = await session.run("RETURN 1 as test")
                await result.single()
            
            logger.info("✅ Connected to Neo4j successfully")
            
            # Initialize schema
            await self._initialize_schema()
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Neo4j: {str(e)}")
            raise
    
    async def close(self):
        """Close Neo4j connection"""
        if self.driver:
            await self.driver.close()
            logger.info("🔐 Neo4j connection closed")
    
    def is_connected(self) -> bool:
        """Check if connected to Neo4j"""
        return self.driver is not None
    
    async def _initialize_schema(self):
        """Initialize Neo4j schema with constraints and indexes"""
        schema_queries = [
            # Constraints
            "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
            "CREATE CONSTRAINT organization_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE",
            "CREATE CONSTRAINT topic_id IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE",
            "CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE",
            "CREATE CONSTRAINT account_id IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE",
            
            # Indexes
            "CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.name)",
            "CREATE INDEX organization_name IF NOT EXISTS FOR (o:Organization) ON (o.name)",
            "CREATE INDEX topic_name IF NOT EXISTS FOR (t:Topic) ON (t.name)",
            "CREATE INDEX event_date IF NOT EXISTS FOR (e:Event) ON (e.date)",
            "CREATE INDEX account_name IF NOT EXISTS FOR (a:Account) ON (a.name)"
        ]
        
        async with self.driver.session(database=self.database) as session:
            for query in schema_queries:
                try:
                    await session.run(query)
                except Exception as e:
                    logger.warning(f"Schema creation warning: {str(e)}")
        
        logger.info("🏗️ Neo4j schema initialized")
    
    async def build_account_graph(self, account_name: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Build knowledge graph for an account from extracted entities"""
        async with self.driver.session(database=self.database) as session:
            async with session.begin_transaction() as tx:
                
                # Create account node
                await tx.run(
                    "MERGE (a:Account {id: $account_name, name: $account_name, created_at: datetime()}) "
                    "ON CREATE SET a.updated_at = datetime() "
                    "ON MATCH SET a.updated_at = datetime()",
                    account_name=account_name
                )
                
                # Create person nodes
                people_created = 0
                for person in entities.get('people', []):
                    await tx.run(
                        "MERGE (p:Person {id: $person_id, name: $name}) "
                        "SET p.email = $email, p.role = $role, p.department = $department, "
                        "    p.organization = $organization, p.updated_at = datetime() "
                        "MERGE (a:Account {name: $account_name}) "
                        "MERGE (p)-[:ASSOCIATED_WITH]->(a)",
                        person_id=person.get('id', person['name'].lower().replace(' ', '_')),
                        name=person['name'],
                        email=person.get('email', ''),
                        role=person.get('role', ''),
                        department=person.get('department', ''),
                        organization=person.get('organization', ''),
                        account_name=account_name
                    )
                    people_created += 1
                
                # Create organization nodes
                orgs_created = 0
                for org in entities.get('organizations', []):
                    await tx.run(
                        "MERGE (o:Organization {id: $org_id, name: $name}) "
                        "SET o.industry = $industry, o.size = $size, o.updated_at = datetime() "
                        "MERGE (a:Account {name: $account_name}) "
                        "MERGE (o)-[:RELATED_TO]->(a)",
                        org_id=org.get('id', org['name'].lower().replace(' ', '_')),
                        name=org['name'],
                        industry=org.get('industry', ''),
                        size=org.get('size', ''),
                        account_name=account_name
                    )
                    orgs_created += 1
                
                # Create topic nodes
                topics_created = 0
                for topic in entities.get('topics', []):
                    await tx.run(
                        "MERGE (t:Topic {id: $topic_id, name: $name}) "
                        "SET t.category = $category, t.sentiment = $sentiment, "
                        "    t.importance = $importance, t.updated_at = datetime() "
                        "MERGE (a:Account {name: $account_name}) "
                        "MERGE (t)-[:DISCUSSED_IN]->(a)",
                        topic_id=topic.get('id', topic['name'].lower().replace(' ', '_')),
                        name=topic['name'],
                        category=topic.get('category', ''),
                        sentiment=topic.get('sentiment', 'neutral'),
                        importance=topic.get('importance', 0.5),
                        account_name=account_name
                    )
                    topics_created += 1
                
                # Create event nodes
                events_created = 0
                for event in entities.get('events', []):
                    await tx.run(
                        "MERGE (e:Event {id: $event_id, type: $type}) "
                        "SET e.date = $date, e.subject = $subject, e.summary = $summary, "
                        "    e.sentiment = $sentiment, e.updated_at = datetime() "
                        "MERGE (a:Account {name: $account_name}) "
                        "MERGE (e)-[:OCCURRED_IN]->(a)",
                        event_id=event.get('id', f"{event['type']}_{event.get('date', 'unknown')}"),
                        type=event['type'],
                        date=event.get('date', ''),
                        subject=event.get('subject', ''),
                        summary=event.get('summary', ''),
                        sentiment=event.get('sentiment', 'neutral'),
                        account_name=account_name
                    )
                    events_created += 1
                
                # Create relationships
                relationships_created = 0
                for rel in entities.get('relationships', []):
                    # Create relationship between entities
                    relationship_query = (
                        f"MATCH (source), (target) "
                        f"WHERE source.id = $source_id AND target.id = $target_id "
                        f"MERGE (source)-[r:{rel['type']}]->(target) "
                        f"SET r.strength = $strength, r.context = $context, "
                        f"    r.created_at = datetime(), r.updated_at = datetime() "
                        f"RETURN r"
                    )
                    
                    await tx.run(
                        relationship_query,
                        source_id=rel['source'],
                        target_id=rel['target'],
                        strength=rel.get('strength', 1.0),
                        context=rel.get('context', '')
                    )
                    relationships_created += 1
                
                # Calculate graph statistics
                stats_result = await tx.run(
                    "MATCH (a:Account {name: $account_name}) "
                    "OPTIONAL MATCH (a)<-[r1]-(n) "
                    "OPTIONAL MATCH (n)-[r2]-(m) "
                    "RETURN count(DISTINCT n) as node_count, count(DISTINCT r1) + count(DISTINCT r2) as relationship_count",
                    account_name=account_name
                )
                stats = await stats_result.single()
                
                graph_stats = {
                    'account_name': account_name,
                    'people_created': people_created,
                    'organizations_created': orgs_created,
                    'topics_created': topics_created,
                    'events_created': events_created,
                    'relationships_created': relationships_created,
                    'total_nodes': stats['node_count'] if stats else 0,
                    'total_relationships': stats['relationship_count'] if stats else 0
                }
                
                logger.info(f"🏗️ Built graph for {account_name}: {graph_stats}")
                return graph_stats
    
    async def find_related_entities(self, account_name: str, entity_id: str, max_hops: int = 3) -> List[Dict[str, Any]]:
        """Find entities related to a specific entity within max hops"""
        query = """
        MATCH (a:Account {name: $account_name})<-[:ASSOCIATED_WITH|:RELATED_TO|:DISCUSSED_IN|:OCCURRED_IN]-(start)
        WHERE start.id = $entity_id
        CALL apoc.path.expandConfig(start, {
            relationshipFilter: "PARTICIPATED_IN|DISCUSSED|WORKS_FOR|MENTIONED_IN",
            minLevel: 1,
            maxLevel: $max_hops,
            bfs: true
        }) YIELD path
        RETURN nodes(path) as entities, relationships(path) as relationships, length(path) as distance
        ORDER BY distance
        """
        
        async with self.driver.session(database=self.database) as session:
            result = await session.run(query, 
                                     account_name=account_name, 
                                     entity_id=entity_id, 
                                     max_hops=max_hops)
            
            related_entities = []
            async for record in result:
                entities = record['entities']
                relationships = record['relationships']
                distance = record['distance']
                
                for entity in entities:
                    related_entities.append({
                        'id': entity.get('id'),
                        'name': entity.get('name'),
                        'labels': list(entity.labels),
                        'properties': dict(entity),
                        'distance': distance
                    })
            
            return related_entities
    
    async def find_shortest_path(self, account_name: str, source_id: str, target_id: str) -> Optional[Dict[str, Any]]:
        """Find shortest path between two entities"""
        query = """
        MATCH (a:Account {name: $account_name})
        MATCH (source) WHERE source.id = $source_id
        MATCH (target) WHERE target.id = $target_id
        MATCH path = shortestPath((source)-[*]-(target))
        RETURN nodes(path) as entities, relationships(path) as relationships, length(path) as distance
        """
        
        async with self.driver.session(database=self.database) as session:
            result = await session.run(query, 
                                     account_name=account_name,
                                     source_id=source_id, 
                                     target_id=target_id)
            
            record = await result.single()
            if record:
                return {
                    'entities': [dict(entity) for entity in record['entities']],
                    'relationships': [dict(rel) for rel in record['relationships']],
                    'distance': record['distance']
                }
            return None
    
    async def detect_communities(self, account_name: str) -> List[Dict[str, Any]]:
        """Detect communities in the account graph"""
        # First, project graph for community detection
        project_query = """
        CALL gds.graph.project(
            'account-graph-' + $account_name,
            ['Person', 'Organization', 'Topic'],
            ['PARTICIPATED_IN', 'DISCUSSED', 'WORKS_FOR', 'MENTIONED_IN']
        )
        """
        
        # Run Louvain community detection
        community_query = """
        CALL gds.louvain.stream('account-graph-' + $account_name)
        YIELD nodeId, communityId
        RETURN gds.util.asNode(nodeId) as node, communityId
        """
        
        # Clean up projected graph
        cleanup_query = """
        CALL gds.graph.drop('account-graph-' + $account_name)
        """
        
        async with self.driver.session(database=self.database) as session:
            try:
                # Project graph
                await session.run(project_query, account_name=account_name)
                
                # Detect communities
                result = await session.run(community_query, account_name=account_name)
                
                communities = {}
                async for record in result:
                    node = record['node']
                    community_id = record['communityId']
                    
                    if community_id not in communities:
                        communities[community_id] = []
                    
                    communities[community_id].append({
                        'id': node.get('id'),
                        'name': node.get('name'),
                        'labels': list(node.labels),
                        'properties': dict(node)
                    })
                
                # Clean up
                await session.run(cleanup_query, account_name=account_name)
                
                return [{'id': cid, 'members': members} for cid, members in communities.items()]
                
            except Exception as e:
                logger.error(f"Community detection failed: {str(e)}")
                try:
                    await session.run(cleanup_query, account_name=account_name)
                except:
                    pass
                return []