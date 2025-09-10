"""
Entity Extractor Service for GraphRAG
Extracts entities and relationships from account data using NLP
"""

import asyncio
import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class EntityExtractor:
    def __init__(self):
        self.initialized = False
        
        # Common patterns for entity extraction
        self.email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        self.phone_pattern = re.compile(r'\b\d{3}-\d{3}-\d{4}\b|\b\(\d{3}\)\s*\d{3}-\d{4}\b')
        self.company_indicators = [
            'inc', 'corp', 'llc', 'ltd', 'company', 'corporation', 'technologies',
            'systems', 'solutions', 'services', 'group', 'enterprises'
        ]
        
        # Topic categories and keywords
        self.topic_categories = {
            'pricing': ['price', 'cost', 'budget', 'pricing', 'discount', 'fee', 'payment', 'invoice'],
            'technical': ['api', 'integration', 'development', 'technical', 'code', 'system', 'platform'],
            'security': ['security', 'compliance', 'privacy', 'audit', 'encryption', 'authentication'],
            'support': ['support', 'help', 'issue', 'problem', 'bug', 'maintenance', 'troubleshoot'],
            'business': ['business', 'strategy', 'growth', 'revenue', 'expansion', 'partnership'],
            'product': ['product', 'feature', 'functionality', 'capability', 'solution', 'offering'],
            'timeline': ['timeline', 'schedule', 'deadline', 'delivery', 'launch', 'implementation'],
            'meeting': ['meeting', 'call', 'discussion', 'presentation', 'demo', 'review']
        }
        
    async def initialize(self):
        """Initialize the entity extractor"""
        try:
            # In a production system, you might initialize spaCy or other NLP models here
            # For now, we'll use rule-based extraction
            self.initialized = True
            logger.info("✅ Entity extractor initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize entity extractor: {str(e)}")
            raise
    
    async def extract_from_account_data(self, account_data: Dict[str, Any], extract_relationships: bool = True) -> Dict[str, List[Dict[str, Any]]]:
        """Extract entities from comprehensive account data"""
        try:
            extracted = {
                'people': [],
                'organizations': [],
                'topics': [],
                'events': [],
                'relationships': []
            }
            
            account_name = account_data.get('accountName', 'unknown')
            
            # Extract from stakeholders
            if 'stakeholders' in account_data:
                people = await self._extract_people_from_stakeholders(account_data['stakeholders'])
                extracted['people'].extend(people)
            
            # Extract from emails
            if 'emails' in account_data:
                email_entities = await self._extract_from_emails(account_data['emails'])
                self._merge_entities(extracted, email_entities)
            
            # Extract from calls
            if 'calls' in account_data:
                call_entities = await self._extract_from_calls(account_data['calls'])
                self._merge_entities(extracted, call_entities)
            
            # Extract from interactions
            if 'interactions' in account_data:
                interaction_entities = await self._extract_from_interactions(account_data['interactions'])
                self._merge_entities(extracted, interaction_entities)
            
            # Extract from documents
            if 'documents' in account_data:
                doc_entities = await self._extract_from_documents(account_data['documents'])
                self._merge_entities(extracted, doc_entities)
            
            # Add account organization
            extracted['organizations'].append({
                'id': account_name.lower().replace(' ', '_'),
                'name': account_name,
                'type': 'primary_account',
                'industry': 'technology',  # Could be inferred from data
                'confidence': 1.0
            })
            
            # Extract relationships if requested
            if extract_relationships:
                relationships = await self._extract_relationships(extracted)
                extracted['relationships'] = relationships
            
            # Deduplicate entities
            extracted = await self._deduplicate_entities(extracted)
            
            logger.info(f"🔍 Extracted {len(extracted['people'])} people, "
                       f"{len(extracted['organizations'])} organizations, "
                       f"{len(extracted['topics'])} topics, "
                       f"{len(extracted['events'])} events, "
                       f"{len(extracted['relationships'])} relationships")
            
            return extracted
            
        except Exception as e:
            logger.error(f"❌ Entity extraction failed: {str(e)}")
            raise
    
    async def _extract_people_from_stakeholders(self, stakeholders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract people entities from stakeholder data"""
        people = []
        
        for stakeholder in stakeholders:
            if isinstance(stakeholder, dict):
                person = {
                    'id': stakeholder.get('name', '').lower().replace(' ', '_'),
                    'name': stakeholder.get('name', ''),
                    'email': stakeholder.get('email', ''),
                    'role': stakeholder.get('persona_type', ''),
                    'department': stakeholder.get('department', ''),
                    'organization': stakeholder.get('organization', ''),
                    'influence': stakeholder.get('influence', 'medium'),
                    'confidence': 0.9,
                    'source': 'stakeholder_data'
                }
                people.append(person)
        
        return people
    
    async def _extract_from_emails(self, emails: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Extract entities from email data"""
        entities = {
            'people': [],
            'organizations': [],
            'topics': [],
            'events': []
        }
        
        for email_thread in emails:
            if not isinstance(email_thread, dict):
                continue
                
            # Extract from each message in the thread
            messages = email_thread.get('messages', [])
            for message in messages:
                if not isinstance(message, dict):
                    continue
                
                # Extract people from email addresses
                sender = message.get('from', '')
                recipients = message.get('to', [])
                if isinstance(recipients, str):
                    recipients = [recipients]
                
                for email_addr in [sender] + recipients:
                    if email_addr and '@' in email_addr:
                        person = await self._extract_person_from_email(email_addr)
                        if person:
                            entities['people'].append(person)
                
                # Extract topics from subject and body
                subject = message.get('subject', '')
                body = message.get('body', '')
                text_content = f"{subject} {body}"
                
                topics = await self._extract_topics_from_text(text_content)
                entities['topics'].extend(topics)
                
                # Create email event
                event = {
                    'id': f"email_{message.get('timestamp', '')}",
                    'type': 'email',
                    'date': message.get('timestamp', ''),
                    'subject': subject,
                    'summary': body[:200] + '...' if len(body) > 200 else body,
                    'participants': [sender] + recipients,
                    'sentiment': await self._analyze_sentiment(body),
                    'confidence': 0.8,
                    'source': 'email_data'
                }
                entities['events'].append(event)
        
        return entities
    
    async def _extract_from_calls(self, calls: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Extract entities from call data"""
        entities = {
            'people': [],
            'organizations': [],
            'topics': [],
            'events': []
        }
        
        for call in calls:
            if not isinstance(call, dict):
                continue
            
            # Extract people from participants
            participants = call.get('participants', [])
            for participant in participants:
                person = {
                    'id': participant.lower().replace(' ', '_'),
                    'name': participant,
                    'confidence': 0.7,
                    'source': 'call_data'
                }
                entities['people'].append(person)
            
            # Extract topics from transcript
            transcript = call.get('transcript', [])
            transcript_text = ' '.join([turn.get('text', '') for turn in transcript])
            
            topics = await self._extract_topics_from_text(transcript_text)
            entities['topics'].extend(topics)
            
            # Create call event
            event = {
                'id': call.get('call_id', f"call_{call.get('date', '')}"),
                'type': 'call',
                'date': call.get('date', ''),
                'summary': transcript_text[:300] + '...' if len(transcript_text) > 300 else transcript_text,
                'participants': participants,
                'duration': call.get('duration', ''),
                'sentiment': await self._analyze_sentiment(transcript_text),
                'confidence': 0.8,
                'source': 'call_data'
            }
            entities['events'].append(event)
        
        return entities
    
    async def _extract_from_interactions(self, interactions: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Extract entities from interaction data"""
        entities = {
            'people': [],
            'organizations': [],
            'topics': [],
            'events': []
        }
        
        for interaction in interactions:
            if not isinstance(interaction, dict):
                continue
            
            # Extract people from participants
            participants = interaction.get('participants', [])
            for participant in participants:
                if isinstance(participant, str) and '@' in participant:
                    person = await self._extract_person_from_email(participant)
                    if person:
                        entities['people'].append(person)
            
            # Extract topics from summary
            summary = interaction.get('summary', '')
            topics = await self._extract_topics_from_text(summary)
            entities['topics'].extend(topics)
            
            # Create interaction event
            event = {
                'id': f"interaction_{interaction.get('date', '')}_{interaction.get('type', '')}",
                'type': interaction.get('type', 'interaction'),
                'date': interaction.get('date', ''),
                'summary': summary,
                'participants': participants,
                'sentiment': interaction.get('sentiment', 'neutral'),
                'confidence': 0.7,
                'source': 'interaction_data'
            }
            entities['events'].append(event)
        
        return entities
    
    async def _extract_from_documents(self, documents: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Extract entities from document data"""
        entities = {
            'people': [],
            'organizations': [],
            'topics': [],
            'events': []
        }
        
        for doc in documents:
            if not isinstance(doc, dict):
                continue
            
            # Extract topics from document content
            content = doc.get('content', '')
            title = doc.get('title', '')
            text_content = f"{title} {content}"
            
            topics = await self._extract_topics_from_text(text_content)
            entities['topics'].extend(topics)
            
            # Create document event
            event = {
                'id': f"document_{doc.get('id', '')}",
                'type': 'document',
                'date': doc.get('created_date', ''),
                'subject': title,
                'summary': content[:200] + '...' if len(content) > 200 else content,
                'confidence': 0.6,
                'source': 'document_data'
            }
            entities['events'].append(event)
        
        return entities
    
    async def _extract_person_from_email(self, email_address: str) -> Optional[Dict[str, Any]]:
        """Extract person entity from email address"""
        if not email_address or '@' not in email_address:
            return None
        
        # Extract name from email (simple heuristic)
        local_part = email_address.split('@')[0]
        domain = email_address.split('@')[1]
        
        # Try to infer name from email
        name_parts = re.split(r'[._-]', local_part)
        name = ' '.join([part.capitalize() for part in name_parts if part.isalpha()])
        
        # Infer organization from domain
        org_name = domain.split('.')[0].capitalize()
        
        return {
            'id': email_address.replace('@', '_at_').replace('.', '_'),
            'name': name if name else local_part,
            'email': email_address,
            'organization': org_name,
            'confidence': 0.6,
            'source': 'email_address'
        }
    
    async def _extract_topics_from_text(self, text: str) -> List[Dict[str, Any]]:
        """Extract topic entities from text content"""
        if not text:
            return []
        
        text_lower = text.lower()
        topics = []
        
        for category, keywords in self.topic_categories.items():
            matches = sum(1 for keyword in keywords if keyword in text_lower)
            if matches > 0:
                # Calculate importance based on keyword frequency
                importance = min(matches / len(keywords), 1.0)
                
                topic = {
                    'id': f"topic_{category}",
                    'name': category.replace('_', ' ').title(),
                    'category': category,
                    'importance': importance,
                    'keyword_matches': matches,
                    'confidence': min(0.3 + (importance * 0.7), 1.0),
                    'source': 'text_analysis'
                }
                topics.append(topic)
        
        # Extract custom topics using simple heuristics
        # Look for capitalized phrases that might be topics
        custom_topics = re.findall(r'\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        for topic_phrase in custom_topics[:5]:  # Limit to prevent noise
            if len(topic_phrase.split()) <= 3:  # Only short phrases
                topics.append({
                    'id': f"custom_{topic_phrase.lower().replace(' ', '_')}",
                    'name': topic_phrase,
                    'category': 'custom',
                    'importance': 0.5,
                    'confidence': 0.4,
                    'source': 'phrase_extraction'
                })
        
        return topics
    
    async def _analyze_sentiment(self, text: str) -> str:
        """Simple sentiment analysis"""
        if not text:
            return 'neutral'
        
        text_lower = text.lower()
        
        positive_words = ['good', 'great', 'excellent', 'positive', 'happy', 'satisfied', 'success', 'amazing']
        negative_words = ['bad', 'poor', 'negative', 'unhappy', 'problem', 'issue', 'concern', 'worried']
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            return 'positive'
        elif negative_count > positive_count:
            return 'negative'
        else:
            return 'neutral'
    
    async def _extract_relationships(self, entities: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Extract relationships between entities"""
        relationships = []
        
        # Create relationships between people and organizations
        for person in entities['people']:
            if person.get('organization'):
                org_id = person['organization'].lower().replace(' ', '_')
                relationships.append({
                    'source': person['id'],
                    'target': org_id,
                    'type': 'WORKS_FOR',
                    'strength': 0.8,
                    'context': 'employment'
                })
        
        # Create relationships between people and events (participation)
        for event in entities['events']:
            participants = event.get('participants', [])
            for participant in participants:
                if isinstance(participant, str):
                    participant_id = participant.replace('@', '_at_').replace('.', '_')
                    relationships.append({
                        'source': participant_id,
                        'target': event['id'],
                        'type': 'PARTICIPATED_IN',
                        'strength': 0.9,
                        'context': event['type']
                    })
        
        # Create relationships between events and topics
        for event in entities['events']:
            event_text = f"{event.get('subject', '')} {event.get('summary', '')}"
            for topic in entities['topics']:
                # Check if topic is discussed in event
                if any(keyword in event_text.lower() for keyword in self.topic_categories.get(topic.get('category', ''), [])):
                    relationships.append({
                        'source': event['id'],
                        'target': topic['id'],
                        'type': 'DISCUSSED',
                        'strength': topic.get('importance', 0.5),
                        'context': 'topic_discussion'
                    })
        
        return relationships
    
    async def _deduplicate_entities(self, entities: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[Dict[str, Any]]]:
        """Remove duplicate entities based on similarity"""
        for entity_type in entities.keys():
            if entity_type == 'relationships':
                continue
                
            seen_ids = set()
            unique_entities = []
            
            for entity in entities[entity_type]:
                entity_id = entity.get('id', '')
                if entity_id not in seen_ids:
                    seen_ids.add(entity_id)
                    unique_entities.append(entity)
            
            entities[entity_type] = unique_entities
        
        return entities
    
    def _merge_entities(self, target: Dict[str, List[Dict[str, Any]]], source: Dict[str, List[Dict[str, Any]]]):
        """Merge entities from source into target"""
        for entity_type, entity_list in source.items():
            if entity_type not in target:
                target[entity_type] = []
            target[entity_type].extend(entity_list)