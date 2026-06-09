import type { ChartBlock } from "./types";

// ---- Unit conversion: 794px = 8.27in (A4 at 96dpi) ----
const I = (px: number) => +(px * (8.27 / 794)).toFixed(4);

// ---- Same layout constants as SlideCanvas.tsx ----
const A4_W     = 794;
const A4_H     = 1123;
const HDR_H    = 72;
const FOOTER_H = 32;
const PAD      = 22;
const GAP      = 14;
const EXHB_H   = 22;
const CTITLE_H = 24;
const INSPAD   = 10;
const INS_ROW_H = 14;

const C = {
  dark3:   "1A4A4C",
  dark2:   "236567",
  dark1:   "2E8388",
  primary: "3AA4A9",
  light1:  "52B5BA",
  light2:  "6EC7CB",
  light3:  "91DFE2",
  light4:  "B5EEEF",
  light5:  "D5F6F7",
  white:   "FFFFFF",
  bg:      "FAFEFE",
};

// Capture a Chart.js canvas rendered in the DOM as PNG data URL
async function captureChart(chartId: string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(chartId) as HTMLCanvasElement | null;
  if (!el || el.tagName !== "CANVAS") return null;
  try { return el.toDataURL("image/png"); } catch { return null; }
}

function shortVal(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return Number.isInteger(n) ? n.toString() : n.toFixed(1);
}

