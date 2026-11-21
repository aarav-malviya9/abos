# ABOS Installation Guide

## Prerequisites

- **Windows 11** (or Windows 10 with WSL2)
- **Node.js 20+** and npm
- **Docker Desktop** (for n8n)
- **Git**
- **FreeLLMAPI** running at `http://127.0.0.1:31415` with valid API key

## Quick Start

### 1. Clone and Configure

```bash
git clone <your-repo-url> abos
cd abos

# Copy environment template
copy .env.example .env

# Edit .env with your configuration
notepad .env
```

### 2. Configure Environment Variables

Required variables in `.env`:

```env
# FreeLLMAPI (REQUIRED)
LLM_API_URL=http://127.0.0.1:31415/v1
LLM_API_KEY=your-actual-api-key
LLM_MODEL=gpt-4o-mini

# n8n
N8N_PASSWORD=your-secure-password

# Optional: Cloudflare for deployment
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Optional: GitHub for source control
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
```

### 3. Start All Services

```bash
# Run the startup script
scripts\start-abos.bat
```

This will:
1. Start n8n via Docker Compose
2. Initialize the SQLite database
3. Start the API server on port 3001
4. Start the Dashboard on port 3000

### 4. Access the Services

- **Dashboard**: http://localhost:3000
- **API**: http://localhost:3001
- **n8n**: http://localhost:5678 (admin / your N8N_PASSWORD)

## Manual Service Management

### Start Individual Services

```bash
# Start n8n only
docker-compose up -d n8n

# Start API only
cd packages/api && npm run dev

# Start Dashboard only
cd packages/dashboard && npm run dev
```

### Database Operations

```bash
# Initialize database
cd packages/core && npm run db:init

# Backup database
cd packages/core && npm run db:backup
```

## Development Workflow

### Project Structure

```
abos/
├── packages/
│   ├── core/          # Shared utilities, database, LLM client
│   ├── agents/        # AI agent implementations
│   ├── n8n-workflows/ # n8n workflow JSON definitions
│   ├── dashboard/     # Next.js dashboard application
│   └── api/           # Express API server
├── n8n/               # n8n configuration
├── scripts/           # Startup and maintenance scripts
├── docs/              # Documentation
└── docker-compose.yml # Docker services
```

### Adding New Agents

1. Create agent in `packages/agents/src/`
2. Extend `BaseAgent` class
3. Register in `packages/agents/src/registry.ts`
4. Export from `packages/agents/src/index.ts`

### Adding n8n Workflows

1. Create workflow JSON in `packages/n8n-workflows/workflows/`
2. Import via n8n UI or API
3. Configure webhook URLs to point to API endpoints

## Troubleshooting

### n8n Won't Start

```bash
# Check Docker logs
docker-compose logs n8n

# Verify port 5678 is free
netstat -an | findstr 5678
```

### API Connection Failed

```bash
# Check API logs
# Verify .env has correct LLM_API_KEY
# Test FreeLLMAPI directly:
curl -H "Authorization: Bearer YOUR_KEY" http://127.0.0.1:31415/v1/models
```

### Dashboard Not Loading

```bash
# Check for build errors
cd packages/dashboard && npm run build

# Verify API proxy in next.config.js
# Check browser console for CORS errors
```

### Database Errors

```bash
# Delete and reinitialize
rm data/abos.db
cd packages/core && npm run db:init
```

## Production Deployment

### Dashboard to Cloudflare Pages

1. Push to GitHub repository
2. Connect repository to Cloudflare Pages
3. Build command: `npm run build`
4. Output directory: `packages/dashboard/.next`
5. Environment variables: Set in Cloudflare dashboard

### n8n Production

- Use PostgreSQL instead of SQLite
- Configure proper authentication
- Set up reverse proxy with SSL
- Configure backup strategy

## Security Considerations

- Never commit `.env` file
- Use strong passwords for n8n
- Rotate API keys regularly
- Enable HTTPS in production
- Restrict n8n webhook endpoints

## Support

- Check logs in each service window
- Review `data/abos.db` with SQLite browser
- Monitor n8n executions in UI
- Check API health at `/health`