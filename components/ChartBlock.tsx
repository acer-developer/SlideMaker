"use client";
import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { ChartBlock as ChartBlockType } from "@/lib/types";
import FileUpload from "./FileUpload";
import ChartTypeSelector from "./ChartTypeSelector";
import type { ChartTypeId } from "@/lib/chartTypes";

interface Props {
  block: ChartBlockType;
  index: number;
  total: number;
  onChange: (id: string, updates: Partial<ChartBlockType>) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--muted)",
  marginBottom: 8,
};

export default function ChartBlock({ block, index, total, onChange, onRemove, disabled }: Props) {
  const [showInstructions, setShowInstructions] = useState(!!block.instructions);

  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--border)",
      borderRadius: 16,
      boxShadow: "0 2px 8px rgba(26,74,76,0.07)",
      overflow: "hidden",
      opacity: disabled ? 0.55 : 1,
      pointerEvents: disabled ? "none" : "auto",
    }}>

      {/* Card header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px",
        background: "var(--brand-dark-3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "var(--brand-primary)", color: "#fff",
            fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {index + 1}
          </span>
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 600, letterSpacing: "0.01em" }}>
            Chart {index + 1}
          </span>
        </div>
        {total > 1 && (
          <button
            onClick={() => onRemove(block.id)}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 500,
              padding: "4px 10px", borderRadius: 8,
              color: "#FCA5A5", background: "rgba(239,68,68,0.15)",
              border: "none", cursor: "pointer",
            }}
          >
            <Trash2 size={11} /> Remove
          </button>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "24px 24px 28px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* DATA */}
        <FileUpload
          fileName={block.fileName}
          dataRaw={block.dataRaw}
          onDataChange={(data, name) => onChange(block.id, { dataRaw: data, fileName: name })}
        />

        {/* CONTEXT */}
        <div>
          <label style={LABEL}>
            Context <span style={{ color: "#EF4444" }}>*</span>
            <span style={{ marginLeft: 6, fontWeight: 400, textTransform: "none", letterSpacing: "normal", color: "var(--placeholder)" }}>
              what is this data about?
            </span>
          </label>
          <textarea
            placeholder="e.g. Monthly revenue performance for FY2024 across all business units, broken down by region and product segment"
            value={block.context}
            onChange={e => onChange(block.id, { context: e.target.value })}
            maxLength={1200}
            style={{
              display: "block",
              width: "100%",
              minHeight: 80,
              padding: "10px 12px",
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: "inherit",
              border: `1.5px solid ${block.context ? "var(--brand-light-3)" : "#B0C8CA"}`,
              borderRadius: 10,
              background: block.context ? "var(--brand-light-5)" : "#fff",
              color: "var(--text)",
              outline: "none",
              resize: "vertical",
            }}
          />
          <div style={{ textAlign: "right", fontSize: 10, color: "var(--placeholder)", marginTop: 4 }}>
            {block.context.length} / 1200
          </div>
        </div>

        {/* CHART TYPE */}
        <ChartTypeSelector
          value={block.chartType}
          onChange={(v: ChartTypeId | null) => onChange(block.id, { chartType: v })}
        />

        {/* INSTRUCTIONS */}
        <div style={{
          border: `1.5px solid ${block.instructions ? "#FCD34D" : "var(--border)"}`,
          borderRadius: 12,
          overflow: "hidden",
          background: block.instructions ? "#FFFEF5" : "#FAFEFE",
        }}>
          <button
            onClick={() => setShowInstructions(s => !s)}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 16px",
              background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
                Instructions
              </span>
              <span style={{ fontSize: 11, color: "var(--placeholder)" }}>
                AI follows these strictly
              </span>
            </div>
            {showInstructions
              ? <ChevronUp size={14} color="var(--muted)" />
              : <ChevronDown size={14} color="var(--muted)" />
            }
          </button>

          {showInstructions && (
            <div style={{ padding: "0 16px 16px" }}>
              <textarea
                placeholder="e.g. Highlight the Q3 spike. Note that growth came from the enterprise segment. Keep tone formal and concise. Focus on the YoY comparison."
                value={block.instructions}
                onChange={e => onChange(block.id, { instructions: e.target.value })}
                maxLength={1500}
                style={{
                  display: "block",
                  width: "100%",
                  minHeight: 90,
                  padding: "10px 12px",
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                  border: "1.5px solid #FCD34D",
                  borderRadius: 10,
                  background: "#FFFBEB",
                  color: "var(--text)",
                  outline: "none",
                  resize: "vertical",
                }}
              />
              <div style={{ textAlign: "right", fontSize: 10, color: "var(--placeholder)", marginTop: 4 }}>
                {block.instructions.length} / 1500
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
