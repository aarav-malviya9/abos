# ABOS - Autonomous Business Operating System

An AI-powered business operating system that can research, establish, operate, manage and optimize an online business with a zero-dollar software budget.

## Overview

ABOS is a fully autonomous system built on:
- **AI Orchestration**: n8n Community Edition for workflow automation
- **AI Inference**: FreeLLMAPI endpoint (local LLM)
- **Database**: SQLite (lightweight, zero-config)
- **Frontend**: Next.js 14+ with Tailwind CSS (dark theme)
- **Deployment**: Cloudflare Pages (free tier)
- **Source Control**: GitHub

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ABOS Dashboard                         │
│  (Next.js + React + Tailwind - Dark Theme)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API + WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                      API Server                             │
│  (Express + TypeScript)                                    │
└──────────────────────────┬──────────────────────────────────┘
         ┌──────────────────┼──────────────────┐
         ▼                 ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│  AI Agents     │ │   Database     │ │   n8n          │
│  (8 Agents)    │ │  (SQLite)      │ │  Workflows     │
└────────────────┘ └────────────────┘ └────────────────┘
         │                 │                  │
         └─────────────────┴──────────────────┘
                           │
                    ┌──────▼──────┐
                    │ FreeLLMAPI  │
                    │ (Local LLM) │
                    └─────────────┘
```

## AI Agents

1. **CEO Agent** - Coordinates all agents, creates strategic plans, delegates work
2. **Market Research Agent** - Discovers opportunities, analyzes demand/competition
3. **Product Agent** - Designs products, creates offers, evaluates pricing
4. **Development Agent** - Builds websites/apps, tests code, fixes errors
5. **Marketing Agent** - Creates strategies, produces content, plans campaigns
6. **Sales Agent** - Researches customers, maintains CRM, prepares outreach
7. **Operations Agent** - Manages enquiries, tracks orders, maintains docs
8. **Finance Agent** - Tracks revenue/expenses, calculates margins, produces reports

## n8n Workflows

- Daily CEO Reports
- Market Research (every 6 hours)
- Competitor Monitoring (daily)
- Opportunity Discovery (weekly)
- Content Generation (daily)
- Customer Intake (webhook)
- CRM Management (daily)
- Sales Pipeline Tracking (daily)
- Website Monitoring (every 15 min)
- Financial Reporting (daily/weekly/monthly)
- Weekly Business Review (Monday)

## Dashboard Pages

- **Overview** - Business health, key metrics, agent status
- **Projects** - Active business projects
- **Agents** - Agent status, performance, task queue
- **Tasks** - Task management, filtering
- **Financials** - Revenue, expenses, margins
- **CRM** - Leads, contacts, deals pipeline
- **Marketing** - Content calendar, performance
- **Analytics** - Website traffic, conversions
- **Automation** - Workflow execution history
- **Approvals** - Pending approval requests
- **Recommendations** - Strategic recommendations

## Zero-Budget Compliance

- ✅ No paid APIs (FreeLLMAPI local)
- ✅ No paid subscriptions (n8n Community, SQLite, Next.js, Cloudflare Pages free)
- ✅ No premium templates (custom Tailwind components)
- ✅ No paid hosting assumptions
- ✅ No hardcoded API keys (env vars only)
- ✅ Local inference via FreeLLMAPI
- ✅ Free service quotas documented

## Quick Start

```bash
# Clone and setup
git clone <repo> abos
cd abos
copy .env.example .env
# Edit .env with your FreeLLMAPI key

# Start all services
scripts\start-abos.bat
```

Access:
- Dashboard: http://localhost:3000
- API: http://localhost:3001
- n8n: http://localhost:5678

## Documentation

- [Installation Guide](docs/installation.md)
- [Architecture](docs/architecture.md)
- [Operations](docs/operations.md)

## License

MIT