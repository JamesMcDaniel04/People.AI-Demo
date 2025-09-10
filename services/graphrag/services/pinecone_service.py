"""
Pinecone Service for GraphRAG
Handles vector database operations for semantic search and embedding storage
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
import os
import hashlib
from pinecone import Pinecone, ServerlessSpec
import openai
from openai import OpenAI
import numpy as np

logger = logging.getLogger(__name__)

class PineconeService:
    def __init__(self):
        self.client = None
        self.index = None
        self.openai_client = None
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.environment = os.getenv("PINECONE_ENVIRONMENT", "us-east-1-aws")
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "people-ai-demo")
        self.dimension = 1536  # OpenAI ada-002 embedding dimension
        self.initialized = False
        
    async def initialize(self):
        """Initialize Pinecone client and create/connect to index"""
        try:
            if not self.api_key:
                logger.warning("⚠️ No Pinecone API key found, using mock mode")
                self.initialized = True
                return
            
            # Initialize Pinecone
            self.client = Pinecone(api_key=self.api_key)
            
            # Initialize OpenAI for embeddings
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if not openai_api_key:
                raise ValueError("OpenAI API key required for embeddings")
            
            self.openai_client = OpenAI(api_key=openai_api_key)
            
            # Create or connect to index
            await self._setup_index()
            
            self.initialized = True
            logger.info("✅ Pinecone service initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Pinecone: {str(e)}")
            raise
    
    async def close(self):
        """Close Pinecone connections"""
        self.initialized = False
        logger.info("🔐 Pinecone service closed")
    
    def is_initialized(self) -> bool:
        """Check if Pinecone is initialized"""
        return self.initialized
    
    async def _setup_index(self):
        """Create or connect to Pinecone index"""
        try:
            # Check if index exists
            existing_indexes = [idx.name for idx in self.client.list_indexes()]
            
            if self.index_name not in existing_indexes:
                logger.info(f"🔨 Creating new Pinecone index: {self.index_name}")
                
                # Create index with serverless spec
                self.client.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric='cosine',
                    spec=ServerlessSpec(
                        cloud='aws',
                        region=self.environment.split('-')[0] + '-' + self.environment.split('-')[1] + '-' + self.environment.split('-')[2]
                    )
                )
                
                # Wait for index to be ready
                import time
                while not self.client.describe_index(self.index_name).status['ready']:
                    logger.info("⏳ Waiting for index to be ready...")
                    time.sleep(1)
            
            # Connect to index
            self.index = self.client.Index(self.index_name)
            logger.info(f"✅ Connected to Pinecone index: {self.index_name}")
            
        except Exception as e:
            logger.error(f"❌ Index setup failed: {str(e)}")
            raise
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using OpenAI"""
        if not self.openai_client:
            # Return mock embedding for demo
            return [0.1] * self.dimension
        
        try:
            response = self.openai_client.embeddings.create(
                model="text-embedding-ada-002",
                input=text.replace("\n", " ")[:8000]  # Limit text length
            )
            return response.data[0].embedding
            
        except Exception as e:
            logger.error(f"❌ Embedding generation failed: {str(e)}")
            # Return mock embedding as fallback
            return [0.1] * self.dimension
    
    async def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts"""
        if not self.openai_client:
            # Return mock embeddings
            return [[0.1] * self.dimension for _ in texts]
        
        try:
            # Process in batches to avoid API limits
            batch_size = 100
            all_embeddings = []
            
            for i in range(0, len(texts), batch_size):
                batch_texts = texts[i:i + batch_size]
                
                # Clean texts
                cleaned_texts = [text.replace("\n", " ")[:8000] for text in batch_texts]
                
                response = self.openai_client.embeddings.create(
                    model="text-embedding-ada-002",
                    input=cleaned_texts
                )
                
                batch_embeddings = [item.embedding for item in response.data]
                all_embeddings.extend(batch_embeddings)
                
                # Small delay to respect rate limits
                await asyncio.sleep(0.1)
            
            return all_embeddings
            
        except Exception as e:
            logger.error(f"❌ Batch embedding generation failed: {str(e)}")
            # Return mock embeddings as fallback
            return [[0.1] * self.dimension for _ in texts]
    
    async def store_documents(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Store documents with embeddings in Pinecone"""
        if not self.initialized or not self.index:
            logger.warning("⚠️ Pinecone not initialized, storing in mock mode")
            return {
                'stored_count': len(documents),
                'mock_mode': True
            }
        
        try:
            # Extract texts for embedding
            texts = [doc['text'] for doc in documents]
            
            # Generate embeddings
            embeddings = await self.generate_embeddings_batch(texts)
            
            # Prepare vectors for upsert
            vectors = []
            for i, doc in enumerate(documents):
                vector_id = doc.get('id') or self._generate_id(doc['text'])
                
                vectors.append({
                    'id': vector_id,
                    'values': embeddings[i],
                    'metadata': {
                        **doc.get('metadata', {}),
                        'text': doc['text'][:1000],  # Store truncated text in metadata
                        'text_length': len(doc['text'])
                    }
                })
            
            # Upsert vectors in batches
            batch_size = 100
            upserted_count = 0
            
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                self.index.upsert(vectors=batch)
                upserted_count += len(batch)
                
                # Small delay between batches
                await asyncio.sleep(0.1)
            
            logger.info(f"📝 Stored {upserted_count} documents in Pinecone")
            
            return {
                'stored_count': upserted_count,
                'total_vectors': len(vectors),
                'mock_mode': False
            }
            
        except Exception as e:
            logger.error(f"❌ Document storage failed: {str(e)}")
            return {
                'stored_count': 0,
                'error': str(e),
                'mock_mode': False
            }
    
    async def semantic_search(self, query: str, top_k: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Perform semantic search using query embedding"""
        if not self.initialized or not self.index:
            logger.warning("⚠️ Pinecone not initialized, returning mock results")
            return self._mock_search_results(query, top_k)
        
        try:
            # Generate query embedding
            query_embedding = await self.generate_embedding(query)
            
            # Perform search
            search_results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True,
                filter=filters
            )
            
            # Format results
            results = []
            for match in search_results.matches:
                results.append({
                    'id': match.id,
                    'score': match.score,
                    'metadata': match.metadata,
                    'text': match.metadata.get('text', '')
                })
            
            logger.info(f"🔍 Found {len(results)} semantic search results for query: {query[:50]}...")
            return results
            
        except Exception as e:
            logger.error(f"❌ Semantic search failed: {str(e)}")
            return self._mock_search_results(query, top_k)
    
    async def hybrid_search(self, query: str, graph_context: List[str], top_k: int = 10) -> List[Dict[str, Any]]:
        """Perform hybrid search combining semantic similarity and graph context"""
        try:
            # Perform semantic search
            semantic_results = await self.semantic_search(query, top_k * 2)
            
            # Score results based on graph context relevance
            context_keywords = set()
            for context in graph_context:
                context_keywords.update(context.lower().split())
            
            # Re-rank results based on context overlap
            for result in semantic_results:
                text_keywords = set(result['text'].lower().split())
                context_overlap = len(context_keywords & text_keywords)
                
                # Combine semantic score with context relevance
                result['hybrid_score'] = result['score'] * 0.7 + (context_overlap / max(len(context_keywords), 1)) * 0.3
                result['context_relevance'] = context_overlap
            
            # Sort by hybrid score and return top_k
            hybrid_results = sorted(semantic_results, key=lambda x: x['hybrid_score'], reverse=True)[:top_k]
            
            logger.info(f"🔍 Hybrid search returned {len(hybrid_results)} results")
            return hybrid_results
            
        except Exception as e:
            logger.error(f"❌ Hybrid search failed: {str(e)}")
            return await self.semantic_search(query, top_k)
    
    async def get_similar_documents(self, document_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Find documents similar to a specific document"""
        if not self.initialized or not self.index:
            return []
        
        try:
            # Get the document vector
            fetch_result = self.index.fetch(ids=[document_id])
            
            if document_id not in fetch_result.vectors:
                logger.warning(f"Document {document_id} not found")
                return []
            
            document_vector = fetch_result.vectors[document_id].values
            
            # Search for similar documents
            search_results = self.index.query(
                vector=document_vector,
                top_k=top_k + 1,  # +1 to exclude the original document
                include_metadata=True
            )
            
            # Filter out the original document and format results
            results = []
            for match in search_results.matches:
                if match.id != document_id:
                    results.append({
                        'id': match.id,
                        'score': match.score,
                        'metadata': match.metadata,
                        'text': match.metadata.get('text', '')
                    })
            
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"❌ Similar document search failed: {str(e)}")
            return []
    
    def _generate_id(self, text: str) -> str:
        """Generate unique ID for text content"""
        return hashlib.md5(text.encode()).hexdigest()
    
    def _mock_search_results(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """Generate mock search results for demo"""
        mock_results = []
        for i in range(min(top_k, 5)):
            mock_results.append({
                'id': f'mock_doc_{i}',
                'score': 0.8 - (i * 0.1),
                'metadata': {
                    'type': 'mock',
                    'query': query
                },
                'text': f'Mock document {i} related to: {query}'
            })
        return mock_results