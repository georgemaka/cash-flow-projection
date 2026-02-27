# Code Conventions

Both AI agents (Claude Code and Codex) must follow these conventions to keep the codebase consistent.

## Project Structure

```
app/                    # Next.js App Router pages and layouts
  (auth)/               # Auth-protected route group
  api/                  # API route handlers
components/             # Reusable React components
  ui/                   # Shadcn/ui primitives
lib/                    # Shared utilities, constants, types
  db.ts                 # Prisma client singleton
  calculations/         # Projection engine (spread, prior year, etc.)
  validations/          # Zod schemas for API input validation
prisma/
  schema.prisma         # Single source of truth for data model
  seed.ts               # Seed script for dev data
tests/                  # All test files mirror source structure
  unit/                 # Unit tests (calculations, utils)
  integration/          # API route tests
  e2e/                  # Playwright browser tests
docs/
  DECISIONS.md          # Architecture Decision Records
```

## Naming

- **Files:** kebab-case (`snapshot-grid.tsx`, `projection-engine.ts`)
- **Components:** PascalCase (`SnapshotGrid`, `LineItemRow`)
- **Functions/variables:** camelCase (`calculateSpread`, `snapshotId`)
- **Database fields:** camelCase in Prisma, maps to snake_case in Postgres via `@map` if needed
- **API routes:** `/api/[resource]/[action]` (e.g., `/api/snapshots/lock`)
- **Test files:** `[name].test.ts` in `tests/` directory

## TypeScript

- Strict mode enabled (`strict: true` in tsconfig)
- No `any` — use proper types or `unknown` with type guards
- Use Zod for runtime validation of API inputs
- Prisma-generated types for database models — don't duplicate them

## React / Next.js

- Use App Router (not Pages Router)
- Server Components by default; add `"use client"` only when needed (interactivity, hooks)
- Keep data fetching in Server Components, pass as props to Client Components
- Use React Server Actions for mutations where appropriate

## Formatting

- Prettier handles all formatting — do not manually format
- Semi: yes, Quotes: double, Trailing comma: none, Print width: 100
- Run `npm run format` before committing

## Testing

- Business logic (calculations, permissions) must have unit tests
- New API routes must have integration tests
- Test file naming: `tests/unit/[feature].test.ts`
- Use descriptive test names: `it("divides annual total evenly across 12 months")`

## Git

- Branch naming: `[type]/[short-description]` (e.g., `feat/snapshot-crud`, `fix/audit-log-source`)
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- One feature per PR — keep PRs focused and reviewable
- All PRs must pass CI before merge

## Agent Review Flow

- Start work from issues labeled `ready-for-pr`.
- When implementation is complete, move issue to `needs-review`.
- Open PR using `.github/pull_request_template.md` and link issue with `Closes #<issue-number>`.
- Cross-review is required: Claude reviews Codex PRs and Codex reviews Claude PRs.
- PR must pass both required checks before merge:
  - `Quality Gates`
  - `Review Policy Checks`
- If code changes have no tests, include `[no-tests]` with justification in PR body.
- Use `needs-owner` issue form for blocked product decisions.

## API Design

- Use Next.js Route Handlers (`app/api/`)
- Return consistent JSON shape: `{ data: T }` on success, `{ error: string }` on failure
- Validate all inputs with Zod before processing
- Use HTTP status codes correctly (200, 201, 400, 401, 403, 404, 500)

## Financial Data

- Always use `Decimal` (Prisma) / `Decimal.js` for money — never floating point
- Display formatting happens in the UI layer, not the API
- Null means "not applicable" (e.g., new line item before it existed), zero means actual zero
