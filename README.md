# Devoverflow

Monorepo: Next.js (apps/web), NestJS (apps/api), shared Prisma (packages/database).

## Prerequisites

- Node.js 18+
- npm
- Docker (for PostgreSQL)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy the example env and fill in values:

   ```bash
   cp .env.example .env
   ```

   Ensure `DATABASE_URL` in `.env` matches the Postgres credentials in `docker-compose.yml`.

3. **Database**

   Start PostgreSQL:

   ```bash
   docker compose up -d
   ```

   Run migrations:

   ```bash
   npm run prisma:migrate
   ```

   When prompted for a migration name, use e.g. `init`.

4. **Generate Prisma client** (if needed)

   ```bash
   npm run prisma:generate
   ```

## Scripts

From the repo root:

| Script            | Description                    |
|-------------------|--------------------------------|
| `npm run dev:web` | Start Next.js (port 3000)      |
| `npm run dev:api` | Start NestJS API (port 3001)    |
| `npm run dev`     | Start both web and API         |
| `npm run prisma:migrate` | Run Prisma migrations   |
| `npm run prisma:studio`   | Open Prisma Studio      |
| `npm run prisma:generate`| Generate Prisma client   |

## Project structure

```
devoverflow/
├── apps/
│   ├── web/          # Next.js (App Router, Tailwind, TypeScript)
│   └── api/          # NestJS API (Prisma, JWT, validation)
├── packages/
│   └── database/     # Prisma schema and client
├── .env.example      # Env template (copy to .env)
├── docker-compose.yml # PostgreSQL 15
└── package.json      # Workspaces and root scripts
```
