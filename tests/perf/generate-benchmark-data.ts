/**
 * Generates realistic benchmark data for performance testing.
 *
 * Target dataset: 10 groups × 5 line items each = 50 line items
 * × 12 months = 600 value rows per snapshot.
 * With projected + actual amounts → realistic workload for grid load.
 */

import Decimal from "decimal.js";

export interface BenchmarkGroup {
  id: string;
  name: string;
  groupType: "sector" | "non_operating";
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BenchmarkLineItem {
  id: string;
  groupId: string;
  label: string;
  projectionMethod: string;
  projectionParams: unknown;
  sortOrder: number;
  isActive: boolean;
}

export interface BenchmarkValue {
  id: string;
  lineItemId: string;
  snapshotId: string;
  period: Date;
  projectedAmount: Decimal | null;
  actualAmount: Decimal | null;
  note: string | null;
  updatedBy: string | null;
}

export interface BenchmarkSnapshot {
  id: string;
  name: string;
  asOfMonth: Date;
  status: "draft" | "locked";
  createdBy: string;
}

const GROUP_NAMES = [
  "Rental Income",
  "Parking Revenue",
  "Operating Expenses",
  "Maintenance & Repairs",
  "Insurance",
  "Property Tax",
  "Utilities",
  "Management Fees",
  "Capital Expenditures",
  "Non-Operating Items"
];

const LINE_ITEM_TEMPLATES: Record<string, string[]> = {
  "Rental Income": [
    "Base Rent",
    "CAM Recoveries",
    "Percentage Rent",
    "Tenant Improvements",
    "Lease Termination Fees"
  ],
  "Parking Revenue": [
    "Monthly Parking",
    "Transient Parking",
    "Valet Revenue",
    "EV Charging",
    "Overflow Lot"
  ],
  "Operating Expenses": ["Payroll", "Janitorial", "Security", "Landscaping", "Pest Control"],
  "Maintenance & Repairs": [
    "HVAC Service",
    "Plumbing",
    "Electrical",
    "Elevator Maintenance",
    "Roof Repairs"
  ],
  Insurance: [
    "Property Insurance",
    "Liability Insurance",
    "Umbrella Policy",
    "Workers Comp",
    "Earthquake Rider"
  ],
  "Property Tax": ["County Tax", "City Tax", "Special Assessment", "School Bond", "Mello-Roos"],
  Utilities: ["Electric", "Water/Sewer", "Gas", "Trash Removal", "Internet/Telecom"],
  "Management Fees": [
    "Property Management",
    "Asset Management",
    "Leasing Commission",
    "Legal Fees",
    "Accounting"
  ],
  "Capital Expenditures": [
    "Roof Replacement",
    "Parking Lot Resurfacing",
    "Lobby Renovation",
    "HVAC Replacement",
    "Elevator Modernization"
  ],
  "Non-Operating Items": [
    "Debt Service",
    "Interest Income",
    "Depreciation",
    "Loan Proceeds",
    "Capital Reserve Contribution"
  ]
};

const METHODS = ["manual", "annual_spread", "prior_year_pct", "prior_year_flat"];

export function generateBenchmarkData(year: number = 2026): {
  snapshot: BenchmarkSnapshot;
  groups: BenchmarkGroup[];
  lineItems: BenchmarkLineItem[];
  values: BenchmarkValue[];
} {
  const snapshotId = "bench-snap-1";
  const snapshot: BenchmarkSnapshot = {
    id: snapshotId,
    name: `${year} Cash Flow Projection`,
    asOfMonth: new Date(Date.UTC(year, 11, 1)),
    status: "draft",
    createdBy: "bench-user"
  };

  const groups: BenchmarkGroup[] = [];
  const lineItems: BenchmarkLineItem[] = [];
  const values: BenchmarkValue[] = [];

  let lineItemCounter = 0;
  let valueCounter = 0;

  GROUP_NAMES.forEach((name, gi) => {
    const groupId = `bench-group-${gi}`;
    groups.push({
      id: groupId,
      name,
      groupType: gi === 9 ? "non_operating" : "sector",
      sortOrder: gi,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const itemLabels = LINE_ITEM_TEMPLATES[name] ?? [];
    itemLabels.forEach((label, li) => {
      const lineItemId = `bench-li-${lineItemCounter++}`;
      const method = METHODS[li % METHODS.length];
      const params =
        method === "annual_spread"
          ? { annualTotal: String((50000 + Math.random() * 200000).toFixed(0)) }
          : method === "prior_year_pct"
            ? { pctChange: Math.round((Math.random() * 10 - 5) * 10) / 10 }
            : {};

      lineItems.push({
        id: lineItemId,
        groupId,
        label,
        projectionMethod: method,
        projectionParams: params,
        sortOrder: li,
        isActive: true
      });

      // Generate 12 months of values
      for (let m = 0; m < 12; m++) {
        const baseAmount = 5000 + Math.random() * 50000;
        const hasActual = m < 6; // First 6 months have actuals
        values.push({
          id: `bench-val-${valueCounter++}`,
          lineItemId,
          snapshotId,
          period: new Date(Date.UTC(year, m, 1)),
          projectedAmount: new Decimal(baseAmount.toFixed(2)),
          actualAmount: hasActual
            ? new Decimal((baseAmount * (0.9 + Math.random() * 0.2)).toFixed(2))
            : null,
          note: null,
          updatedBy: "bench-user"
        });
      }
    });
  });

  return { snapshot, groups, lineItems, values };
}

/**
 * Returns summary stats for the benchmark dataset.
 */
export function benchmarkDataSummary(data: ReturnType<typeof generateBenchmarkData>): string {
  return [
    `Groups: ${data.groups.length}`,
    `Line Items: ${data.lineItems.length}`,
    `Values: ${data.values.length}`,
    `Periods: 12 months`,
    `Total cells: ${data.lineItems.length * 12}`
  ].join(", ");
}
