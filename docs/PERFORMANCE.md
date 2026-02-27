# Performance Report

Benchmark results validating ADR-006 SLO targets.

## Dataset

Realistic benchmark: 10 groups, 50 line items, 600 values (12 months), with projected and actual amounts.

## Results (service-layer, no DB)

| Operation | Measured | SLO Budget | Headroom for DB |
|-|-|-|-|
| Grid data assembly (600 values) | 1.4ms | 2,000ms | 99.9% |
| Grid + subtotal calculations | 0.9ms | 2,000ms | 99.9% |
| Value upsert preparation | 0.1ms | 400ms | 99.9% |
| Excel export (50 items × 12mo) | 102ms | 30,000ms | 99.7% |

## Analysis

All application-layer operations complete in under 2ms for grid operations and 102ms for Excel export. This leaves >98% of the SLO budget for database queries, network latency, and React rendering.

### Database Index Review

**Value table:**
- `@@unique([lineItemId, snapshotId, period])` — covers upsert lookups
- `@@index([snapshotId, period])` — **added** for grid load queries (`WHERE snapshotId = X`)

The grid load query (`value.findMany({ where: { snapshotId } })`) previously relied only on the composite unique starting with `lineItemId`, which PostgreSQL cannot use for `snapshotId`-only filters. The new index covers this.

**AuditLog table** (already indexed):
- `@@index([tableName, recordId])` — read queries
- `@@index([tableName, recordId, field])` — field-specific queries
- `@@index([userId])` — user audit trail

### Optimization Notes

- **Audit writes are synchronous** in the current design. If save latency exceeds 400ms after DB integration, consider making audit writes fire-and-forget with error logging.
- **Grid rendering** is the likely bottleneck for perceived load time. React rendering 600 cells is well within limits, but if needed, virtual scrolling can be added (only renders visible rows).
- **Excel export** is I/O-bound (ExcelJS buffer generation). The 102ms result with 50 items suggests we can handle 10x the data within the 30s target.

## Running Benchmarks

```bash
npx vitest run tests/perf/
```
