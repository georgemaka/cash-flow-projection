# Deployment Guide

## Environments

| Environment | URL | Branch | Deploy |
|-|-|-|-|
| Staging | cashflow-staging.sukutproperties.com | main | Auto on merge |
| Production | cashflow.sukutproperties.com | main | Manual promotion |

## CI Pipeline

Every PR runs these quality gates (all must pass before merge):

1. **Prisma validate** — schema syntax check
2. **Prettier check** — formatting consistency
3. **ESLint** — code quality
4. **TypeScript check** — type safety (`tsc --noEmit`)
5. **Unit tests** — `vitest run`
6. **Build** — `next build` compilation

On merge to `main`, the staging deployment job runs automatically.

## GitHub Secrets Required

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|-|-|
| `VERCEL_TOKEN` | Vercel API token (create at vercel.com/account/tokens) |

## GitHub Environment Required

Create a **staging** environment in **Settings → Environments**:
- No required reviewers (auto-deploy)
- No branch restrictions (main only via `if` condition in workflow)

## Vercel Project Setup

1. Install Vercel CLI: `npm install -g vercel`
2. Link the project: `vercel link` (select the org and project)
3. This creates `.vercel/project.json` — commit it
4. Set environment variables in Vercel dashboard:

| Variable | Value | Notes |
|-|-|-|
| `DATABASE_URL` | PostgreSQL connection string | Vercel Postgres or external |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | From Clerk dashboard |
| `CLERK_SECRET_KEY` | Clerk secret key | From Clerk dashboard |

## Custom Domain

After first deploy:
1. Go to Vercel project → Settings → Domains
2. Add `cashflow-staging.sukutproperties.com`
3. Configure DNS: CNAME record pointing to `cname.vercel-dns.com`
4. Add `cashflow.sukutproperties.com` for production

## Smoke Test Checklist

After each staging deploy, verify:

- [ ] App loads at staging URL without errors
- [ ] Auth: Can log in with Clerk (admin account)
- [ ] Groups: Can list groups via `/api/groups`
- [ ] Snapshots: Can create/lock/unlock via API
- [ ] Excel export: `POST /api/exports/excel` returns valid XLSX
- [ ] No console errors in browser dev tools
- [ ] Mobile: App is usable on phone viewport

## Troubleshooting

**Build fails with Prisma error:**
Ensure `prisma generate` runs during build. The `postinstall` script handles this, or add `prisma generate` before `next build` in the CI.

**Vercel deploy fails with "not linked":**
Run `vercel link` locally and commit the `.vercel/project.json` file.

**Custom domain not working:**
Check DNS propagation with `dig cashflow-staging.sukutproperties.com`. CNAME should point to `cname.vercel-dns.com`.
