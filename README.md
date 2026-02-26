# Cash Flow Projection

Foundation scaffold for the cash flow projection platform.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL
- ESLint + Prettier
- Vitest
- GitHub Actions CI

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   cp .env.example .env
   ```
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Start development server:
   ```bash
   npm run dev
   ```

## Validation Commands

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:ci`
- `npm run build`

## Notes

- This PR intentionally includes foundation only (no feature implementation).
- Decision defaults are tracked in `docs/DECISIONS.md`.
