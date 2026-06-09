"use client";
import { BRAND } from "@/lib/colors";
import type { ChartBlock, Annotation } from "@/lib/types";
import { buildChartSpec } from "@/lib/chartConfig";
import { parseCSV } from "@/lib/parseData";
import ChartRenderer from "./ChartRenderer";

interface Props { blocks: ChartBlock[] }

export const A4_W = 794;
export const A4_H = 1123;

const HDR_H    = 72;
const FOOTER_H = 32;
const PAD      = 22;
const GAP      = 14;   // grid gap for 3-4 charts
const STACK_GAP = 10;  // vertical gap between stacked exhibits
const H_GAP    = 10;   // gap between chart card and KPI panel
const KPI_W    = 190;
const EXHB_H   = 22;
const CTITLE_H = 24;
const ANN_H    = 70;   // period annotations section height
const INSPAD   = 10;
const INS_ROW_H = 14;

const MAX_SINGLE_EXHIBIT_H = 680;

function alpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ─── Period Annotations bar ─────────────────────────────────────────────── */
function PeriodAnnotations({ annotations }: { annotations: Annotation[] }) {
  if (!annotations.length) return null;
  return (
    <div style={{
      height: ANN_H, flexShrink: 0,
      display: "flex",
      borderTop: `1px solid ${BRAND.light4}`,
      background: `linear-gradient(180deg, #FAFEFE 0%, ${alpha(BRAND.light5, 0.6)} 100%)`,
    }}>
      {annotations.slice(0, 3).map((ann, i) => (
        <div key={i} style={{
          flex: 1,
          borderLeft: i > 0 ? `1px dashed ${BRAND.light3}` : "none",
          padding: "6px 10px 6px",
          display: "flex", flexDirection: "column", gap: 3,
          overflow: "hidden",
        }}>
          {/* Period label with flanking lines */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ flex: 1, height: 1, background: BRAND.light2, opacity: 0.7 }} />
            <span style={{
              fontSize: 6.5, fontWeight: 800, color: BRAND.dark2,
              textTransform: "uppercase", letterSpacing: "0.06em",
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {ann.period}
            </span>
            <div style={{ flex: 1, height: 1, background: BRAND.light2, opacity: 0.7 }} />
          </div>
          {/* Phase label */}
          <div style={{
            fontSize: 8, fontWeight: 700, color: BRAND.dark3,
            lineHeight: 1.2, overflow: "hidden",
            whiteSpace: "nowrap", textOverflow: "ellipsis",
          }}>
            {ann.label}
          </div>
          {/* Description */}
          <div style={{
            fontSize: 7, color: BRAND.dark1, lineHeight: "11px",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical" as const,
          }}>
            {ann.description}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── KPI Callout Panel ───────────────────────────────────────────────────── */
function KPIPanel({ block, height }: { block: ChartBlock; height: number }) {
  const headerH = Math.min(130, Math.floor(height * 0.3));
  const bodyH = height - headerH;
  const hasBullets = block.insights.length > 0;
  const bulletRows = Math.min(3, block.insights.length);
  const bulletAreaH = hasBullets ? 8 + bulletRows * 20 + 6 : 0;
  const descAreaH = bodyH - 10 - (block.kpiSubtitle ? 34 : 0) - bulletAreaH - 10;

  return (
    <div style={{
      width: KPI_W, height,
      display: "flex", flexDirection: "column",
      background: "#fff",
      border: `1px solid ${BRAND.light4}`,
      borderRadius: 6, overflow: "hidden",
      boxShadow: "0 2px 8px rgba(26,74,76,0.08)",
      flexShrink: 0,
    }}>
      {/* Dark header: icon + title */}
      <div style={{
        height: headerH, flexShrink: 0,
        background: BRAND.dark3,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "12px 14px 10px", gap: 8,
      }}>
        {/* Circle icon */}
        <div style={{
          width: 46, height: 46, borderRadius: "50%",
          background: BRAND.primary,
          border: `2px solid ${BRAND.light2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            border: `2.5px solid ${BRAND.light3}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
          </div>
        </div>
        {/* KPI title */}
        <div style={{
          fontSize: 9, fontWeight: 800, color: "#fff",
          textAlign: "center", lineHeight: 1.25,
          textTransform: "uppercase", letterSpacing: "0.07em",
          overflow: "hidden",
        }}>
          {block.kpiTitle || "Key Insight"}
        </div>
      </div>

      {/* Body: subtitle + description + bullets */}
      <div style={{ height: bodyH, display: "flex", flexDirection: "column", padding: "10px 12px 8px" }}>
        {/* Subtitle — key stat in teal */}
        {block.kpiSubtitle && (
          <div style={{
            fontSize: 7.5, fontWeight: 700, color: BRAND.primary,
            lineHeight: "12px", marginBottom: 8,
            flexShrink: 0,
          }}>
            {block.kpiSubtitle}
          </div>
        )}

        {/* Description */}
        <div style={{
          fontSize: 7, color: BRAND.dark2, lineHeight: "11px",
          flex: 1, overflow: "hidden",
        }}>
          {block.kpiDescription || (block.insights[0] ?? "")}
        </div>

        {/* Divider + insight bullets */}
        {hasBullets && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ height: 1, background: BRAND.light4, marginBottom: 6 }} />
            {block.insights.slice(0, 3).map((ins, i) => (
              <div key={i} style={{
                display: "flex", gap: 5, alignItems: "flex-start",
                marginBottom: i < bulletRows - 1 ? 5 : 0,
              }}>
                <div style={{
                  flexShrink: 0, width: 11, height: 11, borderRadius: "50%",
                  background: BRAND.primary, marginTop: 0.5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: "#fff", fontSize: 6, fontWeight: 800, lineHeight: 1 }}>✓</span>
                </div>
                <span style={{
                  fontSize: 6.5, color: BRAND.dark3, lineHeight: "11px",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                }}>
                  {ins}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Full-width Exhibit with KPI panel (1–2 chart layout) ───────────────── */
function ExhibitWithKPI({
  block, idx, exhibitH, availW,
}: {
  block: ChartBlock; idx: number; exhibitH: number; availW: number;
}) {
  const chartCardW = availW - KPI_W - H_GAP;
  const hasAnns = block.annotations?.length > 0;
  const effectiveAnnH = hasAnns ? ANN_H : 0;
  const chartBodyH = exhibitH - EXHB_H - CTITLE_H - effectiveAnnH;

  const spec = buildChartSpec(block.chartType, parseCSV(block.dataRaw));
  const title = block.context.length > 68 ? block.context.slice(0, 68) + "…" : block.context || `Chart ${idx + 1}`;
  const chartType = block.chartType
    ? block.chartType.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Auto";

  return (
    <div style={{ display: "flex", gap: H_GAP, height: exhibitH, flexShrink: 0 }}>
      {/* ── Chart card ── */}
      <div style={{
        flex: 1, height: exhibitH,
        background: "#fff",
        border: `1px solid ${BRAND.light4}`,
        borderRadius: 6, overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 2px 10px rgba(26,74,76,0.08)",
        minWidth: 0,
      }}>
        {/* Exhibit badge row */}
        <div style={{
          height: EXHB_H, flexShrink: 0,
          background: BRAND.primary,
          display: "flex", alignItems: "center",
          padding: "0 12px", gap: 8,
        }}>
          <span style={{
            background: "#fff", color: BRAND.dark3,
            fontSize: 7.5, fontWeight: 800, padding: "1px 7px",
            borderRadius: 3, letterSpacing: "0.06em", textTransform: "uppercase",
            flexShrink: 0,
          }}>
            Exhibit {idx + 1}
          </span>
          <span style={{ color: "#fff", fontSize: 8.5, fontWeight: 600, opacity: 0.9 }}>
            {chartType}
          </span>
        </div>

        {/* Chart title bar */}
        <div style={{
          height: CTITLE_H, flexShrink: 0,
          padding: "0 14px",
          display: "flex", alignItems: "center",
          background: BRAND.dark3,
          borderBottom: `2px solid ${BRAND.primary}`,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: "#fff",
            lineHeight: 1.3, overflow: "hidden",
            whiteSpace: "nowrap", textOverflow: "ellipsis",
          }}>
            {title}
          </span>
        </div>

        {/* Chart body */}
        <div style={{
          flex: 1, padding: "8px 12px 6px",
          background: "#FAFEFE", overflow: "hidden",
          minHeight: 0,
        }}>
          <ChartRenderer
            spec={spec}
            chartId={`chart-${block.id}`}
            width={chartCardW - 24}
            height={chartBodyH}
          />
        </div>

        {/* Period annotations */}
        {hasAnns && <PeriodAnnotations annotations={block.annotations} />}
      </div>

      {/* ── KPI panel ── */}
      <KPIPanel block={block} height={exhibitH} />
    </div>
  );
}

/* ─── Compact exhibit card (3–4 chart grid) ──────────────────────────────── */
function ExhibitCard({
  block, idx, cellW, cellH,
}: {
  block: ChartBlock; idx: number; cellW: number; cellH: number;
}) {
  const insCount = Math.min(block.insights.length, 2);
  const insSectionH = insCount > 0 ? INSPAD * 2 + insCount * INS_ROW_H + 4 : 0;
  const chartH = cellH - EXHB_H - CTITLE_H - insSectionH - 4;
  const spec = buildChartSpec(block.chartType, parseCSV(block.dataRaw));
  const title = block.context.length > 58 ? block.context.slice(0, 58) + "…" : block.context || `Chart ${idx + 1}`;
  const chartType = block.chartType
    ? block.chartType.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Auto";

  return (
    <div style={{
      width: cellW, height: cellH,
      background: "#fff", border: `1px solid ${BRAND.light4}`,
      borderRadius: 6, overflow: "hidden",
      display: "flex", flexDirection: "column",
      boxShadow: "0 1px 6px rgba(26,74,76,0.07)",
    }}>
      <div style={{
        height: EXHB_H, background: BRAND.primary,
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
          {chartType}
        </span>
      </div>

      <div style={{
        height: CTITLE_H, flexShrink: 0, padding: "0 10px",
        display: "flex", alignItems: "center",
        background: BRAND.dark3, borderBottom: `2px solid ${BRAND.primary}`,
      }}>
        <span style={{
          fontSize: 8.5, fontWeight: 700, color: "#fff",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {title}
        </span>
      </div>

      <div style={{ flex: 1, padding: "6px 10px 4px", background: "#FAFEFE", minHeight: 0 }}>
        <ChartRenderer
          spec={spec}
          chartId={`chart-${block.id}`}
          width={cellW - 20}
          height={chartH}
        />
      </div>

      {insCount > 0 && (
        <div style={{
          flexShrink: 0, padding: `${INSPAD}px 10px`,
          background: alpha(BRAND.light5, 0.8),
          borderTop: `1px solid ${BRAND.light3}`,
        }}>
          {block.insights.slice(0, 2).map((ins, i) => (
            <div key={i} style={{
              display: "flex", gap: 5,
              marginBottom: i < insCount - 1 ? 3 : 0,
            }}>
              <span style={{
                color: BRAND.primary, fontSize: 8,
                lineHeight: "13px", flexShrink: 0, fontWeight: 700,
              }}>•</span>
              <span style={{
                fontSize: 7.5, color: BRAND.dark3, lineHeight: "13px",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{ins}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Key Takeaways bar ───────────────────────────────────────────────────── */
function TakeawaysSection({ insights, y, w }: { insights: string[]; y: number; w: number }) {
  if (!insights.length) return null;
  const half = Math.ceil(insights.length / 2);
  const left = insights.slice(0, half);
  const right = insights.slice(half);

  return (
    <div style={{
      position: "absolute", top: y, left: 0, width: w,
      background: `linear-gradient(90deg, #F0FAFB 0%, #E6F7F8 100%)`,
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
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 5,
              }}>
                <div style={{
                  flexShrink: 0, width: 14, height: 14, borderRadius: "50%",
                  background: BRAND.primary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 1,
                }}>
                  <span style={{ color: "#fff", fontSize: 8, fontWeight: 800, lineHeight: 1 }}>✓</span>
                </div>
                <span style={{ fontSize: 8, color: BRAND.dark3, lineHeight: "14px", flex: 1 }}>
                  {ins}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main slide canvas ───────────────────────────────────────────────────── */
export default function SlideCanvas({ blocks }: Props) {
  const count = Math.min(blocks.length, 4);
  const allInsights = blocks.flatMap(b => b.insights);
  const tkwInsights = allInsights.slice(0, 6);
  const hasInsights = tkwInsights.length > 0;
  const tkwRows = Math.ceil(tkwInsights.length / 2);
  const TKW_H = hasInsights ? INSPAD * 2 + 22 + tkwRows * (INS_ROW_H + 5) + 8 : 0;
  const availH = A4_H - HDR_H - FOOTER_H - PAD * 2 - TKW_H;
  const availW = A4_W - PAD * 2;

  const displayBlocks = blocks.slice(0, 4);

  // Layout for 1–2 blocks: stacked full-width exhibits
  const exhibitH = count === 1
    ? Math.min(availH, MAX_SINGLE_EXHIBIT_H)
    : count === 2
      ? Math.floor((availH - STACK_GAP) / 2)
      : 0;

  // Layout for 3–4 blocks: 2-column grid
  const gridCols = 2;
  const gridRows = count <= 2 ? 1 : 2;
  const cellW = Math.floor((availW - GAP) / gridCols);
  const cellH = count >= 3 ? Math.floor((availH - (gridRows - 1) * GAP) / gridRows) : 0;

  const slideTitle = (blocks[0]?.context?.slice(0, 80) || "Data Analysis Report").toUpperCase();

  return (
    <div
      className="slide-font"
      style={{
        width: A4_W, height: A4_H,
        position: "relative",
        background: "#fff", overflow: "hidden",
        boxShadow: "0 8px 40px rgba(26,74,76,0.18)",
        borderRadius: 3,
        fontFamily: "'APTOEX','Inter',sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div style={{
        height: HDR_H,
        background: BRAND.dark3,
        borderBottom: `3px solid ${BRAND.primary}`,
        padding: `0 ${PAD}px`,
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        <div style={{
          color: "#fff", fontSize: 15, fontWeight: 800,
          letterSpacing: "0.04em", lineHeight: 1.2,
        }}>
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

      {/* ── Chart area ── */}
      <div style={{
        padding: `${PAD}px ${PAD}px 0`,
        height: A4_H - HDR_H - FOOTER_H - TKW_H,
        overflow: "hidden",
      }}>
        {count <= 2 ? (
          /* Stacked full-width exhibits */
          <div style={{ display: "flex", flexDirection: "column", gap: STACK_GAP }}>
            {displayBlocks.slice(0, count).map((b, i) => (
              <ExhibitWithKPI
                key={b.id}
                block={b}
                idx={i}
                exhibitH={exhibitH}
                availW={availW}
              />
            ))}
          </div>
        ) : count === 3 ? (
          /* 3-chart layout: top row of 2, centered bottom */
          <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            <div style={{ display: "flex", gap: GAP }}>
              {displayBlocks.slice(0, 2).map((b, i) => (
                <ExhibitCard key={b.id} block={b} idx={i} cellW={cellW} cellH={cellH} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <ExhibitCard block={displayBlocks[2]} idx={2} cellW={cellW} cellH={cellH} />
            </div>
          </div>
        ) : (
          /* 4-chart 2×2 grid */
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${gridCols}, ${cellW}px)`,
            gridTemplateRows: `repeat(${gridRows}, ${cellH}px)`,
            gap: GAP,
          }}>
            {displayBlocks.map((b, i) => (
              <ExhibitCard key={b.id} block={b} idx={i} cellW={cellW} cellH={cellH} />
            ))}
          </div>
        )}
      </div>

      {/* ── Key Takeaways ── */}
      {hasInsights && (
        <TakeawaysSection
          insights={tkwInsights}
          y={A4_H - FOOTER_H - TKW_H}
          w={A4_W}
        />
      )}

      {/* ── Footer ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: FOOTER_H,
        background: BRAND.dark3,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${PAD}px`,
      }}>
        <span style={{
          fontSize: 8, fontWeight: 700, color: BRAND.light3, letterSpacing: "0.08em",
        }}>
          SLIDEMAKER
        </span>
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
