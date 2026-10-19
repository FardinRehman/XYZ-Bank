# XYZ Bank AI — voice banking support console

A web-only operations dashboard and API for an AI assistant that answers **real inbound telephone calls**. The initial repository includes staff authentication/RBAC, call records, approved knowledge articles, support tickets, audit events, PostgreSQL migrations, synthetic seed data, and an OpenAI Realtime direct-SIP webhook path.

> **Safety boundary:** This repository is a development starter, not a certified banking system. It uses synthetic records only. Do not connect production customer data or allow financial transactions until the bank's security, privacy, legal and operations teams approve the design and the required bank sandbox/production APIs are supplied. The AI is not permitted to initiate transfers or change account security settings.

## Architecture

- `apps/web`: React + TypeScript + Vite + Tailwind operations dashboard.
- `apps/api`: Node.js + Express + TypeScript API, JWT auth, role checks, PostgreSQL, audit trail and OpenAI SIP integration.
- `apps/api/migrations`: SQL schema and seed data.
- Direct SIP mode: configure a compatible SIP trunk to the OpenAI project SIP endpoint. OpenAI sends the incoming-call webhook to `POST /api/telephony/openai/webhook`; the server verifies its signature, applies policy, accepts the call, and opens a sideband WebSocket for server-side tool execution.

## Requirements

- Node.js 22+ and npm 10+
- Docker Desktop (recommended for local PostgreSQL) or PostgreSQL 15+
- An OpenAI API project with Realtime SIP enabled for real-call testing
- A domain with HTTPS for the production webhook; localhost alone cannot receive provider webhooks

## Local setup (Windows PowerShell)

```powershell
# From the repository root
Copy-Item .env.example .env
# Edit .env; change JWT_SECRET and SEED_ADMIN_PASSWORD before use.
docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173. API health check: http://localhost:4000/health.

Default local admin email is `admin@xyzbank.local`; the password comes from `SEED_ADMIN_PASSWORD` in `.env` (default shown in `.env.example`). Change it before any shared deployment. The seed script refuses to overwrite an existing user.

## Local setup (macOS/Linux)

```bash
cp .env.example .env
# Edit .env and change all secrets
 docker compose up -d postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

## Real inbound phone calls

1. Deploy the API to a public HTTPS host and set `PUBLIC_API_URL` to its HTTPS origin.
2. Configure `OPENAI_API_KEY`, `OPENAI_WEBHOOK_SECRET`, `OPENAI_SIP_ENABLED=true`, and select the model/voice in the API environment. Do not expose these variables to Vite or the browser.
3. In the OpenAI project, configure the webhook subscription for incoming Realtime SIP call events and set its URL to `https://YOUR_API_HOST/api/telephony/openai/webhook`.
4. Configure a SIP trunk/provider and route the bank's provisioned inbound number to the OpenAI SIP endpoint documented for your project. SIP signaling and SRTP requirements must be met by the provider/network.
5. Place a test call using a number you control. Watch API logs and the Calls page. Real calls require provider configuration; this repo cannot provision a number or enable account features automatically.
6. Before enabling a live number, test rejection paths, webhook replay, call disconnect, AI outage, human handoff, caller disclosure, retention, and emergency escalation.

Official references:
- OpenAI telephony/SIP: https://developers.openai.com/api/docs/guides/voice-sip
- OpenAI server-side voice controls: https://developers.openai.com/api/docs/guides/voice-server-controls
- OpenAI function tools: https://developers.openai.com/api/docs/guides/realtime-mcp

The incoming webhook handler verifies OpenAI's signed webhook envelope and deduplicates event IDs. The sideband tool executor only exposes `search_bank_faq` and `create_support_ticket`. Customer-specific balance/transaction tools are intentionally absent until an approved bank API and strong customer-verification flow are implemented.

## Environment variables

See `.env.example`. Important values:
- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: random secret of 32+ characters.
- `OPENAI_API_KEY` / `OPENAI_WEBHOOK_SECRET`: server-only OpenAI credentials.
- `OPENAI_SIP_ENABLED`: must be explicitly `true` to accept calls.
- `HUMAN_TRANSFER_URI`: approved SIP or `tel:` destination. Transfers should be validated against the bank's approved destination list before production.
- `STORE_TRANSCRIPTS`: defaults to false; do not enable until consent, retention and access policy are approved.

## Commands

```bash
npm run dev          # web + API
npm run build        # production build for both workspaces
npm test             # API unit tests
npm run db:migrate   # apply SQL migrations
npm run db:seed      # add initial synthetic records/admin (idempotent)
```

## Deployment

Deploy the API and frontend separately or behind one reverse proxy.

### API service
- Build command: `npm install && npm run build --workspace apps/api`
- Start command: `npm run start --workspace apps/api`
- Set all required environment variables in the host's secret manager.
- Use managed PostgreSQL with TLS and backups. Apply migrations as a release step.
- Ensure the host supports secure outbound WebSockets for the OpenAI sideband connection and can receive HTTPS webhooks.

### Web service
- Build command: `npm install && npm run build --workspace apps/web`
- Output directory: `apps/web/dist`
- Set `VITE_API_URL` to the public API origin at build time.
- Configure SPA fallback to `index.html` and restrict CORS to the exact production frontend origin via `WEB_ORIGIN`.

### Production checklist
- Replace seed admin credentials; enforce MFA/SSO for staff.
- Set `NODE_ENV=production`, a strong unique JWT secret, HTTPS and database TLS.
- Configure rate limits at the edge and API; use centralized secret management and alerting.
- Review RBI and applicable Indian data protection obligations with counsel and the bank's security team.
- Configure backups, recovery drills, audit retention, deletion policy, monitoring and incident response.
- Run security review and penetration tests before handling real customer data.

## Current implementation boundaries

- The included sample data is synthetic and clearly labelled.
- No real bank API credentials or account-specific query tools are included.
- Human transfer is implemented as an explicit telephony action only when configured, but must be tested with the actual trunk/provider.
- The call webhook accepts/rejects calls based on configuration and attaches a server-side control WebSocket for tool handling. Provider support and project enablement are prerequisites.
- Transcript storage is off by default. Call metadata and tool audit events are retained; production retention must be configured to bank policy.
