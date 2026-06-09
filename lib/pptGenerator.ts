import type { ChartBlock } from "./types";

// px → inches for A4 at 96 dpi (794px = 8.27in)
const I = (px: number) => +(px * (8.27 / 794)).toFixed(4);

const A4_W     = 794;
const A4_H     = 1123;
const HDR_H    = 72;
const FOOTER_H = 32;
const PAD      = 22;
const GAP      = 14;
const STACK_GAP = 10;
const H_GAP    = 10;
const KPI_W    = 190;
const EXHB_H   = 22;
const CTITLE_H = 24;
const ANN_H    = 70;
const INSPAD   = 10;
const INS_ROW_H = 14;
const MAX_SINGLE_EXHIBIT_H = 680;

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

async function captureChart(chartId: string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(chartId) as HTMLCanvasElement | null;
  if (!el || el.tagName !== "CANVAS") return null;
  try { return el.toDataURL("image/png"); } catch { return null; }
}

export async function generatePPT(blocks: ChartBlock[]): Promise<void> {
  const pptxgenjs = (await import("pptxgenjs")).default;
  const pres = new pptxgenjs();
  pres.defineLayout({ name: "A4", width: 8.27, height: 11.69 });
  pres.layout = "A4";
  const slide = pres.addSlide();

  const count = Math.min(blocks.length, 4);
  const allInsights = blocks.flatMap(b => b.insights);
  const tkwInsights = allInsights.slice(0, 6);
  const hasInsights = tkwInsights.length > 0;
  const tkwRows = Math.ceil(tkwInsights.length / 2);
  const TKW_H = hasInsights ? INSPAD * 2 + 22 + tkwRows * (INS_ROW_H + 5) + 8 : 0;
  const availH = A4_H - HDR_H - FOOTER_H - PAD * 2 - TKW_H;
  const availW = A4_W - PAD * 2;

  const slideTitle = (blocks[0]?.context?.slice(0, 80) || "DATA ANALYSIS REPORT").toUpperCase();

  // ── Header ──────────────────────────────────────────────────────────────
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 8.27, h: I(HDR_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(HDR_H - 3), w: 8.27, h: I(3),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(slideTitle, {
    x: I(PAD), y: I(12), w: I(availW - 20), h: I(28),
    fontSize: 11, bold: true, color: C.white, fontFace: "Calibri",
    charSpacing: 1, valign: "middle",
  });
  const sub = blocks.length > 1
    ? `${blocks.length} exhibits — data analysis and insights`
    : (blocks[0]?.instructions?.slice(0, 90) || "");
  if (sub) {
    slide.addText(sub, {
      x: I(PAD), y: I(46), w: I(500), h: I(16),
      fontSize: 6.5, color: C.light3, fontFace: "Calibri",
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(A4_H - FOOTER_H), w: 8.27, h: I(FOOTER_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  slide.addText("SLIDEMAKER", {
    x: I(PAD), y: I(A4_H - FOOTER_H + 9), w: I(160), h: I(14),
    fontSize: 6, bold: true, color: C.light3, fontFace: "Calibri", charSpacing: 2,
  });
  slide.addText("Confidential", {
    x: I(availW - 90), y: I(A4_H - FOOTER_H + 9), w: I(110), h: I(14),
    fontSize: 6, color: C.light3, fontFace: "Calibri", align: "right",
  });

  // ── Charts ───────────────────────────────────────────────────────────────
  const displayBlocks = blocks.slice(0, 4);

  if (count <= 2) {
    // Stacked full-width exhibits with KPI panels
    const exhibitH = count === 1
      ? Math.min(availH, MAX_SINGLE_EXHIBIT_H)
      : Math.floor((availH - STACK_GAP) / 2);

    for (let i = 0; i < count; i++) {
      const y = HDR_H + PAD + i * (exhibitH + STACK_GAP);
      await renderExhibitWithKPI(pres, slide, displayBlocks[i], i, PAD, y, availW, exhibitH);
    }
  } else {
    // 2-column grid for 3–4 charts
    const cols = 2;
    const rows = count <= 2 ? 1 : 2;
    const cellW = Math.floor((availW - GAP) / cols);
    const cellH = Math.floor((availH - (rows - 1) * GAP) / rows);

    for (let idx = 0; idx < count; idx++) {
      let col = idx % cols;
      let row = Math.floor(idx / cols);
      let xOffset = 0;
      if (count === 3 && idx === 2) { col = 0; row = 1; xOffset = (cellW + GAP) / 2; }
      const x = PAD + col * (cellW + GAP) + xOffset;
      const y = HDR_H + PAD + row * (cellH + GAP);
      await renderExhibit(pres, slide, displayBlocks[idx], idx, x, y, cellW, cellH);
    }
  }

  // ── Key Takeaways ─────────────────────────────────────────────────────────
  if (hasInsights) {
    renderTakeaways(pres, slide, tkwInsights, A4_H - FOOTER_H - TKW_H, availW, TKW_H);
  }

  await pres.writeFile({ fileName: "slidemaker-slide.pptx" });
}

// ── Full-width exhibit + KPI panel ──────────────────────────────────────────
async function renderExhibitWithKPI(
  pres: any, slide: any,
  block: ChartBlock, idx: number,
  x: number, y: number,
  availW: number, exhibitH: number,
) {
  const chartCardW = availW - KPI_W - H_GAP;
  const kpiX = x + chartCardW + H_GAP;
  const hasAnns = block.annotations?.length > 0;
  const effectiveAnnH = hasAnns ? ANN_H : 0;
  const chartBodyH = exhibitH - EXHB_H - CTITLE_H - effectiveAnnH;
  const chartImgData = await captureChart(`chart-${block.id}`);

  await renderChartCard(pres, slide, block, idx, x, y, chartCardW, exhibitH, chartBodyH, effectiveAnnH, chartImgData);
  renderKPIPanel(pres, slide, block, kpiX, y, KPI_W, exhibitH);
}

// ── Chart card (badge + title bar + chart body + annotations) ────────────────
async function renderChartCard(
  pres: any, slide: any,
  block: ChartBlock, idx: number,
  x: number, y: number, cardW: number, cardH: number,
  chartBodyH: number, annH: number, chartImgData: string | null,
) {
  const title = block.context.length > 68
    ? block.context.slice(0, 68) + "..."
    : block.context || `Chart ${idx + 1}`;
  const chartType = block.chartType
    ? block.chartType.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Auto";

  // Card background
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cardW), h: I(cardH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });

  // Exhibit badge bar
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cardW), h: I(EXHB_H),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 8), y: I(y + 5), w: I(52), h: I(11),
    fill: { color: C.white }, line: { color: C.white },
  });
  slide.addText(`EXHIBIT ${idx + 1}`, {
    x: I(x + 8), y: I(y + 5), w: I(52), h: I(11),
    fontSize: 5, bold: true, color: C.dark3, fontFace: "Calibri",
    align: "center", valign: "middle",
  });
  slide.addText(chartType, {
    x: I(x + 66), y: I(y + 5), w: I(cardW - 74), h: I(11),
    fontSize: 6.5, color: C.white, fontFace: "Calibri", valign: "middle",
  });

  // Title bar
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y + EXHB_H), w: I(cardW), h: I(CTITLE_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y + EXHB_H + CTITLE_H - 2), w: I(cardW), h: I(2),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(title, {
    x: I(x + 12), y: I(y + EXHB_H + 4), w: I(cardW - 20), h: I(CTITLE_H - 6),
    fontSize: 8, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });

  // Chart body background
  const imgY = y + EXHB_H + CTITLE_H;
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(imgY), w: I(cardW), h: I(chartBodyH),
    fill: { color: C.bg }, line: { color: C.bg },
  });
  if (chartImgData) {
    slide.addImage({
      data: chartImgData,
      x: I(x + 8), y: I(imgY + 6),
      w: I(cardW - 16), h: I(chartBodyH - 10),
    });
  }

  // Period annotations
  if (annH > 0 && block.annotations?.length > 0) {
    const annY = imgY + chartBodyH;
    const colW = Math.floor(cardW / 3);

    slide.addShape(pres.ShapeType.rect, {
      x: I(x), y: I(annY), w: I(cardW), h: I(annH),
      fill: { color: "F4FBFC" }, line: { color: C.light4, width: 0.3 },
    });

    block.annotations.slice(0, 3).forEach((ann, i) => {
      const aX = x + i * colW;

      // Column dividers
      if (i > 0) {
        slide.addShape(pres.ShapeType.rect, {
          x: I(aX), y: I(annY + 5), w: I(0.5), h: I(annH - 10),
          fill: { color: C.light3 }, line: { color: C.light3 },
        });
      }

      // Flanking lines + period label
      slide.addShape(pres.ShapeType.rect, {
        x: I(aX + 6), y: I(annY + 11), w: I(colW * 0.28), h: I(0.8),
        fill: { color: C.light2 }, line: { color: C.light2 },
      });
      slide.addShape(pres.ShapeType.rect, {
        x: I(aX + colW - 6 - colW * 0.28), y: I(annY + 11), w: I(colW * 0.28), h: I(0.8),
        fill: { color: C.light2 }, line: { color: C.light2 },
      });
      slide.addText(ann.period, {
        x: I(aX + colW * 0.28 + 4), y: I(annY + 5), w: I(colW * 0.44 - 8), h: I(12),
        fontSize: 5.5, bold: true, color: C.dark2, fontFace: "Calibri",
        align: "center", charSpacing: 0.4,
      });

      // Phase label
      slide.addText(ann.label, {
        x: I(aX + 6), y: I(annY + 19), w: I(colW - 12), h: I(12),
        fontSize: 6, bold: true, color: C.dark3, fontFace: "Calibri",
      });

      // Description
      slide.addText(ann.description, {
        x: I(aX + 6), y: I(annY + 32), w: I(colW - 12), h: I(annH - 36),
        fontSize: 5.5, color: C.dark1, fontFace: "Calibri", wrap: true, valign: "top",
      });
    });
  }
}

