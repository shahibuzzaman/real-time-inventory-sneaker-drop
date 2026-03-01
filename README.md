# Sneaker Drop: Real-Time Inventory Monorepo

Production-oriented monorepo for a high-traffic limited sneaker drop system.

## Live Links
- App (Vercel): `https://real-time-inventory-sneaker-drop.vercel.app`
- API Health: `https://real-time-inventory-sneaker-drop.vercel.app/api/health`
- Socket Worker (Railway): `https://sneaker-dropsocket-worker-production.up.railway.app`
- Socket Worker Health: `https://sneaker-dropsocket-worker-production.up.railway.app/health`

## Demo Credentials
- Admin login
  - Username: `admin`
  - Password: `12345678`

## Stack
- Frontend: React + Vite + TypeScript + Tailwind + React Query
- API: Node.js + Express + TypeScript + Zod + Sequelize
- DB: PostgreSQL (Neon-compatible)
- Realtime + worker: Socket.io + Express (Railway service)
- Migrations: Umzug
- Tests: Jest + Supertest
- Monorepo: pnpm workspaces

## Monorepo Layout

```text
sneaker-drop/
  api/[...route].ts               # Vercel serverless entry (/api/*)
  apps/
    api/
    client/
    socket-worker/
  packages/
    db/
  docs/openapi.yaml
  vercel.json
```

## Core Invariants
1. `availableStock` never goes below 0.
2. Reservation is required before purchase.
3. Reservation TTL is 60 seconds.
4. Expired reservations restore stock automatically.
5. Stock is decremented on reserve (not on purchase).
6. Purchase succeeds only if reservation is ACTIVE, owned by same user, and not expired.
7. Database is source of truth.
8. WebSocket events are notification-only.

## Local Setup

### 1) Prerequisites
- Node.js 20+
- pnpm 10+
- Docker (optional, for local PostgreSQL)

### 2) Install

```bash
pnpm install
```

### 3) Start PostgreSQL (optional local)

```bash
docker compose up -d
```

### 4) Environment
Create env files from examples:
- `cp .env.example .env`
- `cp packages/db/.env.example packages/db/.env`
- `cp apps/api/.env.example apps/api/.env`
- `cp apps/socket-worker/.env.example apps/socket-worker/.env`
- `cp apps/client/.env.example apps/client/.env`

Auth settings:
- `JWT_SECRET` secures short-lived access tokens
- `JWT_REFRESH_SECRET` secures refresh tokens
- Refresh token is issued as `HttpOnly` cookie (`/api/auth/*`)
- Access token TTL is configurable (`ACCESS_TOKEN_TTL`, default `15m`)
- Refresh token TTL is configurable (`REFRESH_TOKEN_TTL_SECONDS`, default `30d`)
- New registrations are always created as `USER`
- Promote admin by updating the `Users.role` column in DB (`USER` -> `ADMIN`)

### 5) Run migrations

```bash
pnpm db:migrate
```

### 6) Run all apps

```bash
pnpm dev
```

Services:
- Client: `http://localhost:5173`
- API: `http://localhost:3001`
- Socket worker: `http://localhost:3002`

## DB Migration Commands
- Run all migrations: `pnpm db:migrate`
- Rollback last migration: `pnpm db:migrate:undo`

## Test

```bash
pnpm test
```

Test notes:
- Requires reachable PostgreSQL (`DATABASE_URL` or `TEST_DATABASE_URL`)
- Run migrations first (`pnpm db:migrate`)

Critical tests included:
- 50 concurrent reserve requests with stock=1: exactly one success
- Purchase validation: ownership, expiry, double-purchase prevention
- Expiration worker: `runExpiryOnce()` restores stock

## API Overview
- `GET /api/health`
- `GET /api/ready`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/drops` (admin JWT required)
- `GET /api/drops` (admin JWT required)
- `GET /api/drops/:dropId` (admin JWT required)
- `PATCH /api/drops/:dropId` (admin JWT required)
- `DELETE /api/drops/:dropId` (admin JWT required)
- `GET /api/drops/active`
- `POST /api/drops/:dropId/reserve`
- `POST /api/drops/:dropId/purchase`

OpenAPI spec: [`docs/openapi.yaml`](docs/openapi.yaml)

## Concurrency Design

### Atomic reserve (no oversell)
Reserve executes in one transaction with one atomic SQL update:

```sql
UPDATE "Drops"
SET "availableStock" = "availableStock" - 1
WHERE id = :dropId
  AND "availableStock" > 0
  AND "startsAt" <= NOW()
