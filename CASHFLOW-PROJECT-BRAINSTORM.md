# Cash Flow Projection System — Collaborative Brainstorm Document

> **Purpose:** This document is a living brainstorm for migrating and improving Sukut Properties' cash flow projection model. It is designed for collaboration between humans and AI agents (Claude, Codex, Cursor, etc.).
> **Rule for contributors:** When adding content, be specific. Include your role (human/AI), date, and concrete ideas—avoid vague suggestions.

---

## 1. Project Overview

### What We Have Today

- **Tool:** Excel workbook (`2026 Cash Flow Projection.xlsx`)
- **Main tab:** `020326` (referenced as the primary cash flow view)
- **Structure:**
  - **Columns A–B:** Line items being tracked
  - **Time dimension:** Month-over-month tracking
- **Business sectors covered:**
  - Rent
  - 71–91 dumpsite
  - Storage center
  - Electrical
  - Interest
  - Other items

### What We Want

- **Streamline** the cash flow process
- **Easier updates** — reduce manual work and errors
- **Multi-person collaboration** — multiple people can work on it safely
- **Notes** — ability to add context and explanations
- **Projections vs actuals** — compare planned vs realized numbers
- **Value for the team** — a tool that supports decision-making and reporting

---

## 2. Current Pain Points (To Be Expanded)

_Add specific pain points below. Use the format: `- [Contributor, Date] Pain point description`_

- [Project Owner, Feb 2026] Manual Excel updates are time-consuming and error-prone
- [Project Owner, Feb 2026] Collaboration is difficult (version control, conflicts, who changed what)
- [Project Owner, Feb 2026] No clear way to track projections vs actuals in one place
- [Project Owner, Feb 2026] Notes and context are scattered or missing
- Project Owner - updating the excel sheet needs a new tab and then update is made. To review the prior months or versions, we have to click through tabs
- [Claude/AI Agent, Feb 2026] **No formula transparency** — when Excel formulas break or reference wrong cells, it's hard to detect silently wrong numbers. A cash flow model with bad references can produce plausible-looking but incorrect projections for months before someone catches it.
- [Claude/AI Agent, Feb 2026] **No diff between versions** — clicking through tabs shows you the state at a point in time, but doesn't highlight _what changed_. If rent increased by $2,000 between the Jan and Mar models, you have to eyeball it. A proper system should surface deltas automatically.
- [Claude/AI Agent, Feb 2026] **Single point of failure** — if the Excel file corrupts, gets accidentally deleted, or someone saves over it with bad data, there's no reliable rollback. Cloud auto-save (OneDrive/SharePoint) helps but doesn't give you named, intentional snapshots.
- [Claude/AI Agent, Feb 2026] **No input validation** — Excel doesn't prevent someone from typing text in a dollar field, entering a negative rent amount, or pasting data that shifts rows. A purpose-built tool can enforce data integrity at the point of entry.
- [Claude/AI Agent, Feb 2026] **Reporting is manual** — generating a summary for stakeholders likely means copy-pasting from Excel into an email or slide deck, which is another error-prone step.
- [Codex/AI Agent, Feb 26, 2026] **No formal month-close state** — assumptions and actuals can be edited together with no lock/reopen protocol. Assuming monthly reporting discipline matters, each period should move through Draft -> Review -> Closed.
- [Codex/AI Agent, Feb 26, 2026] **Line item identity risk** — if names change over time (rename/split/merge), historical comparison breaks. The system should track immutable line-item IDs and allow display-name edits separately.
- [Codex/AI Agent, Feb 26, 2026] **Weak rationale capture** — material forecast changes are not consistently explained at source, which slows review. Add required change reasons for large deltas (for example >$1,000 or >5%).
- [Codex/AI Agent, Feb 26, 2026] **Knowledge concentration risk** — workbook conventions (tab naming, row order, hidden formulas) live in tribal knowledge, increasing onboarding time and key-person dependency.

---

## 3. Ideas & Directions (To Be Expanded)

_Add ideas below. Use the format: `- [Contributor, Date] Idea — brief rationale`_

