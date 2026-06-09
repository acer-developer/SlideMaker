"use client";
import { BRAND } from "@/lib/colors";
import type { ChartBlock } from "@/lib/types";
import { buildChartSpec } from "@/lib/chartConfig";
import { parseCSV } from "@/lib/parseData";
import ChartRenderer from "./ChartRenderer";

interface Props { blocks: ChartBlock[] }

export const A4_W = 794;
export const A4_H = 1123;

// Layout constants
const HDR_H   = 72;   // slide title area
const PAD     = 22;
const GAP     = 14;
const FOOTER_H = 32;
const EXHB_H  = 22;   // "EXHIBIT N" badge row
const CTITLE_H = 24;  // chart title row
const INSPAD  = 10;
const INS_ROW_H = 14; // per insight line

/* ---------- helpers ---------- */
function alpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------- Key Takeaways bar ---------- */
function TakeawaysSection({ insights, y, w }: { insights: string[]; y: number; w: number }) {
  if (!insights.length) return null;
  const cols = 2;
  const half = Math.ceil(insights.length / cols);
  const left = insights.slice(0, half);
  const right = insights.slice(half);
  const colW = (w - PAD * 2 - 20) / 2;

  return (
    <div style={{
      position: "absolute", top: y, left: 0, width: w,
      background: "linear-gradient(90deg, #F0FAFB 0%, #E6F7F8 100%)",
      borderTop: `2px solid ${BRAND.primary}`,
      padding: `${INSPAD}px ${PAD}px`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 3, height: 14, background: BRAND.primary, borderRadius: 2 }} />
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
          textTransform: "uppercase", color: BRAND.dark3,
        }}>
          Key Takeaways
        </span>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        {[left, right].map((col, ci) => (
          <div key={ci} style={{ flex: 1 }}>
            {col.map((ins, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 5 }}>
                <div style={{
                  flexShrink: 0, width: 14, height: 14, borderRadius: "50%",
                  background: BRAND.primary, display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 1,
                }}>
                  <span style={{ color: "#fff", fontSize: 8, fontWeight: 800, lineHeight: 1 }}>✓</span>
                </div>
                <span style={{ fontSize: 8, color: BRAND.dark3, lineHeight: "14px", flex: 1 }}>{ins}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Single chart cell ---------- */
function ExhibitCard({
  block, idx, cellW, cellH,
  showInsights,
}: {
  block: ChartBlock; idx: number; cellW: number; cellH: number;
  showInsights: boolean;
}) {
  const spec = buildChartSpec(block.chartType, parseCSV(block.dataRaw));
  const insCount = Math.min(block.insights.length, 2);
  const insSectionH = showInsights && insCount > 0 ? INSPAD * 2 + insCount * INS_ROW_H + 6 : 0;
  const chartH = cellH - EXHB_H - CTITLE_H - insSectionH - 4;

  const title = block.context.length > 60 ? block.context.slice(0, 60) + "..." : block.context || `Chart ${idx + 1}`;

  return (
    <div style={{
      width: cellW, height: cellH,
      background: "#fff",
      border: `1px solid ${BRAND.light4}`,
      borderRadius: 6,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 1px 6px rgba(26,74,76,0.07)",
    }}>
      {/* Exhibit badge */}
      <div style={{
        height: EXHB_H,
        background: BRAND.primary,
        display: "flex", alignItems: "center",
        padding: "0 10px", gap: 8, flexShrink: 0,
      }}>
        <span style={{
          background: "#fff", color: BRAND.dark3,
          fontSize: 7, fontWeight: 800, padding: "1px 6px",
          borderRadius: 3, letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          Exhibit {idx + 1}
        </span>
        <span style={{ color: "#fff", fontSize: 8, fontWeight: 600, opacity: 0.9 }}>
          {block.chartType
            ? block.chartType.replace(/-/g," ").replace(/\b\w/g, c => c.toUpperCase())
            : "Auto"}
        </span>
      </div>

      {/* Chart title */}
      <div style={{
        height: CTITLE_H, flexShrink: 0,
        padding: "0 10px",
        display: "flex", alignItems: "center",
        background: BRAND.dark3,
        borderBottom: `2px solid ${BRAND.primary}`,
      }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, color: "#fff", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
      </div>

      {/* Chart body */}
      <div style={{ flex: 1, padding: "8px 10px 4px", background: "#FAFEFE", minHeight: 0 }}>
        <ChartRenderer
          spec={spec}
          chartId={`chart-${block.id}`}
          width={cellW - 20}
          height={chartH}
        />
      </div>

      {/* Per-chart insights (when multiple charts) */}
      {showInsights && insCount > 0 && (
        <div style={{
          flexShrink: 0,
          padding: `${INSPAD}px 10px`,
          background: alpha(BRAND.light5, 0.8),
          borderTop: `1px solid ${BRAND.light3}`,
        }}>
          {block.insights.slice(0, 2).map((ins, i) => (
            <div key={i} style={{ display: "flex", gap: 5, marginBottom: i < insCount - 1 ? 3 : 0 }}>
              <span style={{ color: BRAND.primary, fontSize: 8, lineHeight: "13px", flexShrink: 0, fontWeight: 700 }}>•</span>
              <span style={{ fontSize: 7.5, color: BRAND.dark3, lineHeight: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ins}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Single chart + KPI callout layout ---------- */
function SingleChartLayout({ block, availW, availH }: { block: ChartBlock; availW: number; availH: number }) {
  const KPI_W = 180;
  const chartCardW = availW - KPI_W - GAP;
  const spec = buildChartSpec(block.chartType, parseCSV(block.dataRaw));
  const chartH = availH - EXHB_H - CTITLE_H - 4;
  const title = block.context.length > 72 ? block.context.slice(0, 72) + "..." : block.context || "Chart 1";

  // Pick the strongest insight for the callout
  const calloutInsight = block.insights[0] ?? null;

  return (
    <div style={{ display: "flex", gap: GAP, height: availH }}>
      {/* Main chart card */}
      <div style={{
        width: chartCardW, height: availH,
        background: "#fff", border: `1px solid ${BRAND.light4}`,
        borderRadius: 6, overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 1px 6px rgba(26,74,76,0.07)",
      }}>
        <div style={{
          height: EXHB_H, background: BRAND.primary,
          display: "flex", alignItems: "center", padding: "0 12px", gap: 8, flexShrink: 0,
        }}>
          <span style={{
            background: "#fff", color: BRAND.dark3,
            fontSize: 7.5, fontWeight: 800, padding: "1px 7px", borderRadius: 3,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Exhibit 1
          </span>
          <span style={{ color: "#fff", fontSize: 8.5, fontWeight: 600, opacity: 0.9 }}>
            {block.chartType
              ? block.chartType.replace(/-/g," ").replace(/\b\w/g, c => c.toUpperCase())
              : "Auto"}
          </span>
        </div>
        <div style={{
          height: CTITLE_H, flexShrink: 0, padding: "0 12px",
          display: "flex", alignItems: "center",
          background: BRAND.dark3, borderBottom: `2px solid ${BRAND.primary}`,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{title}</span>
        </div>
        <div style={{ flex: 1, padding: "10px 12px 8px", background: "#FAFEFE" }}>
          <ChartRenderer
            spec={spec}
            chartId={`chart-${block.id}`}
            width={chartCardW - 24}
            height={chartH}
          />
        </div>
      </div>

      {/* KPI callout panel */}
      <div style={{
        width: KPI_W, height: availH,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {/* Metric card */}
        {spec.kind === "bar" || spec.kind === "line" ? (() => {
          const allVals = spec.data.datasets.flatMap(d => d.data as number[]);
          const max = Math.max(...allVals);
          const min = Math.min(...allVals);
          const last = allVals[allVals.length - 1];
          const prev = allVals[allVals.length - 2];
          const pctChange = prev ? ((last - prev) / Math.abs(prev) * 100) : null;

          return (
            <div style={{
              background: BRAND.dark3, borderRadius: 8,
              padding: "14px 12px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              {[
                { label: "Peak", value: formatShort(max), color: BRAND.light2 },
                { label: "Latest", value: formatShort(last), color: BRAND.primary },
                ...(pctChange !== null ? [{ label: "Last Change", value: `${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}%`, color: pctChange >= 0 ? "#6EE7B7" : "#FCA5A5" }] : []),
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 7.5, color: BRAND.light3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
          );
        })() : null}

        {/* Insight callout */}
        {calloutInsight && (
          <div style={{
            flex: 1,
            background: alpha(BRAND.light5, 0.9),
            border: `1px solid ${BRAND.light3}`,
            borderRadius: 8, padding: "12px",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: BRAND.primary,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>i</span>
              </div>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: BRAND.dark3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Key Finding
              </span>
            </div>
            <p style={{ fontSize: 8, color: BRAND.dark2, lineHeight: "13px", margin: 0 }}>
              {calloutInsight}
            </p>
          </div>
        )}

        {/* Remaining insights as bullets */}
        {block.insights.length > 1 && (
          <div style={{
            background: "#fff", border: `1px solid ${BRAND.light3}`,
            borderRadius: 8, padding: "10px 12px",
          }}>
            {block.insights.slice(1, 4).map((ins, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: i < block.insights.length - 2 ? 6 : 0 }}>
                <div style={{
                  flexShrink: 0, width: 13, height: 13, borderRadius: "50%",
                  background: BRAND.primary,
                  display: "flex", alignItems: "center", justifyContent: "center", marginTop: 0.5,
                }}>
                  <span style={{ color: "#fff", fontSize: 7.5, fontWeight: 800, lineHeight: 1 }}>✓</span>
                </div>
                <span style={{ fontSize: 7.5, color: BRAND.dark3, lineHeight: "13px" }}>{ins}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1);
}

/* ---------- Main SlideCanvas ---------- */
export default function SlideCanvas({ blocks }: Props) {
  const count = Math.min(blocks.length, 4);
  const allInsights = blocks.flatMap(b => b.insights);

  // Layout metrics
  const tkwInsights = allInsights.slice(0, 6);
  const hasInsights = tkwInsights.length > 0;
  const tkwRows = Math.ceil(tkwInsights.length / 2);
  const TKW_H = hasInsights ? INSPAD * 2 + 22 + tkwRows * (INS_ROW_H + 5) + 8 : 0;

  const availH = A4_H - HDR_H - FOOTER_H - PAD * 2 - TKW_H;
  const availW = A4_W - PAD * 2;

  // Grid
  const cols = count <= 1 ? 1 : 2;
  const rows = count <= 2 ? 1 : 2;
  const cellW = Math.floor((availW - (cols - 1) * GAP) / cols);
  const cellH = Math.floor((availH - (rows - 1) * GAP) / rows);

  const displayBlocks = blocks.slice(0, 4);
  const showPerChartInsights = count > 1;

  // Slide title
  const slideTitle = blocks[0]?.context
    ? blocks[0].context.slice(0, 80).toUpperCase()
    : "DATA ANALYSIS REPORT";

  return (
    <div
      className="slide-font"
      style={{
        width: A4_W, height: A4_H, position: "relative",
        background: "#fff", overflow: "hidden",
        boxShadow: "0 8px 40px rgba(26,74,76,0.18)",
        borderRadius: 3,
        fontFamily: "'APTOEX','Inter',sans-serif",
      }}
    >
      {/* ---- Slide header ---- */}
      <div style={{
        height: HDR_H, background: BRAND.dark3,
        borderBottom: `3px solid ${BRAND.primary}`,
        padding: "0 PAD px",
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: `0 ${PAD}px`,
      }}>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "0.04em", lineHeight: 1.2 }}>
          {slideTitle}
        </div>
        {blocks.length > 1 && (
          <div style={{ color: BRAND.light3, fontSize: 9, marginTop: 5, fontWeight: 400 }}>
            {blocks.length} exhibit{blocks.length > 1 ? "s" : ""} — data analysis and insights
          </div>
        )}
        {blocks.length === 1 && blocks[0]?.instructions && (
          <div style={{ color: BRAND.light3, fontSize: 9, marginTop: 5, fontWeight: 400 }}>
            {blocks[0].instructions.slice(0, 90)}
          </div>
        )}
      </div>

      {/* ---- Charts ---- */}
      <div style={{ padding: `${PAD}px`, paddingBottom: 0, height: A4_H - HDR_H - FOOTER_H - TKW_H }}>
        {count === 1 ? (
          <SingleChartLayout block={displayBlocks[0]} availW={availW} availH={availH} />
        ) : count === 3 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            <div style={{ display: "flex", gap: GAP }}>
              {displayBlocks.slice(0, 2).map((b, i) => (
                <ExhibitCard key={b.id} block={b} idx={i} cellW={cellW} cellH={cellH} showInsights={showPerChartInsights} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ExhibitCard block={displayBlocks[2]} idx={2} cellW={cellW} cellH={cellH} showInsights={showPerChartInsights} />
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellH}px)`,
            gap: GAP,
          }}>
            {displayBlocks.map((b, i) => (
              <ExhibitCard key={b.id} block={b} idx={i} cellW={cellW} cellH={cellH} showInsights={showPerChartInsights} />
            ))}
          </div>
        )}
      </div>

      {/* ---- Key Takeaways ---- */}
      {hasInsights && (
        <TakeawaysSection
          insights={tkwInsights}
          y={A4_H - FOOTER_H - TKW_H}
          w={A4_W}
        />
      )}

      {/* ---- Footer ---- */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: FOOTER_H,
        background: BRAND.dark3,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${PAD}px`,
      }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: BRAND.light3, letterSpacing: "0.08em" }}>SLIDEMAKER</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[BRAND.primary, BRAND.light1, BRAND.light2].map(c => (
            <div key={c} style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <span style={{ fontSize: 8, color: BRAND.light3, opacity: 0.7 }}>Confidential</span>
      </div>
    </div>
  );
}