RETURNING id, "availableStock";
```

If no row returns, API responds `409 SOLD_OUT_OR_NOT_STARTED`.

If row returns, reservation insert and commit happen in the same transaction.

### Purchase correctness
Purchase transaction locks the reservation row (`FOR UPDATE`) and enforces:
- reservation exists
- reservation belongs to request user
- status is ACTIVE
- `expiresAt > now`
- reservation not already purchased

### Auth token strategy
- Access token: JWT bearer token used for API authorization
- Refresh token: rotated `HttpOnly` cookie used at `/api/auth/refresh`
- On refresh:
1. Existing refresh token is validated and locked
2. Old token is revoked
3. New refresh token + access token are issued

## Expiration Worker Design
`apps/socket-worker` runs `runExpiryOnce()` every 2 seconds.

Within one transaction:
1. `Reservations` ACTIVE + expired -> update status to EXPIRED and `RETURNING dropId`
2. Group by dropId and increment `Drops.availableStock`

After commit:
- Emits `drop:updated { dropId, availableStock }` to room `drops`

Worker also exposes:
- `POST /broadcast` (requires `x-worker-token`), supports
  - `drop:updated`
  - `drop:activity`
  - `drop:created`

## Realtime Model
- Clients subscribe to Socket.io service (`apps/socket-worker`) and join room `drops`
- API sends broadcast requests to worker after state-changing operations
- DB remains source of truth; websocket is cache invalidation/notification only

## Two-Window Demo
1. Open app in two browsers.
2. Login as admin in one window:
   - Username: `admin`
   - Password: `12345678`
3. Register/login as a normal user in another window.
4. Create a drop from the admin dashboard.
5. Sign in as user in the second window and reserve/purchase.
6. Watch stock updates instantly and purchase countdown.

Fallback API seed:
```bash
# register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin1","password":"Password123!"}'
```

## Deployment

### Neon (PostgreSQL)
1. Create a Neon project and database.
2. Copy the connection string from Neon. Use a URL with SSL enabled (for example `...?sslmode=require`).
3. Set `DATABASE_URL` to the same Neon URL in:
   - local DB migration context: `packages/db/.env` (or root `.env`)
   - API runtime: `apps/api/.env`
   - socket-worker runtime: `apps/socket-worker/.env`
4. Run migrations against Neon:
   ```bash
   DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require" pnpm db:migrate
   ```
5. Validate the API can reach Neon:
   - Start services: `pnpm dev`
   - Check readiness: `GET http://localhost:3001/api/ready` should return `{"status":"ready"}`
6. Common issues:
   - `ECONNREFUSED 127.0.0.1:5432`: `DATABASE_URL` is missing, so code falls back to local Postgres.
   - `ENOTFOUND <neon-host>`: host/DNS/network issue or malformed URL.
   - SSL errors: keep `sslmode=require` in the URL.

### Railway (socket-worker)
1. Create a new Railway service from this repo.
2. Set service root directory to `apps/socket-worker`.
3. Configure environment variables:
   - `DATABASE_URL`
   - `WORKER_TOKEN`
   - `SOCKET_CORS_ORIGIN=https://real-time-inventory-sneaker-drop.vercel.app`
   - `NODE_ENV=production`
4. Configure commands:
   - Build command: `pnpm --filter @sneaker-drop/db build && pnpm --filter @sneaker-drop/socket-worker build`
   - Start command: `pnpm --filter @sneaker-drop/socket-worker start`
5. Deploy and verify health:
   - `https://sneaker-dropsocket-worker-production.up.railway.app/health`

### Vercel (client + API)
1. Import repo into Vercel.
2. Set root directory to repository root.
3. Keep `vercel.json` settings.
4. Set env vars:
   - `DATABASE_URL`
   - `WORKER_URL` (`https://sneaker-dropsocket-worker-production.up.railway.app`)
   - `WORKER_TOKEN`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `ACCESS_TOKEN_TTL` (e.g. `15m`)
   - `REFRESH_TOKEN_TTL_SECONDS` (e.g. `2592000`)
   - `REFRESH_TOKEN_COOKIE_NAME` (e.g. `refreshToken`)
   - `CORS_ORIGIN` (`https://real-time-inventory-sneaker-drop.vercel.app`)
   - `VITE_SOCKET_URL` (`https://sneaker-dropsocket-worker-production.up.railway.app`)
5. Deploy.

## Developer Ergonomics
- `pnpm dev`: runs API + worker + client together
- Strict TypeScript in all packages
- Shared lint/format config
- Centralized API error handler and structured JSON logging
- Testable expiry logic exported as `runExpiryOnce()`