export async function generatePPT(blocks: ChartBlock[]): Promise<void> {
  const pptxgenjs = (await import("pptxgenjs")).default;
  const pres = new pptxgenjs();
  pres.defineLayout({ name: "A4", width: 8.27, height: 11.69 });
  pres.layout = "A4";
  const slide = pres.addSlide();

  const count        = Math.min(blocks.length, 4);
  const allInsights  = blocks.flatMap(b => b.insights);
  const tkwInsights  = allInsights.slice(0, 6);
  const hasInsights  = tkwInsights.length > 0;
  const tkwRows      = Math.ceil(tkwInsights.length / 2);
  const TKW_H        = hasInsights ? INSPAD * 2 + 22 + tkwRows * (INS_ROW_H + 5) + 8 : 0;

  const availH = A4_H - HDR_H - FOOTER_H - PAD * 2 - TKW_H;
  const availW = A4_W - PAD * 2;

  const slideTitle = (blocks[0]?.context?.slice(0, 80) || "DATA ANALYSIS REPORT").toUpperCase();

  // ===================== HEADER =====================
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 8.27, h: I(HDR_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  // Bottom accent line
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(HDR_H - 3), w: 8.27, h: I(3),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(slideTitle, {
    x: I(PAD), y: I(12), w: I(A4_W - PAD * 2 - 20), h: I(30),
    fontSize: 11, bold: true, color: C.white, fontFace: "Calibri",
    charSpacing: 1, valign: "middle",
  });
  const subtitleText = blocks.length > 1
    ? `${blocks.length} exhibits — data analysis and insights`
    : (blocks[0]?.instructions?.slice(0, 90) || "");
  if (subtitleText) {
    slide.addText(subtitleText, {
      x: I(PAD), y: I(46), w: I(500), h: I(16),
      fontSize: 6.5, color: C.light3, fontFace: "Calibri",
    });
  }

  // ===================== FOOTER =====================
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(A4_H - FOOTER_H), w: 8.27, h: I(FOOTER_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  slide.addText("SLIDEMAKER", {
    x: I(PAD), y: I(A4_H - FOOTER_H + 9), w: I(160), h: I(14),
    fontSize: 6, bold: true, color: C.light3, fontFace: "Calibri", charSpacing: 2,
  });
  slide.addText("Confidential", {
    x: I(A4_W - PAD - 110), y: I(A4_H - FOOTER_H + 9), w: I(110), h: I(14),
    fontSize: 6, color: C.light3, fontFace: "Calibri", align: "right",
  });

  // ===================== CHARTS =====================
  const displayBlocks = blocks.slice(0, 4);

  if (count === 1) {
    await renderSingle(pres, slide, displayBlocks[0], availW, availH);
  } else {
    const cols  = 2;
    const rows  = count <= 2 ? 1 : 2;
    const cellW = Math.floor((availW - (cols - 1) * GAP) / cols);
    const cellH = Math.floor((availH - (rows - 1) * GAP) / rows);

    for (let idx = 0; idx < displayBlocks.length; idx++) {
      let col = idx % cols;
      let row = Math.floor(idx / cols);
      let xOffset = 0;
      if (count === 3 && idx === 2) { col = 0; row = 1; xOffset = (cellW + GAP) / 2; }
      const x = PAD + col * (cellW + GAP) + xOffset;
      const y = HDR_H + PAD + row * (cellH + GAP);
      await renderExhibit(pres, slide, displayBlocks[idx], idx, x, y, cellW, cellH);
    }

    // Key Takeaways
    if (hasInsights) {
      const tkwY = A4_H - FOOTER_H - TKW_H;
      renderTakeaways(pres, slide, tkwInsights, tkwY, availW, TKW_H);
    }
  }

  await pres.writeFile({ fileName: "slidemaker-slide.pptx" });
}

// ---- Single chart layout (chart + KPI sidebar) ----
async function renderSingle(pres: any, slide: any, block: ChartBlock, availW: number, availH: number) {
  const KPI_W     = 180;
  const chartCardW = availW - KPI_W - GAP;
  const chartImgData = await captureChart(`chart-${block.id}`);
  const title = block.context.length > 72 ? block.context.slice(0, 72) + "..." : block.context || "Chart 1";
  const chartType = block.chartType
    ? block.chartType.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Auto";

  const cX = PAD;
  const cY = HDR_H + PAD;
  const chartBodyH = availH - EXHB_H - CTITLE_H - 8;

  // ---- Chart card ----
  slide.addShape(pres.ShapeType.rect, {
    x: I(cX), y: I(cY), w: I(chartCardW), h: I(availH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });
  // Exhibit badge bar
  slide.addShape(pres.ShapeType.rect, {
    x: I(cX), y: I(cY), w: I(chartCardW), h: I(EXHB_H),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  // "EXHIBIT 1" white badge
  slide.addShape(pres.ShapeType.rect, {
    x: I(cX + 8), y: I(cY + 5), w: I(54), h: I(11),
    fill: { color: C.white }, line: { color: C.white },
  });
  slide.addText("EXHIBIT 1", {
    x: I(cX + 8), y: I(cY + 5), w: I(54), h: I(11),
    fontSize: 5, bold: true, color: C.dark3, fontFace: "Calibri",
    align: "center", valign: "middle",
  });
  slide.addText(chartType, {
    x: I(cX + 70), y: I(cY + 5), w: I(chartCardW - 78), h: I(11),
    fontSize: 6, color: C.white, fontFace: "Calibri", valign: "middle",
  });
  // Title bar
  slide.addShape(pres.ShapeType.rect, {
    x: I(cX), y: I(cY + EXHB_H), w: I(chartCardW), h: I(CTITLE_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(cX), y: I(cY + EXHB_H + CTITLE_H - 2), w: I(chartCardW), h: I(2),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(title, {
    x: I(cX + 10), y: I(cY + EXHB_H + 4), w: I(chartCardW - 18), h: I(CTITLE_H - 6),
    fontSize: 7, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });
  // Chart body
  const imgY = cY + EXHB_H + CTITLE_H;
  slide.addShape(pres.ShapeType.rect, {
    x: I(cX), y: I(imgY), w: I(chartCardW), h: I(chartBodyH),
    fill: { color: C.bg }, line: { color: C.bg },
  });
  if (chartImgData) {
    slide.addImage({
      data: chartImgData,
      x: I(cX + 8), y: I(imgY + 6),
      w: I(chartCardW - 16), h: I(chartBodyH - 12),
    });
  }

  // ---- KPI sidebar ----
  const kpiX = PAD + chartCardW + GAP;
  const kpiY = HDR_H + PAD;

  // Metrics card
  const metricsH = Math.min(100, availH * 0.28);
  slide.addShape(pres.ShapeType.rect, {
    x: I(kpiX), y: I(kpiY), w: I(KPI_W), h: I(metricsH),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });

  const metrics = [
    { label: "PEAK",        color: C.light2 },
    { label: "LATEST",      color: C.primary },
    { label: "LAST CHANGE", color: C.light3 },
  ];
  metrics.forEach(({ label, color }, mi) => {
    const mY = kpiY + 10 + mi * (metricsH / 3.2);
    slide.addText(label, {
      x: I(kpiX + 10), y: I(mY), w: I(KPI_W - 20), h: I(9),
      fontSize: 5.5, color: C.light3, fontFace: "Calibri", charSpacing: 0.8,
    });
    slide.addText("–", {
      x: I(kpiX + 10), y: I(mY + 10), w: I(KPI_W - 20), h: I(16),
      fontSize: 14, bold: true, color, fontFace: "Calibri",
    });
  });

  // Key Finding card
  const kfY = kpiY + metricsH + 10;
  const kfH = Math.round(availH * 0.38);
  const callout = block.insights[0] ?? "";
  slide.addShape(pres.ShapeType.rect, {
    x: I(kpiX), y: I(kfY), w: I(KPI_W), h: I(kfH),
    fill: { color: C.light5 }, line: { color: C.light3, width: 0.5 },
  });
  // "i" circle
  slide.addShape(pres.ShapeType.ellipse, {
    x: I(kpiX + 10), y: I(kfY + 10), w: I(20), h: I(20),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText("i", {
    x: I(kpiX + 10), y: I(kfY + 10), w: I(20), h: I(20),
    fontSize: 9, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", valign: "middle",
  });
  slide.addText("KEY FINDING", {
    x: I(kpiX + 36), y: I(kfY + 13), w: I(KPI_W - 44), h: I(14),
    fontSize: 6, bold: true, color: C.dark3, fontFace: "Calibri", charSpacing: 0.8,
  });
  if (callout) {
    slide.addText(callout, {
      x: I(kpiX + 10), y: I(kfY + 36), w: I(KPI_W - 20), h: I(kfH - 44),
      fontSize: 6.5, color: C.dark2, fontFace: "Calibri", wrap: true,
      valign: "top",
    });
  }

  // Remaining insights bullets
  if (block.insights.length > 1) {
    const blY = kfY + kfH + 10;
    const blH = availH - (blY - kpiY);
    slide.addShape(pres.ShapeType.rect, {
      x: I(kpiX), y: I(blY), w: I(KPI_W), h: I(blH),
      fill: { color: C.white }, line: { color: C.light3, width: 0.5 },
    });
    block.insights.slice(1, 5).forEach((ins, ii) => {
      const bY = blY + 8 + ii * 24;
      if (bY + 20 > kpiY + availH) return;
      // Checkmark circle
      slide.addShape(pres.ShapeType.ellipse, {
        x: I(kpiX + 8), y: I(bY + 1), w: I(12), h: I(12),
        fill: { color: C.primary }, line: { color: C.primary },
      });
      slide.addText("✓", {
        x: I(kpiX + 8), y: I(bY + 1), w: I(12), h: I(12),
        fontSize: 5, bold: true, color: C.white, fontFace: "Calibri",
        align: "center", valign: "middle",
      });
      slide.addText(ins.length > 65 ? ins.slice(0, 65) + "..." : ins, {
        x: I(kpiX + 24), y: I(bY), w: I(KPI_W - 30), h: I(14),
        fontSize: 6, color: C.dark3, fontFace: "Calibri", wrap: false,
      });
    });
  }
}

// ---- Exhibit card (multi-chart grid) ----
async function renderExhibit(
  pres: any, slide: any,
  block: ChartBlock, idx: number,
  x: number, y: number, cellW: number, cellH: number,
) {
  const chartImgData = await captureChart(`chart-${block.id}`);
  const title = block.context.length > 60 ? block.context.slice(0, 60) + "..." : block.context || `Chart ${idx + 1}`;
  const chartType = block.chartType
    ? block.chartType.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Auto";
  const insCount  = Math.min(block.insights.length, 2);
  const insSectionH = insCount > 0 ? INSPAD * 2 + insCount * INS_ROW_H + 4 : 0;
  const chartBodyH  = cellH - EXHB_H - CTITLE_H - insSectionH - 4;

  // Cell bg
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cellW), h: I(cellH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });
  // Exhibit badge bar
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cellW), h: I(EXHB_H),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  // White badge label
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 7), y: I(y + 5), w: I(52), h: I(11),
    fill: { color: C.white }, line: { color: C.white },
  });
  slide.addText(`EXHIBIT ${idx + 1}`, {
    x: I(x + 7), y: I(y + 5), w: I(52), h: I(11),
    fontSize: 4.5, bold: true, color: C.dark3, fontFace: "Calibri",
    align: "center", valign: "middle",
  });
  slide.addText(chartType, {
    x: I(x + 65), y: I(y + 5), w: I(cellW - 72), h: I(11),
    fontSize: 5.5, color: C.white, fontFace: "Calibri", valign: "middle",
  });
  // Title bar
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y + EXHB_H), w: I(cellW), h: I(CTITLE_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y + EXHB_H + CTITLE_H - 2), w: I(cellW), h: I(2),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(title, {
    x: I(x + 8), y: I(y + EXHB_H + 4), w: I(cellW - 16), h: I(CTITLE_H - 6),
    fontSize: 6.5, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });
  // Chart body bg
  const bodyY = y + EXHB_H + CTITLE_H;
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(bodyY), w: I(cellW), h: I(chartBodyH),
    fill: { color: C.bg }, line: { color: C.bg },
  });
  // Chart image
  if (chartImgData) {
    slide.addImage({
      data: chartImgData,
      x: I(x + 6), y: I(bodyY + 5),
      w: I(cellW - 12), h: I(chartBodyH - 8),
    });
  }
  // Insights strip
  if (insCount > 0) {
    const insY = bodyY + chartBodyH;
    slide.addShape(pres.ShapeType.rect, {
      x: I(x), y: I(insY), w: I(cellW), h: I(insSectionH),
      fill: { color: C.light5 }, line: { color: C.light3, width: 0.3 },
    });
    block.insights.slice(0, 2).forEach((ins, ii) => {
      const iY = insY + INSPAD + ii * (INS_ROW_H + 3);
      slide.addShape(pres.ShapeType.ellipse, {
        x: I(x + 8), y: I(iY + 1), w: I(10), h: I(10),
        fill: { color: C.primary }, line: { color: C.primary },
      });
      slide.addText("•", {
        x: I(x + 8), y: I(iY + 1), w: I(10), h: I(10),
        fontSize: 7, bold: true, color: C.white, fontFace: "Calibri",
        align: "center", valign: "middle",
      });
      slide.addText(ins.length > 80 ? ins.slice(0, 80) + "..." : ins, {
        x: I(x + 22), y: I(iY), w: I(cellW - 28), h: I(INS_ROW_H),
        fontSize: 5.5, color: C.dark3, fontFace: "Calibri", wrap: false,
      });
    });
  }
}

// ---- Key Takeaways bar ----
function renderTakeaways(pres: any, slide: any, insights: string[], tkwY: number, availW: number, TKW_H: number) {
  // Background
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(tkwY), w: 8.27, h: I(TKW_H),
    fill: { color: "F0FAFB" }, line: { color: C.primary, width: 1.2 },
  });
  // Vertical accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: I(PAD), y: I(tkwY + INSPAD + 1), w: I(3), h: I(13),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText("KEY TAKEAWAYS", {
    x: I(PAD + 8), y: I(tkwY + INSPAD), w: I(200), h: I(14),
    fontSize: 6.5, bold: true, color: C.dark3, fontFace: "Calibri",
    charSpacing: 1.5, valign: "middle",
  });

  const half = Math.ceil(insights.length / 2);
  const colW = (availW - 20) / 2;

  insights.forEach((ins, ii) => {
    const col = ii < half ? 0 : 1;
    const row = ii < half ? ii : ii - half;
    const iX  = PAD + col * (colW + 20);
    const iY  = tkwY + INSPAD + 22 + row * (INS_ROW_H + 5);
    // Checkmark circle
    slide.addShape(pres.ShapeType.ellipse, {
      x: I(iX), y: I(iY + 1), w: I(13), h: I(13),
      fill: { color: C.primary }, line: { color: C.primary },
    });
    slide.addText("✓", {
      x: I(iX), y: I(iY + 1), w: I(13), h: I(13),
      fontSize: 5.5, bold: true, color: C.white, fontFace: "Calibri",
      align: "center", valign: "middle",
    });
    slide.addText(ins.length > 95 ? ins.slice(0, 95) + "..." : ins, {
      x: I(iX + 17), y: I(iY), w: I(colW - 20), h: I(INS_ROW_H),
      fontSize: 6, color: C.dark3, fontFace: "Calibri", wrap: false,
    });
  });
}
