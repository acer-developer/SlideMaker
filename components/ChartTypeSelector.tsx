"use client";
import { CHART_TYPES } from "@/lib/chartTypes";
import type { ChartTypeId } from "@/lib/chartTypes";

interface Props {
  value: ChartTypeId | null;
  onChange: (v: ChartTypeId | null) => void;
}

export default function ChartTypeSelector({ value, onChange }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <label
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--muted)" }}
        >
          Chart Type
          <span
            className="ml-1.5 font-normal normal-case tracking-normal"
            style={{ color: "var(--placeholder)" }}
          >
            optional, AI picks if blank
          </span>
        </label>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="text-xs"
            style={{ color: "var(--brand-dark-1)" }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {CHART_TYPES.map(ct => {
          const selected = value === ct.id;
          return (
            <button
              key={ct.id}
              onClick={() => onChange(ct.id === value ? null : ct.id)}
              title={ct.description}
              className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all"
              style={{
                borderColor: selected ? "var(--brand-primary)" : "#B0C8CA",
                background: selected ? "var(--brand-light-5)" : "#fff",
                color: selected ? "var(--brand-dark-2)" : "#4B6365",
                boxShadow: selected ? "0 0 0 2px var(--brand-light-3)" : "none",
              }}
            >
              <span className="text-lg leading-none">{ct.icon}</span>
              <span className="text-xs font-medium leading-tight text-center">{ct.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
