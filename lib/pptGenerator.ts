import type { ChartBlock } from "./types";

// px → inches for A4 at 96 dpi (794px = 8.27in)
const I = (px: number) => +(px * (8.27 / 794)).toFixed(4);

const A4_W        = 794;
const A4_H        = 1123;
const HDR_H       = 70;
const PAD         = 20;
const STACK_GAP   = 10;
const H_GAP       = 10;
const KPI_W       = 190;
const TITLE_ROW_H = 30;
const ANN_H       = 80;
const SOURCE_H    = 16;
const GAP         = 14;
const GRID_TITLE_H = 26;
const INSPAD      = 10;
const INS_ROW_H   = 16;
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
  kpiBg:   "F5FBFC",
  tkwBg:   "EAF6F7",
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
  const tkwInsights = allInsights.slice(0, 4);
  const hasInsights = tkwInsights.length > 0;
  const TKW_H = hasInsights ? INSPAD * 2 + 22 + tkwInsights.length * (INS_ROW_H + 5) + 8 : 0;
  const chartDivH = A4_H - HDR_H - TKW_H;
  const availH = chartDivH - PAD;
  const availW = A4_W - PAD * 2;

  const slideTitle = (blocks[0]?.context?.slice(0, 80) || "DATA ANALYSIS REPORT").toUpperCase();
  const slideSubtitle = blocks[0]?.slideSubtitle || "";

  // ── Header: plain text on white, 3px teal bottom border ──────────────────
  // (slide bg is already white, just need the border line and text)
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(HDR_H - 3), w: 8.27, h: I(3),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(slideTitle, {
    x: I(PAD), y: I(13), w: I(availW), h: I(26),
    fontSize: 11, bold: true, color: C.dark3, fontFace: "Calibri",
    charSpacing: 0.8, valign: "middle",
  });
  if (slideSubtitle) {
    slide.addText(slideSubtitle, {
      x: I(PAD), y: I(43), w: I(availW - 60), h: I(20),
      fontSize: 6, color: "5C7C7E", fontFace: "Calibri", wrap: true, valign: "top",
    });
  }

  // ── Bottom accent line (no footer) ───────────────────────────────────────
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(A4_H - 3), w: 8.27, h: I(3),
    fill: { color: C.primary }, line: { color: C.primary },
  });

  // ── Charts ───────────────────────────────────────────────────────────────
  const displayBlocks = blocks.slice(0, 4);

  if (count <= 2) {
    const exhibitH = count === 1
      ? Math.min(availH, MAX_SINGLE_EXHIBIT_H)
      : Math.floor((availH - STACK_GAP) / 2);

    for (let i = 0; i < count; i++) {
      const y = HDR_H + PAD + i * (exhibitH + STACK_GAP);
      await renderExhibitWithKPI(pres, slide, displayBlocks[i], i, PAD, y, availW, exhibitH);
    }
  } else {
    const cols = 2;
    const rows = 2;
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
    renderTakeaways(pres, slide, tkwInsights, A4_H - TKW_H, availW, TKW_H);
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
  const hasAnns = (block.annotations?.length ?? 0) > 0;
  const hasSrc = !!block.source;
  const annH = hasAnns ? ANN_H : 0;
  const srcH = hasSrc ? SOURCE_H : 0;
  const chartBodyH = exhibitH - TITLE_ROW_H - annH - srcH;
  const chartImgData = await captureChart(`chart-${block.id}`);

  await renderChartCard(pres, slide, block, idx, x, y, chartCardW, exhibitH, chartBodyH, annH, srcH, chartImgData);
  renderKPIPanel(pres, slide, block, kpiX, y, KPI_W, exhibitH);
}

