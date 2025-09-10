#!/bin/bash

# GraphRAG Startup Script for People.AI Demo
# Starts Neo4j, GraphRAG Python service, and the main application

echo "🚀 Starting People.AI GraphRAG Demo Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required environment variables are set
if [ ! -f ".env" ]; then
    echo "⚠️ .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please configure your API keys in .env file and run again"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo "🔄 Starting Docker services..."

# Start Neo4j and Redis using docker-compose
docker-compose up -d neo4j redis

echo "⏳ Waiting for Neo4j to be ready..."
timeout=60
while [ $timeout -gt 0 ]; do
    if docker exec people-ai-neo4j cypher-shell -u neo4j -p peopleai2024 'RETURN 1' > /dev/null 2>&1; then
        echo "✅ Neo4j is ready"
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
    echo "❌ Neo4j failed to start within timeout"
    exit 1
fi

echo "⏳ Waiting for Redis to be ready..."
timeout=30
while [ $timeout -gt 0 ]; do
    if docker exec people-ai-redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is ready"
        break
    fi
    sleep 1
    timeout=$((timeout - 1))
done

if [ $timeout -le 0 ]; then
    echo "❌ Redis failed to start within timeout"
    exit 1
fi

# Check if Python GraphRAG service should be started
if [ "$GRAPHRAG_ENABLED" = "true" ]; then
    echo "🔄 Starting GraphRAG Python service..."
    
    # Build and start GraphRAG service
    docker-compose up -d graphrag-service
    
    echo "⏳ Waiting for GraphRAG service to be ready..."
    timeout=120
    while [ $timeout -gt 0 ]; do
        if curl -s http://localhost:8000/health > /dev/null; then
            echo "✅ GraphRAG service is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        echo "⚠️ GraphRAG service failed to start, continuing with mock mode"
    fi
else
    echo "⚠️ GraphRAG disabled, will use mock mode"
fi

echo "🔄 Installing Node.js dependencies..."
npm install

echo "🚀 Starting People.AI Account Planner with GraphRAG..."

# Start the main application
npm run dev &
MAIN_PID=$!

echo "✅ GraphRAG Demo Environment Started Successfully!"
echo ""
echo "📊 Services Available:"
echo "   • Main Dashboard: http://localhost:3001"
echo "   • Neo4j Browser: http://localhost:7474 (neo4j/peopleai2024)"
echo "   • Bull Board (Jobs): http://localhost:3001/admin/queues"
if [ "$GRAPHRAG_ENABLED" = "true" ]; then
    echo "   • GraphRAG API: http://localhost:8000"
    echo "   • GraphRAG Health: http://localhost:8000/health"
fi
echo ""
echo "🧠 GraphRAG Features:"
echo "   • Entity extraction and relationship mapping"
echo "   • Cross-source correlation analysis" 
echo "   • Community detection and influence patterns"
echo "   • Multi-hop reasoning and semantic search"
echo "   • Enhanced account planning insights"
echo ""
echo "📋 To generate a GraphRAG-enhanced account plan:"
echo "   curl -X POST http://localhost:3001/api/demo/spotify \\"
echo "        -H 'Content-Type: application/json' \\"
echo "        -d '{\"recipients\":[\"demo@example.com\"]}'"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for main process and handle cleanup
trap 'echo "🛑 Shutting down services..."; docker-compose down; kill $MAIN_PID; exit' INT TERM

wait $MAIN_PID