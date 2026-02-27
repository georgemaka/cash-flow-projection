# Cash Flow Projection

Web-based cash flow projection tool for Sukut Properties.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL
- Clerk (authentication + role model)
- ESLint + Prettier
- Vitest
- GitHub Actions CI

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file and fill in values:
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

## Authentication Setup (Clerk)

### Environment Variables

Add these to `.env` (see `.env.example` for the full list):

| Variable                            | Description                                  |
| ----------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (from Clerk dashboard) |
| `CLERK_SECRET_KEY`                  | Clerk secret key (from Clerk dashboard)      |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`     | Sign-in page path (default: `/sign-in`)      |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`     | Sign-up page path (default: `/sign-up`)      |

### Role Model

Roles are stored in each user's **`publicMetadata.role`** in the Clerk dashboard.
Valid values: `admin`, `editor`, `viewer`. Users without a role default to `viewer`.

| Role     | Permissions                                                                         |
| -------- | ----------------------------------------------------------------------------------- |
| `admin`  | Full access — manage groups, line items, lock/unlock snapshots, template onboarding |
| `editor` | Create snapshots, edit values (monthly actuals/projections)                         |
| `viewer` | Read-only access to all data                                                        |

### Assigning Roles

1. Open the [Clerk Dashboard](https://dashboard.clerk.com) → Users.
2. Select a user → **Metadata** → **Public metadata**.
3. Set `{"role": "admin"}` (or `"editor"` / `"viewer"`).

### Protected Routes

All routes except `/sign-in` and `/sign-up` require a signed-in user.
API endpoints enforce roles as follows:

- **Admin-only:** `POST/PATCH/DELETE /api/groups`, `POST/PATCH/DELETE /api/line-items`, `POST /api/snapshots/lock`, `POST /api/snapshots/unlock`, `POST /api/templates/onboard`
- **Editor+:** `POST /api/snapshots`, `POST /api/snapshots/copy`, `POST /api/values/upsert`
- **Viewer+:** All `GET` endpoints, `POST /api/exports/excel`, `POST /api/templates/preview`

## Validation Commands

- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:ci` _(requires Node 22)_
- `npm run build`

## Agent Workflow (Claude + Codex)

This repo has automated review gates in GitHub:

- Issue forms: `.github/ISSUE_TEMPLATE/`
- PR template: `.github/pull_request_template.md`
- Review workflows:
  - `.github/workflows/review-gate.yml`
  - `.github/workflows/issue-pr-sync.yml`

Required flow for agent work:

1. Start from a `ready-for-pr` issue.
2. Implement and move issue to `needs-review`.
3. Open PR with `Closes #<issue-number>`.
4. Cross-review with the other agent.
5. Merge only when `Quality Gates` and `Review Policy Checks` are green.

See `.github/REVIEW_AUTOMATION.md` and `AGENTS.md` for full details.

## Notes

- Decision defaults are tracked in `docs/DECISIONS.md`.
- Code conventions are in `CONVENTIONS.md`.