// ── KPI callout panel ───────────────────────────────────────────────────────
function renderKPIPanel(
  pres: any, slide: any,
  block: ChartBlock,
  x: number, y: number, kpiW: number, kpiH: number,
) {
  const headerH = Math.min(130, Math.floor(kpiH * 0.3));
  const bodyY = y + headerH;

  // Panel background
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(kpiW), h: I(kpiH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });

  // Dark header
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(kpiW), h: I(headerH),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });

  // Circle icon (outer ring + inner dot)
  const circR = 22;
  const circX = x + kpiW / 2 - circR;
  const circY = y + 10;
  slide.addShape(pres.ShapeType.ellipse, {
    x: I(circX), y: I(circY), w: I(circR * 2), h: I(circR * 2),
    fill: { color: C.primary }, line: { color: C.light2, width: 1.5 },
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: I(circX + 8), y: I(circY + 8), w: I((circR - 8) * 2), h: I((circR - 8) * 2),
    fill: { color: "00000000" }, line: { color: C.light3, width: 1.2 },
  });

  // KPI Title
  const titleY = circY + circR * 2 + 6;
  const titleH = headerH - (titleY - y) - 6;
  const titleText = (block.kpiTitle || "Key Insight").toUpperCase();
  slide.addText(titleText, {
    x: I(x + 8), y: I(titleY), w: I(kpiW - 16), h: I(Math.max(titleH, 14)),
    fontSize: 7, bold: true, color: C.white, fontFace: "Calibri",
    align: "center", charSpacing: 0.5, wrap: true, valign: "top",
  });

  // Subtitle (teal highlight)
  let curY = bodyY + 10;
  if (block.kpiSubtitle) {
    slide.addText(block.kpiSubtitle, {
      x: I(x + 10), y: I(curY), w: I(kpiW - 20), h: I(28),
      fontSize: 6.5, bold: true, color: C.primary, fontFace: "Calibri",
      wrap: true, valign: "top",
    });
    curY += 32;
  }

  // Description
  const hasBullets = block.insights.length > 0;
  const bulletAreaH = hasBullets ? 6 + Math.min(3, block.insights.length) * 18 : 0;
  const descH = Math.max(30, kpiH - headerH - 10 - (block.kpiSubtitle ? 32 : 0) - bulletAreaH - 14);
  const descText = block.kpiDescription || (block.insights[0] ?? "");
  if (descText) {
    slide.addText(descText, {
      x: I(x + 10), y: I(curY), w: I(kpiW - 20), h: I(descH),
      fontSize: 6, color: C.dark2, fontFace: "Calibri", wrap: true, valign: "top",
    });
    curY += descH;
  }

  // Divider + bullet insights
  if (hasBullets) {
    const divY = y + kpiH - bulletAreaH - 8;
    if (divY > curY + 4) {
      slide.addShape(pres.ShapeType.rect, {
        x: I(x + 8), y: I(divY), w: I(kpiW - 16), h: I(0.5),
        fill: { color: C.light3 }, line: { color: C.light3 },
      });
      block.insights.slice(0, 3).forEach((ins, i) => {
        const bY = divY + 6 + i * 18;
        if (bY + 12 > y + kpiH - 6) return;
        slide.addShape(pres.ShapeType.ellipse, {
          x: I(x + 8), y: I(bY + 2), w: I(9), h: I(9),
          fill: { color: C.primary }, line: { color: C.primary },
        });
        slide.addText(ins.length > 52 ? ins.slice(0, 52) + "..." : ins, {
          x: I(x + 20), y: I(bY), w: I(kpiW - 26), h: I(14),
          fontSize: 5.5, color: C.dark3, fontFace: "Calibri", wrap: false,
        });
      });
    }
  }
}

