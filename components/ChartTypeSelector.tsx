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
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
            Chart Type
          </span>
          <span style={{ fontSize: 11, color: "var(--placeholder)" }}>
            optional, AI picks if blank
          </span>
        </div>
        {value && (
          <button
            onClick={() => onChange(null)}
            style={{ fontSize: 11, fontWeight: 500, color: "var(--brand-dark-1)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* 4-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {CHART_TYPES.map(ct => {
          const selected = value === ct.id;
          return (
            <button
              key={ct.id}
              onClick={() => onChange(ct.id === value ? null : ct.id)}
              title={ct.description}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 6, padding: "14px 4px",
                borderRadius: 12,
                border: `1.5px solid ${selected ? "var(--brand-primary)" : "#B0C8CA"}`,
                background: selected ? "var(--brand-light-5)" : "#fff",
                color: selected ? "var(--brand-dark-2)" : "#4B6365",
                boxShadow: selected ? "0 0 0 2px var(--brand-light-4)" : "none",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{ct.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.2, textAlign: "center" }}>{ct.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
