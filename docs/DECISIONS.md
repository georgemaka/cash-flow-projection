# DECISIONS

This file tracks agreed decisions that agents should treat as defaults unless explicitly overridden by the Project Owner.

## ADR-001

- Date: 2026-02-26
- Owner: Project Owner + AI Agents
- Status: accepted
- Context: The model must support "Non-Operating Cash Flow Items" and future admin-defined sections without schema changes.
- Decision: Model report sections using `groups` with `group_type = sector | non_operating | custom`, and treat non-operating as a first-class peer to sectors.

## ADR-002

- Date: 2026-02-26
- Owner: Project Owner + AI Agents
- Status: accepted
- Context: Historical reports must remain reproducible when structure changes over time.
- Decision: Use soft delete for groups and line items (`is_active=false`, `archived_at`) and do not hard-delete production financial structure records.

## ADR-003

- Date: 2026-02-26
- Owner: Project Owner + AI Agents
- Status: accepted
- Context: New line items can be added mid-year.
- Decision: For newly added items, backfill prior closed months as `null` (display as `N/A`), not zero, and exclude those months from variance calculations.

## ADR-004

- Date: 2026-02-26
- Owner: Project Owner + AI Agents
- Status: accepted
- Context: Mobile usability is required for data updates.
- Decision: Prioritize mobile fast monthly entry in v1 (compact edit-first layout); deeper variance analysis and drill-down can be expanded in later phases.

## ADR-005

- Date: 2026-02-26
- Owner: Project Owner + AI Agents
- Status: accepted
- Context: Significant forecast changes need explicit rationale for auditability.
- Decision: Require change reason notes when delta exceeds `max($1,000, 5%)`.

## ADR-006

- Date: 2026-02-26
- Owner: Project Owner + AI Agents
- Status: accepted
- Context: Speed is a top requirement for editing and reporting workflows.
- Decision: Adopt these performance SLO targets for MVP:
  - p95 grid load (12 months): < 2 seconds
  - p95 save acknowledgment: < 400 ms
  - p95 Excel export generation: < 30 seconds (standard workbook size)

## ADR-007

- Date: 2026-02-27
- Owner: Project Owner + AI Agents
- Status: accepted
- Context: Auth roles (admin/editor/viewer) are enforced by API guards. In local dev, `DEV_AUTH_BYPASS=true` grants admin. In production, each user needs their Clerk `publicMetadata.role` set explicitly — otherwise they default to "viewer" and cannot write.
- Decision: Before production launch, configure Clerk Dashboard roles for all admin/editor users. Checklist:
  1. In Clerk Dashboard → Users → select user → publicMetadata → set `{ "role": "admin" }` or `"editor"`
  2. Ensure `DEV_AUTH_BYPASS` is `false` (or absent) in Vercel production env vars
  3. Verify admin operations (group CRUD, line item CRUD, snapshot lock/unlock) work for admin users
  4. Verify viewers get read-only access (403 on write endpoints)
