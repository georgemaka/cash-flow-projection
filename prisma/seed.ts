/**
 * Seed script for development data.
 *
 * Creates a realistic set of groups, line items, one draft snapshot, and
 * sample projected values for January–June 2026.
 *
 * Idempotent: running it twice will not create duplicate records because
 * all top-level entities are upserted by a stable unique key.
 */

import { PrismaClient } from "@prisma/client";

// Local enum values matching prisma/schema.prisma — avoids needing generated client
const GroupType = { sector: "sector", non_operating: "non_operating", custom: "custom" } as const;
const ProjectionMethod = {
  manual: "manual",
  annual_spread: "annual_spread",
  prior_year_pct: "prior_year_pct",
  prior_year_flat: "prior_year_flat"
} as const;
const UserRole = { admin: "admin", editor: "editor", viewer: "viewer" } as const;

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const SEED_USERS = [
  {
    id: "seed-user-admin",
    name: "Alice Admin",
    email: "alice@sukutproperties.com",
    role: UserRole.admin
  },
  {
    id: "seed-user-editor",
    name: "Bob Editor",
    email: "bob@sukutproperties.com",
    role: UserRole.editor
  },
  {
    id: "seed-user-viewer",
    name: "Carol Viewer",
    email: "carol@sukutproperties.com",
    role: UserRole.viewer
  }
];

const SEED_GROUPS = [
  {
    id: "seed-group-residential",
    name: "Residential Properties",
    groupType: GroupType.sector,
    sortOrder: 1
  },
  {
    id: "seed-group-commercial",
    name: "Commercial Properties",
    groupType: GroupType.sector,
    sortOrder: 2
  },
  {
    id: "seed-group-nonop",
    name: "Non-Operating Items",
    groupType: GroupType.non_operating,
    sortOrder: 3
  }
];

const SEED_LINE_ITEMS = [
  // Residential
  {
    id: "seed-li-res-rent",
    groupId: "seed-group-residential",
    label: "Residential Rent Revenue",
    projectionMethod: ProjectionMethod.annual_spread,
    projectionParams: { annualTotal: "1200000.00" },
    sortOrder: 1
  },
  {
    id: "seed-li-res-vacancy",
    groupId: "seed-group-residential",
    label: "Vacancy Allowance",
    projectionMethod: ProjectionMethod.prior_year_pct,
    projectionParams: { pct: "-0.05" },
    sortOrder: 2
  },
  {
    id: "seed-li-res-maintenance",
    groupId: "seed-group-residential",
    label: "Maintenance & Repairs",
    projectionMethod: ProjectionMethod.manual,
    projectionParams: undefined,
    sortOrder: 3
  },
  // Commercial
  {
    id: "seed-li-com-rent",
    groupId: "seed-group-commercial",
    label: "Commercial Lease Revenue",
    projectionMethod: ProjectionMethod.annual_spread,
    projectionParams: { annualTotal: "840000.00" },
    sortOrder: 1
  },
  {
    id: "seed-li-com-cam",
    groupId: "seed-group-commercial",
    label: "CAM Reimbursements",
    projectionMethod: ProjectionMethod.prior_year_flat,
    projectionParams: { flatAmount: "5000.00" },
    sortOrder: 2
  },
  // Non-Operating
  {
    id: "seed-li-nonop-interest",
    groupId: "seed-group-nonop",
    label: "Interest Income",
    projectionMethod: ProjectionMethod.manual,
    projectionParams: undefined,
    sortOrder: 1
  },
  {
    id: "seed-li-nonop-depreciation",
    groupId: "seed-group-nonop",
    label: "Depreciation",
    projectionMethod: ProjectionMethod.annual_spread,
    projectionParams: { annualTotal: "-360000.00" },
    sortOrder: 2
  }
];

// Monthly projected values for Jan–Jun 2026
// Format: { lineItemId, period (YYYY-MM-01 as Date), projectedAmount }
function buildSeedValues(snapshotId: string) {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

  const amounts: Record<string, string[]> = {
    "seed-li-res-rent": [
      "100000.00",
      "100000.00",
      "100000.00",
      "100000.00",
      "100000.00",
      "100000.00"
    ],
    "seed-li-res-vacancy": ["-5000.00", "-5000.00", "-5000.00", "-5000.00", "-5000.00", "-5000.00"],
    "seed-li-res-maintenance": ["8000.00", "6000.00", "12000.00", "7000.00", "9000.00", "11000.00"],
    "seed-li-com-rent": ["70000.00", "70000.00", "70000.00", "70000.00", "70000.00", "70000.00"],
    "seed-li-com-cam": ["5000.00", "5000.00", "5000.00", "5000.00", "5000.00", "5000.00"],
    "seed-li-nonop-interest": ["1200.00", "1200.00", "1200.00", "1200.00", "1200.00", "1200.00"],
    "seed-li-nonop-depreciation": [
      "-30000.00",
      "-30000.00",
      "-30000.00",
      "-30000.00",
      "-30000.00",
      "-30000.00"
    ]
  };

  const entries = [];
  for (const [lineItemId, monthlyAmounts] of Object.entries(amounts)) {
    for (let i = 0; i < months.length; i++) {
      entries.push({
        lineItemId,
        snapshotId,
        period: new Date(`${months[i]}-01T00:00:00.000Z`),
        projectedAmount: monthlyAmounts[i]
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Starting seed...");

  // Users
  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: user
    });
    console.log(`  ✓ User: ${user.name}`);
  }

  // Groups
  for (const group of SEED_GROUPS) {
    await prisma.group.upsert({
      where: { id: group.id },
      update: { name: group.name, groupType: group.groupType, sortOrder: group.sortOrder },
      create: { ...group, createdBy: "seed-user-admin" }
    });
    console.log(`  ✓ Group: ${group.name}`);
  }

  // Line items
  for (const item of SEED_LINE_ITEMS) {
    await prisma.lineItem.upsert({
      where: { id: item.id },
      update: {
        label: item.label,
        projectionMethod: item.projectionMethod,
        projectionParams: item.projectionParams,
        sortOrder: item.sortOrder
      },
      create: item
    });
    console.log(`  ✓ LineItem: ${item.label}`);
  }

  // Snapshot (draft, FY2026)
  const snapshot = await prisma.snapshot.upsert({
    where: { id: "seed-snapshot-fy2026" },
    update: { name: "FY2026 Draft" },
    create: {
      id: "seed-snapshot-fy2026",
      name: "FY2026 Draft",
      asOfMonth: new Date("2026-01-01T00:00:00.000Z"),
      status: "draft",
      createdBy: "seed-user-admin"
    }
  });
  console.log(`  ✓ Snapshot: ${snapshot.name}`);

  // Values (upsert each month × line item)
  const valueEntries = buildSeedValues(snapshot.id);
  let valueCount = 0;
  for (const entry of valueEntries) {
    await prisma.value.upsert({
      where: {
        lineItemId_snapshotId_period: {
          lineItemId: entry.lineItemId,
          snapshotId: entry.snapshotId,
          period: entry.period
        }
      },
      update: { projectedAmount: entry.projectedAmount },
      create: { ...entry, updatedBy: "seed-user-admin" }
    });
    valueCount++;
  }
  console.log(`  ✓ Values: ${valueCount} entries (7 line items × 6 months)`);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
