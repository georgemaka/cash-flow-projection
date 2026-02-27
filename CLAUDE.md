# Cash Flow Projection System

## Project Overview

Web-based cash flow projection tool for Sukut Properties, replacing an Excel workbook. Hosted at `cashflow.sukutproperties.com`. Built by Claude Code + Codex with minimal human intervention.

## Resume Instructions

When starting a new session, do the following:

1. Read this file, `docs/DECISIONS.md`, and `CONVENTIONS.md`
2. Check the GitHub issues board: `gh issue list --label phase-1`
3. Pick the next unassigned issue, assign yourself, and start working
4. When implementation is complete, move issue label to `needs-review`
5. Open a PR using the PR template and link the issue with `Closes #<issue-number>`
6. Wait for review + `Review Gate` checks before merge

## Current Phase

**Phase 1 (core)** — see brainstorm Section 5, line 204 for full scope:

- Next.js app scaffold, Postgres + Prisma schema, auth (Clerk)
- Admin group management (add/delete sectors + non-operating sections)
- Line item CRUD with projection strategy picker
- Data grid with monthly entry
- Snapshot create/lock/unlock
- Field-level audit log
- Excel export (layout-compatible with current workbook)
- Template onboarding (new year from prior year)
- Deploy to staging

## Tech Stack

- **Frontend:** Next.js 15 + React 19 + TypeScript
- **UI Components:** Shadcn/ui + AG Grid (or Handsontable) for data grid
- **Backend:** Next.js API routes
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Clerk (admin/editor/viewer roles)
- **Testing:** Vitest (unit/integration), Playwright (e2e)
- **CI/CD:** GitHub Actions → Vercel (staging auto-deploy, production manual)
- **Excel I/O:** exceljs
- **Error tracking:** Sentry

## Key Architecture Decisions

- **Schema:** `groups` → `line_items` → `values` (per snapshot + period). See `prisma/schema.prisma`.
- **Projection methods:** per-line-item enum (manual, annual_spread, prior_year_pct, prior_year_flat). Params stored as JSON.
- **Versioning:** snapshot + lock model. Admin-only lock/reopen.
- **Audit:** field-level, append-only, with source tracking (ui_edit, import, bulk_action, api).
- **Soft delete:** `is_active=false` + `archived_at`. No hard deletes in production.
- All settled decisions are in `docs/DECISIONS.md`.

## Confirmed Requirements

- Up to 5 concurrent editors, simple role model (admin/editor/viewer)
- Calendar year projection horizon (Jan-Dec)
- Actuals manually entered
- Multi-entity: multiple properties, tenants, sectors with drill-down filtering
- Mobile-friendly (card layout on mobile, full grid on desktop)
- Excel export must match current workbook layout
- Performance: grid load <2s, save ack <400ms, Excel export <30s

## Agent Coordination

- **Task board:** GitHub Issues with labels (`phase-1`, `backend`, `frontend`, `schema`, `ready-for-pr`, `in-review`, `needs-review`, `review-blocked`, `done`)
- **Code review:** PRs reviewed by the other agent before merge, with findings tracked in the PR template
- **Conflict avoidance:** assign clear ownership per PR, don't edit same files in parallel
- **Escalation:** check this file + DECISIONS.md + CONVENTIONS.md + brainstorm doc before asking the owner
- **`needs-owner` label:** for decisions that genuinely require human input — include a proposed default
- **Automation:** linked issues move to `in-review` when PR opens and to `done` when merged
