"""
GraphRAG Service for People.AI Demo
Combines Neo4j, Pinecone, and Microsoft GraphRAG for enhanced account intelligence
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import logging
from contextlib import asynccontextmanager

from services.neo4j_service import Neo4jService
from services.pinecone_service import PineconeService
from services.entity_extractor import EntityExtractor
from services.graphrag_processor import GraphRAGProcessor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global services
neo4j_service: Optional[Neo4jService] = None
pinecone_service: Optional[PineconeService] = None
entity_extractor: Optional[EntityExtractor] = None
graphrag_processor: Optional[GraphRAGProcessor] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup"""
    global neo4j_service, pinecone_service, entity_extractor, graphrag_processor
    
    logger.info("🚀 Starting GraphRAG Service...")
    
    try:
        # Initialize services
        neo4j_service = Neo4jService()
        await neo4j_service.connect()
        
        pinecone_service = PineconeService()
        await pinecone_service.initialize()
        
        entity_extractor = EntityExtractor()
        await entity_extractor.initialize()
        
        graphrag_processor = GraphRAGProcessor(neo4j_service, pinecone_service)
        await graphrag_processor.initialize()
        
        logger.info("✅ All services initialized successfully")
        yield
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {str(e)}")
        raise
    finally:
        # Cleanup
        if neo4j_service:
            await neo4j_service.close()
        if pinecone_service:
            await pinecone_service.close()
        logger.info("🧹 Services cleaned up")

app = FastAPI(
    title="GraphRAG Service",
    description="Advanced AI-powered graph reasoning for account intelligence",
    version="1.0.0",
    lifespan=lifespan
)

# Request/Response Models
class AccountData(BaseModel):
    accountName: str
    emails: List[Dict[str, Any]] = []
    calls: List[Dict[str, Any]] = []
    stakeholders: List[Dict[str, Any]] = []
    documents: List[Dict[str, Any]] = []
    interactions: List[Dict[str, Any]] = []

class EntityExtractionRequest(BaseModel):
    accountData: AccountData
    extractRelationships: bool = True

class GraphQueryRequest(BaseModel):
    accountName: str
    query: str
    maxHops: int = 3
    includeEmbeddings: bool = True

class GraphInsight(BaseModel):
    type: str
    confidence: float
    evidence: List[Dict[str, Any]]
    relationships: List[Dict[str, Any]]
    summary: str

class GraphRAGResponse(BaseModel):
    insights: List[GraphInsight]
    entityCount: int
    relationshipCount: int
    communityCount: int
    processingTime: float

# Health Check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "services": {
            "neo4j": neo4j_service is not None and neo4j_service.is_connected(),
            "pinecone": pinecone_service is not None and pinecone_service.is_initialized(),
            "entity_extractor": entity_extractor is not None,
            "graphrag_processor": graphrag_processor is not None
        },
        "timestamp": asyncio.get_event_loop().time()
    }

# Entity Extraction
@app.post("/extract-entities")
async def extract_entities(request: EntityExtractionRequest):
    """Extract entities from account data"""
    try:
        if not entity_extractor:
            raise HTTPException(status_code=503, detail="Entity extractor not initialized")
        
        logger.info(f"🔍 Extracting entities for account: {request.accountData.accountName}")
        
        # Extract entities from all data sources
        entities = await entity_extractor.extract_from_account_data(
            request.accountData.dict(),
            extract_relationships=request.extractRelationships
        )
        
        return {
            "accountName": request.accountData.accountName,
            "entities": entities,
            "extractedAt": asyncio.get_event_loop().time()
        }
        
    except Exception as e:
        logger.error(f"❌ Entity extraction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Entity extraction failed: {str(e)}")

# Graph Construction
@app.post("/build-graph")
async def build_graph(request: EntityExtractionRequest, background_tasks: BackgroundTasks):
    """Build knowledge graph from account data"""
    try:
        if not neo4j_service or not entity_extractor:
            raise HTTPException(status_code=503, detail="Required services not initialized")
        
        logger.info(f"🏗️ Building graph for account: {request.accountData.accountName}")
        
        # Extract entities first
        entities = await entity_extractor.extract_from_account_data(
            request.accountData.dict(),
            extract_relationships=request.extractRelationships
        )
        
        # Build graph in Neo4j
        graph_stats = await neo4j_service.build_account_graph(
            request.accountData.accountName,
            entities
        )
        
        return {
            "accountName": request.accountData.accountName,
            "graphStats": graph_stats,
            "builtAt": asyncio.get_event_loop().time()
        }
        
    except Exception as e:
        logger.error(f"❌ Graph building failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Graph building failed: {str(e)}")