// ── Chart card ───────────────────────────────────────────────────────────────
async function renderChartCard(
  pres: any, slide: any,
  block: ChartBlock, idx: number,
  x: number, y: number, cardW: number, cardH: number,
  chartBodyH: number, annH: number, srcH: number, chartImgData: string | null,
) {
  const title = block.context.length > 72
    ? block.context.slice(0, 72) + "..."
    : block.context || `Chart ${idx + 1}`;
  const BADGE_W = 66; // width of teal badge section

  // Card background
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cardW), h: I(cardH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });

  // Badge section (teal bg)
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(BADGE_W), h: I(TITLE_ROW_H),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  // White pill badge
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 7), y: I(y + 8), w: I(52), h: I(TITLE_ROW_H - 16),
    fill: { color: C.white }, line: { color: C.white },
  });
  slide.addText(`EXHIBIT ${idx + 1}`, {
    x: I(x + 7), y: I(y + 8), w: I(52), h: I(TITLE_ROW_H - 16),
    fontSize: 5, bold: true, color: C.dark3, fontFace: "Calibri",
    align: "center", valign: "middle",
  });

  // Title section (dark bg)
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + BADGE_W), y: I(y), w: I(cardW - BADGE_W), h: I(TITLE_ROW_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  // Teal bottom accent on title section
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + BADGE_W), y: I(y + TITLE_ROW_H - 2), w: I(cardW - BADGE_W), h: I(2),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(title, {
    x: I(x + BADGE_W + 8), y: I(y + 5), w: I(cardW - BADGE_W - 16), h: I(TITLE_ROW_H - 8),
    fontSize: 7, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });

  // Chart body background
  const imgY = y + TITLE_ROW_H;
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
      fill: { color: "F5FAFB" }, line: { color: C.light4, width: 0.3 },
    });

    block.annotations.slice(0, 3).forEach((ann, i) => {
      const aX = x + i * colW;

      // Column divider (dashed)
      if (i > 0) {
        slide.addShape(pres.ShapeType.line, {
          x: I(aX), y: I(annY + 5), w: 0, h: I(annH - 10),
          line: { color: C.light3, pt: 0.5, dashType: "dash" },
        });
      }

      // Dashed lines flanking period label
      const midX = aX + colW / 2;
      const periodTxtW = 32;
      // Left dashed segment
      slide.addShape(pres.ShapeType.line, {
        x: I(aX + 8), y: I(annY + 12), w: I(midX - aX - 8 - periodTxtW / 2 - 4), h: 0,
        line: { color: C.light3, pt: 0.6, dashType: "dash" },
      });
      // Right dashed segment
      slide.addShape(pres.ShapeType.line, {
        x: I(midX + periodTxtW / 2 + 4), y: I(annY + 12),
        w: I(aX + colW - 8 - (midX + periodTxtW / 2 + 4)), h: 0,
        line: { color: C.light3, pt: 0.6, dashType: "dash" },
      });
      // Arrow tips
      slide.addText("◄", {
        x: I(aX + 4), y: I(annY + 7), w: I(8), h: I(10),
        fontSize: 4.5, color: C.dark1, fontFace: "Calibri", align: "center",
      });
      slide.addText("►", {
        x: I(aX + colW - 12), y: I(annY + 7), w: I(8), h: I(10),
        fontSize: 4.5, color: C.dark1, fontFace: "Calibri", align: "center",
      });
      // Period label
      slide.addText(ann.period, {
        x: I(midX - periodTxtW / 2), y: I(annY + 5), w: I(periodTxtW), h: I(12),
        fontSize: 5, bold: true, color: C.dark2, fontFace: "Calibri",
        align: "center", charSpacing: 0.3,
      });

      // Icon emoji
      if (ann.icon) {
        slide.addText(ann.icon, {
          x: I(aX + colW / 2 - 8), y: I(annY + 18), w: I(16), h: I(16),
          fontSize: 9, fontFace: "Segoe UI Emoji", align: "center",
        });
      }

      // Phase label
      slide.addText(ann.label, {
        x: I(aX + 6), y: I(annY + (ann.icon ? 35 : 22)), w: I(colW - 12), h: I(11),
        fontSize: 6, bold: true, color: C.dark3, fontFace: "Calibri",
      });

      // Description
      slide.addText(ann.description, {
        x: I(aX + 6), y: I(annY + (ann.icon ? 47 : 34)), w: I(colW - 12), h: I(annH - (ann.icon ? 51 : 38)),
        fontSize: 5.5, color: C.dark1, fontFace: "Calibri", wrap: true, valign: "top",
      });
    });
  }

  // Source attribution
  if (srcH > 0 && block.source) {
    const srcY = imgY + chartBodyH + annH;
    slide.addShape(pres.ShapeType.rect, {
      x: I(x), y: I(srcY), w: I(cardW), h: I(srcH),
      fill: { color: C.bg }, line: { color: C.light4, width: 0.3 },
    });
    slide.addText(`Source: ${block.source}`, {
      x: I(x + 10), y: I(srcY + 3), w: I(cardW - 20), h: I(srcH - 4),
      fontSize: 5, italic: true, color: "8AABAC", fontFace: "Calibri", valign: "middle",
    });
  }
}