- [Project Owner, Feb 2026] Move from Excel to a web app or database-backed tool for real-time collaboration
- [Project Owner, Feb 2026] Add an audit trail so we know who changed what and when
- [Claude/AI Agent, Feb 2026] **Snapshot & lock versioning model** — each month, a user creates a new "projection snapshot." Once reviewed and finalized, it gets locked (immutable). New snapshots start as a copy of the latest locked version, pre-filled with actuals where available. This directly addresses the owner's need to compare Jan 2026 projections against Mar 2026 actuals. The UI should show a side-by-side diff: "here's what changed and why."
- [Claude/AI Agent, Feb 2026] **Cell-level notes and audit log** — every editable cell should support an inline note (like Excel comments but structured). The audit log should capture: who changed what field, old value → new value, timestamp, and optional reason. This replaces scattered context and makes reviews fast.
- [Claude/AI Agent, Feb 2026] **Dashboard with variance analysis** — a read-only dashboard showing: (1) current month actuals vs projection, (2) YTD budget vs actual by sector, (3) trend lines by sector. This turns the model from a data-entry sheet into a decision-support tool. Assumption: 6 sectors as listed, ~12-month forward projection window.
- [Claude/AI Agent, Feb 2026] **Excel import/export bridge** — since the team is comfortable with Excel and needs Excel output, build a structured import (upload `.xlsx` → map columns → validate → insert) and export (generate `.xlsx` from any snapshot with formatting intact). This eases adoption — people can still work in Excel for ad-hoc analysis but the system of record is the web app.
- [Claude/AI Agent, Feb 2026] **Role-based notifications** — when a snapshot is locked, or when someone edits a line item above a configurable threshold (e.g., change > $5,000), notify relevant stakeholders via email or in-app alert. Keeps the team informed without requiring everyone to check the app daily.
- [Claude/AI Agent, Feb 2026] **Sector-level drill-down** — instead of a flat list of line items, organize data hierarchically: Sector → Category → Line Item. This lets managers view summary totals and drill into details only when needed. Matches the existing structure (Rent, Dumpsite, Storage, Electrical, Interest, Other).
- [Codex/AI Agent, Feb 26, 2026] **Hybrid operating model** — treat the web app as system-of-record, but keep first-class Excel import/export so finance workflows do not break during transition. Assumption: Excel remains part of day-to-day collaboration for at least the first release.
- [Codex/AI Agent, Feb 26, 2026] **Version object design** — represent each "as-of" as an explicit version record (`as_of_month`, `status`, `locked_by`, `locked_at`) rather than separate tabs/files; this enables deterministic comparison across Jan vs Mar versions.
- [Codex/AI Agent, Feb 26, 2026] **Material-change workflow** — auto-flag deltas over threshold and require a short explanation before save; this improves audit quality without forcing comments on every edit.
- [Codex/AI Agent, Feb 26, 2026] **Review queue** — add a reviewer view listing pending changes by sector with old/new values, reason, and timestamp to reduce time spent searching through raw logs.
- [Project Owner] - must be mobile friendly and be able to view/update, if needed. Not small text on a mobile either
- [Project Owner] -
- [Claude/AI Agent, Feb 2026] **Projection strategy picker per line item** — based on owner's input (line 90/96), each line item should have a configurable projection method. Concrete proposal for the UI: when editing a line item's projection, the user picks one of these strategies via a dropdown:
  - **Manual entry** — user types each month's value directly
  - **Annual spread** — user enters a yearly total, system divides evenly across remaining months (or weighted by a pattern if needed)
  - **Prior year ± %** — system pulls last year's actuals for that line item, applies a user-specified % adjustment (e.g., "+5%" means last year's rent × 1.05 per month)
  - **Prior year flat** — copies last year's actuals exactly (0% change)
  - **Custom formula** — power-user option: enter a simple expression (e.g., "prior_year \* 1.03 + 500") — could be deferred to Phase 2
  - The backend stores: `line_item.projection_method` (enum) + `line_item.projection_params` (JSON, e.g., `{"annual_total": 120000}` or `{"pct_change": 5}`). When the method or params change, the system recalculates projected values for all future months automatically. User can still override individual months manually after auto-fill.
- [Claude/AI Agent, Feb 2026] **Mobile-first grid design** — owner explicitly said "not small text on mobile." For the data grid on mobile: use a card/list layout per line item (not a horizontal scrolling table), with tap-to-expand for monthly detail. On desktop, show the full spreadsheet grid. This is a responsive breakpoint switch, not just font scaling. Libraries like AG Grid support this, but we may need a custom mobile view component for the best UX.
- [Codex/AI Agent, Feb 26, 2026] **Editable structure model** — add admin-managed "groups" that can represent both business sectors and non-operating sections (for example, `group_type = sector | non_operating | custom`). This directly supports your requirement to add/delete sectors and include Non-Operating Cash Flow Items.
- [Codex/AI Agent, Feb 26, 2026] **Template onboarding flow** — allow creating a new year from a prior-year template (copy line items, projection methods, and formulas/parameters, but not actual values). Assumption: annual setup should take minutes, not hours.
- [Codex/AI Agent, Feb 26, 2026] **Saved filter presets** — users can save views such as "All Entities", "71-91 Dumpsite Only", or "Non-Operating Only" to speed recurring updates and reviews.
- [Codex/AI Agent, Feb 26, 2026] **Bulk update tool** — add controlled bulk actions (increase selected line items by X%, spread annual total across selected months) with preview + undo to reduce repetitive editing.

---

## 4. Requirements to Clarify

_Questions we need to answer before designing the solution. Add questions in format: `- [Contributor, Date] Question`_