// ── Compact exhibit card (3–4 chart grid) ────────────────────────────────────
async function renderExhibit(
  pres: any, slide: any,
  block: ChartBlock, idx: number,
  x: number, y: number, cellW: number, cellH: number,
) {
  const chartImgData = await captureChart(`chart-${block.id}`);
  const title = block.context.length > 58
    ? block.context.slice(0, 58) + "..."
    : block.context || `Chart ${idx + 1}`;
  const chartType = block.chartType
    ? block.chartType.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Auto";
  const insCount = Math.min(block.insights.length, 2);
  const insSectionH = insCount > 0 ? INSPAD * 2 + insCount * INS_ROW_H + 4 : 0;
  const chartBodyH = cellH - EXHB_H - CTITLE_H - insSectionH - 4;

  // Card bg
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cellW), h: I(cellH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });
  // Badge bar
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cellW), h: I(EXHB_H),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 7), y: I(y + 5), w: I(50), h: I(11),
    fill: { color: C.white }, line: { color: C.white },
  });
  slide.addText(`EXHIBIT ${idx + 1}`, {
    x: I(x + 7), y: I(y + 5), w: I(50), h: I(11),
    fontSize: 4.5, bold: true, color: C.dark3, fontFace: "Calibri",
    align: "center", valign: "middle",
  });
  slide.addText(chartType, {
    x: I(x + 62), y: I(y + 5), w: I(cellW - 70), h: I(11),
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
  // Chart body
  const bodyY = y + EXHB_H + CTITLE_H;
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(bodyY), w: I(cellW), h: I(chartBodyH),
    fill: { color: C.bg }, line: { color: C.bg },
  });
  if (chartImgData) {
    slide.addImage({
      data: chartImgData,
      x: I(x + 6), y: I(bodyY + 5),
      w: I(cellW - 12), h: I(chartBodyH - 8),
    });
  }
  // Insight strip
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
      slide.addText(ins.length > 78 ? ins.slice(0, 78) + "..." : ins, {
        x: I(x + 22), y: I(iY), w: I(cellW - 28), h: I(INS_ROW_H),
        fontSize: 5.5, color: C.dark3, fontFace: "Calibri", wrap: false,
      });
    });
  }
}

// ── Key Takeaways bar ────────────────────────────────────────────────────────
function renderTakeaways(
  pres: any, slide: any,
  insights: string[], tkwY: number, availW: number, TKW_H: number,
) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(tkwY), w: 8.27, h: I(TKW_H),
    fill: { color: "F0FAFB" }, line: { color: C.primary, width: 1.2 },
  });
  // Accent bar + label
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
    const iX = PAD + col * (colW + 20);
    const iY = tkwY + INSPAD + 22 + row * (INS_ROW_H + 5);
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
