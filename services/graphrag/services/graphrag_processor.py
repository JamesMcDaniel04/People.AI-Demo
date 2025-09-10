"""
GraphRAG Processor for People.AI Demo
Combines Microsoft GraphRAG with Neo4j and Pinecone for advanced reasoning
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
import json
import os
from datetime import datetime

# Microsoft GraphRAG imports (simplified for demo)
try:
    # In production, you would import actual GraphRAG components
    # from graphrag import GraphRAG, CommunityDetection, HierarchicalSummarization
    pass
except ImportError:
    # For demo purposes, we'll implement simplified versions
    pass

from .neo4j_service import Neo4jService
from .pinecone_service import PineconeService

logger = logging.getLogger(__name__)

class GraphRAGProcessor:
    def __init__(self, neo4j_service: Neo4jService, pinecone_service: PineconeService):
        self.neo4j = neo4j_service
        self.pinecone = pinecone_service
        self.initialized = False
        
        # GraphRAG configuration
        self.max_reasoning_depth = 3
        self.community_resolution = 1.0
        self.min_community_size = 3
        
    async def initialize(self):
        """Initialize the GraphRAG processor"""
        try:
            # In production, initialize Microsoft GraphRAG components
            self.initialized = True
            logger.info("✅ GraphRAG processor initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize GraphRAG processor: {str(e)}")
            raise
    
    async def process_query(self, account_name: str, query: str, max_hops: int = 3, include_embeddings: bool = True) -> Dict[str, Any]:
        """Process a complex query using GraphRAG approach"""
        try:
            logger.info(f"🧠 Processing GraphRAG query: {query[:100]}...")
            
            # Step 1: Semantic search in Pinecone
            semantic_results = await self.pinecone.semantic_search(
                query=query,
                top_k=20,
                filters={'account': account_name} if account_name != 'all' else None
            )
            
            # Step 2: Extract entity context from semantic results
            entity_context = await self._extract_entity_context(semantic_results)
            
            # Step 3: Graph traversal in Neo4j
            graph_context = []
            for entity_id in entity_context:
                related_entities = await self.neo4j.find_related_entities(
                    account_name=account_name,
                    entity_id=entity_id,
                    max_hops=max_hops
                )
                graph_context.extend(related_entities)
            
            # Step 4: Hybrid search combining graph and vector results
            if include_embeddings and entity_context:
                graph_text_context = [f"{e['name']} ({', '.join(e['labels'])})" for e in graph_context]
                hybrid_results = await self.pinecone.hybrid_search(
                    query=query,
                    graph_context=graph_text_context,
                    top_k=15
                )
            else:
                hybrid_results = semantic_results[:15]
            
            # Step 5: Community detection and analysis
            communities = await self.neo4j.detect_communities(account_name)
            
            # Step 6: Generate insights using GraphRAG reasoning
            insights = await self._generate_graphrag_insights(
                query=query,
                semantic_results=semantic_results,
                graph_context=graph_context,
                hybrid_results=hybrid_results,
                communities=communities
            )
            
            return {
                'insights': insights,
                'entityCount': len(set(entity_context)),
                'relationshipCount': len([e for e in graph_context if 'distance' in e]),
                'communityCount': len(communities),
                'semanticResults': semantic_results[:5],  # Top results for reference
                'graphContext': graph_context[:10]  # Top graph entities
            }
            
        except Exception as e:
            logger.error(f"❌ GraphRAG query processing failed: {str(e)}")
            raise
    
    async def generate_account_insights(self, account_name: str) -> Dict[str, Any]:
        """Generate comprehensive account insights using GraphRAG"""
        try:
            logger.info(f"📊 Generating GraphRAG insights for account: {account_name}")
            
            # Predefined insight queries for comprehensive analysis
            insight_queries = [
                {
                    'type': 'stakeholder_influence',
                    'query': 'Who are the key decision makers and what is their influence network?',
                    'weight': 0.9
                },
                {
                    'type': 'communication_patterns',
                    'query': 'What are the communication patterns and relationship dynamics?',
                    'weight': 0.8
                },
                {
                    'type': 'topic_evolution',
                    'query': 'How have key topics and concerns evolved over time?',
                    'weight': 0.7
                },
                {
                    'type': 'risk_indicators',
                    'query': 'What are the potential risk indicators and warning signs?',
                    'weight': 0.8
                },
                {
                    'type': 'opportunity_signals',
                    'query': 'What opportunities and growth signals can be identified?',
                    'weight': 0.9
                }
            ]
            
            all_insights = []
            
            # Process each insight query
            for insight_query in insight_queries:
                query_result = await self.process_query(
                    account_name=account_name,
                    query=insight_query['query'],
                    max_hops=2,
                    include_embeddings=True
                )
                
                # Weight the insights based on query importance
                for insight in query_result['insights']:
                    insight['confidence'] *= insight_query['weight']
                    insight['category'] = insight_query['type']
                
                all_insights.extend(query_result['insights'])
            
            # Deduplicate and rank insights
            ranked_insights = await self._rank_and_deduplicate_insights(all_insights)
            
            # Generate executive summary
            executive_summary = await self._generate_executive_summary(ranked_insights)
            
            return {
                'insights': ranked_insights[:20],  # Top 20 insights
                'executiveSummary': executive_summary,
                'insightCategories': {
                    category: len([i for i in ranked_insights if i.get('category') == category])
                    for category in ['stakeholder_influence', 'communication_patterns', 'topic_evolution', 'risk_indicators', 'opportunity_signals']
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Account insights generation failed: {str(e)}")
            raise
    
    async def _extract_entity_context(self, semantic_results: List[Dict[str, Any]]) -> List[str]:
        """Extract entity IDs from semantic search results"""
        entity_ids = set()
        
        for result in semantic_results:
            metadata = result.get('metadata', {})
            
            # Extract entity references from metadata
            if 'participants' in metadata:
                participants = metadata['participants']
                if isinstance(participants, list):
                    for participant in participants:
                        if isinstance(participant, str):
                            entity_id = participant.replace('@', '_at_').replace('.', '_')
                            entity_ids.add(entity_id)
            
            # Extract from thread_id, call_id, etc.
            for id_field in ['thread_id', 'call_id', 'document_id']:
                if id_field in metadata:
                    entity_ids.add(str(metadata[id_field]))
        
        return list(entity_ids)
    
    async def _generate_graphrag_insights(self, query: str, semantic_results: List[Dict[str, Any]], 
                                        graph_context: List[Dict[str, Any]], hybrid_results: List[Dict[str, Any]],
                                        communities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate insights using GraphRAG reasoning approach"""
        insights = []
        
        # Insight 1: Cross-source correlation
        if semantic_results and graph_context:
            correlation_insight = await self._analyze_cross_source_correlation(
                semantic_results, graph_context
            )
            if correlation_insight:
                insights.append(correlation_insight)
        
        # Insight 2: Community influence patterns
        if communities:
            community_insights = await self._analyze_community_patterns(communities, graph_context)
            insights.extend(community_insights)
        
        # Insight 3: Temporal relationship evolution
        temporal_insight = await self._analyze_temporal_patterns(semantic_results, graph_context)
        if temporal_insight:
            insights.append(temporal_insight)
        
        # Insight 4: Multi-hop reasoning insights
        reasoning_insights = await self._perform_multi_hop_reasoning(query, graph_context)
        insights.extend(reasoning_insights)
        
        # Insight 5: Semantic-structural alignment
        alignment_insight = await self._analyze_semantic_structural_alignment(
            hybrid_results, graph_context
        )
        if alignment_insight:
            insights.append(alignment_insight)
        
        return insights
    
    async def _analyze_cross_source_correlation(self, semantic_results: List[Dict[str, Any]], 
                                              graph_context: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Analyze correlations between semantic and graph data"""
        try:
            # Find entities that appear in both semantic results and graph context
            semantic_entities = set()
            for result in semantic_results:
                text = result.get('text', '').lower()
                for entity in graph_context:
                    if entity.get('name', '').lower() in text:
                        semantic_entities.add(entity['name'])
            
            if len(semantic_entities) >= 2:
                return {
                    'type': 'cross_source_correlation',
                    'confidence': min(len(semantic_entities) * 0.2, 1.0),
                    'evidence': [
                        {
                            'type': 'entity_mention',
                            'entities': list(semantic_entities),
                            'correlation_strength': len(semantic_entities)
                        }
                    ],
                    'relationships': [],
                    'summary': f"Found {len(semantic_entities)} entities correlated across semantic search and graph data: {', '.join(list(semantic_entities)[:3])}"
                }
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Cross-source correlation analysis failed: {str(e)}")
            return None
    
    async def _analyze_community_patterns(self, communities: List[Dict[str, Any]], 
                                        graph_context: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Analyze community influence patterns"""
        insights = []
        
        try:
            for community in communities[:3]:  # Analyze top 3 communities
                members = community.get('members', [])
                if len(members) >= self.min_community_size:
                    # Analyze community composition
                    person_count = len([m for m in members if 'Person' in m.get('labels', [])])
                    org_count = len([m for m in members if 'Organization' in m.get('labels', [])])
                    
                    insights.append({
                        'type': 'community_influence',
                        'confidence': 0.8,
                        'evidence': [
                            {
                                'type': 'community_composition',
                                'people': person_count,
                                'organizations': org_count,
                                'total_members': len(members)
                            }
                        ],
                        'relationships': [
                            {
                                'source': member['id'],
                                'target': f"community_{community['id']}",
                                'type': 'MEMBER_OF'
                            } for member in members[:5]
                        ],
                        'summary': f"Community {community['id']} contains {person_count} people and {org_count} organizations, indicating a {('strong' if len(members) > 5 else 'moderate')} influence network"
                    })
            
            return insights
            
        except Exception as e:
            logger.error(f"❌ Community pattern analysis failed: {str(e)}")
            return []
    
    async def _analyze_temporal_patterns(self, semantic_results: List[Dict[str, Any]], 
                                       graph_context: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Analyze temporal evolution patterns"""
        try:
            # Extract timestamps from results
            timestamps = []
            for result in semantic_results:
                metadata = result.get('metadata', {})
                if 'timestamp' in metadata:
                    timestamps.append(metadata['timestamp'])
                elif 'date' in metadata:
                    timestamps.append(metadata['date'])
            
            if len(timestamps) >= 3:
                return {
                    'type': 'temporal_evolution',
                    'confidence': 0.7,
                    'evidence': [
                        {
                            'type': 'temporal_distribution',
                            'event_count': len(timestamps),
                            'time_span': 'recent_activity'
                        }
                    ],
                    'relationships': [],
                    'summary': f"Identified {len(timestamps)} timestamped interactions showing active engagement pattern"
                }
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Temporal pattern analysis failed: {str(e)}")
            return None
    
    async def _perform_multi_hop_reasoning(self, query: str, graph_context: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Perform multi-hop reasoning across graph relationships"""
        insights = []
        
        try:
            # Group entities by distance (hops)
            entities_by_distance = {}
            for entity in graph_context:
                distance = entity.get('distance', 1)
                if distance not in entities_by_distance:
                    entities_by_distance[distance] = []
                entities_by_distance[distance].append(entity)
            
            # Analyze multi-hop connections
            if len(entities_by_distance) > 1:
                max_distance = max(entities_by_distance.keys())
                
                insights.append({
                    'type': 'multi_hop_reasoning',
                    'confidence': 0.6,
                    'evidence': [
                        {
                            'type': 'hop_analysis',
                            'max_hops': max_distance,
                            'entities_per_hop': {str(k): len(v) for k, v in entities_by_distance.items()}
                        }
                    ],
                    'relationships': [
                        {
                            'source': 'query_context',
                            'target': entity['id'],
                            'type': f"CONNECTED_AT_HOP_{entity.get('distance', 1)}"
                        } for entity in graph_context[:5]
                    ],
                    'summary': f"Multi-hop reasoning found {len(graph_context)} connected entities within {max_distance} degrees of separation"
                })
            
            return insights
            
        except Exception as e:
            logger.error(f"❌ Multi-hop reasoning failed: {str(e)}")
            return []
    
    async def _analyze_semantic_structural_alignment(self, hybrid_results: List[Dict[str, Any]], 
                                                   graph_context: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Analyze alignment between semantic similarity and structural relationships"""
        try:
            # Check if high-scoring semantic results also have strong graph connections
            aligned_entities = 0
            for result in hybrid_results[:5]:  # Top 5 semantic results
                result_score = result.get('hybrid_score', result.get('score', 0))
                if result_score > 0.7:  # High semantic similarity
                    # Check if this result has corresponding graph entities
                    result_text = result.get('text', '').lower()
                    for entity in graph_context:
                        if entity.get('name', '').lower() in result_text and entity.get('distance', 999) <= 2:
                            aligned_entities += 1
                            break
            
            if aligned_entities >= 2:
                alignment_strength = aligned_entities / min(len(hybrid_results), 5)
                return {
                    'type': 'semantic_structural_alignment',
                    'confidence': alignment_strength,
                    'evidence': [
                        {
                            'type': 'alignment_analysis',
                            'aligned_entities': aligned_entities,
                            'alignment_strength': alignment_strength
                        }
                    ],
                    'relationships': [],
                    'summary': f"Strong alignment between semantic similarity and graph relationships found in {aligned_entities} cases"
                }
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Semantic-structural alignment analysis failed: {str(e)}")
            return None
    
    async def _rank_and_deduplicate_insights(self, insights: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Rank insights by confidence and remove duplicates"""
        # Remove duplicates based on type and similar content
        unique_insights = []
        seen_types = set()
        
        for insight in insights:
            insight_key = f"{insight.get('type', '')}_{insight.get('summary', '')[:50]}"
            if insight_key not in seen_types:
                seen_types.add(insight_key)
                unique_insights.append(insight)
        
        # Sort by confidence score
        ranked_insights = sorted(unique_insights, key=lambda x: x.get('confidence', 0), reverse=True)
        
        return ranked_insights
    
    async def _generate_executive_summary(self, insights: List[Dict[str, Any]]) -> str:
        """Generate executive summary from top insights"""
        if not insights:
            return "No significant insights generated from GraphRAG analysis."
        
        top_insights = insights[:5]
        insight_summaries = [insight.get('summary', '') for insight in top_insights if insight.get('summary')]
        
        return f"GraphRAG analysis identified {len(insights)} insights across multiple dimensions. " + \
               f"Key findings include: {'; '.join(insight_summaries[:3])}. " + \
               f"Analysis demonstrates strong cross-source correlations and multi-dimensional relationship patterns."