# Vector Storage
@app.post("/store-embeddings")
async def store_embeddings(request: AccountData):
    """Store document embeddings in Pinecone"""
    try:
        if not pinecone_service:
            raise HTTPException(status_code=503, detail="Pinecone service not initialized")
        
        logger.info(f"📝 Storing embeddings for account: {request.accountName}")
        
        # Extract text content from all data sources
        documents = []
        
        # Add email content
        for email in request.emails:
            for message in email.get('messages', []):
                documents.append({
                    'id': f"email_{email.get('thread_id')}_{message.get('timestamp')}",
                    'text': message.get('body', ''),
                    'metadata': {
                        'type': 'email',
                        'account': request.accountName,
                        'thread_id': email.get('thread_id'),
                        'subject': message.get('subject', ''),
                        'timestamp': message.get('timestamp')
                    }
                })
        
        # Add call content
        for call in request.calls:
            transcript_text = ' '.join([turn.get('text', '') for turn in call.get('transcript', [])])
            documents.append({
                'id': f"call_{call.get('call_id')}",
                'text': transcript_text,
                'metadata': {
                    'type': 'call',
                    'account': request.accountName,
                    'call_id': call.get('call_id'),
                    'date': call.get('date'),
                    'participants': call.get('participants', [])
                }
            })
        
        # Store embeddings
        storage_stats = await pinecone_service.store_documents(documents)
        
        return {
            "accountName": request.accountName,
            "documentsStored": len(documents),
            "storageStats": storage_stats,
            "storedAt": asyncio.get_event_loop().time()
        }
        
    except Exception as e:
        logger.error(f"❌ Embedding storage failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Embedding storage failed: {str(e)}")

# GraphRAG Query
@app.post("/graphrag-query", response_model=GraphRAGResponse)
async def graphrag_query(request: GraphQueryRequest):
    """Perform GraphRAG query combining graph and vector search"""
    try:
        if not graphrag_processor:
            raise HTTPException(status_code=503, detail="GraphRAG processor not initialized")
        
        logger.info(f"🧠 Processing GraphRAG query for account: {request.accountName}")
        
        start_time = asyncio.get_event_loop().time()
        
        # Process query using GraphRAG
        result = await graphrag_processor.process_query(
            account_name=request.accountName,
            query=request.query,
            max_hops=request.maxHops,
            include_embeddings=request.includeEmbeddings
        )
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return GraphRAGResponse(
            insights=result['insights'],
            entityCount=result['entityCount'],
            relationshipCount=result['relationshipCount'],
            communityCount=result['communityCount'],
            processingTime=processing_time
        )
        
    except Exception as e:
        logger.error(f"❌ GraphRAG query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GraphRAG query failed: {str(e)}")

# Account Analysis
@app.post("/analyze-account")
async def analyze_account(request: AccountData):
    """Full account analysis using GraphRAG pipeline"""
    try:
        logger.info(f"📊 Running full GraphRAG analysis for account: {request.accountName}")
        
        start_time = asyncio.get_event_loop().time()
        
        # 1. Extract entities and build graph
        entities = await entity_extractor.extract_from_account_data(
            request.dict(),
            extract_relationships=True
        )
        
        # 2. Build Neo4j graph
        graph_stats = await neo4j_service.build_account_graph(
            request.accountName,
            entities
        )
        
        # 3. Store embeddings in Pinecone
        documents = []
        for email in request.emails:
            for message in email.get('messages', []):
                documents.append({
                    'id': f"email_{email.get('thread_id')}_{message.get('timestamp')}",
                    'text': message.get('body', ''),
                    'metadata': {
                        'type': 'email',
                        'account': request.accountName,
                        'thread_id': email.get('thread_id')
                    }
                })
        
        storage_stats = await pinecone_service.store_documents(documents)
        
        # 4. Generate GraphRAG insights
        insights_result = await graphrag_processor.generate_account_insights(
            request.accountName
        )
        
        processing_time = asyncio.get_event_loop().time() - start_time
        
        return {
            "accountName": request.accountName,
            "graphStats": graph_stats,
            "storageStats": storage_stats,
            "insights": insights_result,
            "processingTime": processing_time,
            "analyzedAt": asyncio.get_event_loop().time()
        }
        
    except Exception as e:
        logger.error(f"❌ Account analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Account analysis failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)