// ── KPI panel (light bg, no dark header) ────────────────────────────────────
function renderKPIPanel(
  pres: any, slide: any,
  block: ChartBlock,
  x: number, y: number, kpiW: number, kpiH: number,
) {
  // Panel background
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(kpiW), h: I(kpiH),
    fill: { color: C.kpiBg }, line: { color: C.light3, width: 0.8 },
  });

  // Contextual icon circle
  const circR = 30;
  const circX = x + kpiW / 2 - circR;
  const circY = y + 16;
  slide.addShape(pres.ShapeType.ellipse, {
    x: I(circX), y: I(circY), w: I(circR * 2), h: I(circR * 2),
    fill: { color: C.primary }, line: { color: C.light4, width: 1.5 },
  });
  // Inner ring for depth
  slide.addShape(pres.ShapeType.ellipse, {
    x: I(circX + 8), y: I(circY + 8), w: I((circR - 8) * 2), h: I((circR - 8) * 2),
    fill: { type: "none" }, line: { color: C.light3, width: 0.8 },
  });
  // Icon emoji
  const kpiIcon = block.kpiIcon || "📊";
  slide.addText(kpiIcon, {
    x: I(circX + 4), y: I(circY + circR - 9), w: I((circR - 4) * 2), h: I(18),
    fontSize: 13, fontFace: "Segoe UI Emoji", align: "center", valign: "middle",
  });

  // KPI title
  const titleY = circY + circR * 2 + 8;
  const titleText = (block.kpiTitle || "Key Insight").toUpperCase();
  slide.addText(titleText, {
    x: I(x + 8), y: I(titleY), w: I(kpiW - 16), h: I(22),
    fontSize: 7, bold: true, color: C.dark3, fontFace: "Calibri",
    align: "center", charSpacing: 0.5, wrap: true, valign: "top",
  });

  // Divider
  const divY = titleY + 26;
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 10), y: I(divY), w: I(kpiW - 20), h: I(1),
    fill: { color: C.light3 }, line: { color: C.light3 },
  });

  // Subtitle (teal)
  let curY = divY + 6;
  if (block.kpiSubtitle) {
    slide.addText(block.kpiSubtitle, {
      x: I(x + 10), y: I(curY), w: I(kpiW - 20), h: I(28),
      fontSize: 6.5, bold: true, color: C.primary, fontFace: "Calibri",
      wrap: true, valign: "top", align: "center",
    });
    curY += 32;
  }

  // Description body
  const descText = block.kpiDescription || block.insights[0] || "";
  if (descText) {
    const descH = Math.max(28, kpiH - (curY - y) - 10);
    slide.addText(descText, {
      x: I(x + 10), y: I(curY), w: I(kpiW - 20), h: I(descH),
      fontSize: 6, color: C.dark2, fontFace: "Calibri", wrap: true, valign: "top",
    });
  }
}