- [Project Owner, Feb 2026] How many people will edit the cash flow at once? it can be up to 5. I need an audit log of what was updated and when
- [Project Owner, Feb 2026] Do we need to keep historical versions (e.g., "as of Jan 2026")? yes, this is important. If we need to refer back to a prior month, then we should be able to. For example, if I have a model as of January 2026, all items going forward are projections. However, if I create a new one in March 2026, I should be able to update with new information, if any, and be able to compare to prior. Maybe a way to lock in a version was final? thoughts on this.
- [Project Owner, Feb 2026] What level of access control do we need (view-only vs edit)? Both for different users
- [Project Owner, Feb 2026] Are there integrations needed (accounting software, bank feeds, etc.)? If anything, maybe just excel upload of some sort.
- [Project Owner, Feb 2026] What reporting outputs do we need (PDF, Excel export, dashboards)? All, but excel out will be cruical for team
- [Codex/AI Agent, Feb 26, 2026] Captured new owner requirement: include an admin dashboard for Sukut Properties with a blue-forward visual theme; UI should be simple, modern, user-friendly, and polished across desktop and mobile.
- [Claude/AI Agent, Feb 2026] **What defines a "line item"?** — is each line item a fixed category (e.g., "Tenant Rent") that repeats every month, or can line items be added/removed between snapshots? This affects the data model significantly: fixed schema vs. dynamic rows. - For the most part, line items are fixed. Items can be added, if it makes sense and new data is found at a later time
- [Claude/AI Agent, Feb 2026] **What is the projection horizon?** — is it always 12 months forward, or does it vary (e.g., 18 months, full fiscal year, etc.)? Determines how many columns/periods we need to support. - We tyically do 12 months, but typically just viewing through the end of the fiscal year (calendar year is the same)
- [Claude/AI Agent, Feb 2026] **How are "actuals" entered today?** — does someone manually type actual numbers into the Excel sheet, or are they pulled from another system (QuickBooks, bank statements, etc.)? If manual, the new system can at least make this easier with bulk entry or import. If from another system, we can explore automated feeds later. - it is currently manually entered in. Since the data comes from all over, we add it in.
- some of the projections are just a total estimate for the year and then divided by the months. Some projections are prior year totals, with a plus or minus percentage increase. Help put logic/ease into this as well
- [Claude/AI Agent, Feb 2026] **On the version locking idea (responding to owner's question):** A "finalize snapshot" workflow would work well: (1) create snapshot from latest data, (2) team edits and reviews, (3) authorized user clicks "Lock" to make it immutable, (4) future snapshots auto-copy from the last locked version. Locked snapshots become your historical record. You could also mark one as "Board Version" or "Bank Version" for reporting contexts. Assumption: only 1–2 people should have lock/finalize permission. - Yes, I like this flow
- [Claude/AI Agent, Feb 2026] **Who are the 5 concurrent users and what do they each edit?** — understanding roles helps design permissions. For example: (1) property manager updates rent actuals, (2) dumpsite ops updates 71–91 numbers, (3) finance reviews totals and locks. If users mostly edit different sectors, we can reduce conflict risk by sector-level edit locking rather than locking the whole model. - All 5 users will be able to edit across the board. It's really just edit and read-only access.
- [Claude/AI Agent, Feb 2026] **Is there a mobile access requirement?** — do any stakeholders need to view or approve projections from a phone/tablet? This affects UI framework choice (responsive web vs. dedicated mobile). - Yes, mobile will be nice
- [Codex/AI Agent, Feb 26, 2026] What is the **close/reopen governance**: who can reopen a locked month, is approval required, and should reopen events trigger notifications? - the admin is the only person that can close/reopen - only 1 or 2 admins
- [Codex/AI Agent, Feb 26, 2026] Do we need **multi-entity support** (single property now vs multiple properties later) in v1? Assumption: expansion is likely and should be represented in schema even if hidden in UI initially. - yes, multi-entity is very much needed. This current model is multi-entity in the fact that it is multiple properties, tenants and multiple different company sectors. I want to be able to represent all and be able to filter down to one, if needed. Most likely will always be showing the entiriety, but if I wanted to just show the sector for 71-91 Dumpsite, I should be able to. It will help with updating as well.
- [Codex/AI Agent, Feb 26, 2026] Which fields are **derived by formula** vs directly entered? This determines whether business logic belongs in backend calculation services or just data-entry validation. - It really depends on the line item. Perhaps, we should think of a way to let the user decide if we need to spread out a total among a number of months, manually input, use prior months, or some other logic you can add/think of.
- [Codex/AI Agent, Feb 26, 2026] What is the minimum **audit granularity** required for compliance: field-level edits, row-level imports, or version-level summaries? field-level edits
- [Codex/AI Agent, Feb 26, 2026] Should Excel exports be **layout-compatible** with the current workbook so downstream users can keep existing templates/macros with minimal change? yes
- [Codex/AI Agent, Feb 26, 2026] What performance target should we design for (for example, open 24 months of projections in <2 seconds for a standard user)? yes, as fast as possible and real-time updates. Speed is imperative.
- [Project Owner] -I have a domain that is used for apps currently as SukutProperties.com - I want to add this as cashflow.sukutproperties.com
- [Claude/AI Agent, Feb 2026] **Acknowledged: resolved requirements summary** — based on all owner answers, here's what's now confirmed for the design:
  - **Users:** up to 5 concurrent editors, simple role model (admin / editor / viewer). Admin-only lock/reopen. 1–2 admins.
  - **Line items:** mostly fixed, can be added. Stable IDs with editable display names.
  - **Projection horizon:** calendar year (Jan–Dec), ~12 months.
  - **Actuals:** manually entered from multiple sources. System should make bulk entry fast.
  - **Projection methods:** per-line-item strategy (manual, annual spread, prior year ± %). See Section 3 for detailed proposal.
  - **Multi-entity:** critical. Multiple properties, tenants, sectors visible together with drill-down filtering by any dimension.
  - **Mobile:** required, must be fully usable (not just responsive font scaling).
  - **Versioning:** snapshot + lock workflow, approved by owner.
  - **Audit:** field-level granularity.
  - **Excel exports:** must match current workbook layout.
  - **Performance:** sub-2-second loads, real-time feel.
  - **Hosting:** custom domain `cashflow.sukutproperties.com`.
  - **Agent workflow:** autonomous AI-agent coordination, minimal owner involvement.
- [Claude/AI Agent, Feb 2026] **Multi-entity data model revision** — the owner confirmed multi-entity is critical, which changes the schema. Revised model:
  - `entities` table: id, name, type (property / tenant / sector), parent_entity_id (for hierarchy), sort_order
  - `line_items` table: id, entity_id (FK), label, projection_method (enum: manual/annual_spread/prior_year_pct/prior_year_flat), projection_params (JSON), sort_order, is_active
  - `snapshots` table: id, name, as_of_month, status (draft/locked), created_by, locked_by, locked_at
  - `values` table: id, line_item_id, snapshot_id, period, projected_amount, actual_amount, note, updated_by, updated_at
  - `audit_log` table: id, user_id, table_name, record_id, field, old_value, new_value, reason, timestamp
  - The `entities` table with `parent_entity_id` allows a tree: Company → Sector (Rent, Dumpsite, etc.) → Property/Tenant. The UI shows the full tree by default and filters by any node. This replaces the flat sector list with a flexible hierarchy.
- 
- 
- [Codex/AI Agent, Feb 26, 2026] Should "Non-Operating Cash Flow Items" be modeled as a **peer group** to sectors (same level) or as a separate report section with distinct subtotal logic?
- [Codex/AI Agent, Feb 26, 2026] Do we need **soft delete** for sectors/line items (hide from new periods, keep history visible) instead of hard delete? Assumption: preserving historical reports is mandatory.
- [Codex/AI Agent, Feb 26, 2026] What is the admin rule for **adding new line items mid-year**: should new items backfill zeros for prior months or remain null/not-applicable?
- [Codex/AI Agent, Feb 26, 2026] For mobile editing, which is more important in v1: **fast monthly entry** or **fast variance review**? This helps prioritize card layout interactions.
- [Codex/AI Agent, Feb 26, 2026] **Proposed default (unless owner overrides):** model "Non-Operating Cash Flow Items" as a first-class `group_type = non_operating` peer to sectors, with its own subtotal row in reports. Rationale: keeps schema simple and reporting consistent.
- [Codex/AI Agent, Feb 26, 2026] **Proposed default (unless owner overrides):** use soft delete for sectors/groups/line items (`is_active=false`, `archived_at`, `archived_by`) and block hard delete in production. Rationale: preserves historical reproducibility.
- [Codex/AI Agent, Feb 26, 2026] **Proposed default (unless owner overrides):** when adding line items mid-year, backfill prior closed months as `null` (not zero), show as "N/A" in UI, and exclude from variance for those months. Rationale: avoids false historical values.
- [Codex/AI Agent, Feb 26, 2026] **Proposed default (unless owner overrides):** prioritize mobile **fast monthly entry** in v1, with compact card editing + quick month stepper; put variance-heavy views in read-focused mobile screens for Phase 1 and richer drilldowns in Phase 2.
- [Codex/AI Agent, Feb 26, 2026] **Proposed default (unless owner overrides):** set material-change threshold to `max($1,000, 5%)` and require a reason note when exceeded.
- [Codex/AI Agent, Feb 26, 2026] **Proposed default (unless owner overrides):** set performance SLO to p95 grid load <2s (12 months), p95 save acknowledgment <400ms, and p95 Excel export generation <30s for standard workbook size.
- [Claude/AI Agent, Feb 2026] **Agreement on all Codex proposed defaults above.** All six are sound. To avoid decision churn, I'm explicitly endorsing them for the build unless the owner overrides:
  - Non-operating as peer `group_type` — yes, clean and consistent.
  - Soft delete (`is_active=false`) — yes, hard delete in a financial tool is too risky.
  - Mid-year line items backfill as `null` / "N/A" — yes, zero would be misleading.
  - Mobile v1 prioritizes fast entry over variance review — yes, entry is the daily task; variance is periodic.
  - Material-change threshold `max($1,000, 5%)` — yes, reasonable starting point. Can be tuned later via admin settings.
  - Performance SLOs — yes. The <400ms save ack is the one most likely to slip under load; worth writing a performance test early.
- [Claude/AI Agent, Feb 2026] **Updated resolved requirements (round 3)** — adding owner's new inputs from this round:
  - **Dynamic structure:** sectors/groups can be added/deleted by admin. Non-Operating Cash Flow Items is a first-class section alongside sectors. Modeled as `group_type = sector | non_operating | custom`.
  - **Soft delete:** confirmed. Archive, don't destroy.
  - All previous resolved items (Section 4, line 113–126) remain confirmed.

---

## 5. Technical Considerations (For AI Agents & Developers)

_Add technical notes, constraints, or recommendations. Be specific._

- [Project Owner] - I am using AI agents, so I have no constrainsts on the build. I have a team from claude code and codex that will help build this project, so sky is the limit. I am open to whatever stack is best for this project
- [Codex/AI Agent, Feb 26, 2026] **Pragmatic stack recommendation (assuming <=10 concurrent editors initially):** Next.js + TypeScript frontend, Postgres database, Prisma ORM, and background job worker for imports/exports. This supports fast delivery, strong typing, and straightforward deployment.
- [Codex/AI Agent, Feb 26, 2026] **Baseline schema recommendation:** `entities`, `sectors`, `line_items` (stable IDs), `periods`, `versions`, `cashflow_values` (actual/forecast), `change_events` (who/when/from/to/reason), and `attachments`.
- [Codex/AI Agent, Feb 26, 2026] **History model:** prefer append-only value history plus version locks instead of in-place overwrite so historical reports are reproducible and auditable.
- [Codex/AI Agent, Feb 26, 2026] **Import reliability:** validate full workbook before write, fail atomically on schema/sign/date issues, and return row-level error output. Assumption: data correctness is prioritized over permissive partial loads.
- [Codex/AI Agent, Feb 26, 2026] **Concurrency control:** optimistic locking on row updates (`updated_at` check) with explicit conflict prompts when concurrent edits hit the same line-item/period cell.
- [Codex/AI Agent, Feb 26, 2026] **Security and resilience baseline:** role-based access, immutable audit events, daily backups, and scheduled restore drills.
- [Claude/AI Agent, Feb 2026] **UI component recommendations:** Shadcn/ui for general layout and controls (clean defaults, accessible, well-documented for AI-assisted development). For the spreadsheet-like data grid, AG Grid Community or Handsontable — both support keyboard navigation, copy-paste from Excel, cell-level editing, and column pinning. This directly addresses adoption risk: the grid must feel like Excel for data entry tasks.
- [Claude/AI Agent, Feb 2026] **Auth recommendation:** Clerk or NextAuth.js for authentication + role management. Clerk is faster to integrate (hosted UI, built-in role management, webhook support for audit events). NextAuth.js is more flexible if you want full control. Either supports the admin/editor/viewer role model. Assumption: no SSO requirement (e.g., Azure AD) for v1 — if needed, both support it but add setup complexity.
- [Claude/AI Agent, Feb 2026] **Detailed data model (complementing Codex's schema):** The `values` table should store projected and actual amounts as separate columns (not overwriting one with the other) so variance = actual - projected is always computable. Schema: `values(id, line_item_id, period, projected_amount, actual_amount, note, updated_at, updated_by)`. This is the core of the projections-vs-actuals comparison without needing a separate table.
- [Claude/AI Agent, Feb 2026] **Excel export quality:** Use `exceljs` over `xlsx` for export — it supports cell styling, number formatting, merged cells, and formula injection (e.g., SUM rows for sector totals). If the current workbook has a specific layout the team expects, build a template-based export: define the `.xlsx` template once with placeholders, then fill data programmatically. This ensures exports look polished without fighting formatting in code.
- [Claude/AI Agent, Feb 2026] **MVP phasing suggestion:** Phase 1 (core): snapshot CRUD, line item grid with edit, projected/actual entry, lock/unlock, basic audit log, Excel export. Phase 2 (collaboration): multi-user editing with conflict detection, cell notes, change-reason prompts for large deltas. Phase 3 (insights): dashboard with variance charts, YTD trends, notification system. This lets you ship something usable quickly and layer on complexity.
- 
- [Project Owner] -as the human, i want to guide and then let the agents be automatic in creating. I am using codex and claude. It will be ideal and imperative that the ai agents discuss and decide as much as they can and communicate and work as a world-class development team and planning with themselves and not involve me unless necessary. Maybe that means to use github issues, or whatever you think is best to automate this buildout and keep it streaming. You AI Agents should be reviewing eahc others work, providing feedback/comments and continuing to build - ask me questions/guidance as a last resort.
- [Project Owner] -keep the project clean, use best practices. If i logoff and log back on, what is the best way and most minimal interaction that I can have that will just tell all you agents to start working again.
- [Claude/AI Agent, Feb 2026] **Agent coordination workflow — responding to owner's autonomy request:** Here's a concrete proposal for how Claude and Codex can work as an autonomous team:
  - **GitHub Issues as the task board:** Create labeled issues for each work item (e.g., `phase-1`, `backend`, `frontend`, `schema`). Agents pick up issues, assign themselves, and comment progress. The owner can glance at the issue board anytime to see status without needing to ask.
  - **PR-based code review:** Each agent works on a feature branch, opens a PR when done. The other agent reviews the PR via GitHub comments (code quality, consistency with conventions, test coverage). PRs merge to `main` only after review. This creates a natural audit trail of decisions.
  - **`CLAUDE.md` as the project brain:** This file (already in the repo root) serves as persistent instructions for Claude Code. It should contain: project conventions, current phase, what to work on next, and any decisions made. When you log back on and start Claude Code, it reads `CLAUDE.md` automatically and knows where to pick up. Codex can read it too.
  - **Resume workflow (answering "what's the best way to restart agents"):** Create a `CLAUDE.md` in the project root with a "Current Sprint" section listing active tasks. When you open Claude Code, just say: "Continue working on the project." Claude reads the `CLAUDE.md`, checks the GitHub issues board, and picks up the next task. Same for Codex — point it at the repo and say "Check the issues board and continue." Minimal interaction = one sentence.
  - **Conflict avoidance:** Assign clear ownership per PR. Example: Claude owns backend API + database, Codex owns frontend components. Or split by feature. Avoid two agents editing the same file in parallel.
  - **Escalation protocol:** Agents try to resolve ambiguity by checking the brainstorm doc, `CLAUDE.md`, and existing code patterns first. Only ask the owner for business-logic decisions that can't be inferred (e.g., "should negative actuals be allowed for refunds?").
- [Claude/AI Agent, Feb 2026] **Deployment for `cashflow.sukutproperties.com`:** If using Vercel (recommended for Next.js), add a custom domain in the Vercel dashboard and create a CNAME record pointing `cashflow.sukutproperties.com` → `cname.vercel-dns.com` in your DNS provider. Vercel handles SSL automatically. If the existing `sukutproperties.com` is hosted elsewhere (e.g., Azure, AWS), you'd just add the CNAME — no need to move other apps. Assumption: you have DNS access for the domain.
- [Claude/AI Agent, Feb 2026] **Real-time performance architecture** — owner confirmed speed is imperative. For real-time feel with 5 concurrent editors: use React Server Components for initial page loads (fast SSR), client-side state management (Zustand or React Query) for edits, and optimistic UI updates (show the change immediately, sync to server in background). For true real-time sync between users, add WebSocket or Server-Sent Events (SSE) in Phase 2 — not needed for MVP if users aren't editing the exact same cells simultaneously. Postgres with proper indexing easily handles the data volume (hundreds of line items × 12 months × a few snapshots).
- [Codex/AI Agent, Feb 26, 2026] **Schema refinement for your latest requirement:** replace separate `sectors` with generalized `groups` and `group_membership` tables so admins can create/delete sectors and non-operating sections without schema changes.
- [Codex/AI Agent, Feb 26, 2026] **Domain/deployment note for `cashflow.sukutproperties.com`:** add staging first (`cashflow-staging.sukutproperties.com`) and gate production deploy behind smoke tests (login, grid edit, lock version, Excel export) to reduce release risk.
- [Codex/AI Agent, Feb 26, 2026] **Audit integrity requirement:** audit entries should include request source (`ui_edit`, `import`, `bulk_action`, `api`) and immutable event IDs so investigations can trace exactly how data changed.
- [Codex/AI Agent, Feb 26, 2026] **Data quality checks on close:** block month lock if required fields are missing, if unresolved validation errors exist, or if large unexplained deltas exceed threshold.
- [Codex/AI Agent, Feb 26, 2026] **Decision logging pattern for autonomous agent work:** maintain `docs/DECISIONS.md` with short ADR-style entries (`context`, `decision`, `status`, `date`, `owner`) so agents can continue after restarts without re-asking settled questions.
- [Codex/AI Agent, Feb 26, 2026] **Autonomous backlog policy:** all ambiguous items should be opened as GitHub issues labeled `needs-owner` with a default proposal; if no owner response is needed for MVP timeline, proceed with the documented default and mark as `provisional`.
- [Claude/AI Agent, Feb 2026] **Schema convergence — merging Claude + Codex proposals:** I originally proposed `entities` with `parent_entity_id` (tree hierarchy). Codex proposed `groups` + `group_membership` with `group_type`. The owner's latest input (add/delete sectors, non-operating sections) favors Codex's approach — it's more flexible for admin-managed structure changes. Proposed merged schema:
  - `groups` table: id, name, group_type (sector / non_operating / custom), sort_order, is_active, archived_at, created_by
  - `line_items` table: id, group_id (FK), label, projection_method (enum), projection_params (JSON), sort_order, is_active, archived_at
  - `snapshots` table: id, name, as_of_month, status (draft/locked), structure_version_id (FK), created_by, locked_by, locked_at
  - `structure_versions` table: id, snapshot_id, created_at — captures which groups/line-items existed at lock time. Addresses Codex's structure mutability risk.
  - `values` table: id, line_item_id, snapshot_id, period, projected_amount, actual_amount, note, updated_by, updated_at
  - `audit_log` table: id, user_id, table_name, record_id, field, old_value, new_value, reason, source (ui_edit/import/bulk_action/api), timestamp
  - `users` table: id, name, email, role (admin/editor/viewer)
  - This merges: Codex's flexible groups, my separate projected/actual columns, Codex's audit source tracking, and the structure versioning needed for report reproducibility.
- [Claude/AI Agent, Feb 2026] **CI/CD pipeline (not yet discussed):** Use GitHub Actions. Recommended workflow:
  - On PR: run lint (ESLint + Prettier check), type-check (`tsc --noEmit`), unit tests (Vitest), and build verification.
  - On merge to `main`: auto-deploy to staging (`cashflow-staging.sukutproperties.com`). Run smoke tests (Codex's suggestion: login, grid edit, lock, Excel export).
  - Production deploy: manual trigger or auto after staging smoke tests pass. This gives a safety gate without slowing velocity.
  - Both agents should ensure all PRs pass CI before requesting review.
- [Claude/AI Agent, Feb 2026] **Testing strategy (not yet discussed):** Given this is a financial tool where wrong numbers have real consequences:
  - **Unit tests (Vitest):** projection calculation engine (spread, prior year ± %), variance calculations, audit log formatting. These are the highest-value tests — they guard business logic.
  - **Integration tests:** API routes for snapshot CRUD, lock/unlock permissions, Excel import/export round-trip (import → export → diff should be zero).
  - **E2E tests (Playwright):** critical user flows — login, create snapshot, edit grid, lock, export. Run on staging before production deploy.
  - Target: 80%+ coverage on business logic (calculations, permissions), lighter coverage on UI components.
- [Claude/AI Agent, Feb 2026] **Error monitoring & observability:** Use Sentry (free tier covers this scale) for error tracking in both frontend and backend. Add Vercel Analytics for performance monitoring (free with Vercel hosting). Log structured audit events to Postgres (already planned), but also consider shipping critical errors to a Slack channel for agent/owner visibility.
- [Claude/AI Agent, Feb 2026] **PDF export (mentioned as needed, not yet detailed):** Use a server-side HTML-to-PDF approach. Render the snapshot/dashboard as a styled HTML page, then convert with `@react-pdf/renderer` or `puppeteer` (headless Chrome). This lets you reuse the same React components for both the web view and the PDF. Simpler than building a separate PDF layout. Phase 2 item — Excel export is the priority.
- [Claude/AI Agent, Feb 2026] **Revised MVP phasing (incorporating new requirements):**
  - **Phase 1 (core — build first):** Next.js app scaffold, Postgres + Prisma schema, auth (Clerk), admin group management (add/delete sectors + non-operating sections), line item CRUD with projection strategy picker, data grid with monthly entry, snapshot create/lock/unlock, field-level audit log, Excel export (layout-compatible), template onboarding (new year from prior year). Deploy to staging.
  - **Phase 2 (collaboration + polish):** optimistic concurrent editing with conflict detection, cell-level notes, material-change threshold prompts, bulk update tool with preview/undo, saved filter presets, mobile card layout for entry, notifications (email/in-app), PDF export.
  - **Phase 3 (insights + scale):** variance analysis dashboard, YTD trend charts, snapshot comparison (side-by-side diff), real-time multi-user sync (WebSockets/SSE), advanced reporting views.
  - **Key change from prior phasing:** moved group management, projection strategy picker, and template onboarding into Phase 1 — these are core workflows, not nice-to-haves.
- [Claude/AI Agent, Feb 2026] **+1 on Codex's `DECISIONS.md` pattern.** This pairs well with `CLAUDE.md` (runtime instructions) and `CONVENTIONS.md` (code style). The three together form the project's institutional memory: `CLAUDE.md` = what to do next, `CONVENTIONS.md` = how to write code, `DECISIONS.md` = why we chose what we chose. All agents should check all three before starting work.

### Risks & Constraints

- [Codex/AI Agent, Feb 26, 2026] **Adoption risk:** if data entry is slower than Excel, users will bypass the app. Mitigation: keyboard navigation, paste-from-Excel support, and fast inline edits.
- [Codex/AI Agent, Feb 26, 2026] **Scope risk:** adding external accounting integrations too early can delay MVP. Mitigation: ship robust Excel bridge first, phase integrations after workflow stabilization.
- [Codex/AI Agent, Feb 26, 2026] **Migration risk:** historical tabs may have inconsistent labels/formulas that do not map cleanly. Mitigation: define a canonical mapping table and reconcile totals before migration sign-off.
- [Codex/AI Agent, Feb 26, 2026] **Control risk:** without clear ownership rules, lock/reopen workflows can be abused. Mitigation: enforce role-based close/reopen permissions and log mandatory reopen reasons.
- [Claude/AI Agent, Feb 2026] **Excel export fidelity risk:** if the exported `.xlsx` doesn't match the team's expected layout (column order, formatting, sector grouping, subtotals), users will lose trust in the tool fast. Mitigation: capture the exact layout of the current workbook as a spec, build export against that spec, and have the team validate exports against their current file before go-live.
- [Claude/AI Agent, Feb 2026] **AI-built code maintainability risk:** since Claude Code and Codex are building this, ensure consistent patterns (folder structure, naming conventions, error handling) are established early via a `CONVENTIONS.md` or similar document. Without this, two AI agents may produce working but stylistically divergent code that's harder for humans to review and maintain. Mitigation: define conventions before coding starts; use linting (ESLint + Prettier) to enforce automatically.
- [Codex/AI Agent, Feb 26, 2026] **Structure mutability risk:** allowing add/delete sectors and custom sections can cause report drift between months. Mitigation: version the report structure and tie each snapshot to an explicit structure version.
- [Codex/AI Agent, Feb 26, 2026] **Bulk action risk:** percentage spreads and mass updates can introduce large errors quickly. Mitigation: require preview diff, change reason, and one-click rollback for bulk actions.
- [Codex/AI Agent, Feb 26, 2026] **Decision churn risk:** if unresolved questions remain open too long, agents may implement conflicting assumptions. Mitigation: enforce "default-unless-overridden" decisions in Section 4 and track them in `docs/DECISIONS.md`.
- [Claude/AI Agent, Feb 2026] **Projection calculation trust risk:** if the auto-spread or prior-year-±-% logic produces wrong numbers silently, it's worse than Excel because users may trust "the system." Mitigation: always show the projection method + params visibly on each line item (e.g., a small badge "Annual ÷ 12" or "PY +5%"), and include a "recalculate" button that re-derives from params so users can verify. Add unit tests for every projection method with known inputs/outputs.
- [Claude/AI Agent, Feb 2026] **No-CI-on-day-one risk:** if agents start coding before CI is set up, broken code can land on `main` silently. Mitigation: the very first PR should be the project scaffold with linting, type-checking, and a passing test — CI must be green before any feature work begins.

---

## 6. Contributor Guidelines

**For anyone adding to this document:**

1. **Identify yourself:** Start each addition with `[Your Name/Role, Date]`
2. **Be specific:** Avoid generic advice. Include concrete examples, numbers, or workflows where possible.
3. **Stay organized:** Add content to the most relevant section. If a new section is needed, add it with a clear heading.
4. **Preserve context:** Don’t remove others’ contributions. Add, refine, or comment—don’t overwrite without reason.
5. **AI agents:** When suggesting solutions, note assumptions and what you’d need to validate (e.g., "Assuming 5–10 concurrent users...").

---

## 7. Next Steps

- [ ] Review and validate the line items from `2026 Cash Flow Projection.xlsx` (Columns A–B)
- [ ] Document the exact structure of the current Excel model (formulas, dependencies, tabs)
- [ ] Prioritize pain points and desired features
- [ ] Decide on solution approach (web app, enhanced Excel, database + UI, etc.)
- [ ] Define MVP scope
- [ ] [Claude/AI Agent, Feb 2026] Answer the clarifying questions in Section 4 (line item definition, projection horizon, actuals entry method, user roles, mobile needs)
- [ ] [Claude/AI Agent, Feb 2026] Audit the current Excel workbook: catalog all formulas, cross-tab references, conditional formatting, and hidden logic — this is the migration source-of-truth
- [ ] [Claude/AI Agent, Feb 2026] Establish coding conventions (`CONVENTIONS.md`) before development begins — folder structure, naming, error handling, linting rules
- [ ] [Claude/AI Agent, Feb 2026] Build a clickable prototype (Figma or HTML mockup) of the grid + snapshot workflow for team feedback before committing to full build
- [ ] [Claude/AI Agent, Feb 2026] Validate Excel export layout with the team using a sample export from the new system vs. the current workbook
- [ ] [Claude/AI Agent, Feb 2026] Initialize the GitHub repo with: `CLAUDE.md` (project brain), `CONVENTIONS.md`, issue templates, and branch protection rules — this is the foundation for the agent-autonomous workflow
- [ ] [Claude/AI Agent, Feb 2026] Create GitHub issues for Phase 1 work items (schema, auth, grid UI, snapshot CRUD, Excel export, audit log) so both agents can pick up tasks independently
- [ ] [Claude/AI Agent, Feb 2026] Set up DNS CNAME for `cashflow.sukutproperties.com` → Vercel (or chosen host) — can be done in parallel with development
- [ ] [Claude/AI Agent, Feb 2026] Design the projection strategy picker UI (annual spread, prior year ± %, manual) — this is a core differentiator vs the Excel model and should be in Phase 1
- [ ] [Codex/AI Agent, Feb 26, 2026] Create `docs/DECISIONS.md` and seed it with the current default decisions from Section 4 (non-operating modeling, soft delete, mid-year backfill behavior, mobile v1 priority, material-change threshold, performance SLOs)
- [ ] [Codex/AI Agent, Feb 26, 2026] Add a `needs-owner` issue template that requires: decision needed, proposed default, deadline impact, and fallback behavior
- [ ] [Codex/AI Agent, Feb 26, 2026] Convert Section 4 owner-confirmed answers into machine-readable config defaults (roles, lock permissions, horizon, export compatibility, audit granularity) for implementation consistency
- [ ] [Claude/AI Agent, Feb 2026] **First PR: project scaffold** — Next.js + TypeScript + Prisma + Postgres + ESLint + Prettier + Vitest + GitHub Actions CI. This must be the very first thing built and merged, before any feature work. Both agents work off this foundation.
- [ ] [Claude/AI Agent, Feb 2026] Write unit tests for the projection calculation engine (annual spread, prior year ± %, prior year flat) before or alongside implementation — these are the highest-risk business logic functions.
- [x] [Claude/AI Agent, Feb 2026] ~~Answer the clarifying questions in Section 4~~ — all key questions now answered by owner. Remaining items (Codex's new questions) have proposed defaults that both agents agree on.
- [x] [Both Agents, Feb 2026] ~~Decide on solution approach~~ — confirmed: Next.js + TypeScript + Postgres + Prisma web app, hosted on Vercel at `cashflow.sukutproperties.com`.

---

## 8. Appendix: Reference Information

### Line Items (from Columns A–B)

_To be populated from `2026 Cash Flow Projection.xlsx` tab `020326` — please add the actual list when available._

### Business Sectors Summary

[project owner] - i should be able to add/delete business sectors and identify what is a business sector. Note on the current model also includes a section called "Non-Operating Cash Flow Items". This isn't related to a business sector per se, but just items that are related to the overall business. We should be able to add sections or items like this as well.

| Sector          | Description                         |
| --------------- | ----------------------------------- |
| Rent            | Tenant rental income                |
| 71–91 Dumpsite | Dumpsite-related revenue/expenses   |
| Storage Center  | Storage facility revenue/expenses   |
| Electrical      | Electrical-related revenue/expenses |
| Interest        | Interest income/expense             |
| Other           | Miscellaneous items                 |

---

_Last updated: Feb 26, 2026 (round 3) — contributions by Project Owner, Claude/AI Agent, Codex/AI Agent_
