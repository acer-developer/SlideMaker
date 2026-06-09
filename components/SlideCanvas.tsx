"use client";
import { BRAND } from "@/lib/colors";
import type { ChartBlock, Annotation } from "@/lib/types";
import { buildChartSpec } from "@/lib/chartConfig";
import { parseCSV } from "@/lib/parseData";
import ChartRenderer from "./ChartRenderer";

interface Props { blocks: ChartBlock[] }

export const A4_W = 794;
export const A4_H = 1123;

const HDR_H        = 70;
const PAD          = 20;
const STACK_GAP    = 10;
const H_GAP        = 10;
const KPI_W        = 190;
const TITLE_ROW_H  = 30;  // combined badge+title row (1-2 layout)
const ANN_H        = 80;  // period annotations with arrows + icons
const SOURCE_H     = 16;  // source attribution row
const GAP          = 14;  // grid gap for 3-4 charts
const GRID_TITLE_H = 26;  // compact title row for 3-4 grid
const INSPAD       = 10;
const INS_ROW_H    = 16;
const MAX_SINGLE_EXHIBIT_H = 680;

function alpha(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* Render [[keyword]] as teal bold spans */
function HighlightText({ text }: { text: string }) {
  const parts = text.split(/(\[\[.+?\]\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[[")
          ? <span key={i} style={{ color: BRAND.primary, fontWeight: 700 }}>{p.slice(2, -2)}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

/* ─── Period Annotations ─────────────────────────────────────────────────── */
function PeriodAnnotations({ annotations }: { annotations: Annotation[] }) {
  if (!annotations.length) return null;
  return (
    <div style={{
      height: ANN_H, flexShrink: 0,
      display: "flex",
      borderTop: `1.5px solid ${BRAND.light4}`,
      background: `linear-gradient(180deg, #F5FAFB 0%, ${alpha(BRAND.light5, 0.55)} 100%)`,
    }}>
      {annotations.slice(0, 3).map((ann, i) => (
        <div key={i} style={{
          flex: 1,
          borderLeft: i > 0 ? `1px dashed ${BRAND.light3}` : "none",
          padding: "7px 8px 5px",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* ◄ dashed ─ PERIOD ─ dashed ► */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 3, flexShrink: 0 }}>
            <span style={{ fontSize: 7, color: BRAND.dark1, lineHeight: 1, flexShrink: 0 }}>◄</span>
            <div style={{ flex: 1, borderTop: `1.5px dashed ${BRAND.light3}` }} />
            <span style={{
              fontSize: 5.5, fontWeight: 800, color: BRAND.dark2,
              textTransform: "uppercase", letterSpacing: "0.07em",
              whiteSpace: "nowrap", flexShrink: 0, padding: "0 3px",
            }}>
              {ann.period}
            </span>
            <div style={{ flex: 1, borderTop: `1.5px dashed ${BRAND.light3}` }} />
            <span style={{ fontSize: 7, color: BRAND.dark1, lineHeight: 1, flexShrink: 0 }}>►</span>
          </div>
          {/* Thematic icon */}
          {ann.icon && (
            <div style={{
              fontSize: 13, lineHeight: 1, marginBottom: 2,
              textAlign: "center" as const, flexShrink: 0,
            }}>
              {ann.icon}
            </div>
          )}
          {/* Phase label */}
          <div style={{
            fontSize: 7.5, fontWeight: 700, color: BRAND.dark3,
            lineHeight: 1.2, marginBottom: 2, flexShrink: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {ann.label}
          </div>
          {/* Description */}
          <div style={{
            fontSize: 6.5, color: BRAND.dark1, lineHeight: "10px",
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

/* ─── KPI Callout Panel (light bg, contextual emoji, no dark header) ─────── */
function KPIPanel({ block, height }: { block: ChartBlock; height: number }) {
  return (
    <div style={{
      width: KPI_W, height,
      display: "flex", flexDirection: "column",
      alignItems: "center",
      background: "#F5FBFC",
      border: `1.5px solid ${BRAND.light3}`,
      borderRadius: 6, overflow: "hidden",
      boxShadow: `0 2px 12px ${alpha(BRAND.dark3, 0.10)}`,
      flexShrink: 0,
      padding: "18px 14px 12px",
    }}>
      {/* Contextual icon circle */}
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: `radial-gradient(circle at 40% 35%, ${BRAND.light1}, ${BRAND.primary})`,
        border: `3px solid ${BRAND.light4}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, lineHeight: 1,
        flexShrink: 0,
        marginBottom: 10,
      }}>
        {block.kpiIcon || "📊"}
      </div>

      {/* KPI Title */}
      <div style={{
        fontSize: 10, fontWeight: 800, color: BRAND.dark3,
        textAlign: "center", lineHeight: 1.25,
        textTransform: "uppercase", letterSpacing: "0.05em",
        marginBottom: 8, flexShrink: 0,
      }}>
        {block.kpiTitle || "Key Insight"}
      </div>

      {/* Divider */}
      <div style={{
        width: "100%", height: 1.5,
        background: BRAND.light3,
        marginBottom: 8, flexShrink: 0,
      }} />

      {/* Teal subtitle — key stat sentence */}
      {block.kpiSubtitle && (
        <div style={{
          fontSize: 7.5, fontWeight: 700, color: BRAND.primary,
          lineHeight: "12px", textAlign: "center",
          marginBottom: 8, flexShrink: 0,
        }}>
          {block.kpiSubtitle}
        </div>
      )}

      {/* Description body */}
      <div style={{
        fontSize: 7.5, color: BRAND.dark2, lineHeight: "12px",
        flex: 1, overflow: "hidden", alignSelf: "stretch",
      }}>
        {block.kpiDescription || block.insights[0] || ""}
      </div>
    </div>
  );
}

/* ─── Full-width Exhibit with KPI panel (1–2 chart layout) ──────────────── */
function ExhibitWithKPI({
  block, idx, exhibitH, availW,
}: {
  block: ChartBlock; idx: number; exhibitH: number; availW: number;
}) {
  const chartCardW = availW - KPI_W - H_GAP;
  const hasAnns = (block.annotations?.length ?? 0) > 0;
  const hasSrc = !!block.source;
  const annH = hasAnns ? ANN_H : 0;
  const srcH = hasSrc ? SOURCE_H : 0;
  const chartBodyH = exhibitH - TITLE_ROW_H - annH - srcH;

  const spec = buildChartSpec(block.chartType, parseCSV(block.dataRaw));
  const title = block.context.length > 72
    ? block.context.slice(0, 72) + "…"
    : block.context || `Chart ${idx + 1}`;

  return (
    <div style={{ display: "flex", gap: H_GAP, height: exhibitH, flexShrink: 0 }}>
      {/* ── Chart card ── */}
      <div style={{
        flex: 1, height: exhibitH,
        background: "#fff",
        border: `1px solid ${BRAND.light4}`,
        borderRadius: 6, overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: `0 2px 10px ${alpha(BRAND.dark3, 0.08)}`,
        minWidth: 0,
      }}>
        {/* Combined badge + title row (one row, not two) */}
        <div style={{ height: TITLE_ROW_H, flexShrink: 0, display: "flex" }}>
          {/* Teal badge section */}
          <div style={{
            background: BRAND.primary,
            padding: "0 10px",
            display: "flex", alignItems: "center",
            flexShrink: 0,
          }}>
            <span style={{
              background: alpha(BRAND.dark3, 0.28), color: "#fff",
              fontSize: 6.5, fontWeight: 800, padding: "2.5px 7px",
              borderRadius: 3, letterSpacing: "0.07em", textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>
              Exhibit {idx + 1}
            </span>
          </div>
          {/* Dark title section */}
          <div style={{
            flex: 1, minWidth: 0,
            background: BRAND.dark3,
            borderBottom: `2px solid ${BRAND.primary}`,
            padding: "0 12px",
            display: "flex", alignItems: "center",
          }}>
            <span style={{
              fontSize: 8.5, fontWeight: 700, color: "#fff",
              lineHeight: 1.3, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {title}
            </span>
          </div>
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

        {/* Period annotations with dashed arrows + icons */}
        {hasAnns && <PeriodAnnotations annotations={block.annotations} />}

        {/* Source attribution */}
        {hasSrc && (
          <div style={{
            height: SOURCE_H, flexShrink: 0,
            display: "flex", alignItems: "center",
            padding: "0 12px",
            borderTop: `1px solid ${BRAND.light4}`,
            background: "#FAFEFE",
          }}>
            <span style={{ fontSize: 6.5, color: "#8AABAC", fontStyle: "italic" }}>
              Source: {block.source}
            </span>
          </div>
        )}
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
  const insSectionH = insCount > 0 ? INSPAD * 2 + insCount * 14 + 4 : 0;
  const chartH = cellH - GRID_TITLE_H - insSectionH;
  const spec = buildChartSpec(block.chartType, parseCSV(block.dataRaw));
  const title = block.context.length > 60
    ? block.context.slice(0, 60) + "…"
    : block.context || `Chart ${idx + 1}`;

  return (
    <div style={{
      width: cellW, height: cellH,
      background: "#fff", border: `1px solid ${BRAND.light4}`,
      borderRadius: 6, overflow: "hidden",
      display: "flex", flexDirection: "column",
      boxShadow: `0 1px 6px ${alpha(BRAND.dark3, 0.07)}`,
    }}>
      {/* Combined badge + title row */}
      <div style={{ height: GRID_TITLE_H, flexShrink: 0, display: "flex" }}>
        <div style={{
          background: BRAND.primary, padding: "0 8px",
          display: "flex", alignItems: "center", flexShrink: 0,
        }}>
          <span style={{
            background: alpha(BRAND.dark3, 0.28), color: "#fff",
            fontSize: 6, fontWeight: 800, padding: "2px 6px",
            borderRadius: 3, letterSpacing: "0.07em", textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            Exhibit {idx + 1}
          </span>
        </div>
        <div style={{
          flex: 1, minWidth: 0,
          background: BRAND.dark3,
          borderBottom: `2px solid ${BRAND.primary}`,
          padding: "0 10px",
          display: "flex", alignItems: "center",
        }}>
          <span style={{
            fontSize: 8, fontWeight: 700, color: "#fff",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {title}
          </span>
        </div>
      </div>

      {/* Chart body */}
      <div style={{ flex: 1, padding: "6px 10px 4px", background: "#FAFEFE", minHeight: 0 }}>
        <ChartRenderer
          spec={spec}
          chartId={`chart-${block.id}`}
          width={cellW - 20}
          height={chartH}
        />
      </div>

      {/* Compact insight bullets (strip [[]] markers) */}
      {insCount > 0 && (
        <div style={{
          flexShrink: 0, padding: `${INSPAD}px 10px`,
          background: alpha(BRAND.light5, 0.8),
          borderTop: `1px solid ${BRAND.light3}`,
        }}>
          {block.insights.slice(0, 2).map((ins, i) => (
            <div key={i} style={{ display: "flex", gap: 5, marginBottom: i < insCount - 1 ? 3 : 0 }}>
              <span style={{ color: BRAND.primary, fontSize: 8, lineHeight: "13px", flexShrink: 0, fontWeight: 700 }}>•</span>
              <span style={{ fontSize: 7.5, color: BRAND.dark3, lineHeight: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ins.replace(/\[\[(.+?)\]\]/g, "$1")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Key Takeaways (single column, teal keyword highlights) ─────────────── */
function TakeawaysSection({ insights, y, w }: { insights: string[]; y: number; w: number }) {
  if (!insights.length) return null;
  return (
    <div style={{
      position: "absolute", top: y, left: 0, width: w,
      background: `linear-gradient(90deg, #EAF6F7 0%, #F2FAFB 55%, #EFF9F9 100%)`,
      borderTop: `2.5px solid ${BRAND.primary}`,
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
      <div>
        {insights.map((ins, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 7,
            marginBottom: i < insights.length - 1 ? 5 : 0,
          }}>
            <div style={{
              flexShrink: 0, width: 14, height: 14, borderRadius: "50%",
              background: BRAND.primary,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginTop: 1,
            }}>
              <span style={{ color: "#fff", fontSize: 7.5, fontWeight: 800, lineHeight: 1 }}>✓</span>
            </div>
            <span style={{ fontSize: 8.5, color: BRAND.dark3, lineHeight: "14px", flex: 1 }}>
              <HighlightText text={ins} />
            </span>
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
  const tkwInsights = allInsights.slice(0, 4);
  const hasInsights = tkwInsights.length > 0;
  const TKW_H = hasInsights ? INSPAD * 2 + 22 + tkwInsights.length * (INS_ROW_H + 5) + 8 : 0;

  const chartDivH = A4_H - HDR_H - TKW_H;
  const availH = chartDivH - PAD;
  const availW = A4_W - PAD * 2;

  const displayBlocks = blocks.slice(0, 4);

  const exhibitH = count === 1
    ? Math.min(availH, MAX_SINGLE_EXHIBIT_H)
    : count === 2
      ? Math.floor((availH - STACK_GAP) / 2)
      : 0;

  const gridCols = 2;
  const gridRows = count <= 2 ? 1 : 2;
  const cellW = Math.floor((availW - GAP) / gridCols);
  const cellH = count >= 3 ? Math.floor((availH - (gridRows - 1) * GAP) / gridRows) : 0;

  const slideTitle = (blocks[0]?.context?.slice(0, 80) || "Data Analysis Report").toUpperCase();
  const slideSubtitle = blocks[0]?.slideSubtitle || "";

  return (
    <div
      className="slide-font slide-canvas-root"
      style={{
        width: A4_W, height: A4_H,
        position: "relative",
        background: "#fff", overflow: "hidden",
        boxShadow: "0 8px 40px rgba(26,74,76,0.18)",
        borderRadius: 3,
        fontFamily: "'APTOEX','Inter',sans-serif",
      }}
    >
      {/* ── Header: plain bold text on white, 3px teal underline ── */}
      <div style={{
        height: HDR_H,
        background: "#fff",
        borderBottom: `3px solid ${BRAND.primary}`,
        padding: `15px ${PAD}px 11px`,
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}>
        <div style={{
          fontSize: 15, fontWeight: 800, color: BRAND.dark3,
          letterSpacing: "0.03em", lineHeight: 1.2,
        }}>
          {slideTitle}
        </div>
        {slideSubtitle && (
          <div style={{
            fontSize: 8, color: "#5C7C7E", marginTop: 5,
            lineHeight: "12px", maxWidth: "88%",
          }}>
            {slideSubtitle}
          </div>
        )}
      </div>

      {/* ── Chart area ── */}
      <div style={{
        padding: `${PAD}px ${PAD}px 0`,
        height: chartDivH,
        overflow: "hidden",
      }}>
        {count <= 2 ? (
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
        <TakeawaysSection insights={tkwInsights} y={A4_H - TKW_H} w={A4_W} />
      )}

      {/* ── Bottom accent line (replaces footer) ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 3, background: BRAND.primary,
      }} />
    </div>
  );
}
