# n8n Setup Instructions

## Quick Setup (Docker)

1. **Start n8n with Docker:**
```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e N8N_SECURE_COOKIE=false \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

2. **Access n8n at:** http://localhost:5678

3. **Create API Key:**
   - Go to Settings > API Keys
   - Create new API key
   - Copy the key and update your `.env` file:
   ```env
   N8N_API_KEY=your_generated_api_key
   ```

## Alternative: npm Installation

```bash
npm install -g n8n
n8n start
```

## Testing the Integration

Once n8n is running and API keys are configured:

```bash
npm run dev
```

The system will automatically connect to n8n and create hybrid workflows combining internal processing with n8n automation capabilities.