// ── Compact exhibit card (3–4 chart grid) ────────────────────────────────────
async function renderExhibit(
  pres: any, slide: any,
  block: ChartBlock, idx: number,
  x: number, y: number, cellW: number, cellH: number,
) {
  const chartImgData = await captureChart(`chart-${block.id}`);
  const title = block.context.length > 60
    ? block.context.slice(0, 60) + "..."
    : block.context || `Chart ${idx + 1}`;
  const insCount = Math.min(block.insights.length, 2);
  const insSectionH = insCount > 0 ? INSPAD * 2 + insCount * 14 + 4 : 0;
  const chartBodyH = cellH - GRID_TITLE_H - insSectionH;
  const BADGE_W = 58;

  // Card bg
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(cellW), h: I(cellH),
    fill: { color: C.white }, line: { color: C.light4, width: 0.5 },
  });
  // Badge section
  slide.addShape(pres.ShapeType.rect, {
    x: I(x), y: I(y), w: I(BADGE_W), h: I(GRID_TITLE_H),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + 6), y: I(y + 7), w: I(46), h: I(GRID_TITLE_H - 14),
    fill: { color: C.white }, line: { color: C.white },
  });
  slide.addText(`EXHIBIT ${idx + 1}`, {
    x: I(x + 6), y: I(y + 7), w: I(46), h: I(GRID_TITLE_H - 14),
    fontSize: 4.5, bold: true, color: C.dark3, fontFace: "Calibri",
    align: "center", valign: "middle",
  });
  // Title section
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + BADGE_W), y: I(y), w: I(cellW - BADGE_W), h: I(GRID_TITLE_H),
    fill: { color: C.dark3 }, line: { color: C.dark3 },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: I(x + BADGE_W), y: I(y + GRID_TITLE_H - 2), w: I(cellW - BADGE_W), h: I(2),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText(title, {
    x: I(x + BADGE_W + 7), y: I(y + 4), w: I(cellW - BADGE_W - 14), h: I(GRID_TITLE_H - 6),
    fontSize: 6.5, bold: true, color: C.white, fontFace: "Calibri", valign: "middle",
  });
  // Chart body
  const bodyY = y + GRID_TITLE_H;
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
      const iY = insY + INSPAD + ii * 17;
      slide.addShape(pres.ShapeType.ellipse, {
        x: I(x + 8), y: I(iY + 1), w: I(10), h: I(10),
        fill: { color: C.primary }, line: { color: C.primary },
      });
      slide.addText("•", {
        x: I(x + 8), y: I(iY + 1), w: I(10), h: I(10),
        fontSize: 6, bold: true, color: C.white, fontFace: "Calibri",
        align: "center", valign: "middle",
      });
      const cleanIns = ins.replace(/\[\[(.+?)\]\]/g, "$1");
      slide.addText(cleanIns.length > 80 ? cleanIns.slice(0, 80) + "..." : cleanIns, {
        x: I(x + 22), y: I(iY), w: I(cellW - 28), h: I(14),
        fontSize: 5.5, color: C.dark3, fontFace: "Calibri", wrap: false,
      });
    });
  }
}

// ── Key Takeaways (single column) ────────────────────────────────────────────
function renderTakeaways(
  pres: any, slide: any,
  insights: string[], tkwY: number, availW: number, TKW_H: number,
) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: I(tkwY), w: 8.27, h: I(TKW_H),
    fill: { color: C.tkwBg }, line: { color: C.primary, width: 1.5 },
  });
  // Accent bar + label
  slide.addShape(pres.ShapeType.rect, {
    x: I(PAD), y: I(tkwY + INSPAD + 2), w: I(3), h: I(12),
    fill: { color: C.primary }, line: { color: C.primary },
  });
  slide.addText("KEY TAKEAWAYS", {
    x: I(PAD + 8), y: I(tkwY + INSPAD), w: I(200), h: I(14),
    fontSize: 6.5, bold: true, color: C.dark3, fontFace: "Calibri",
    charSpacing: 1.5, valign: "middle",
  });

  insights.forEach((ins, ii) => {
    const iY = tkwY + INSPAD + 22 + ii * (INS_ROW_H + 5);
    slide.addShape(pres.ShapeType.ellipse, {
      x: I(PAD), y: I(iY + 1), w: I(13), h: I(13),
      fill: { color: C.primary }, line: { color: C.primary },
    });
    slide.addText("✓", {
      x: I(PAD), y: I(iY + 1), w: I(13), h: I(13),
      fontSize: 5.5, bold: true, color: C.white, fontFace: "Calibri",
      align: "center", valign: "middle",
    });
    // Strip [[...]] highlights — PPT can't render them as colored spans
    const cleanIns = ins.replace(/\[\[(.+?)\]\]/g, "$1");
    slide.addText(cleanIns.length > 120 ? cleanIns.slice(0, 120) + "..." : cleanIns, {
      x: I(PAD + 17), y: I(iY), w: I(availW - 22), h: I(INS_ROW_H),
      fontSize: 6.5, color: C.dark3, fontFace: "Calibri", wrap: false,
    });
  });
}
