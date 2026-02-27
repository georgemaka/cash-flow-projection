"use client";

import { useCallback, useState } from "react";

export type ProjectionMethod =
  | "manual"
  | "annual_spread"
  | "prior_year_pct"
  | "prior_year_flat"
  | "custom_formula";

export interface ProjectionConfig {
  method: ProjectionMethod;
  params: Record<string, unknown>;
}

interface ProjectionStrategyPickerProps {
  value: ProjectionConfig;
  onChange: (config: ProjectionConfig) => void;
  disabled?: boolean;
}

const METHOD_LABELS: Record<ProjectionMethod, string> = {
  manual: "Manual Entry",
  annual_spread: "Annual Spread",
  prior_year_pct: "Prior Year +/- %",
  prior_year_flat: "Prior Year Flat",
  custom_formula: "Custom Formula"
};

const METHOD_DESCRIPTIONS: Record<ProjectionMethod, string> = {
  manual: "Enter each month's projection manually.",
  annual_spread: "Spread an annual total evenly across 12 months.",
  prior_year_pct: "Apply a percentage change to prior year actuals.",
  prior_year_flat: "Copy prior year actuals exactly (0% change).",
  custom_formula: "Define a custom calculation formula."
};

/**
 * Projection strategy picker with method-specific parameter inputs.
 * Used when creating or editing a line item's projection configuration.
 */
export function ProjectionStrategyPicker({
  value,
  onChange,
  disabled = false
}: ProjectionStrategyPickerProps) {
  const handleMethodChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const method = e.target.value as ProjectionMethod;
      // Reset params when method changes
      const defaultParams = getDefaultParams(method);
      onChange({ method, params: defaultParams });
    },
    [onChange]
  );

  return (
    <div className="strategy-picker">
      <div className="strategy-picker-select">
        <label className="strategy-picker-label" htmlFor="projection-method">
          Projection Method
        </label>
        <select
          id="projection-method"
          value={value.method}
          onChange={handleMethodChange}
          disabled={disabled}
        >
          {Object.entries(METHOD_LABELS).map(([method, label]) => (
            <option key={method} value={method}>
              {label}
            </option>
          ))}
        </select>
        <p className="strategy-picker-desc">{METHOD_DESCRIPTIONS[value.method]}</p>
      </div>

      <div className="strategy-picker-params">
        {value.method === "annual_spread" && (
          <AnnualSpreadParams
            params={value.params}
            onChange={(params) => onChange({ method: value.method, params })}
            disabled={disabled}
          />
        )}
        {value.method === "prior_year_pct" && (
          <PriorYearPctParams
            params={value.params}
            onChange={(params) => onChange({ method: value.method, params })}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parameter Inputs
// ---------------------------------------------------------------------------

interface ParamProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled: boolean;
}

function AnnualSpreadParams({ params, onChange, disabled }: ParamProps) {
  const annualTotal = (params.annualTotal as string) ?? "";

  return (
    <div className="strategy-param">
      <label className="strategy-param-label" htmlFor="annual-total">
        Annual Total ($)
      </label>
      <input
        id="annual-total"
        type="text"
        inputMode="decimal"
        placeholder="e.g., 120000"
        value={annualTotal}
        onChange={(e) => onChange({ ...params, annualTotal: e.target.value })}
        disabled={disabled}
      />
      {annualTotal && !isNaN(Number(annualTotal.replace(/,/g, ""))) && (
        <p className="strategy-param-hint">
          Monthly: $
          {(Number(annualTotal.replace(/,/g, "")) / 12).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}
        </p>
      )}
    </div>
  );
}

function PriorYearPctParams({ params, onChange, disabled }: ParamProps) {
  const [inputValue, setInputValue] = useState(String(params.pctChange ?? ""));

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setInputValue(raw);
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        onChange({ ...params, pctChange: num });
      }
    },
    [params, onChange]
  );

  return (
    <div className="strategy-param">
      <label className="strategy-param-label" htmlFor="pct-change">
        Percentage Change (%)
      </label>
      <input
        id="pct-change"
        type="text"
        inputMode="decimal"
        placeholder="e.g., 5 for +5%, -10 for -10%"
        value={inputValue}
        onChange={handleChange}
        disabled={disabled}
      />
      {inputValue && !isNaN(Number(inputValue)) && (
        <p className="strategy-param-hint">
          {Number(inputValue) >= 0 ? "+" : ""}
          {Number(inputValue)}% applied to each prior year monthly actual
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultParams(method: ProjectionMethod): Record<string, unknown> {
  switch (method) {
    case "annual_spread":
      return { annualTotal: "" };
    case "prior_year_pct":
      return { pctChange: 0 };
    default:
      return {};
  }
}
