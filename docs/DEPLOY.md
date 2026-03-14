# Deployment Runbook

This project deploys Prisma schema changes and baseline data in two steps:

1. Apply committed migrations.
2. Seed initial reference data.

## Prerequisites

- `DATABASE_URL` points to the target PostgreSQL database.
- Dependencies are installed (`npm ci`).
- Prisma client is generated (`npm run prisma:generate`), if needed.

## Deploy Database Changes

Run migrations in production-safe mode:

```bash
npx prisma migrate deploy
```

This applies SQL files from `prisma/migrations` in order.

## Seed Initial Data

Run the seed script after migrations:

```bash
npm run db:seed
```

The seed script is idempotent and creates:

- FY2026 draft snapshot
- Standard groups
- Sample line items
- Sample projected values

## Recommended Sequence for New Environment

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run db:seed
```
